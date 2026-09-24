# Feature Specification: Ingreso y creacion de Orden de Reparacion — Implemented slice: HP-REP-001

**Feature Branch**: `mvp-traceability`

**Created**: 2026-09-24

**Status**: Reconstructed from implemented baseline (brownfield)

**Business Feature**: `FEAT-REP-001` — Ingreso y creacion de Orden de Reparacion
(`business/features/repair-management-features-v1.3.yaml`)

**Source Process**: `PROC-REP` V1.3 (`business/processes/repair-management-v1.3.yaml`)

**Implemented Scenario**: `HP-REP-001` — Reparacion estandar de cliente externo
(`business/scenarios/repair-management-scenarios-v1.3.yaml`)

| Campo | Valor |
|---|---|
| `feature_status` | `draft` (sin cambios: la Feature V1.3 no se aprueba aqui) |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |

> **ALCANCE — LEER PRIMERO.** Esta especificacion NO representa la
> cobertura completa de `FEAT-REP-001`. Representa **unicamente el slice
> de la Feature que `HP-REP-001` recorre**: una Orden de origen
> `CLIENTE_EXTERNO`. Los demas origenes de la Feature
> (`RT_INTERNO`, `RT_GARANTIA_VENTA`, `RMA_GARANTIA_REPARACION`) estan
> definidos en el Business Process y **no estan implementados**.

## Alcance del slice

### Nodos de `PROC-REP` V1.3 dentro del slice

| Nodo | Nombre | Actor | En HP-REP-001 |
|---|---|---|---|
| `EVT-REP-001` | Surge necesidad de reparacion | — | evento inicial |
| `PROC-REP-010` | Cual es el origen de la Orden de Reparacion | decision | rama `CLIENTE_EXTERNO` |
| `PROC-REP-030` | Registrar cliente y equipo | `ACT-RECEP` | si |
| `PROC-REP-040` | Crear Orden de Reparacion | `ACT-RECEP` | si |
| `PROC-REP-050` | Requiere comprobante de recepcion | decision | rama `Si` |
| `PROC-REP-060` | Generar comprobante de recepcion | `ACT-SYSTEM` | si |

### Nodos de la Feature FUERA del slice (no implementados)

| Nodo | Nombre | Motivo |
|---|---|---|
| `PROC-REP-020` | Recibir referencia y contexto del equipo RT | origen `RT_INTERNO`, no recorrido por HP-REP-001 |
| `PROC-REP-025` | Recibir referencia de garantia de venta RT | origen `RT_GARANTIA_VENTA`, no recorrido |
| `PROC-REP-035` | Identificar reparacion original en garantia | origen `RMA_GARANTIA_REPARACION`, no recorrido |
| `PROC-REP-050` rama `No` | Orden que no requiere comprobante | solo aplica a `RT_INTERNO` |

### Business Rules aplicables al slice

- `BR-REP-013` — Orden sin Detalles (caso inicial): la Orden nace con
  `cantidad_detalles = 0` y el estado `REQUERIMIENTO` es un hito de
  workflow fijado por `PROC-REP-040`, nunca decidido por el resolver
  tecnico.

## User Scenarios & Testing *(mandatory)*

### User Story `US-REP-001` — Registrar el ingreso de un equipo de cliente externo (Priority: P1)

Como **Recepcionista**, quiero registrar al cliente y al equipo que trae
a reparar y crear la Orden de Reparacion correspondiente, para que el
ingreso quede formalizado en el sistema y el equipo pueda entrar al
circuito operativo.

**Why this priority**: sin Orden creada no existe nada que trabajar. Es
el punto de entrada de todo el proceso.

**Independent Test**: se verifica creando una Orden de origen
`CLIENTE_EXTERNO` con un cliente y un equipo, y comprobando que la Orden
queda en `REQUERIMIENTO`, sin Detalles, y con el recorrido
`PROC-REP-010 -> PROC-REP-030 -> PROC-REP-040` registrado.

**Acceptance Scenarios**:

1. **Given** un cliente externo con su equipo y un usuario de Recepcion
   activo, **When** Recepcion registra el ingreso, **Then** el sistema
   crea una Orden de origen `CLIENTE_EXTERNO` en estado `REQUERIMIENTO`,
   con cliente y equipo asociados y sin ningun Detalle de Reparacion.
2. **Given** el mismo ingreso, **When** la Orden queda creada, **Then**
   el historial de la Orden contiene, en orden, los pasos
   `PROC-REP-010`, `PROC-REP-030` y `PROC-REP-040`, cada uno con su
   fecha y con el usuario de Recepcion como responsable.
3. **Given** un usuario cuyo rol no es Recepcion (Tecnico, Coordinador o
   Administrador), **When** intenta crear la Orden, **Then** el sistema
   rechaza la operacion y no se crea ninguna Orden.
4. **Given** un usuario de Recepcion dado de baja (inactivo), **When**
   intenta crear la Orden, **Then** el sistema rechaza la operacion.

---

### User Story `US-REP-002` — Entregar al cliente el comprobante de recepcion (Priority: P2)

Como **Recepcionista**, quiero emitir el comprobante de recepcion de la
Orden, para poder acreditarle al cliente que su equipo quedo en el taller
y con que trabajo previsto.

