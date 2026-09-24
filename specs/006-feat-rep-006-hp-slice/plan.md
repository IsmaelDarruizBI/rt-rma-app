# Implementation Plan: Control tecnico, retrabajo y evaluacion — Implemented slice: HP-REP-001

**Branch**: `mvp-traceability` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-feat-rep-006-hp-slice/spec.md`

> **Nota brownfield**: documenta la arquitectura realmente existente en
> la baseline `3788d87`.

## Summary

El slice aprueba el control tecnico, acredita el puntaje y marca la Orden
como `REPARACION_LISTA`. La decision tecnica central es que el
**resultado del control vive en el propio Detalle** (no en la Orden),
porque `BR-REP-008` establece que Recepcion aprueba Detalle por Detalle
aunque el control ocurra en un unico paso a nivel Orden. El
`puntaje_total` de la Orden es un `computed_field` que suma solo los
Detalles aprobados.

## Technical Context

**Language/Version**: Python 3.11+

**Primary Dependencies**: Pydantic v2 (`computed_field`)

**Storage**: JSON local; `puntaje_total` no se persiste

**Testing**: pytest

**Target Platform**: servicio backend local (MVP)

**Project Type**: web application (backend + frontend scaffold)

**Performance Goals**: no aplica

**Constraints**: Ruff `line-length = 79`

**Scale/Scope**: 4 nodos de proceso, 3 servicios

## Constitution Check

| Principio | Estado | Evidencia |
|---|---|---|
| I. Business YAML fuente de verdad | PASS | FR derivados de `BR-REP-008` y `BR-REP-009` |
| II. IDs estables | PASS | — |
| III. Trazabilidad E2E | PASS | [traceability.md](./traceability.md) |
| IV. Modelo de datos transversal | PASS | `ReparacionDetail` compartida con 002 y 005 |
| V. No inferir funcional desde codigo | PASS | Retrabajo declarado NO implementado |
| VI. Separacion de capas | PASS | `services/reparaciones.py` y `services/ordenes.py` sin HTTP ni JSON |
| VII. Sin sobreingenieria | PASS | `EstadoControl` con dos valores |
| VIII. Tests vinculados | PASS | — |
| IX. UAT distinto | PASS | `UAT-REP-010`, `UAT-REP-011` en `PENDING` |
| X. PEP 8 / Ruff | PASS | — |
| XI. Slice vs Feature | PASS | 4 de 6 nodos de la Feature implementados |

**Violaciones a justificar**: ninguna.

## Project Structure

### Documentation (this feature)

```text
specs/006-feat-rep-006-hp-slice/
├── spec.md
├── plan.md
├── tasks.md
└── traceability.md
```

### Source Code (repository root)

```text
app/backend/app/
├── domain/models/
│   ├── reparacion.py        # ReparacionDetail.control_* (resultado por Detalle)
│   ├── enums.py             # EstadoControl
│   └── orden_reparacion.py  # computed_field puntaje_total
└── services/
    ├── reparaciones.py      # aprobar_control_tecnico, calcular_puntaje
    └── ordenes.py           # marcar_reparacion_lista
```

**Structure Decision**: el resultado del control se almacena en el
Detalle (`control_estado`, `control_usuario_id`, `control_fecha`,
`control_observaciones`), no en la Orden. `BR-REP-008` exige granularidad
por Detalle; modelarlo a nivel Orden impediria representar el rechazo
parcial cuando se implemente.

## Data Model (artefacto transversal)

| Entidad | Archivo | Rol |
|---|---|---|
| `ReparacionDetail.control_*` | `app/backend/app/domain/models/reparacion.py` | Resultado del control por Detalle |
| `EstadoControl` | `app/backend/app/domain/models/enums.py` | `PENDIENTE`, `APROBADO` |
| `OrdenReparacion.puntaje_total` | `app/backend/app/domain/models/orden_reparacion.py` | `computed_field` derivado |
| `EstadoWorkflow.REPARACION_LISTA` | `app/backend/app/domain/models/enums.py` | Hito fijado por `PROC-REP-240` |

```text
puntaje_total = suma de detalle.puntaje
                para los Detalles con control_estado == APROBADO
```

## Technical Requirements

- **TR-REP-036**: El resultado del control tecnico se guarda **en el
  Detalle** (`control_estado`, `control_usuario_id`, `control_fecha`,
  `control_observaciones`), no en la Orden, porque `BR-REP-008` exige
  granularidad por Detalle aunque el control ocurra en un unico paso.
  → satisface `FR-REP-041`
  → `app/backend/app/domain/models/reparacion.py::ReparacionDetail`
- **TR-REP-037**: `puntaje_total` es un `@computed_field` que suma
  unicamente los Detalles con control aprobado. No se persiste
  (`exclude_computed_fields=True`) y se recalcula al reconstruir el
  modelo, de modo que nunca pueda quedar desincronizado.
  → satisface `FR-REP-043`
  → `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.puntaje_total`
- **TR-REP-038**: `aprobar_control_tecnico` valida como precondicion que
  no exista Ejecucion activa antes de aprobar nada, reutilizando
  `ejecucion_activa`.
  → satisface `FR-REP-040`
  → `app/backend/app/services/reparaciones.py::aprobar_control_tecnico`
- **TR-REP-039**: `marcar_reparacion_lista` valida que el control este
  aprobado antes de fijar el hito `REPARACION_LISTA`. El hito no es
  deducible mirando solo los Detalles: depende del evento de aprobacion
  de Recepcion, por eso es un estado de workflow explicito y no un
  derivado del resolver (`BR-REP-012`).
  → satisface `FR-REP-044`
  → `app/backend/app/services/ordenes.py::marcar_reparacion_lista`
- **TR-REP-009**: Actor `ACT-RECEP` para el control tecnico; el Tecnico
  que ejecuto no puede aprobarlo. `calcular_puntaje` y
  `marcar_reparacion_lista` son `ACT-SYSTEM` y no reciben usuario.
  → satisface `FR-REP-042`
  → `app/backend/app/services/autorizacion.py::validar_actor`
- **TR-REP-004**: Los derivados comerciales y de puntaje se excluyen de
  la persistencia y renacen al cargar.
  → satisface `FR-REP-043`
- **TR-REP-008**: Los tres services devuelven copia y no mutan la Orden
  recibida; un control rechazado por rol no aprueba nada.
  → satisface `FR-REP-041`, `FR-REP-042`
- **TR-REP-010**: `calcular_puntaje` y `marcar_reparacion_lista` son
  nodos `ACT-SYSTEM` sin parametro `usuario`.
  → satisface `FR-REP-043`, `FR-REP-044`
- **TR-REP-011**: Registro en historial de `PROC-REP-220`,
  `PROC-REP-230`, `PROC-REP-245` y `PROC-REP-240`.
  → satisface `FR-REP-041`
- **TR-REP-020**: Las precondiciones (Ejecucion activa, control no
  aprobado) se expresan como `PrecondicionInvalidaError`.
  → satisface `FR-REP-040`, `FR-REP-044`

## Dependencies

- **Depende de**: `specs/005-feat-rep-005-hp-slice/` (Detalles
  `COMPLETO`, sin Ejecucion activa, resolver en `COMPLETA`).
- **Consumido por**: `specs/007-feat-rep-007-hp-slice/` (el gate de saldo
  se evalua despues de `REPARACION_LISTA`) y
  `specs/008-feat-rep-008-hp-slice/`.
- **Externa**: Pydantic v2.

## Complexity Tracking

> Sin violaciones de la Constitution que requieran justificacion.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
