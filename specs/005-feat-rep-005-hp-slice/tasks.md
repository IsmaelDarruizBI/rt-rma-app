---
description: "Tareas reconstruidas del slice HP-REP-001 de FEAT-REP-005"
---

# Tasks: Ejecucion de Detalles y gestion de insumos — Implemented slice: HP-REP-001

**Input**: Design documents from `/specs/005-feat-rep-005-hp-slice/`

**Prerequisites**: `spec.md`, `plan.md`, y los slices de `FEAT-REP-003` y
`FEAT-REP-004`

> **Reconstruccion brownfield.** `[x]` solo con evidencia real de codigo
> **Y** test. **No ejecutar `/speckit.implement`.**

## Phase 1: Foundational

- [x] **TASK-REP-067** [P] Modelar `EjecucionReparacion` (Detalle, toma,
      tecnico, inicio/fin, insumos utilizados) y `EstadoEjecucion`.
      → `app/backend/app/domain/models/reparacion.py::EjecucionReparacion`
      → test: `tests/test_hp_rep_001.py::test_la_ejecucion_quedo_completada_dentro_de_su_toma`
- [x] **TASK-REP-068** [P] Modelar `InsumoUtilizado` y
      `TipoMovimientoInsumo`.
      → `app/backend/app/domain/models/inventario.py::InsumoUtilizado`,
        `app/backend/app/domain/models/enums.py::TipoMovimientoInsumo`
      → test: `tests/test_modelos_dominio.py::test_cantidad_de_insumo_positiva_es_aceptada`
- [x] **TASK-REP-069** Hacer `MovimientoInsumo` inmutable (`frozen`) y
      admitir `usuario_id` opcional para los nodos `ACT-SYSTEM`.
      → `app/backend/app/domain/models/inventario.py::MovimientoInsumo`
      → test: `tests/test_modelos_dominio.py::test_movimiento_es_inmutable`,
        `::test_movimiento_acepta_usuario_none`,
        `::test_movimiento_admite_usuario_cuando_lo_ejecuta_una_persona`

## Phase 2: User Story `US-REP-007` — Elegir que Detalle trabajar ahora (P1)

**Independent Test**: tramo 4 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-070** [US-REP-007] Implementar `seleccionar_detalle`
      (`PROC-REP-181`), impidiendo reseleccionar un Detalle en progreso.
      → `app/backend/app/services/tomas.py::seleccionar_detalle`
      → test: `tests/test_services_invariantes.py::test_no_se_selecciona_un_detalle_ya_en_progreso`
- [x] **TASK-REP-071** [US-REP-007] Implementar
      `validar_compatibilidad_detalle` (`PROC-REP-174`) reutilizando
      `estacion_habilitada_para`.
      → `app/backend/app/services/tomas.py::validar_compatibilidad_detalle`
      → test: `tests/test_services_invariantes.py::test_estacion_incompatible_con_el_detalle_seleccionado`
- [x] **TASK-REP-072** [US-REP-007] Exigir actor `ACT-TECH`.
      → test: `tests/test_services_autorizacion.py::test_solo_un_tecnico_puede_seleccionar_detalle`

## Phase 3: User Story `US-REP-008` — Empezar a trabajar con insumos asegurados (P1) — MVP

**Independent Test**: tramo 5 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-073** [US-REP-008] Implementar `crear_reserva` como
      movimiento `RESERVA` del sistema, sin usuario.
      → `app/backend/app/services/inventario.py::crear_reserva`
      → test: `tests/test_hp_rep_001.py::test_los_movimientos_automaticos_no_tienen_usuario`
- [x] **TASK-REP-074** [US-REP-008] Implementar
      `reservar_insumos_e_iniciar_ejecucion` (`PROC-REP-185`) como
      operacion todo-o-nada que crea las reservas y abre la Ejecucion.
      → `app/backend/app/services/ejecuciones.py::reservar_insumos_e_iniciar_ejecucion`
      → test: `tests/test_services_invariantes.py::test_reservar_crea_reserva_y_ejecucion`,
        `::test_reserva_insuficiente_no_deja_movimientos_parciales`,
        `::test_reservar_no_muta_la_orden_recibida`
