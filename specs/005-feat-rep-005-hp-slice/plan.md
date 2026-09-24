# Implementation Plan: Ejecucion de Detalles y gestion de insumos — Implemented slice: HP-REP-001

**Branch**: `mvp-traceability` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-feat-rep-005-hp-slice/spec.md`

> **Nota brownfield**: documenta la arquitectura realmente existente en
> la baseline `3788d87`.

## Summary

El slice ejecuta un Detalle: lo selecciona, revalida la Estacion, reserva
sus insumos, abre la Ejecucion, registra el trabajo real y aplica el
inventario. Es el nucleo tecnico del MVP y concentra las decisiones
arquitectonicas mas fuertes: **ledger inmutable de inventario**,
**idempotencia deducida del propio ledger** (sin flag persistido) y
**resolver centralizado de estado de Orden** con fail-safe explicito.

Existe una separacion deliberada en dos niveles para `PROC-REP-210`:

- `inventario.generar_movimientos_inventario` — calculo puro sobre la
  Orden, sin persistencia.
- `inventario_global.aplicar_movimientos_inventario` — orquesta el
  calculo, la validacion de stock, el guardado de la Orden y la
  actualizacion del catalogo.

## Technical Context

**Language/Version**: Python 3.11+

**Primary Dependencies**: Pydantic v2 (`ConfigDict(frozen=True)`),
`decimal.Decimal`

**Storage**: JSON local; la Orden y el catalogo de insumos se escriben
por separado

**Testing**: pytest

**Target Platform**: servicio backend local (MVP)

**Project Type**: web application (backend + frontend scaffold)

**Performance Goals**: no aplica

**Constraints**: Ruff `line-length = 79`; sin transacciones distribuidas

**Scale/Scope**: 7 nodos de proceso, ~12 funciones de servicio

## Constitution Check

| Principio | Estado | Evidencia |
|---|---|---|
| I. Business YAML fuente de verdad | PASS | FR derivados de `BR-REP-004/005/006/007/011-B/012/018` |
| II. IDs estables | PASS | — |
| III. Trazabilidad E2E | PASS | [traceability.md](./traceability.md) |
| IV. Modelo de datos transversal | PASS | `MovimientoInsumo` compartido con 003 |
| V. No inferir funcional desde codigo | PASS | Caminos de interrupcion/override/reserva fallida declarados NO implementados |
| VI. Separacion de capas | PASS | Calculo puro separado de la orquestacion con repositories |
| VII. Sin sobreingenieria | PASS | Sin entidad Reserva; sin flag de idempotencia |
| VIII. Tests vinculados | PASS | — |
| IX. UAT distinto | PASS | `UAT-REP-007`..`UAT-REP-009` en `PENDING` |
| X. PEP 8 / Ruff | PASS | — |
| XI. Slice vs Feature | PASS | 7 de 11 nodos, y varios solo en su rama exitosa |

**Violaciones a justificar**: ninguna. Ver "Riesgos conocidos".

## Project Structure

### Documentation (this feature)

```text
specs/005-feat-rep-005-hp-slice/
├── spec.md
├── plan.md
├── tasks.md
└── traceability.md
```

### Source Code (repository root)

```text
app/backend/app/
├── domain/models/
│   ├── inventario.py        # InsumoUtilizado, MovimientoInsumo (frozen)
│   ├── reparacion.py        # EjecucionReparacion
│   └── enums.py             # TipoMovimientoInsumo, EstadoEjecucion
└── services/
    ├── tomas.py             # seleccionar_detalle, validar_compatibilidad_detalle
    ├── ejecuciones.py       # reservar_insumos_e_iniciar_ejecucion,
    │                        # ejecutar_detalle, registrar_ejecucion_completada
    ├── inventario.py        # crear_reserva, generar_movimientos_inventario,
    │                        # inventario_aplicado, stock_disponible
    ├── inventario_global.py # aplicar_movimientos_inventario
    └── ordenes.py           # evaluar_situacion_orden, ResultadoEvaluacionOrden
