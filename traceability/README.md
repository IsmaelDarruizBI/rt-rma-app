# Trazabilidad (futuro)

Este documento describe la convencion de IDs y la jerarquia conceptual que
sostendra la trazabilidad end-to-end del proyecto. **No hay todavia ninguna
implementacion**: ni generacion automatica de matrices, ni validacion
cruzada, ni herramientas. Es solo la convencion de nombres y niveles que los
artefactos futuros deberan respetar para que la trazabilidad sea posible mas
adelante.

## Business Domain

El sistema RMA no va a contener solamente Gestion de Reparaciones. Ya estan
identificados, para etapas futuras, otros Business Process del mismo
dominio:

- Gestion de Ventas de Repuestos.
- Gestion de Compras de Repuestos.

Por eso, por encima de los Business Process, se define una agrupacion
funcional superior: el Business Domain.

```text
DOM-RMA  Business Domain / Area funcional RMA
├── PROC-REP  Gestion de Ordenes de Reparacion
├── PROC-VTA  Gestion de Ventas de Repuestos
└── PROC-COM  Gestion de Compras de Repuestos
```

**Importante:** de estos tres, unicamente `PROC-REP` existe actualmente
como Business Process modelado, en su V1.2 (`approved`,
`business/processes/repair-management.yaml`). `PROC-VTA` y `PROC-COM` son
procesos futuros ya identificados durante el descubrimiento; todavia no se
crean sus archivos YAML ni se modelan sus nodos, y sus prefijos (`VTA`,
`COM`) siguen siendo conceptuales hasta que esos procesos se modelen
formalmente. Sirven aqui solo para mostrar por que hace falta un nivel de
agrupacion por encima de Business Process.

## Jerarquia principal

```text
Business Domain
↓
Business Process
↓
Feature
↓
User Story
↓
System Action
↓
Functional Requirement
↓
Technical Requirement
↓
Task
↓
Code / Artifact
↓
Internal Test
↓
UAT
↓
Bug / Issue
↓
Fix / Retest / Approval
```

Esta cadena reemplaza la mencion anterior de este documento, que nombraba
Epic directamente entre Business Process y User Story sin pasar por
Feature. Epic no forma parte de esta cadena principal (ver mas abajo).

**Las relaciones entre niveles no son necesariamente 1:1.** Pueden ser 1:N o
N:M segun corresponda. Por ejemplo:

- una Feature puede tener varias User Stories;
- una User Story puede requerir varias System Actions;
- una System Action puede generar varios Functional Requirements;
- un Functional Requirement puede necesitar varios Technical Requirements;
- un Technical Requirement puede satisfacer uno o varios Functional
  Requirements;
- un Technical Requirement puede generar varias Tasks.

Por esto, la trazabilidad futura debera soportarse mediante una estructura
de **items + links** (elementos y relaciones explicitas), no mediante
anidamiento rigido uno-a-uno, precisamente para poder representar
relaciones many-to-many sin rediseñar el formato. Esto es todavia una
decision de diseño conceptual: no hay hoy en este repositorio una
implementacion de esa estructura ni herramientas que la generen o
validen.

## Data Model / Architecture (artefacto transversal)

El modelo de datos sigue siendo una etapa fundamental del proyecto, pero
no se documenta como un nivel jerarquico rigido de la cadena principal
(por ejemplo, no se ubica de forma fija entre Functional Requirement y
Technical Requirement). Se trata como un **artefacto arquitectonico
transversal**, relacionado con varios niveles a la vez mediante items +
links:

```text
Functional Requirements
        ↓
Data Model / Architecture
        ↓
Technical Requirements
```

pero permitiendo relaciones N:M, no 1:1:

- una misma entidad del modelo de datos puede satisfacer varios
  Functional Requirements;
- varios Technical Requirements pueden depender de la misma entidad;
- una modificacion del modelo de datos puede impactar varias Features a
  la vez.

Cuando la trazabilidad se implemente, estos artefactos (entidades,
decisiones de arquitectura) tambien deberan participar mediante links
explicitos, igual que el resto de los niveles. Todavia no se diseña el
modelo de datos en esta etapa.

## Epic (opcional)

Epic **no sustituye a Feature** ni a Business Domain, y **no forma parte
obligatoria** de la cadena principal de trazabilidad.

Es una agrupacion opcional de planificacion o iniciativa grande, que puede
agrupar varias Features -incluso de distintos Business Process- cuando
convenga para gestion de producto o de roadmap. Ejemplo conceptual:

