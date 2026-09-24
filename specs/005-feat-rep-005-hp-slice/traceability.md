# Traceability: FEAT-REP-005 — Implemented slice HP-REP-001

Vista narrativa. La fuente machine-readable es
`traceability/hp-rep-001.yaml` (items + links).

## Cobertura

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |
| Nodos de la Feature | 11 |
| Nodos dentro del slice | 7 (`181`, `174`, `185`, `190`, `200`, `210`, `211`) |
| Nodos fuera del slice | 4 (`176`, `178`, `179`, `186`) + ramas no recorridas de `174`, `200` y `211` |

> `PROC-REP-211` es **nodo compartido** con `FEAT-REP-006` y
> `FEAT-REP-009`. En `HP-REP-001` se alcanza via `PROC-REP-210`, lo que
> activa `FEAT-REP-005` por binding `CONTEXTUAL` (nunca via
> `PROC-REP-300/305`, que activarian `FEAT-REP-009`).

## User Story -> System Action

| US | Titulo | ACC | Nodos |
|---|---|---|---|
| `US-REP-007` | Elegir que Detalle trabajar ahora | `ACC-REP-011` | `PROC-REP-181`, `PROC-REP-174` |
| `US-REP-008` | Empezar a trabajar con insumos asegurados | `ACC-REP-012` | `PROC-REP-185` |
| `US-REP-008` | — | `ACC-REP-013` | `PROC-REP-190` |
| `US-REP-009` | Dejar registrado el trabajo realmente hecho | `ACC-REP-014` | `PROC-REP-200` |
| `US-REP-009` | — | `ACC-REP-015` | `PROC-REP-210` |
| `US-REP-009` | — | `ACC-REP-016` | `PROC-REP-211` |

### System Actions

- **`ACC-REP-011`** — Seleccionar el Detalle a trabajar y revalidar la
  compatibilidad de la Estacion con su Tipo de Reparacion. Agrupa
  `PROC-REP-181` y `PROC-REP-174` porque son una misma responsabilidad:
  fijar y habilitar el trabajo concreto. Regla: `BR-REP-011-B`.
- **`ACC-REP-012`** — Reservar los insumos previstos del Detalle y abrir
  la Ejecucion. Regla: `BR-REP-006`.
- **`ACC-REP-013`** — Registrar que el tecnico esta trabajando el
  Detalle.
- **`ACC-REP-014`** — Registrar la Ejecucion real y cerrar el Detalle
  como `COMPLETO`. Regla: `BR-REP-004`.
- **`ACC-REP-015`** — Generar los movimientos de inventario resultantes y
  actualizar el stock fisico. Regla: `BR-REP-005`.
- **`ACC-REP-016`** — Reevaluar la situacion agregada de la Orden y
  cerrar la participacion activa cuando no queda Detalle trabajable.
  Reglas: `BR-REP-012`, `BR-REP-018`.

## System Action -> Functional Requirement

| ACC | FR |
|---|---|
| `ACC-REP-011` | `FR-REP-025`, `FR-REP-026` |
| `ACC-REP-012` | `FR-REP-027`, `FR-REP-028`, `FR-REP-029`, `FR-REP-039` |
| `ACC-REP-013` | `FR-REP-030` |
| `ACC-REP-014` | `FR-REP-030`, `FR-REP-031` |
| `ACC-REP-015` | `FR-REP-032`, `FR-REP-033`, `FR-REP-034`, `FR-REP-035`, `FR-REP-036`, `FR-REP-039` |
| `ACC-REP-016` | `FR-REP-037`, `FR-REP-038` |

## Functional Requirement -> Technical Requirement

| FR | TR |
|---|---|
| `FR-REP-025` | `TR-REP-008`, `TR-REP-009`, `TR-REP-020` |
| `FR-REP-026` | `TR-REP-031` |
| `FR-REP-027` | `TR-REP-033`, `TR-REP-008` |
| `FR-REP-028` | `TR-REP-033`, `TR-REP-006` |
| `FR-REP-029` | `TR-REP-028` |
| `FR-REP-030` | `TR-REP-034`, `TR-REP-009` |
| `FR-REP-031` | `TR-REP-002`, `TR-REP-008` |
| `FR-REP-032` | `TR-REP-005`, `TR-REP-032`, `TR-REP-002` |
| `FR-REP-033` | `TR-REP-016`, `TR-REP-032` |
| `FR-REP-034` | `TR-REP-016` |
| `FR-REP-035` | `TR-REP-015` |
| `FR-REP-036` | `TR-REP-005` |
| `FR-REP-037` | `TR-REP-022`, `TR-REP-011` |
| `FR-REP-038` | `TR-REP-035` |
| `FR-REP-039` | `TR-REP-033`, `TR-REP-010` |

