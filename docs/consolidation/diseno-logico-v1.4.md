# Diseño lógico funcional — consolidación V1.4 (baseline vigente)

Este documento cumple el principio de desarrollo confirmado el 23/10/2026. Cada funcionalidad nueva o ampliada define seis cosas:

- entidades;
- relaciones;
- estados y transiciones;
- eventos;
- invariantes y validaciones;
- operaciones que deberán ser transaccionales en PostgreSQL.

Es **diseño lógico**: no es el esquema físico. No fija tipos, índices ni tablas definitivas. Cuando nombra una restricción, lo hace para expresar una invariante.

Lo pendiente de decisión se marca con su ID del registro (`ABI-xx`, en `business/decisions/decision-log-v1.4.yaml`) y no se completa.

Convenciones:

- **Evento**: hecho de negocio que queda en el historial de la Orden (o en el registro propio de la entidad), con usuario y fecha/hora. Toda funcionalidad nueva define los suyos (DC29); no se agregan indicadores.
- **Transacción**: lo que debe confirmarse o descartarse junto. Hoy el MVP lo aproxima con una sección crítica y compensaciones sobre JSON; en PostgreSQL será una transacción, con bloqueo de las filas que se leen para decidir.
- La persistencia JSON actual sigue desacoplada del dominio: las reglas viven en el dominio y en los servicios, y el acceso a datos pasa por contratos de repositorio (DC28).

---

## 1. Ciclo del Detalle y cierre de la Orden (DC17)

**Entidades.**

- OrdenReparacion: hito de workflow e historial.
- DetalleReparacion: estado operativo, condiciones, autorización, definición vigente e historial de definiciones.
- Ejecucion: técnico, Mesa de trabajo, inicio, fin, resultado y motivo.

**Relaciones.**

- Orden 1..N Detalle.
- Detalle 1..N Ejecución.
- Orden 0..1 Ejecución activa (BR-REP-007).

**Estados y transiciones del Detalle.**

| Desde | Hacia | Dónde | Condición |
|---|---|---|---|
| (alta) | DEFINIDO | 070, 075, 128 | Tipo y precio snapshot registrados |
| DEFINIDO | EN_PROGRESO | 185 | Trabajable, autorizado, confirmado cuando corresponde, custodia confirmada, reserva exitosa |
| EN_PROGRESO | COMPLETO | 200 | Completado |
| EN_PROGRESO | DEFINIDO | 200 | Interrumpido (motivo) o Requiere redefinición (motivo y REQUIERE_DEFINICION) |
| COMPLETO | DEFINIDO | 235 | Rechazo en el control técnico |
| DEFINIDO | CANCELADO | 300, 305 | Sin Ejecución activa sobre ese Detalle |

Además:

- BLOQUEADO_POR_RECURSOS y REQUIERE_DEFINICION son condiciones, no estados.
- La autorización (PENDIENTE_AUTORIZACION, AUTORIZADO o RECHAZADO) es otra dimensión.
- No hay transiciones desde CANCELADO, y COMPLETO nunca pasa a CANCELADO.

**Orden.**

- REQUERIMIENTO o EN_REVISION al crearse.
- HABILITADA es un hito histórico único.
- EN_COLA.
- EN_REPARACION, al iniciar una Ejecución.
- REPARACION_LISTA.
- ENTREGADA o CANCELADA.
- Fin operativo solo en EVT-REP-999, después de PROC-REP-268.

**Eventos.**

- Detalle definido o redefinido.
- Ejecución iniciada.
- Ejecución cerrada con su resultado.
- Detalle aprobado o rechazado en el control.
- Orden en reparación.
- Orden lista.
- Fin operativo.

**Invariantes.**

- Como máximo una Ejecución activa por Orden.
- Un Detalle CANCELADO no tiene reservas activas.
- El agregado de la Orden siempre se deriva con el resolver (BR-REP-012).
- No hay fin operativo con custodia indeterminada ni con saldo a favor.

**Transacciones.**

- Iniciar una Ejecución, en una sola transacción:
  - reserva de todos los insumos previstos;
  - movimientos RESERVA;
  - Ejecución;
  - Detalle EN_PROGRESO;
  - hito EN_REPARACION;
  - historial.

  Se bloquean los insumos y la Orden. Si un insumo no alcanza, sin override, no se confirma nada.
- Cerrar una Ejecución, en una sola transacción:
  - resultado de 200;
  - movimientos de 210 (consumo, liberación, desperdicio);
  - nuevo estado del Detalle;
  - historial.
- Control técnico por Orden: los resultados de todos los Detalles, el puntaje derivado y el hito REPARACION_LISTA.