```

**Structure Decision**: `PROC-REP-210` se implementa en dos capas. El
calculo puro vive en `services/inventario.py` y no conoce persistencia;
la orquestacion con repositories vive en `services/inventario_global.py`.
Asi el nucleo se puede testear en memoria y la variante persistida
reutiliza exactamente la misma logica.

## Data Model (artefacto transversal)

| Entidad | Archivo | Rol |
|---|---|---|
| `EjecucionReparacion` | `app/backend/app/domain/models/reparacion.py` | Trabajo concreto sobre un Detalle |
| `InsumoUtilizado` | `app/backend/app/domain/models/inventario.py` | Lo realmente usado |
| `MovimientoInsumo` | `app/backend/app/domain/models/inventario.py` | Asiento inmutable del ledger |
| `TipoMovimientoInsumo` | `app/backend/app/domain/models/enums.py` | `RESERVA`, `CONSUMO`, `LIBERACION_RESERVA`, `DEVOLUCION` (ver divergencia abajo) |
| `EstadoEjecucion` | `app/backend/app/domain/models/enums.py` | `EN_PROGRESO`, `COMPLETADO` |
| `ResultadoEvaluacionOrden` | `app/backend/app/services/ordenes.py` | Resultado del resolver que el MVP sabe calcular |

### Divergencia: catalogo de tipos de movimiento

`TipoMovimientoInsumo.DEVOLUCION` fue incorporado durante el modelado
tecnico inicial, pero no esta respaldado por PROC-REP V1.3. En sentido
inverso, `PROC-REP-210` y `BR-REP-005` contemplan `DESPERDICIO`,
actualmente ausente del enum.

La divergencia debe reconciliarse (TASK-REP-089). El comportamiento de
desperdicio sigue fuera del slice implementado por HP-REP-001, que solo
recorre `RESERVA`, `CONSUMO` y `LIBERACION_RESERVA`.

Siguiendo el Principio V de la constitution, el requerimiento NO se
reescribe para que coincida con el codigo: la divergencia se reporta y
la decision es de negocio.

Ledger de inventario:

```text
MOV-001 RESERVA (detalle, cantidad prevista)
   ├── MOV-002 CONSUMO            (movimiento_origen_id = MOV-001)
   └── MOV-003 LIBERACION_RESERVA (movimiento_origen_id = MOV-001)
