import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import Admin from "./Admin.jsx";

function Router() {
  const path = window.location.pathname;

  if (path === "/admin") {
    return <Admin />;
  }

  return <App />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
