import { FieldValue, getFirebaseAdminDb } from "./_firebaseAdmin.js";

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
}

function clean(value) {
  return String(value || "").trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isActiveStatus(status) {
  const value = clean(status).toLowerCase();
  return !["cancelled", "canceled", "deleted", "available", "rejected", "declined"].includes(value);
}

function isProtectedExternal(data) {
  const source = clean(data?.source).toLowerCase();
  return source.includes("booking") || source.includes("airbnb") || Boolean(data?.externalKey);
}

function timestampMs(value) {
  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreKeepCandidate(item, nightOwnerIds) {
  const data = item.data || {};
  let score = 0;

  if (nightOwnerIds.has(item.id)) score += 10000;
  if (isProtectedExternal(data)) score += 5000;
  if (clean(data.guestPhone)) score += 100;
  if (clean(data.guestEmail)) score += 80;
  if (Number(data.totalPrice || 0) > 0) score += 60;
  if (["paid", "deposit_paid"].includes(clean(data.paymentStatus).toLowerCase())) score += 40;

  const created = timestampMs(data.createdAt);
  if (created) score -= Math.floor(created / 1000000000) / 1000000;

  return score;
}

function getNightDates(checkIn, checkOut) {
  const nights = [];
  const cursor = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);

  while (cursor < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    return json(res, 405, { ok: false, message: "Metodo non consentito." });
  }

  const params = req.method === "POST" ? req.body || {} : req.query || {};
  const confirm = clean(params.confirm);

  if (confirm !== "DEDUPLICA") {
    return json(res, 403, {
      ok: false,
      message: "Conferma mancante. Aggiungi confirm=DEDUPLICA solo quando vuoi eseguire la pulizia.",
    });
  }

  const unitId = clean(params.unitId) || "lunarossa1";
  const checkIn = clean(params.checkIn);
  const checkOut = clean(params.checkOut);
  const guest = normalize(params.guest || "");
  const execute = clean(params.execute).toLowerCase() === "yes";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) || checkOut <= checkIn) {
    return json(res, 400, { ok: false, message: "Date non valide." });
  }

  if (guest.length < 3) {
    return json(res, 400, { ok: false, message: "Nome ospite troppo corto." });
  }

  try {
    const adminDb = getFirebaseAdminDb();
    const bookingSnapshot = await adminDb
      .collection("bookings")
      .where("unitId", "==", unitId)
      .where("checkIn", "==", checkIn)
      .where("checkOut", "==", checkOut)
      .get();

    const candidates = bookingSnapshot.docs
      .map((snap) => ({ id: snap.id, ref: snap.ref, data: snap.data() || {} }))
      .filter((item) => isActiveStatus(item.data.status))
      .filter((item) => normalize(item.data.guestName).includes(guest));

    if (candidates.length <= 1) {
      return json(res, 200, {
        ok: true,
        message: "Non ci sono doppioni attivi con questi dati.",
        execute,
        count: candidates.length,
        candidates: candidates.map((item) => ({ id: item.id, guestName: item.data.guestName, status: item.data.status, source: item.data.source })),
      });
    }

    const nights = getNightDates(checkIn, checkOut);
    const nightRefs = nights.map((night) => adminDb.collection("nights").doc(`${unitId}_${night}`));
    const nightSnaps = nightRefs.length ? await adminDb.getAll(...nightRefs) : [];
    const nightOwnerIds = new Set(
      nightSnaps
        .filter((snap) => snap.exists)
        .map((snap) => clean(snap.data()?.bookingId))
        .filter(Boolean)
    );

    const sorted = [...candidates].sort(
      (a, b) => scoreKeepCandidate(b, nightOwnerIds) - scoreKeepCandidate(a, nightOwnerIds)
    );
    const keep = sorted[0];
    const toDelete = sorted.slice(1).filter((item) => !isProtectedExternal(item.data));
    const protectedDuplicates = sorted.slice(1).filter((item) => isProtectedExternal(item.data));

    if (!execute) {
      return json(res, 200, {
        ok: true,
        dryRun: true,
        message: "Controllo completato. Aggiungi execute=yes per cancellare i doppioni non protetti.",
        keep: { id: keep.id, guestName: keep.data.guestName, source: keep.data.source, status: keep.data.status },
        deletable: toDelete.map((item) => ({ id: item.id, guestName: item.data.guestName, source: item.data.source, status: item.data.status })),
        protectedDuplicates: protectedDuplicates.map((item) => ({ id: item.id, guestName: item.data.guestName, source: item.data.source, status: item.data.status })),
        nightOwnerIds: Array.from(nightOwnerIds),
      });
    }

    if (toDelete.length === 0) {
      return json(res, 200, {
        ok: true,
        message: "Ho trovato doppioni, ma sono protetti perché arrivano da portali esterni. Nessuna cancellazione eseguita.",
      });
    }

    const batch = adminDb.batch();

    nightRefs.forEach((nightRef, index) => {
      const night = nights[index];
      batch.set(
        nightRef,
        {
          unitId,
          date: night,
          bookingId: keep.id,
          status: keep.data.status || "confirmed_direct",
          source: keep.data.source || "manual",
          guestName: keep.data.guestName || "Prenotazione",
          dedupeCheckedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    toDelete.forEach((item) => {
      batch.delete(item.ref);
    });

    batch.set(adminDb.collection("maintenanceLogs").doc(), {
      type: "admin_fix",
      action: "deduplicated_bookings",
      unitId,
      checkIn,
      checkOut,
      guestSearch: guest,
      keptBookingId: keep.id,
      deletedBookingIds: toDelete.map((item) => item.id),
      protectedDuplicateIds: protectedDuplicates.map((item) => item.id),
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return json(res, 200, {
      ok: true,
      message: `Pulizia completata: eliminati ${toDelete.length} doppioni, tenuta 1 prenotazione.`,
      keptBookingId: keep.id,
      deletedBookingIds: toDelete.map((item) => item.id),
      protectedDuplicateIds: protectedDuplicates.map((item) => item.id),
    });
  } catch (error) {
    console.error("dedupe bookings error", error);
    return json(res, 500, {
      ok: false,
      message: "Errore durante la pulizia doppioni.",
      error: error?.message || String(error),
    });
  }
}