```

La `RESERVA` **nunca** se modifica ni se elimina. Ambos registros se
conservan. Trazabilidad: `Orden -> Detalle -> Insumo -> Movimiento`.

## Technical Requirements

- **TR-REP-005**: `MovimientoInsumo` es **inmutable**
  (`ConfigDict(frozen=True)`). Consumir o liberar no modifica la reserva:
  se crea un movimiento nuevo que la referencia por
  `movimiento_origen_id`.
  → satisface `FR-REP-032`, `FR-REP-036`
  → `app/backend/app/domain/models/inventario.py::MovimientoInsumo`
- **TR-REP-015**: `PROC-REP-210` es **idempotente** y lo deduce del
  propio ledger: `inventario_aplicado()` comprueba si existe algun
  movimiento resolutivo (`CONSUMO` o `LIBERACION_RESERVA`) trazado a esa
  Ejecucion. **No hay flag persistido**. Un reintento de la futura API es
  seguro.
  → satisface `FR-REP-035`
  → `app/backend/app/services/inventario.py::inventario_aplicado`,
    `app/backend/app/services/inventario_global.py::aplicar_movimientos_inventario`
- **TR-REP-016**: `aplicar_movimientos_inventario` **valida todo antes de
  escribir nada**: calcula los stocks resultantes y falla si alguno
  quedaria negativo. Solo el `CONSUMO` descuenta `stock_fisico`; la
  `LIBERACION_RESERVA` cierra la reserva sin tocarlo.
  → satisface `FR-REP-033`, `FR-REP-034`
  → `app/backend/app/services/inventario_global.py::aplicar_movimientos_inventario`,
    `::_consumos_de_la_ejecucion`
- **TR-REP-032**: `generar_movimientos_inventario` compara lo
  efectivamente utilizado contra las reservas pendientes del Detalle:
  igual → `CONSUMO`; menor → `CONSUMO` (si > 0) + `LIBERACION_RESERVA`
  por la diferencia; mayor → error de dominio.
  → satisface `FR-REP-032`, `FR-REP-033`
  → `app/backend/app/services/inventario.py::generar_movimientos_inventario`,
    `::_cantidad_utilizada`
- **TR-REP-033**: La reserva se crea como movimiento `RESERVA` sin
  `usuario_id` (nodo `ACT-SYSTEM`) y sin tocar el stock fisico. La
  operacion es **todo-o-nada**: si algun insumo no alcanza, no se
  registra ningun movimiento parcial.
  → satisface `FR-REP-027`, `FR-REP-028`, `FR-REP-039`
  → `app/backend/app/services/inventario.py::crear_reserva`,
    `app/backend/app/services/ejecuciones.py::reservar_insumos_e_iniciar_ejecucion`
- **TR-REP-034**: La identidad del ejecutor se valida en cada operacion
  sobre la Ejecucion activa: debe ser el tecnico titular y la Ejecucion
  debe pertenecer a la toma activa. Un fallo de identidad no muta la
  Orden.
  → satisface `FR-REP-030`
  → `app/backend/app/services/ejecuciones.py::_validar_propiedad_de_la_ejecucion`
- **TR-REP-022**: `evaluar_situacion_orden` implementa **solo el
  subconjunto** de la politica de `BR-REP-012` que `HP-REP-001` recorre
  (todos los Detalles terminales con al menos uno `COMPLETO`) y **falla
  explicitamente** fuera de ese caso, en vez de inventar un resultado.
  Es el fail-safe del resolver.
  → satisface `FR-REP-037`
  → `app/backend/app/services/ordenes.py::evaluar_situacion_orden`,
    `::ResultadoEvaluacionOrden`
- **TR-REP-035**: El cierre de la toma activa lo ejecuta el propio
  resolver cuando determina que no queda Detalle trabajable: no es una
  accion separada del tecnico.
  → satisface `FR-REP-038`
  → `app/backend/app/services/ordenes.py::evaluar_situacion_orden`
- **TR-REP-028**: `hay_ejecucion_activa` / `ejecucion_activa` implementan
  `BR-REP-007` como invariante independiente de `BR-REP-018`.
  → satisface `FR-REP-029`
  → `app/backend/app/services/ejecuciones.py::ejecucion_activa`,
    `app/backend/app/services/tomas.py::hay_ejecucion_activa`
- **TR-REP-031**: `validar_compatibilidad_detalle` reutiliza
  `estacion_habilitada_para`, el mismo helper que la validacion agregada
  de `PROC-REP-172`.
  → satisface `FR-REP-026`
  → `app/backend/app/services/tomas.py::validar_compatibilidad_detalle`
- **TR-REP-002**: `InsumoUtilizado.cantidad` y `MovimientoInsumo.cantidad`
  se declaran `Field(gt=0)`.
  → satisface `FR-REP-031`, `FR-REP-032`
- **TR-REP-008**: Todos los services del slice devuelven copia y no mutan
  la Orden recibida, incluida la variante persistida.
  → satisface `FR-REP-027`, `FR-REP-031`, `FR-REP-032`
- **TR-REP-009**: Actor `ACT-TECH` para seleccionar, ejecutar y registrar;
  `ACT-SYSTEM` (sin usuario) para reservar y aplicar inventario.
  → satisface `FR-REP-025`, `FR-REP-030`, `FR-REP-039`
- **TR-REP-011**: Registro en historial de `PROC-REP-181`, `174`, `185`,
  `190`, `200`, `210` y `211`.
  → satisface `FR-REP-037`

## Dependencies

- **Depende de**: `specs/004-feat-rep-004-hp-slice/` (toma activa) y
  `specs/003-feat-rep-003-hp-slice/` (mecanismo de disponibilidad).
- **Consumido por**: `specs/006-feat-rep-006-hp-slice/` (el control
  tecnico exige Detalles terminales y sin Ejecucion activa),
  `specs/008-feat-rep-008-hp-slice/` (la entrega exige que no queden
  reservas activas).
- **Externa**: Pydantic v2 (`frozen`), `decimal`.

## Complexity Tracking

> Sin violaciones de la Constitution que requieran justificacion.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |

## Riesgos conocidos (documentados en el codigo, no resueltos en el MVP)

- **Sin transacciones distribuidas**: si la actualizacion del catalogo
  fallara despues de guardar la Orden, la Orden quedaria con el consumo
  registrado y el catalogo sin actualizar. La validacion previa de stock
  hace improbable ese caso, y el orden elegido preserva primero la
  historia de la Orden, que es la fuente de verdad.
- **Borde de idempotencia**: una Ejecucion sin insumos previstos no
  genera movimiento alguno, por lo que nunca se la detecta como aplicada.
  Reaplicarla no produce movimientos ni toca el stock; solo vuelve a
  registrar el paso.
