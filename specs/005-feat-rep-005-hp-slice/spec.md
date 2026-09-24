# Feature Specification: Ejecucion de Detalles y gestion de insumos — Implemented slice: HP-REP-001

**Feature Branch**: `mvp-traceability`

**Created**: 2026-09-24

**Status**: Reconstructed from implemented baseline (brownfield)

**Business Feature**: `FEAT-REP-005` — Ejecucion de Detalles y gestion de insumos

**Source Process**: `PROC-REP` V1.3

**Implemented Scenario**: `HP-REP-001`

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |

> **ALCANCE.** `HP-REP-001` tiene `station_compatible = true`,
> `reservation_success = true` y `execution_result = COMPLETADO`. El
> slice cubre **solo el camino exitoso**. Los caminos de estacion
> incompatible con override, de reserva fallida y de Ejecucion
> interrumpida pertenecen a `FEAT-REP-005` y **no estan implementados**.

## Alcance del slice

### Nodos dentro del slice

| Nodo | Nombre | Actor | En HP-REP-001 |
|---|---|---|---|
| `PROC-REP-181` | Seleccionar Detalle a trabajar | `ACT-TECH` | si |
| `PROC-REP-174` | Estacion habilitada para el Detalle seleccionado | decision | rama `Si` |
| `PROC-REP-185` | Reservar insumos e iniciar Ejecucion del Detalle | `ACT-SYSTEM` | si, rama `Reserva exitosa` |
| `PROC-REP-190` | Ejecutar Detalle | `ACT-TECH` | si |
| `PROC-REP-200` | Registrar ejecucion real del Detalle | `ACT-TECH` | si, resultado `Completado` |
| `PROC-REP-210` | Generar movimientos de inventario | `ACT-SYSTEM` | si |
| `PROC-REP-211` | Evaluar situacion de la Orden | decision | rama `Todos terminales, existe completo` |

### Nodos de la Feature FUERA del slice (no implementados)

| Nodo | Nombre | Motivo |
|---|---|---|
| `PROC-REP-174` rama `No` | Estacion no habilitada para el Detalle | `station_compatible = true` |
| `PROC-REP-176` | Registrar advertencia de estacion incompatible | no recorrido |
| `PROC-REP-178` | Usuario autorizado fuerza continuidad (Detalle) | override `BR-REP-011-B` no implementado |
| `PROC-REP-179` | Registrar override de estacion (Detalle) | no recorrido |
| `PROC-REP-186` | Registrar reserva fallida | `reservation_success = true` |
| `PROC-REP-200` resultado `Interrumpido` | Ejecucion interrumpida | `execution_result = COMPLETADO` |
| `PROC-REP-211` ramas (a), (b), (d), (e), (f) | Otros resultados del resolver | solo se alcanza el caso "todos terminales con >= 1 COMPLETO" |

### Business Rules aplicables al slice

- `BR-REP-004` — Registro de ejecucion real (rama "Completado").
- `BR-REP-005` — Inventario consecuencia de ejecucion.
- `BR-REP-006` — Reserva de insumos al iniciar Ejecucion (rama exitosa).
- `BR-REP-007` — Concurrencia: maximo una Ejecucion activa por Orden.
- `BR-REP-011` (alcance B) — Compatibilidad de estacion por Detalle
  (rama compatible; el override **no** esta implementado).
- `BR-REP-012` — Estado agregado derivado (solo la regla de prioridad 2:
  "todos terminales y existe >= 1 COMPLETO").
- `BR-REP-018` — Cierre automatico de la participacion cuando ya no queda
  Detalle trabajable.

## User Scenarios & Testing *(mandatory)*

### User Story `US-REP-007` — Elegir que Detalle trabajar ahora (Priority: P1)

Como **Tecnico**, quiero elegir cual de los Detalles de la Orden que
tengo tomada voy a trabajar ahora y que el sistema confirme que mi
Estacion sirve para ese trabajo, para no empezar algo que no puedo
terminar aqui.

