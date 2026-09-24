/**
 * Piezas visuales mínimas compartidas.
 *
 * Sin librería de componentes: el MVP necesita que se entienda el
 * estado de una Orden, no un design system.
 */

import type { CSSProperties, ReactNode } from "react";

export const colores = {
  texto: "#1a1a1a",
  suave: "#666",
  borde: "#ddd",
  fondo: "#fafafa",
  acento: "#1f6feb",
  ok: "#1a7f37",
  alerta: "#9a6700",
  error: "#b42318",
} as const;

export function Panel({
  titulo,
  children,
  style,
}: {
  titulo?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        border: `1px solid ${colores.borde}`,
        borderRadius: 8,
        padding: "1rem",
        background: "#fff",
        ...style,
      }}
    >
      {titulo && (
        <h3
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.85rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: colores.suave,
          }}
        >
          {titulo}
        </h3>
      )}
      {children}
    </section>
  );
}

export function Etiqueta({
  children,
  color = colores.suave,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.5rem",
        borderRadius: 999,
        border: `1px solid ${color}`,
        color,
        fontSize: "0.75rem",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

export function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: "0.6rem" }}>
      <span
        style={{
          display: "block",
          fontSize: "0.75rem",
          color: colores.suave,
          marginBottom: "0.2rem",
        }}
      >
        {etiqueta}
      </span>
      {children}
    </label>
  );
}

export const estiloInput: CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.6rem",
  border: `1px solid ${colores.borde}`,
  borderRadius: 6,
  fontSize: "0.9rem",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export function Boton({
  children,
  onClick,
  disabled,
  variante = "primario",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variante?: "primario" | "secundario";
  type?: "button" | "submit";
}) {
  const primario = variante === "primario";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "0.5rem 0.9rem",
        borderRadius: 6,
        border: `1px solid ${primario ? colores.acento : colores.borde}`,
        background: primario ? colores.acento : "#fff",
        color: primario ? "#fff" : colores.texto,
        fontSize: "0.9rem",
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function MensajeError({ mensaje }: { mensaje: string }) {
  return (
    <p
      role="alert"
      style={{
        margin: "0.75rem 0 0",
        padding: "0.6rem 0.8rem",
        borderRadius: 6,
        border: `1px solid ${colores.error}`,
        background: "#fff5f5",
        color: colores.error,
        fontSize: "0.85rem",
      }}
    >
      {mensaje}
    </p>
  );
}

/** Los importes llegan como string (Decimal): solo se formatean. */
export function importe(valor: string): string {
  const numero = Number(valor);
  if (Number.isNaN(numero)) return valor;
  return numero.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