## 2. Toma, liberación y prioridad (DC03, DC04, DP-01, DP-02, UAT)

**Entidades.**

- TomaOrden: técnico, Mesa de trabajo, inicio, fin, quién libera y motivo.
- PrioridadOrden: valor de 1 a 4, con 4 - Normal por defecto.
- CambioPrioridad: valor anterior, valor nuevo, usuario, fecha y motivo.

**Relaciones.**

- Orden 0..1 toma activa y 0..N tomas históricas.
- Orden 0..N cambios de prioridad.

**Estados.**

- Toma: ACTIVA o CERRADA. Se cierra por liberación explícita, por liberación ajena o automáticamente cuando no queda ningún Detalle trabajable.

**Eventos.**

- Orden priorizada (150).
- Prioridad cambiada.
- Orden encolada.
- Orden tomada.
- Orden liberada.
- Liberación ajena: quién la realiza, titular, Orden, Ejecución afectada cuando la hay, motivo, fecha/hora, Mesa de trabajo y resultado (estado de la Orden y de sus Detalles).

**Invariantes.**

- Como máximo una toma activa por Orden.
- 150 se recorre una sola vez.
- Cambiar la prioridad no vuelve a encolar la Orden.
- No se libera una Orden cerrada o entregada.
- Una liberación ajena exige advertencia confirmada, motivo y el permiso configurado (Técnico y Coordinación por defecto).
- La interrupción incluida en una liberación ajena es una excepción específica al permiso de interrumpir, que corresponde al técnico de la Ejecución: solo existe dentro de esa operación y no concede un permiso general para interrumpir Ejecuciones ajenas (BR-REP-018, BR-REP-039).
- El motivo exacto que registra la interrupción derivada de la liberación está pendiente (ABI-36).

**Transacciones.**

- Tomar una Orden: verificación de toma y Ejecución activas, toma e historial. Se bloquea la Orden.
- Liberación ajena con Ejecución en curso, en una sola transacción: cierre de la Ejecución como Interrumpida, movimientos de 210, cierre de la toma, vuelta a la cola e historial con la auditoría de la operación.
- Cambio de prioridad: valor nuevo y registro del cambio.

## 3. Permisos y roles (DC08, DC27A, DC27B; arquitectura DC27C)

**Entidades.**

- Usuario.
- Rol.
- AsignacionRol: usuario y rol, varios por usuario. Solo Administración la gestiona, desde Configuración y con auditoría (DEC-MI-12).
- Accion: cada nodo con actor y cada capacidad transversal (pago, anulación, devolución, check-in, ajuste comercial, cambio de prioridad, liberación ajena, sincronización, stock, fotografías, eventos de custodia y tipos de cancelación).
- Permiso: rol, acción y contexto permitido.
- PermisoConsulta: rol y recurso consultable (Órdenes, Clientes, fotografías, documentos, pagos, reportes, antecedentes y operaciones administrativas, DEC-MI-12).
- CambioPermiso: auditoría (BR-REP-040).
- Cada acción registrada guarda el usuario y el rol que la habilitó (DEC-MI-12).

**Relaciones.**

- Usuario N..M Rol.
- Rol N..M Accion, con contexto.

**Estados.**

- Permiso vigente o retirado. Un retiro no borra el historial.

**Eventos.**

- Rol asignado o retirado.
- Permiso otorgado, retirado o delegado.

**Invariantes.**

- Los permisos efectivos son la unión de los roles del usuario.
- El permiso es necesario pero no suficiente: siempre se evalúan las restricciones de contexto de cada regla.
- Los predeterminados son los responsables declarados en el proceso (`actor` y `actores_alternativos`).
- Los permisos implementados hoy son la configuración inicial, incluidos inventario, catálogo de equipos, ajuste de garantía y fotografías (DEC-MI-12, cierra ABI-23).
- Los responsables por evento de custodia los decidió DEC-MI-04 y los del Ajuste Comercial, DEC-MI-03 y DEC-IT1-02.
- Un técnico puede controlar su propio trabajo si tiene los permisos.
- Ningún cambio de roles o permisos deja el sistema sin un administrador autorizado: el cambio que lo haría se rechaza completo.

**Transacciones.**

- Cambio de permisos o roles: cambio, verificación de que sigue habiendo un administrador autorizado y auditoría.
- La evaluación de un permiso ocurre dentro de la transacción de la acción que habilita.

**Arquitectura (DC27C, DC28).**

- Autenticación con Supabase Auth.
- Usuarios, roles y permisos en PostgreSQL.
- FastAPI centraliza la autorización; el frontend nunca accede a tablas de negocio.
- La migración a Supabase PostgreSQL precede a Compras y a las automatizaciones.
- El núcleo, la configuración y los documentos se completan antes sobre JSON, con contratos de repositorio que no dependen del almacenamiento.

