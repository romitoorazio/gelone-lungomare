import admin from "firebase-admin";

function json(res, status, data) {
  return res.status(status).json(data);
}

function getDb() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 mancante");
    }

    const serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin.firestore();
}

function getRomeDate(daysOffset = 0) {
  const date = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((item) => item.type === "year")?.value;
  const month = parts.find((item) => item.type === "month")?.value;
  const day = parts.find((item) => item.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatEuro(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function label(value) {
  const labels = {
    confirmed_direct: "Confermata",
    confirmed: "Confermata",
    booking: "Booking",
    airbnb: "Airbnb",
    imported_ical: "iCal",
    request: "Richiesta",
    pending: "In attesa",
    cancelled: "Annullata",
    blocked: "Blocco",
    paid: "Pagato",
    unpaid: "Non pagato",
    deposit_paid: "Caparra pagata",
    to_send: "Da inviare",
    sent: "Inviato",
    completed: "Completato",
  };

  return labels[String(value || "")] || String(value || "-");
}

function canNotify(booking) {
  const status = String(booking.status || "");

  return !["cancelled", "blocked", "request", "pending"].includes(status);
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY mancante");
  }

  const from = process.env.EMAIL_FROM || "Gelone Lungomare <info@gelone.it>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Errore Resend: ${body}`);
  }

  return body;
}

async function getUnitNames(db) {
  const names = new Map();

  try {
    const snap = await db.collection("units").get();

    snap.docs.forEach((item) => {
      const data = item.data() || {};
      names.set(item.id, data.name || data.publicName || item.id);
    });
  } catch (err) {
    console.warn("Impossibile leggere units:", err?.message || err);
  }

  return names;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Metodo non consentito" });
    }

    const secret = process.env.CRON_SECRET || process.env.SYNC_SECRET || "";
    const authHeader = req.headers.authorization || "";
    const querySecret = req.query?.secret || "";
    const headerSecret = req.headers["x-cron-secret"] || "";

    if (secret) {
      const authorized =
        authHeader === `Bearer ${secret}` ||
        querySecret === secret ||
        headerSecret === secret;

      if (!authorized) {
        return json(res, 401, { ok: false, error: "Non autorizzato" });
      }
    }

    const db = getDb();

    const today = getRomeDate(0);
    const tomorrow = getRomeDate(1);

    const snap = await db
      .collection("bookings")
      .where("checkIn", "==", tomorrow)
      .get();

    const unitNames = await getUnitNames(db);

    const arrivals = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter(canNotify)
      .sort((a, b) => {
        const unitCompare = String(a.unitId || "").localeCompare(String(b.unitId || ""));
        if (unitCompare !== 0) return unitCompare;
        return String(a.guestName || "").localeCompare(String(b.guestName || ""));
      });

    if (arrivals.length === 0) {
      return json(res, 200, {
        ok: true,
        today,
        tomorrow,
        sent: false,
        reason: "Nessun arrivo domani",
      });
    }

    const toSend = [];

    for (const booking of arrivals) {
      const reminderId = `arrival_reminder_${booking.id}_${tomorrow}`;
      const reminder = await db.collection("maintenanceLogs").doc(reminderId).get();

      if (!reminder.exists) {
        toSend.push({ ...booking, reminderId });
      }
    }

    if (toSend.length === 0) {
      return json(res, 200, {
        ok: true,
        today,
        tomorrow,
        sent: false,
        reason: "Promemoria già inviato",
        arrivals: arrivals.length,
      });
    }

    const siteUrl = process.env.PUBLIC_SITE_URL || "https://www.gelone.it";

    const recipients = String(
      process.env.ARRIVAL_REMINDER_EMAIL || "romitoorazio@gmail.com"
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const rowsHtml = toSend
      .map((booking) => {
        const unitId = booking.unitId || "lunarossa1";
        const unitName = booking.unitName || unitNames.get(unitId) || unitId;

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(unitName)}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;"><strong>${escapeHtml(booking.guestName || "Ospite")}</strong></td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(booking.guestPhone || "-")}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(booking.checkIn || "-")}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(booking.checkOut || "-")}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(booking.nights || "-")}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(label(booking.paymentStatus))}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(label(booking.welcomateStatus))}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(formatEuro(booking.totalPrice || 0))}</td>
          </tr>
        `;
      })
      .join("");

    const rowsText = toSend
      .map((booking) => {
        const unitId = booking.unitId || "lunarossa1";
        const unitName = booking.unitName || unitNames.get(unitId) || unitId;

        return [
          `Alloggio: ${unitName}`,
          `Ospite: ${booking.guestName || "Ospite"}`,
          `Telefono: ${booking.guestPhone || "-"}`,
          `Arrivo: ${booking.checkIn || "-"}`,
          `Partenza: ${booking.checkOut || "-"}`,
          `Notti: ${booking.nights || "-"}`,
          `Pagamento: ${label(booking.paymentStatus)}`,
          `WelcoMate: ${label(booking.welcomateStatus)}`,
          `Prezzo: ${formatEuro(booking.totalPrice || 0)}`,
        ].join("\n");
      })
      .join("\n\n---\n\n");

    const subject = `Arrivi di domani - ${tomorrow} - ${toSend.length} ospite/i`;

    const html = `
      <div style="font-family:Arial,sans-serif;color:#0a1d35;line-height:1.5;">
        <h2 style="margin:0 0 10px;">Promemoria arrivi di domani</h2>
        <p>Domani <strong>${escapeHtml(tomorrow)}</strong> sono previsti <strong>${toSend.length}</strong> arrivi.</p>

        <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:14px;">
          <thead>
            <tr style="background:#faf6ee;color:#9b6b25;text-align:left;">
              <th style="padding:10px;">Alloggio</th>
              <th style="padding:10px;">Ospite</th>
              <th style="padding:10px;">Telefono</th>
              <th style="padding:10px;">Arrivo</th>
              <th style="padding:10px;">Partenza</th>
              <th style="padding:10px;">Notti</th>
              <th style="padding:10px;">Pagamento</th>
              <th style="padding:10px;">WelcoMate</th>
              <th style="padding:10px;">Prezzo</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <p style="margin-top:20px;">
          <a href="${escapeHtml(siteUrl)}/admin" style="display:inline-block;background:#0a1d35;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;">
            Apri Admin
          </a>
        </p>

        <p style="margin-top:18px;color:#666;font-size:13px;">
          Promemoria automatico inviato una sola volta per ogni prenotazione.
        </p>
      </div>
    `;

    const text = [
      "Promemoria arrivi di domani",
      "",
      `Data arrivo: ${tomorrow}`,
      `Arrivi: ${toSend.length}`,
      "",
      rowsText,
      "",
      `Admin: ${siteUrl}/admin`,
    ].join("\n");

    await sendEmail({
      to: recipients,
      subject,
      html,
      text,
    });

    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    toSend.forEach((booking) => {
      batch.set(db.collection("maintenanceLogs").doc(booking.reminderId), {
        type: "arrival_reminder",
        bookingId: booking.id,
        unitId: booking.unitId || "lunarossa1",
        guestName: booking.guestName || "",
        checkIn: booking.checkIn || "",
        checkOut: booking.checkOut || "",
        reminderDate: tomorrow,
        emailTo: recipients.join(", "),
        provider: "resend",
        createdAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();

    return json(res, 200, {
      ok: true,
      today,
      tomorrow,
      sent: true,
      provider: "resend",
      emailTo: recipients,
      arrivals: toSend.length,
    });
  } catch (err) {
    console.error(err);

    return json(res, 500, {
      ok: false,
      error: err?.message || "Errore promemoria arrivi",
    });
  }
}
