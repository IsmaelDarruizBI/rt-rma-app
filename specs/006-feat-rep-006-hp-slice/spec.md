# Feature Specification: Control tecnico, retrabajo y evaluacion — Implemented slice: HP-REP-001

**Feature Branch**: `mvp-traceability`

**Created**: 2026-09-24

**Status**: Reconstructed from implemented baseline (brownfield)

**Business Feature**: `FEAT-REP-006` — Control tecnico, retrabajo y evaluacion

**Source Process**: `PROC-REP` V1.3

**Implemented Scenario**: `HP-REP-001`

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |

> **ALCANCE.** `HP-REP-001` tiene `technical_control = APROBADO`. El
> slice cubre **solo la rama `Si` de `PROC-REP-230`**. El retrabajo
> (`PROC-REP-235`) y la reevaluacion posterior a un rechazo pertenecen a
> `FEAT-REP-006` y **no estan implementados**.

## Alcance del slice

### Nodos dentro del slice

| Nodo | Nombre | Actor | En HP-REP-001 |
|---|---|---|---|
| `PROC-REP-220` | Realizar control tecnico | `ACT-RECEP` | si |
| `PROC-REP-230` | Todos los Detalles fueron aprobados | decision | rama `Si` |
| `PROC-REP-245` | Calcular puntaje de la reparacion | `ACT-SYSTEM` | si |
| `PROC-REP-240` | Marcar reparacion lista | `ACT-SYSTEM` | si |

### Nodos de la Feature FUERA del slice (no implementados)

| Nodo | Nombre | Motivo |
|---|---|---|
| `PROC-REP-230` rama `No` | Al menos un Detalle rechazado | `technical_control = APROBADO` |
| `PROC-REP-235` | Identificar Detalle(s) a retrabajar | no recorrido |
| `PROC-REP-211` (via `235`) | Reevaluacion tras rechazo | no recorrido por esta via |

### Business Rules aplicables al slice

- `BR-REP-008` — Control tecnico por Recepcion: la Orden pasa a control
  cuando todos sus Detalles son terminales y existe al menos uno
  `COMPLETO`; Recepcion evalua la Orden completa pero aprueba **Detalle
  por Detalle**. La parte de rechazo/retrabajo esta fuera del slice.
- `BR-REP-009` — Puntaje por Detalle: se calcula por Detalle aprobado, en
  el momento de su propia aprobacion, segun la ponderacion de su Tipo de
  Reparacion. El puntaje de la Orden es la suma de los de sus Detalles.
- `BR-REP-012` — Estado agregado derivado (precondicion de entrada al
  control; ver `specs/005-feat-rep-005-hp-slice/`).

## User Scenarios & Testing *(mandatory)*

### User Story `US-REP-010` — Controlar y aprobar el trabajo terminado (Priority: P1)

Como **Recepcionista**, quiero controlar la Orden terminada y dejar
aprobado Detalle por Detalle el trabajo realizado, para asegurarme de que
la reparacion esta bien antes de avisarle al cliente.

**Why this priority**: es el control de calidad que habilita todo el
cierre. Sin el no hay `REPARACION_LISTA` ni entrega.

**Independent Test**: sobre una Orden cuyos Detalles quedaron
`COMPLETO`, aprobar el control y verificar que cada Detalle queda
aprobado con usuario, fecha y observacion.

**Acceptance Scenarios**:

1. **Given** una Orden con todos sus Detalles terminales y al menos uno
   `COMPLETO`, **When** Recepcion aprueba el control tecnico, **Then**
   cada Detalle queda con resultado de control aprobado, registrando
   usuario, fecha y observacion.
2. **Given** una Orden con una Ejecucion todavia activa, **When** se
   intenta realizar el control tecnico, **Then** el sistema lo rechaza.
3. **Given** un usuario cuyo rol no es Recepcion —en particular, el
   Tecnico que ejecuto el trabajo—, **When** intenta aprobar el control,
   **Then** el sistema lo rechaza y nada queda aprobado.
4. **Given** el control aprobado, **When** se marca la reparacion como
   lista, **Then** la Orden pasa a `REPARACION_LISTA`.
5. **Given** una Orden sin control tecnico aprobado, **When** se intenta
   marcarla como reparacion lista, **Then** el sistema lo rechaza.
