import fs from "node:fs";

const path = new URL("../api/cron-sync-calendars.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");
let changes = 0;

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`[pms-v2-github-oidc] blocco non trovato: ${label}`);
  }
  source = source.replace(before, after);
  changes += 1;
  console.log(`[pms-v2-github-oidc] ${label}`);
}

const headerBlock = `function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] || req.headers?.[name];
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}`;

const oidcHelpers = `${headerBlock}

let githubOidcJwksCache = {
  expiresAt: 0,
  keys: [],
};

function decodeBase64UrlJson(value) {
  return JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
}

async function getGithubOidcJwks() {
  if (githubOidcJwksCache.expiresAt > Date.now() && githubOidcJwksCache.keys.length > 0) {
    return githubOidcJwksCache.keys;
  }

  const response = await fetch("https://token.actions.githubusercontent.com/.well-known/jwks", {
    headers: { "User-Agent": "gelone-lungomare-oidc-verifier" },
  });

  if (!response.ok) {
    throw new Error("JWKS GitHub OIDC non disponibile: HTTP " + response.status);
  }

  const payload = await response.json();
  const keys = Array.isArray(payload?.keys) ? payload.keys : [];

  if (keys.length === 0) {
    throw new Error("JWKS GitHub OIDC senza chiavi.");
  }

  githubOidcJwksCache = {
    expiresAt: Date.now() + 60 * 60 * 1000,
    keys,
  };

  return keys;
}

async function verifyGithubActionsOidc(authorization) {
  try {
    const token = String(authorization || "").replace(/^Bearer\\s+/i, "").trim();
    if (!token || token.split(".").length !== 3) return false;

    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    const header = decodeBase64UrlJson(encodedHeader);
    const payload = decodeBase64UrlJson(encodedPayload);

    if (header?.alg !== "RS256" || !header?.kid) return false;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const audience = Array.isArray(payload?.aud) ? payload.aud : [payload?.aud];
    const allowedEvent = ["schedule", "workflow_dispatch"].includes(String(payload?.event_name || ""));
    const allowedWorkflowRef = String(payload?.workflow_ref || "").startsWith(
      "romitoorazio/gelone-lungomare/.github/workflows/sync-calendars.yml@refs/heads/main"
    );

    if (
      payload?.iss !== "https://token.actions.githubusercontent.com" ||
      !audience.includes("https://www.gelone.it") ||
      payload?.repository !== "romitoorazio/gelone-lungomare" ||
      payload?.ref !== "refs/heads/main" ||
      !allowedEvent ||
      !allowedWorkflowRef ||
      !Number.isFinite(Number(payload?.exp)) ||
      Number(payload.exp) <= nowSeconds ||
      (payload?.nbf && Number(payload.nbf) > nowSeconds + 30)
    ) {
      return false;
    }

    const keys = await getGithubOidcJwks();
    const jwk = keys.find((item) => item?.kid === header.kid);
    if (!jwk) return false;

    const key = await globalThis.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signature = Buffer.from(encodedSignature, "base64url");
    const signedData = new TextEncoder().encode(encodedHeader + "." + encodedPayload);

    return globalThis.crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      signedData
    );
  } catch (error) {
    console.warn("GitHub OIDC non verificato:", error?.message || error);
    return false;
  }
}`;

replaceOnce(headerBlock, oidcHelpers, "verifica GitHub Actions OIDC");

const oldAuthBlock = `  const vercelCronSchedule = getHeader(req, "x-vercel-cron-schedule");
  const userAgent = getHeader(req, "user-agent");
  const authorizedByCron =
    Boolean(cronSecret) && authorization === \`Bearer \${cronSecret}\`;
  const authorizedBySync =
    Boolean(syncSecret) &&
    (authorization === \`Bearer \${syncSecret}\` ||
      xSyncSecret === syncSecret ||
      querySecret === syncSecret);
  const authorizedByVercelCron =
    ["0 5 * * *", "5 5 * * *"].includes(vercelCronSchedule) &&
    userAgent.toLowerCase().includes("vercel-cron");

  if (!authorizedByCron && !authorizedBySync && !authorizedByVercelCron) {
    return json(res, 401, { ok: false, message: "Cron non autorizzato." });
  }`;

const newAuthBlock = `  const vercelCronSchedule = getHeader(req, "x-vercel-cron-schedule");
  const userAgent = getHeader(req, "user-agent");
  const authorizedByCron =
    Boolean(cronSecret) && authorization === \`Bearer \${cronSecret}\`;
  const authorizedBySync =
    Boolean(syncSecret) &&
    (authorization === \`Bearer \${syncSecret}\` ||
      xSyncSecret === syncSecret ||
      querySecret === syncSecret);
  const authorizedByVercelCron =
    ["0 5 * * *", "5 5 * * *"].includes(vercelCronSchedule) &&
    userAgent.toLowerCase().includes("vercel-cron");
  const authorizedByGithubOidc =
    !authorizedByCron &&
    !authorizedBySync &&
    !authorizedByVercelCron &&
    authorization.startsWith("Bearer ")
      ? await verifyGithubActionsOidc(authorization)
      : false;

  if (!authorizedByCron && !authorizedBySync && !authorizedByVercelCron && !authorizedByGithubOidc) {
    return json(res, 401, { ok: false, message: "Cron non autorizzato." });
  }`;

replaceOnce(oldAuthBlock, newAuthBlock, "autorizzazione cron con OIDC GitHub");

fs.writeFileSync(path, source, "utf8");
console.log(`[pms-v2-github-oidc] completato: ${changes} modifiche.`);
