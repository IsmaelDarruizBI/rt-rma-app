---
description: "Tareas reconstruidas del slice HP-REP-001 de FEAT-REP-004"
---

# Tasks: Gestion de prioridad, cola, toma y liberacion tecnica — Implemented slice: HP-REP-001

**Input**: Design documents from `/specs/004-feat-rep-004-hp-slice/`

**Prerequisites**: `spec.md`, `plan.md`, y el slice de `FEAT-REP-003`

> **Reconstruccion brownfield.** `[x]` solo con evidencia real de codigo
> **Y** test. **No ejecutar `/speckit.implement`.**

## Phase 1: Foundational

- [x] **TASK-REP-050** [P] Modelar `EstacionTrabajo` y
      `TipoReparacionEstacion` en el catalogo.
      → `app/backend/app/domain/models/catalogos.py`
      → test: `tests/test_repositories_json.py::test_guardar_y_cargar_cada_catalogo`
- [x] **TASK-REP-051** [P] Modelar `TomaOrden` con estado, inicio y fin,
      y el enum `EstadoTomaOrden`.
      → `app/backend/app/domain/models/reparacion.py::TomaOrden`,
        `app/backend/app/domain/models/enums.py::EstadoTomaOrden`
      → test: `tests/test_hp_rep_001.py::test_no_queda_ninguna_toma_activa`
- [x] **TASK-REP-052** [P] Definir `RolUsuario` con los cuatro roles
      operativos del MVP.
      → `app/backend/app/domain/models/enums.py::RolUsuario`
      → test: `tests/test_services_autorizacion.py::test_el_happy_path_usa_los_cuatro_actores_correctos`
- [x] **TASK-REP-053** Implementar los helpers de consulta sobre la
      Orden: `toma_activa`, `hay_ejecucion_activa`,
      `estacion_habilitada_para`, `buscar_detalle`.
      → `app/backend/app/services/tomas.py`
      → test: `tests/test_services_invariantes.py::test_no_puede_haber_dos_tomas_activas`

## Phase 2: User Story `US-REP-005` — Ordenar el trabajo pendiente (P1)

**Goal**: dejar la Orden disponible y priorizada para los tecnicos.

**Independent Test**: tramo 3 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-054** [US-REP-005] Implementar `definir_prioridad`
      (`PROC-REP-150`) con actor `ACT-COORD` y prioridad no negativa.
      → `app/backend/app/services/ordenes.py::definir_prioridad`
      → test: `tests/test_services_invariantes.py::test_la_prioridad_no_puede_ser_negativa`,
        `tests/test_services_autorizacion.py::test_coordinador_puede_definir_prioridad`,
        `::test_solo_el_coordinador_puede_definir_prioridad`
- [x] **TASK-REP-055** [US-REP-005] Implementar `ingresar_a_cola`
      (`PROC-REP-170`) como `ACT-SYSTEM`, impidiendo el reingreso.
      → `app/backend/app/services/ordenes.py::ingresar_a_cola`
      → test: `tests/test_services_invariantes.py::test_no_se_ingresa_dos_veces_a_la_cola`

**Checkpoint**: `US-REP-005` entregable de forma independiente.

---

## Phase 3: User Story `US-REP-006` — Tomar una Orden desde una Estacion compatible (P1) — MVP

**Goal**: pasar el trabajo de disponible a en curso, con un unico
responsable.

**Independent Test**: tramo 4 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-056** [US-REP-006] Implementar
      `validar_estacion_trabajo` (`PROC-REP-172`) con las validaciones de
      `BR-REP-011-A` implementadas (rol/usuario activo, estacion
      `OPERATIVA`, sin Ejecucion activa, al menos un Detalle compatible),
      devolviendo `(Orden, bool)`.
      → `app/backend/app/services/tomas.py::validar_estacion_trabajo`
      → test: `tests/test_services_invariantes.py::test_estacion_incompatible_no_supera_la_validacion_agregada`,
        `::test_la_validacion_de_estacion_rechaza_una_orden_ya_tomada`,
        `::test_usuario_sin_rol_tecnico_no_supera_la_validacion`
