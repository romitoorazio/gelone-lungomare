const PROMO_STORAGE_KEY = "gelone-promo-agosto-2026-last-shown";
const PROMO_STARTS_AT = Date.parse("2026-07-08T00:00:00+02:00");
const PROMO_EXPIRES_AT = Date.parse("2026-07-20T23:59:59+02:00");
const PROMO_DELAY_MS = 2000;

function getRomeDateKey() {
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function wasShownToday() {
  try {
    return window.localStorage.getItem(PROMO_STORAGE_KEY) === getRomeDateKey();
  } catch {
    return false;
  }
}

function rememberShownToday() {
  try {
    window.localStorage.setItem(PROMO_STORAGE_KEY, getRomeDateKey());
  } catch {
    // Il popup continua a funzionare anche se il browser blocca localStorage.
  }
}

function createPromoMarkup() {
  const whatsappMessage = encodeURIComponent(
    "Ciao, vorrei informazioni sull'offerta di agosto 2026 a 1.500 € per un appartamento. Sono interessato a Lunarossa 5 o Colombo 1."
  );

  const overlay = document.createElement("div");
  overlay.className = "gelone-promo-overlay";
  overlay.dataset.gelonePromo = "agosto-2026";
  overlay.innerHTML = `
    <section class="gelone-promo-card" role="dialog" aria-modal="true" aria-labelledby="gelone-promo-title" aria-describedby="gelone-promo-description">
      <button class="gelone-promo-close" type="button" aria-label="Chiudi offerta">&times;</button>
      <p class="gelone-promo-eyebrow">Offerta a tempo limitato</p>
      <h2 id="gelone-promo-title">Agosto 2026 a Gela</h2>
      <div class="gelone-promo-price">
        <strong>1.500 €</strong>
        <span>per ciascun appartamento</span>
      </div>
      <p id="gelone-promo-description" class="gelone-promo-intro">
        Trascorri tutto il mese di agosto in uno dei nostri appartamenti:
      </p>
      <ul class="gelone-promo-units">
        <li>Lunarossa 5</li>
        <li>Colombo 1</li>
      </ul>
      <p class="gelone-promo-note">
        Il prezzo si riferisce a un singolo appartamento per l’intero mese di agosto 2026. Offerta soggetta a disponibilità.
      </p>
      <a class="gelone-promo-cta" href="https://wa.me/393476308456?text=${whatsappMessage}" target="_blank" rel="noreferrer">
        Richiedi disponibilità su WhatsApp
      </a>
      <p class="gelone-promo-deadline">Prenotabile entro il 20 luglio 2026</p>
    </section>
  `;

  return overlay;
}

export function installPromoAgosto() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.location.pathname.startsWith("/admin")) return;
  if (new URLSearchParams(window.location.search).has("payment")) return;
  if (document.querySelector('[data-gelone-promo="agosto-2026"]')) return;

  const now = Date.now();
  if (now < PROMO_STARTS_AT || now > PROMO_EXPIRES_AT || wasShownToday()) return;

  window.setTimeout(() => {
    if (document.querySelector('[data-gelone-promo="agosto-2026"]')) return;
    if (document.querySelector('[role="dialog"]')) return;

    const previouslyFocused = document.activeElement;
    const overlay = createPromoMarkup();
    const closeButton = overlay.querySelector(".gelone-promo-close");

    const closePromo = () => {
      document.documentElement.classList.remove("gelone-promo-open");
      document.removeEventListener("keydown", handleKeyDown);
      overlay.remove();

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closePromo();
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closePromo();
    });
    closeButton?.addEventListener("click", closePromo);
    document.addEventListener("keydown", handleKeyDown);

    document.body.appendChild(overlay);
    document.documentElement.classList.add("gelone-promo-open");
    rememberShownToday();
    closeButton?.focus({ preventScroll: true });
  }, PROMO_DELAY_MS);
}