## 4. Administración de configuración y auditoría (DC23, DC23AUD, GLO-01)

**Entidades.**

- Catálogos (DEC-MI-13): TipoReparacion (precio, puntaje y política de garantía), Insumo (con su control por lote, DEC-MI-10), MesaDeTrabajo (Estación) con sus tipos habilitados, ChecklistTipoEquipo (preguntas y opciones), PoliticaGarantia, PlantillaMensaje, MotivoCancelacion y MotivoInterrupcion (catálogos separados, con versión, DEC-MI-15), precios y costos.
- Parámetros operativos, entre ellos el plazo del retiro demorado (30 días iniciales, DEC-MI-14).
- CambioConfiguracion: entidad, clave, valor anterior, valor nuevo, usuario y fecha/hora.
- HistorialPrecio.

**Relaciones.**

- Cada catálogo 0..N cambios.
- TipoReparacion 0..N precios históricos.
- MesaDeTrabajo N..M TipoReparacion.

**Estados.**

- Registro de catálogo VIGENTE o NO_VIGENTE. No se borra lo referenciado.

**Eventos.**

- Configuración cambiada.
- Precio cambiado.
- Valor predeterminado cambiado.

**Invariantes.**

- Ningún cambio altera lo registrado en Detalles, Ejecuciones o documentos, que conservan su copia (snapshot), ni cambia precios de Órdenes existentes (DEC-MI-13).
- Todo cambio queda auditado y respeta los permisos.
- Las referencias históricas se preservan: un registro referenciado pasa a NO_VIGENTE, nunca se borra; un motivo conserva la versión con la que se eligió.
- La administración es delegable por permiso.

**Transacciones.**

- Cada cambio de configuración junto con su auditoría.

## 5. Cliente y consulta externa de identidad (UAT-010, DC14, DC19)

**Entidades.**

- Cliente: identificador interno, DNI opcional normalizado, nombre y apellido en un único campo, teléfono, email y clasificación Minorista/Mayorista.
- ConsultaExterna: proveedor, DNI consultado, resultado y fecha/hora, sin la respuesta completa con datos personales.

**Relaciones.**

- Cliente 1..N Órdenes.
- La Orden conserva su copia de los datos del cliente.

**Estados.**

- No tiene estados operativos.

**Eventos.**

- Cliente creado.
- Cliente reutilizado, por decisión explícita de Recepción.
- Datos corregidos en la Orden.
- Consulta externa realizada o fallida.

**Invariantes.**

- El DNI nunca es la identidad.
- Un DNI no pertenece a dos Clientes. Antes de exigirlo en la base hay que resolver los duplicados históricos (ABI-24).
- No hay vinculación silenciosa.
- La consulta externa es opcional, solo con un proveedor autorizado y configurable, y nunca bloquea el alta. Hoy no hay ninguno (ABI-30).
- La clasificación no cambia precios.

**Transacciones.**

- Alta o reutilización del Cliente junto con la creación de la Orden. La unicidad del DNI se comprueba en la misma transacción.

## 6. Equipo, identidad física y catálogo de Ventas (DC20, UAT)

**Entidades.**

- Equipo: identificador interno, IMEI y número de serie; historial completo de Órdenes, reparaciones, garantías, reingresos y custodia (DEC-MI-11).
- CorreccionVinculacionEquipo: Orden, Equipo anterior, Equipo nuevo, motivo, usuario y fecha/hora (DEC-MI-11).
- ProductoCatalogo: tp_id, marca, modelo, variante, capacidad, color, vigente y seleccionable.
- SincronizacionCatalogo: usuario, inicio, fin, origen, filtro, resultado y conteos.

**Relaciones.**

- Equipo 1..N Órdenes, solo con reutilización confirmada.
- Equipo 0..1 ProductoCatalogo, por tp_id como referencia comercial.
- La Orden conserva su copia de las características.

**Estados.**

- ProductoCatalogo: VIGENTE, NO_INFORMADO o ELIMINADO_EN_ORIGEN.
- SincronizacionCatalogo: EXITOSA, FALLIDA o RECHAZADA.

**Eventos.**

- Equipo registrado.
- Reutilización confirmada, o «Ninguno» elegido ante varias coincidencias.
- Vinculación corregida.
- Catálogo sincronizado o sincronización fallida.

**Invariantes.**