- [x] **TASK-REP-057** [US-REP-006] Registrar `PROC-REP-172` en el
      historial tanto si la validacion pasa como si falla.
      → `app/backend/app/services/tomas.py::_registrar_validacion_estacion`
      → test: `tests/test_hp_rep_001_persistido.py::test_la_orden_persistida_recorre_los_nodos_del_scenario`
- [x] **TASK-REP-058** [US-REP-006] Implementar `tomar_orden`
      (`PROC-REP-180`) abriendo la participacion activa con tecnico,
      estacion y fecha/hora, exigiendo Orden `EN_COLA`.
      → `app/backend/app/services/tomas.py::tomar_orden`
      → test: `tests/test_services_invariantes.py::test_no_se_toma_una_orden_que_no_esta_en_cola`,
        `::test_no_puede_haber_dos_tomas_activas`,
        `tests/test_services_invariantes.py::test_tomar_orden_no_muta_la_orden_recibida`
- [x] **TASK-REP-059** [US-REP-006] Exigir actor `ACT-TECH` activo en la
      validacion de estacion y en la toma.
      → test: `tests/test_services_autorizacion.py::test_tecnico_puede_tomar_orden`,
        `::test_solo_un_tecnico_puede_tomar_orden`,
        `::test_la_validacion_de_estacion_rechaza_a_quien_no_es_tecnico`
- [x] **TASK-REP-060** [US-REP-006] Garantizar que tomar la Orden no
      inicia ninguna Ejecucion.
      → test: `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`
        (la Ejecucion aparece recien tras `PROC-REP-185`)

**Checkpoint**: `US-REP-006` entregable de forma independiente.

---

## Phase 4: Fuera del slice — NO implementado

Corresponden a `FEAT-REP-004` completa. Sin codigo ni test.

- [ ] **TASK-REP-061** Implementar `PROC-REP-212` (decision explicita del
      tecnico: continuar con otro Detalle o liberar la Orden,
      `BR-REP-018`).
- [ ] **TASK-REP-062** Implementar `PROC-REP-213` (liberar Orden:
      cerrar la participacion con fecha/hora de fin y devolver la Orden a
      `EN_COLA`).
- [ ] **TASK-REP-063** Implementar la gestion de sesion del tecnico, para
      cubrir la validacion (1) de `BR-REP-011-A` tal como esta redactada.
- [ ] **TASK-REP-064** Implementar el catalogo definitivo de prioridades
      (hoy la prioridad es un entero no negativo sin catalogo).
- [ ] **TASK-REP-065** Ejercitar una Orden con varios Detalles donde solo
      algunos son compatibles con la Estacion (`BR-REP-011-A`: basta uno).
- [ ] **TASK-REP-066** Implementar el reporting por tecnico basado en el
      historial de participaciones (pendiente declarado en
      `docs/discovery/README.md`).

---

## Dependencies & Execution Order

```text
(FEAT-REP-003: Orden HABILITADA)
  └── TASK-REP-050 .. TASK-REP-052   (paralelizables)
        └── TASK-REP-053
              ├── TASK-REP-054 → TASK-REP-055            (US-REP-005)
              └── TASK-REP-056 → TASK-REP-057
                    → TASK-REP-058 → TASK-REP-059 → TASK-REP-060  (US-REP-006)
```

`US-REP-006` depende de `US-REP-005` (solo se toma una Orden `EN_COLA`).

## Estado real de implementacion

| Fase | Tareas | `[x]` con evidencia codigo+test | `[ ]` |
|---|---|---|---|
| Foundational | 4 | 4 | 0 |
| `US-REP-005` | 2 | 2 | 0 |
| `US-REP-006` | 5 | 5 | 0 |
| Fuera del slice | 6 | 0 | 6 |
| **Total** | **17** | **11** | **6** |
