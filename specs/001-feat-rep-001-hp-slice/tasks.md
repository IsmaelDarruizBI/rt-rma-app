---
description: "Tareas reconstruidas del slice HP-REP-001 de FEAT-REP-001"
---

# Tasks: Ingreso y creacion de Orden de Reparacion — Implemented slice: HP-REP-001

**Input**: Design documents from `/specs/001-feat-rep-001-hp-slice/`

**Prerequisites**: `spec.md`, `plan.md`

> **Reconstruccion brownfield.** Estas tareas NO son trabajo a ejecutar:
> describen el trabajo que **efectivamente produjo** la implementacion
> existente en la baseline `3788d87`. Una tarea se marca `[x]` unicamente
> cuando existe evidencia real de **codigo Y test**. Si algo esta
> previsto por el Business Process pero no implementado, queda `[ ]`.
> **No ejecutar `/speckit.implement` sobre este archivo.**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pudo hacerse en paralelo (archivos distintos, sin dependencia)
- **[Story]**: User Story a la que pertenece (`US-REP-001`, `US-REP-002`)

## Phase 1: Setup (Shared Infrastructure)

- [x] **TASK-REP-001** Crear el scaffold del backend con las cuatro capas
      (`api`, `services`, `repositories`, `storage`) y `domain` aislado,
      con `pyproject.toml`, Ruff (`line-length = 79`) y pytest.
      → `app/backend/pyproject.toml`, `app/backend/README.md`
      → evidencia: `app/backend/app/main.py`, `app/backend/app/api/health.py`
- [x] **TASK-REP-002** [P] Definir los enums cerrados del dominio
      limitados al alcance de `HP-REP-001` (`OrigenOrden` con unico valor
      `CLIENTE_EXTERNO`, `EstadoWorkflow` sin `CANCELADA`/`EN_REVISION`).
      → `app/backend/app/domain/models/enums.py`
      → test: `tests/test_modelos_dominio.py::test_estado_detalle_solo_tiene_el_ciclo_tecnico`

## Phase 2: Foundational (Blocking Prerequisites)

- [x] **TASK-REP-003** Modelar el aggregate raiz `OrdenReparacion` con
      sus colecciones transaccionales y referencias por ID a catalogos.
      → `app/backend/app/domain/models/orden_reparacion.py`
      → test: `tests/test_hp_rep_001.py::test_los_catalogos_no_se_embeben_en_la_orden`
- [x] **TASK-REP-004** [P] Modelar `Cliente`, `Usuario` y `Equipo` con
      validacion declarativa de campos obligatorios.
      → `app/backend/app/domain/models/personas.py`, `equipos.py`
      → test: `tests/test_modelos_dominio.py::test_cliente_requiere_nombre_y_telefono`
- [x] **TASK-REP-005** [P] Modelar `HistorialWorkflow` e implementar
      `registrar_paso` como unico mecanismo de registro de recorrido.
      → `app/backend/app/domain/models/workflow.py`,
        `app/backend/app/services/workflow.py`
      → test: `tests/test_hp_rep_001.py::test_el_historial_conserva_los_ids_funcionales`
- [x] **TASK-REP-006** [P] Implementar el servicio de autorizacion por
      rol y estado del usuario (`validar_actor`, `validar_usuario_activo`)
      y la jerarquia de errores de dominio.
      → `app/backend/app/services/autorizacion.py`, `exceptions.py`
      → test: `tests/test_services_autorizacion.py::test_validar_actor_rechaza_un_rol_distinto`
- [x] **TASK-REP-007** [P] Implementar el generador centralizado de IDs
      de entidades transaccionales.
      → `app/backend/app/services/identificadores.py`
      → evidencia indirecta: IDs presentes en todas las entidades creadas
        por los tests E2E

**Checkpoint**: base de dominio lista; los slices pueden implementarse.

---

## Phase 3: User Story `US-REP-001` — Registrar el ingreso (Priority: P1) — MVP

**Goal**: dejar formalmente creada la Orden de cliente externo.

**Independent Test**: `tests/test_hp_rep_001_services.py::test_hp_rep_001_end_to_end`
(tramo de creacion) y el recorrido verificado en
`test_hp_rep_001_recorre_los_nodos_del_scenario`.

