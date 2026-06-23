import { FieldValue, getFirebaseAdminDb } from "./_firebaseAdmin.js";

const TEMP_FIX_CODE = "FRANCESCO-20260630";

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

function getCreatedMs(value) {
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function keepScore(item, nightOwnerIds) {
  const data = item.data || {};
  let score = 0;

  if (nightOwnerIds.has(item.id)) score += 10000;
  if (isProtectedExternal(data)) score += 5000;
  if (clean(data.guestPhone)) score += 100;
  if (clean(data.guestEmail)) score += 80;
  if (Number(data.totalPrice || 0) > 0) score += 60;
  if (["paid", "deposit_paid"].includes(clean(data.paymentStatus).toLowerCase())) score += 40;

  const created = getCreatedMs(data.createdAt);
  if (created) score -= created / 100000000000;

  return score;
}

async function fixFrancescoDuplicate(req, res) {
  const code = clean(req.query?.code || req.body?.code);

  if (code !== TEMP_FIX_CODE) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(403).json({ ok: false, message: "Codice sicurezza non valido." });
  }

  const unitId = "lunarossa1";
  const checkIn = "2026-06-30";
  const checkOut = "2026-07-02";
  const guestNeedle = "francesco";
  const adminDb = getFirebaseAdminDb();

  const snapshot = await adminDb
    .collection("bookings")
    .where("unitId", "==", unitId)
    .where("checkIn", "==", checkIn)
    .where("checkOut", "==", checkOut)
    .get();

  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() || {} }))
    .filter((item) => isActiveStatus(item.data.status))
    .filter((item) => normalize(item.data.guestName).includes(guestNeedle));

  if (candidates.length <= 1) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      ok: true,
      message: "Nessun doppione attivo trovato. Non ho cancellato nulla.",
      count: candidates.length,
      candidates: candidates.map((item) => ({ id: item.id, guestName: item.data.guestName, source: item.data.source, status: item.data.status })),
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

  const sorted = [...candidates].sort((a, b) => keepScore(b, nightOwnerIds) - keepScore(a, nightOwnerIds));
  const keep = sorted[0];
  const duplicates = sorted.slice(1).filter((item) => !isProtectedExternal(item.data));
  const protectedDuplicates = sorted.slice(1).filter((item) => isProtectedExternal(item.data));

  if (duplicates.length === 0) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      ok: true,
      message: "Doppioni trovati, ma protetti perché arrivano da portali esterni. Non ho cancellato nulla.",
      keep: keep.id,
      protectedDuplicates: protectedDuplicates.map((item) => item.id),
    });
  }

  const batch = adminDb.batch();

  nights.forEach((night, index) => {
    batch.set(
      nightRefs[index],
      {
        unitId,
        date: night,
        bookingId: keep.id,
        status: keep.data.status || "confirmed_direct",
        source: keep.data.source || "manual",
        guestName: keep.data.guestName || "Francesco D Natale",
        duplicateFixAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  duplicates.forEach((item) => {
    batch.delete(item.ref);
  });

  batch.set(adminDb.collection("maintenanceLogs").doc(), {
    type: "admin_fix",
    action: "fixed_duplicate_francesco_booking",
    unitId,
    checkIn,
    checkOut,
    keptBookingId: keep.id,
    deletedBookingIds: duplicates.map((item) => item.id),
    protectedDuplicateIds: protectedDuplicates.map((item) => item.id),
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({
    ok: true,
    message: `Pulizia completata: eliminati ${duplicates.length} doppioni. Date ancora bloccate sulla prenotazione tenuta.`,
    keptBookingId: keep.id,
    deletedBookingIds: duplicates.map((item) => item.id),
    nightsProtected: nights,
  });
}

export default async function handler(req, res) {
  if (clean(req.query?.fix || req.body?.fix) === "francesco-duplicate") {
    try {
      return await fixFrancescoDuplicate(req, res);
    } catch (error) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(500).json({
        ok: false,
        message: "Errore durante la pulizia del doppione.",
        error: error?.message || String(error),
      });
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  return res.status(410).send(`<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pagina rimossa | Gelone Lungomare</title>
    <style>
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #faf6ee;
        color: #0a1d35;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      main {
        max-width: 680px;
        background: #ffffff;
        border: 1px solid #e4d8c2;
        border-radius: 28px;
        padding: 34px;
        box-shadow: 0 12px 36px rgba(10, 29, 53, 0.08);
      }
      h1 {
        font-family: Georgia, "Times New Roman", serif;
        font-size: clamp(34px, 7vw, 58px);
        line-height: 1;
        margin: 0 0 16px;
      }
      p {
        color: #4c4c4c;
        font-size: 17px;
        line-height: 1.7;
      }
      a {
        display: inline-flex;
        margin-top: 18px;
        border-radius: 999px;
        padding: 14px 20px;
        background: #f5c84b;
        color: #0a1d35;
        text-decoration: none;
        font-weight: 800;
        border: 1px solid #b88416;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Pagina non più disponibile</h1>
      <p>
        Questo indirizzo apparteneva a una vecchia versione del sito o a una pagina tecnica non più attiva.
      </p>
      <p>
        Per informazioni aggiornate sulla struttura, visita la pagina principale di Gelone Lungomare.
      </p>
      <a href="/">Vai alla home</a>
    </main>
  </body>
</html>`);
}