- [x] **TASK-REP-075** [US-REP-008] Garantizar que la reserva no toca el
      stock fisico.
      → test: `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`
        (`stock_fisico == 2` despues de reservar)
- [x] **TASK-REP-076** [US-REP-008] Implementar `ejecucion_activa` y la
      invariante de una unica Ejecucion activa por Orden (`BR-REP-007`).
      → `app/backend/app/services/ejecuciones.py::ejecucion_activa`
      → test: `tests/test_services_invariantes.py::test_no_puede_haber_dos_ejecuciones_activas`
- [x] **TASK-REP-077** [US-REP-008] Implementar `ejecutar_detalle`
      (`PROC-REP-190`) y la validacion de propiedad de la Ejecucion.
      → `app/backend/app/services/ejecuciones.py::ejecutar_detalle`,
        `::_validar_propiedad_de_la_ejecucion`
      → test: `tests/test_services_autorizacion.py::test_el_tecnico_propietario_puede_ejecutar_y_completar`,
        `::test_otro_tecnico_no_puede_ejecutar_la_ejecucion_activa`,
        `::test_la_ejecucion_debe_pertenecer_a_la_toma_activa`,
        `::test_un_fallo_de_identidad_no_muta_la_orden`

## Phase 4: User Story `US-REP-009` — Dejar registrado el trabajo realmente hecho (P1) — MVP

**Independent Test**: tramos 6 y 7 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-078** [US-REP-009] Implementar
      `registrar_ejecucion_completada` (`PROC-REP-200`, resultado
      `Completado`), guardando insumos reales y pasando el Detalle a
      `COMPLETO`.
      → `app/backend/app/services/ejecuciones.py::registrar_ejecucion_completada`
      → test: `tests/test_services_invariantes.py::test_registrar_ejecucion_guarda_los_insumos_reales`,
        `tests/test_services_autorizacion.py::test_tecnico_puede_registrar_la_ejecucion`,
        `::test_solo_un_tecnico_puede_registrar_la_ejecucion`,
        `::test_otro_tecnico_no_puede_completar_la_ejecucion_activa`
- [x] **TASK-REP-079** [US-REP-009] Implementar
      `generar_movimientos_inventario` (`PROC-REP-210`, calculo puro):
      consumo, liberacion por diferencia y rechazo de consumo excesivo.
      → `app/backend/app/services/inventario.py::generar_movimientos_inventario`,
        `::_cantidad_utilizada`
      → test: `tests/test_services_invariantes.py::test_generar_movimientos_consume_la_reserva`,
        `::test_consumo_parcial_genera_liberacion_por_la_diferencia`,
        `::test_consumo_mayor_a_la_reserva_falla`
- [x] **TASK-REP-080** [US-REP-009] Conservar reserva y consumo como dos
      movimientos distintos, con referencia al origen.
      → test: `tests/test_hp_rep_001.py::test_la_reserva_y_el_consumo_se_conservan_ambos`,
        `tests/test_hp_rep_001.py::test_la_trazabilidad_al_tecnico_pasa_por_la_ejecucion`
- [x] **TASK-REP-081** [US-REP-009] Implementar `inventario_aplicado`
      como deteccion de idempotencia deducida del ledger, sin flag.
      → `app/backend/app/services/inventario.py::inventario_aplicado`
      → test: `tests/test_inventario_global.py::test_inventario_aplicado_reconoce_el_estado_del_ledger`,
        `::test_el_service_210_por_si_solo_es_idempotente`
- [x] **TASK-REP-082** [US-REP-009] Implementar
      `aplicar_movimientos_inventario` (`PROC-REP-210` persistido):
      validar antes de escribir, guardar la Orden y descontar solo el
      consumo del stock fisico.
      → `app/backend/app/services/inventario_global.py::aplicar_movimientos_inventario`,
        `::_consumos_de_la_ejecucion`
      → test: `tests/test_inventario_global.py::test_caso_c_tras_el_consumo_todo_queda_en_cero`,
        `::test_caso_d_consumo_parcial_y_liberacion`,
        `::test_aplicar_movimientos_guarda_orden_y_catalogo`,
        `::test_aplicar_movimientos_falla_si_el_stock_quedaria_negativo`,
        `::test_aplicar_movimientos_no_muta_la_orden_recibida`
