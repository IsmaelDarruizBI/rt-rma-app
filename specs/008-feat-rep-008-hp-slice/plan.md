# Implementation Plan: Finalizacion, entrega e integracion del resultado — Implemented slice: HP-REP-001

**Branch**: `mvp-traceability` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-feat-rep-008-hp-slice/spec.md`

> **Nota brownfield**: documenta la arquitectura realmente existente en
> la baseline `3788d87`.

## Summary

El slice cierra el circuito: notifica al cliente, emite el comprobante
final y la garantia, y entrega el equipo. La decision tecnica mas
relevante es que **`entregar_equipo` concentra cuatro precondiciones
acumulativas** —saldo cero, comprobante final, garantia y ausencia de
reservas activas— convirtiendose en el guardian final de la consistencia
de la Orden. Ninguna de ellas admite override.

## Technical Context

**Language/Version**: Python 3.11+

**Primary Dependencies**: Pydantic v2

**Storage**: JSON local

**Testing**: pytest

**Target Platform**: servicio backend local (MVP)

**Project Type**: web application (backend + frontend scaffold)

**Performance Goals**: no aplica

**Constraints**: Ruff `line-length = 79`

**Scale/Scope**: 4 nodos de proceso + 1 evento final, 3 servicios

## Constitution Check

| Principio | Estado | Evidencia |
|---|---|---|
| I. Business YAML fuente de verdad | PASS | Las precondiciones derivan de `PROC-REP-270`/`280` y `BR-REP-017-B` |
| II. IDs estables | PASS | `EVT-REP-999` se usa como posicion, no se renombra |
| III. Trazabilidad E2E | PASS | [traceability.md](./traceability.md) |
| IV. Modelo de datos transversal | PASS | `DocumentosOrden` compartida con 001 |
| V. No inferir funcional desde codigo | PASS | `PROC-REP-290` y `SIN_REPARACION` declarados NO implementados |
| VI. Separacion de capas | PASS | `services/ordenes.py` y `services/documentos.py` sin HTTP ni JSON |
| VII. Sin sobreingenieria | PASS | Documentos como hecho registrado, sin motor de plantillas |
| VIII. Tests vinculados | PASS | — |
| IX. UAT distinto | PASS | `UAT-REP-015`, `UAT-REP-016` en `PENDING` |
| X. PEP 8 / Ruff | PASS | — |
| XI. Slice vs Feature | PASS | 4 de 5 nodos de la Feature implementados |

**Violaciones a justificar**: ninguna.

## Project Structure

### Documentation (this feature)

```text
specs/008-feat-rep-008-hp-slice/
├── spec.md
├── plan.md
├── tasks.md
└── traceability.md
```

### Source Code (repository root)

```text
app/backend/app/
├── domain/models/
│   ├── documentos.py        # Documento, DocumentosOrden
│   └── enums.py             # EstadoWorkflow.ENTREGADA
└── services/
    ├── ordenes.py           # notificar_cliente (250/260), entregar_equipo (270)
    ├── documentos.py        # generar_comprobante_final (280)
    └── inventario.py        # hay_reservas_activas (precondicion de entrega)