6. **Given** el control y el cierre, **When** se completan, **Then** el
   historial registra `PROC-REP-220`, `PROC-REP-230`, `PROC-REP-245` y
   `PROC-REP-240`.

---

### User Story `US-REP-011` — Acreditar el puntaje del trabajo aprobado (Priority: P2)

Como **Coordinador RMA**, quiero que el puntaje quede acreditado por cada
Detalle aprobado, para poder medir despues la produccion tecnica del
taller.

**Why this priority**: es informacion de gestion, no un gate del flujo:
la Orden avanza igual. Pero debe quedar registrada en el momento de la
aprobacion, no despues.

**Independent Test**: tras aprobar el control, verificar que el puntaje
de la Orden es la suma de las ponderaciones de sus Detalles aprobados.

**Acceptance Scenarios**:

1. **Given** una Orden con un Detalle aprobado, **When** se calcula el
   puntaje, **Then** el puntaje de la Orden es la ponderacion snapshot de
   ese Detalle.
2. **Given** una Orden con Detalles no aprobados, **When** se consulta el
   puntaje, **Then** esos Detalles no suman.
3. **Given** el puntaje calculado, **When** se recarga la Orden desde la
   persistencia, **Then** el puntaje se recalcula igual: no se almacena
   como dato independiente.

---

### Edge Cases

- **Control rechazado y retrabajo** (`PROC-REP-230` rama `No`,
  `PROC-REP-235`): fuera del slice. `EstadoControl` no tiene valor de
  rechazo.
- **Varios ciclos de rechazo/retrabajo**: fuera del slice.
- **Orden con algunos Detalles `CANCELADO` y al menos uno `COMPLETO`**
  (`BR-REP-014-B`): el Business Process la admite en control; el MVP no
  implementa cancelacion.
- **Distribucion del puntaje entre varios tecnicos**: pendiente
  declarado en `docs/discovery/README.md`. El MVP acredita el puntaje a
  la Orden, sin atribuirlo a un tecnico.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-REP-040**: El control tecnico solo puede realizarse cuando todos
  los Detalles de la Orden son terminales y existe al menos uno
  completado, y no puede realizarse mientras exista una Ejecucion activa.
  *(`PROC-REP-220`, `BR-REP-008`)*
- **FR-REP-041**: El control tecnico debe registrarse **por Detalle**,
  dejando constancia del usuario que lo realizo, la fecha y la
  observacion. *(`BR-REP-008`)*
- **FR-REP-042**: El control tecnico corresponde a Recepcion; el tecnico
  que ejecuto el trabajo no puede aprobar su propio control.
  *(actor `ACT-RECEP` de `PROC-REP-220`)*
- **FR-REP-043**: El puntaje debe acreditarse por Detalle aprobado, segun
  la ponderacion registrada en ese Detalle, y el puntaje de la Orden debe
  ser la suma de los puntajes de sus Detalles aprobados. Los Detalles no
  aprobados no suman. *(`PROC-REP-245`, `BR-REP-009`)*
- **FR-REP-044**: La Orden debe poder marcarse como reparacion lista
  unicamente cuando el control tecnico fue aprobado.
  *(`PROC-REP-240`)*

### Key Entities *(include if feature involves data)*

- **Resultado de control del Detalle**: estado de control, usuario,
  fecha y observaciones, guardados en el propio Detalle.
- **Puntaje de la Orden**: magnitud derivada de las ponderaciones de los
  Detalles aprobados; nunca un dato almacenado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-019**: Ninguna Orden llega a `REPARACION_LISTA` sin control
  tecnico aprobado.
- **SC-020**: Ningun tecnico puede aprobar el control de su propio
  trabajo.
- **SC-021**: El puntaje de la Orden nunca queda desincronizado de sus
  Detalles aprobados, porque se deriva de ellos.

## Assumptions

- `HP-REP-001` tiene un unico Detalle aprobado. El control granular por
  Detalle esta implementado (el resultado se guarda en cada Detalle) pero
  el caso "algunos aprobados, otros rechazados" **no** esta ejercitado ni
  modelado (`EstadoControl` no tiene valor de rechazo).
- La atribucion del puntaje a un tecnico concreto queda pendiente por
  definicion de negocio; el MVP lo acredita a nivel Orden.
