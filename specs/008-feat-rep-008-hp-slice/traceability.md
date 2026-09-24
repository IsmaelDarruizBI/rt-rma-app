# Traceability: FEAT-REP-008 — Implemented slice HP-REP-001

Vista narrativa. La fuente machine-readable es
`traceability/hp-rep-001.yaml` (items + links).

## Cobertura

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |
| Nodos de la Feature | 5 (`250`, `260`, `280`, `270`, `290`) |
| Nodos dentro del slice | 4 (`250` rama `Si`, `260`, `280`, `270`) + `EVT-REP-999` |
| Nodos fuera del slice | 1 (`290`) |

> `PROC-REP-280` es nodo compartido con `FEAT-REP-007`.

## User Story -> System Action

| US | Titulo | ACC | Nodos |
|---|---|---|---|
| `US-REP-015` | Avisarle al cliente que su equipo esta listo | `ACC-REP-024` | `PROC-REP-250`, `PROC-REP-260` |
| `US-REP-016` | Entregar el equipo y cerrar la Orden | `ACC-REP-025` | `PROC-REP-280` |
| `US-REP-016` | — | `ACC-REP-026` | `PROC-REP-270`, `EVT-REP-999` |

### System Actions

- **`ACC-REP-024`** — Determinar que la Orden requiere entrega al cliente
  y notificarle que el equipo esta listo. Agrupa `PROC-REP-250`
  (decision sin actor) y `PROC-REP-260` (`ACT-RECEP`) porque son una
  misma responsabilidad operativa.
- **`ACC-REP-025`** — Generar el comprobante final y la garantia de
  reparacion, despues del gate de saldo.
- **`ACC-REP-026`** — Entregar el equipo, fijar el hito `ENTREGADA` y
  posicionar la Orden en el evento final del flujo.

## System Action -> Functional Requirement

| ACC | FR |
|---|---|
| `ACC-REP-024` | `FR-REP-055`, `FR-REP-056` |
| `ACC-REP-025` | `FR-REP-057` |
| `ACC-REP-026` | `FR-REP-058`, `FR-REP-059`, `FR-REP-060` |

## Functional Requirement -> Technical Requirement

| FR | TR |
|---|---|
| `FR-REP-055` | `TR-REP-008`, `TR-REP-010`, `TR-REP-011` |
| `FR-REP-056` | `TR-REP-009` |
| `FR-REP-057` | `TR-REP-046`, `TR-REP-050`, `TR-REP-010` |
| `FR-REP-058` | `TR-REP-047`, `TR-REP-048`, `TR-REP-020` |
| `FR-REP-059` | `TR-REP-009` |
| `FR-REP-060` | `TR-REP-049`, `TR-REP-011`, `TR-REP-013`, `TR-REP-014`, `TR-REP-008` |

## Technical Requirement -> Task -> Code

| TR | TASK | CODE (archivo::simbolo) |
|---|---|---|
| `TR-REP-047` | `TASK-REP-130` | `app/backend/app/services/ordenes.py::entregar_equipo` |
| `TR-REP-048` | `TASK-REP-131` | `app/backend/app/services/inventario.py::hay_reservas_activas` |
| `TR-REP-049` | `TASK-REP-133` | `app/backend/app/services/ordenes.py::entregar_equipo` |
| `TR-REP-050` | `TASK-REP-129` | `app/backend/app/domain/models/documentos.py::Documento`, `::DocumentosOrden` |
| `TR-REP-046` | `TASK-REP-129` | `app/backend/app/services/documentos.py::generar_comprobante_final` |
| `TR-REP-009` | `TASK-REP-128`, `TASK-REP-132` | `app/backend/app/services/autorizacion.py::validar_actor` |
| `TR-REP-010` | `TASK-REP-127`, `TASK-REP-129` | `app/backend/app/services/ordenes.py::notificar_cliente` |
| `TR-REP-011` | `TASK-REP-127`, `TASK-REP-133` | `app/backend/app/services/workflow.py::registrar_paso` |
| `TR-REP-013` | `TASK-REP-134` | `app/backend/app/storage/json/base.py::escribir_json_atomico`, `::asegurar_directorio`, `::leer_json` |
| `TR-REP-014` | `TASK-REP-134` | `app/backend/app/storage/json/ordenes.py::JsonOrdenReparacionRepository` |
| `TR-REP-008` | `TASK-REP-130` | `app/backend/app/services/ordenes.py::entregar_equipo` |
| `TR-REP-020` | `TASK-REP-130` | `app/backend/app/services/exceptions.py::PrecondicionInvalidaError` |

