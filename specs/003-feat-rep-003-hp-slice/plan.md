# Implementation Plan: Validacion de factibilidad y habilitacion — Implemented slice: HP-REP-001

**Branch**: `mvp-traceability` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-feat-rep-003-hp-slice/spec.md`

> **Nota brownfield**: documenta la arquitectura realmente existente en
> la baseline `3788d87`.

## Summary

El slice consulta disponibilidad de insumos sin reservar y habilita la
Orden. La decision tecnica central es que **no existe entidad Reserva**:
la disponibilidad se deriva de un *ledger* de movimientos de inventario,
y la porcion "ajena" (reservas de otras Ordenes) se inyecta al calculo
como parametro (`reservas_externas`), de modo que el calculo puro siga
funcionando en memoria sin conocer repositories.

## Technical Context

**Language/Version**: Python 3.11+

**Primary Dependencies**: Pydantic v2; `decimal.Decimal` para cantidades

**Storage**: JSON local; las reservas ajenas se obtienen listando las
Ordenes persistidas

**Testing**: pytest

**Target Platform**: servicio backend local (MVP)

**Project Type**: web application (backend + frontend scaffold)

**Performance Goals**: no aplica. `cargar_reservas_externas` hace un
`listar()` completo de Ordenes: aceptable al volumen del MVP,
explicitamente no optimizado.

**Constraints**: Ruff `line-length = 79`; `services/` sin conocimiento de
persistencia en el calculo puro

**Scale/Scope**: 3 nodos de proceso, 2 servicios, 1 modulo de calculo
global

## Constitution Check

| Principio | Estado | Evidencia |
|---|---|---|
| I. Business YAML fuente de verdad | PASS | FR derivados de `BR-REP-002` |
| II. IDs estables | PASS | — |
| III. Trazabilidad E2E | PASS | [traceability.md](./traceability.md) |
| IV. Modelo de datos transversal | PASS | `MovimientoInsumo` enlazado desde FR de 003 y 005 |
| V. No inferir funcional desde codigo | PASS | Caminos de faltante declarados NO implementados |
| VI. Separacion de capas | PASS | `stock_disponible` puro; `cargar_reservas_externas` aislado en `inventario_global` |
| VII. Sin sobreingenieria | PASS | Sin entidad Reserva: el ledger alcanza |
| VIII. Tests vinculados | PASS | — |
| IX. UAT distinto | PASS | `UAT-REP-004` en `PENDING` |
| X. PEP 8 / Ruff | PASS | — |
| XI. Slice vs Feature | PASS | 3 de 7 nodos de la Feature implementados |

**Violaciones a justificar**: ninguna.

## Project Structure

### Documentation (this feature)

```text
specs/003-feat-rep-003-hp-slice/
├── spec.md
├── plan.md
├── tasks.md
└── traceability.md
```

### Source Code (repository root)

```text
app/backend/app/
├── domain/models/
│   ├── catalogos.py           # Insumo, TipoReparacionInsumos
│   └── inventario.py          # MovimientoInsumo (ledger)
├── services/
│   ├── reparaciones.py        # validar_factibilidad_detalles
│   ├── ordenes.py             # habilitar_orden
│   ├── inventario.py          # stock_disponible, reservas_activas, cantidad_pendiente
│   └── inventario_global.py   # reservas_externas_a, cargar_reservas_externas
└── repositories/
    └── catalogos.py           # listar_insumos, listar_tipo_reparacion_insumos
```

**Structure Decision**: el calculo de disponibilidad vive en
`services/inventario.py` y es **puro** (recibe insumo, movimientos y un
`Decimal` de reservas ajenas con default cero). La resolucion de las
reservas ajenas contra la persistencia vive aparte, en
`services/inventario_global.py`. Asi el nucleo de calculo no depende de
repositories, y el llamador decide si trabaja en memoria o contra disco.

## Data Model (artefacto transversal)

| Entidad | Archivo | Rol |
|---|---|---|
| `Insumo` | `app/backend/app/domain/models/catalogos.py` | Stock fisico |
| `TipoReparacionInsumos` | `app/backend/app/domain/models/catalogos.py` | Insumos previstos por Tipo |
| `MovimientoInsumo` | `app/backend/app/domain/models/inventario.py` | Ledger inmutable de inventario |

```text
disponible(insumo) = stock_fisico
                   - reservas activas propias pendientes
                   - reservas activas de otras Ordenes
