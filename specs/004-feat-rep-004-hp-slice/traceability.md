# Traceability: FEAT-REP-004 — Implemented slice HP-REP-001

Vista narrativa. La fuente machine-readable es
`traceability/hp-rep-001.yaml` (items + links).

## Cobertura

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |
| Nodos de la Feature | 6 |
| Nodos dentro del slice | 4 (`150`, `170`, `172`, `180`) |
| Nodos fuera del slice | 2 (`212`, `213`) |

## User Story -> System Action

| US | Titulo | ACC | Nodos |
|---|---|---|---|
| `US-REP-005` | Ordenar el trabajo pendiente | `ACC-REP-007` | `PROC-REP-150` |
| `US-REP-005` | — | `ACC-REP-008` | `PROC-REP-170` |
| `US-REP-006` | Tomar una Orden desde una Estacion compatible | `ACC-REP-009` | `PROC-REP-172` |
| `US-REP-006` | — | `ACC-REP-010` | `PROC-REP-180` |

### System Actions

- **`ACC-REP-007`** — Asignar la prioridad de ejecucion de la Orden.
- **`ACC-REP-008`** — Ingresar la Orden a la cola de trabajo, dejandola
  disponible para cualquier tecnico.
- **`ACC-REP-009`** — Validar sesion/rol, estacion y compatibilidad
  agregada, y dejar el intento registrado en el historial.
  Reglas: `BR-REP-011-A`, `BR-REP-007`.
- **`ACC-REP-010`** — Abrir la toma/participacion activa del tecnico
  sobre la Orden completa. Regla: `BR-REP-018`.

## System Action -> Functional Requirement

| ACC | FR |
|---|---|
| `ACC-REP-007` | `FR-REP-016`, `FR-REP-017` |
| `ACC-REP-008` | `FR-REP-018` |
| `ACC-REP-009` | `FR-REP-019`, `FR-REP-024` |
| `ACC-REP-010` | `FR-REP-020`, `FR-REP-021`, `FR-REP-022`, `FR-REP-023`, `FR-REP-024` |

## Functional Requirement -> Technical Requirement

| FR | TR |
|---|---|
| `FR-REP-016` | `TR-REP-002`, `TR-REP-008` |
| `FR-REP-017` | `TR-REP-009` |
| `FR-REP-018` | `TR-REP-008`, `TR-REP-010`, `TR-REP-020` |
| `FR-REP-019` | `TR-REP-030`, `TR-REP-031`, `TR-REP-028` |
| `FR-REP-020` | `TR-REP-028` |
| `FR-REP-021` | `TR-REP-020` |
| `FR-REP-022` | `TR-REP-029`, `TR-REP-011`, `TR-REP-008` |
| `FR-REP-023` | `TR-REP-028` |
| `FR-REP-024` | `TR-REP-009` |

## Technical Requirement -> Task -> Code

| TR | TASK | CODE (archivo::simbolo) |
|---|---|---|
| `TR-REP-028` | `TASK-REP-051`, `TASK-REP-053`, `TASK-REP-058` | `app/backend/app/domain/models/reparacion.py::TomaOrden`, `app/backend/app/services/tomas.py::toma_activa`, `::hay_ejecucion_activa` |
| `TR-REP-029` | `TASK-REP-051` | `app/backend/app/domain/models/reparacion.py::TomaOrden`, `app/backend/app/domain/models/enums.py::EstadoTomaOrden` |
| `TR-REP-030` | `TASK-REP-056`, `TASK-REP-057` | `app/backend/app/services/tomas.py::validar_estacion_trabajo`, `::_registrar_validacion_estacion` |
| `TR-REP-031` | `TASK-REP-053` | `app/backend/app/services/tomas.py::estacion_habilitada_para`, `::buscar_detalle` |
| `TR-REP-009` | `TASK-REP-054`, `TASK-REP-059` | `app/backend/app/services/autorizacion.py::validar_actor` |
| `TR-REP-002` | `TASK-REP-054` | `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion` (`prioridad`) |
| `TR-REP-008` | `TASK-REP-054`, `TASK-REP-058` | `app/backend/app/services/ordenes.py::definir_prioridad`, `app/backend/app/services/tomas.py::tomar_orden` |
| `TR-REP-010` | `TASK-REP-055` | `app/backend/app/services/ordenes.py::ingresar_a_cola` |
| `TR-REP-011` | `TASK-REP-057` | `app/backend/app/services/workflow.py::registrar_paso` |
| `TR-REP-020` | `TASK-REP-055`, `TASK-REP-058` | `app/backend/app/services/exceptions.py::PrecondicionInvalidaError` |
| — (catalogo) | `TASK-REP-050` | `app/backend/app/domain/models/catalogos.py::EstacionTrabajo`, `::TipoReparacionEstacion` |
| — (roles) | `TASK-REP-052` | `app/backend/app/domain/models/enums.py::RolUsuario` |