- El tp_id identifica un tipo de producto, nunca la unidad.
- La búsqueda por IMEI devuelve coincidencias y Recepción confirma antes de vincular el historial.
- Sin IMEI se busca por número de serie; sin ninguno, identidad nueva. Ante varias coincidencias Recepción elige o indica «Ninguno» (DEC-MI-11, cierra ABI-05).
- Nunca se vincula por similitud de nombre, modelo o cliente.
- Una vinculación errónea la corrigen Recepción, Coordinación RMA o Administración, con motivo y auditoría.
- Sin integración con equipos de Gestión RT (fuera de alcance).
- La sincronización nunca borra y conserva la última copia válida.
- El alta nunca consulta el origen de Ventas en línea.

**Transacciones.**

- Sincronización: la fusión completa en una transacción. El registro del intento se confirma aunque la fusión falle.
- Alta de Orden con Equipo nuevo o reutilizado: una transacción.
- Corrección de la vinculación: el cambio de Equipo en la Orden y su auditoría, en una transacción.

## 7. Información inicial de recepción: checklist, fotografías y notas (DC12, UAT-010/011, UAT)

**Entidades.**

- InformacionInicial: diagnóstico inicial, observaciones visibles y notas internas.
- RespuestaChecklist: pregunta, opción o no realizada, según el tipo de equipo.
- Fotografia: clave del objeto, tipo, tamaño, usuario y fecha/hora.
- ConfirmacionAdvertencia: qué faltaba, usuario y fecha/hora.
- CorreccionIngreso: dato corregido, valor anterior, valor nuevo, motivo obligatorio, usuario y fecha/hora (DEC-MI-07). Hasta cuándo se admite está pendiente (ABI-41).

**Relaciones.**

- Orden 0..1 información inicial.
- Orden 0..N respuestas del checklist.
- Orden 0..10 fotografías.

**Estados.**

- La Orden sigue en REQUERIMIENTO mientras se guarda parcialmente.

**Eventos.**

- Información inicial guardada.
- Fotografía agregada.
- Advertencia confirmada.
- Datos del ingreso corregidos.

**Invariantes.**

- Todo es opcional.
- Las fotografías solo se agregan con la Orden creada, y como máximo 10.
- Las notas internas nunca salen en documentos.
- La advertencia por información faltante (fotografías, observaciones o verificaciones del checklist) nunca bloquea.
- Corregir los datos del ingreso: Recepción, Coordinación RMA o Administración, con motivo; no altera los comprobantes ya emitidos (DEC-MI-07).

**Transacciones.**

- Corregir los datos del ingreso: el valor nuevo y su auditoría, en una transacción.
- Registrar una fotografía: el objeto se sube fuera de la transacción y la referencia se registra dentro. Un fallo deja a lo sumo un objeto huérfano, nunca una referencia rota.

## 8. Garantía: política, check-in, vigencia y reclamos RMA (DC15A, DC15B, UAT-009, DEC-MI-01, DEC-MI-02, DEC-MI-05)

**Entidades.**

- PoliticaGarantia, una por Tipo de Reparación (DEC-MI-01): plazo con check-in realizado y plazo con check-in no realizado (90 y 30 días iniciales) y política para los trabajos hechos dentro de una garantía RMA: NUEVO_PLAZO (según el Tipo), TIEMPO_RESTANTE (de la garantía original) o SIN_GARANTIA. Cuál es la inicial de cada Tipo está pendiente (ABI-38).
- GarantiaDetalle: política y Tipo aplicados, resultado del check-in considerado, plazo calculado, sugerido, definitivo, ajustes con motivo y vencimiento desde la entrega. Es trazable: se puede reconstruir cómo se calculó.
- Checkin: realizado o no realizado, usuario y fecha/hora, con versiones (DEC-MI-05): cada corrección antes de la entrega es una versión nueva con motivo obligatorio; ninguna versión se modifica ni se borra y rige la última.
- ExcepcionGarantia: de UN Detalle origen vencido (DEC-IT1-03): Detalle origen, vencimiento original, usuario, fecha/hora y motivo. La autorizan Recepción, Coordinación RMA o Administración (DEC-IT1-01).
- ReclamoGarantia (DEC-MI-02): registro independiente de cada pedido de ingreso en garantía, admitido o rechazado. Orden original, Detalles reclamados, Equipo, usuario, fecha/hora, vigencia evaluada de cada Detalle, excepciones autorizadas, motivo y resultado del rechazo, y la Orden paga posterior si se continuó. Lo consultan Recepción, Coordinación RMA y Administración.

**Relaciones.**

- Detalle 1 GarantiaDetalle.
- TipoReparacion 1 PoliticaGarantia vigente y 0..N versiones anteriores (BR-REP-040).
- Orden 0..N versiones de check-in; la vigente es la última.
- Orden de garantía, que referencia la Orden origen y los Detalles origen.
- Detalle origen reclamado 1 evaluación de vigencia, 0..1 ExcepcionGarantia (solo si está vencido).
- ReclamoGarantia 1 Orden original, 1..N Detalles reclamados, 0..1 Orden de garantía creada y 0..1 Orden CLIENTE_EXTERNO paga posterior.

