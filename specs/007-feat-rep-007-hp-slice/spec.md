# Feature Specification: Gestion comercial y pagos de la Orden — Implemented slice: HP-REP-001

**Feature Branch**: `mvp-traceability`

**Created**: 2026-09-24

**Status**: Reconstructed from implemented baseline (brownfield)

**Business Feature**: `FEAT-REP-007` — Gestion comercial y pagos de la Orden

**Source Process**: `PROC-REP` V1.3

**Implemented Scenario**: `HP-REP-001`

| Campo | Valor |
|---|---|
| `feature_status` | `draft` |
| `implemented_scenario` | `HP-REP-001` |
| `implemented_slice_status` | `IMPLEMENTED` |

> **ALCANCE.** `HP-REP-001` tiene `payment_timing = AL_RETIRAR`,
> `balance_before_final_payment = PENDIENTE` y `final_balance = 0`: el
> cliente paga al retirar. El slice cubre el circuito
> `PROC-REP-265` → `PROC-REP-266` → Registrar Pago → revalidar
> `PROC-REP-265`. **Los Ajustes Comerciales y las Cortesias
> (`BR-REP-016`) NO estan implementados.**

## Alcance del slice

### Nodos dentro del slice

| Nodo | Nombre | Actor | En HP-REP-001 |
|---|---|---|---|
| `PROC-REP-265` | Completar cobro — validar condicion de entrega (saldo) | decision | si, **dos veces** (rama `No`, luego `Si`) |
| `PROC-REP-266` | Orden con saldo pendiente (entrega bloqueada) | `ACT-SYSTEM` | si |
| `PROC-REP-070` | Definir Detalles (aporta el precio snapshot) | `ACT-RECEP` | si (nodo compartido con `FEAT-REP-002`) |
| `PROC-REP-280` | Generar comprobante final | `ACT-SYSTEM` | si (nodo compartido con `FEAT-REP-008`) |

### Capacidad transversal (sin nodo `PROC-REP-*`)

| Capacidad | Feature | Regla | En HP-REP-001 |
|---|---|---|---|
| **Registrar Pago** | `FEAT-REP-007` | `BR-REP-017-A` | si, como paso `FUNCTIONAL_ACTION` "Registrar pago final" |

Es una capacidad **transversal**, no un nodo del flujo. `HP-REP-001` la
declara explicitamente como `kind: FUNCTIONAL_ACTION` para no agregar
una linea nueva al diagrama. **No se le inventa un `PROC-REP-*`.**

### Nodos de la Feature FUERA del slice (no implementados)

| Nodo | Nombre | Motivo |
|---|---|---|
| `PROC-REP-075` | Definir Detalles luego de revision | circuito de revision no implementado |
| `PROC-REP-127` | Definir/actualizar reparacion del Detalle | circuito de revision no implementado |

### Business Rules aplicables al slice

- `BR-REP-015` — Precio snapshot y Subtotal (la parte de Detalles
  `CANCELADO` que no participan del Subtotal **no** esta implementada:
  no hay cancelacion).
- `BR-REP-016` — Ajustes Comerciales y Cortesia: **fuera del slice**, no
  implementada.
- `BR-REP-017` — Registrar Pago (transversal) y Completar Cobro
  (secuencial): implementada en ambas partes, salvo las condiciones de
  cortesia total y de origen no cobrable.

## User Scenarios & Testing *(mandatory)*

### User Story `US-REP-012` — Registrar los pagos del cliente cuando ocurren (Priority: P1)

Como **Administrador**, quiero registrar los pagos del cliente en
cualquier momento de la vida de la Orden —una seña, un anticipo, un pago
parcial o el pago final—, para que el saldo refleje siempre lo realmente
cobrado.

**Why this priority**: es la capacidad transversal sobre la que se apoya
todo el cierre comercial. Sin ella no hay forma de saldar la Orden.

**Independent Test**: registrar un pago sobre una Orden en cualquier
punto del flujo y verificar que el saldo baja y que el punto del proceso
en el que esta la Orden **no** cambia.

**Acceptance Scenarios**:

1. **Given** una Orden con saldo pendiente, **When** se registra un pago
   con su importe, medio de pago, fecha/hora y usuario, **Then** el pago
   queda asociado a la Orden y el saldo se recalcula.
