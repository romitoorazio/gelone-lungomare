import {
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
} from "./_firebaseAdmin.js";
import { DEFAULT_UNIT_ID, bookingUnitId, getUnitConfig, sanitizeUnitId } from "./_units.js";

const ADMIN_EMAILS = ["romitoorazio@gmail.com", "romitofrancesco1@gmail.com"];
const INACTIVE_STATUSES = ["cancelled", "canceled", "deleted", "available", "rejected", "declined"];
const MAX_DELETE_PER_RUN = 500;

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(status).json(payload);
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] || req.headers?.[name];
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}

function cleanText(value) {
  return String(value || "").trim();
}

function getBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isActiveStatus(status) {
  const value = String(status || "").toLowerCase();
  return !INACTIVE_STATUSES.includes(value);
}

function bookingCoversDate(data, date) {
  const checkIn = cleanText(data?.checkIn);
  const checkOut = cleanText(data?.checkOut);

  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn) {
    return false;
  }

  return checkIn <= date && checkOut > date;
}

async function verifyRequest(req) {
  const authorization = getHeader(req, "authorization");
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return {
      ok: false,
      status: 401,
      message: "Accesso non autorizzato. Effettua il login admin e riprova.",
    };
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(match[1]);
    const email = cleanText(decoded.email).toLowerCase();
    const allowed = ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email);

    if (!allowed) {
      return {
        ok: false,
        status: 403,
        message: "Email non autorizzata alla pulizia notti fantasma.",
      };
    }

    return { ok: true, email };
  } catch (error) {
    return {
      ok: false,
      status: 401,
      message: "Sessione admin non valida. Rieffettua il login.",
    };
  }
}

async function commitDeletes(adminDb, ghostNights) {
  let deletedCount = 0;

  for (let index = 0; index < ghostNights.length; index += 450) {
    const chunk = ghostNights.slice(index, index + 450);
    const batch = adminDb.batch();

    chunk.forEach((night) => {
      batch.delete(adminDb.collection("nights").doc(night.id));
    });

    await batch.commit();
    deletedCount += chunk.length;
  }

  return deletedCount;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "Metodo non consentito." });
  }

  const authResult = await verifyRequest(req);
  if (!authResult.ok) {
    return json(res, authResult.status, { ok: false, message: authResult.message });
  }

  try {
    const adminDb = getFirebaseAdminDb();
    const body = getBody(req);
    const requestedUnitId = sanitizeUnitId(body.unitId || DEFAULT_UNIT_ID) || DEFAULT_UNIT_ID;
    const dryRun = Boolean(body.dryRun);
    const unit = await getUnitConfig(adminDb, requestedUnitId);

    if (!unit) {
      return json(res, 404, { ok: false, message: "Unità non trovata." });
    }

    const nightsSnapshot = await adminDb
      .collection("nights")
      .where("unitId", "==", unit.id)
      .get();

    const nights = [];
    const bookingIds = new Set();

    nightsSnapshot.forEach((doc) => {
      const data = doc.data();
      const date = cleanText(data?.date) || cleanText(doc.id).split("_").pop();
      const bookingId = cleanText(data?.bookingId);
      const status = cleanText(data?.status);

      if (!isActiveStatus(status)) {
        return;
      }

      nights.push({
        id: doc.id,
        date,
        bookingId,
        status,
        source: cleanText(data?.source),
        unitId: cleanText(data?.unitId) || unit.id,
      });

      if (bookingId) {
        bookingIds.add(bookingId);
      }
    });

    const bookingMap = new Map();
    const bookingIdList = [...bookingIds];

    for (let index = 0; index < bookingIdList.length; index += 300) {
      const refs = bookingIdList
        .slice(index, index + 300)
        .map((bookingId) => adminDb.collection("bookings").doc(bookingId));

      if (refs.length < 1) continue;

      const snapshots = await adminDb.getAll(...refs);
      snapshots.forEach((snapshot) => {
        if (snapshot.exists) {
          bookingMap.set(snapshot.id, snapshot.data());
        }
      });
    }

    const ghostNights = [];
    const keptNights = [];

    nights.forEach((night) => {
      const booking = night.bookingId ? bookingMap.get(night.bookingId) : null;
      const reasons = [];

      if (!isValidDate(night.date)) {
        reasons.push("data_notte_non_valida");
      }

      if (!night.bookingId) {
        reasons.push("bookingId_mancante");
      }

      if (night.bookingId && !booking) {
        reasons.push("prenotazione_collegata_non_trovata");
      }

      if (booking && bookingUnitId(booking) !== unit.id) {
        reasons.push("prenotazione_di_altra_unita");
      }

      if (booking && !isActiveStatus(booking?.status)) {
        reasons.push("prenotazione_non_attiva");
      }

      if (booking && isActiveStatus(booking?.status) && !bookingCoversDate(booking, night.date)) {
        reasons.push("prenotazione_non_copre_la_data");
      }

      if (reasons.length > 0) {
        ghostNights.push({
          id: night.id,
          date: night.date,
          status: night.status,
          source: night.source,
          bookingId: night.bookingId,
          reasons,
        });
      } else {
        keptNights.push({ id: night.id, date: night.date, bookingId: night.bookingId });
      }
    });

    if (ghostNights.length > MAX_DELETE_PER_RUN) {
      return json(res, 409, {
        ok: false,
        message:
          `Trovate ${ghostNights.length} notti fantasma. Per sicurezza il limite è ${MAX_DELETE_PER_RUN} per esecuzione. Contatta l'assistenza prima di procedere.`,
        scannedCount: nights.length,
        ghostCount: ghostNights.length,
        deletedCount: 0,
        sampleGhosts: ghostNights.slice(0, 50),
      });
    }

    const deletedCount = dryRun ? 0 : await commitDeletes(adminDb, ghostNights);

    await adminDb.collection("maintenanceLogs").add({
      type: "cleanup_ghost_nights",
      unitId: unit.id,
      unitName: unit.publicName || unit.name,
      dryRun,
      scannedCount: nights.length,
      ghostCount: ghostNights.length,
      deletedCount,
      keptCount: keptNights.length,
      deletedNights: ghostNights.slice(0, 100),
      requestedBy: authResult.email || "",
      createdAt: new Date().toISOString(),
    });

    return json(res, 200, {
      ok: true,
      unitId: unit.id,
      unitName: unit.publicName || unit.name,
      dryRun,
      scannedCount: nights.length,
      ghostCount: ghostNights.length,
      deletedCount,
      keptCount: keptNights.length,
      deletedNights: ghostNights.slice(0, 100),
      message:
        deletedCount > 0
          ? `Pulizia completata: ${deletedCount} notti fantasma eliminate.`
          : "Controllo completato: nessuna notte fantasma da eliminare.",
    });
  } catch (error) {
    console.error("Errore cleanup-ghost-nights:", error);
    return json(res, 500, {
      ok: false,
      message: error?.message || "Errore tecnico durante la pulizia notti fantasma.",
    });
  }
}
