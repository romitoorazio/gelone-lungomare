const goneHtml = `<!doctype html>
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
      <p>Questo indirizzo apparteneva a una vecchia versione del sito o a una pagina tecnica non più attiva.</p>
      <p>Per informazioni aggiornate sulla struttura, visita la pagina principale di Gelone Lungomare.</p>
      <a href="/">Vai alla home</a>
    </main>
  </body>
</html>`;

function isOldIndexedPath(pathname) {
  return (
    pathname.startsWith("/service-") ||
    pathname.startsWith("/users/") ||
    pathname === "/login" ||
    pathname === "/recover" ||
    pathname.startsWith("/page/")
  );
}

export default function middleware(request) {
  const url = new URL(request.url);

  if (url.pathname === "/booking/request") {
    return Response.redirect(new URL("/", request.url), 308);
  }

  if (isOldIndexedPath(url.pathname)) {
    return new Response(goneHtml, {
      status: 410,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }

  return undefined;
}

export const config = {
  matcher: [
    "/service-:path*",
    "/users/:path*",
    "/login",
    "/recover",
    "/page/:path*",
    "/booking/request"
  ]
};
