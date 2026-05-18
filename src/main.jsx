import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const App = lazy(() => import("./App.jsx"));
const Admin = lazy(() => import("./Admin.jsx"));

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#faf6ee] px-6 py-10 text-[#0a1d35]">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
        <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-8 text-center shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
            Gelone Lungomare
          </p>
          <h1 className="mt-3 font-serif text-3xl">Caricamento...</h1>
          <p className="mt-3 text-sm text-[#555]">
            Stiamo preparando la pagina.
          </p>
        </div>
      </div>
    </div>
  );
}

function Router() {
  const path = window.location.pathname;
  const isAdminPath = path === "/admin" || path.startsWith("/admin/");

  return (
    <Suspense fallback={<LoadingScreen />}>
      {isAdminPath ? <Admin /> : <App />}
    </Suspense>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);