# Feature Specification: Finalizacion, entrega e integracion del resultado — Implemented slice: HP-REP-001

**Feature Branch**: `mvp-traceability`

**Created**: 2026-09-24

**Status**: Reconstructed from implemented baseline (brownfield)

**Business Feature**: `FEAT-REP-008` — Finalizacion, entrega e integracion del resultado

**Source Process**: `PROC-REP` V1.3

**Implemented Scenario**: `HP-REP-001`

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |

> **ALCANCE.** `HP-REP-001` es una Orden `CLIENTE_EXTERNO` que se entrega
> al cliente. La integracion con el sistema de Gestion RT
> (`PROC-REP-290`, rama `RT_INTERNO`) pertenece a `FEAT-REP-008` y **no
> esta implementada**.

## Alcance del slice

### Nodos dentro del slice

| Nodo | Nombre | Actor | En HP-REP-001 |
|---|---|---|---|
| `PROC-REP-250` | Requiere entrega a cliente | decision | rama `Si` |
| `PROC-REP-260` | Notificar cliente | `ACT-RECEP` | si |
| `PROC-REP-280` | Generar comprobante final | `ACT-SYSTEM` | si (compartido con `FEAT-REP-007`) |
| `PROC-REP-270` | Entregar equipo | `ACT-ADMIN` | si |
| `EVT-REP-999` | Fin del flujo de Orden de Reparacion | end | si |

### Nodos de la Feature FUERA del slice (no implementados)

| Nodo | Nombre | Motivo |
|---|---|---|
| `PROC-REP-250` rama `No` | Orden que no requiere entrega (`RT_INTERNO`) | origen no implementado |
| `PROC-REP-290` | Informar resultado al sistema RT | origen `RT_INTERNO` no implementado |

### Business Rules aplicables al slice

La Feature no declara Business Rules propias (`business_rules: []`). El
slice depende de reglas de otras Features:

- `BR-REP-017-B` — gate de saldo antes de la entrega (implementado en
  `specs/007-feat-rep-007-hp-slice/`).
- `BR-REP-010` — `SIN_REPARACION`: **fuera del slice**, afecta el
  contenido del comprobante final y la ausencia de garantia.

## User Scenarios & Testing *(mandatory)*

### User Story `US-REP-015` — Avisarle al cliente que su equipo esta listo (Priority: P1)

Como **Recepcionista**, quiero avisarle al cliente que su equipo ya esta
reparado, para que venga a retirarlo.

**Why this priority**: sin aviso el equipo no se retira y la Orden no se
cierra.

**Independent Test**: sobre una Orden `REPARACION_LISTA`, notificar al
cliente y verificar que el paso queda registrado.

**Acceptance Scenarios**:

1. **Given** una Orden `REPARACION_LISTA` de un cliente externo, **When**
   Recepcion notifica al cliente, **Then** la notificacion queda
   registrada en el historial.
2. **Given** la notificacion, **When** se completa, **Then** el historial
   registra `PROC-REP-250` (rama `Si`) seguido de `PROC-REP-260`.
3. **Given** un usuario cuyo rol no es Recepcion, **When** intenta
   notificar al cliente, **Then** el sistema rechaza la operacion.

---

### User Story `US-REP-016` — Entregar el equipo con su documentacion y cerrar la Orden (Priority: P1)

Como **Administrador**, quiero entregar el equipo al cliente junto con su
comprobante final y su garantia de reparacion, y dejar la Orden cerrada,
para que el circuito quede completo y documentado.

**Why this priority**: es el cierre del proceso. Sin el, la Orden queda
abierta indefinidamente.

**Independent Test**: sobre una Orden con saldo cero, generar el
comprobante final y entregar, verificando que la Orden queda `ENTREGADA`
y posicionada en el evento final.

**Acceptance Scenarios**:

1. **Given** una Orden cuya condicion de entrega fue aprobada, **When**
   se genera el comprobante final, **Then** quedan registrados como
   generados tanto el comprobante final como la garantia de reparacion.
2. **Given** el comprobante generado, **When** el Administrador entrega
   el equipo, **Then** la Orden pasa a `ENTREGADA` y queda posicionada en
   el evento final del flujo.
