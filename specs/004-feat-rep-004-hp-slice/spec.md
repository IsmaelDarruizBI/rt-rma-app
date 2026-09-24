# Feature Specification: Gestion de prioridad, cola, toma y liberacion tecnica — Implemented slice: HP-REP-001

**Feature Branch**: `mvp-traceability`

**Created**: 2026-09-24

**Status**: Reconstructed from implemented baseline (brownfield)

**Business Feature**: `FEAT-REP-004` — Gestion de prioridad, cola, toma y liberacion tecnica

**Source Process**: `PROC-REP` V1.3

**Implemented Scenario**: `HP-REP-001`

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |

> **ALCANCE.** `HP-REP-001` recorre la toma de la Orden pero **nunca la
> libera explicitamente**: como tiene un unico Detalle, al completarlo ya
> no queda Detalle trabajable y la participacion se cierra
> automaticamente. Por eso `PROC-REP-212` (decision de continuar o
> liberar) y `PROC-REP-213` (liberar Orden) pertenecen a `FEAT-REP-004`
> pero **no estan implementados**.

## Alcance del slice

### Nodos dentro del slice

| Nodo | Nombre | Actor | En HP-REP-001 |
|---|---|---|---|
| `PROC-REP-150` | Definir prioridad | `ACT-COORD` o `ACT-RECEP` | si |
| `PROC-REP-170` | Ingresar orden a cola de trabajo | `ACT-SYSTEM` | si |
| `PROC-REP-172` | Validar estacion de trabajo | `ACT-SYSTEM` | si, rama `Valida y compatible` |
| `PROC-REP-180` | Tomar Orden de Reparacion | `ACT-TECH` | si |

### Nodos de la Feature FUERA del slice (no implementados)

| Nodo | Nombre | Motivo |
|---|---|---|
| `PROC-REP-212` | Tecnico desea continuar trabajando esta Orden | con `detail_count = 1` nunca se alcanza |
| `PROC-REP-213` | Liberar Orden de Reparacion | liberacion explicita no recorrida |
| `PROC-REP-172` rama negativa | Sesion/estacion/compatibilidad invalida | `station_valid = true`, `station_compatible = true` |

### Business Rules aplicables al slice

- `BR-REP-011` (alcance A) — Compatibilidad de estacion **para tomar la
  Orden**: sesion activa, estacion confirmada/configurada/`OPERATIVA`,
  sin Ejecucion activa sobre la Orden, y al menos un Detalle trabajable
  compatible. **Ninguna de estas condiciones admite override.**
- `BR-REP-018` — Toma y liberacion de Orden: como maximo **una** toma
  activa por Orden en simultaneo; el historial de participaciones nunca
  se sobrescribe. La parte de liberacion explicita esta fuera del slice.

## User Scenarios & Testing *(mandatory)*

### User Story `US-REP-005` — Ordenar el trabajo pendiente (Priority: P1)

Como **Coordinador RMA** o **Recepcionista**, quiero asignar una
prioridad a la Orden habilitada e ingresarla a la cola de trabajo, para
que los tecnicos sepan que hay para trabajar y en que orden.

`PROC-REP-150` declara `ACT-COORD` como actor y `ACT-RECEP` como
`actores_alternativos`: son equivalentes, sin jerarquia. En la operacion
real Recepcion necesita poder encolar sin esperar al Coordinador.

HP-REP-001 recorre esta accion con `ACT-COORD`: ampliar quien PUEDE
ejecutarla no cambia quien la ejecuta DENTRO del Happy Path.

**Why this priority**: sin cola no hay trabajo disponible para los
tecnicos. Es el puente entre la habilitacion y la ejecucion.

**Independent Test**: sobre una Orden `HABILITADA`, asignar prioridad e
ingresarla a la cola, verificando que queda en `EN_COLA`.

**Acceptance Scenarios**:

1. **Given** una Orden `HABILITADA`, **When** el Coordinador le asigna
   una prioridad, **Then** la Orden registra esa prioridad.
1b. **Given** una Orden `HABILITADA`, **When** Recepcion le asigna una
   prioridad, **Then** la Orden la registra igual: ambos actores estan
   autorizados.
2. **Given** una prioridad negativa, **When** se intenta asignarla,
   **Then** el sistema la rechaza.
3. **Given** una Orden con prioridad asignada, **When** se la ingresa a
   la cola, **Then** pasa al estado `EN_COLA` y queda disponible para
   cualquier tecnico (no se asigna tecnico).
4. **Given** una Orden ya `EN_COLA`, **When** se intenta ingresarla
   nuevamente, **Then** el sistema rechaza la operacion.
5. **Given** un usuario cuyo rol no es Coordinador RMA ni Recepcion
   -por ejemplo un Tecnico o un Administrador-, **When** intenta definir
   la prioridad, **Then** el sistema rechaza la operacion.

---

### User Story `US-REP-006` — Tomar una Orden desde una Estacion compatible (Priority: P1)

Como **Tecnico**, quiero tomar una Orden habilitada desde una Estacion
compatible, para poder comenzar a trabajar sus Detalles.

**Why this priority**: es el acto por el cual el trabajo pasa de estar
disponible a estar en manos de alguien. Sin el no hay ejecucion posible.

**Independent Test**: sobre una Orden `EN_COLA`, validar la estacion y
tomarla, verificando que queda una unica participacion activa asociada al
tecnico y a la estacion.

**Acceptance Scenarios**:

