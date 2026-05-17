import { getFirebaseAdminDb } from "./_firebaseAdmin.js";

function cleanText(value) {
  return String(value || "").trim();
}

function getQuery(req, key) {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function safeMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  try {
    const sessionId = cleanText(getQuery(req, "session_id"));

    if (!sessionId || !sessionId.startsWith("cs_")) {
      return res.status(400).json({
        ok: false,
        message: "Riferimento pagamento non valido.",
      });
    }

    const adminDb = getFirebaseAdminDb();

    const snapshot = await adminDb
      .collection("bookings")
      .where("stripeCheckoutSessionId", "==", sessionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({
        ok: true,
        found: false,
        message:
          "Pagamento ricevuto. Stiamo aggiornando il riepilogo della prenotazione.",
      });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return res.status(200).json({
      ok: true,
      found: true,
      reference: doc.id.slice(0, 8).toUpperCase(),
      unitName: cleanText(data.unitName || "Gelone Lungomare"),
      checkIn: cleanText(data.checkIn),
      checkOut: cleanText(data.checkOut),
      guests: Number(data.guests || 0),
      nightsCount: Number(data.nightsCount || 0),
      totalPrice: safeMoney(data.totalPrice),
      depositAmount: safeMoney(data.depositAmount),
      paymentAmount: safeMoney(data.paymentAmount),
      paymentStatus: cleanText(data.paymentStatus),
      paymentType: cleanText(data.paymentType),
    });
  } catch (error) {
    console.error("Errore payment-result:", error);

    return res.status(500).json({
      ok: false,
      message:
        error?.message ||
        "Errore tecnico durante il recupero del riepilogo pagamento.",
    });
  }
}