## Internal Tests (existentes, no duplicados)

| TEST (archivo::funcion) | Verifica |
|---|---|
| `tests/test_services_invariantes.py::test_la_prioridad_no_puede_ser_negativa` | `FR-REP-016`, `TR-REP-002` |
| `tests/test_services_invariantes.py::test_no_se_ingresa_dos_veces_a_la_cola` | `FR-REP-018`, `TR-REP-020` |
| `tests/test_services_invariantes.py::test_no_se_toma_una_orden_que_no_esta_en_cola` | `FR-REP-021`, `TR-REP-020` |
| `tests/test_services_invariantes.py::test_no_puede_haber_dos_tomas_activas` | `FR-REP-020`, `TR-REP-028` |
| `tests/test_services_invariantes.py::test_la_validacion_de_estacion_rechaza_una_orden_ya_tomada` | `FR-REP-019`, `TR-REP-030` |
| `tests/test_services_invariantes.py::test_estacion_incompatible_no_supera_la_validacion_agregada` | `FR-REP-019`, `TR-REP-031` |
| `tests/test_services_invariantes.py::test_usuario_sin_rol_tecnico_no_supera_la_validacion` | `FR-REP-019`, `FR-REP-024` |
| `tests/test_services_invariantes.py::test_tomar_orden_no_muta_la_orden_recibida` | `TR-REP-008` |
| `tests/test_services_autorizacion.py::test_coordinador_puede_definir_prioridad` | `FR-REP-017` |
| `tests/test_services_autorizacion.py::test_solo_el_coordinador_puede_definir_prioridad` | `FR-REP-017`, `TR-REP-009` |
| `tests/test_services_autorizacion.py::test_tecnico_puede_tomar_orden` | `FR-REP-024` |
| `tests/test_services_autorizacion.py::test_solo_un_tecnico_puede_tomar_orden` | `FR-REP-024`, `TR-REP-009` |
| `tests/test_services_autorizacion.py::test_la_validacion_de_estacion_rechaza_a_quien_no_es_tecnico` | `FR-REP-024` |
| `tests/test_services_autorizacion.py::test_un_usuario_inactivo_no_puede_operar` | `FR-REP-019`, `FR-REP-024` |
| `tests/test_hp_rep_001.py::test_no_queda_ninguna_toma_activa` | `FR-REP-022`, `TR-REP-029` |
| `tests/test_hp_rep_001.py::test_la_ejecucion_quedo_completada_dentro_de_su_toma` | `FR-REP-022`, `TR-REP-028` |
| `tests/test_hp_rep_001_persistido.py::test_la_orden_persistida_recorre_los_nodos_del_scenario` | `FR-REP-019`, `FR-REP-022` |
| `tests/test_repositories_json.py::test_guardar_y_cargar_cada_catalogo` | catalogos de estacion |

## UAT (todos `PENDING`)

| UAT | Valida | Estado |
|---|---|---|
| `UAT-REP-005` | `US-REP-005`, `FR-REP-016`, `FR-REP-018` | `PENDING` |
| `UAT-REP-006` | `US-REP-006`, `FR-REP-019`, `FR-REP-020`, `FR-REP-022` | `PENDING` |