**Estados.**

- Garantía de origen: VIGENTE o VENCIDA. Si está vencida, con o sin excepción (PROC-REP-036).
- ReclamoGarantia: ADMITIDO (crea la Orden de garantía) o RECHAZADO. Un rechazado puede quedar CONTINUADO_COMO_PAGO cuando se crea su Orden paga. Son estados del reclamo, no de la Orden: no agregan estados ni transiciones al proceso.
- La entrega queda bloqueada por check-in en PROC-REP-269. Es presentación: el workflow sigue en REPARACION_LISTA.

**Eventos.**

- Check-in registrado.
- Check-in corregido (versión nueva, con motivo).
- Garantía reasignada.
- Garantía ajustada.
- Política de garantía de un Tipo cambiada (BR-REP-040).
- Vigencia validada.
- Excepción autorizada.
- Reclamo de garantía registrado, admitido o rechazado.
- Ingreso en garantía no admitido (EVT-REP-998).
- Reclamo rechazado continuado como reparación paga.

**Invariantes.**

- Sugerencia de 90 días con el check-in registrado como realizado y de 30 con el check-in registrado como no realizado, por Detalle no cancelado, según los plazos de su Tipo de Reparación (DEC-MI-01). Qué plazo rige cuando el check-in no es exigible fuera de RMA, o mientras no hay uno registrado, está pendiente (ABI-39).
- Un trabajo hecho dentro de una garantía RMA recibe la garantía que dicta la política RMA de su Tipo.
- Un ajuste manual autorizado prevalece sobre el plazo calculado y nunca se pisa; exige motivo y queda auditado.
- La vigencia corre desde la entrega.
- Una Orden de CLIENTE_EXTERNO con trabajos realizados y garantía aplicable no se entrega sin check-in. La garantía es aplicable cuando al menos un trabajo realizado tiene garantía mayor a cero (DEC-MI-01, cierra ABI-37); si todos tienen garantía 0, no se exige.
- El check-in se corrige solo antes de la entrega, con motivo; se conservan todas las versiones y rige la última (DEC-MI-05).
- La vigencia se evalúa por cada Detalle reclamado, nunca para toda la Orden (DEC-IT1-03).
- Un Detalle vencido sin excepción no se admite: el pedido que lo incluye no crea la Orden (nunca una Orden con parte de lo pedido) e informa los Detalles elegibles.
- La excepción aplica solo al Detalle vencido identificado; la autorizan Recepción, Coordinación RMA o Administración, no el Técnico (DEC-IT1-01).
- Todo pedido queda en el registro de reclamos, también el rechazado; la Orden original entregada nunca se modifica (DEC-MI-02).
- Un reclamo rechazado origina como máximo una Orden paga: un reintento no crea otra.

**Transacciones.**

- Registrar o corregir el check-in: la versión, la reasignación de la garantía de cada Detalle y, si el comprobante final ya existía, su versión nueva, en una transacción.
- Crear una Orden de garantía: el reclamo, la validación de vigencia de cada Detalle, sus excepciones y la Orden nueva, en una transacción. Un rechazo registra solo el reclamo rechazado.
- Continuar un reclamo rechazado como reparación paga: la Orden CLIENTE_EXTERNO nueva, con los datos precargados que Recepción confirmó, y su vínculo con el reclamo, en una transacción, idempotente.

## 9. Ingreso inicial simplificado y documentos (UAT-008, DC13, DC26)

**Entidades.**

- Documento: tipo (ING, AUT, recepción, final, garantía) y contexto.
- VersionDocumento: número, snapshot, motivo, referencia a la versión reemplazada, usuario y fecha/hora.
- EvidenciaFirma: firma en pantalla o foto del documento firmado, ligada a una versión, con usuario y fecha/hora. Es opcional en todos los documentos (DEC-MI-06).

**Relaciones.**

- Orden 0..N documentos.
- Documento 1..N versiones, con una sola vigente.
- Versión 0..N evidencias.

**Estados.**

- Versión VIGENTE o REEMPLAZADA. Ninguna versión se borra.

**Eventos.**

- Comprobante de ingreso y autorización emitido.
- Comprobante AUT emitido.
- Versión nueva emitida.
- Firma registrada.
- Documento compartido (ver 14).

**Invariantes.**