## Internal Tests (existentes, no duplicados)

| TEST (archivo::funcion) | Verifica |
|---|---|
| `tests/test_services_autorizacion.py::test_recepcion_puede_notificar_al_cliente` | `FR-REP-056` |
| `tests/test_services_autorizacion.py::test_solo_recepcion_puede_notificar_al_cliente` | `FR-REP-056`, `TR-REP-009` |
| `tests/test_services_autorizacion.py::test_administrador_puede_entregar_el_equipo` | `FR-REP-059` |
| `tests/test_services_autorizacion.py::test_solo_el_administrador_puede_entregar_el_equipo` | `FR-REP-059`, `TR-REP-009` |
| `tests/test_services_invariantes.py::test_entrega_con_saldo_pendiente_falla` | `FR-REP-058`, `TR-REP-047` |
| `tests/test_services_invariantes.py::test_entrega_con_reserva_activa_falla` | `FR-REP-058`, `TR-REP-048` |
| `tests/test_hp_rep_001.py::test_los_documentos_finales_fueron_generados` | `FR-REP-057`, `TR-REP-050` |
| `tests/test_hp_rep_001.py::test_el_escenario_termina_en_el_evento_final` | `FR-REP-060`, `TR-REP-049` |
| `tests/test_hp_rep_001.py::test_orden_refleja_el_estado_final_del_escenario` | `FR-REP-060` |
| `tests/test_hp_rep_001.py::test_la_orden_se_serializa_a_json` | `TR-REP-013` |
| `tests/test_hp_rep_001.py::test_el_json_vuelve_a_validarse_sin_perdida` | `FR-REP-060`, `TR-REP-013` |
| `tests/test_hp_rep_001_persistido.py::test_el_archivo_final_es_una_orden_valida` | `FR-REP-060`, `TR-REP-014` |
| `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end` | `FR-REP-055`, `FR-REP-057`, `FR-REP-058`, `FR-REP-060` |
| `tests/test_hp_rep_001_persistido.py::test_la_orden_persistida_recorre_los_nodos_del_scenario` | `FR-REP-055`, `FR-REP-060` |
| `tests/test_hp_rep_001_services.py::test_la_orden_final_sobrevive_el_round_trip_json` | `TR-REP-013` |
| `tests/test_hp_rep_001_services.py::test_el_estado_final_coincide_con_el_fixture_declarativo` | `FR-REP-060` |
| `tests/test_repositories_json.py::test_la_escritura_atomica_no_deja_temporales` | `TR-REP-013` |
| `tests/test_repositories_json.py::test_reescribir_muchas_veces_no_acumula_archivos` | `TR-REP-014` |
| `tests/test_repositories_json.py::test_la_escritura_atomica_crea_el_directorio` | `TR-REP-013` |
| `tests/test_repositories_json.py::test_guardar_dos_veces_reemplaza_la_orden` | `TR-REP-014` |
| `tests/test_repositories_json.py::test_el_round_trip_es_exacto` | `TR-REP-013` |
| `tests/test_repositories_json.py::test_el_round_trip_conserva_tipos_y_trazabilidad` | `TR-REP-013` |

## UAT (todos `PENDING`)

| UAT | Valida | Estado |
|---|---|---|
| `UAT-REP-015` | `US-REP-015`, `FR-REP-055` | `PENDING` |
| `UAT-REP-016` | `US-REP-016`, `FR-REP-057`, `FR-REP-058`, `FR-REP-060` | `PENDING` |
