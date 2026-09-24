# Implementation Plan: Diagnostico y gestion de Detalles de Reparacion — Implemented slice: HP-REP-001

**Branch**: `mvp-traceability` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-feat-rep-002-hp-slice/spec.md`

> **Nota brownfield**: documenta la arquitectura realmente existente en
> la baseline `3788d87`. No propone implementacion futura.

## Summary

El slice registra Detalles de Reparacion sobre una Orden existente,
tomando del catalogo de Tipos de Reparacion un **snapshot** de precio,
puntaje y garantia que pasa a ser dato propio del Detalle. El importe de
la Orden no se almacena: es un `computed_field` derivado de los precios
snapshot de los Detalles, lo que hace estructuralmente imposible que
quede desincronizado.

## Technical Context

**Language/Version**: Python 3.11+

**Primary Dependencies**: Pydantic v2 (`computed_field`, `Field(ge=...)`)

**Storage**: JSON local; los derivados NO se persisten

**Testing**: pytest

**Target Platform**: servicio backend local (MVP)

**Project Type**: web application (backend + frontend scaffold)

**Performance Goals**: no aplica

**Constraints**: Ruff `line-length = 79`; `domain` sin infraestructura

**Scale/Scope**: 2 nodos de proceso, 1 servicio, 2 entidades

## Constitution Check

| Principio | Estado | Evidencia |
|---|---|---|
| I. Business YAML fuente de verdad | PASS | FR derivados de `BR-REP-001`/`BR-REP-015`, no del codigo |
| II. IDs estables | PASS | — |
| III. Trazabilidad E2E | PASS | [traceability.md](./traceability.md) |
| IV. Modelo de datos transversal | PASS | `ReparacionDetail` enlazada desde FR y TR de varios slices |
| V. No inferir funcional desde codigo | PASS | Circuito de revision tecnica declarado NO implementado |
| VI. Separacion de capas | PASS | `services/reparaciones.py` recibe el `TipoReparacion` ya resuelto |
| VII. Sin sobreingenieria | PASS | `EstadoReparacionDetail` sin estados que el slice no recorre |
| VIII. Tests vinculados | PASS | — |
| IX. UAT distinto | PASS | `UAT-REP-003` en `PENDING` |
| X. PEP 8 / Ruff | PASS | — |
| XI. Slice vs Feature | PASS | 2 de 10 nodos de la Feature implementados |

**Violaciones a justificar**: ninguna.

## Project Structure

### Documentation (this feature)

```text
specs/002-feat-rep-002-hp-slice/
├── spec.md
├── plan.md
├── tasks.md
└── traceability.md
```

### Source Code (repository root)

```text
app/backend/app/
├── domain/models/
│   ├── catalogos.py          # TipoReparacion (origen del snapshot)
│   ├── reparacion.py         # ReparacionDetail
│   ├── enums.py              # EstadoReparacionDetail, EstadoControl
│   └── orden_reparacion.py   # computed_field total
├── services/
│   └── reparaciones.py       # definir_reparacion_detail
└── repositories/
    └── catalogos.py          # obtener_tipo_reparacion (Protocol)
```

**Structure Decision**: el service recibe el `TipoReparacion` **ya
resuelto** como parametro, no un repository. Es el llamador quien decide
de donde lo obtiene. Asi `services/` no conoce la persistencia
(Constitution VI).

## Data Model (artefacto transversal)

| Entidad | Archivo | Rol |
|---|---|---|
| `ReparacionDetail` | `app/backend/app/domain/models/reparacion.py` | Unidad tecnica de trabajo; guarda el snapshot |
| `TipoReparacion` | `app/backend/app/domain/models/catalogos.py` | Catalogo; fuente del snapshot |
| `EstadoReparacionDetail` | `app/backend/app/domain/models/enums.py` | `DEFINIDO`, `EN_PROGRESO`, `COMPLETO` |
| `EstadoControl` | `app/backend/app/domain/models/enums.py` | `PENDIENTE`, `APROBADO` |
| `OrdenReparacion.total` | `app/backend/app/domain/models/orden_reparacion.py` | `computed_field` derivado |

```text
OrdenReparacion
  └── ReparacionDetail[]   (1..N)
        ├── tipo_reparacion_id  -> TipoReparacion (por ID, nunca embebido)
        ├── precio          (snapshot, Decimal >= 0)
        ├── puntaje         (snapshot, int >= 0)
        └── garantia_dias   (snapshot, int >= 0)
