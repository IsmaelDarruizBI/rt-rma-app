# Implementation Plan: Gestion comercial y pagos de la Orden — Implemented slice: HP-REP-001

**Branch**: `mvp-traceability` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-feat-rep-007-hp-slice/spec.md`

> **Nota brownfield**: documenta la arquitectura realmente existente en
> la baseline `3788d87`.

## Summary

El slice implementa las dos caras de `BR-REP-017`:

- **(A) Registrar Pago — transversal.** `registrar_pago` es el unico
  service del MVP que **no** registra ningun paso de workflow y **no**
  toca `current_process`. Es la traduccion tecnica directa de que la
  capacidad no tiene nodo `PROC-REP-*` propio.
- **(B) Completar Cobro — secuencial.** `validar_condicion_entrega`
  (`PROC-REP-265`) y `registrar_saldo_pendiente` (`PROC-REP-266`)
  implementan el gate de saldo, que en `HP-REP-001` se recorre dos veces.

Toda la situacion comercial (`total`, `saldo`, `estado_pago`,
`resumen_pago.pagado`) es derivada: no hay nada que sincronizar a mano.

## Technical Context

**Language/Version**: Python 3.11+

**Primary Dependencies**: Pydantic v2 (`computed_field`), `decimal.Decimal`

**Storage**: JSON local; ningun derivado comercial se persiste

**Testing**: pytest

**Target Platform**: servicio backend local (MVP)

**Project Type**: web application (backend + frontend scaffold)

**Performance Goals**: no aplica

**Constraints**: Ruff `line-length = 79`

**Scale/Scope**: 2 nodos de proceso + 1 capacidad transversal, 3
servicios

## Constitution Check

| Principio | Estado | Evidencia |
|---|---|---|
| I. Business YAML fuente de verdad | PASS | FR derivados de `BR-REP-015`/`BR-REP-017`; `BR-REP-016` declarada NO implementada |
| II. IDs estables | PASS | A "Registrar Pago" **no** se le inventa un `PROC-REP-*` |
| III. Trazabilidad E2E | PASS | [traceability.md](./traceability.md) |
| IV. Modelo de datos transversal | PASS | `OrdenReparacion` enlazada desde 002, 006 y 007 |
| V. No inferir funcional desde codigo | PASS | Cortesias y origen no cobrable declarados NO implementados |
| VI. Separacion de capas | PASS | `services/pagos.py` sin HTTP ni JSON |
| VII. Sin sobreingenieria | PASS | Sin catalogo de medios de pago que nadie use |
| VIII. Tests vinculados | PASS | — |
| IX. UAT distinto | PASS | `UAT-REP-012`..`UAT-REP-014` en `PENDING` |
| X. PEP 8 / Ruff | PASS | — |
| XI. Slice vs Feature | PASS | 4 de 6 nodos + la capacidad transversal |

**Violaciones a justificar**: ninguna.

## Project Structure

### Documentation (this feature)

```text
specs/007-feat-rep-007-hp-slice/
├── spec.md
├── plan.md
├── tasks.md
└── traceability.md
```

### Source Code (repository root)

```text
app/backend/app/
├── domain/models/
│   ├── pagos.py             # Pago, ResumenPago (+ computed pagado)
│   ├── enums.py             # EstadoPago
│   └── orden_reparacion.py  # computed total, saldo, estado_pago
└── services/
    ├── pagos.py             # registrar_pago (transversal),
    │                        # validar_condicion_entrega (265),
    │                        # registrar_saldo_pendiente (266)
    ├── documentos.py        # generar_comprobante_final (280, compartido con 008)
    └── autorizacion.py      # validar_usuario_activo (sin rol)
```

**Structure Decision**: `registrar_pago` vive en `services/pagos.py`
junto al gate de cobro, pero es el unico service que **no** llama a
`registrar_paso`: usa `registrar_accion_funcional`. Esa distincion es
la implementacion literal de "capacidad transversal sin nodo propio".

Registrar Pago SI deja traza en la Orden -entrada `FUNCTIONAL_ACTION`
con `referencia_id: ACC-REP-020`, enlazada al `Pago` por `pago_id`-,
pero NO mueve `current_process`. Antes no dejaba ninguna, y el recorrido
no explicaba que ocurria entre `PROC-REP-266` y `PROC-REP-265`.

## Data Model (artefacto transversal)

| Entidad | Archivo | Rol |
|---|---|---|
| `Pago` | `app/backend/app/domain/models/pagos.py` | Importe, medio, usuario, fecha |
| `ResumenPago` | `app/backend/app/domain/models/pagos.py` | Coleccion de pagos + `pagado` derivado |
| `EstadoPago` | `app/backend/app/domain/models/enums.py` | `PENDIENTE`, `PARCIAL`, `PAGADO` |
| `OrdenReparacion.total` / `.saldo` / `.estado_pago` | `app/backend/app/domain/models/orden_reparacion.py` | Derivados |

```text
total       = suma de precios snapshot de los Detalles
pagado      = suma de los Pagos registrados
saldo       = total - pagado
estado_pago = PENDIENTE si no hay Detalles
              PAGADO    si saldo <= 0
              PARCIAL   si pagado > 0
              PENDIENTE en otro caso