## Technical Requirement -> Task -> Code

| TR | TASK | CODE (archivo::simbolo) |
|---|---|---|
| `TR-REP-005` | `TASK-REP-069`, `TASK-REP-080` | `app/backend/app/domain/models/inventario.py::MovimientoInsumo` |
| `TR-REP-015` | `TASK-REP-081`, `TASK-REP-083` | `app/backend/app/services/inventario.py::inventario_aplicado` |
| `TR-REP-016` | `TASK-REP-082` | `app/backend/app/services/inventario_global.py::aplicar_movimientos_inventario`, `::_consumos_de_la_ejecucion` |
| `TR-REP-032` | `TASK-REP-079` | `app/backend/app/services/inventario.py::generar_movimientos_inventario`, `::_cantidad_utilizada` |
| `TR-REP-033` | `TASK-REP-073`, `TASK-REP-074`, `TASK-REP-075` | `app/backend/app/services/inventario.py::crear_reserva`, `app/backend/app/services/ejecuciones.py::reservar_insumos_e_iniciar_ejecucion` |
| `TR-REP-034` | `TASK-REP-077` | `app/backend/app/services/ejecuciones.py::_validar_propiedad_de_la_ejecucion` |
| `TR-REP-022` | `TASK-REP-084` | `app/backend/app/services/ordenes.py::evaluar_situacion_orden`, `::ResultadoEvaluacionOrden` |
| `TR-REP-035` | `TASK-REP-084` | `app/backend/app/services/ordenes.py::evaluar_situacion_orden` |
| `TR-REP-028` | `TASK-REP-076` | `app/backend/app/services/ejecuciones.py::ejecucion_activa` |
| `TR-REP-031` | `TASK-REP-071` | `app/backend/app/services/tomas.py::validar_compatibilidad_detalle` |
| `TR-REP-006` | `TASK-REP-073` | `app/backend/app/services/inventario.py::reservas_activas`, `::cantidad_pendiente` |
| `TR-REP-002` | `TASK-REP-068` | `app/backend/app/domain/models/inventario.py::InsumoUtilizado` |
| `TR-REP-008` | `TASK-REP-074`, `TASK-REP-078` | `app/backend/app/services/ejecuciones.py::registrar_ejecucion_completada` |
| `TR-REP-009` | `TASK-REP-072`, `TASK-REP-077` | `app/backend/app/services/autorizacion.py::validar_actor` |
| `TR-REP-010` | `TASK-REP-073` | `app/backend/app/services/inventario.py::crear_reserva` |
| `TR-REP-011` | `TASK-REP-084` | `app/backend/app/services/workflow.py::registrar_paso` |
| `TR-REP-020` | `TASK-REP-070` | `app/backend/app/services/exceptions.py::PrecondicionInvalidaError`, `::RecursoNoDisponibleError` |
| — (ejecucion) | `TASK-REP-067` | `app/backend/app/domain/models/reparacion.py::EjecucionReparacion` |
| — (seleccion) | `TASK-REP-070` | `app/backend/app/services/tomas.py::seleccionar_detalle` |
| — (ejecutar) | `TASK-REP-077` | `app/backend/app/services/ejecuciones.py::ejecutar_detalle` |

## Internal Tests (existentes, no duplicados)

