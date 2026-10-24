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
- AsignacionRol: usuario y rol, varios por usuario.
- Accion: cada nodo con actor y cada capacidad transversal (pago, anulación, devolución, check-in, ajuste comercial, cambio de prioridad, liberación ajena, sincronización, stock, fotografías, eventos de custodia y tipos de cancelación).
- Permiso: rol, acción y contexto permitido.
- PermisoConsulta: rol y recurso consultable (Órdenes, Clientes, fotografías, documentos, pagos, reportes).
- CambioPermiso: auditoría (BR-REP-040).

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
- Pendientes: los responsables por evento de custodia (ABI-06) y los permisos por tipo de Ajuste Comercial (ABI-09).
- Los provisionales tomados de la implementación se validan en ABI-23.

**Transacciones.**

- Cambio de permisos o roles: cambio más auditoría.
- La evaluación de un permiso ocurre dentro de la transacción de la acción que habilita.

**Arquitectura (DC27C, DC28).**

- Autenticación con Supabase Auth.
- Usuarios, roles y permisos en PostgreSQL.
- FastAPI centraliza la autorización; el frontend nunca accede a tablas de negocio.
- La migración a Supabase PostgreSQL precede a Compras y a las automatizaciones.
- El núcleo, la configuración y los documentos se completan antes sobre JSON, con contratos de repositorio que no dependen del almacenamiento.

## 4. Administración de configuración y auditoría (DC23, DC23AUD, GLO-01)

**Entidades.**

- Catálogos: TipoReparacion (precio, puntaje, garantía), Insumo, MesaDeTrabajo (Estación) con sus tipos habilitados, ChecklistTipoEquipo (preguntas y opciones), PoliticaGarantia, PlantillaMensaje.
- Parámetros.
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

- Ningún cambio altera lo registrado en Detalles, Ejecuciones o documentos, que conservan su copia (snapshot).
- Todo cambio queda auditado.
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

- Equipo: identificador interno, IMEI y número de serie.
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
- Reutilización confirmada.
- Catálogo sincronizado o sincronización fallida.

**Invariantes.**

- El tp_id identifica un tipo de producto, nunca la unidad.
- La búsqueda por IMEI devuelve coincidencias y Recepción confirma antes de vincular el historial.
- Sin IMEI o con coincidencias ambiguas: pendiente (ABI-05).
- La sincronización nunca borra y conserva la última copia válida.
- El alta nunca consulta el origen de Ventas en línea.

**Transacciones.**

- Sincronización: la fusión completa en una transacción. El registro del intento se confirma aunque la fusión falle.
- Alta de Orden con Equipo nuevo o reutilizado: una transacción.

## 7. Información inicial de recepción: checklist, fotografías y notas (DC12, UAT-010/011, UAT)

**Entidades.**

- InformacionInicial: diagnóstico inicial, observaciones visibles y notas internas.
- RespuestaChecklist: pregunta, opción o no realizada, según el tipo de equipo.
- Fotografia: clave del objeto, tipo, tamaño, usuario y fecha/hora.
- ConfirmacionAdvertencia: qué faltaba, usuario y fecha/hora.

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

**Invariantes.**

- Todo es opcional.
- Las fotografías solo se agregan con la Orden creada, y como máximo 10.
- Las notas internas nunca salen en documentos.
- La advertencia por información faltante (fotografías, observaciones o verificaciones del checklist) nunca bloquea.

**Transacciones.**

- Registrar una fotografía: el objeto se sube fuera de la transacción y la referencia se registra dentro. Un fallo deja a lo sumo un objeto huérfano, nunca una referencia rota.

## 8. Garantía: política, check-in y vigencia RMA (DC15A, DC15B, UAT-009)

**Entidades.**