2. **Given** un pago registrado, **When** se consulta el punto del
   proceso en el que esta la Orden, **Then** no cambio: registrar un pago
   es transversal, no un paso del flujo.
3. **Given** un importe menor o igual a cero, **When** se intenta
   registrar el pago, **Then** el sistema lo rechaza.
4. **Given** cualquier usuario activo del sistema, **When** registra un
   pago, **Then** la operacion se permite: registrar un pago no exige un
   rol concreto.
5. **Given** un usuario inactivo, **When** intenta registrar un pago,
   **Then** el sistema lo rechaza.
6. **Given** una Orden sin pagos, **When** se consulta lo pagado,
   **Then** es cero; **When** se registran varios pagos, **Then** lo
   pagado es su suma.

---

### User Story `US-REP-013` — No entregar un equipo con saldo pendiente (Priority: P1)

Como **Administrador**, quiero que el sistema impida entregar un equipo
mientras el cliente tenga saldo pendiente, para no perder el cobro.

**Why this priority**: es el gate comercial del cierre. `BR-REP-017-B`
establece que no existe override para entregar con deuda.

**Independent Test**: sobre una Orden `REPARACION_LISTA` con saldo
pendiente, validar la condicion de entrega (debe dar negativa),
registrar el pago y revalidar (debe dar positiva).

**Acceptance Scenarios**:

1. **Given** una Orden `REPARACION_LISTA` con saldo mayor a cero,
   **When** se valida la condicion de entrega, **Then** el resultado es
   negativo y el saldo informado es el total adeudado.
2. **Given** ese resultado negativo, **When** se registra el bloqueo de
   entrega, **Then** la Orden queda con estado de cobro pendiente y el
   paso queda registrado.
3. **Given** la Orden bloqueada, **When** se registra un pago que cancela
   el saldo y se revalida la condicion de entrega, **Then** el resultado
   es positivo y el saldo es cero.
4. **Given** una Orden con saldo pendiente, **When** se intenta
   entregarla, **Then** el sistema lo rechaza: **no existe override**.
5. **Given** el circuito completo, **When** termina, **Then** el
   historial registra `PROC-REP-265` **dos veces** (la validacion
   fallida y la revalidacion) con `PROC-REP-266` entre ambas.

---

### User Story `US-REP-014` — Saber siempre cuanto debe el cliente (Priority: P2)

Como **Administrador**, quiero que el importe a cobrar, lo pagado y el
saldo se calculen siempre a partir de los Detalles y de los pagos
registrados, para no tener que reconciliar cifras a mano.

**Why this priority**: es una garantia de integridad, no una accion del
flujo, pero evita toda una clase de errores operativos.

**Independent Test**: modificar los Detalles o los pagos de una Orden y
verificar que total, saldo y estado de cobro se actualizan solos.

**Acceptance Scenarios**:

1. **Given** una Orden, **When** cambia el precio de un Detalle o se
   agrega uno nuevo, **Then** el total y el saldo se actualizan sin
   ninguna accion adicional.
2. **Given** una Orden sin Detalles, **When** se consulta su estado de
   cobro, **Then** es pendiente: todavia no hay nada que cobrar.
3. **Given** una Orden con Detalles cuyo total es cero, **When** se
   consulta su estado de cobro, **Then** es pagada. Esto la distingue del
   caso anterior.
4. **Given** una Orden con pagos parciales, **When** se consulta su
   estado de cobro, **Then** es parcial; al saldarse pasa a pagada.
5. **Given** una Orden guardada y vuelta a cargar, **When** se consultan
   total, saldo y estado de cobro, **Then** coinciden: no se almacenan,
   se recalculan.

---

### Edge Cases

- **Cortesia de Detalle o de Orden** (`BR-REP-016`): fuera del slice. No
  hay Ajustes Comerciales.
- **Condicion no cobrable por origen** (`RT_GARANTIA_VENTA`,
  `RMA_GARANTIA_REPARACION`, `RT_INTERNO`): fuera del slice; el unico
  origen implementado es `CLIENTE_EXTERNO`, que es cobrable.