| TEST (archivo::funcion) | Verifica |
|---|---|
| `tests/test_services_invariantes.py::test_no_se_selecciona_un_detalle_ya_en_progreso` | `FR-REP-025` |
| `tests/test_services_invariantes.py::test_estacion_incompatible_con_el_detalle_seleccionado` | `FR-REP-026`, `TR-REP-031` |
| `tests/test_services_invariantes.py::test_reservar_crea_reserva_y_ejecucion` | `FR-REP-027`, `TR-REP-033` |
| `tests/test_services_invariantes.py::test_reserva_insuficiente_no_deja_movimientos_parciales` | `FR-REP-027`, `TR-REP-033` |
| `tests/test_services_invariantes.py::test_reservar_no_muta_la_orden_recibida` | `TR-REP-008` |
| `tests/test_services_invariantes.py::test_no_puede_haber_dos_ejecuciones_activas` | `FR-REP-029`, `TR-REP-028` |
| `tests/test_services_invariantes.py::test_registrar_ejecucion_guarda_los_insumos_reales` | `FR-REP-031` |
| `tests/test_services_invariantes.py::test_generar_movimientos_consume_la_reserva` | `FR-REP-032`, `TR-REP-032` |
| `tests/test_services_invariantes.py::test_consumo_parcial_genera_liberacion_por_la_diferencia` | `FR-REP-032`, `TR-REP-032` |
| `tests/test_services_invariantes.py::test_consumo_mayor_a_la_reserva_falla` | `FR-REP-033`, `TR-REP-032` |
| `tests/test_services_invariantes.py::test_evaluar_orden_cierra_la_toma_activa` | `FR-REP-038`, `TR-REP-035` |
| `tests/test_services_autorizacion.py::test_solo_un_tecnico_puede_seleccionar_detalle` | `FR-REP-025`, `TR-REP-009` |
| `tests/test_services_autorizacion.py::test_solo_un_tecnico_puede_ejecutar_el_detalle` | `FR-REP-030` |
| `tests/test_services_autorizacion.py::test_tecnico_puede_registrar_la_ejecucion` | `FR-REP-031` |
| `tests/test_services_autorizacion.py::test_solo_un_tecnico_puede_registrar_la_ejecucion` | `FR-REP-031`, `TR-REP-009` |
| `tests/test_services_autorizacion.py::test_el_tecnico_propietario_puede_ejecutar_y_completar` | `FR-REP-030`, `TR-REP-034` |
| `tests/test_services_autorizacion.py::test_otro_tecnico_no_puede_ejecutar_la_ejecucion_activa` | `FR-REP-030`, `TR-REP-034` |
| `tests/test_services_autorizacion.py::test_otro_tecnico_no_puede_completar_la_ejecucion_activa` | `FR-REP-030`, `TR-REP-034` |
| `tests/test_services_autorizacion.py::test_la_ejecucion_debe_pertenecer_a_la_toma_activa` | `FR-REP-030`, `TR-REP-034` |
| `tests/test_services_autorizacion.py::test_un_fallo_de_identidad_no_muta_la_orden` | `FR-REP-030`, `TR-REP-008` |
| `tests/test_inventario_global.py::test_caso_c_tras_el_consumo_todo_queda_en_cero` | `FR-REP-032`, `FR-REP-034`, `TR-REP-016` |
| `tests/test_inventario_global.py::test_caso_d_consumo_parcial_y_liberacion` | `FR-REP-032`, `FR-REP-034`, `TR-REP-016` |
| `tests/test_inventario_global.py::test_aplicar_movimientos_guarda_orden_y_catalogo` | `FR-REP-034`, `TR-REP-016` |
| `tests/test_inventario_global.py::test_aplicar_movimientos_no_muta_la_orden_recibida` | `TR-REP-008` |
| `tests/test_inventario_global.py::test_aplicar_movimientos_falla_si_el_stock_quedaria_negativo` | `FR-REP-033`, `TR-REP-016` |
| `tests/test_inventario_global.py::test_reaplicar_210_no_duplica_el_consumo` | `FR-REP-035`, `TR-REP-015` |
| `tests/test_inventario_global.py::test_reaplicar_210_no_duplica_consumo_ni_liberacion` | `FR-REP-035`, `TR-REP-015` |
| `tests/test_inventario_global.py::test_el_service_210_por_si_solo_es_idempotente` | `FR-REP-035`, `TR-REP-015` |
| `tests/test_inventario_global.py::test_reaplicar_210_no_reescribe_la_orden_persistida` | `FR-REP-035`, `TR-REP-015` |
| `tests/test_modelos_dominio.py::test_movimiento_es_inmutable` | `FR-REP-036`, `TR-REP-005` |
| `tests/test_modelos_dominio.py::test_movimiento_acepta_usuario_none` | `FR-REP-039`, `TR-REP-010` |
| `tests/test_modelos_dominio.py::test_movimiento_admite_usuario_cuando_lo_ejecuta_una_persona` | `TR-REP-005` |
| `tests/test_hp_rep_001.py::test_la_reserva_y_el_consumo_se_conservan_ambos` | `FR-REP-036`, `TR-REP-005` |
| `tests/test_hp_rep_001.py::test_los_movimientos_automaticos_no_tienen_usuario` | `FR-REP-039`, `TR-REP-010` |
| `tests/test_hp_rep_001.py::test_la_trazabilidad_al_tecnico_pasa_por_la_ejecucion` | `FR-REP-039` |
| `tests/test_hp_rep_001.py::test_la_ejecucion_quedo_completada_dentro_de_su_toma` | `FR-REP-030` |

## UAT (todos `PENDING`)

| UAT | Valida | Estado |
|---|---|---|
| `UAT-REP-007` | `US-REP-007`, `FR-REP-025`, `FR-REP-026` | `PENDING` |
| `UAT-REP-008` | `US-REP-008`, `FR-REP-027`, `FR-REP-028`, `FR-REP-029` | `PENDING` |
| `UAT-REP-009` | `US-REP-009`, `FR-REP-031`, `FR-REP-032`, `FR-REP-034` | `PENDING` |
