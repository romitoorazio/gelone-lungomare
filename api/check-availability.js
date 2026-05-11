export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  const backendUrl = process.env.GELONE_APPS_SCRIPT_URL;
  const backendToken = process.env.GELONE_APPS_SCRIPT_TOKEN || "";

  if (!backendUrl) {
    return res.status(500).json({
      ok: false,
      message:
        "Servizio disponibilità non configurato. Manca GELONE_APPS_SCRIPT_URL su Vercel.",
    });
  }

  const { unit = "lunarossa1", checkIn, checkOut } = req.body || {};

  if (!checkIn || !checkOut) {
    return res.status(400).json({
      ok: false,
      message: "Data arrivo e data partenza sono obbligatorie.",
    });
  }

  if (checkOut <= checkIn) {
    return res.status(400).json({
      ok: false,
      message: "La data di partenza deve essere successiva alla data di arrivo.",
    });
  }

  try {
    const params = new URLSearchParams({
      action: "availability",
      unit,
      checkIn,
      checkOut,
    });

    if (backendToken) {
      params.set("token", backendToken);
    }

    const separator = backendUrl.includes("?") ? "&" : "?";
    const requestUrl = `${backendUrl}${separator}${params.toString()}`;

    const upstreamResponse = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const contentType = upstreamResponse.headers.get("content-type") || "";
    const rawText = await upstreamResponse.text();

    let upstreamData = null;

    if (contentType.includes("application/json")) {
      try {
        upstreamData = JSON.parse(rawText);
      } catch {
        upstreamData = null;
      }
    } else {
      try {
        upstreamData = JSON.parse(rawText);
      } catch {
        upstreamData = {
          raw: rawText,
        };
      }
    }

    if (!upstreamResponse.ok) {
      return res.status(502).json({
        ok: false,
        message:
          upstreamData?.message ||
          "Errore nella risposta del sistema interno disponibilità.",
      });
    }

    const available =
      upstreamData?.available ??
      upstreamData?.disponibile ??
      upstreamData?.libero ??
      (upstreamData?.status === "available"
        ? true
        : upstreamData?.status === "booked"
        ? false
        : upstreamData?.status === "occupied"
        ? false
        : null);

    let message = upstreamData?.message || "";

    if (!message) {
      if (available === true) {
        message =
          "Le date risultano libere nel sistema interno. La conferma definitiva deve essere fatta dalla struttura.";
      } else if (available === false) {
        message =
          "Le date risultano occupate nel sistema interno. Puoi provare altre date o contattarci.";
      } else {
        message =
          "Il sistema ha risposto, ma non è stato possibile interpretare automaticamente la disponibilità.";
      }
    }

    return res.status(200).json({
      ok: true,
      unit,
      checkIn,
      checkOut,
      available,
      message,
      source: "internal-availability-check",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message:
        "Errore tecnico durante il controllo disponibilità. Riprova più tardi o contattaci su WhatsApp.",
    });
  }
}