- Un único documento vigente por tipo y contexto.
- El AUT solo incluye Detalles autorizados y no es comprobante de pago.
- Generar no equivale a enviar ni a firmar.
- Ningún documento exige firma (DEC-MI-06, cierra ABI-08).
- Corregir el check-in o los datos del ingreso nunca modifica una versión emitida: el check-in genera, cuando corresponde, una versión nueva del comprobante final (DEC-MI-05) y la corrección del ingreso no altera los comprobantes emitidos (DEC-MI-07).

**Transacciones.**

- El ingreso inicial completo (BR-REP-046), en una sola transacción e idempotente ante reintentos:
  - recepción física confirmada;
  - definición finalizada;
  - autorización inicial;
  - comprobante ING;
  - factibilidad y primera habilitación;
  - prioridad 4 y cola;
  - historial.
- Emitir una versión nueva: la versión y la marca de reemplazada sobre la anterior, en una transacción.

## 10. Comercial: Ajuste Comercial, pagos, anulaciones y devoluciones (DC09 a DC12C)

**Entidades.**

- AjusteComercial: tipo CORTESIA o DESCUENTO; alcance Orden o Detalle; porcentaje o importe; motivo; usuario; fecha/hora; historial de cambios y retiros. Lo aplican Recepción, Coordinación RMA o Administración (DEC-MI-03).
- Pago: importe, medio, tipo ANTICIPO o PAGO, referencia, usuario y fecha/hora.
- AnulacionPago: motivo, usuario y fecha/hora.
- DevolucionDinero: importe positivo, medio, motivo, referencia, usuario y fecha/hora.

**Relaciones.**

- Orden 0..N ajustes, pagos y devoluciones.
- Pago 0..1 anulación.

**Estados.**

- Pago VIGENTE o ANULADO.
- Saldo derivado: Total final − Pagos vigentes + Devoluciones. Si es mayor que 0, cobro pendiente; si es 0, listo para entregar; si es menor que 0, saldo a favor que se devuelve.

**Eventos.**

- Ajuste registrado, cambiado o retirado.
- Pago registrado.
- Pago anulado.
- Devolución registrada.

**Invariantes.**

- Un ajuste no supera el importe al que se aplica.
- Ningún precio original cambia.
- Un Pago nunca se borra.
- Una devolución no es un Pago negativo, no supera el saldo a favor y no se computa dos veces por su referencia.
- La CORTESIA puede ser total o parcial (DEC-IT1-02).
- Un ajuste general de la Orden y los ajustes de sus Detalles se registran por separado; el general no se prorratea automáticamente entre los Detalles (DEC-MI-03). Las reglas de acumulación no se definieron.
- Cualquier ajuste, CORTESIA o DESCUENTO, que deja el total por debajo de lo cobrado deja saldo a favor; los pagos y los ajustes históricos se conservan (DEC-MI-03, cierra ABI-10).
- Otorgar, modificar o quitar un ajuste: Recepción, Coordinación RMA o Administración (DEC-IT1-02 y DEC-MI-03, cierra ABI-09).
- Un envío duplicado no registra un segundo ajuste ni una segunda devolución.
- No hay entrega ni cierre con saldo distinto de 0.
- Pendientes:
  - dinero no retirado sin un equipo por retirar y devoluciones posteriores a ENTREGADA (ABI-40);
  - medios de devolución (ABI-29).

**Transacciones.**

- Cada movimiento (ajuste, pago, anulación, devolución) junto con su historial, bloqueando la Orden para que el saldo derivado sea coherente.

## 11. Custodia (DC18, DC18B, UAT)

**Entidades.**

- EventoCustodia: recepción confirmada, no recibido, regularización, devolución física (devolución sin reparar) o entrega; responsable, fecha/hora y evidencia o referencia.
- RetiroDemorado (DEC-MI-14): Orden, fecha de la notificación de equipo listo, plazo aplicado (30 días iniciales, parámetro de Administración), fecha de vencimiento y seguimientos (comunicaciones y gestiones, con usuario y fecha/hora).

**Relaciones.**

- Orden 0..N eventos de custodia. Su situación se deriva de esos eventos.
- Orden 0..1 retiro demorado vigente, con 0..N seguimientos.

**Estados (situaciones).**

1. SIN CUSTODIA.
2. BAJO CUSTODIA.
3. YA DEVUELTO.
4. RECEPCIÓN FÍSICA SIN CONFIRMAR.

**Eventos.**

- Los propios eventos de custodia.
- Retiro demorado marcado al vencer el plazo; seguimiento registrado.

**Invariantes.**

