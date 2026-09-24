# Traceability: FEAT-REP-001 — Implemented slice HP-REP-001

Representacion legible de la cadena de este slice. La fuente
machine-readable es `traceability/hp-rep-001.yaml` (items + links);
este documento es su vista narrativa y **no** debe divergir de aquella.

```text
DOM-RMA -> PROC-REP (V1.3) -> FEAT-REP-001 -> US -> ACC -> FR -> TR -> TASK -> CODE -> TEST -> UAT
```

## Cobertura

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |
| Nodos de la Feature | 8 (`010`, `020`, `025`, `030`, `035`, `040`, `050`, `060`) |
| Nodos dentro del slice | 5 (`010`, `030`, `040`, `050`, `060`) |
| Nodos fuera del slice | 3 (`020`, `025`, `035`) |

## User Story -> System Action

| US | Titulo | ACC | Nodos |
|---|---|---|---|
| `US-REP-001` | Registrar el ingreso de un equipo de cliente externo | `ACC-REP-001` | `PROC-REP-010`, `PROC-REP-030`, `PROC-REP-040` |
| `US-REP-001` | — | `ACC-REP-003` | transversal (historial) |
| `US-REP-002` | Entregar al cliente el comprobante de recepcion | `ACC-REP-002` | `PROC-REP-050`, `PROC-REP-060` |

### System Actions

- **`ACC-REP-001`** — Crear la Orden de Reparacion de origen
  `CLIENTE_EXTERNO` a partir del cliente y del equipo registrados,
  dejandola en `REQUERIMIENTO` sin Detalles.
  Nodos `PROC-REP-010` (decision de origen), `PROC-REP-030` y
  `PROC-REP-040` se agrupan en una unica System Action porque son **una
  misma responsabilidad**: formalizar el ingreso. La decision de origen
  no merece ACC propia.
  Reglas: `BR-REP-013`.
- **`ACC-REP-002`** — Emitir el comprobante de recepcion de la Orden.
  Nodos `PROC-REP-050` (rama `Si`) y `PROC-REP-060`.
- **`ACC-REP-003`** — Registrar en el historial de la Orden cada paso del
  proceso recorrido, con su fecha y su responsable cuando lo hay.
  **Capacidad transversal sin nodo `PROC-REP-*` propio**: la usan todos
  los slices; se declara aqui porque es donde la Orden nace.

## System Action -> Functional Requirement

| ACC | FR |
|---|---|
| `ACC-REP-001` | `FR-REP-001`, `FR-REP-002` |
| `ACC-REP-002` | `FR-REP-003` |
| `ACC-REP-003` | `FR-REP-004`, `FR-REP-005` |

## Functional Requirement -> Technical Requirement

| FR | TR |
|---|---|
| `FR-REP-001` | `TR-REP-001`, `TR-REP-002`, `TR-REP-003`, `TR-REP-008`, `TR-REP-024` |
| `FR-REP-002` | `TR-REP-009`, `TR-REP-020` |
| `FR-REP-003` | `TR-REP-008`, `TR-REP-010` |
| `FR-REP-004` | `TR-REP-001`, `TR-REP-003`, `TR-REP-010`, `TR-REP-011`, `TR-REP-021` |
| `FR-REP-005` | `TR-REP-001`, `TR-REP-011` |

## Technical Requirement -> Task -> Code

