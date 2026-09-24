---
description: "Tareas reconstruidas del slice HP-REP-001 de FEAT-REP-007"
---

# Tasks: Gestion comercial y pagos de la Orden — Implemented slice: HP-REP-001

**Input**: Design documents from `/specs/007-feat-rep-007-hp-slice/`

**Prerequisites**: `spec.md`, `plan.md`, y los slices de `FEAT-REP-002` y
`FEAT-REP-006`

> **Reconstruccion brownfield.** `[x]` solo con evidencia real de codigo
> **Y** test. **No ejecutar `/speckit.implement`.**

## Phase 1: Foundational

- [x] **TASK-REP-106** [P] Modelar `Pago` (importe > 0, medio, usuario,
      fecha) y `ResumenPago` con `pagado` derivado.
      → `app/backend/app/domain/models/pagos.py::Pago`, `::ResumenPago`
      → test: `tests/test_modelos_dominio.py::test_monto_de_pago_debe_ser_mayor_a_cero`,
        `::test_pagado_suma_los_pagos_registrados`,
        `::test_pagado_sin_pagos_es_cero`,
        `::test_resumen_pago_no_almacena_total`
- [x] **TASK-REP-107** [P] Definir `EstadoPago` con los tres estados
      derivados.
      → `app/backend/app/domain/models/enums.py::EstadoPago`
      → test: `tests/test_modelos_dominio.py::test_estado_pago_recorre_los_tres_estados`
- [x] **TASK-REP-108** Implementar `saldo` y `estado_pago` como
      `computed_field`, distinguiendo "sin Detalles" de "total cero".
      → `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.saldo`,
        `::OrdenReparacion.estado_pago`
      → test: `tests/test_modelos_dominio.py::test_saldo_es_total_menos_pagado`,
        `::test_estado_pago_distingue_sin_detalles_de_total_cero`

## Phase 2: User Story `US-REP-012` — Registrar los pagos cuando ocurren (P1) — MVP

**Independent Test**: tramo 9 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-109** [US-REP-012] Implementar `registrar_pago` como
      capacidad **transversal**: sin `registrar_paso`, sin tocar
      `current_process`, sin historial de workflow.
      → `app/backend/app/services/pagos.py::registrar_pago`
      → test: `tests/test_services_invariantes.py::test_registrar_pago_no_cambia_el_nodo_actual`,
        `::test_registrar_pago_no_muta_la_orden_recibida`
- [x] **TASK-REP-110** [US-REP-012] Validar importe positivo y usuario
      activo, **sin** exigir rol (pendiente funcional de `BR-REP-017`).
      → `app/backend/app/services/autorizacion.py::validar_usuario_activo`
      → test: `tests/test_services_autorizacion.py::test_registrar_pago_no_exige_un_rol_concreto`,
        `::test_registrar_pago_rechaza_un_usuario_inactivo`,
        `::test_validar_usuario_activo_solo_mira_el_estado`

**Checkpoint**: `US-REP-012` entregable de forma independiente.

---

## Phase 3: User Story `US-REP-013` — No entregar con saldo pendiente (P1) — MVP

**Independent Test**: tramos 8 y 9 de
`tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`.

- [x] **TASK-REP-111** [US-REP-013] Implementar
      `validar_condicion_entrega` (`PROC-REP-265`) devolviendo
      `(Orden, bool)` y registrando el paso en cada evaluacion.
      → `app/backend/app/services/pagos.py::validar_condicion_entrega`
      → test: `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`
        (`puede_entregar` `False` y luego `True`)
- [x] **TASK-REP-112** [US-REP-013] Implementar
      `registrar_saldo_pendiente` (`PROC-REP-266`) sin agregar estado
      nuevo a la Orden.
      → `app/backend/app/services/pagos.py::registrar_saldo_pendiente`
      → test: `tests/test_hp_rep_001_persistido.py::test_la_orden_persistida_recorre_los_nodos_del_scenario`
        (`PROC-REP-265` aparece dos veces, con `PROC-REP-266` en medio)
- [x] **TASK-REP-113** [US-REP-013] Impedir la entrega con saldo
      pendiente, sin override.
      → test: `tests/test_services_invariantes.py::test_entrega_con_saldo_pendiente_falla`
- [x] **TASK-REP-114** [US-REP-013] Exigir la condicion de entrega
      aprobada antes de generar el comprobante final (`PROC-REP-280`
      despues de `PROC-REP-265`).
      → `app/backend/app/services/documentos.py::generar_comprobante_final`
      → test: `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end`

