# Implementation Plan: Gestion de prioridad, cola, toma y liberacion tecnica — Implemented slice: HP-REP-001

**Branch**: `mvp-traceability` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-feat-rep-004-hp-slice/spec.md`

> **Nota brownfield**: documenta la arquitectura realmente existente en
> la baseline `3788d87`.

## Summary

El slice lleva la Orden de `HABILITADA` a `EN_COLA` y abre la
participacion activa del tecnico. La decision tecnica central es que la
**toma de Orden** (`TomaOrden`) y la **Ejecucion de un Detalle**
(`EjecucionReparacion`) son entidades distintas con ciclos de vida
propios: `BR-REP-018` y `BR-REP-007` son reglas complementarias, no la
misma. `validar_estacion_trabajo` devuelve `(Orden, bool)` y **registra
el paso incluso cuando la validacion falla**, para que el intento quede
en el historial.

## Technical Context

**Language/Version**: Python 3.11+

**Primary Dependencies**: Pydantic v2

**Storage**: JSON local

**Testing**: pytest

**Target Platform**: servicio backend local (MVP)

**Project Type**: web application (backend + frontend scaffold)

**Performance Goals**: no aplica

**Constraints**: Ruff `line-length = 79`

**Scale/Scope**: 4 nodos de proceso, 4 servicios, 3 entidades de catalogo

## Constitution Check

| Principio | Estado | Evidencia |
|---|---|---|
| I. Business YAML fuente de verdad | PASS | FR derivados de `BR-REP-011-A` y `BR-REP-018` |
| II. IDs estables | PASS | — |
| III. Trazabilidad E2E | PASS | [traceability.md](./traceability.md) |
| IV. Modelo de datos transversal | PASS | `TomaOrden` enlazada desde 004 y 005 |
| V. No inferir funcional desde codigo | PASS | `PROC-REP-212`/`213` declarados NO implementados |
| VI. Separacion de capas | PASS | `services/tomas.py` recibe catalogos como listas, no repositories |
| VII. Sin sobreingenieria | PASS | `EstadoTomaOrden` con dos valores |
| VIII. Tests vinculados | PASS | — |
| IX. UAT distinto | PASS | `UAT-REP-005`, `UAT-REP-006` en `PENDING` |
| X. PEP 8 / Ruff | PASS | — |
| XI. Slice vs Feature | PASS | 4 de 6 nodos de la Feature implementados |

**Violaciones a justificar**: ninguna.

## Project Structure

### Documentation (this feature)

```text
specs/004-feat-rep-004-hp-slice/
├── spec.md
├── plan.md
├── tasks.md
└── traceability.md
```

### Source Code (repository root)

```text
app/backend/app/
├── domain/models/
│   ├── catalogos.py      # EstacionTrabajo, TipoReparacionEstacion
│   ├── reparacion.py     # TomaOrden
│   └── enums.py          # EstadoTomaOrden, RolUsuario
└── services/
    ├── ordenes.py        # definir_prioridad, ingresar_a_cola
    └── tomas.py          # validar_estacion_trabajo, tomar_orden,
                          # toma_activa, hay_ejecucion_activa,
                          # estacion_habilitada_para, buscar_detalle
```

**Structure Decision**: `services/tomas.py` recibe los catalogos como
secuencias ya cargadas (`estaciones`, `compatibilidades`), no un
repository. La capa de servicios no conoce la persistencia
(Constitution VI); es el llamador quien decide como obtenerlos.

## Data Model (artefacto transversal)

| Entidad | Archivo | Rol |
|---|---|---|
| `TomaOrden` | `app/backend/app/domain/models/reparacion.py` | Participacion activa del tecnico |
| `EstacionTrabajo` | `app/backend/app/domain/models/catalogos.py` | Catalogo, con estado operativo |
| `TipoReparacionEstacion` | `app/backend/app/domain/models/catalogos.py` | Compatibilidad Tipo ↔ Estacion |
| `EstadoTomaOrden` | `app/backend/app/domain/models/enums.py` | `ACTIVA`, `CERRADA` |
| `RolUsuario` | `app/backend/app/domain/models/enums.py` | `ADMINISTRADOR`, `RECEPCION`, `COORDINADOR_RMA`, `TECNICO` |

```text
OrdenReparacion
  └── TomaOrden[]                  (historial completo, append-only)
        └── EjecucionReparacion[]  (una toma puede abarcar varias)
