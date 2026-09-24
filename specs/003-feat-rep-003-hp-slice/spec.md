# Feature Specification: Validacion de factibilidad y habilitacion — Implemented slice: HP-REP-001

**Feature Branch**: `mvp-traceability`

**Created**: 2026-09-24

**Status**: Reconstructed from implemented baseline (brownfield)

**Business Feature**: `FEAT-REP-003` — Validacion de factibilidad y habilitacion

**Source Process**: `PROC-REP` V1.3

**Implemented Scenario**: `HP-REP-001`

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |

> **ALCANCE.** `HP-REP-001` tiene `resources_available = true`: la
> factibilidad da positiva a la primera. El slice implementado cubre
> **solo la rama `Si` de `PROC-REP-090`**. Los caminos de faltante
> (advertencia, override, espera por recursos) pertenecen a
> `FEAT-REP-003` y **no estan implementados**.

## Alcance del slice

### Nodos dentro del slice

| Nodo | Nombre | Actor | En HP-REP-001 |
|---|---|---|---|
| `PROC-REP-080` | Validar factibilidad por Detalle | `ACT-SYSTEM` | si |
| `PROC-REP-090` | Existe al menos un Detalle trabajable | decision | rama `Si` |
| `PROC-REP-140` | Habilitar Orden de Reparacion | `ACT-SYSTEM` | si |

### Nodos de la Feature FUERA del slice (no implementados)

| Nodo | Nombre | Motivo |
|---|---|---|
| `PROC-REP-090` rama `No` | Ningun Detalle trabajable | `resources_available = true` |
| `PROC-REP-100` | Registrar advertencia de faltante | no recorrido |
| `PROC-REP-110` | Usuario autorizado fuerza el Detalle bloqueado | no recorrido |
| `PROC-REP-120` | Detalle(s) pendientes por recursos | agregado `PENDIENTE_RECURSOS` no alcanzado |
| `PROC-REP-130` | Registrar override | `BR-REP-003` no implementada |

### Business Rules aplicables al slice

- `BR-REP-001` — Definicion del requerimiento (precondicion: debe haber
  Detalles con Tipo definido).
- `BR-REP-002` — Validacion previa de recursos: la factibilidad se evalua
  **por Detalle** y **solo consulta** disponibilidad, sin reservar. La
  Orden puede habilitarse mientras exista al menos un Detalle trabajable.
- `BR-REP-003` — Override justificado: **fuera del slice**, no
  implementada.

## User Scenarios & Testing *(mandatory)*

### User Story `US-REP-004` — Saber si hay insumos antes de poner la Orden a trabajar (Priority: P1)

Como **Coordinador RMA**, quiero que el sistema verifique que hay
insumos disponibles para los Detalles de la Orden antes de habilitarla,
para no poner en la cola de trabajo tareas que los tecnicos no van a
poder realizar.

**Why this priority**: es el gate que separa una Orden registrada de una
Orden operable. Sin el, la cola se llena de trabajo imposible.

**Independent Test**: sobre una Orden con Detalles definidos, ejecutar la
validacion de factibilidad contra un catalogo de insumos y verificar que
da positiva **sin** generar ningun movimiento de inventario y **sin**
alterar el stock fisico.

**Acceptance Scenarios**:

1. **Given** una Orden con al menos un Detalle definido y stock
   suficiente de los insumos previstos de su Tipo de Reparacion,
   **When** el sistema valida la factibilidad, **Then** el resultado es
   factible.
2. **Given** la misma validacion, **When** termina, **Then** la Orden no
   tiene ningun movimiento de inventario y el stock fisico del insumo no
   cambio: la factibilidad **consulta**, no reserva.
3. **Given** dos Ordenes distintas que requieren el mismo insumo y hay
   stock para una sola, **When** ambas validan factibilidad sin que
   ninguna haya reservado todavia, **Then** ambas resultan factibles
   (todavia no hay compromiso sobre el stock).
