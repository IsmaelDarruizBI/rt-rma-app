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

`repair-management.yaml` contiene actualmente la V1.1 (draft) del proceso de
Gestion de Ordenes de Reparacion de Rosario Tecno, incorporando lo validado
en la segunda reunion funcional, y sigue pendiente de validacion funcional
con el negocio. Ver "Estados conceptuales V1.1" y "Pendientes" mas abajo.

## Estados conceptuales V1.1

Propuesta de estados de la Orden de Reparacion, tal como surge del modelado
de la V1.1 (no son todavia un modelo de datos formal):

- REQUERIMIENTO
- EN_REVISION — la reparacion requerida todavia no esta definida.
- PENDIENTE_RECURSOS
- HABILITADA
- EN_COLA
- EN_REPARACION — con modo EXCLUSIVA / ABIERTA.
- PENDIENTE_CONTROL
- REPARACION_LISTA
- ENTREGADA
- CANCELADA — estado confirmado, reglas de transicion pendientes de
  definicion (quien puede cancelar, desde que estados, por que motivos).

No se incluye CERRADA (el flujo V1.1 no tiene un paso de cierre adicional).

TERCERIZADA sigue pendiente de definir si sera un estado: ver pendientes.

El comprobante de recepcion se genera para los origenes que lo requieren
(CLIENTE_EXTERNO, RT_GARANTIA_VENTA, RMA_GARANTIA_REPARACION)
independientemente de si la reparacion ya se conoce o la Orden esta
EN_REVISION; RT_INTERNO no lo requiere. El puntaje de una reparacion ya
puede calcularse una vez aprobado el control tecnico; su distribucion entre
multiples tecnicos sigue pendiente (ver Pendientes).

## Pendientes

Puntos identificados durante el modelado de la V1.1 que quedan pendientes de
validacion funcional con el negocio antes de incorporarse al proceso:

- Flujo completo de tercerizacion.
- Definir si TERCERIZADA es un estado.
- Presupuesto y aprobacion de cliente externo.
- Flujo de SCRAP.
- Flujo de devolucion a proveedor.
- Modelo definitivo de reproceso (reabrir misma OR, crear nueva OR
  relacionada, registrar evento de reproceso, o un modelo combinado). La
  unica relacion confirmada por ahora es que RMA_GARANTIA_REPARACION genera
  una nueva Orden relacionada con la Orden original.
- Reglas de garantia RMA configurable.
- Override de garantia vencida.
- Distribucion de puntos entre multiples tecnicos.
- Catalogo definitivo de prioridades.
- Estado terminal definitivo de RT_INTERNO.
- Reglas de CANCELADA: quien, cuando y motivo.
- Actor/regla que define el modo EXCLUSIVA / ABIERTA de EN_REPARACION.
