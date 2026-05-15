import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const ADMIN_EMAILS = ["romitoorazio@gmail.com", "romitofrancesco1@gmail.com"];
const firebaseConfig = {
  apiKey: "AIzaSyCdz5rPl--09OneuaVDUz36qfmcuvMYu0M",
  authDomain: "gelone-lungomare-pms.firebaseapp.com",
  projectId: "gelone-lungomare-pms",
  storageBucket: "gelone-lungomare-pms.firebasestorage.app",
  messagingSenderId: "397268023464",
  appId: "1:397268023464:web:e8bbf7342eac85b6bf2a9d",
  measurementId: "G-CPTBWHN86V",
};

function isAdminEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === value);
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
        <input id="gelone-maintenance-unit" value="lunarossa1" />
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
      max-width: min(360px, calc(100vw - 32px));
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
      border: 1px solid #d7c49f;
      border-radius: 14px;
      background: #faf6ee;
      padding: 10px 12px;
      color: #0a1d35;
      font-weight: 700;
      outline: none;
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

function setupMaintenance(user) {
  if (!location.pathname.startsWith("/admin")) return;
  if (!user || !isAdminEmail(user.email)) return;

  const panel = createPanel();
  const button = panel.querySelector("#gelone-maintenance-clean");
  const unitInput = panel.querySelector("#gelone-maintenance-unit");

  button.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Vuoi controllare e cancellare le notti fantasma per questa unità? Le prenotazioni e i blocchi attivi non vengono toccati."
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
        body: JSON.stringify({ unitId: unitInput.value || "lunarossa1" }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "Pulizia non riuscita.");
      }

      showResult(
        `Pulizia completata\n\nUnità: ${data.unitName || data.unitId}\nControllate: ${data.scannedCount || 0}\nEliminate: ${data.deletedCount || 0}\nProtette: ${data.keptCount || 0}`
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
  onAuthStateChanged(auth, setupMaintenance);
}