- No hay fin operativo con la custodia indeterminada.
- No hay Ejecución sin recepción confirmada cuando el origen la exige.
- Una devolución física no se duplica.
- Cada evento tiene un permiso configurable. Por defecto registran la recepción física, el no recibido, la devolución sin reparar y la entrega Recepción y Administración (DEC-MI-04, cierra ABI-06); la regularización registra uno de esos eventos con el permiso de la configuración inicial (DEC-MI-12).
- El vencimiento del retiro nunca cierra la Orden, nunca declara el abandono ni habilita a disponer del equipo: solo marca, alerta en las bandejas y deja registrar seguimientos (DEC-MI-14, cierra ABI-07).

**Transacciones.**

- El evento de custodia junto con la transición que habilita (por ejemplo, la devolución física y el paso a la verificación de saldo).
- Marcar el retiro demorado es idempotente: un vencimiento se marca una sola vez.

## 12. Cancelaciones y desistimiento (DC07, DC08)

**Entidades.**

- SolicitudDesistimiento: alcance (un Detalle o todos), motivo, canal si corresponde, usuario que la registró y fecha/hora.
- Cancelacion: tipo administrativa, descarte técnico o desistimiento del cliente; Detalle; motivo del catálogo de cancelación con su versión y, si es «Otro», su descripción (DEC-MI-15); usuario y fecha/hora; resolución. La de un Detalle en ejecución lleva como responsable al técnico que interrumpió (DEC-IT1-05).
- RegistroInterrupcion: técnico, fecha/hora, materiales, motivo del catálogo de interrupción con su versión (DEC-MI-15), reversibilidad Sí o No y descripción obligatoria del estado del trabajo (DEC-IT1-04).

**Relaciones.**

- Una solicitud produce 0..N cancelaciones efectivas.
- La cancelación de un Detalle en ejecución va precedida por su interrupción.

**Estados.**

- Solicitud PENDIENTE o RESUELTA.
- Detalle DEFINIDO → CANCELADO.

**Eventos.**

- Desistimiento solicitado.
- Ejecución interrumpida para cancelar.
- Detalle cancelado.
- Desistimiento total resuelto.

**Invariantes.**

- Un Detalle EN_PROGRESO no se cancela.
- Un COMPLETO nunca se cancela.
- Cancelar un Detalle libera solo sus recursos.
- No se cierra la Orden con Ejecuciones o solicitudes sin resolver.
- La solicitud y la cancelación efectiva son registros distintos, cada uno con su responsable; la efectiva no se atribuye a Recepción (DEC-IT1-05).
- Se distinguen el desistimiento de un Detalle, la cancelación efectiva del Detalle y la cancelación de la Orden (DC31).
- Los catálogos de motivos de cancelación y de interrupción son distintos; «Otro» exige descripción; una cancelación anterior conserva el motivo y la versión con que se registró y no cambia de significado (DEC-MI-15).

**Transacciones.**

- Cancelación efectiva: los Detalles, el resolver, la custodia resultante y el historial, en una transacción.
- El desistimiento total guiado se confirma por pasos: la solicitud, cada interrupción y la cancelación final. Cada paso es una transacción propia.

## 13. Stock operativo, lotes y Compras (UAT, gestión de inventario del 14/10/2026, DEC-MI-09, DEC-MI-10)

**Entidades.**

- Insumo: físico y reservado; el disponible es derivado. Su tipo configura si se controla por lote (DEC-MI-10).
- Lote: insumo, recepción de compra que lo originó y cantidades. Número de serie de la unidad cuando corresponda.
- MovimientoInsumo: tipo (ingreso, ajuste, reserva, consumo, devolución de insumo utilizable o desperdicio de material inutilizado, DEC-MI-10, cierra ABI-22), cantidad, lote o serie cuando corresponde, responsable, Orden y Detalle cuando corresponde, motivo y referencia.
- RevalidacionRecursos: resultado por Orden.
- Compras, proceso propio fuera de PROC-REP (DC24, DEC-MI-09, cierra ABI-12):
  - Proveedor: datos básicos.
  - SolicitudCompra: manual o sugerida ante un faltante; insumos y cantidades.
  - OrdenCompra: proveedor, insumos, cantidades y costos; quién la crea y quién la confirma. Sin aprobación.
  - RecepcionCompra: Orden de compra, cantidades recibidas, diferencias, costo real y quién recibe; varias por Orden de compra.

**Relaciones.**

- Insumo 0..N movimientos y 0..N lotes.
- Detalle 0..N movimientos.
- SolicitudCompra 0..N Órdenes de compra; OrdenCompra 0..N recepciones; RecepcionCompra 1..N ingresos de stock (y lotes cuando corresponde).
- Trazabilidad de la compra al consumo: recepción → lote → movimiento → Detalle.

**Estados.**

- Movimiento inmutable.
- Faltante visible cuando el disponible es menor que 0.
- OrdenCompra: creada, confirmada, recibida en parte o recibida por completo, según lo recibido frente a lo pedido.