**Why this priority**: es obligacion frente al cliente externo, pero la
Orden ya existe y es trabajable sin el comprobante emitido.

**Independent Test**: sobre una Orden `CLIENTE_EXTERNO` ya creada, emitir
el comprobante y verificar que queda marcado como generado con su fecha,
y que el recorrido registra `PROC-REP-050` y `PROC-REP-060`.

**Acceptance Scenarios**:

1. **Given** una Orden de origen `CLIENTE_EXTERNO`, **When** se emite el
   comprobante de recepcion, **Then** el comprobante queda registrado
   como generado, con su fecha de generacion.
2. **Given** la misma Orden, **When** el comprobante queda emitido,
   **Then** el historial registra `PROC-REP-050` (rama `Si`) seguido de
   `PROC-REP-060`.
3. **Given** que `PROC-REP-060` es un nodo `ACT-SYSTEM`, **When** se
   emite el comprobante, **Then** el paso se registra sin usuario
   humano responsable.

---

### Edge Cases

- **Orden de origen distinto de `CLIENTE_EXTERNO`**: fuera del slice. El
  sistema implementado solo admite `CLIENTE_EXTERNO`
  (`OrigenOrden` tiene un unico valor). No se simula soporte para los
  otros tres origenes.
- **Orden que no requiere comprobante (`RT_INTERNO`)**: fuera del slice.
- **Orden creada sin Detalles**: es el caso normal y esperado
  (`BR-REP-013`). La Orden nace con `cantidad_detalles = 0`.
- **Orden `EN_REVISION` (`PROC-REP-045` rama `No` -> `PROC-REP-055`)**:
  fuera del slice; ver `specs/002-feat-rep-002-hp-slice/`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-REP-001**: El sistema debe permitir crear una Orden de Reparacion
  con su origen identificado, el cliente y el equipo asociados, en estado
  de workflow `REQUERIMIENTO` y con cero Detalles de Reparacion.
  *(`PROC-REP-010`, `PROC-REP-030`, `PROC-REP-040`, `BR-REP-013`)*
- **FR-REP-002**: El sistema debe impedir que un usuario que no cumple el
  rol requerido por el nodo, o que esta inactivo, ejecute una accion que
  tiene actor humano asignado; el rechazo no debe producir ningun cambio
  sobre la Orden. Para la creacion de la Orden el rol requerido es
  Recepcion. *(`PROC-REP-030`, `PROC-REP-040`, actor `ACT-RECEP`)*
- **FR-REP-003**: El sistema debe emitir un comprobante de recepcion para
  las Ordenes cuyo origen lo requiere, y dejar registrado que fue
  generado y cuando. *(`PROC-REP-050`, `PROC-REP-060`)*
- **FR-REP-004**: El sistema debe conservar el recorrido de la Orden por
  los nodos del proceso, en orden cronologico, indicando en cada paso la
  fecha y —solo cuando el nodo tiene actor humano— el usuario
  responsable. El recorrido no se sobrescribe. *(transversal a todas las
  Features; nace aqui porque es donde la Orden se crea)*
- **FR-REP-005**: El sistema debe mantener identificable en todo momento
  el punto del proceso en el que se encuentra la Orden.
  *(transversal)*

### Key Entities *(include if feature involves data)*

- **Orden de Reparacion**: unidad de gestion del proceso. Tiene origen,
  estado de workflow, cliente, equipo, prioridad, sus entidades
  transaccionales (Detalles, tomas, ejecuciones, movimientos, pagos,
  documentos) y el historial de recorrido.
- **Cliente**: persona o empresa que trae el equipo. Entidad conceptual
  unica (la clasificacion Minorista/Mayorista no crea entidades
  separadas).
- **Equipo**: el aparato fisico que se recibe para reparar.
- **Documento de recepcion**: constancia de que el cliente dejo el
  equipo; registra si fue generado y su fecha.
- **Paso de historial**: nodo del proceso recorrido, con fecha y usuario
  responsable cuando corresponde.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Recepcion puede dejar formalmente ingresado un equipo de
  cliente externo en una sola operacion, sin necesidad de conocer todavia
  que reparacion requiere.
- **SC-002**: El 100% de las Ordenes creadas conservan su recorrido
  funcional completo desde `PROC-REP-010`, verificable a posteriori.
- **SC-003**: Ninguna Orden puede ser creada por un actor no autorizado o
  inactivo.
- **SC-004**: Toda Orden de cliente externo puede acreditar mediante
  comprobante que el equipo fue recibido.

## Assumptions

- El origen implementado es exclusivamente `CLIENTE_EXTERNO`. Los otros
  tres origenes del Business Process quedan fuera de esta baseline y NO
  se representan como implementados.
- El comprobante de recepcion se modela como un hecho registrado
  (generado si/no + fecha), no como un documento renderizado. La
  generacion del artefacto imprimible queda fuera de la baseline.
- La identidad del usuario llega ya resuelta al sistema: la autenticacion
  y la gestion de sesion no forman parte de esta baseline.
- Los catalogos (usuarios, tipos de reparacion, insumos, estaciones) se
  consideran preexistentes y se referencian por ID.
