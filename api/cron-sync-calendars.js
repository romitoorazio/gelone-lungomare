import syncCalendarsHandler from "./sync-calendars.js";

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] || req.headers?.[name];
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}

function createMemoryResponse() {
  let statusCode = 200;
  const headers = {};

  return {
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      return {
        statusCode,
        headers,
        payload,
      };
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, {
      ok: false,
      message: "Metodo non consentito.",
    });
  }

  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  const syncSecret = String(process.env.SYNC_SECRET || "").trim();
  const authorization = getHeader(req, "authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return json(res, 401, {
      ok: false,
      message: "Cron non autorizzato.",
    });
  }

  if (!syncSecret) {
    return json(res, 500, {
      ok: false,
      message: "SYNC_SECRET non configurato.",
    });
  }

  const startedAt = new Date().toISOString();

  try {
    const memoryRes = createMemoryResponse();

    const syncResponse = await syncCalendarsHandler(
      {
        method: "POST",
        headers: {
          "x-sync-secret": syncSecret,
          "content-type": "application/json",
        },
        body: {
          unitId: "lunarossa1",
        },
      },
      memoryRes
    );

    const finishedAt = new Date().toISOString();
    const payload = syncResponse?.payload || null;
    const statusCode = Number(syncResponse?.statusCode || 500);

    if (statusCode < 200 || statusCode >= 300 || !payload?.ok) {
      return json(res, 500, {
        ok: false,
        source: "cron-sync-calendars",
        startedAt,
        finishedAt,
        message: payload?.message || "Sincronizzazione automatica non completata.",
        syncStatusCode: statusCode,
        syncResult: payload,
      });
    }

    return json(res, 200, {
      ok: true,
      source: "cron-sync-calendars",
      startedAt,
      finishedAt,
      syncResult: payload,
    });
  } catch (error) {
    console.error("Errore cron-sync-calendars:", error);

    return json(res, 500, {
      ok: false,
      source: "cron-sync-calendars",
      startedAt,
      finishedAt: new Date().toISOString(),
      message: error?.message || "Errore tecnico durante la sync automatica.",
    });
  }
}