- **Detalles `CANCELADO` excluidos del Subtotal** (`BR-REP-015`): fuera
  del slice; no hay cancelacion.
- **Impuestos, recargos y descuentos** entre Base Comercial y Total
  Cobrable: pendiente declarado, fuera de V1.3.
- **Multi-moneda**: pendiente declarado, fuera de V1.3.
- **Reembolsos**: pendiente declarado, fuera de V1.3.
- **Pago que excede el saldo**: el estado de cobro lo tolera (saldo <= 0
  se considera pagado), pero el caso no esta ejercitado ni definido por
  negocio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-REP-045**: Una Orden debe poder tener cero o mas pagos
  registrados, en cualquier momento desde que existe, cada uno con su
  importe, medio de pago, fecha/hora y usuario. *(`BR-REP-017-A`)*
- **FR-REP-046**: Registrar un pago no debe alterar el punto del proceso
  en el que se encuentra la Orden: es una capacidad transversal, no un
  paso secuencial del flujo. *(`BR-REP-017-A`)*
- **FR-REP-047**: El importe de un pago debe ser mayor a cero.
- **FR-REP-048**: Registrar un pago no debe exigir un rol especifico,
  pero si un usuario activo. *(`BR-REP-017-A`)*
- **FR-REP-049**: El importe a cobrar, lo pagado, el saldo y el estado de
  cobro de la Orden deben derivarse siempre de sus Detalles y de sus
  pagos, sin constituir datos independientes que deban sincronizarse.
  *(`BR-REP-015`, `BR-REP-017`)*
- **FR-REP-050**: El estado de cobro debe distinguir una Orden sin nada
  que cobrar todavia (sin Detalles) de una Orden cuyo importe es cero:
  la primera queda pendiente, la segunda pagada.
- **FR-REP-051**: Antes de habilitar la entrega, el sistema debe calcular
  el saldo como la diferencia entre el importe a cobrar y lo pagado, y
  validar la condicion de entrega. *(`PROC-REP-265`, `BR-REP-017-B`)*
- **FR-REP-052**: Mientras exista saldo pendiente, la entrega debe quedar
  bloqueada; la condicion de entrega debe revalidarse despues de cada
  pago. *(`PROC-REP-266` → `PROC-REP-265`)*
- **FR-REP-053**: Una Orden de origen cobrable solo puede entregarse con
  saldo cero. **No existe override para entregar con deuda.**
  *(`BR-REP-017-B`)*
- **FR-REP-054**: El comprobante final debe generarse despues de que la
  condicion de entrega quede aprobada, de modo que refleje siempre el
  saldo definitivo al momento de la entrega. *(`PROC-REP-280`,
  `BR-REP-017`)*

### Key Entities *(include if feature involves data)*

- **Pago**: importe, medio de pago, fecha/hora y usuario. Una Orden tiene
  0..N.
- **Resumen de pagos**: coleccion de pagos de la Orden; lo pagado es su
  suma derivada.
- **Saldo**: magnitud derivada (importe a cobrar menos lo pagado).
- **Estado de cobro**: magnitud derivada (`PENDIENTE`, `PARCIAL`,
  `PAGADO`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-022**: Ningun equipo de cliente externo puede entregarse con saldo
  pendiente.
- **SC-023**: El saldo informado coincide siempre con la diferencia entre
  los Detalles y los pagos registrados, sin reconciliacion manual.
- **SC-024**: Un pago puede registrarse en cualquier momento del flujo
  sin alterar el avance de la Orden.

## Assumptions

- El medio de pago se modela como texto libre; el catalogo configurable
  de medios de pago que menciona `BR-REP-017-A` **no** esta implementado.
- `BR-REP-017-A` menciona "referencia/comprobante cuando corresponda";
  ese campo **no** esta implementado.
- Las condiciones alternativas de entrega (cortesia total, origen no
  cobrable) no se implementan porque dependen de `BR-REP-016` y de
  origenes fuera del slice. La validacion implementada es exclusivamente
  "saldo = 0".
- La Base Comercial coincide con el Subtotal porque no hay Ajustes
  Comerciales; el Total Cobrable coincide con la Base Comercial porque no
  hay impuestos.