1. **Given** una Orden `EN_COLA`, un tecnico activo y una Estacion
   `OPERATIVA` habilitada para el Tipo de Reparacion de al menos un
   Detalle trabajable, **When** el tecnico valida la estacion, **Then**
   la validacion resulta positiva y queda registrada en el historial.
2. **Given** esa validacion positiva, **When** el tecnico toma la Orden,
   **Then** queda abierta una participacion activa con el tecnico, la
   estacion y la fecha/hora de inicio.
3. **Given** una Orden que ya tiene una participacion activa, **When**
   otro tecnico intenta tomarla, **Then** el sistema lo impide: como
   maximo una toma activa por Orden.
4. **Given** una Orden que ya tiene una participacion activa, **When** se
   valida la estacion para tomarla otra vez, **Then** la validacion
   resulta negativa.
5. **Given** una Estacion que no esta habilitada para ningun Detalle
   trabajable de la Orden, **When** se valida la estacion, **Then** la
   validacion resulta negativa y **no existe override** que la habilite.
6. **Given** un usuario cuyo rol no es Tecnico, **When** intenta validar
   la estacion o tomar la Orden, **Then** el sistema rechaza la
   operacion.
7. **Given** una Orden que no esta `EN_COLA`, **When** un tecnico intenta
   tomarla, **Then** el sistema rechaza la operacion.
8. **Given** una Orden recien tomada, **When** se consulta si hay alguna
   Ejecucion en curso, **Then** no la hay: tomar la Orden no inicia
   ninguna Ejecucion.

---

### Edge Cases

- **Tecnico que decide seguir con otro Detalle o liberar la Orden**
  (`PROC-REP-212`/`213`): fuera del slice.
- **Orden con varios Detalles donde solo algunos son compatibles con la
  Estacion**: `BR-REP-011-A` lo contempla (basta uno), pero con
  `detail_count = 1` el caso **no** esta ejercitado.
- **Estacion no `OPERATIVA`**: el modelo lo contempla; el camino de
  negocio posterior no esta implementado.
- **Reasignacion de prioridad de una Orden ya en cola**: no
  especificado por el Business Process; no implementado.
- **Catalogo definitivo de prioridades**: pendiente en
  `docs/discovery/README.md`. La prioridad se modela como entero >= 0.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-REP-016**: El sistema debe permitir asignar a la Orden una
  prioridad de ejecucion. La prioridad no puede ser negativa.
  *(`PROC-REP-150`)*
- **FR-REP-017**: Solo un usuario con rol Coordinador RMA o Recepcion
  puede definir la prioridad de la Orden.
  *(actores `ACT-COORD` o `ACT-RECEP`)*
- **FR-REP-018**: El sistema debe poder ingresar la Orden a la cola de
  trabajo, donde queda disponible para cualquier tecnico sin asignacion
  previa. Una Orden no puede ingresar dos veces a la cola.
  *(`PROC-REP-170`)*
- **FR-REP-019**: Antes de permitir que un tecnico tome una Orden, el
  sistema debe validar que: el usuario cumple el rol Tecnico y esta
  activo; la Estacion existe y esta `OPERATIVA`; no existe ya una
  Ejecucion activa sobre esa Orden; y existe al menos un Detalle
  trabajable cuyo Tipo de Reparacion este habilitado para esa Estacion.
  **Ninguna de estas condiciones admite override.**
  *(`PROC-REP-172`, `BR-REP-011-A`, `BR-REP-007`)*
- **FR-REP-020**: El sistema debe impedir que exista mas de una
  toma/participacion activa simultanea sobre una misma Orden.
  *(`BR-REP-018`)*
- **FR-REP-021**: Solo puede tomarse una Orden que se encuentre en la
  cola de trabajo.
- **FR-REP-022**: Al tomar la Orden, el sistema debe registrar la
  participacion con el tecnico, la estacion y la fecha/hora de inicio, y
  conservar el historial completo de participaciones sin sobrescribirlo.
  *(`BR-REP-018`)*
- **FR-REP-023**: Tomar la Orden no debe iniciar ninguna Ejecucion.
  *(`PROC-REP-180`)*
- **FR-REP-024**: Solo un usuario con rol Tecnico puede validar la
  estacion y tomar la Orden. *(actor `ACT-TECH`)*

### Key Entities *(include if feature involves data)*

- **Toma de Orden (participacion)**: registro de que un tecnico tiene la
  Orden en curso desde una estacion. Tiene estado (`ACTIVA`/`CERRADA`),
  inicio y fin.
- **Estacion de Trabajo**: entrada de catalogo con estado operativo.
- **Compatibilidad Tipo de Reparacion ↔ Estacion**: relacion de catalogo
  que habilita un Tipo en una Estacion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-011**: Ninguna Orden puede ser trabajada simultaneamente por dos
  tecnicos.
- **SC-012**: El 100% de las tomas quedan registradas con tecnico,
  estacion y fecha/hora, y el historial nunca se pierde.
- **SC-013**: Ningun tecnico puede tomar una Orden desde una Estacion
  incompatible, ni siquiera con autorizacion superior.

## Assumptions

- La sesion del tecnico y su asociacion a una Estacion se consideran
  resueltas fuera del sistema: el service recibe el `estacion_id` y el
  `Usuario` ya identificados. La validacion (1) "sesion activa" de
  `BR-REP-011-A` se implementa como validacion de usuario activo y rol.
- El catalogo definitivo de prioridades sigue pendiente; se modela como
  entero no negativo.
- La liberacion explicita de la Orden no se representa como
  implementada.
