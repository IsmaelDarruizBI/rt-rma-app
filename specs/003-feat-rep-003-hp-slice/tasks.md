---
description: "Tareas reconstruidas del slice HP-REP-001 de FEAT-REP-003"
---

# Tasks: Validacion de factibilidad y habilitacion — Implemented slice: HP-REP-001

**Input**: Design documents from `/specs/003-feat-rep-003-hp-slice/`

**Prerequisites**: `spec.md`, `plan.md`, y el slice de `FEAT-REP-002`

> **Reconstruccion brownfield.** `[x]` solo con evidencia real de codigo
> **Y** test. **No ejecutar `/speckit.implement`.**

## Phase 1: Foundational

- [x] **TASK-REP-033** [P] Modelar `Insumo` (con stock fisico) y
      `TipoReparacionInsumos` (insumos previstos por Tipo).
      → `app/backend/app/domain/models/catalogos.py::Insumo`,
        `::TipoReparacionInsumos`
      → test: `tests/test_repositories_json.py::test_los_modelos_de_catalogo_se_reconstruyen_completos`
- [x] **TASK-REP-034** [P] Modelar `MovimientoInsumo` como ledger
      inmutable, sin entidad Reserva separada.
      → `app/backend/app/domain/models/inventario.py::MovimientoInsumo`
      → test: `tests/test_modelos_dominio.py::test_movimiento_es_inmutable`
- [x] **TASK-REP-035** Implementar las funciones derivadas del ledger:
      `reservas_activas`, `cantidad_pendiente`, `hay_reservas_activas`.
      → `app/backend/app/services/inventario.py`
      → test: `tests/test_inventario_global.py::test_caso_a_dos_ordenes_factibles_no_reservan_nada`
- [x] **TASK-REP-036** Implementar `stock_disponible` como calculo puro
      con `reservas_externas` inyectable (default cero).
      → `app/backend/app/services/inventario.py::stock_disponible`
      → test: `tests/test_inventario_global.py::test_sin_ordenes_el_disponible_es_el_stock_fisico`
- [x] **TASK-REP-037** Implementar el modulo de inventario global:
      `reservas_activas_globales`, `cantidad_reservada_global`,
      `stock_disponible_global`, `reservas_externas_a`,
      `cargar_reservas_externas`, `stock_disponible_por_insumo`.
      → `app/backend/app/services/inventario_global.py`
      → test: `tests/test_inventario_global.py::test_cargar_reservas_externas_lee_del_repository`,
        `::test_las_reservas_de_varias_ordenes_se_suman`
- [x] **TASK-REP-038** [P] Declarar los contratos de repository como
      `Protocol` `@runtime_checkable` y verificar que las
      implementaciones JSON los cumplen.
      → `app/backend/app/repositories/ordenes.py::OrdenReparacionRepository`,
        `app/backend/app/repositories/catalogos.py::CatalogosRepository`
      → test: `tests/test_repositories_json.py::test_las_implementaciones_cumplen_los_contratos`

## Phase 2: User Story `US-REP-004` — Saber si hay insumos antes de poner la Orden a trabajar (P1) — MVP

**Goal**: no habilitar trabajo que no se puede hacer.

**Independent Test**: tramo 3 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`
y los casos A/B de `tests/test_inventario_global.py`.

- [x] **TASK-REP-039** [US-REP-004] Implementar
      `validar_factibilidad_detalles` cubriendo `PROC-REP-080` →
      `PROC-REP-090` (rama `Si`), consultando disponibilidad **sin**
      reservar y devolviendo `(Orden, bool)`.
      → `app/backend/app/services/reparaciones.py::validar_factibilidad_detalles`
      → test: `tests/test_inventario_global.py::test_caso_a_dos_ordenes_factibles_no_reservan_nada`,
        `::test_caso_b_la_factibilidad_ajena_ya_refleja_el_faltante`
- [x] **TASK-REP-040** [US-REP-004] Garantizar que la factibilidad no
      genera movimientos ni toca el stock fisico.
      → test: `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`
        (asserts de `movimientos_insumo == []` y `stock_fisico == 2`)
- [x] **TASK-REP-041** [US-REP-004] Garantizar que una Orden no cuenta
      sus propias reservas como ajenas.
      → `app/backend/app/services/inventario_global.py::reservas_externas_a`
      → test: `tests/test_inventario_global.py::test_una_orden_no_se_cuenta_sus_propias_reservas_como_ajenas`
- [x] **TASK-REP-042** [US-REP-004] Implementar `habilitar_orden`
      (`PROC-REP-140`) como nodo `ACT-SYSTEM`, con precondicion de al
      menos un Detalle.
      → `app/backend/app/services/ordenes.py::habilitar_orden`
      → test: `tests/test_services_invariantes.py::test_no_se_habilita_una_orden_sin_detalles`,
        `::test_habilitar_orden_no_muta_la_orden_recibida`

**Checkpoint**: `US-REP-004` entregable de forma independiente.

---

## Phase 3: Fuera del slice — NO implementado

Corresponden a `FEAT-REP-003` completa. Sin codigo ni test.

- [ ] **TASK-REP-043** Implementar la rama `No` de `PROC-REP-090` y el
      agregado `PENDIENTE_RECURSOS`.
- [ ] **TASK-REP-044** Implementar `PROC-REP-100` (registrar advertencia
      de faltante, identificando el Detalle especifico afectado).
- [ ] **TASK-REP-045** Implementar `PROC-REP-110` + `PROC-REP-130`
      (override justificado de Detalle bloqueado, `BR-REP-003`), con
      registro de usuario, fecha, Detalle, validacion ignorada y motivo.
- [ ] **TASK-REP-046** Implementar `PROC-REP-120` y su circuito de
      espera/revalidacion por disponibilidad de insumos.
- [ ] **TASK-REP-047** Modelar la condicion de bloqueo del Detalle
      (`SIN_BLOQUEO` / `REQUIERE_DEFINICION` / `BLOQUEADO_POR_RECURSOS`)
      como dimension separada del estado tecnico (`BR-REP-012`).
- [ ] **TASK-REP-048** Ejercitar una Orden con varios Detalles donde solo
      algunos son factibles (`BR-REP-002`: basta uno trabajable).
- [ ] **TASK-REP-049** Resolver la concurrencia entre factibilidad y
      reserva real (control transaccional o de bloqueo). Hoy el MVP no
      implementa ninguno.

---

## Dependencies & Execution Order

```text
(FEAT-REP-002: Orden con Detalles)
  └── TASK-REP-033, TASK-REP-034, TASK-REP-038   (paralelizables)
        └── TASK-REP-035 → TASK-REP-036 → TASK-REP-037
              └── TASK-REP-039 → TASK-REP-040 → TASK-REP-041
                    └── TASK-REP-042
```

## Estado real de implementacion

| Fase | Tareas | `[x]` con evidencia codigo+test | `[ ]` |
|---|---|---|---|
| Foundational | 6 | 6 | 0 |
| `US-REP-004` | 4 | 4 | 0 |
| Fuera del slice | 7 | 0 | 7 |
| **Total** | **17** | **10** | **7** |
