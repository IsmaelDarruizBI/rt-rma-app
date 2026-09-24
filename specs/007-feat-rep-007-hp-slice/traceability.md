# Traceability: FEAT-REP-007 — Implemented slice HP-REP-001

Vista narrativa. La fuente machine-readable es
`traceability/hp-rep-001.yaml` (items + links).

## Cobertura

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |
| Nodos de la Feature | 6 (`265`, `266`, `070`, `075`, `127`, `280`) |
| Nodos dentro del slice | 4 (`265`, `266`, `070`, `280`) |
| Nodos fuera del slice | 2 (`075`, `127`) |
| Capacidad transversal | Registrar Pago (`BR-REP-017-A`, sin nodo propio) |

> `PROC-REP-070` es nodo compartido con `FEAT-REP-002`; `PROC-REP-280` lo
> es con `FEAT-REP-008`. `Registrar Pago` aparece en `HP-REP-001` como
> paso `FUNCTIONAL_ACTION`, **no** como nodo: no se le asigna
> `PROC-REP-*`.

## User Story -> System Action

| US | Titulo | ACC | Nodos |
|---|---|---|---|
| `US-REP-012` | Registrar los pagos del cliente cuando ocurren | `ACC-REP-020` | **ninguno** (transversal) |
| `US-REP-013` | No entregar un equipo con saldo pendiente | `ACC-REP-021` | `PROC-REP-265` |
| `US-REP-013` | — | `ACC-REP-022` | `PROC-REP-266` |
| `US-REP-014` | Saber siempre cuanto debe el cliente | `ACC-REP-023` | transversal (derivados) |

### System Actions

- **`ACC-REP-020`** — **Registrar Pago (capacidad transversal).**
  Registrar un pago de la Orden con importe, medio, fecha/hora y usuario,
  en cualquier momento de su vida. **No corresponde a ningun
  `PROC-REP-*`**: `HP-REP-001` la declara como paso
  `kind: FUNCTIONAL_ACTION` con `feature: FEAT-REP-007`.
  Regla: `BR-REP-017-A`.
- **`ACC-REP-021`** — Determinar el importe a cobrar y el saldo, y
  validar la condicion de entrega. Nodo `PROC-REP-265`.
  Regla: `BR-REP-017-B`.
- **`ACC-REP-022`** — Registrar que la entrega queda bloqueada por saldo
  pendiente. Nodo `PROC-REP-266`. Regla: `BR-REP-017-B`.
- **`ACC-REP-023`** — Mantener derivados el importe a cobrar, lo pagado,
  el saldo y el estado de cobro. Capacidad transversal sin nodo.
  Reglas: `BR-REP-015`, `BR-REP-017`.

## System Action -> Functional Requirement

| ACC | FR |
|---|---|
| `ACC-REP-020` | `FR-REP-045`, `FR-REP-046`, `FR-REP-047`, `FR-REP-048` |
| `ACC-REP-021` | `FR-REP-051`, `FR-REP-053`, `FR-REP-054` |
| `ACC-REP-022` | `FR-REP-052` |
| `ACC-REP-023` | `FR-REP-049`, `FR-REP-050` |

## Functional Requirement -> Technical Requirement

| FR | TR |
|---|---|
| `FR-REP-045` | `TR-REP-040`, `TR-REP-008` |
| `FR-REP-046` | `TR-REP-040` |
| `FR-REP-047` | `TR-REP-002` |
| `FR-REP-048` | `TR-REP-045` |
| `FR-REP-049` | `TR-REP-041`, `TR-REP-004`, `TR-REP-017` |
| `FR-REP-050` | `TR-REP-042`, `TR-REP-041` |
| `FR-REP-051` | `TR-REP-043`, `TR-REP-020` |
| `FR-REP-052` | `TR-REP-043`, `TR-REP-044` |
| `FR-REP-053` | `TR-REP-020`, `TR-REP-043` |
| `FR-REP-054` | `TR-REP-046` |

## Technical Requirement -> Task -> Code