```

## Technical Requirements

- **TR-REP-028**: `TomaOrden` y `EjecucionReparacion` son entidades
  **distintas** con ciclos de vida propios. `BR-REP-018` (una toma activa
  por Orden) y `BR-REP-007` (una Ejecucion activa por Orden) se
  implementan como invariantes separadas: `toma_activa()` y
  `hay_ejecucion_activa()`.
  → satisface `FR-REP-020`, `FR-REP-023`
  → `app/backend/app/domain/models/reparacion.py::TomaOrden`,
    `app/backend/app/services/tomas.py::toma_activa`,
    `::hay_ejecucion_activa`
- **TR-REP-029**: El historial de participaciones es **append-only**: al
  cerrarse una toma se fija `fin` y el estado pasa a `CERRADA`; nunca se
  elimina ni se sobrescribe el registro anterior.
  → satisface `FR-REP-022`
  → `app/backend/app/domain/models/reparacion.py::TomaOrden`
- **TR-REP-030**: `validar_estacion_trabajo` devuelve `(Orden, bool)` y
  registra `PROC-REP-172` en el historial **tanto si la validacion pasa
  como si falla**, con el resultado como observacion. El intento fallido
  tambien es historia del proceso.
  → satisface `FR-REP-019`
  → `app/backend/app/services/tomas.py::validar_estacion_trabajo`,
    `::_registrar_validacion_estacion`
- **TR-REP-031**: La compatibilidad Estacion ↔ Tipo de Reparacion se
  resuelve con un helper dedicado (`estacion_habilitada_para`) sobre la
  lista de compatibilidades recibida, reutilizado tanto por la validacion
  agregada (`PROC-REP-172`) como por la validacion por Detalle
  (`PROC-REP-174`, ver `specs/005-feat-rep-005-hp-slice/`).
  → satisface `FR-REP-019`
  → `app/backend/app/services/tomas.py::estacion_habilitada_para`
- **TR-REP-009**: Validacion de actor: `ACT-COORD` para
  `definir_prioridad`, `ACT-TECH` para `validar_estacion_trabajo` y
  `tomar_orden`.
  → satisface `FR-REP-017`, `FR-REP-024`
- **TR-REP-002**: `prioridad` se declara `Field(default=0, ge=0)`: una
  prioridad negativa falla al construir el modelo.
  → satisface `FR-REP-016`
  → `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion`
- **TR-REP-008**: `definir_prioridad`, `ingresar_a_cola`,
  `validar_estacion_trabajo` y `tomar_orden` no mutan la Orden recibida.
  → satisface `FR-REP-016`, `FR-REP-018`, `FR-REP-022`
- **TR-REP-010**: `ingresar_a_cola` es `ACT-SYSTEM` y no recibe
  `usuario`.
  → satisface `FR-REP-018`
  → `app/backend/app/services/ordenes.py::ingresar_a_cola`
- **TR-REP-011**: Registro de `PROC-REP-150`, `PROC-REP-170`,
  `PROC-REP-172` y `PROC-REP-180` en el historial.
  → satisface `FR-REP-022`
- **TR-REP-020**: Precondiciones de estado (`EN_COLA` para tomar, no
  reingresar a cola) se expresan como `PrecondicionInvalidaError`.
  → satisface `FR-REP-018`, `FR-REP-021`

## Dependencies

- **Depende de**: `specs/003-feat-rep-003-hp-slice/` (Orden
  `HABILITADA`).
- **Consumido por**: `specs/005-feat-rep-005-hp-slice/` (la seleccion de
  Detalle y la Ejecucion requieren una toma activa).
- **Externa**: ninguna mas alla de Pydantic v2.

## Complexity Tracking

> Sin violaciones de la Constitution que requieran justificacion.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |

## Nota de interpretacion (reportada como gap)

`BR-REP-011-A` enumera seis validaciones, empezando por "(1) sesion
activa". La baseline no implementa gestion de sesion: el service recibe
el `Usuario` y el `estacion_id` ya resueltos y valida **rol + usuario
activo** en su lugar. Esto se documenta como interpretacion explicita, no
como cumplimiento completo de la regla.
