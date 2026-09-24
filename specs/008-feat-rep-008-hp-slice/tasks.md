---
description: "Tareas reconstruidas del slice HP-REP-001 de FEAT-REP-008"
---

# Tasks: Finalizacion, entrega e integracion del resultado — Implemented slice: HP-REP-001

**Input**: Design documents from `/specs/008-feat-rep-008-hp-slice/`

**Prerequisites**: `spec.md`, `plan.md`, y los slices de `FEAT-REP-005`,
`FEAT-REP-006` y `FEAT-REP-007`

> **Reconstruccion brownfield.** `[x]` solo con evidencia real de codigo
> **Y** test. **No ejecutar `/speckit.implement`.**

## Phase 1: User Story `US-REP-015` — Avisarle al cliente que su equipo esta listo (P1)

**Independent Test**: tramo 8 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-127** [US-REP-015] Implementar `notificar_cliente`
      cubriendo `PROC-REP-250` (rama `Si`) → `PROC-REP-260`.
      → `app/backend/app/services/ordenes.py::notificar_cliente`
      → test: `tests/test_hp_rep_001_persistido.py::test_la_orden_persistida_recorre_los_nodos_del_scenario`
- [x] **TASK-REP-128** [US-REP-015] Exigir actor `ACT-RECEP`.
      → test: `tests/test_services_autorizacion.py::test_recepcion_puede_notificar_al_cliente`,
        `::test_solo_recepcion_puede_notificar_al_cliente`

**Checkpoint**: `US-REP-015` entregable de forma independiente.

---

## Phase 2: User Story `US-REP-016` — Entregar el equipo y cerrar la Orden (P1) — MVP

**Independent Test**: tramos 9 y 10 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-129** [US-REP-016] Implementar
      `generar_comprobante_final` (`PROC-REP-280`) emitiendo comprobante
      final y garantia de reparacion, despues del gate de saldo.
      → `app/backend/app/services/documentos.py::generar_comprobante_final`
      → test: `tests/test_hp_rep_001.py::test_los_documentos_finales_fueron_generados`
- [x] **TASK-REP-130** [US-REP-016] Implementar `entregar_equipo`
      (`PROC-REP-270`) con las cuatro precondiciones acumulativas.
      → `app/backend/app/services/ordenes.py::entregar_equipo`
      → test: `tests/test_services_invariantes.py::test_entrega_con_saldo_pendiente_falla`,
        `::test_entrega_con_reserva_activa_falla`
- [x] **TASK-REP-131** [US-REP-016] Verificar la ausencia de reservas
      activas contra el ledger, sin flag propio.
      → `app/backend/app/services/inventario.py::hay_reservas_activas`
      → test: `tests/test_hp_rep_001.py::test_la_reserva_y_el_consumo_se_conservan_ambos`,
        `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`
- [x] **TASK-REP-132** [US-REP-016] Exigir actor `ACT-ADMIN` para la
      entrega.
      → test: `tests/test_services_autorizacion.py::test_administrador_puede_entregar_el_equipo`,
        `::test_solo_el_administrador_puede_entregar_el_equipo`
- [x] **TASK-REP-133** [US-REP-016] Fijar `ENTREGADA` y posicionar la
      Orden en `EVT-REP-999` sin agregarlo como paso del historial.
      → `app/backend/app/services/ordenes.py::entregar_equipo`
      → test: `tests/test_hp_rep_001.py::test_el_escenario_termina_en_el_evento_final`,
        `tests/test_hp_rep_001_persistido.py::test_la_orden_persistida_recorre_los_nodos_del_scenario`
- [x] **TASK-REP-134** [US-REP-016] Garantizar que la Orden final
      persistida se vuelve a validar sin perdida contra el modelo.
      → `app/backend/app/storage/json/ordenes.py::JsonOrdenReparacionRepository`
      → test: `tests/test_hp_rep_001_persistido.py::test_el_archivo_final_es_una_orden_valida`,
        `tests/test_hp_rep_001.py::test_el_json_vuelve_a_validarse_sin_perdida`

**Checkpoint**: flujo `HP-REP-001` completo de extremo a extremo.

---

## Phase 3: Fuera del slice — NO implementado

Corresponden a `FEAT-REP-008` completa. Sin codigo ni test.

- [ ] **TASK-REP-135** Implementar la rama `No` de `PROC-REP-250`
      (Ordenes que no requieren entrega al cliente, `RT_INTERNO`).
- [ ] **TASK-REP-136** Implementar `PROC-REP-290` (informar el resultado
      al sistema de Gestion RT).
- [ ] **TASK-REP-137** Definir el estado terminal de `RT_INTERNO`
      (pendiente declarado en `docs/discovery/README.md`).
- [ ] **TASK-REP-138** Implementar el comprobante final para una Orden
      `SIN_REPARACION` (`BR-REP-010`): sin garantia y con subtotal cero.
- [ ] **TASK-REP-139** Materializar el contenido desglosado del
      comprobante final (Detalles, ajustes, pagos, saldo). Hoy solo se
      registra el hecho "generado + fecha".
- [ ] **TASK-REP-140** Integrar la notificacion al cliente con un canal
      real (WhatsApp, chatbot o portal). Hoy solo se registra el hecho.
- [ ] **TASK-REP-141** Implementar la garantia de reparacion a nivel
      Detalle (hoy se relaciona a nivel Orden).

---

## Dependencies & Execution Order

```text
(FEAT-REP-006: REPARACION_LISTA)
(FEAT-REP-007: condicion de entrega aprobada)
(FEAT-REP-005: ledger sin reservas activas)
  └── TASK-REP-127 → TASK-REP-128                      (US-REP-015)
        └── TASK-REP-129 → TASK-REP-130 → TASK-REP-131
              → TASK-REP-132 → TASK-REP-133 → TASK-REP-134  (US-REP-016)
```

## Estado real de implementacion

| Fase | Tareas | `[x]` con evidencia codigo+test | `[ ]` |
|---|---|---|---|
| `US-REP-015` | 2 | 2 | 0 |
| `US-REP-016` | 6 | 6 | 0 |
| Fuera del slice | 7 | 0 | 7 |
| **Total** | **15** | **8** | **7** |