| TR | TASK | CODE (archivo::simbolo) |
|---|---|---|
| `TR-REP-001` | `TASK-REP-003` | `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion` |
| `TR-REP-002` | `TASK-REP-004` | `app/backend/app/domain/models/personas.py::Cliente`, `::Usuario`, `app/backend/app/domain/models/equipos.py::Equipo` |
| `TR-REP-003` | `TASK-REP-001` | `app/backend/app/domain/models/__init__.py` (capa `domain` sin infraestructura) |
| `TR-REP-008` | `TASK-REP-008`, `TASK-REP-012` | `app/backend/app/services/ordenes.py::crear_orden_cliente_externo`, `app/backend/app/services/documentos.py::generar_comprobante_recepcion` |
| `TR-REP-009` | `TASK-REP-006`, `TASK-REP-009` | `app/backend/app/services/autorizacion.py::validar_actor`, `::validar_usuario_activo`, `::actor_valido` |
| `TR-REP-010` | `TASK-REP-012` | `app/backend/app/services/documentos.py::generar_comprobante_recepcion` |
| `TR-REP-011` | `TASK-REP-005`, `TASK-REP-010` | `app/backend/app/services/workflow.py::registrar_paso`, `app/backend/app/domain/models/workflow.py::HistorialWorkflow` |
| `TR-REP-020` | `TASK-REP-006` | `app/backend/app/services/exceptions.py::DomainError`, `::PrecondicionInvalidaError` |
| `TR-REP-021` | `TASK-REP-008` | docstrings de `app/backend/app/services/ordenes.py` |
| `TR-REP-024` | `TASK-REP-007` | `app/backend/app/services/identificadores.py::nuevo_id` |
| — (documentos) | `TASK-REP-011` | `app/backend/app/domain/models/documentos.py::Documento`, `::DocumentosOrden` |
| — (enums) | `TASK-REP-002` | `app/backend/app/domain/models/enums.py::OrigenOrden`, `::EstadoWorkflow` |

## Internal Tests (existentes, no duplicados)

| TEST (archivo::funcion) | Verifica |
|---|---|
| `tests/test_hp_rep_001_services.py::test_hp_rep_001_end_to_end` | `FR-REP-001`, `FR-REP-003` |
| `tests/test_hp_rep_001_persistido.py::test_hp_rep_001_persistido_end_to_end` | `FR-REP-001`, `FR-REP-003` |
| `tests/test_hp_rep_001_persistido.py::test_la_orden_persistida_recorre_los_nodos_del_scenario` | `FR-REP-004`, `FR-REP-005` |
| `tests/test_hp_rep_001_services.py::test_hp_rep_001_recorre_los_nodos_del_scenario` | `FR-REP-004` |
| `tests/test_hp_rep_001.py::test_el_historial_conserva_los_ids_funcionales` | `FR-REP-004`, `TR-REP-011` |
| `tests/test_hp_rep_001.py::test_los_catalogos_no_se_embeben_en_la_orden` | `TR-REP-001` |
| `tests/test_hp_rep_001.py::test_los_documentos_finales_fueron_generados` | `FR-REP-003` |
| `tests/test_modelos_dominio.py::test_cliente_requiere_nombre_y_telefono` | `TR-REP-002` |
| `tests/test_modelos_dominio.py::test_cliente_email_es_opcional` | `TR-REP-002` |
| `tests/test_services_autorizacion.py::test_validar_actor_acepta_el_rol_correcto` | `FR-REP-002`, `TR-REP-009` |
| `tests/test_services_autorizacion.py::test_validar_actor_rechaza_un_rol_distinto` | `FR-REP-002`, `TR-REP-009` |
| `tests/test_services_autorizacion.py::test_validar_actor_rechaza_un_usuario_inactivo` | `FR-REP-002` |
| `tests/test_services_autorizacion.py::test_recepcion_puede_crear_orden` | `FR-REP-002` |
| `tests/test_services_autorizacion.py::test_solo_recepcion_puede_crear_orden` | `FR-REP-002` |
| `tests/test_services_autorizacion.py::test_una_autorizacion_fallida_no_modifica_la_orden` | `FR-REP-002`, `TR-REP-008` |
| `tests/test_services_autorizacion.py::test_los_nodos_de_sistema_no_reciben_usuario` | `TR-REP-010` |
| `tests/test_services_autorizacion.py::test_el_historial_de_los_nodos_de_sistema_no_tiene_usuario` | `TR-REP-010`, `FR-REP-004` |
| `tests/test_services_autorizacion.py::test_el_happy_path_usa_los_cuatro_actores_correctos` | `FR-REP-002` |

## UAT (todos `PENDING`)

| UAT | Valida | Estado |
|---|---|---|
| `UAT-REP-001` | `US-REP-001`, `FR-REP-001`, `FR-REP-002` | `PENDING` |
| `UAT-REP-002` | `US-REP-002`, `FR-REP-003` | `PENDING` |

> Los 218 tests internos en verde **no** son evidencia de aceptacion de
> usuario. No ha ocurrido ningun UAT formal sobre esta baseline.