| TR | TASK | CODE (archivo::simbolo) |
|---|---|---|
| `TR-REP-040` | `TASK-REP-109` | `app/backend/app/services/pagos.py::registrar_pago` |
| `TR-REP-041` | `TASK-REP-108`, `TASK-REP-115` | `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.saldo`, `::OrdenReparacion.estado_pago`, `app/backend/app/domain/models/pagos.py::ResumenPago.pagado` |
| `TR-REP-042` | `TASK-REP-108`, `TASK-REP-117` | `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.estado_pago` |
| `TR-REP-043` | `TASK-REP-111` | `app/backend/app/services/pagos.py::validar_condicion_entrega` |
| `TR-REP-044` | `TASK-REP-112` | `app/backend/app/services/pagos.py::registrar_saldo_pendiente` |
| `TR-REP-045` | `TASK-REP-110` | `app/backend/app/services/autorizacion.py::validar_usuario_activo` |
| `TR-REP-046` | `TASK-REP-114` | `app/backend/app/services/documentos.py::generar_comprobante_final` |
| `TR-REP-002` | `TASK-REP-106` | `app/backend/app/domain/models/pagos.py::Pago` |
| `TR-REP-004` | `TASK-REP-116` | `app/backend/app/storage/json/ordenes.py::JsonOrdenReparacionRepository` |
| `TR-REP-008` | `TASK-REP-109` | `app/backend/app/services/pagos.py::registrar_pago` |
| `TR-REP-017` | `TASK-REP-116` | `app/backend/app/storage/json/base.py::escribir_json_atomico` |
| `TR-REP-020` | `TASK-REP-111`, `TASK-REP-113` | `app/backend/app/services/exceptions.py::PrecondicionInvalidaError` |
| — (estados) | `TASK-REP-107` | `app/backend/app/domain/models/enums.py::EstadoPago` |

## Internal Tests (existentes, no duplicados)

| TEST (archivo::funcion) | Verifica |
|---|---|
| `tests/test_services_invariantes.py::test_registrar_pago_no_cambia_el_nodo_actual` | `FR-REP-046`, `TR-REP-040` |
| `tests/test_services_invariantes.py::test_registrar_pago_no_muta_la_orden_recibida` | `TR-REP-008` |
| `tests/test_services_invariantes.py::test_entrega_con_saldo_pendiente_falla` | `FR-REP-053`, `TR-REP-020` |
| `tests/test_services_autorizacion.py::test_registrar_pago_no_exige_un_rol_concreto` | `FR-REP-048`, `TR-REP-045` |
| `tests/test_services_autorizacion.py::test_registrar_pago_rechaza_un_usuario_inactivo` | `FR-REP-048`, `TR-REP-045` |
| `tests/test_services_autorizacion.py::test_validar_usuario_activo_solo_mira_el_estado` | `TR-REP-045` |
| `tests/test_modelos_dominio.py::test_monto_de_pago_debe_ser_mayor_a_cero` | `FR-REP-047`, `TR-REP-002` |
| `tests/test_modelos_dominio.py::test_pagado_suma_los_pagos_registrados` | `FR-REP-049`, `TR-REP-041` |
| `tests/test_modelos_dominio.py::test_pagado_sin_pagos_es_cero` | `FR-REP-049` |
| `tests/test_modelos_dominio.py::test_resumen_pago_no_almacena_total` | `FR-REP-049`, `TR-REP-041` |
| `tests/test_modelos_dominio.py::test_saldo_es_total_menos_pagado` | `FR-REP-049`, `TR-REP-041` |
| `tests/test_modelos_dominio.py::test_estado_pago_pendiente_sin_detalles` | `FR-REP-050`, `TR-REP-042` |
| `tests/test_modelos_dominio.py::test_estado_pago_pagado_con_detalle_de_precio_cero` | `FR-REP-050`, `TR-REP-042` |
| `tests/test_modelos_dominio.py::test_estado_pago_distingue_sin_detalles_de_total_cero` | `FR-REP-050`, `TR-REP-042` |
| `tests/test_modelos_dominio.py::test_estado_pago_pendiente_sin_pagos` | `FR-REP-050` |
| `tests/test_modelos_dominio.py::test_estado_pago_parcial_con_saldo_pendiente` | `FR-REP-050` |
| `tests/test_modelos_dominio.py::test_estado_pago_pagado_con_saldo_cero` | `FR-REP-050` |
| `tests/test_modelos_dominio.py::test_estado_pago_recorre_los_tres_estados` | `FR-REP-050` |
| `tests/test_hp_rep_001.py::test_el_saldo_final_es_cero` | `FR-REP-051`, `FR-REP-053` |
| `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end` | `FR-REP-051`, `FR-REP-052`, `FR-REP-054` |
| `tests/test_hp_rep_001_persistido.py::test_la_orden_persistida_recorre_los_nodos_del_scenario` | `FR-REP-052`, `TR-REP-043` |
| `tests/test_repositories_json.py::test_el_json_no_guarda_el_pagado_del_resumen` | `FR-REP-049`, `TR-REP-004` |
| `tests/test_repositories_json.py::test_una_orden_a_medio_flujo_tampoco_guarda_derivados` | `TR-REP-004` |

## UAT (todos `PENDING`)

| UAT | Valida | Estado |
|---|---|---|
| `UAT-REP-012` | `US-REP-012`, `FR-REP-045`, `FR-REP-046` | `PENDING` |
| `UAT-REP-013` | `US-REP-013`, `FR-REP-051`, `FR-REP-052`, `FR-REP-053` | `PENDING` |
| `UAT-REP-014` | `US-REP-014`, `FR-REP-049`, `FR-REP-050` | `PENDING` |
