# Business Process Discovery

Esta carpeta documenta el proceso de descubrimiento y modelado de negocio,
la primera etapa de la trazabilidad E2E descrita en el
[README principal](../../README.md).

## Alcance de esta etapa

- Definir procesos de negocio en YAML (`business/processes/`).
- Definir actores (`business/actors/`).
- Definir reglas de negocio (`business/rules/`).
- Validar la forma de los procesos contra un JSON Schema
  (`business/schemas/process.schema.json`).
- Generar automaticamente una visualizacion Mermaid de cada proceso.

## Fuera de alcance en esta etapa

- Desarrollo de la aplicacion (frontend, backend, base de datos).
- Modelo de datos tecnico.
- Requerimientos funcionales o tecnicos formales.
- Trazabilidad automatizada (ver [traceability/README.md](../../traceability/README.md)).

## Como se agrega un proceso nuevo

1. Crear el archivo YAML en `business/processes/`.
2. Seguir la estructura de `repair-management.yaml` (proceso, trigger,
   nodes, edges).
3. Validar manualmente que respete `business/schemas/process.schema.json`.
4. Ejecutar `npm run generate:mermaid` para producir el diagrama.

Los contenidos actuales (`repair-management.yaml`, actores, reglas) son
ejemplos demostrativos y deberan ser reemplazados por el proceso real de
Rosario Tecno cuando se releve con el negocio.