- PoliticaGarantia: por tipo de reparación y resultado del check-in. Las precedencias están pendientes (ABI-03).
- GarantiaDetalle: política aplicada, sugerido, definitivo, ajustes con motivo y vencimiento desde la entrega.
- Checkin: realizado o no realizado, usuario y fecha/hora. Cada registro es inmodificable. Si se admite corregirlo o registrarlo otra vez antes de la entrega, y cómo afecta al comprobante final, está pendiente (ABI-32); la implementación actual lo permite hasta entregar, como comportamiento técnico sin aprobación funcional.
- ExcepcionGarantia: Detalle origen, vencimiento, usuario, fecha/hora y motivo.
- Intento de reclamo rechazado: si se persiste, qué registra y quién lo consulta, pendiente (ABI-35).

**Relaciones.**

- Detalle 1 GarantiaDetalle.
- Orden 0..1 check-in vigente. Un historial de varios registros depende de ABI-32.
- Orden de garantía, que referencia la Orden origen y los Detalles origen.

**Estados.**

- Garantía de origen: VIGENTE o VENCIDA. Si está vencida, con o sin excepción (PROC-REP-036).
- La entrega queda bloqueada por check-in en PROC-REP-269. Es presentación: el workflow sigue en REPARACION_LISTA.

**Eventos.**

- Check-in registrado.
- Garantía reasignada.
- Garantía ajustada.
- Vigencia validada.
- Excepción autorizada.
- Ingreso en garantía no admitido (EVT-REP-998).

**Invariantes.**

- Sugerencia de 90 días con el check-in registrado como realizado y de 30 con el check-in registrado como no realizado, por Detalle no cancelado. Qué plazo rige sin check-in registrado forma parte de las precedencias (ABI-03).
- Un ajuste manual nunca se pisa.
- La vigencia corre desde la entrega.
- Una Orden de CLIENTE_EXTERNO con trabajos realizados y garantía aplicable no se entrega sin check-in. El criterio exacto de garantía aplicable está pendiente (ABI-37); la implementación lo interpreta provisionalmente como «al menos un trabajo realizado», sin que sea una regla aprobada.
- Una garantía vencida sin excepción no crea la Orden.
- Quién autoriza la excepción por defecto: pendiente (ABI-04).
- Pendientes de la garantía vencida, sin transiciones ni estados nuevos: Detalles origen con situaciones distintas (ABI-33), continuación como reparación paga vinculada al reclamo rechazado (ABI-34) y persistencia y auditoría del intento rechazado (ABI-35).

**Transacciones.**

- Registrar el check-in: el registro y la reasignación de la garantía de cada Detalle, en una transacción.
- Crear una Orden de garantía: la validación de vigencia, la excepción si la hay y la Orden nueva, en una transacción.

## 9. Ingreso inicial simplificado y documentos (UAT-008, DC13, DC26)

**Entidades.**

- Documento: tipo (ING, AUT, recepción, final, garantía) y contexto.
- VersionDocumento: número, snapshot, motivo, referencia a la versión reemplazada, usuario y fecha/hora.
- EvidenciaFirma: firma en pantalla o archivo firmado, ligada a una versión, con usuario y fecha/hora.

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
- La obligatoriedad de cada firma está pendiente (ABI-08).

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

- AjusteComercial: tipo CORTESIA o DESCUENTO; alcance Orden o Detalle; porcentaje o importe; motivo; usuario; fecha/hora; historial de cambios y retiros.
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
- Una cortesía total con Pagos previos deja saldo a favor.
- No hay entrega ni cierre con saldo distinto de 0.
- Pendientes:
  - permisos por tipo de ajuste (ABI-09);
  - DESCUENTO por debajo de lo cobrado (ABI-10);
  - cortesía parcial (ABI-26);
  - devoluciones no retiradas (ABI-07).

**Transacciones.**

- Cada movimiento (ajuste, pago, anulación, devolución) junto con su historial, bloqueando la Orden para que el saldo derivado sea coherente.

## 11. Custodia (DC18, DC18B, UAT)

**Entidades.**

- EventoCustodia: recepción confirmada, no recibido, regularización, devolución física o entrega; responsable, fecha/hora y evidencia o referencia.

**Relaciones.**

- Orden 0..N eventos de custodia. Su situación se deriva de esos eventos.

**Estados (situaciones).**

