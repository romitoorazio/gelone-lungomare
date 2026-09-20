import fs from "node:fs";

const path = new URL("../src/Admin.jsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");
let changes = 0;

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`[pms-login-recovery] blocco non trovato: ${label}`);
  }
  source = source.replace(before, after);
  changes += 1;
  console.log(`[pms-login-recovery] ${label}`);
}

replaceOnce(
`  getIdToken,\n  onAuthStateChanged,\n  signInWithEmailAndPassword,\n  signOut,`,
`  getIdToken,\n  onAuthStateChanged,\n  sendPasswordResetEmail,\n  signInWithEmailAndPassword,\n  signOut,`,
"import reset password Firebase"
);

replaceOnce(
`  const [password, setPassword] = useState("");\n  const [error, setError] = useState("");\n  const [loading, setLoading] = useState(false);`,
`  const [password, setPassword] = useState("");\n  const [error, setError] = useState("");\n  const [resetMessage, setResetMessage] = useState("");\n  const [loading, setLoading] = useState(false);\n  const [resetLoading, setResetLoading] = useState(false);`,
"stato recupero password"
);

replaceOnce(
`    try {\n      setLoading(true);\n      await signInWithEmailAndPassword(auth, email, password);\n    } catch (err) {\n      setError("Accesso non riuscito. Controlla email e password.");\n    } finally {\n      setLoading(false);\n    }`,
`    try {\n      setLoading(true);\n      setResetMessage("");\n      await signInWithEmailAndPassword(auth, email.trim(), password);\n    } catch (err) {\n      const code = String(err?.code || "");\n      console.error("Firebase admin login error:", code || err);\n\n      if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) {\n        setError("Email o password non corretti. Se la password salvata su iPhone è vecchia, riscrivila oppure usa ‘Password dimenticata?’.");\n      } else if (code === "auth/too-many-requests") {\n        setError("Troppi tentativi di accesso. Attendi qualche minuto oppure reimposta la password.");\n      } else if (code === "auth/network-request-failed") {\n        setError("Problema di rete durante l’accesso. Controlla la connessione e riprova.");\n      } else if (code === "auth/unauthorized-domain") {\n        setError("Il dominio gelone.it non è autorizzato in Firebase Authentication. Codice: auth/unauthorized-domain.");\n      } else {\n        setError("Accesso non riuscito. Codice tecnico: " + (code || "errore sconosciuto") + ".");\n      }\n    } finally {\n      setLoading(false);\n    }\n\n  }\n\n  async function handlePasswordReset() {\n    const cleanEmail = email.trim();\n    setError("");\n    setResetMessage("");\n\n    if (!cleanEmail) {\n      setError("Inserisci prima l’email admin.");\n      return;\n    }\n\n    try {\n      setResetLoading(true);\n      await sendPasswordResetEmail(auth, cleanEmail);\n      setResetMessage("Email di reimpostazione inviata a " + cleanEmail + ". Controlla anche Spam/Promozioni.");\n    } catch (err) {\n      const code = String(err?.code || "");\n      console.error("Firebase password reset error:", code || err);\n      if (code === "auth/too-many-requests") {\n        setError("Troppe richieste di recupero. Attendi qualche minuto e riprova.");\n      } else if (code === "auth/network-request-failed") {\n        setError("Problema di rete durante il recupero password.");\n      } else {\n        setError("Non riesco a inviare il recupero password. Codice tecnico: " + (code || "errore sconosciuto") + ".");\n      }\n    } finally {\n      setResetLoading(false);\n    }`,
"login diagnostico e recupero password"
);

replaceOnce(
`          </label>\n\n          {error && (\n            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">\n              {error}\n            </div>\n          )}`,
`          </label>\n\n          <button\n            type="button"\n            onClick={handlePasswordReset}\n            disabled={resetLoading || loading}\n            className="w-full text-right text-sm font-bold text-[#9b6b25] underline-offset-4 hover:underline disabled:opacity-60"\n          >\n            {resetLoading ? "Invio email…" : "Password dimenticata?"}\n          </button>\n\n          {resetMessage && (\n            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900">\n              {resetMessage}\n            </div>\n          )}\n\n          {error && (\n            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">\n              {error}\n            </div>\n          )}`,
"pulsante recupero password"
);

fs.writeFileSync(path, source, "utf8");
console.log(`[pms-login-recovery] completato: ${changes} modifiche.`);
