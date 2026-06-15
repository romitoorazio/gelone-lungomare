import {
  getBody,
  json,
  requireAdmin,
  sendBookingCancellationEmail,
} from "./_bookingGuestEmails.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return json(res, 405, {
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  try {
    const adminUser = await requireAdmin(req);
    const body = getBody(req);

    const emailNotification = await sendBookingCancellationEmail({
      bookingId: body.bookingId,
      reason: body.reason,
      adminEmail: adminUser.email,
    });

    return json(res, 200, {
      ok: true,
      emailNotification,
    });
  } catch (error) {
    console.error("Errore send-cancellation-email:", error);

    return json(res, error?.statusCode || 500, {
      ok: false,
      message: error?.message || "Errore durante invio email annullamento.",
    });
  }
}