```

**Structure Decision**: `entregar_equipo` reutiliza
`inventario.hay_reservas_activas` en vez de introducir un flag propio de
"inventario conciliado". La consistencia se verifica contra el ledger,
que es la fuente de verdad.

## Data Model (artefacto transversal)

| Entidad | Archivo | Rol |
|---|---|---|
| `Documento` | `app/backend/app/domain/models/documentos.py` | Hecho "generado + fecha" |
| `DocumentosOrden` | `app/backend/app/domain/models/documentos.py` | Comprobantes de recepcion/final y garantia |
| `EstadoWorkflow.ENTREGADA` | `app/backend/app/domain/models/enums.py` | Hito final |
| `OrdenReparacion.current_process` | `app/backend/app/domain/models/orden_reparacion.py` | Queda en `EVT-REP-999` |

## Technical Requirements

- **TR-REP-047**: `entregar_equipo` concentra **cuatro precondiciones
  acumulativas** verificadas antes de cualquier efecto: saldo cero,
  comprobante final generado, garantia de reparacion generada y ninguna
  reserva de inventario activa. Ninguna admite override.
  → satisface `FR-REP-058`
  → `app/backend/app/services/ordenes.py::entregar_equipo`
- **TR-REP-048**: La ausencia de reservas activas se verifica contra el
  **ledger** (`inventario.hay_reservas_activas`), no contra un flag de
  estado. La fuente de verdad de la conciliacion de inventario sigue
  siendo el propio ledger.
  → satisface `FR-REP-058`
  → `app/backend/app/services/inventario.py::hay_reservas_activas`
- **TR-REP-049**: El evento final `EVT-REP-999` se fija como
  `current_process` de la Orden pero **no** se agrega como paso del
  historial: es un evento de fin, no una actividad ejecutada.
  → satisface `FR-REP-060`
  → `app/backend/app/services/ordenes.py::entregar_equipo`
- **TR-REP-050**: Los documentos se modelan como hecho registrado
  (`generado` + `fecha`), sin motor de plantillas ni renderizado. El
  contenido desglosado se deriva de la propia Orden cuando haga falta
  materializarlo.
  → satisface `FR-REP-057`
  → `app/backend/app/domain/models/documentos.py::Documento`,
    `::DocumentosOrden`
- **TR-REP-046**: `generar_comprobante_final` exige que la condicion de
  entrega ya este cumplida (`PROC-REP-280` despues de `PROC-REP-265`) y
  emite comprobante final **y** garantia, porque en el alcance del MVP
  siempre hubo reparacion (`SIN_REPARACION` no implementado).
  → satisface `FR-REP-057`
  → `app/backend/app/services/documentos.py::generar_comprobante_final`
- **TR-REP-009 / TR-REP-051**: Actor `ACT-RECEP` para notificar;
  `ACT-ADMIN` o `ACT-RECEP` (`actores_alternativos` de
  PROC-REP-270) para
  entregar.
  → satisface `FR-REP-056`, `FR-REP-059`
- **TR-REP-010**: `generar_comprobante_final` es `ACT-SYSTEM` y no recibe
  `usuario`. `notificar_cliente` cubre `PROC-REP-250` (decision sin
  actor) y `PROC-REP-260` (`ACT-RECEP`) en una sola operacion.
  → satisface `FR-REP-055`, `FR-REP-057`
- **TR-REP-008**: Los tres services devuelven copia y no mutan la Orden
  recibida.
  → satisface `FR-REP-055`, `FR-REP-060`
- **TR-REP-011**: Registro en historial de `PROC-REP-250`,
  `PROC-REP-260`, `PROC-REP-280` y `PROC-REP-270`.
  → satisface `FR-REP-055`, `FR-REP-060`
- **TR-REP-020**: Cada precondicion incumplida lanza
  `PrecondicionInvalidaError` con un mensaje que identifica cual fallo.
  → satisface `FR-REP-058`
- **TR-REP-013**: La Orden entregada se persiste con escritura atomica, y
  el archivo resultante vuelve a validarse contra el modelo sin perdida.
  → satisface `FR-REP-060`
  → `app/backend/app/storage/json/base.py::escribir_json_atomico`
- **TR-REP-014**: Una Orden por archivo `<orden_id>.json`; `guardar` es
  idempotente respecto del ID, de modo que reescribir la Orden final no
  duplica archivos.
  → satisface `FR-REP-060`
  → `app/backend/app/storage/json/ordenes.py::JsonOrdenReparacionRepository`

## Dependencies

- **Depende de**: `specs/006-feat-rep-006-hp-slice/`
  (`REPARACION_LISTA`), `specs/007-feat-rep-007-hp-slice/` (condicion de
  entrega) y `specs/005-feat-rep-005-hp-slice/` (ledger sin reservas
  activas).
- **Nodos compartidos**: `PROC-REP-280` con `FEAT-REP-007`.
- **Consumido por**: ninguno; es el cierre del flujo.
- **Externa**: Pydantic v2.

## Complexity Tracking

> Sin violaciones de la Constitution que requieran justificacion.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
