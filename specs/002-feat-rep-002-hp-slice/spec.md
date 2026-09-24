# Feature Specification: Diagnostico y gestion de Detalles de Reparacion — Implemented slice: HP-REP-001

**Feature Branch**: `mvp-traceability`

**Created**: 2026-09-24

**Status**: Reconstructed from implemented baseline (brownfield)

**Business Feature**: `FEAT-REP-002` — Diagnostico y gestion de Detalles de Reparacion

**Source Process**: `PROC-REP` V1.3

**Implemented Scenario**: `HP-REP-001`

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |

> **ALCANCE.** `HP-REP-001` tiene `details_known_at_intake = true`: la
> reparacion se conoce desde el ingreso. Por eso el slice implementado
> cubre **solo la rama `Si` de `PROC-REP-045`**. Todo el circuito de
> revision tecnica (Orden `EN_REVISION`, diagnostico, definicion
> posterior, `SIN_REPARACION`, y el circuito de Detalle pendiente de
> revision) pertenece a `FEAT-REP-002` pero **no esta implementado**.

## Alcance del slice

### Nodos dentro del slice

| Nodo | Nombre | Actor | En HP-REP-001 |
|---|---|---|---|
| `PROC-REP-045` | Se conocen los Detalles de reparacion requeridos | decision | rama `Si` |
| `PROC-REP-070` | Definir Detalles de reparacion requeridos | `ACT-RECEP` | si |

### Nodos de la Feature FUERA del slice (no implementados)

| Nodo | Nombre | Motivo |
|---|---|---|
| `PROC-REP-045` rama `No` | Detalles desconocidos al ingreso | `details_known_at_intake = true` |
| `PROC-REP-055` | Marcar Orden en revision | estado `EN_REVISION` no alcanzado |
| `PROC-REP-065` | Realizar revision tecnica | no recorrido |
| `PROC-REP-068` | Se pudo definir la reparacion requerida | no recorrido |
| `PROC-REP-069` | Registrar finalizacion sin reparacion | `SIN_REPARACION` fuera del MVP |
| `PROC-REP-075` | Definir Detalles luego de revision | no recorrido |
| `PROC-REP-125` | Detalle(s) pendientes de revision tecnica | agregado `REQUIERE_REVISION` no alcanzado |
| `PROC-REP-126` | Realizar revision tecnica de Detalle pendiente | no recorrido |
| `PROC-REP-127` | Definir/actualizar reparacion del Detalle | no recorrido |

### Business Rules aplicables al slice

- `BR-REP-001` — Definicion del requerimiento: toda Orden debe tener al
  menos un Detalle con Tipo de Reparacion asignado antes de continuar.
- `BR-REP-015` — Precio snapshot: el Detalle registra al confirmarse el
  precio vigente de su Tipo de Reparacion como snapshot inmutable.
- `BR-REP-012` — Estado agregado derivado: aplicable a la Feature, pero
  en este slice solo se ejercita indirectamente (ver
  `specs/005-feat-rep-005-hp-slice/`).
- `BR-REP-010` — Finalizacion sin reparacion trazable: **fuera del
  slice** (`SIN_REPARACION` no implementado).

## User Scenarios & Testing *(mandatory)*

### User Story `US-REP-003` — Registrar que reparacion necesita el equipo (Priority: P1)

Como **Recepcionista**, quiero registrar en la Orden cada Detalle de
Reparacion que el equipo necesita, indicando su Tipo de Reparacion, para
que quede definido el trabajo a realizar y su precio quede fijado en ese
momento.

**Why this priority**: sin al menos un Detalle definido la Orden no puede
habilitarse ni entrar a la cola de trabajo (`BR-REP-001`).

**Independent Test**: sobre una Orden recien creada, definir un Detalle
con un Tipo de Reparacion del catalogo y verificar que la Orden pasa a
tener un Detalle con precio, puntaje y garantia tomados del Tipo.

**Acceptance Scenarios**:

1. **Given** una Orden en `REQUERIMIENTO` sin Detalles y un Tipo de
   Reparacion vigente en el catalogo, **When** Recepcion define un
   Detalle con ese Tipo, **Then** la Orden pasa a tener un Detalle
   asociado a ese Tipo de Reparacion.