3. **Given** una Orden sin comprobante final generado, **When** se
   intenta entregarla, **Then** el sistema lo rechaza.
4. **Given** una Orden sin garantia de reparacion generada, **When** se
   intenta entregarla, **Then** el sistema lo rechaza.
5. **Given** una Orden con alguna reserva de inventario todavia activa,
   **When** se intenta entregarla, **Then** el sistema lo rechaza.
6. **Given** una Orden con saldo pendiente, **When** se intenta
   entregarla, **Then** el sistema lo rechaza.
7. **Given** un usuario cuyo rol no es Administrador, **When** intenta
   entregar el equipo, **Then** el sistema rechaza la operacion.
8. **Given** la Orden entregada, **When** se revisa el historial,
   **Then** contiene `PROC-REP-280` y `PROC-REP-270`, y el evento final
   **no** se registra como un paso mas: queda como posicion actual.

---

### Edge Cases

- **Orden que no requiere entrega (`RT_INTERNO`)**: fuera del slice.
- **Informar el resultado al sistema de Gestion RT** (`PROC-REP-290`):
  fuera del slice.
- **Orden `SIN_REPARACION`** (`BR-REP-010`): fuera del slice. El
  comprobante final del MVP siempre incluye garantia porque siempre hubo
  reparacion.
- **Garantia de reparacion a nivel Detalle**: pendiente declarado; hoy se
  relaciona a nivel Orden.
- **Estado terminal de `RT_INTERNO`**: pendiente declarado.
- **Notificacion automatica por WhatsApp**: el Business Process indica
  que el sistema asiste a Recepcion preparando el mensaje, sin
  automatizar el envio. El MVP solo registra el hecho de la
  notificacion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-REP-055**: El sistema debe determinar que las Ordenes de origen
  que lo requieren se entregan al cliente y permitir notificarle que el
  equipo esta listo. *(`PROC-REP-250` rama `Si`, `PROC-REP-260`)*
- **FR-REP-056**: Solo un usuario con rol Recepcion puede notificar al
  cliente. *(actor `ACT-RECEP`)*
- **FR-REP-057**: El sistema debe emitir el comprobante final de la
  Orden y, cuando hubo reparacion, la garantia de reparacion, dejando
  registrado que fueron generados y cuando. *(`PROC-REP-280`)*
- **FR-REP-058**: La entrega del equipo debe exigir, de forma
  acumulativa: condicion de entrega superada (saldo cero), comprobante
  final emitido, garantia de reparacion emitida y ninguna reserva de
  inventario activa. *(`PROC-REP-270`, `BR-REP-017-B`)*
- **FR-REP-059**: Solo un usuario con rol Administrador puede entregar el
  equipo. *(actor `ACT-ADMIN`)*
- **FR-REP-060**: Al entregarse, la Orden debe pasar al hito `ENTREGADA`
  y quedar posicionada en el evento final del flujo.
  *(`PROC-REP-270` → `EVT-REP-999`)*

### Key Entities *(include if feature involves data)*

- **Comprobante final**: constancia del trabajo realizado, los pagos y el
  saldo definitivo. Registra si fue generado y su fecha.
- **Garantia de reparacion**: constancia de la garantia otorgada.
  Registra si fue generada y su fecha.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-025**: Ningun equipo se entrega sin comprobante final y garantia
  emitidos.
- **SC-026**: Ninguna Orden queda entregada conservando reservas de
  inventario activas.
- **SC-027**: El 100% de las Ordenes entregadas quedan posicionadas en el
  evento final del flujo, con su recorrido completo trazable.

## Assumptions

- El comprobante final y la garantia se modelan como hechos registrados
  (generado si/no + fecha), no como documentos renderizados. El contenido
  desglosado que describe `PROC-REP-280` (Detalles, ajustes, pagos,
  saldo) **no** se materializa: se deriva de la propia Orden.
- La notificacion al cliente se registra como hecho; no hay integracion
  con WhatsApp ni con ningun canal.
- El evento final `EVT-REP-999` se representa como posicion actual de la
  Orden, no como un paso mas del historial: es un evento de fin, no una
  actividad.
