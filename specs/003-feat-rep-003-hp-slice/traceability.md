# Traceability: FEAT-REP-003 — Implemented slice HP-REP-001

Vista narrativa. La fuente machine-readable es
`traceability/hp-rep-001.yaml` (items + links).

## Cobertura

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |
| Nodos de la Feature | 7 |
| Nodos dentro del slice | 3 (`080`, `090` rama `Si`, `140`) |
| Nodos fuera del slice | 4 (`100`, `110`, `120`, `130`) |

## User Story -> System Action

| US | Titulo | ACC | Nodos |
|---|---|---|---|
| `US-REP-004` | Saber si hay insumos antes de poner la Orden a trabajar | `ACC-REP-005` | `PROC-REP-080`, `PROC-REP-090` |
| `US-REP-004` | — | `ACC-REP-006` | `PROC-REP-140` |

### System Actions

- **`ACC-REP-005`** — Consultar, sin reservar, la disponibilidad de los
  insumos previstos de cada Detalle y determinar si existe al menos un
  Detalle trabajable. Agrupa `PROC-REP-080` (calculo) y `PROC-REP-090`
  (decision agregada) porque son una misma responsabilidad: evaluar
  factibilidad. Reglas: `BR-REP-001`, `BR-REP-002`.
- **`ACC-REP-006`** — Habilitar la Orden fijando el hito `HABILITADA`.
  Nodo `PROC-REP-140`. Se separa de `ACC-REP-005` porque es un cambio de
  estado con precondicion propia, no parte del calculo.

## System Action -> Functional Requirement

| ACC | FR |
|---|---|
| `ACC-REP-005` | `FR-REP-011`, `FR-REP-012`, `FR-REP-013` |
| `ACC-REP-006` | `FR-REP-014`, `FR-REP-015` |

## Functional Requirement -> Technical Requirement

| FR | TR |
|---|---|
| `FR-REP-011` | `TR-REP-008`, `TR-REP-026` |
| `FR-REP-012` | `TR-REP-006`, `TR-REP-026` |
| `FR-REP-013` | `TR-REP-006`, `TR-REP-007`, `TR-REP-012`, `TR-REP-017`, `TR-REP-002` |
| `FR-REP-014` | `TR-REP-008`, `TR-REP-027` |
| `FR-REP-015` | `TR-REP-027` |

## Technical Requirement -> Task -> Code

| TR | TASK | CODE (archivo::simbolo) |
|---|---|---|
| `TR-REP-006` | `TASK-REP-034`, `TASK-REP-035` | `app/backend/app/services/inventario.py::reservas_activas`, `::cantidad_pendiente`, `::hay_reservas_activas`, `app/backend/app/domain/models/inventario.py::MovimientoInsumo` |
| `TR-REP-007` | `TASK-REP-036`, `TASK-REP-037`, `TASK-REP-041` | `app/backend/app/services/inventario.py::stock_disponible`, `app/backend/app/services/inventario_global.py::reservas_activas_globales`, `::cantidad_reservada_global`, `::stock_disponible_global`, `::reservas_externas_a`, `::cargar_reservas_externas`, `::stock_disponible_por_insumo` |
| `TR-REP-012` | `TASK-REP-038` | `app/backend/app/repositories/ordenes.py::OrdenReparacionRepository`, `app/backend/app/repositories/catalogos.py::CatalogosRepository` |
| `TR-REP-026` | `TASK-REP-039`, `TASK-REP-040` | `app/backend/app/services/reparaciones.py::validar_factibilidad_detalles`, `app/backend/app/services/inventario.py::insumos_previstos_de`, `::buscar_insumo` |
| `TR-REP-027` | `TASK-REP-042` | `app/backend/app/services/ordenes.py::habilitar_orden` |
| `TR-REP-002` | `TASK-REP-033`, `TASK-REP-034` | `app/backend/app/domain/models/catalogos.py::Insumo`, `::TipoReparacionInsumos` |
| `TR-REP-008` | `TASK-REP-039`, `TASK-REP-042` | `app/backend/app/services/reparaciones.py::validar_factibilidad_detalles` |
| `TR-REP-017` | `TASK-REP-036` | `app/backend/app/services/inventario.py::stock_disponible` |

## Internal Tests (existentes, no duplicados)

| TEST (archivo::funcion) | Verifica |
|---|---|
| `tests/test_inventario_global.py::test_caso_a_dos_ordenes_factibles_no_reservan_nada` | `FR-REP-012`, `TR-REP-026` |
| `tests/test_inventario_global.py::test_caso_b_una_reserva_deja_el_stock_en_cero` | `FR-REP-013`, `TR-REP-007` |
| `tests/test_inventario_global.py::test_caso_b_la_segunda_orden_no_puede_reservar` | `FR-REP-013`, `TR-REP-007` |
| `tests/test_inventario_global.py::test_caso_b_la_factibilidad_ajena_ya_refleja_el_faltante` | `FR-REP-013`, `TR-REP-007` |
| `tests/test_inventario_global.py::test_una_orden_no_se_cuenta_sus_propias_reservas_como_ajenas` | `FR-REP-013`, `TR-REP-007` |
| `tests/test_inventario_global.py::test_cargar_reservas_externas_lee_del_repository` | `FR-REP-013`, `TR-REP-012` |
| `tests/test_inventario_global.py::test_stock_disponible_por_insumo_resume_el_catalogo` | `FR-REP-013`, `TR-REP-007` |
| `tests/test_inventario_global.py::test_sin_ordenes_el_disponible_es_el_stock_fisico` | `FR-REP-013`, `TR-REP-006` |
| `tests/test_inventario_global.py::test_las_reservas_de_varias_ordenes_se_suman` | `FR-REP-013`, `TR-REP-007` |
| `tests/test_inventario_global.py::test_inventario_aplicado_reconoce_el_estado_del_ledger` | `TR-REP-006` |
| `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end` | `FR-REP-011`, `FR-REP-012`, `FR-REP-014` |
| `tests/test_services_invariantes.py::test_no_se_habilita_una_orden_sin_detalles` | `FR-REP-015`, `TR-REP-027` |
| `tests/test_services_invariantes.py::test_habilitar_orden_no_muta_la_orden_recibida` | `TR-REP-008` |
| `tests/test_services_invariantes.py::test_una_cadena_de_services_deja_intactos_los_estados_previos` | `TR-REP-008` |
| `tests/test_modelos_dominio.py::test_cantidad_de_insumo_no_positiva_es_rechazada` | `TR-REP-002` |
| `tests/test_modelos_dominio.py::test_cantidad_de_insumo_positiva_es_aceptada` | `TR-REP-002` |
| `tests/test_modelos_dominio.py::test_cantidad_de_movimiento_debe_ser_mayor_a_cero` | `TR-REP-002` |
| `tests/test_repositories_json.py::test_las_implementaciones_cumplen_los_contratos` | `TR-REP-012` |
| `tests/test_repositories_json.py::test_los_modelos_de_catalogo_se_reconstruyen_completos` | `TR-REP-002` |
| `tests/test_repositories_json.py::test_los_catalogos_demo_del_repositorio_son_validos` | `TR-REP-012` |

## UAT (todos `PENDING`)

| UAT | Valida | Estado |
|---|---|---|
| `UAT-REP-004` | `US-REP-004`, `FR-REP-011`, `FR-REP-012`, `FR-REP-013`, `FR-REP-014` | `PENDING` |