**Eventos.**

- Ingreso de stock.
- Ajuste positivo o negativo.
- Revalidación ejecutada.
- Reserva, consumo, devolución y desperdicio de insumo.
- Solicitud de compra registrada o sugerida.
- Orden de compra creada y confirmada.
- Recepción de compra registrada, con sus diferencias.

**Invariantes.**

- Ningún ingreso ni ajuste modifica reservas.
- Ningún ajuste deja stock físico negativo.
- Todo ajuste negativo exige confirmación.
- No se duplican movimientos ni recepciones: un reintento es idempotente.
- El stock disponible y el reservado son coherentes con los movimientos.
- La devolución (insumo utilizable que vuelve) y el desperdicio (material inutilizado) son movimientos distintos.
- La revalidación no reserva, no repite la habilitación y no cambia prioridades.
- Nunca hay una compra automática sin confirmación.
- El último costo de compra es la referencia operativa; cada recepción conserva su costo histórico; solo Administración configura precios.
- Los permisos implementados son la configuración inicial (DEC-MI-12); crean y confirman Órdenes de compra y registran recepciones Recepción, Coordinación RMA y Administración.
- La contabilidad de stock existente pasa a este modelo con una transición controlada.

**Transacciones.**

- Cada ingreso o ajuste, con bloqueo del insumo.
- La revalidación: una transacción por Orden, de modo que un fallo no deshaga las demás.
- Registrar una recepción de compra: la recepción, sus diferencias, los ingresos de stock y los lotes, en una transacción, con bloqueo de la Orden de compra y de los insumos.

## 14. Comunicaciones asistidas y consentimiento (DC25 etapa 1, DC30, UAT, DEC-MI-08)

**Entidades.**

- PlantillaMensaje (configuración de Administración, DEC-MI-08): texto con variables de la Orden. Las cinco iniciales: ingreso de equipo, autorización pendiente, equipo listo para retirar, recordatorio de retiro y garantía.
- EnvioAsistido: Orden, plantilla, mensaje preparado (editado o no por el usuario), destinatario, canal, documento compartido, usuario, fecha/hora, intento de apertura de WhatsApp y confirmación manual del envío.
- Consentimiento: cliente, finalidad (operativa o comercial), canal, fecha/hora, usuario, origen y revocación. El comercial (marketing) exige consentimiento expreso.

**Relaciones.**

- Orden 0..N envíos asistidos.
- Cliente 0..N consentimientos.

**Estados.**

- Consentimiento VIGENTE o REVOCADO.
- El envío asistido es PREPARADO, ABIERTO (se intentó abrir WhatsApp) o CONFIRMADO_POR_USUARIO (confirmación manual). Nunca "entregado" ni "leído": esos estados solo llegarían con la evidencia de un proveedor, en la etapa 2.

**Eventos.**

- Mensaje preparado.
- Apertura de WhatsApp intentada.
- Envío confirmado manualmente.
- Documento compartido.
- Consentimiento otorgado o revocado.

**Invariantes.**

- Abrir WhatsApp no equivale a enviar.
- El usuario revisa y puede editar el mensaje antes de abrir WhatsApp.
- El envío respeta el consentimiento vigente para su finalidad y las preferencias del cliente; el marketing exige consentimiento expreso (DEC-MI-08, cierra ABI-31).
- Sin envíos automáticos de marketing (fuera de alcance).
- El proveedor de la etapa 2 sigue pendiente (ABI-13).

**Transacciones.**

- Registrar el envío asistido junto con su historial.
- Etapa 2: cola persistente con estados y reintentos, después de PostgreSQL.

## 15. Reparación «Otros» (UAT)

**Entidades.**

- DetalleReparacion con tipo reservado «Otros», descripción y precio manual.

**Relaciones.**

- Las de cualquier Detalle.

**Estados.**

- Los del Detalle (sección 1).

**Eventos.**

- Los del Detalle.

**Invariantes.**

- Se distingue de un tipo parametrizado.
- No inventa insumos previstos.
- Puntaje y compatibilidad con la Mesa de trabajo: pendientes de confirmar (ABI-20).

**Transacciones.**

- Las del alta del Detalle.

## Fuera de este diseño

- **Compras**: es un proceso funcional propio, distinto de PROC-REP (DC24). Su contenido lo decidió DEC-MI-09 y su modelo lógico está en la sección 13; no hay nodos de Compras en PROC-REP.
- **Integraciones excluidas de la macroiteración integral**: equipos y ventas de Gestión RT, proveedor automático de WhatsApp, envíos automáticos de marketing, gemelo digital y Odoo.
- **Reporting e indicadores**: postergados (DC29).
