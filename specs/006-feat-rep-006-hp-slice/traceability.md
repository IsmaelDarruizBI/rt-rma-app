# Traceability: FEAT-REP-006 — Implemented slice HP-REP-001

Vista narrativa. La fuente machine-readable es
`traceability/hp-rep-001.yaml` (items + links).

## Cobertura

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |
| Nodos de la Feature | 6 |
| Nodos dentro del slice | 4 (`220`, `230` rama `Si`, `245`, `240`) |
| Nodos fuera del slice | 2 (`235`, y `211` alcanzado via `235`) |

> `PROC-REP-211` es nodo compartido. `HP-REP-001` lo alcanza via
> `PROC-REP-210` (activa `FEAT-REP-005`), **no** via `PROC-REP-235`, que
> seria la via de activacion `CONTEXTUAL` de `FEAT-REP-006`.

## User Story -> System Action

| US | Titulo | ACC | Nodos |
|---|---|---|---|
| `US-REP-010` | Controlar y aprobar el trabajo terminado | `ACC-REP-017` | `PROC-REP-220`, `PROC-REP-230` |
| `US-REP-010` | — | `ACC-REP-019` | `PROC-REP-240` |
| `US-REP-011` | Acreditar el puntaje del trabajo aprobado | `ACC-REP-018` | `PROC-REP-245` |

### System Actions

- **`ACC-REP-017`** — Registrar el control tecnico aprobando cada
  Detalle, con usuario, fecha y observacion. Agrupa `PROC-REP-220` y
  `PROC-REP-230` porque la decision es el resultado inmediato del
  control: una misma responsabilidad. Regla: `BR-REP-008`.
- **`ACC-REP-018`** — Acreditar el puntaje de los Detalles aprobados.
  Regla: `BR-REP-009`.
- **`ACC-REP-019`** — Fijar el hito `REPARACION_LISTA`.

## System Action -> Functional Requirement

| ACC | FR |
|---|---|
| `ACC-REP-017` | `FR-REP-040`, `FR-REP-041`, `FR-REP-042` |
| `ACC-REP-018` | `FR-REP-043` |
| `ACC-REP-019` | `FR-REP-044` |

## Functional Requirement -> Technical Requirement

| FR | TR |
|---|---|
| `FR-REP-040` | `TR-REP-038`, `TR-REP-020` |
| `FR-REP-041` | `TR-REP-036`, `TR-REP-008`, `TR-REP-011` |
| `FR-REP-042` | `TR-REP-009`, `TR-REP-008` |
| `FR-REP-043` | `TR-REP-037`, `TR-REP-004`, `TR-REP-010` |
| `FR-REP-044` | `TR-REP-039`, `TR-REP-010`, `TR-REP-020` |

## Technical Requirement -> Task -> Code

| TR | TASK | CODE (archivo::simbolo) |
|---|---|---|
| `TR-REP-036` | `TASK-REP-093`, `TASK-REP-095` | `app/backend/app/domain/models/reparacion.py::ReparacionDetail`, `app/backend/app/domain/models/enums.py::EstadoControl` |
| `TR-REP-037` | `TASK-REP-094`, `TASK-REP-099` | `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.puntaje_total` |
| `TR-REP-038` | `TASK-REP-096` | `app/backend/app/services/reparaciones.py::aprobar_control_tecnico` |
| `TR-REP-039` | `TASK-REP-098` | `app/backend/app/services/ordenes.py::marcar_reparacion_lista` |
| `TR-REP-009` | `TASK-REP-097` | `app/backend/app/services/autorizacion.py::validar_actor` |
| `TR-REP-004` | `TASK-REP-094` | `app/backend/app/storage/json/ordenes.py::JsonOrdenReparacionRepository` |
| `TR-REP-008` | `TASK-REP-095`, `TASK-REP-097` | `app/backend/app/services/reparaciones.py::aprobar_control_tecnico` |
| `TR-REP-010` | `TASK-REP-098`, `TASK-REP-099` | `app/backend/app/services/reparaciones.py::calcular_puntaje`, `app/backend/app/services/ordenes.py::marcar_reparacion_lista` |
| `TR-REP-011` | `TASK-REP-095` | `app/backend/app/services/workflow.py::registrar_paso` |
| `TR-REP-020` | `TASK-REP-096`, `TASK-REP-098` | `app/backend/app/services/exceptions.py::PrecondicionInvalidaError` |

## Internal Tests (existentes, no duplicados)

| TEST (archivo::funcion) | Verifica |
|---|---|
| `tests/test_hp_rep_001.py::test_orden_tiene_un_unico_detalle_completo_y_aprobado` | `FR-REP-041`, `TR-REP-036` |
| `tests/test_services_invariantes.py::test_control_tecnico_falla_con_ejecucion_activa` | `FR-REP-040`, `TR-REP-038` |
| `tests/test_services_invariantes.py::test_no_se_marca_reparacion_lista_sin_control_aprobado` | `FR-REP-044`, `TR-REP-039` |
| `tests/test_services_autorizacion.py::test_recepcion_puede_realizar_el_control_tecnico` | `FR-REP-042` |
| `tests/test_services_autorizacion.py::test_el_tecnico_no_puede_aprobar_su_propio_control` | `FR-REP-042`, `TR-REP-009` |
| `tests/test_services_autorizacion.py::test_un_control_rechazado_por_rol_no_aprueba_nada` | `FR-REP-042`, `TR-REP-008` |
| `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end` | `FR-REP-040`, `FR-REP-043`, `FR-REP-044` |
| `tests/test_hp_rep_001_persistido.py::test_el_archivo_final_es_una_orden_valida` | `FR-REP-043`, `TR-REP-037` |
| `tests/test_hp_rep_001.py::test_orden_refleja_el_estado_final_del_escenario` | `FR-REP-044` |
| `tests/test_hp_rep_001.py::test_los_derivados_se_recalculan_tras_el_round_trip` | `FR-REP-043`, `TR-REP-037` |
| `tests/test_repositories_json.py::test_el_json_no_guarda_los_derivados_de_la_orden` | `TR-REP-004`, `TR-REP-037` |
| `tests/test_repositories_json.py::test_ningun_computado_del_modelo_llega_al_json` | `TR-REP-004` |
| `tests/test_repositories_json.py::test_los_derivados_se_recalculan_al_cargar` | `TR-REP-037` |
| `tests/test_modelos_dominio.py::test_estado_detalle_no_incluye_aprobado` | `TR-REP-036` |

## UAT (todos `PENDING`)

| UAT | Valida | Estado |
|---|---|---|
| `UAT-REP-010` | `US-REP-010`, `FR-REP-040`, `FR-REP-041`, `FR-REP-042`, `FR-REP-044` | `PENDING` |
| `UAT-REP-011` | `US-REP-011`, `FR-REP-043` | `PENDING` |
