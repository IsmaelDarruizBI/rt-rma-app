# Frontend MVP - Rosario Tecno RMA App

Frontend React + TypeScript + Vite del MVP. Permite recorrer el
escenario `HP-REP-001` desde el navegador, contra la API FastAPI de
`app/backend`.

Deliberadamente NO usa: Next.js, Redux, Zustand, React Query, Tailwind,
Material UI ni React Flow. Para lo que el MVP necesita -una pantalla de
listado y una de Orden- no aportan nada que justifique la dependencia.

## Que hace

**Listado de Ordenes**: filas con ID, cliente, equipo, estado y saldo,
mas el formulario de alta de una Orden nueva (cliente externo).

**Pantalla de Orden**, en jerarquia vertical:

```text
Datos de la OR          ID, cliente, equipo, estado, nodo actual
Detalles de reparacion  nombre del Tipo, garantia, puntaje, insumos previstos
Accion disponible       la que corresponda al estado, con su formulario
Resumen comercial       total, pagado, saldo, estado de pago, puntaje
                        + tabla de Pagos (fecha, tipo, medio, monto, usuario)
Progreso HP-REP-001     los nodos del escenario, marcando los recorridos
Historial               secuencia de eventos de la Orden
```

**Selector de actor DEMO** (Recepcion / Coordinador / Tecnico /
Administrador). No es autenticacion: sirve para demostrar el circuito
con distintos roles. El backend valida el rol igual; ocultar un control
es comodidad, no seguridad.

**Acciones disponibles**: el frontend **no** decide cuales mostrar. Las
recibe en `acciones_disponibles` de cada respuesta, con la lista de
roles autorizados de cada una. No hay reglas de negocio duplicadas aca.

**Historial**: distingue las dos clases de traza con un badge, `PROC`
para los nodos del Business Process y `ACC` para las capacidades
transversales (por ejemplo `ACC-REP-020`, Registrar Pago, que deja traza
sin avanzar el proceso). Es una vista distinta de la tabla de Pagos del
Resumen Comercial: alli esta el estado economico, aca la secuencia de lo
que fue pasando.

## Estructura

```text
src/
  types/api.ts                        tipos espejo de los DTOs del backend
  api/client.ts                       fetch + ApiError
  api/ordenes.ts                      una funcion por intencion de usuario
  components/ui.tsx                   Panel, Boton, Campo, Etiqueta, formato
  features/ordenes-reparacion/
    PanelOrdenes.tsx                  contenedor con estado
    ListadoOrdenes.tsx                listado, alta y selector de actor
    DetalleOrden.tsx                  cabecera, resumen, detalles, progreso, historial
    AccionesOrden.tsx                 acciones y sus formularios
public/                               assets estaticos
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

Disponible en http://localhost:5173. Requiere el backend levantado en el
puerto 8000 (`uvicorn app.main:app --reload --port 8000 --workers 1`
desde `app/backend`); si no responde, la pantalla lo avisa en vez de
fallar en silencio.

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

## Alcance

Solo el camino de `HP-REP-001`. No hay pantallas para los caminos
alternativos del proceso (revision tecnica, overrides, retrabajo,
cancelacion), que tampoco estan implementados en el backend. Si una
accion falla, se muestra el mensaje funcional que devuelve la API.

No hay tests de frontend en esta version: la verificacion es
`npm run typecheck` y `npm run build`.