- [x] **TASK-REP-008** [US-REP-001] Implementar
      `crear_orden_cliente_externo` cubriendo `PROC-REP-010` (rama
      `CLIENTE_EXTERNO`) → `PROC-REP-030` → `PROC-REP-040`, devolviendo
      una Orden nueva en `REQUERIMIENTO` sin Detalles.
      → `app/backend/app/services/ordenes.py::crear_orden_cliente_externo`
      → test: `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`
- [x] **TASK-REP-009** [US-REP-001] Exigir actor `ACT-RECEP` activo en la
      creacion de la Orden, sin efectos colaterales ante rechazo.
      → test: `tests/test_services_autorizacion.py::test_solo_recepcion_puede_crear_orden`,
        `::test_una_autorizacion_fallida_no_modifica_la_orden`
- [x] **TASK-REP-010** [US-REP-001] Registrar los tres pasos de proceso
      del ingreso en el historial, con fecha y usuario responsable.
      → test: `tests/test_hp_rep_001_persistido.py::test_la_orden_persistida_recorre_los_nodos_del_scenario`

**Checkpoint**: `US-REP-001` entregable de forma independiente.

---

## Phase 4: User Story `US-REP-002` — Comprobante de recepcion (Priority: P2)

**Goal**: acreditar al cliente la recepcion del equipo.

**Independent Test**: `tests/test_hp_rep_001.py::test_los_documentos_finales_fueron_generados`
(porcion de comprobante de recepcion) y el tramo 2 del E2E persistido.

- [x] **TASK-REP-011** [US-REP-002] Modelar `Documento` y
      `DocumentosOrden` con el hecho "generado + fecha".
      → `app/backend/app/domain/models/documentos.py`
      → test: `tests/test_repositories_json.py::test_el_round_trip_conserva_tipos_y_trazabilidad`
- [x] **TASK-REP-012** [US-REP-002] Implementar
      `generar_comprobante_recepcion` cubriendo `PROC-REP-050` (rama
      `Si`) → `PROC-REP-060`, sin parametro `usuario` por ser
      `ACT-SYSTEM`.
      → `app/backend/app/services/documentos.py::generar_comprobante_recepcion`
      → test: `tests/test_services_autorizacion.py::test_los_nodos_de_sistema_no_reciben_usuario`,
        `::test_el_historial_de_los_nodos_de_sistema_no_tiene_usuario`

---

## Phase 5: Fuera del slice — NO implementado

Estas tareas corresponden a `FEAT-REP-001` completa pero **no** al slice
que `HP-REP-001` recorre. Quedan sin marcar porque **no existe codigo ni
test** que las respalde.

- [ ] **TASK-REP-013** Implementar el origen `RT_INTERNO`
      (`PROC-REP-020`): referencia y contexto del equipo desde Gestion RT.
- [ ] **TASK-REP-014** Implementar el origen `RT_GARANTIA_VENTA`
      (`PROC-REP-025`): referencia de garantia de venta RT.
- [ ] **TASK-REP-015** Implementar el origen `RMA_GARANTIA_REPARACION`
      (`PROC-REP-035`): relacion con la Orden de Reparacion origen.
- [ ] **TASK-REP-016** Implementar la rama `No` de `PROC-REP-050`
      (Ordenes que no requieren comprobante de recepcion, `RT_INTERNO`).
- [ ] **TASK-REP-017** Generar el artefacto imprimible del comprobante de
      recepcion (hoy solo se registra el hecho "generado + fecha").

---

## Dependencies & Execution Order

```text
TASK-REP-001
  └── TASK-REP-002 .. TASK-REP-007   (foundational, paralelizables)
        ├── TASK-REP-008 → TASK-REP-009 → TASK-REP-010   (US-REP-001)
        └── TASK-REP-011 → TASK-REP-012                  (US-REP-002)
```

`US-REP-002` depende de que exista una Orden creada (`US-REP-001`).

## Estado real de implementacion

| Fase | Tareas | `[x]` con evidencia codigo+test | `[ ]` |
|---|---|---|---|
| Setup | 2 | 2 | 0 |
| Foundational | 5 | 5 | 0 |
| `US-REP-001` | 3 | 3 | 0 |
| `US-REP-002` | 2 | 2 | 0 |
| Fuera del slice | 5 | 0 | 5 |
| **Total** | **17** | **12** | **5** |