- [x] **TASK-REP-083** [US-REP-009] Garantizar la idempotencia extremo a
      extremo del `PROC-REP-210` persistido.
      → test: `tests/test_inventario_global.py::test_reaplicar_210_no_duplica_el_consumo`,
        `::test_reaplicar_210_no_duplica_consumo_ni_liberacion`,
        `::test_reaplicar_210_no_reescribe_la_orden_persistida`
- [x] **TASK-REP-084** [US-REP-009] Implementar `evaluar_situacion_orden`
      (`PROC-REP-211`) con `ResultadoEvaluacionOrden`, fail-safe
      explicito fuera del caso soportado y cierre automatico de la toma.
      → `app/backend/app/services/ordenes.py::evaluar_situacion_orden`,
        `::ResultadoEvaluacionOrden`
      → test: `tests/test_services_invariantes.py::test_evaluar_orden_cierra_la_toma_activa`,
        `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`

**Checkpoint**: nucleo tecnico completo; la Orden queda lista para
control tecnico.

---

## Phase 5: Fuera del slice — NO implementado

Corresponden a `FEAT-REP-005` completa. Sin codigo ni test.

- [ ] **TASK-REP-085** Implementar la rama `No` de `PROC-REP-174` y los
      nodos `PROC-REP-176` / `178` / `179` (advertencia y override de
      estacion por Detalle, `BR-REP-011-B`).
- [ ] **TASK-REP-086** Implementar `PROC-REP-186` (registrar reserva
      fallida: Detalle `BLOQUEADO_POR_RECURSOS` y recalculo de la Orden).
      Hoy la reserva insuficiente lanza un error de dominio, pero **no**
      ejecuta el comportamiento de negocio del nodo.
- [ ] **TASK-REP-087** Implementar el resultado `Interrumpido` de
      `PROC-REP-200` (`BR-REP-004`): la Ejecucion queda como historia y
      el Detalle vuelve a `PENDIENTE`.
- [ ] **TASK-REP-088** Implementar las ramas (a), (b), (d), (e) y (f) del
      resolver `PROC-REP-211` (`BR-REP-012`), incluyendo
      `TODO_CANCELADO`, `PENDIENTE_RECURSOS` y `REQUIERE_REVISION`.
- [ ] **TASK-REP-089** Reconciliar el catalogo de `TipoMovimientoInsumo`
      con PROC-REP V1.3. `DEVOLUCION` se incorporo durante el modelado
      tecnico inicial pero no esta respaldado por el Business Process; en
      sentido inverso, `PROC-REP-210` y `BR-REP-005` contemplan
      `DESPERDICIO`, hoy ausente del enum. Es una decision de negocio
      sobre la baseline funcional, no una tarea de implementacion.
- [ ] **TASK-REP-090** Implementar el registro de desperdicio
      (`PROC-REP-210` / `BR-REP-005` lo contemplan). Depende de
      TASK-REP-089.
- [ ] **TASK-REP-091** Ejercitar varias Ejecuciones historicas sobre el
      mismo Detalle (el modelo lo soporta; no esta probado).
- [ ] **TASK-REP-092** Resolver la consistencia entre la escritura de la
      Orden y la del catalogo (hoy sin transaccion).

---

## Dependencies & Execution Order

```text
(FEAT-REP-004: toma activa)
  └── TASK-REP-067 .. TASK-REP-069
        └── TASK-REP-070 → TASK-REP-071 → TASK-REP-072      (US-REP-007)
              └── TASK-REP-073 → TASK-REP-074 → TASK-REP-075
                    → TASK-REP-076 → TASK-REP-077            (US-REP-008)
                    └── TASK-REP-078 → TASK-REP-079 → TASK-REP-080
                          → TASK-REP-081 → TASK-REP-082
                          → TASK-REP-083 → TASK-REP-084      (US-REP-009)
```

## Estado real de implementacion

| Fase | Tareas | `[x]` con evidencia codigo+test | `[ ]` |
|---|---|---|---|
| Foundational | 3 | 3 | 0 |
| `US-REP-007` | 3 | 3 | 0 |
| `US-REP-008` | 5 | 5 | 0 |
| `US-REP-009` | 7 | 7 | 0 |
| Fuera del slice | 8 | 0 | 8 |
| **Total** | **26** | **18** | **8** |