**Checkpoint**: `US-REP-013` entregable de forma independiente.

---

## Phase 4: User Story `US-REP-014` — Saber siempre cuanto debe el cliente (P2)

**Independent Test**: `tests/test_modelos_dominio.py` (bloque de
derivados) y `tests/test_repositories_json.py` (round-trip).

- [x] **TASK-REP-115** [US-REP-014] Garantizar que total, saldo y estado
      de cobro reaccionan a cambios de Detalles y de pagos.
      → test: `tests/test_modelos_dominio.py::test_cambiar_el_precio_de_un_detalle_actualiza_total_y_saldo`,
        `::test_agregar_un_detalle_actualiza_total_y_saldo`
- [x] **TASK-REP-116** [US-REP-014] Garantizar que los derivados no se
      persisten y se recalculan al cargar.
      → `app/backend/app/storage/json/ordenes.py::JsonOrdenReparacionRepository`
      → test: `tests/test_repositories_json.py::test_el_json_no_guarda_el_pagado_del_resumen`,
        `::test_una_orden_a_medio_flujo_tampoco_guarda_derivados`,
        `::test_los_derivados_se_recalculan_al_cargar`
- [x] **TASK-REP-117** [US-REP-014] Cubrir los cuatro casos del estado de
      cobro (sin Detalles, total cero, parcial, pagado).
      → test: `tests/test_modelos_dominio.py::test_estado_pago_pendiente_sin_detalles`,
        `::test_estado_pago_pagado_con_detalle_de_precio_cero`,
        `::test_estado_pago_pendiente_sin_pagos`,
        `::test_estado_pago_parcial_con_saldo_pendiente`,
        `::test_estado_pago_pagado_con_saldo_cero`

---

## Phase 5: Fuera del slice — NO implementado

Corresponden a `FEAT-REP-007` completa. Sin codigo ni test.

- [ ] **TASK-REP-118** Implementar los Ajustes Comerciales y las
      Cortesias (`BR-REP-016`): `CORTESIA_DETALLE`, `CORTESIA_ORDEN`,
      autorizadas solo por `ACT-ADMIN` con motivo obligatorio.
- [ ] **TASK-REP-119** Implementar la Base Comercial como concepto
      distinto del Subtotal (hoy coinciden porque no hay ajustes).
- [ ] **TASK-REP-120** Implementar las condiciones de entrega
      alternativas de `BR-REP-017-B`: cortesia total y condicion no
      cobrable por origen.
- [ ] **TASK-REP-121** Implementar el catalogo configurable de medios de
      pago (hoy `metodo` es texto libre).
- [ ] **TASK-REP-122** Implementar la referencia/comprobante del pago
      (`BR-REP-017-A`).
- [ ] **TASK-REP-123** Definir e implementar que rol puede registrar un
      pago (pendiente funcional declarado en el codigo).
- [ ] **TASK-REP-124** Implementar la exclusion de los Detalles
      `CANCELADO` del Subtotal (`BR-REP-015`); requiere `FEAT-REP-009`.
- [ ] **TASK-REP-125** Implementar impuestos, recargos y descuentos entre
      Base Comercial y Total Cobrable (fuera de V1.3).
- [ ] **TASK-REP-126** Implementar multi-moneda y reembolsos (fuera de
      V1.3).

---

## Dependencies & Execution Order

```text
(FEAT-REP-002: precio snapshot)  (FEAT-REP-006: REPARACION_LISTA)
  └── TASK-REP-106, TASK-REP-107  (paralelizables)
        └── TASK-REP-108
              ├── TASK-REP-109 → TASK-REP-110                  (US-REP-012)
              ├── TASK-REP-111 → TASK-REP-112 → TASK-REP-113
              │     → TASK-REP-114                              (US-REP-013)
              └── TASK-REP-115 → TASK-REP-116 → TASK-REP-117    (US-REP-014)
```

## Estado real de implementacion

| Fase | Tareas | `[x]` con evidencia codigo+test | `[ ]` |
|---|---|---|---|
| Foundational | 3 | 3 | 0 |
| `US-REP-012` | 2 | 2 | 0 |
| `US-REP-013` | 4 | 4 | 0 |
| `US-REP-014` | 3 | 3 | 0 |
| Fuera del slice | 9 | 0 | 9 |
| **Total** | **21** | **12** | **9** |