4. **Given** una Orden que ya reservo el ultimo insumo disponible,
   **When** otra Orden valida su factibilidad sobre ese mismo insumo,
   **Then** la disponibilidad que ve la segunda Orden ya refleja la
   reserva ajena.
5. **Given** una Orden factible, **When** se la habilita, **Then** pasa
   al estado de workflow `HABILITADA` y queda lista para recibir
   prioridad e ingresar a la cola.
6. **Given** una Orden sin ningun Detalle, **When** se intenta
   habilitarla, **Then** el sistema rechaza la operacion (`BR-REP-001`).
7. **Given** la validacion y la habilitacion, **When** se completan,
   **Then** el historial registra `PROC-REP-080`, `PROC-REP-090` y
   `PROC-REP-140`.

---

### Edge Cases

- **Ningun Detalle trabajable** (`PROC-REP-090` rama `No`): fuera del
  slice. El agregado `PENDIENTE_RECURSOS` no esta implementado.
- **Override de un Detalle bloqueado** (`PROC-REP-110`/`130`,
  `BR-REP-003`): fuera del slice.
- **Orden con varios Detalles donde solo algunos son factibles**:
  `BR-REP-002` lo define (basta uno trabajable), pero `HP-REP-001` tiene
  `detail_count = 1`, asi que ese caso **no** esta ejercitado.
- **Insumo sin stock al momento de la factibilidad**: el calculo lo
  contempla (disponible negativo o cero), pero el camino de negocio
  posterior no esta implementado.
- **Reserva que aparece entre la factibilidad y el inicio de la
  Ejecucion**: es exactamente el gap que `PROC-REP-186` cubre; ver
  `specs/005-feat-rep-005-hp-slice/` (tampoco implementado).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-REP-011**: El sistema debe evaluar, por cada Detalle de la Orden,
  la disponibilidad de los insumos previstos por su Tipo de Reparacion.
  *(`PROC-REP-080`, `BR-REP-002`)*
- **FR-REP-012**: La validacion de factibilidad debe **consultar**
  disponibilidad sin comprometerla: no debe generar ningun movimiento de
  inventario ni modificar el stock fisico. *(`BR-REP-002`, `BR-REP-006`)*
- **FR-REP-013**: La disponibilidad de un insumo debe calcularse como el
  stock fisico menos todo lo reservado y aun pendiente, considerando las
  reservas de **todas** las Ordenes, no solo las de la Orden evaluada.
- **FR-REP-014**: El sistema debe habilitar la Orden cuando exista al
  menos un Detalle trabajable; no debe exigirse que todos los Detalles
  sean factibles. *(`PROC-REP-090`, `PROC-REP-140`, `BR-REP-002`)*
- **FR-REP-015**: El sistema debe impedir habilitar una Orden que no
  tenga ningun Detalle de Reparacion definido. *(`BR-REP-001`)*

### Key Entities *(include if feature involves data)*

- **Insumo**: entrada de catalogo con stock fisico.
- **Insumo previsto por Tipo de Reparacion**: relacion de catalogo que
  indica que insumos y cantidades requiere un Tipo de Reparacion.
- **Disponibilidad**: magnitud derivada (stock fisico menos reservas
  activas), nunca un dato almacenado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-008**: Ninguna Orden ingresa a la cola de trabajo sin que se haya
  verificado la disponibilidad de insumos de al menos un Detalle.
- **SC-009**: La validacion de factibilidad nunca bloquea stock: dos
  consultas simultaneas no se interfieren.
- **SC-010**: La disponibilidad informada refleja siempre las reservas de
  todas las Ordenes en curso, no solo las de la Orden consultada.

## Assumptions

- Los catalogos de insumos y de insumos previstos por Tipo de Reparacion
  existen previamente y se leen; su mantenimiento esta fuera de la
  baseline.
- `HP-REP-001` tiene `resources_available = true`: el camino negativo no
  se representa como implementado.
- La factibilidad se evalua contra el conjunto de Ordenes persistidas al
  momento de la consulta. No hay control de concurrencia transaccional:
  el MVP no implementa bloqueos ni transacciones distribuidas.