**Why this priority**: es el paso que convierte una Orden tomada en un
trabajo concreto.

**Independent Test**: sobre una Orden con toma activa, seleccionar el
Detalle y validar su compatibilidad, verificando que ambos pasos quedan
registrados.

**Acceptance Scenarios**:

1. **Given** una Orden con toma activa y un Detalle trabajable, **When**
   el tecnico lo selecciona, **Then** el Detalle queda marcado como el
   que se va a trabajar y el paso se registra.
2. **Given** el Detalle seleccionado y una Estacion habilitada para su
   Tipo de Reparacion, **When** se revalida la compatibilidad, **Then**
   el resultado es positivo.
3. **Given** una Estacion **no** habilitada para el Tipo del Detalle
   seleccionado, **When** se revalida la compatibilidad, **Then** el
   resultado es negativo.
4. **Given** un Detalle que ya esta en progreso, **When** se intenta
   seleccionarlo, **Then** el sistema rechaza la operacion.
5. **Given** un usuario cuyo rol no es Tecnico, **When** intenta
   seleccionar el Detalle, **Then** el sistema rechaza la operacion.

---

### User Story `US-REP-008` — Empezar a trabajar un Detalle con sus insumos asegurados (Priority: P1)

Como **Tecnico**, quiero que al empezar a trabajar un Detalle el sistema
reserve efectivamente los insumos que voy a necesitar, para que nadie mas
los comprometa mientras trabajo.

**Why this priority**: es el punto donde el compromiso de stock se
vuelve real. Sin el, dos tecnicos podrian contar con el mismo repuesto.

**Independent Test**: sobre un Detalle seleccionado, iniciar la
Ejecucion y verificar que se crearon las reservas y que el stock fisico
**no** cambio.

**Acceptance Scenarios**:

1. **Given** un Detalle seleccionado con insumos previstos disponibles,
   **When** se inicia su Ejecucion, **Then** se generan las reservas
   trazadas a ese Detalle y queda abierta una Ejecucion.
2. **Given** esa reserva, **When** se consulta el stock fisico del
   insumo, **Then** **no** cambio: reservar no consume.
3. **Given** un Detalle cuyos insumos previstos no alcanzan, **When** se
   intenta iniciar la Ejecucion, **Then** la operacion falla y **no**
   queda ningun movimiento parcial registrado.
4. **Given** una Orden con una Ejecucion ya activa, **When** se intenta
   iniciar otra Ejecucion sobre la misma Orden, **Then** el sistema lo
   impide.
5. **Given** un tecnico distinto del titular de la Ejecucion activa,
   **When** intenta trabajar esa Ejecucion, **Then** el sistema lo
   impide.
6. **Given** una Ejecucion que no pertenece a la toma activa, **When** se
   intenta operarla, **Then** el sistema lo impide.

---

### User Story `US-REP-009` — Dejar registrado el trabajo realmente hecho (Priority: P1)

Como **Tecnico**, quiero registrar al terminar que trabajo hice y que
repuestos use realmente, para que la historia tecnica y el inventario
reflejen lo que efectivamente paso.

**Why this priority**: es la fuente de verdad de todo lo posterior
(inventario, control tecnico, puntaje, comprobante).

**Independent Test**: completar una Ejecucion declarando insumos
utilizados y verificar que el Detalle queda `COMPLETO` y que los
movimientos de inventario resultan consistentes.

**Acceptance Scenarios**:

1. **Given** una Ejecucion activa, **When** el tecnico la registra como
   completada indicando los insumos realmente utilizados, **Then** el
   Detalle pasa a `COMPLETO` y la Ejecucion queda cerrada con esos
   insumos.
2. **Given** una Ejecucion completada donde se uso exactamente lo
   reservado, **When** se generan los movimientos, **Then** se registra
   el consumo y no queda ninguna reserva activa.