2. **Given** el Detalle recien definido, **When** se consulta su precio,
   **Then** es exactamente el precio vigente del Tipo de Reparacion al
   momento de definirlo, guardado como valor propio del Detalle.
3. **Given** un Detalle ya definido, **When** el precio del Tipo de
   Reparacion cambia en el catalogo, **Then** el precio del Detalle NO
   cambia.
4. **Given** una Orden con Detalles definidos, **When** se consulta el
   total de la Orden, **Then** es la suma de los precios de sus Detalles.
5. **Given** un usuario cuyo rol no es Recepcion, **When** intenta
   definir un Detalle, **Then** el sistema rechaza la operacion y la
   Orden no se modifica.
6. **Given** la primera definicion de Detalle sobre la Orden, **When** se
   registra, **Then** el historial incorpora `PROC-REP-045` (rama `Si`)
   una sola vez, seguido de `PROC-REP-070`.

---

### Edge Cases

- **Orden cuya reparacion no se conoce al ingreso**: fuera del slice. El
  circuito `PROC-REP-045` rama `No` → `055` → `065` → `068` → `075` no
  esta implementado.
- **Orden que concluye `SIN_REPARACION`** (`PROC-REP-069`,
  `BR-REP-010`): fuera del slice. `EstadoWorkflow` no contiene los hitos
  necesarios.
- **Detalle con condicion `REQUIERE_DEFINICION`** (`PROC-REP-125/126/127`):
  fuera del slice. `EstadoReparacionDetail` no modela condiciones de
  bloqueo.
- **Orden con mas de un Detalle**: el modelo lo soporta
  (`reparaciones_detail` es una lista y el total es la suma), pero
  `HP-REP-001` tiene `detail_count = 1`, asi que el recorrido con varios
  Detalles **no** esta ejercitado end-to-end.
- **Precio cero**: admitido por el modelo (`Field(ge=0)`); el precio
  negativo se rechaza.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-REP-006**: El sistema debe permitir registrar en una Orden uno o
  mas Detalles de Reparacion, cada uno asociado a un Tipo de Reparacion
  del catalogo. *(`PROC-REP-045` rama `Si`, `PROC-REP-070`, `BR-REP-001`)*
- **FR-REP-007**: Al confirmarse un Detalle, el sistema debe fijar como
  valor propio e inmutable del Detalle las condiciones comerciales y de
  servicio vigentes de su Tipo de Reparacion (precio, ponderacion de
  puntaje y plazo de garantia). Cambios posteriores del catalogo no deben
  alterar Detalles ya confirmados. *(`BR-REP-015`)*
- **FR-REP-008**: Solo un usuario con rol Recepcion puede definir
  Detalles de Reparacion. *(actor `ACT-RECEP` de `PROC-REP-070`)*
- **FR-REP-009**: El importe total de la Orden debe derivarse siempre de
  los precios de sus Detalles, sin constituir un dato independiente que
  deba sincronizarse. *(`BR-REP-015`)*
- **FR-REP-010**: Un Detalle de Reparacion no puede registrar un precio
  negativo.

### Key Entities *(include if feature involves data)*

- **Detalle de Reparacion**: unidad tecnica de trabajo dentro de la
  Orden. Referencia un Tipo de Reparacion por ID y conserva como datos
  propios el precio, el puntaje y los dias de garantia vigentes al
  momento de su definicion. Tiene estado tecnico propio.
- **Tipo de Reparacion**: entrada de catalogo con precio, ponderacion de
  puntaje y garantia configurables. Nunca se embebe en la Orden.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-005**: Recepcion puede dejar definido el trabajo a realizar y su
  precio en el mismo momento del ingreso, sin esperar diagnostico.
- **SC-006**: El 100% de los Detalles conservan el precio vigente al
  momento de definirlos, aunque el catalogo cambie despues.
- **SC-007**: El importe de la Orden nunca queda desincronizado de sus
  Detalles, porque no se almacena por separado.

## Assumptions

- El slice asume `details_known_at_intake = true`. El circuito de
  revision tecnica no se representa como implementado.
- El Tipo de Reparacion existe previamente en el catalogo; la gestion del
  catalogo (alta, edicion, historico de precios) esta fuera de esta
  baseline: el catalogo se lee, y la unica escritura implementada es la
  de stock fisico de insumos.
- El modelo soporta N Detalles por Orden, pero solo el caso de un Detalle
  esta verificado end-to-end.
