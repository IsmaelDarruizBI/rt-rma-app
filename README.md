# Rosario Tecno RMA App

Repositorio base para la aplicacion de gestion del area de reparaciones de
Rosario Tecno.

## Objetivo

Este repositorio busca mantener trazabilidad end-to-end entre:

```text
Business Process
→ Epic
→ User Story
→ Functional Requirement
→ Data Model
→ Technical Requirement
→ Development Task
→ Code
→ Internal Test
→ User Acceptance Test
→ Bug / Issue
→ Fix
→ Retest
→ Approval
```

Actualmente el repositorio trabaja solamente sobre la primera etapa:

**Business Process Discovery & Modeling**

No hay todavia aplicacion, frontend, backend ni base de datos. Ver
[docs/discovery/README.md](docs/discovery/README.md) para el detalle de esta
etapa y [traceability/README.md](traceability/README.md) para la convencion
de IDs que sostendra la trazabilidad futura.

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
  schemas/     JSON Schema de validacion para los procesos

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

Etapa: **Business Process Discovery & Modeling**

Actualmente se encuentra definida la **V1.0 (draft) del proceso de Gestion
de Ordenes de Reparacion de Rosario Tecno**, pendiente de validacion
funcional con el negocio.

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
- User Stories
- Spec Kit
- Requerimientos tecnicos
- Validacion cruzada entre archivos
- Desarrollo de aplicacion

Comandos principales:

```bash
npm run validate
npm run generate:mermaid
npm run generate:viewer
npm run generate
```
