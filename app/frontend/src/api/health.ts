/**
 * Unica llamada al backend en esta iteracion: comprobar que responde.
 * No es todavia una capa de API del dominio.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function fetchHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      return false;
    }
    const payload: { status?: string } = await response.json();
    return payload.status === "ok";
  } catch {
    return false;
  }
}