1. SIN CUSTODIA.
2. BAJO CUSTODIA.
3. YA DEVUELTO.
4. RECEPCIÓN FÍSICA SIN CONFIRMAR.

**Eventos.**

- Los propios eventos de custodia.

**Invariantes.**

- No hay fin operativo con la custodia indeterminada.
- No hay Ejecución sin recepción confirmada cuando el origen la exige.
- Una devolución física no se duplica.
- Cada evento tiene un permiso configurable. Los responsables predeterminados están pendientes (ABI-06).

**Transacciones.**

- El evento de custodia junto con la transición que habilita (por ejemplo, la devolución física y el paso a la verificación de saldo).

## 12. Cancelaciones y desistimiento (DC07, DC08)

**Entidades.**

- SolicitudDesistimiento: alcance (un Detalle o todos), motivo, usuario y fecha/hora.
- Cancelacion: tipo administrativa, descarte técnico o desistimiento del cliente; Detalle; motivo; usuario y fecha/hora; resolución.
- RegistroInterrupcion: estado del trabajo, materiales y reversibilidad. Las opciones de reversibilidad están pendientes (ABI-18).

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
- La solicitud y la cancelación efectiva son registros distintos.

**Transacciones.**

- Cancelación efectiva: los Detalles, el resolver, la custodia resultante y el historial, en una transacción.
- El desistimiento total guiado se confirma por pasos: la solicitud, cada interrupción y la cancelación final. Cada paso es una transacción propia.

## 13. Stock operativo (UAT, gestión de inventario del 14/10/2026)

**Entidades.**

- Insumo: físico y reservado; el disponible es derivado.
- MovimientoInsumo: tipo, cantidad, responsable, Orden y Detalle cuando corresponde, motivo y referencia.
- RevalidacionRecursos: resultado por Orden.

**Relaciones.**

- Insumo 0..N movimientos.
- Detalle 0..N movimientos.

**Estados.**

- Movimiento inmutable.
- Faltante visible cuando el disponible es menor que 0.

**Eventos.**

- Ingreso de stock.
- Ajuste positivo o negativo.
- Revalidación ejecutada.

**Invariantes.**

- Ningún ingreso ni ajuste modifica reservas.
- Ningún ajuste deja stock físico negativo.
- Todo ajuste negativo exige confirmación.
- No se duplican movimientos.
- La revalidación no reserva, no repite la habilitación y no cambia prioridades.
- Pendientes: el catálogo de tipos de movimiento (ABI-22) y los permisos provisionales (ABI-23).
- Lotes, unidades y costos llegan con el proceso de Compras (DC24, DC24LOT, ABI-12).

**Transacciones.**

- Cada ingreso o ajuste, con bloqueo del insumo.
- La revalidación: una transacción por Orden, de modo que un fallo no deshaga las demás.

## 14. Comunicaciones asistidas y consentimiento (DC25 etapa 1, DC30, UAT)

**Entidades.**

- PlantillaMensaje (configuración).
- EnvioAsistido: plantilla, destinatario, canal, documento compartido, usuario y fecha/hora.
- Consentimiento: cliente, finalidad (operativa o comercial), canal, fecha/hora, origen y revocación.

**Relaciones.**

- Orden 0..N envíos asistidos.
- Cliente 0..N consentimientos.

**Estados.**

- Consentimiento VIGENTE o REVOCADO.
- El envío asistido es PREPARADO; no hay "enviado" sin confirmación. Los estados de envío llegan en la etapa 2.

**Eventos.**

- Mensaje preparado.
- Documento compartido.
- Consentimiento otorgado o revocado.

**Invariantes.**

- Abrir WhatsApp no equivale a enviar.
- El envío respeta el consentimiento vigente para su finalidad.
- Plantillas, disparadores y proveedor están pendientes (ABI-13), y también cómo se obtiene el consentimiento (ABI-31).

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

- **Compras**: tendrá su propio proceso funcional, distinto de PROC-REP, a definir (DC24, ABI-12). No hay nodos de Compras en PROC-REP.
- **Reporting e indicadores**: postergados (DC29).