3. **Given** una Ejecucion donde se uso **menos** de lo reservado,
   **When** se generan los movimientos, **Then** se registra el consumo
   por lo utilizado y la liberacion por la diferencia.
4. **Given** una Ejecucion donde se declara **mas** de lo reservado,
   **When** se intenta generar los movimientos, **Then** el sistema
   rechaza la operacion.
5. **Given** los movimientos generados, **When** se consulta el stock
   fisico, **Then** bajo exactamente por lo consumido; la liberacion no
   lo modifico.
6. **Given** unos movimientos ya generados para esa Ejecucion, **When**
   se repite la generacion, **Then** no se duplican consumos ni se vuelve
   a descontar stock.
7. **Given** una reserva y su consumo, **When** se consulta el historial,
   **Then** ambos movimientos se conservan: el consumo referencia a la
   reserva, que nunca se modifico ni se borro.
8. **Given** una Orden cuyo unico Detalle quedo `COMPLETO`, **When** se
   reevalua la situacion, **Then** el resultado agregado es que la Orden
   esta completa y la participacion activa se cierra automaticamente.

---

### Edge Cases

- **Ejecucion interrumpida** (`PROC-REP-200` resultado `Interrumpido`,
  `BR-REP-004`): fuera del slice. `EstadoEjecucion` no tiene el valor
  correspondiente.
- **Reserva fallida al iniciar** (`PROC-REP-186`, `BR-REP-006`): el
  sistema **si** rechaza la operacion cuando no hay stock, pero **no**
  implementa el nodo de negocio (marcar el Detalle
  `BLOQUEADO_POR_RECURSOS` y recalcular). Ver gaps.
- **Estacion incompatible con override** (`PROC-REP-176/178/179`,
  `BR-REP-011-B`): fuera del slice.
- **Varias Ejecuciones historicas sobre el mismo Detalle**: el modelo lo
  soporta (`ejecuciones` es una lista), pero no esta ejercitado.
- **Ejecucion sin insumos previstos**: no genera movimientos, por lo que
  la deteccion de "inventario ya aplicado" no la reconoce. Borde conocido
  y documentado en el codigo: reaplicar es igualmente inocuo.
