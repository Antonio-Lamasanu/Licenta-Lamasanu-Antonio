import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import AuthGate from "./components/AuthGate";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      {(user, onLogout, justRegistered) => (
        <App user={user} onLogout={onLogout} justRegistered={justRegistered} />
      )}
    </AuthGate>
  </StrictMode>
);