```

`ResumenPago` **no** almacena el total cobrable: ese valor deriva de los
Detalles, que ese modelo no conoce. La separacion evita una segunda
fuente de verdad.

## Technical Requirements

- **TR-REP-040**: `registrar_pago` **no** invoca `registrar_paso`, **no**
  modifica `current_process` y **no** agrega historial de workflow. Es la
  traduccion tecnica de que "Registrar Pago" es una capacidad transversal
  sin nodo `PROC-REP-*` (`BR-REP-017-A`).
  → satisface `FR-REP-045`, `FR-REP-046`
  → `app/backend/app/services/pagos.py::registrar_pago`
- **TR-REP-041**: La situacion comercial de la Orden es enteramente
  derivada mediante `@computed_field`: `total`, `saldo`, `estado_pago` en
  `OrdenReparacion` y `pagado` en `ResumenPago`. Ninguno se persiste.
  `ResumenPago` no conoce los Detalles, por lo que no puede almacenar un
  total que compita con el de la Orden.
  → satisface `FR-REP-049`, `FR-REP-050`
  → `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.saldo`,
    `::OrdenReparacion.estado_pago`,
    `app/backend/app/domain/models/pagos.py::ResumenPago.pagado`
- **TR-REP-042**: `estado_pago` distingue explicitamente "Orden sin
  Detalles" (nada que cobrar todavia → `PENDIENTE`) de "Orden con
  Detalles cuyo total es 0" (→ `PAGADO`), en vez de colapsar ambos casos
  en `saldo <= 0`.
  → satisface `FR-REP-050`
  → `app/backend/app/domain/models/orden_reparacion.py::OrdenReparacion.estado_pago`
- **TR-REP-043**: `validar_condicion_entrega` devuelve `(Orden, bool)` y
  registra `PROC-REP-265` **cada vez que se evalua**, de modo que el
  historial conserve tanto la validacion fallida como la revalidacion
  posterior al pago. En `HP-REP-001` el nodo aparece dos veces.
  → satisface `FR-REP-051`, `FR-REP-052`
  → `app/backend/app/services/pagos.py::validar_condicion_entrega`
- **TR-REP-044**: `registrar_saldo_pendiente` (`PROC-REP-266`) **no**
  agrega ningun estado nuevo a la Orden: solo deja constancia del bloqueo
  en el workflow. El desbloqueo ocurre por la via transversal de pago,
  no por un mecanismo aparte.
  → satisface `FR-REP-052`
  → `app/backend/app/services/pagos.py::registrar_saldo_pendiente`
- **TR-REP-045**: `registrar_pago` valida **solo** que el usuario este
  activo, sin exigir rol, porque `BR-REP-017` no define quien puede
  registrar un pago. La ausencia de `validar_actor` es una decision
  explicita documentada como pendiente funcional en el propio codigo, no
  un olvido.
  → satisface `FR-REP-048`
  → `app/backend/app/services/autorizacion.py::validar_usuario_activo`
- **TR-REP-002**: `Pago.monto` se declara `Field(gt=0)`; ademas el
  service revalida el importe antes de registrar.
  → satisface `FR-REP-047`
  → `app/backend/app/domain/models/pagos.py::Pago`
- **TR-REP-017**: Importes en `Decimal` de extremo a extremo, incluido el
  round-trip JSON.
  → satisface `FR-REP-049`
- **TR-REP-004**: Los derivados comerciales se excluyen de la
  persistencia (`exclude_computed_fields=True`), incluido
  `resumen_pago.pagado`.
  → satisface `FR-REP-049`
- **TR-REP-008**: Los tres services devuelven copia y no mutan la Orden
  recibida.
  → satisface `FR-REP-045`
- **TR-REP-046**: `generar_comprobante_final` (`PROC-REP-280`) exige como
  precondicion que la condicion de entrega ya este cumplida, de modo que
  el comprobante refleje el saldo definitivo. Es la implementacion de la
  reubicacion de `PROC-REP-280` despues de `PROC-REP-265`.
  → satisface `FR-REP-054`
  → `app/backend/app/services/documentos.py::generar_comprobante_final`
- **TR-REP-020**: Las precondiciones (Orden no `REPARACION_LISTA`, origen
  no soportado, sin saldo que bloquear) se expresan como
  `PrecondicionInvalidaError`.
  → satisface `FR-REP-051`, `FR-REP-053`

## Dependencies

- **Depende de**: `specs/002-feat-rep-002-hp-slice/` (precio snapshot que
  alimenta el total) y `specs/006-feat-rep-006-hp-slice/`
  (`REPARACION_LISTA` es precondicion del gate).
- **Consumido por**: `specs/008-feat-rep-008-hp-slice/` (la entrega exige
  la condicion de entrega superada).
- **Nodos compartidos**: `PROC-REP-070` con `FEAT-REP-002`;
  `PROC-REP-280` con `FEAT-REP-008`.
- **Externa**: Pydantic v2, `decimal`.

## Complexity Tracking

> Sin violaciones de la Constitution que requieran justificacion.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |

## Pendientes funcionales documentados en el codigo

- `BR-REP-017` no define **que rol** puede registrar un pago. El codigo
  lo declara explicitamente como pendiente funcional y valida solo
  usuario activo. Debe resolverlo negocio.
- `BR-REP-017-A` menciona "medio de pago (catalogo configurable)" y
  "referencia/comprobante cuando corresponda": ninguno de los dos esta
  implementado.