```

No hay entidad `Reserva`: una reserva es un `MovimientoInsumo` de tipo
`RESERVA` que todavia no fue cerrado por un `CONSUMO` o una
`LIBERACION_RESERVA` que lo referencie.

## Technical Requirements

- **TR-REP-006**: **No existe una entidad Reserva**. Las reservas se
  representan mediante el ledger de `MovimientoInsumo`: "reserva activa"
  y "cantidad pendiente" son funciones derivadas del propio ledger
  (`reservas_activas`, `cantidad_pendiente`), no estado almacenado.
  → satisface `FR-REP-012`, `FR-REP-013`
  → `app/backend/app/services/inventario.py::reservas_activas`,
    `::cantidad_pendiente`, `::hay_reservas_activas`
- **TR-REP-007**: El stock disponible es **global**:
  `stock_fisico − reservas propias pendientes − reservas activas de las
  demas Ordenes`. La porcion ajena se calcula en
  `inventario_global.reservas_externas_a` / `cargar_reservas_externas` y
  se inyecta al calculo puro como parametro con default cero.
  → satisface `FR-REP-013`
  → `app/backend/app/services/inventario.py::stock_disponible`,
    `app/backend/app/services/inventario_global.py::reservas_externas_a`,
    `::cargar_reservas_externas`, `::reservas_activas_globales`,
    `::stock_disponible_global`
- **TR-REP-012**: Los repositories se declaran como `typing.Protocol`
  `@runtime_checkable`: el contrato (QUE) vive en `repositories/`, la
  implementacion (COMO) en `storage/json/`. `cargar_reservas_externas`
  depende del Protocol, nunca de la clase concreta.
  → satisface `FR-REP-013`
  → `app/backend/app/repositories/ordenes.py::OrdenReparacionRepository`,
    `app/backend/app/repositories/catalogos.py::CatalogosRepository`
- **TR-REP-008**: `validar_factibilidad_detalles` y `habilitar_orden` no
  mutan la Orden recibida; devuelven copia.
  → satisface `FR-REP-011`, `FR-REP-014`
- **TR-REP-026**: `validar_factibilidad_detalles` devuelve una tupla
  `(Orden, bool)`: la Orden con los pasos registrados y el resultado de
  la evaluacion. El resultado **no** se persiste como estado de la Orden,
  porque la disponibilidad cambia con el tiempo y almacenarla crearia una
  segunda fuente de verdad.
  → satisface `FR-REP-011`, `FR-REP-012`
  → `app/backend/app/services/reparaciones.py::validar_factibilidad_detalles`
- **TR-REP-027**: `habilitar_orden` valida como precondicion que la Orden
  tenga al menos un Detalle antes de fijar el hito `HABILITADA`; es un
  nodo `ACT-SYSTEM`, por lo que no recibe `usuario`.
  → satisface `FR-REP-014`, `FR-REP-015`
  → `app/backend/app/services/ordenes.py::habilitar_orden`
- **TR-REP-017**: Cantidades e importes son `Decimal` en todo el calculo
  de inventario, para que las comparaciones de stock sean exactas.
  → satisface `FR-REP-013`
- **TR-REP-002**: Las cantidades de movimiento se validan
  declarativamente con `Field(gt=0)`.
  → satisface `FR-REP-013`

## Dependencies

- **Depende de**: `specs/002-feat-rep-002-hp-slice/` (la Orden debe tener
  Detalles con Tipo definido).
- **Consumido por**: `specs/004-feat-rep-004-hp-slice/` (solo una Orden
  `HABILITADA` recibe prioridad y entra a la cola),
  `specs/005-feat-rep-005-hp-slice/` (comparte el mecanismo de
  disponibilidad, esta vez reservando de verdad).
- **Externa**: ninguna mas alla de Pydantic v2.

## Complexity Tracking

> Sin violaciones de la Constitution que requieran justificacion.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |

## Riesgos conocidos (documentados, no resueltos en el MVP)

- `cargar_reservas_externas` lee **todas** las Ordenes persistidas en
  cada consulta. Es correcto pero O(n); no hay indice ni cache.
- No hay control de concurrencia: entre la factibilidad y la reserva real
  puede aparecer una reserva ajena. El Business Process ya preve ese gap
  (`PROC-REP-186`), pero ese nodo **no esta implementado**.
