# Rosario Tecno RMA App

Repositorio base para la aplicacion de gestion del area de reparaciones de
Rosario Tecno.

## Objetivo

Este repositorio busca mantener trazabilidad end-to-end. La jerarquia
principal, definida en detalle en
[traceability/README.md](traceability/README.md), es:

```text
Business Domain
→ Business Process
→ Feature
→ User Story
→ System Action
→ Functional Requirement
→ Technical Requirement
→ Task
→ Code / Artifact
→ Internal Test
→ UAT
→ Bug / Issue
→ Fix / Retest / Approval
```

Epic es opcional: no sustituye a Feature, y puede usarse como agrupacion
transversal de planificacion (por ejemplo, agrupando Features de distintos
Business Process) sin formar parte de la cadena obligatoria.

El Data Model / Architecture sigue siendo una etapa fundamental del
proyecto, pero se trata como un artefacto arquitectonico transversal, no
como un nivel jerarquico rigido entre Functional Requirement y Technical
Requirement: una misma entidad puede satisfacer varios Functional
Requirements y varios Technical Requirements pueden depender de ella
(relacion N:M, no 1:1).

Ver [traceability/README.md](traceability/README.md) para la convencion
completa de IDs y las relaciones 1:N / N:M entre niveles, y
[docs/discovery/README.md](docs/discovery/README.md) para el detalle de la
etapa de Business Process Discovery & Modeling.

No hay todavia aplicacion, frontend, backend ni base de datos.

## Principio arquitectonico

```text
YAML            = Source of Truth
JSON Schema     = Validation Contract
Mermaid         = Visualizacion general
HTML Viewer     = Visualizacion interactiva para negocio
React Flow      = Futuro renderer avanzado
```

El proceso de negocio se define en YAML bajo `business/`. Ese YAML es la
unica fuente de verdad. A partir de el se generan automaticamente un diagrama
Mermaid y un viewer HTML interactivo para visualizacion humana; ninguno de
los dos se edita a mano ni introduce informacion nueva. El modelo de datos
(`nodes[]` / `edges[]`) esta pensado desde el inicio para poder alimentar
React Flow en el futuro sin rediseñar el esquema.

```text
YAML → JSON Schema → Renderer → Mermaid / HTML Viewer (hoy) → React Flow (futuro)
```

## Estructura

```text
business/
  processes/   Procesos de negocio en YAML (fuente de verdad)
  actors/      Actores que participan en los procesos
  rules/       Reglas de negocio
  features/    Definiciones funcionales de Features
  schemas/     JSON Schema de validacion para los procesos y Features

generated/
  mermaid/     Diagramas Mermaid generados automaticamente (no editar)
  viewer/      Viewer HTML interactivo generado automaticamente (no editar)

scripts/       Generadores y herramientas de este repositorio

docs/
  discovery/   Documentacion del proceso de descubrimiento de negocio

traceability/  Convenciones de trazabilidad para etapas futuras
```

## Instalacion

```bash
npm install
```

## Visualizacion

Ambas visualizaciones se generan desde el mismo YAML y nunca deben editarse
manualmente.

### Mermaid general

`generated/mermaid/repair-management.mmd`

```bash
npm run generate:mermaid
```

Diagrama Mermaid plano, pensado como vista general del proceso (por ejemplo
para pegar en un documento o visor de Mermaid).

### Viewer interactivo

`generated/viewer/repair-management.html`

```bash
npm run generate:viewer
```

HTML autocontenido (incluye Mermaid embebido, funciona sin conexion) pensado
para validacion funcional con el negocio. Al hacer click sobre un nodo del
diagrama, un panel lateral muestra su detalle: actor, descripcion, inputs,
outputs y reglas de negocio, resolviendo las referencias contra
`business/actors/actors.yaml` y `business/rules/business-rules.yaml`. Si una
referencia no existe, el panel lo muestra como una advertencia visible en
lugar de fallar silenciosamente.

El viewer tambien permite navegar las **Features** (`business/features/`)
como una capa sobre el mismo diagrama del Business Process: un selector en
la toolbar ("Vista: Todas las Features") permite elegir una Feature y
resalta unicamente sus `process_nodes` (atenuando el resto), sin alterar
el diagrama ni convertir Features en nodos nuevos. El detalle de cada nodo
incluye ademas sus "Features relacionadas", y el detalle de cada Feature
incluye sus Process Nodes -en ambos casos clickeables-, permitiendo
navegar en cualquier direccion entre un Process Node y las Features que lo
agrupan.

### Comandos

```bash
npm run validate
npm run generate:mermaid
npm run generate:viewer
```

o, para correr los tres pasos en orden:

```bash
npm run generate
```

## Estado actual

**Etapa completada:** Business Process Discovery & Modeling, para el
Business Process de Gestion de Ordenes de Reparacion.

```text
PROC-REP  Gestion de Ordenes de Reparacion  V1.2 — approved
```

**Etapa actual:** Feature Definition. Existen actualmente **7 Features en
estado `draft`** para `PROC-REP` V1.2, definidas en
[business/features/repair-management-features.yaml](business/features/repair-management-features.yaml)
y validadas estructuralmente contra
`business/schemas/feature.schema.json` (`npm run validate:features`).
Todavia no se crearon User Stories, ni se inicio la definicion de
Functional Requirements o Technical Requirements. Ademas de la validacion
estructural, `npm run validate:references` valida integridad referencial
entre archivos (`process_nodes` y `business_rules` de cada Feature contra
`repair-management.yaml` y `business-rules.yaml`, `source_process` contra
la version aprobada, y la integridad interna del propio Business Process)
y reporta cobertura de nodos y de Business Rules.

La V1.2 (approved) de `PROC-REP` es Business Process validado con negocio:
baseline funcional aprobada para iniciar la siguiente etapa del proyecto.
Incorpora sobre la V1.1 la validacion de Estacion de Trabajo al momento de
tomar una Orden. La aprobacion es documental (estado del proceso): no
implica que los pendientes funcionales ya identificados (tercerizacion,
scrap, reproceso definitivo, compras, ventas mayoristas, etc.) esten
resueltos. Ver [docs/discovery/README.md](docs/discovery/README.md)
(seccion Pendientes) para el detalle completo.

`PROC-VTA` (Gestion de Ventas de Repuestos) y `PROC-COM` (Gestion de
Compras de Repuestos) siguen siendo procesos futuros identificados dentro
de `DOM-RMA`: todavia no tienen YAML ni modelado propio.

La fuente de verdad continua siendo:

```text
YAML
→ JSON Schema
→ Mermaid / HTML Viewer
```

React Flow sera una futura capa de visualizacion interactiva avanzada.

Todavia no se incluyen deliberadamente:

- React / Next.js
- React Flow
- Base de datos
- User Stories reales
- Spec Kit
- Requerimientos funcionales o tecnicos formales
- Desarrollo de aplicacion

Comandos principales:

```bash
npm run validate
npm run generate:mermaid
npm run generate:viewer
npm run generate
```

### Nota sobre datos sensibles

Este repositorio puede ser publico. Antes de incorporar datos reales,
credenciales, configuraciones sensibles, documentacion interna sensible o
evidencias reales de UAT, debe revisarse su politica de visibilidad/acceso.
