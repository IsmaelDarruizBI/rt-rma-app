# Implementation Plan: Ingreso y creacion de Orden de Reparacion — Implemented slice: HP-REP-001

**Branch**: `mvp-traceability` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-feat-rep-001-hp-slice/spec.md`

> **Nota brownfield**: este plan NO propone una implementacion futura.
> Documenta la arquitectura **realmente existente** en la baseline
> `3788d87`, reconstruida a partir del codigo y los tests. Los Technical
> Requirements describen decisiones tecnicas que ya estan tomadas y
> verificadas.

## Summary

El slice crea la Orden de Reparacion de origen `CLIENTE_EXTERNO` y emite
su comprobante de recepcion. Se implementa como dos funciones puras de
servicio que reciben el estado de la Orden (o los datos de alta) y
devuelven una **copia nueva** con el efecto aplicado y el paso de proceso
registrado en el historial. No hay capa HTTP involucrada: el unico
endpoint existente es `GET /health`.

## Technical Context

**Language/Version**: Python 3.11+

**Primary Dependencies**: Pydantic v2 (`>=2.13.0`), pydantic-settings,
FastAPI (solo scaffold `GET /health`), Uvicorn

**Storage**: archivos JSON locales bajo `app/backend/data/`
(una Orden por archivo, catalogos por entidad), con escritura atomica

**Testing**: pytest (218 tests en verde en la baseline)

**Target Platform**: servicio backend local (MVP), sin despliegue

**Project Type**: web application (backend Python + frontend React
scaffold), con capa previa de modelado funcional en `business/`

**Performance Goals**: no aplica en el MVP (volumen de una sola Orden por
flujo, persistencia local)

**Constraints**: Ruff `line-length = 79`, reglas `E`/`W`/`F`/`I`;
`domain` sin dependencias de infraestructura

**Scale/Scope**: 6 nodos de proceso, 2 servicios, 1 aggregate raiz

## Constitution Check

*GATE: verificado contra `.specify/memory/constitution.md` v1.0.0.*

| Principio | Estado | Evidencia |
|---|---|---|
| I. Business YAML fuente de verdad | PASS | Los FR derivan de `PROC-REP-010/030/040/050/060` y `BR-REP-013`, no del codigo |
| II. IDs estables | PASS | Se citan los IDs existentes; los nuevos siguen la convencion de `traceability/README.md` |
| III. Trazabilidad E2E | PASS | Ver [traceability.md](./traceability.md) y `traceability/hp-rep-001.yaml` |
| IV. Modelo de datos transversal | PASS | `OrdenReparacion` se enlaza N:M desde varios FR/TR |
| V. No inferir funcional desde codigo | PASS | El alcance no implementado se declara, no se omite |
| VI. Separacion de capas | PASS | `services/ordenes.py` y `services/documentos.py` no conocen HTTP ni JSON |
| VII. Sin sobreingenieria | PASS | `OrigenOrden` tiene un solo valor: el que el slice recorre |
| VIII. Tests vinculados a requerimientos | PASS | Ver links `verifies` en la matriz |
| IX. UAT distinto de test interno | PASS | `UAT-REP-001`/`UAT-REP-002` en estado `PENDING` |
| X. PEP 8 / Ruff | PASS | Configurado en `app/backend/pyproject.toml` |
| XI. Slice vs Feature | PASS | `implemented_slice_status = IMPLEMENTED`, `feature_status = draft` |

**Violaciones a justificar**: ninguna.

## Project Structure

### Documentation (this feature)

```text
specs/001-feat-rep-001-hp-slice/
├── spec.md            # User Stories, acceptance scenarios, FR
├── plan.md            # Este archivo: arquitectura real + TR
├── tasks.md           # Tareas reconstruidas con estado real
└── traceability.md    # US -> ACC -> FR -> TR -> TASK -> CODE -> TEST -> UAT
```

### Source Code (repository root)

```text
app/backend/
├── app/
│   ├── domain/models/          # Sin dependencias de infraestructura
│   │   ├── enums.py            # OrigenOrden, EstadoWorkflow
│   │   ├── personas.py         # Cliente, Usuario
│   │   ├── equipos.py          # Equipo
│   │   ├── documentos.py       # Documento, DocumentosOrden
│   │   ├── workflow.py         # HistorialWorkflow
│   │   └── orden_reparacion.py # OrdenReparacion (aggregate raiz)
│   ├── services/
│   │   ├── ordenes.py          # crear_orden_cliente_externo
│   │   ├── documentos.py       # generar_comprobante_recepcion
│   │   ├── autorizacion.py     # validar_actor, validar_usuario_activo
│   │   ├── identificadores.py  # nuevo_id
│   │   ├── workflow.py         # registrar_paso
│   │   └── exceptions.py       # DomainError y derivadas
│   ├── repositories/           # Protocols (contrato)
│   └── storage/json/           # Implementacion JSON (escritura atomica)
└── tests/
    ├── test_hp_rep_001_services.py     # E2E en memoria
    ├── test_hp_rep_001_persistido.py   # E2E contra persistencia
    ├── test_hp_rep_001.py              # Estado final declarativo
    ├── test_services_autorizacion.py   # Actores por nodo
    ├── test_services_invariantes.py    # Invariantes y no-mutacion
    ├── test_modelos_dominio.py         # Contratos de modelo
    └── test_repositories_json.py       # Round-trip de persistencia
