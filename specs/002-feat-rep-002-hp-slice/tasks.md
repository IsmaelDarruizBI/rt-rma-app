---
description: "Tareas reconstruidas del slice HP-REP-001 de FEAT-REP-002"
---

# Tasks: Diagnostico y gestion de Detalles de Reparacion — Implemented slice: HP-REP-001

**Input**: Design documents from `/specs/002-feat-rep-002-hp-slice/`

**Prerequisites**: `spec.md`, `plan.md`, y el slice de `FEAT-REP-001`

> **Reconstruccion brownfield.** `[x]` solo con evidencia real de codigo
> **Y** test. **No ejecutar `/speckit.implement`.**

## Phase 1: Foundational

- [x] **TASK-REP-018** [P] Modelar `TipoReparacion` en el catalogo, con
      precio, ponderacion de puntaje y garantia configurables.
      → `app/backend/app/domain/models/catalogos.py::TipoReparacion`
      → test: `tests/test_modelos_dominio.py::test_precio_negativo_en_tipo_reparacion_es_rechazado`
- [x] **TASK-REP-019** [P] Modelar `ReparacionDetail` con los campos
      snapshot (`precio`, `puntaje`, `garantia_dias`) y el estado tecnico
      limitado al ciclo que `HP-REP-001` recorre.
      → `app/backend/app/domain/models/reparacion.py::ReparacionDetail`
      → test: `tests/test_modelos_dominio.py::test_detalle_nace_definido`,
        `::test_precio_negativo_en_detalle_es_rechazado`
- [x] **TASK-REP-020** [P] Definir `EstadoReparacionDetail` y
      `EstadoControl` sin valores fuera del alcance del slice (sin
      `CANCELADO`, sin `RESERVADO`, sin `APROBADO` como estado tecnico).
      → `app/backend/app/domain/models/enums.py`
      → test: `tests/test_modelos_dominio.py::test_estado_detalle_no_incluye_reservado`,
        `::test_estado_detalle_no_incluye_aprobado`,
        `::test_estado_detalle_solo_tiene_el_ciclo_tecnico`

## Phase 2: User Story `US-REP-003` — Registrar que reparacion necesita el equipo (P1) — MVP

**Goal**: dejar definido el trabajo a realizar y su precio.

**Independent Test**: tramo 2 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-021** [US-REP-003] Implementar
      `definir_reparacion_detail` cubriendo `PROC-REP-045` (rama `Si`) →
      `PROC-REP-070`, tomando el snapshot del `TipoReparacion` recibido.
      → `app/backend/app/services/reparaciones.py::definir_reparacion_detail`
      → test: `tests/test_hp_rep_001.py::test_detalle_conserva_el_snapshot_del_tipo_de_reparacion`
- [x] **TASK-REP-022** [US-REP-003] Registrar `PROC-REP-045` una sola vez
      (en la primera definicion) y `PROC-REP-070` en cada Detalle.
      → test: `tests/test_hp_rep_001_persistido.py::test_la_orden_persistida_recorre_los_nodos_del_scenario`
- [x] **TASK-REP-023** [US-REP-003] Exigir actor `ACT-RECEP` activo, sin
      efectos ante rechazo.
      → test: `tests/test_services_autorizacion.py::test_recepcion_puede_definir_detalle`,
        `::test_solo_recepcion_puede_definir_detalle`
- [x] **TASK-REP-024** [US-REP-003] Implementar `total` como
      `computed_field` derivado de los precios de los Detalles, y
      excluirlo de la persistencia.
      → `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.total`
      → test: `tests/test_modelos_dominio.py::test_total_deriva_de_los_detalles`,
        `::test_agregar_un_detalle_actualiza_total_y_saldo`,
        `tests/test_repositories_json.py::test_el_json_no_guarda_los_derivados_de_la_orden`
- [x] **TASK-REP-025** [US-REP-003] Garantizar que `definir_reparacion_detail`
      no muta la Orden recibida.
      → test: `tests/test_services_invariantes.py::test_definir_detalle_no_muta_la_orden_recibida`

**Checkpoint**: `US-REP-003` entregable de forma independiente.

---

## Phase 3: Fuera del slice — NO implementado

Corresponden a `FEAT-REP-002` completa pero **no** al slice de
`HP-REP-001`. Sin codigo ni test que las respalde.

- [ ] **TASK-REP-026** Implementar la rama `No` de `PROC-REP-045` y
      `PROC-REP-055` (Orden `EN_REVISION`), incluyendo el hito
      `EN_REVISION` en `EstadoWorkflow`.
- [ ] **TASK-REP-027** Implementar `PROC-REP-065` (revision tecnica de la
      Orden) y `PROC-REP-068` (decision sobre el resultado).
- [ ] **TASK-REP-028** Implementar `PROC-REP-069` (`SIN_REPARACION`,
      `BR-REP-010`), con motivo obligatorio y `Subtotal = 0`.
- [ ] **TASK-REP-029** Implementar `PROC-REP-075` (definir Detalles luego
      de la revision tecnica).
- [ ] **TASK-REP-030** Implementar el circuito de Detalle pendiente de
      revision: `PROC-REP-125` → `PROC-REP-126` → `PROC-REP-127`, con la
      condicion `REQUIERE_DEFINICION` del Detalle.
- [ ] **TASK-REP-031** Ejercitar end-to-end una Orden con mas de un
      Detalle (el modelo lo soporta; `HP-REP-001` tiene
      `detail_count = 1`).
- [ ] **TASK-REP-032** Implementar el historico de precios del Tipo de
      Reparacion (`BR-REP-015` lo menciona; el catalogo actual guarda
      solo el precio vigente).

---

## Dependencies & Execution Order

```text
(FEAT-REP-001: Orden creada)
  └── TASK-REP-018 .. TASK-REP-020   (foundational, paralelizables)
        └── TASK-REP-021 → TASK-REP-022 → TASK-REP-023
              └── TASK-REP-024 → TASK-REP-025
```

## Estado real de implementacion

| Fase | Tareas | `[x]` con evidencia codigo+test | `[ ]` |
|---|---|---|---|
| Foundational | 3 | 3 | 0 |
| `US-REP-003` | 5 | 5 | 0 |
| Fuera del slice | 7 | 0 | 7 |
| **Total** | **15** | **8** | **7** |

## Iteracion de reconciliacion (prueba manual del MVP)

- [x] **TASK-REP-145** [US-REP-003] Exponer `tipo_reparacion_nombre` en
      el DTO del Detalle, resuelto al leer contra el catalogo vigente
      igual que `insumos_previstos`. NO se agrega al modelo persistido
      `ReparacionDetail`: el JSON de la Orden sigue guardando solo el ID.
      Codigo: `app/backend/app/application/consultas.py::nombres_de_tipo_por_detalle`.
      Tests: `test_api_reconcile.py::test_el_detalle_expone_el_nombre_del_tipo`,
      `::test_el_nombre_del_tipo_no_se_persiste`.
