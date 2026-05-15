import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const ADMIN_EMAILS = ["romitoorazio@gmail.com", "romitofrancesco1@gmail.com"];
const DEFAULT_UNITS = [
  {
    id: "lunarossa1",
    name: "Lunarossa 1",
    publicName: "Gelone Lungomare",
    active: true,
    publicVisible: true,
  },
];

const firebaseConfig = {
  apiKey: "AIzaSyCdz5rPl--09OneuaVDUz36qfmcuvMYu0M",
  authDomain: "gelone-lungomare-pms.firebaseapp.com",
  projectId: "gelone-lungomare-pms",
  storageBucket: "gelone-lungomare-pms.firebasestorage.app",
  messagingSenderId: "397268023464",
  appId: "1:397268023464:web:e8bbf7342eac85b6bf2a9d",
  measurementId: "G-CPTBWHN86V",
};

let firestoreDb = null;
let unsubscribeUnits = null;

function isAdminEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === value);
}

function cleanText(value) {
  return String(value || "").trim();
}

function sanitizeUnitId(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function normalizeUnit(raw = {}, fallback = DEFAULT_UNITS[0]) {
  const id = sanitizeUnitId(raw.id || fallback.id || "lunarossa1") || "lunarossa1";
  return {
    ...fallback,
    ...raw,
    id,
    name: cleanText(raw.name || fallback.name || id),
    publicName: cleanText(raw.publicName || raw.name || fallback.publicName || fallback.name || id),
    active: raw.active ?? fallback.active ?? true,
    publicVisible: raw.publicVisible ?? fallback.publicVisible ?? false,
    sortOrder: Number(raw.sortOrder || fallback.sortOrder || 999),
  };
}

function getUnitLabel(unit) {
  const publicName = cleanText(unit.publicName || unit.name || unit.id);
  const internalName = cleanText(unit.name || unit.id);
  const status = unit.active && unit.publicVisible ? "pubblica" : "bozza/non visibile";

  if (publicName && publicName !== internalName) {
    return `${publicName} — ${internalName} (${status})`;
  }

  return `${publicName} (${status})`;
}

function getUnitListFromSnapshot(snapshot) {
  const items = Array.isArray(snapshot.data()?.items) ? snapshot.data().items : [];
  const normalized = items
    .map((item) => normalizeUnit(item))
    .filter((unit) => unit.id)
    .sort((a, b) => {
      if ((a.sortOrder || 999) === (b.sortOrder || 999)) {
        return getUnitLabel(a).localeCompare(getUnitLabel(b));
      }
      return (a.sortOrder || 999) - (b.sortOrder || 999);
    });

  return normalized.length > 0 ? normalized : DEFAULT_UNITS;
}

function createPanel() {
  const existing = document.getElementById("gelone-maintenance-panel");
  if (existing) return existing;

  const panel = document.createElement("aside");
  panel.id = "gelone-maintenance-panel";
  panel.innerHTML = `
    <div class="gelone-maintenance-card">
      <div>
        <p class="gelone-maintenance-kicker">Manutenzione PMS</p>
        <strong>Pulisci notti fantasma</strong>
        <p class="gelone-maintenance-text">Controlla le notti bloccate senza prenotazione o blocco attivo collegato.</p>
      </div>
      <label class="gelone-maintenance-label">
        Unità
        <select id="gelone-maintenance-unit">
          <option value="lunarossa1">Gelone Lungomare — Lunarossa 1</option>
        </select>
        <small id="gelone-maintenance-unit-help">ID interno usato solo dal PMS.</small>
      </label>
      <button id="gelone-maintenance-clean" type="button">Pulisci ora</button>
      <pre id="gelone-maintenance-result" aria-live="polite"></pre>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #gelone-maintenance-panel {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 9999;
      max-width: min(380px, calc(100vw - 32px));
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .gelone-maintenance-card {
      border: 1px solid #e4d8c2;
      border-radius: 24px;
      background: #ffffff;
      box-shadow: 0 18px 45px rgba(10, 29, 53, 0.18);
      padding: 18px;
      color: #0a1d35;
    }
    .gelone-maintenance-kicker {
      margin: 0 0 4px;
      color: #9b6b25;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .gelone-maintenance-card strong {
      display: block;
      font-size: 18px;
      line-height: 1.2;
    }
    .gelone-maintenance-text {
      margin: 8px 0 14px;
      color: #5b6472;
      font-size: 13px;
      line-height: 1.5;
    }
    .gelone-maintenance-label {
      display: grid;
      gap: 6px;
      margin-bottom: 12px;
      font-size: 12px;
      font-weight: 800;
      color: #0a1d35;
    }
    #gelone-maintenance-unit {
      width: 100%;
      border: 1px solid #d7c49f;
      border-radius: 14px;
      background: #faf6ee;
      padding: 11px 12px;
      color: #0a1d35;
      font-weight: 800;
      outline: none;
    }
    #gelone-maintenance-unit-help {
      color: #6b7280;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.4;
    }
    #gelone-maintenance-clean {
      width: 100%;
      border: 0;
      border-radius: 999px;
      background: #0a1d35;
      color: #ffffff;
      padding: 12px 16px;
      font-weight: 900;
      cursor: pointer;
    }
    #gelone-maintenance-clean:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    #gelone-maintenance-result {
      display: none;
      margin: 12px 0 0;
      max-height: 180px;
      overflow: auto;
      border-radius: 16px;
      background: #faf6ee;
      padding: 12px;
      white-space: pre-wrap;
      font-size: 12px;
      line-height: 1.45;
      color: #0a1d35;
    }
    @media (max-width: 760px) {
      #gelone-maintenance-panel {
        right: 10px;
        left: 10px;
        bottom: 10px;
        max-width: none;
      }
      .gelone-maintenance-card {
        padding: 14px;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(panel);
  return panel;
}

function showResult(text) {
  const result = document.getElementById("gelone-maintenance-result");
  if (!result) return;
  result.style.display = "block";
  result.textContent = text;
}

function renderUnits(units) {
  const select = document.getElementById("gelone-maintenance-unit");
  if (!select) return;

  const current = select.value || "lunarossa1";
  const safeUnits = Array.isArray(units) && units.length > 0 ? units : DEFAULT_UNITS;

  select.innerHTML = safeUnits
    .map((unit) => `<option value="${unit.id}">${getUnitLabel(unit)}</option>`)
    .join("");

  if (safeUnits.some((unit) => unit.id === current)) {
    select.value = current;
  } else {
    select.value = safeUnits[0]?.id || "lunarossa1";
  }
}

function loadUnitsForPanel() {
  renderUnits(DEFAULT_UNITS);

  if (!firestoreDb || unsubscribeUnits) return;

  unsubscribeUnits = onSnapshot(
    doc(firestoreDb, "settings", "units"),
    (snapshot) => {
      if (!snapshot.exists()) {
        renderUnits(DEFAULT_UNITS);
        return;
      }

      renderUnits(getUnitListFromSnapshot(snapshot));
    },
    (error) => {
      console.warn("Unità manutenzione non caricate:", error);
      renderUnits(DEFAULT_UNITS);
    }
  );
}

function setupMaintenance(user) {
  if (!location.pathname.startsWith("/admin")) return;
  if (!user || !isAdminEmail(user.email)) return;

  const panel = createPanel();
  const button = panel.querySelector("#gelone-maintenance-clean");
  const unitSelect = panel.querySelector("#gelone-maintenance-unit");

  loadUnitsForPanel();

  if (button.dataset.geloneBound === "true") return;
  button.dataset.geloneBound = "true";

  button.addEventListener("click", async () => {
    const selectedLabel = unitSelect.options[unitSelect.selectedIndex]?.textContent || unitSelect.value || "lunarossa1";
    const confirmed = window.confirm(
      `Vuoi controllare e cancellare le notti fantasma per:\n\n${selectedLabel}\n\nLe prenotazioni e i blocchi attivi non vengono toccati.`
    );
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Pulizia in corso...";
    showResult("Controllo notti fantasma in corso...");

    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/cleanup-ghost-nights", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ unitId: unitSelect.value || "lunarossa1" }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "Pulizia non riuscita.");
      }

      showResult(
        `Pulizia completata\n\nUnità: ${data.unitName || data.unitId}\nID interno: ${data.unitId || unitSelect.value}\nControllate: ${data.scannedCount || 0}\nEliminate: ${data.deletedCount || 0}\nProtette: ${data.keptCount || 0}`
      );
    } catch (error) {
      showResult(`Errore: ${error.message || "pulizia non riuscita"}`);
    } finally {
      button.disabled = false;
      button.textContent = "Pulisci ora";
    }
  });
}

if (location.pathname.startsWith("/admin")) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  firestoreDb = getFirestore(app);
  onAuthStateChanged(auth, setupMaintenance);
}