- **Resolver con resultado distinto de "todos terminales con >= 1
  COMPLETO"**: el service falla explicitamente en vez de inventar un
  resultado (fail-safe de `BR-REP-012`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-REP-025**: El tecnico debe poder seleccionar cual Detalle
  trabajable de la Orden tomada va a trabajar. Un Detalle ya en progreso
  no puede volver a seleccionarse. *(`PROC-REP-181`)*
- **FR-REP-026**: Al seleccionar un Detalle, el sistema debe revalidar la
  compatibilidad entre la Estacion actual y el Tipo de Reparacion de
  **ese** Detalle. *(`PROC-REP-174`, `BR-REP-011-B`)*
- **FR-REP-027**: La Ejecucion de un Detalle solo debe iniciarse si la
  reserva real de sus insumos previstos es exitosa. Una reserva que no
  puede completarse no debe dejar movimientos parciales.
  *(`PROC-REP-185`, `BR-REP-006`)*
- **FR-REP-028**: Reservar insumos no debe modificar el stock fisico: la
  reserva compromete, no consume.
- **FR-REP-029**: El sistema debe impedir que exista mas de una Ejecucion
  activa simultaneamente sobre una misma Orden. *(`BR-REP-007`)*
- **FR-REP-030**: Solo el tecnico titular de la Ejecucion activa, y
  dentro de la toma a la que esa Ejecucion pertenece, puede trabajarla y
  completarla.
- **FR-REP-031**: Al finalizar la Ejecucion, el tecnico debe registrar el
  trabajo realizado, los repuestos realmente utilizados con sus
  cantidades y las observaciones. *(`PROC-REP-200`, `BR-REP-004`)*
- **FR-REP-032**: A partir de lo efectivamente utilizado, el sistema debe
  consumir lo utilizado y liberar la reserva no utilizada, dejando cada
  movimiento trazado hasta el Detalle que lo origino.
  *(`PROC-REP-210`, `BR-REP-005`)*
- **FR-REP-033**: El sistema debe rechazar un consumo mayor a lo
  reservado.
- **FR-REP-034**: Solo el consumo debe descontar el stock fisico; la
  liberacion de una reserva no debe modificarlo.
- **FR-REP-035**: La generacion de movimientos de inventario de una
  Ejecucion debe ser idempotente: repetirla no debe duplicar consumos ni
  volver a descontar stock.
- **FR-REP-036**: Un movimiento de inventario registrado no debe
  modificarse ni eliminarse. El consumo y la liberacion se representan
  como movimientos nuevos que referencian la reserva original, de modo
  que la historia completa se conserve. *(`BR-REP-005`)*
- **FR-REP-037**: La situacion agregada de la Orden debe calcularse a
  partir del conjunto de sus Detalles mediante una politica centralizada,
  y nunca fijarse manualmente por un paso del proceso. Si el contexto no
  corresponde a ninguna regla conocida, el sistema debe fallar de forma
  explicita en lugar de continuar silenciosamente.
  *(`PROC-REP-211`, `BR-REP-012`)*
- **FR-REP-038**: Cuando la reevaluacion determina que ya no queda ningun
  Detalle trabajable, la toma/participacion activa debe cerrarse
  automaticamente, registrando su fecha/hora de cierre. *(`BR-REP-018`)*
- **FR-REP-039**: Los movimientos generados por el sistema no deben
  registrar un usuario humano responsable; la trazabilidad hacia el
  tecnico se obtiene a traves de la Ejecucion asociada.

### Key Entities *(include if feature involves data)*

- **Ejecucion de Reparacion**: trabajo concreto sobre un Detalle dentro
  de una toma. Registra tecnico, inicio, fin, insumos utilizados y
  observaciones.
- **Insumo utilizado**: repuesto y cantidad realmente empleados,
  confirmados por el tecnico.
- **Movimiento de Insumo**: asiento inmutable del ledger de inventario
  (`RESERVA`, `CONSUMO`, `LIBERACION_RESERVA`, `DEVOLUCION`), trazado al
  Detalle y, cuando corresponde, a la Ejecucion y al movimiento origen.
  El slice de HP-REP-001 usa `RESERVA`, `CONSUMO` y
  `LIBERACION_RESERVA`. Sobre `DEVOLUCION` y `DESPERDICIO` hay una
  divergencia pendiente de reconciliar: ver TASK-REP-089 y
  `traceability/IMPLEMENTATION.md`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-014**: Nunca se descuenta stock por una reserva: solo por consumo
  efectivo.
- **SC-015**: El 100% de los movimientos de inventario son trazables
  hasta el Detalle y la Orden que los originaron.
- **SC-016**: Un reintento de la operacion de inventario nunca produce
  doble descuento de stock.
- **SC-017**: Ninguna Orden puede tener dos trabajos en curso al mismo
  tiempo.
- **SC-018**: La historia tecnica (ejecuciones, insumos, movimientos)
  nunca se reescribe.

## Assumptions

- `HP-REP-001` recorre una unica Ejecucion completada con exito. Los
  caminos de interrupcion, override de estacion y reserva fallida no se
  representan como implementados.
- El resolver de estado de Orden implementado cubre **solo** la regla de
  prioridad 2 de `BR-REP-012`; fuera de ese caso falla explicitamente en
  lugar de inventar un resultado.
- El MVP no implementa transacciones distribuidas: al aplicar inventario,
  se valida todo antes de escribir y se prioriza preservar la historia de
  la Orden sobre la actualizacion del catalogo.
