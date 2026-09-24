# Frontend MVP - Rosario Tecno RMA App

Frontend React + TypeScript + Vite del MVP.

Estado actual: **scaffold**. La pantalla inicial muestra unicamente
"Rosario Tecno / RMA MVP" y el estado de conexion con el backend. No hay
todavia pantallas de negocio ni logica del Happy Path `HP-REP-001`.

Deliberadamente NO se usan en esta iteracion: Next.js, Redux, Zustand,
React Query, Tailwind, Material UI ni React Flow.

## Estructura

```text
src/
  api/                        Llamadas HTTP al backend (hoy solo health)
  components/                 Componentes reutilizables de UI
  features/
    ordenes-reparacion/       Feature de Ordenes de Reparacion (vacio)
  pages/                      Pantallas (vacio: la pantalla inicial vive en App.tsx)
  types/                      Tipos TypeScript compartidos
  App.tsx                     Composicion de la pantalla inicial
  main.tsx                    Punto de entrada de React
public/                       Assets estaticos
```

## Instalacion

Desde `app/frontend/`:

```bash
npm install
```

## Ejecucion

```bash
npm run dev
```

Disponible en http://localhost:5173

Otros comandos:

```bash
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + build de produccion
npm run preview     # sirve el build
```

## Configuracion

| Variable | Default | Descripcion |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | URL base del backend FastAPI |

Copiar `.env.example` a `.env` para sobreescribirla en local.
