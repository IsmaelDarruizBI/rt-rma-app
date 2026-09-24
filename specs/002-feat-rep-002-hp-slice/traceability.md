# Traceability: FEAT-REP-002 — Implemented slice HP-REP-001

Vista narrativa. La fuente machine-readable es
`traceability/hp-rep-001.yaml` (items + links).

## Cobertura

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |
| Nodos de la Feature | 10 |
| Nodos dentro del slice | 2 (`045` rama `Si`, `070`) |
| Nodos fuera del slice | 8 (`055`, `065`, `068`, `069`, `075`, `125`, `126`, `127`, y la rama `No` de `045`) |

## User Story -> System Action

| US | Titulo | ACC | Nodos |
|---|---|---|---|
| `US-REP-003` | Registrar que reparacion necesita el equipo | `ACC-REP-004` | `PROC-REP-045` (rama `Si`), `PROC-REP-070` |

### System Actions

- **`ACC-REP-004`** — Registrar un Detalle de Reparacion con su Tipo y
  fijar el snapshot de precio, puntaje y garantia vigentes.
  `PROC-REP-045` es una decision que no merece System Action propia: su
  rama `Si` es la precondicion de `PROC-REP-070`, y ambos son una misma
  responsabilidad.
  Reglas: `BR-REP-001`, `BR-REP-015`.

## System Action -> Functional Requirement

| ACC | FR |
|---|---|
| `ACC-REP-004` | `FR-REP-006`, `FR-REP-007`, `FR-REP-008`, `FR-REP-009`, `FR-REP-010` |

## Functional Requirement -> Technical Requirement

| FR | TR |
|---|---|
| `FR-REP-006` | `TR-REP-008`, `TR-REP-011`, `TR-REP-019`, `TR-REP-025` |
| `FR-REP-007` | `TR-REP-018`, `TR-REP-017` |
| `FR-REP-008` | `TR-REP-009` |
| `FR-REP-009` | `TR-REP-004`, `TR-REP-017`, `TR-REP-018` |
| `FR-REP-010` | `TR-REP-002` |

## Technical Requirement -> Task -> Code

| TR | TASK | CODE (archivo::simbolo) |
|---|---|---|
| `TR-REP-018` | `TASK-REP-021` | `app/backend/app/services/reparaciones.py::definir_reparacion_detail`, `app/backend/app/domain/models/reparacion.py::ReparacionDetail` |
| `TR-REP-004` | `TASK-REP-024` | `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.total` |
| `TR-REP-002` | `TASK-REP-018`, `TASK-REP-019` | `app/backend/app/domain/models/catalogos.py::TipoReparacion`, `app/backend/app/domain/models/reparacion.py::ReparacionDetail` |
| `TR-REP-008` | `TASK-REP-025` | `app/backend/app/services/reparaciones.py::definir_reparacion_detail` |
| `TR-REP-009` | `TASK-REP-023` | `app/backend/app/services/autorizacion.py::validar_actor` |
| `TR-REP-011` | `TASK-REP-022` | `app/backend/app/services/workflow.py::registrar_paso` |
| `TR-REP-017` | `TASK-REP-024` | `app/backend/app/storage/json/base.py::escribir_json_atomico` |
| `TR-REP-019` | `TASK-REP-020` | `app/backend/app/domain/models/enums.py::EstadoReparacionDetail` |
| `TR-REP-025` | `TASK-REP-020` | `app/backend/app/domain/models/enums.py::EstadoReparacionDetail`, `::EstadoControl` |

## Internal Tests (existentes, no duplicados)

| TEST (archivo::funcion) | Verifica |
|---|---|
| `tests/test_hp_rep_001.py::test_detalle_conserva_el_snapshot_del_tipo_de_reparacion` | `FR-REP-007`, `TR-REP-018` |
| `tests/test_hp_rep_001.py::test_orden_tiene_un_unico_detalle_completo_y_aprobado` | `FR-REP-006` |
| `tests/test_hp_rep_001.py::test_el_total_deriva_del_detalle` | `FR-REP-009`, `TR-REP-004` |
| `tests/test_modelos_dominio.py::test_total_deriva_de_los_detalles` | `FR-REP-009`, `TR-REP-004` |
| `tests/test_modelos_dominio.py::test_total_sin_detalles_es_cero` | `FR-REP-009` |
| `tests/test_modelos_dominio.py::test_agregar_un_detalle_actualiza_total_y_saldo` | `FR-REP-009`, `TR-REP-004` |
| `tests/test_modelos_dominio.py::test_cambiar_el_precio_de_un_detalle_actualiza_total_y_saldo` | `FR-REP-009`, `TR-REP-004` |
| `tests/test_modelos_dominio.py::test_precio_negativo_en_detalle_es_rechazado` | `FR-REP-010`, `TR-REP-002` |
| `tests/test_modelos_dominio.py::test_precio_negativo_en_tipo_reparacion_es_rechazado` | `TR-REP-002` |
| `tests/test_modelos_dominio.py::test_detalle_nace_definido` | `FR-REP-006`, `TR-REP-019` |
| `tests/test_modelos_dominio.py::test_estado_detalle_solo_tiene_el_ciclo_tecnico` | `TR-REP-019` |
| `tests/test_modelos_dominio.py::test_estado_detalle_no_incluye_reservado` | `TR-REP-025` |
| `tests/test_modelos_dominio.py::test_estado_detalle_no_incluye_aprobado` | `TR-REP-025` |
| `tests/test_services_autorizacion.py::test_recepcion_puede_definir_detalle` | `FR-REP-008`, `TR-REP-009` |
| `tests/test_services_autorizacion.py::test_solo_recepcion_puede_definir_detalle` | `FR-REP-008` |
| `tests/test_services_invariantes.py::test_definir_detalle_no_muta_la_orden_recibida` | `TR-REP-008` |
| `tests/test_repositories_json.py::test_el_json_no_guarda_los_derivados_de_la_orden` | `TR-REP-004` |
| `tests/test_repositories_json.py::test_los_tipos_decimal_sobreviven_al_catalogo` | `TR-REP-017` |
| `tests/test_repositories_json.py::test_los_derivados_se_recalculan_al_cargar` | `TR-REP-004` |
| `tests/test_hp_rep_001.py::test_los_derivados_se_recalculan_tras_el_round_trip` | `TR-REP-004`, `TR-REP-017` |

## UAT (todos `PENDING`)

| UAT | Valida | Estado |
|---|---|---|
| `UAT-REP-003` | `US-REP-003`, `FR-REP-006`, `FR-REP-007`, `FR-REP-009` | `PENDING` |
