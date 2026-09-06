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
2. Seguir la estructura de `repair-management.yaml` (proceso, nodes, edges).
3. Ejecutar `npm run validate` para validarlo contra
   `business/schemas/process.schema.json`.
4. Ejecutar `npm run generate:mermaid` para producir el diagrama.

`repair-management.yaml` contiene actualmente la V1.0 (draft) del proceso de
Gestion de Ordenes de Reparacion de Rosario Tecno, pendiente de validacion
funcional con el negocio. Ver la seccion "Process V1.1 - Pending validation"
mas abajo para los temas explicitamente dejados fuera de esta version.

## Process V1.1 - Pending validation

Puntos identificados durante el modelado de la V1.0 que quedan pendientes de
validacion funcional con el negocio antes de incorporarse al proceso:

- Estados definitivos de la Orden de Reparacion.
- Validacion de stock vs reserva de stock.
- Actor responsable del control tecnico.
- Flujo de garantia y reproceso.
- Tercerizacion.
- Scrap.
- Desperdicios.
- Devolucion de repuestos defectuosos.
- Compras y reposicion.
- Presupuesto y aprobacion del cliente.
- Puntos y comisiones de tecnicos.
- Reglas de priorizacion.
- Casos en que una reparacion puede involucrar mas de un tecnico.
- Reglas de integracion con el sistema de stock y ventas de Rosario Tecno.