```

**Structure Decision**: backend en `app/backend/` con las cuatro capas
declaradas en `app/backend/README.md`
(`api -> services -> repositories <- storage`, `domain` independiente).
El frontend (`app/frontend/`) es scaffold y no participa de este slice.

## Data Model (artefacto transversal)

El modelo de datos NO es un nivel rigido entre FR y TR: se relaciona N:M
con varios niveles (Constitution, Principio IV).

| Entidad | Archivo | Rol en este slice |
|---|---|---|
| `OrdenReparacion` | `app/backend/app/domain/models/orden_reparacion.py` | Aggregate raiz creado por el slice |
| `Cliente` | `app/backend/app/domain/models/personas.py` | Dato de alta |
| `Usuario` | `app/backend/app/domain/models/personas.py` | Actor validado |
| `Equipo` | `app/backend/app/domain/models/equipos.py` | Dato de alta |
| `OrigenOrden` | `app/backend/app/domain/models/enums.py` | Enum, unico valor `CLIENTE_EXTERNO` |
| `EstadoWorkflow` | `app/backend/app/domain/models/enums.py` | Hito `REQUERIMIENTO` |
| `Documento` / `DocumentosOrden` | `app/backend/app/domain/models/documentos.py` | Comprobante de recepcion |
| `HistorialWorkflow` | `app/backend/app/domain/models/workflow.py` | Paso de recorrido |

Relacion conceptual:

```text
OrdenReparacion (aggregate raiz)
  ├── Cliente        (embebido)
  ├── Equipo         (embebido)
  ├── DocumentosOrden(embebido)
  └── HistorialWorkflow[]  (append-only)
