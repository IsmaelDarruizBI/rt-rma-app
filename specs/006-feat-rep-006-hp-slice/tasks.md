---
description: "Tareas reconstruidas del slice HP-REP-001 de FEAT-REP-006"
---

# Tasks: Control tecnico, retrabajo y evaluacion — Implemented slice: HP-REP-001

**Input**: Design documents from `/specs/006-feat-rep-006-hp-slice/`

**Prerequisites**: `spec.md`, `plan.md`, y el slice de `FEAT-REP-005`

> **Reconstruccion brownfield.** `[x]` solo con evidencia real de codigo
> **Y** test. **No ejecutar `/speckit.implement`.**

## Phase 1: Foundational

- [x] **TASK-REP-093** [P] Modelar el resultado del control en el propio
      Detalle (`control_estado`, `control_usuario_id`, `control_fecha`,
      `control_observaciones`) y el enum `EstadoControl`.
      → `app/backend/app/domain/models/reparacion.py::ReparacionDetail`,
        `app/backend/app/domain/models/enums.py::EstadoControl`
      → test: `tests/test_modelos_dominio.py::test_estado_detalle_no_incluye_aprobado`
- [x] **TASK-REP-094** [P] Implementar `puntaje_total` como
      `computed_field` que suma solo los Detalles aprobados.
      → `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.puntaje_total`
      → test: `tests/test_repositories_json.py::test_el_json_no_guarda_los_derivados_de_la_orden`,
        `tests/test_hp_rep_001.py::test_los_derivados_se_recalculan_tras_el_round_trip`

## Phase 2: User Story `US-REP-010` — Controlar y aprobar el trabajo terminado (P1) — MVP

**Independent Test**: tramo 7 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-095** [US-REP-010] Implementar `aprobar_control_tecnico`
      (`PROC-REP-220` → `PROC-REP-230` rama `Si`), registrando usuario,
      fecha y observacion en cada Detalle.
      → `app/backend/app/services/reparaciones.py::aprobar_control_tecnico`
      → test: `tests/test_hp_rep_001.py::test_orden_tiene_un_unico_detalle_completo_y_aprobado`
- [x] **TASK-REP-096** [US-REP-010] Exigir que no haya Ejecucion activa
      al realizar el control.
      → test: `tests/test_services_invariantes.py::test_control_tecnico_falla_con_ejecucion_activa`
- [x] **TASK-REP-097** [US-REP-010] Exigir actor `ACT-RECEP`; el tecnico
      no puede aprobar su propio control, y un rechazo por rol no aprueba
      nada.
      → test: `tests/test_services_autorizacion.py::test_recepcion_puede_realizar_el_control_tecnico`,
        `::test_el_tecnico_no_puede_aprobar_su_propio_control`,
        `::test_un_control_rechazado_por_rol_no_aprueba_nada`
- [x] **TASK-REP-098** [US-REP-010] Implementar `marcar_reparacion_lista`
      (`PROC-REP-240`) exigiendo control aprobado.
      → `app/backend/app/services/ordenes.py::marcar_reparacion_lista`
      → test: `tests/test_services_invariantes.py::test_no_se_marca_reparacion_lista_sin_control_aprobado`

**Checkpoint**: `US-REP-010` entregable de forma independiente.

---

## Phase 3: User Story `US-REP-011` — Acreditar el puntaje del trabajo aprobado (P2)

**Independent Test**: `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`
(`puntaje_total == 10`).

- [x] **TASK-REP-099** [US-REP-011] Implementar `calcular_puntaje`
      (`PROC-REP-245`) como nodo `ACT-SYSTEM`, acreditando por Detalle
      aprobado.
      → `app/backend/app/services/reparaciones.py::calcular_puntaje`
      → test: `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`,
        `tests/test_hp_rep_001_persistido.py::test_el_archivo_final_es_una_orden_valida`

---

## Phase 4: Fuera del slice — NO implementado

Corresponden a `FEAT-REP-006` completa. Sin codigo ni test.

- [ ] **TASK-REP-100** Implementar la rama `No` de `PROC-REP-230`
      (al menos un Detalle rechazado), agregando el valor de rechazo a
      `EstadoControl`.
- [ ] **TASK-REP-101** Implementar `PROC-REP-235` (identificar Detalles a
      retrabajar): reabrir esos Detalles a `PENDIENTE` conservando el
      historial de sus Ejecuciones y del propio rechazo (`BR-REP-008`).
- [ ] **TASK-REP-102** Conectar `PROC-REP-235` con el resolver
      `PROC-REP-211` para recalcular el estado de la Orden tras el
      rechazo (nodo compartido con `FEAT-REP-005`, binding
      `CONTEXTUAL`).
- [ ] **TASK-REP-103** Ejercitar varios ciclos de rechazo/retrabajo sobre
      la misma Orden.
- [ ] **TASK-REP-104** Definir e implementar la distribucion/acreditacion
      del puntaje entre los tecnicos que participaron de un mismo Detalle
      (pendiente de negocio declarado en `docs/discovery/README.md`).
- [ ] **TASK-REP-105** Ejercitar el control de una Orden con algunos
      Detalles `CANCELADO` y al menos uno `COMPLETO` (`BR-REP-014-B`);
      requiere implementar antes `FEAT-REP-009`.

---

## Dependencies & Execution Order

```text
(FEAT-REP-005: Detalles COMPLETO, sin Ejecucion activa)
  └── TASK-REP-093, TASK-REP-094     (paralelizables)
        └── TASK-REP-095 → TASK-REP-096 → TASK-REP-097 → TASK-REP-098
              └── TASK-REP-099
```

## Estado real de implementacion

| Fase | Tareas | `[x]` con evidencia codigo+test | `[ ]` |
|---|---|---|---|
| Foundational | 2 | 2 | 0 |
| `US-REP-010` | 4 | 4 | 0 |
| `US-REP-011` | 1 | 1 | 0 |
| Fuera del slice | 6 | 0 | 6 |
| **Total** | **13** | **7** | **6** |
