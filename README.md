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
Mermaid         = Visualization (generada, nunca editada a mano)
React Flow      = Future Interactive Visualization
```

El proceso de negocio se define en YAML bajo `business/`. Ese YAML es la
unica fuente de verdad. A partir de el se genera automaticamente un diagrama
Mermaid para visualizacion humana. El modelo de datos (`nodes[]` / `edges[]`)
esta pensado desde el inicio para poder alimentar React Flow en el futuro sin
rediseñar el esquema.

```text
YAML → JSON Schema → Renderer → Mermaid (hoy) / React Flow (futuro)
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

scripts/       Generadores y herramientas de este repositorio

docs/
  discovery/   Documentacion del proceso de descubrimiento de negocio

traceability/  Convenciones de trazabilidad para etapas futuras
```

## Instalacion

```bash
npm install
```

## Generar el diagrama Mermaid

```bash
npm run generate:mermaid
```

Esto lee `business/processes/repair-management.yaml` y genera
`generated/mermaid/repair-management.mmd`.

## Estado actual

Etapa: **Business Process Discovery & Modeling**

Actualmente se encuentra definida la **V1.0 (draft) del proceso de Gestion
de Ordenes de Reparacion de Rosario Tecno**, pendiente de validacion
funcional con el negocio.

La fuente de verdad continua siendo:

```text
YAML
→ JSON Schema
→ Mermaid
```

React Flow sera una futura capa de visualizacion interactiva.

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
```