```text
EPIC-RMA-001  Optimizacion de operacion de repuestos
├── FEAT-VTA-...
└── FEAT-COM-...
```

Este Epic agruparia Features de Ventas y de Compras de Repuestos sin
reemplazar a esos Business Process ni a sus Features. Por ahora no se crean
Epics reales: es solo la convencion para cuando haga falta usarlos.

## Convencion de IDs

```text
DOM-RMA        Business Domain

PROC-REP-XXX   Business Process Node - Reparaciones
EVT-REP-XXX    Event - Reparaciones
BR-REP-XXX     Business Rule - Reparaciones

FEAT-REP-XXX   Feature
US-REP-XXX     User Story
ACC-REP-XXX    System Action
FR-REP-XXX     Functional Requirement
TR-REP-XXX     Technical Requirement
TASK-REP-XXX   Development Task
CODE-REP-XXX   Code / Artifact
TEST-REP-XXX   Internal Test
UAT-REP-XXX    User Acceptance Test
BUG-REP-XXX    Bug / Issue

EPIC-RMA-XXX   Epic / iniciativa transversal (opcional)
```

`REP` identifica al Business Process de Reparaciones. Para los futuros
`PROC-VTA` y `PROC-COM` se usaran prefijos propios -conceptualmente `VTA`
(Venta de repuestos) y `COM` (Compra de repuestos)-; sus nombres
definitivos se confirman recien cuando esos procesos se modelen.

`FEAT-REP-XXX`, `ACC-REP-XXX` y `TASK-REP-XXX` forman parte de esta
convencion conceptual desde el diseño de la jerarquia. Todavia no se
crearon Features, System Actions ni Tasks reales, y el enfoque items +
links descrito arriba sigue siendo una decision de diseño, no una
implementacion aprobada para uso general.

## Que representa cada nivel

- **Business Domain**: agrupacion funcional superior del negocio/producto
  (ej. `DOM-RMA`).
- **Business Process**: flujo de negocio end-to-end (ej. Gestion de Ordenes
  de Reparacion).
- **Feature**: capacidad funcional coherente y desarrollable.
- **User Story**: necesidad de un actor expresada desde su perspectiva.
- **System Action**: accion concreta que el sistema debe ejecutar para
  realizar una User Story.
- **Functional Requirement**: comportamiento funcional verificable que
  debe cumplir el sistema.
- **Technical Requirement**: decision/contrato tecnico necesario para
  implementar uno o mas requisitos funcionales.
- **Task**: unidad concreta de trabajo de desarrollo.
- **Code / Artifact**: resultado implementado.
- **Internal Test**: verificacion interna del desarrollo.
- **UAT**: validacion de aceptacion por negocio/usuario.
- **Bug / Issue**: desvio encontrado durante testing/UAT/operacion.
- **Epic**: agrupacion opcional de planificacion, no sustituto de Feature
  ni de Business Domain.

## Objetivo futuro

Poder navegar desde cualquier elemento hasta todos sus relacionados, en
ambas direcciones. Ejemplo conceptual de navegacion (no implica que estos
elementos ya existan; unicamente `DOM-RMA` y `PROC-REP-040` son reales
hoy):

```text
DOM-RMA
→ PROC-REP-040
→ FEAT-REP-001
→ US-REP-001
→ ACC-REP-001
→ FR-REP-001
→ TR-REP-001
→ TASK-REP-001
→ CODE-REP-001
→ TEST-REP-001
→ UAT-REP-001
→ APPROVED
```

Si una verificacion falla, el mismo camino puede continuar hacia un Bug y
su ciclo de correccion en lugar de cerrar directamente en `APPROVED`:

```text
UAT-REP-001
→ BUG-REP-001
→ FIX
→ RETEST
→ APPROVED
```

## Estado actual

No implementado como sistema. Esta convencion existe unicamente para que
los IDs creados desde ahora (por ejemplo, en
`business/processes/repair-management.yaml`) sean estables y reutilizables
cuando se construya el sistema de trazabilidad.

En particular:

- la trazabilidad automatizada (generacion de matrices, validacion
  cruzada, herramientas) todavia no existe;
- esta etapa define unicamente la convencion, no una implementacion;
- los IDs ya asignados a nodos de Business Process (por ejemplo los de
  `PROC-REP` en `repair-management.yaml`) deben mantenerse estables;
- la V1.2 aprobada de Gestion de Ordenes de Reparacion no se modifica por
  este documento ni por esta convencion.