```

Los catalogos (`Usuario`, `TipoReparacion`, `Insumo`, `EstacionTrabajo`)
se referencian **solo por ID**: la Orden nunca los copia.

## Technical Requirements

- **TR-REP-001**: `OrdenReparacion` es el **aggregate raiz** del dominio.
  Contiene sus entidades transaccionales (Detalles, tomas, ejecuciones,
  movimientos, pagos, documentos e historial) y referencia los catalogos
  unicamente por ID, nunca por copia del objeto.
  → satisface `FR-REP-001`, `FR-REP-004`, `FR-REP-005`
  → `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion`
- **TR-REP-002**: Los modelos de dominio son Pydantic v2 y expresan sus
  invariantes de campo de forma declarativa (`Field(ge=...)`,
  `Field(gt=...)`, enums cerrados), de modo que un valor invalido falle
  al construir el modelo y no mas adelante.
  → satisface `FR-REP-001`
  → `app/backend/app/domain/models/personas.py::Cliente`
- **TR-REP-003**: `app/backend/app/domain/` no importa FastAPI, ni
  `repositories`, ni `storage`. La direccion de dependencia es
  `api -> services -> repositories <- storage`, con `domain` aislado.
  → satisface `FR-REP-001`, `FR-REP-004`
- **TR-REP-008**: Los services son **puros respecto de la Orden**: no
  mutan el objeto recibido; construyen y devuelven una copia nueva con el
  efecto aplicado. Una cadena de services deja intactos los estados
  intermedios anteriores.
  → satisface `FR-REP-001`, `FR-REP-003`
  → `app/backend/app/services/ordenes.py::crear_orden_cliente_externo`
- **TR-REP-009**: Cada service con actor humano valida el rol requerido y
  que el usuario este activo (`autorizacion.validar_actor`) **antes** de
  producir cualquier efecto. Una autorizacion fallida lanza
  `PrecondicionInvalidaError` y no modifica la Orden.
  → satisface `FR-REP-002`
  → `app/backend/app/services/autorizacion.py::validar_actor`
- **TR-REP-010**: Los nodos `ACT-SYSTEM` no reciben parametro `usuario` y
  registran su paso de historial sin usuario responsable. La firma del
  service hace imposible pasarles un actor humano.
  → satisface `FR-REP-003`, `FR-REP-004`
  → `app/backend/app/services/documentos.py::generar_comprobante_recepcion`
- **TR-REP-011**: El recorrido se registra mediante
  `workflow.registrar_paso`, que appendea un `HistorialWorkflow` a
  `orden.historial` y actualiza `orden.current_process`. Es el unico
  mecanismo de registro de recorrido: ningun service escribe el historial
  por su cuenta.
  → satisface `FR-REP-004`, `FR-REP-005`
  → `app/backend/app/services/workflow.py::registrar_paso`
- **TR-REP-020**: Los errores de dominio son tipados y jerarquicos
  (`DomainError` → `PrecondicionInvalidaError`,
  `RecursoNoDisponibleError`, `EntidadNoEncontradaError`) y estan
  separados de los errores de persistencia (`RepositoryError` →
  `EntidadPersistidaNoEncontradaError`, `PersistenciaError`).
  → satisface `FR-REP-002`
  → `app/backend/app/services/exceptions.py::DomainError`
- **TR-REP-021**: Los IDs funcionales de negocio (`PROC-REP-*`,
  `BR-REP-*`, `FEAT-REP-*`, `HP-REP-001`) se citan en los docstrings de
  los modulos y funciones implementadas, como anclaje de trazabilidad
  codigo ↔ `business/`.
  → satisface `FR-REP-004`
- **TR-REP-023** *(transversal a todos los slices)*: Python >= 3.11 con
  Ruff (`line-length = 79`, reglas `E`/`W`/`F`/`I`) y pytest como runner,
  segun `app/backend/pyproject.toml`. Es un estandar de repositorio que
  sostiene el Principio X de la Constitution; no satisface un Functional
  Requirement concreto, por eso en `traceability/hp-rep-001.yaml` se
  declara `cross_cutting: true`.
  → `app/backend/pyproject.toml`
- **TR-REP-024**: Los identificadores de entidades transaccionales se
  generan con un unico helper (`identificadores.nuevo_id(prefijo)`), de
  modo que el formato de ID sea una decision centralizada y no se repita
  en cada service.
  → satisface `FR-REP-001`
  → `app/backend/app/services/identificadores.py::nuevo_id`

## Dependencies

- **Interna**: este slice es el punto de entrada. No depende de ningun
  otro slice.
- **Consumido por**: `specs/002-feat-rep-002-hp-slice/` (definicion de
  Detalles) requiere una Orden creada por este slice.
- **Externa**: Pydantic v2 (`exclude_computed_fields` requiere
  `pydantic >= 2.13`).

## Complexity Tracking

> Sin violaciones de la Constitution que requieran justificacion.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
