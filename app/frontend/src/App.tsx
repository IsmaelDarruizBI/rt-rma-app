import { useEffect, useState } from "react";

import { fetchHealth } from "./api/health";

type BackendStatus = "checking" | "connected" | "disconnected";

const BACKEND_LABEL: Record<BackendStatus, string> = {
  checking: "Backend: verificando...",
  connected: "Backend: conectado",
  disconnected: "Backend: sin conexion",
};

export default function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    let active = true;

    fetchHealth().then((isHealthy) => {
      if (active) {
        setBackendStatus(isHealthy ? "connected" : "disconnected");
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
      }}
    >
      <h1 style={{ margin: 0 }}>Rosario Tecno</h1>
      <h2 style={{ margin: 0, fontWeight: 400 }}>RMA MVP</h2>
      <p style={{ marginTop: "1.5rem" }}>{BACKEND_LABEL[backendStatus]}</p>
    </main>
  );
}