```

## Technical Requirements

- **TR-REP-018**: El snapshot comercial y de servicio del Detalle
  (`precio`, `puntaje`, `garantia_dias`) se **copia** del
  `TipoReparacion` en el momento de crear el Detalle. El Detalle guarda
  solo `tipo_reparacion_id`; el catalogo nunca se releé para Detalles ya
  creados.
  → satisface `FR-REP-007`, `FR-REP-009`
  → `app/backend/app/domain/models/reparacion.py::ReparacionDetail`,
    `app/backend/app/services/reparaciones.py::definir_reparacion_detail`
- **TR-REP-004**: Los campos comerciales derivados de la Orden (`total`,
  `saldo`, `estado_pago`, `puntaje_total`) se modelan como
  `@computed_field` de Pydantic v2: no se almacenan, se recalculan. Al
  persistir se excluyen con `exclude_computed_fields=True`.
  → satisface `FR-REP-009`
  → `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.total`
- **TR-REP-002**: Invariantes de campo declarativas: `precio` y
  `puntaje` con `Field(ge=0)`; un valor negativo falla al construir el
  modelo.
  → satisface `FR-REP-010`
- **TR-REP-008**: `definir_reparacion_detail` no muta la Orden recibida:
  devuelve una copia nueva con el Detalle agregado.
  → satisface `FR-REP-006`
- **TR-REP-009**: Validacion de actor `ACT-RECEP` antes de cualquier
  efecto.
  → satisface `FR-REP-008`
- **TR-REP-011**: `PROC-REP-045` se registra en el historial **una sola
  vez**, al definir el primer Detalle; `PROC-REP-070` se registra en cada
  definicion.
  → satisface `FR-REP-006`
- **TR-REP-017**: Los importes son `Decimal` en todo el flujo, incluida
  la serializacion JSON, de modo que el round-trip no introduzca error de
  punto flotante.
  → satisface `FR-REP-007`, `FR-REP-009`
- **TR-REP-019**: Los enums del dominio cubren **solo** los valores que
  `HP-REP-001` recorre. `EstadoReparacionDetail` no incluye `CANCELADO`
  ni condiciones de bloqueo (`REQUIERE_DEFINICION`,
  `BLOQUEADO_POR_RECURSOS`), porque el slice no los alcanza. Esta es una
  decision deliberada de alcance, no una omision.
  → satisface `FR-REP-006`
  → `app/backend/app/domain/models/enums.py::EstadoReparacionDetail`
- **TR-REP-025**: La reserva de insumos NO es un estado del Detalle ni la
  aprobacion de control tampoco: la primera vive en el ledger de
  movimientos y la segunda en `ReparacionDetail.control_estado`. El
  estado tecnico del Detalle solo expresa el avance del trabajo.
  → satisface `FR-REP-006`
  → `app/backend/app/domain/models/enums.py::EstadoReparacionDetail`

## Dependencies

- **Depende de**: `specs/001-feat-rep-001-hp-slice/` (Orden creada).
- **Consumido por**: `specs/003-feat-rep-003-hp-slice/` (factibilidad
  necesita Detalles), `specs/007-feat-rep-007-hp-slice/` (el precio
  snapshot alimenta el Total Cobrable — `PROC-REP-070` es nodo compartido
  entre `FEAT-REP-002` y `FEAT-REP-007`).
- **Externa**: Pydantic v2.

## Complexity Tracking

> Sin violaciones de la Constitution que requieran justificacion.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
