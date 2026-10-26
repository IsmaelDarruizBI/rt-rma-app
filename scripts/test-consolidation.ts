/**
 * Dependency-free tests for the V1.4 consolidation of 23/10/2026: each block of
 * confirmed decisions (DC03 to DC30, DC07) and each formalized UAT behavior
 * (DC16) must be present in the process, the rules, the Features and the
 * Scenarios exactly as declared, and the MVP-only changes must survive.
 *
 * Run: npm run test:consolidation:v1.4
 *
 * It only reads the parsed models (never the YAML as text) and does not
 * replace the per-iteration tests (test-scenarios, test-commercial-closure,
 * test-customer-decision): those keep guarding what V1.4 already defined.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import type { FeatureModel } from "./lib/feature-model";
import { loadYaml, type BusinessRule, type ProcessModel } from "./lib/process-model";
import { isProcessEdgeStep, type Scenario, type ScenarioModel } from "./lib/scenario-model";
import {
  danglingOpenItemIds,
  loadImplementation,
  validateDecisionLog,
  IMPLEMENTATION_FILE,
  LOG_FILE,
  type DecisionLog,
} from "./validate-decisions";
import { validateProcessIntegrity, type Report } from "./validate-references";

const PROCESS_FILE = "business/processes/repair-management-v1.4.yaml";
const RULES_FILE = "business/rules/business-rules-v1.4.yaml";
const FEATURES_FILE = "business/features/repair-management-features-v1.4.yaml";
const SCENARIOS_FILE = "business/scenarios/repair-management-scenarios-v1.4.yaml";

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${(error as Error).message.split("\n").slice(0, 8).join("\n       ")}`);
  }
}

const model = loadYaml<ProcessModel>(PROCESS_FILE);
const rules = loadYaml<{ rules: BusinessRule[] }>(RULES_FILE).rules;
const features = loadYaml<FeatureModel>(FEATURES_FILE).features;
const scenarios = loadYaml<ScenarioModel>(SCENARIOS_FILE).scenarios;

function flat(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}
const node = (id: string) => {
  const found = model.nodes.find((n) => n.id === id);
  assert.ok(found, `existe ${id}`);
  return found;
};
const nodeText = (id: string): string => flat(node(id).description);
const rule = (id: string): string => {
  const found = rules.find((r) => r.id === id);
  assert.ok(found, `existe ${id}`);
  return flat(found.description);
};
const feature = (id: string) => {
  const found = features.find((f) => f.id === id);
  assert.ok(found, `existe ${id}`);
  return found;
};
const scenario = (id: string): Scenario => {
  const found = scenarios.find((s) => s.id === id);
  assert.ok(found, `existe ${id}`);
  return found;
};
const out = (from: string): string[] =>
  model.edges.filter((e) => e.from === from).map((e) => `${e.condition ?? ""}->${e.to}`).sort();
const orderOf = (s: Scenario): string[] => {
  const edges = s.steps.filter(isProcessEdgeStep);
  return [edges[0].from, ...edges.map((e) => e.to)];
};
const expectedOf = (s: Scenario, key: string): unknown => s.expected?.find((f) => f.key === key)?.value;

console.log("\nBloque 1 y 7 - actores, responsabilidades y permisos (DC03, DC04, DC05, DC06, DC08, DC27)\n");

check("cambios propios del MVP: actores alternativos en 150 y 270, 180 -> 212, 212/213 y 245 consolidado", () => {
  assert.equal(node("PROC-REP-150").actor, "ACT-COORD");
  assert.deepEqual(node("PROC-REP-150").actores_alternativos, ["ACT-RECEP"]);
  assert.equal(node("PROC-REP-270").actor, "ACT-ADMIN");
  assert.deepEqual(node("PROC-REP-270").actores_alternativos, ["ACT-RECEP"]);
  assert.deepEqual(out("PROC-REP-180"), ["->PROC-REP-212"], "tomar la Orden conduce a la decision de iniciar o liberar");
  assert.equal(node("PROC-REP-212").name, "¿Iniciar un Detalle de reparacion?");
  assert.match(nodeText("PROC-REP-212"), /inmediatamente despues de tomar la Orden, antes de seleccionar o iniciar un Detalle/);
  assert.match(nodeText("PROC-REP-213"), /incluso antes de seleccionar o iniciar el primer Detalle/);
  assert.equal(node("PROC-REP-245").name, "Consolidar puntaje de la reparacion");
  assert.match(nodeText("PROC-REP-245"), /NO calcula el puntaje de cada Detalle por primera vez/);
  assert.match(rule("BR-REP-009"), /puntaje_total de la Orden es siempre derivable/);
  assert.match(rule("BR-REP-018"), /inmediatamente despues de tomar la Orden como despues de finalizar una Ejecucion/);
  for (const id of ["HP-REP-001", "HP-REP-002", "HP-REP-003"]) {
    const order = orderOf(scenario(id));
    const at = order.indexOf("PROC-REP-180");
    assert.deepEqual(order.slice(at, at + 3), ["PROC-REP-180", "PROC-REP-212", "PROC-REP-181"], id);
  }
});

check("DC06: el tecnico define y redefine; Recepcion gestiona las autorizaciones", () => {
  for (const id of ["PROC-REP-075", "PROC-REP-127", "PROC-REP-128"]) assert.equal(node(id).actor, "ACT-TECH", id);
  assert.equal(node("PROC-REP-046").actor, "ACT-RECEP");
  assert.match(rule("BR-REP-003"), /incluso si el tecnico vuelve a elegir el mismo Tipo/);
  assert.doesNotMatch(rule("BR-REP-003"), /Recepcion vuelve a elegir/);
});

check("prioridad: la definen COORD o RECEP, la cambian Tecnico, Recepcion y Coordinacion, 4 - Normal por defecto", () => {
  const t = rule("BR-REP-034");
  assert.match(t, /la prioridad inicial la definen Coordinacion o Recepcion \(DC03\)/);
  assert.match(t, /cambiarla despues corresponde por defecto a Tecnico, Recepcion y Coordinacion/);
  assert.match(t, /prioridad 4 - Normal/);
  assert.match(t, /Extender ese ingreso automatico a RT_INTERNO y a la garantia RMA queda pendiente/);
  assert.match(nodeText("PROC-REP-150"), /permiso efectivo es configurable desde Administracion \(BR-REP-039\)/);
  assert.ok((node("PROC-REP-150").rules ?? []).includes("BR-REP-039"));
  // la unica entrada a 150 sigue siendo la primera habilitacion: cambiar la prioridad no reenvia la Orden
  assert.deepEqual(model.edges.filter((e) => e.to === "PROC-REP-150").map((e) => e.from), ["PROC-REP-140"]);
});

check("DC04: liberar la Orden tomada por otro tecnico (Tecnico y Coordinacion) con advertencia, motivo y auditoria", () => {
  assert.equal(node("PROC-REP-213").actor, "ACT-TECH");
  assert.deepEqual(node("PROC-REP-213").actores_alternativos, ["ACT-COORD"]);
  const t = rule("BR-REP-018");
  assert.match(t, /permitida por defecto a Tecnico y Coordinacion, con permiso configurable desde Administracion/);
  assert.match(t, /advertencia que indique quien tiene la Orden, confirmacion explicita, motivo obligatorio y auditoria/);
  assert.match(t, /conserva la trazabilidad de la toma original y de su liberacion/);
  assert.match(t, /la operacion de liberacion incluye su interrupcion con la logica existente \(PROC-REP-200 Interrumpido y PROC-REP-210/);
  const s = scenario("VAR-REP-037");
  assert.equal(s.feature, "FEAT-REP-004");
  assert.deepEqual(orderOf(s), ["PROC-REP-190", "PROC-REP-200", "PROC-REP-210", "PROC-REP-211", "PROC-REP-212", "PROC-REP-213", "PROC-REP-170"]);
  assert.equal(expectedOf(s, "execution_interrupted_before_release"), true);
  assert.equal(expectedOf(s, "detail_state_after_release"), "DEFINIDO");
  assert.equal(expectedOf(s, "simultaneous_takes"), false);
});

check("DC08 / DC27A / DC27B: permisos configurables, union de roles, consultas y tres tipos de cancelacion (BR-REP-039)", () => {
  const t = rule("BR-REP-039");
  assert.match(t, /son los responsables PREDETERMINADOS; Administracion puede modificarlos, delegarlos o restringirlos/);
  assert.match(t, /Un permiso es necesario pero no suficiente/);
  assert.match(t, /sus permisos efectivos son la union de los permisos de sus roles/);
  assert.match(t, /consulta de Ordenes, Clientes, fotografias, documentos, pagos y reportes/);
  assert.match(t, /cancelacion administrativa \(predeterminado: Recepcion y Coordinacion[^)]*\), descarte tecnico \(Tecnico, PROC-REP-183\) y desistimiento solicitado por el cliente/);
  // lo que sigue abierto se declara como pendiente, sin predeterminado inventado
  assert.match(t, /Pendientes, sin predeterminado definido: los responsables de cada evento de custodia \(BR-REP-033\) y los permisos iniciales por tipo de Ajuste Comercial/);
  assert.match(t, /Predeterminados provisionales, tomados de la implementacion y a validar/);
});

check("FEAT-REP-011 es TRANSVERSAL: no posee nodos y gobierna los responsables configurables", () => {
  const f = feature("FEAT-REP-011");
  assert.equal(f.kind, "TRANSVERSAL");
  assert.deepEqual(f.process_nodes, []);
  for (const id of ["PROC-REP-150", "PROC-REP-213", "PROC-REP-270"]) assert.ok(f.governed_nodes?.includes(id), id);
  assert.deepEqual(f.business_rules, ["BR-REP-039"]);
  // ninguna Feature de proceso pierde nodos: las transversales no cuentan como propietarias
  for (const other of features.filter((x) => x.kind !== "TRANSVERSAL")) assert.ok(other.process_nodes.length > 0, other.id);
  for (const id of ["BR-REP-034", "BR-REP-039"]) assert.ok(feature("FEAT-REP-004").business_rules.includes(id), id);
});

console.log("\nBloques 3 y 4 - clientes, equipos, garantias, recepcion y configuracion (DC12, DC14, DC15, DC18, DC19, DC20, DC23 y UAT)\n");

check("DC14: la consulta externa por DNI es opcional, solo con un proveedor autorizado y configurable; sin scraping", () => {
  const t = rule("BR-REP-021");
  assert.match(t, /unicamente a traves de un proveedor autorizado y configurable/);
  assert.match(t, /la carga manual esta siempre disponible/);
  assert.match(t, /nunca es obligatoria ni bloquea la creacion del Cliente ni de la Orden/);
  assert.match(t, /esta consolidacion no implementa integraciones/);
  const sourceOfTruth = JSON.stringify({ rules, model, features });
  assert.ok(!/cuitonline/i.test(sourceOfTruth), "ninguna referencia a la fuente anterior");
  assert.ok(!/scraping de/i.test(sourceOfTruth.replace(/reemplaza la referencia al scraping de una\s+pagina web/g, "")), "sin scraping como requerimiento");
});

check("UAT-010 y DC19: Cliente por DNI en la base propia, reutilizacion explicita, sin duplicados ni vinculo silencioso", () => {
  const t = rule("BR-REP-020");
  assert.match(t, /identificador interno propio \(nunca el DNI\)/);
  assert.match(t, /nombre y apellido en un unico campo/);
  assert.match(t, /Recepcion decide explicitamente reutilizarlo/);
  assert.match(t, /no hay vinculacion silenciosa por DNI/);
  assert.match(t, /sin cambiar precios automaticamente/);
});

check("DC20 y catalogo de Ventas: identidad fisica propia, reutilizacion confirmada por IMEI y tp_id como referencia comercial", () => {
  const t = rule("BR-REP-022");
  assert.match(t, /identidad fisica propia: identificador interno, IMEI y numero de serie/);
  assert.match(t, /Recepcion debe confirmar expresamente la reutilizacion antes de vincular el historial/);
  assert.match(t, /no pide numero de serie \(UAT-011\)/);
  assert.match(t, /Pendiente de definicion: como se identifica un equipo sin IMEI/);
  const c = rule("BR-REP-048");
  assert.match(c, /el tp_id identifica un tipo de producto, nunca la unidad/);
  assert.match(c, /nunca borra/);
  assert.match(c, /El alta de una Orden nunca consulta el origen de Ventas en linea/);
  assert.ok((node("PROC-REP-030").rules ?? []).includes("BR-REP-048"));
  assert.ok(feature("FEAT-REP-001").business_rules.includes("BR-REP-048"));
});

check("DC15B: la vigencia de la garantia de origen se valida en PROC-REP-036; vencida bloquea salvo excepcion autorizada", () => {
  assert.equal(node("PROC-REP-036").type, "decision");
  assert.deepEqual(out("PROC-REP-035"), ["->PROC-REP-036"]);
  assert.deepEqual(out("PROC-REP-036"), ["Vencida, excepcion autorizada->PROC-REP-040", "Vencida, sin excepcion->EVT-REP-998", "Vigente->PROC-REP-040"]);
  assert.equal(node("EVT-REP-998").type, "end");
  assert.deepEqual(model.edges.filter((e) => e.to === "EVT-REP-998").map((e) => e.from), ["PROC-REP-036"], "solo el ingreso no admitido termina en EVT-REP-998");
  assert.match(rule("BR-REP-019"), /si esta vencida, se advierte y se bloquea el ingreso en garantia, salvo una excepcion autorizada, con motivo obligatorio y auditada/);
  assert.deepEqual(orderOf(scenario("VAR-REP-038")), ["EVT-REP-002", "PROC-REP-035", "PROC-REP-036", "EVT-REP-998"]);
  assert.equal(expectedOf(scenario("VAR-REP-038"), "warranty_order_created"), false);
  assert.deepEqual(orderOf(scenario("VAR-REP-039")).slice(0, 4), ["EVT-REP-002", "PROC-REP-035", "PROC-REP-036", "PROC-REP-040"]);
  assert.equal(expectedOf(scenario("VAR-REP-039"), "exception_audited"), true);
  const hp3 = orderOf(scenario("HP-REP-003"));
  assert.deepEqual(hp3.slice(0, 4), ["EVT-REP-002", "PROC-REP-035", "PROC-REP-036", "PROC-REP-040"]);
  assert.ok(feature("FEAT-REP-001").process_nodes.includes("PROC-REP-036"));
});

check("DC15A y UAT: garantia por Detalle, 90/30 dias segun el check-in, ajustes que no se pisan, desde la entrega; precedencias pendientes", () => {
  const t = rule("BR-REP-041");
  assert.match(t, /La garantia se asigna a cada Detalle de reparacion/);
  assert.match(t, /con el check-in registrado como realizado se sugieren 90 dias y con el check-in registrado como no realizado, 30 dias/);
  assert.match(t, /una nueva sugerencia nunca lo pisa/);
  assert.match(t, /La vigencia se cuenta desde la entrega del equipo al cliente/);
  assert.match(t, /su contenido concreto sigue pendiente de decision/);
});

check("DC12: checklist por tipo de equipo, configurable, opcional y con advertencia por informacion faltante", () => {
  assert.match(rule("BR-REP-024"), /sus preguntas y opciones dependen del tipo de equipo y las configura Administracion/);
  assert.match(rule("BR-REP-024"), /todas las verificaciones son opcionales/);
  assert.match(rule("BR-REP-025"), /tambien se advierte cuando faltan verificaciones del checklist/);
  assert.match(rule("BR-REP-025"), /nunca bloquea/);
  assert.ok((node("PROC-REP-032").rules ?? []).includes("BR-REP-040"));
});

check("UAT-010/011 y UAT iteracion 1: fotografias, notas internas y numero de serie", () => {
  const f = rule("BR-REP-024");
  assert.match(f, /como maximo 10 por Orden/);
  assert.match(f, /antes de guardarlas se revisan y se aceptan o descartan una por una/);
  assert.match(f, /se agregan solo con la Orden ya creada y nunca son obligatorias/);
  assert.match(rule("BR-REP-023"), /notas internas, que solo se ven dentro de la aplicacion y nunca salen en documentos/);
  assert.match(nodeText("PROC-REP-030"), /El formulario inicial de CLIENTE_EXTERNO no pide numero de serie \(UAT-011\)/);
});

check("DC23 y DC23AUD: administracion delegable y auditada; Estacion = Mesa de trabajo; FEAT-REP-010 transversal", () => {
  const t = rule("BR-REP-040");
  assert.match(t, /Todo cambio de configuracion queda auditado con usuario, fecha\/hora, valor anterior y valor nuevo/);
  assert.match(t, /Los cambios posteriores nunca alteran las condiciones ya registradas/);
  assert.match(rule("BR-REP-015"), /historial de precios de cada Tipo de Reparacion registra usuario, fecha\/hora y valores anterior y nuevo/);
  assert.match(rule("BR-REP-011"), /Estacion de Trabajo y Mesa de trabajo son la misma entidad/);
  const f = feature("FEAT-REP-010");
  assert.equal(f.kind, "TRANSVERSAL");
  assert.deepEqual(f.process_nodes, []);
  for (const id of ["PROC-REP-030", "PROC-REP-032", "PROC-REP-036", "PROC-REP-172"]) assert.ok(f.governed_nodes?.includes(id), id);
  assert.deepEqual(f.business_rules, ["BR-REP-040", "BR-REP-041", "BR-REP-048"]);
});

check("UAT: reparacion \"Otros\", stock operativo y custodia confirmada antes de ejecutar", () => {
  assert.match(rule("BR-REP-047"), /descripcion y un precio manual/);
  assert.match(rule("BR-REP-047"), /pendientes de confirmar: puntaje 0 y compatibilidad con cualquier Mesa de trabajo/);
  assert.ok((node("PROC-REP-070").rules ?? []).includes("BR-REP-047"));
  for (const id of ["FEAT-REP-002", "FEAT-REP-007"]) assert.ok(feature(id).business_rules.includes("BR-REP-047"), id);
  const s = rule("BR-REP-049");
  assert.match(s, /disponible = fisico - reservado/);
  assert.match(s, /todo ajuste negativo exige confirmacion explicita/);
  assert.match(s, /Ningun ingreso o ajuste modifica reservas/);
  assert.match(s, /Los permisos de consulta, ingresos, ajustes y revalidacion son provisionales/);
  assert.ok(feature("FEAT-REP-003").business_rules.includes("BR-REP-049"));
  assert.match(rule("BR-REP-033"), /un tecnico no puede iniciar una Ejecucion sobre un equipo cuya recepcion no esta confirmada/);
  assert.ok((node("PROC-REP-185").rules ?? []).includes("BR-REP-033"));
  assert.ok(feature("FEAT-REP-005").business_rules.includes("BR-REP-033"));
});

check("DC18 y DC18B: cuatro situaciones de custodia, eventos con responsable y permiso; predeterminados pendientes", () => {
  const t = rule("BR-REP-033");
  assert.match(t, /Se adoptan estas cuatro situaciones de custodia/);
  assert.match(t, /registra responsable, fecha\/hora y evidencia o referencia, y requiere un permiso configurable por evento/);
  assert.match(t, /los responsables predeterminados de cada evento siguen pendientes/);
  assert.ok((node("PROC-REP-271").rules ?? []).includes("BR-REP-039"));
});

console.log("\nBloques 5 y 6 - comercial, documentos, check-in y comunicaciones (DC09 a DC13, DC25, DC26, DC30, UAT-008/009)\n");

check("DC09: un unico Ajuste Comercial (CORTESIA o DESCUENTO) por Orden o por Detalle; permisos por tipo pendientes", () => {
  const t = rule("BR-REP-016");
  assert.match(t, /CORTESIA y DESCUENTO se unifican en un unico Ajuste Comercial con tipo \(CORTESIA o DESCUENTO\), aplicable a la Orden o a un Detalle/);
  assert.match(t, /no puede superar el importe al que se aplica/);
  assert.match(t, /Los permisos iniciales por tipo siguen pendientes de decision/);
  assert.match(t, /como se trata un DESCUENTO que deja el total por debajo de lo ya cobrado/);
  // la condicion comercial por origen no cambia
  assert.match(t, /RMA_GARANTIA_REPARACION \(garantia de una reparacion RMA anterior\) es NO_COBRABLE como consecuencia de su origen/);
});

check("DC10 y DC11: anulacion auditada sin borrar el Pago; cortesia total con Pagos previos deja saldo a favor; formula unica", () => {
  const t = rule("BR-REP-017");
  assert.match(t, /Anulacion de Pagos \(DC10\): corresponde por defecto a Administracion, es delegable/);
  assert.match(t, /el Pago nunca se borra, queda registrado como anulado/);
  assert.match(t, /si los hay, deja saldo a favor del cliente, que debe devolverse antes del cierre/);
  assert.doesNotMatch(t, /Saldo = Total Cobrable - Total Pagado/, "una sola formula de Saldo");
  assert.match(t, /Tipo de Pago \(reconciliacion del 24\/09\/2026\)/);
  assert.equal(scenario("VAR-REP-040").feature, "FEAT-REP-007");
  assert.equal(scenario("VAR-REP-041").feature, "FEAT-REP-007");
});

check("DC12C: devoluciones por Administracion o Recepcion por defecto; no se cierra con saldo a favor", () => {
  assert.equal(node("PROC-REP-267").actor, "ACT-RECEP");
  assert.deepEqual(node("PROC-REP-267").actores_alternativos, ["ACT-ADMIN"]);
  assert.match(rule("BR-REP-038"), /registran devoluciones por defecto Administracion o Recepcion/);
  assert.match(rule("BR-REP-038"), /ninguna Orden finaliza operativamente \(EVT-REP-999\) con saldo a favor pendiente/);
});

check("DC13: un documento vigente por tipo y contexto, versiones con motivo y referencia; ING y AUT del UAT", () => {
  const t = rule("BR-REP-031");
  assert.match(t, /Existe un unico documento VIGENTE por tipo y contexto: una correccion genera una version nueva con motivo y referencia/);
  assert.match(t, /comprobante unico de ingreso y autorizacion \(ING, UAT-008, BR-REP-046\)/);
  assert.match(t, /comprobante de autorizacion de reparacion \(AUT/);
  assert.match(t, /aclara que no es un comprobante de pago, no se genera automaticamente/);
  assert.match(nodeText("PROC-REP-060"), /Documentos \(DC13\)/);
  assert.match(nodeText("PROC-REP-280"), /Es un documento versionado/);
});

check("DC26: firma en pantalla o archivo firmado ligados al documento y su version; obligatoriedad pendiente", () => {
  const t = rule("BR-REP-042");
  assert.match(t, /firma manuscrita en pantalla o con una foto o archivo del documento firmado/);
  assert.match(t, /ligada al documento y a la version firmada/);
  assert.match(t, /Cuando es obligatoria cada firma, segun el documento, sigue pendiente de decision/);
  for (const id of ["PROC-REP-046", "PROC-REP-280"]) assert.ok((node(id).rules ?? []).includes("BR-REP-042"), id);
});

check("DC25 etapa 1 y DC30: plantillas, historial de envios asistidos sin darlos por enviados y consentimiento por finalidad", () => {
  const c = rule("BR-REP-044");
  assert.match(c, /plantillas configurables/);
  assert.match(c, /Abrir WhatsApp no equivale a enviar/);
  assert.match(c, /Cada envio asistido queda en el historial de comunicaciones de la Orden/);
  assert.match(c, /Etapa 2 \(DC25\): proveedor oficial, con estados de envio y reintentos/);
  const k = rule("BR-REP-043");
  assert.match(k, /distinguen los mensajes operativos \(avisos sobre su Orden\) de los comerciales/);
  assert.match(k, /la finalidad, el canal, la fecha\/hora, el origen \(como se obtuvo\) y, si ocurre, su revocacion/);
  for (const id of ["BR-REP-043", "BR-REP-044"]) assert.ok((node("PROC-REP-260").rules ?? []).includes(id), id);
});

check("UAT-008: ingreso inicial simplificado en una sola operacion consistente, con eventos conservados y sin duplicados", () => {
  const t = rule("BR-REP-046");
  assert.match(t, /genera el comprobante de ingreso y autorizacion \(ING\)/);
  assert.match(t, /en una sola operacion consistente, sin estados parcialmente confirmados/);
  assert.match(t, /Los eventos de cada nodo se conservan para la trazabilidad/);
  assert.match(t, /un reintento o doble clic no duplica documentos ni registros/);
  assert.match(t, /que el estado fisico sea obligatorio es una decision de la implementacion pendiente de confirmar/);
  assert.match(t, /Aplica solo al ingreso inicial de CLIENTE_EXTERNO/);
  assert.ok((node("PROC-REP-046").rules ?? []).includes("BR-REP-046"));
  assert.ok(feature("FEAT-REP-002").business_rules.includes("BR-REP-046"));
});

check("UAT-009: check-in de entrega; 265 deriva a 269 con el Saldo en 0 y el check-in pendiente; HP-REP-001 lo registra", () => {
  assert.deepEqual(out("PROC-REP-265"), ["No, saldo a favor del cliente->PROC-REP-267", "No, saldo pendiente de cobro->PROC-REP-266", "Saldo en 0, falta el check-in->PROC-REP-269", "Si->PROC-REP-280"]);
  assert.deepEqual(out("PROC-REP-269"), ["Revalidar->PROC-REP-265"]);
  assert.deepEqual(model.edges.filter((e) => e.to === "PROC-REP-269").map((e) => e.from), ["PROC-REP-265"]);
  assert.equal(node("PROC-REP-269").actor, "ACT-SYSTEM");
  assert.ok(feature("FEAT-REP-008").process_nodes.includes("PROC-REP-269"));
  const t = rule("BR-REP-045");
  assert.match(t, /Lo registran Recepcion o Administracion/);
  assert.match(t, /sin trabajos realizados, RT_INTERNO y la garantia RMA no lo exigen/);
  assert.match(t, /La notificacion y el cobro no dependen del check-in/);
  const hp = scenario("HP-REP-001");
  const order = orderOf(hp);
  const at = order.indexOf("PROC-REP-269");
  assert.ok(at > 0 && order[at - 1] === "PROC-REP-265" && order[at + 1] === "PROC-REP-265", "265 -> 269 -> 265");
  assert.ok(hp.steps.some((s) => s.kind === "FUNCTIONAL_ACTION" && s.name === "Registrar check-in"));
  assert.equal(expectedOf(hp, "detail_warranty_days"), 90);
  for (const id of ["HP-REP-002", "HP-REP-003"]) assert.ok(!orderOf(scenario(id)).includes("PROC-REP-269"), `${id} no exige check-in`);
});

console.log("\nDC07 - cancelaciones durante ejecuciones\n");

check("DC07A: un Detalle DEFINIDO se cancela aunque otro se ejecute (VAR-REP-011/036 siguen validos)", () => {
  assert.match(rule("BR-REP-014"), /Un Detalle DEFINIDO puede cancelarse aunque otro Detalle de la Orden se este ejecutando: se liberan solo los recursos de ese Detalle/);
  assert.doesNotMatch(rule("BR-REP-014"), /no puede ejecutarse mientras exista una Ejecucion activa: primero debe cerrarse/, "la restriccion a nivel Orden se reemplazo (AUD-V14-004)");
  assert.deepEqual(orderOf(scenario("VAR-REP-011")).slice(-3), ["PROC-REP-300", "PROC-REP-211", "PROC-REP-190"]);
});

check("DC07B: un Detalle en ejecucion primero se interrumpe (estado, materiales, reversibilidad) y despues se cancela", () => {
  assert.match(rule("BR-REP-004"), /registra ademas el estado en que queda el trabajo, los materiales utilizados y si el trabajo puede revertirse/);
  assert.match(rule("BR-REP-004"), /el resultado Interrumpido tambien exige motivo/);
  assert.ok(out("PROC-REP-211").includes("Desistimiento solicitado de un Detalle ya interrumpido->PROC-REP-300"));
  const s = scenario("VAR-REP-042");
  assert.deepEqual(orderOf(s), ["PROC-REP-190", "PROC-REP-200", "PROC-REP-210", "PROC-REP-211", "PROC-REP-300", "PROC-REP-211"]);
  assert.equal(expectedOf(s, "cancelled_while_in_progress"), false);
  assert.equal(expectedOf(s, "request_and_cancellation_recorded_separately"), true);
});

check("DC07C: desistimiento total guiado; las Ejecuciones se resuelven antes del cierre", () => {
  assert.match(rule("BR-REP-030"), /La SOLICITUD de desistimiento \(lo que pide el cliente, registrada por Recepcion\) y la CANCELACION EFECTIVA son registros distintos/);
  assert.match(rule("BR-REP-030"), /no se cierra la Orden con Ejecuciones sin resolver/);
  assert.ok(out("PROC-REP-211").includes("Desistimiento total solicitado, sin Ejecucion activa->PROC-REP-305"));
  const s = scenario("VAR-REP-043");
  assert.deepEqual(orderOf(s).slice(-6), ["PROC-REP-211", "PROC-REP-305", "PROC-REP-211", "PROC-REP-270", "PROC-REP-268", "EVT-REP-999"]);
  assert.equal(expectedOf(s, "executions_resolved_before_closure"), true);
});

check("DC07D y DC08: un COMPLETO nunca se cancela; tres tipos de cancelacion con permiso; 300/305/306 sin actor unico", () => {
  assert.match(rule("BR-REP-014"), /Un Detalle COMPLETO nunca se cancela retroactivamente/);
  assert.match(rule("BR-REP-014"), /cancelacion administrativa \(por defecto Recepcion y Coordinacion\), descarte tecnico/);
  assert.match(rule("BR-REP-036"), /tipo de cancelacion "descarte tecnico" de DC08/);
  for (const id of ["PROC-REP-300", "PROC-REP-305", "PROC-REP-306"]) {
    assert.equal(node(id).actor, undefined, id);
    assert.doesNotMatch(nodeText(id), /no fue definido por negocio|sigue sin definirse por negocio/, id);
  }
  for (const id of ["PROC-REP-300", "PROC-REP-305"]) assert.ok((node(id).rules ?? []).includes("BR-REP-039"), id);
});

check("validadores: el schema rechaza una Feature TRANSVERSAL con nodos y una de proceso sin nodos; el validador rechaza actores alternativos invalidos", () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(JSON.parse(readFileSync("business/schemas/feature.schema.json", "utf8")));
  const base = structuredClone(feature("FEAT-REP-011"));
  const wrap = (f: unknown) => ({ process: { id: "PROC-REP", version: "1.4" }, features: [f] });
  assert.ok(validate(wrap(base)), JSON.stringify(validate.errors));
  assert.ok(!validate(wrap({ ...base, process_nodes: ["PROC-REP-150"] })), "TRANSVERSAL con nodos propios");
  assert.ok(!validate(wrap({ ...base, governed_nodes: undefined })), "TRANSVERSAL sin governed_nodes");
  const processFeature = structuredClone(feature("FEAT-REP-004"));
  assert.ok(validate(wrap(processFeature)), JSON.stringify(validate.errors));
  assert.ok(!validate(wrap({ ...processFeature, process_nodes: [] })), "Feature de proceso sin nodos");
  assert.ok(!validate(wrap({ ...processFeature, governed_nodes: ["PROC-REP-150"] })), "Feature de proceso con governed_nodes");
  const broken = structuredClone(model);
  const n150 = broken.nodes.find((n) => n.id === "PROC-REP-150");
  assert.ok(n150);
  n150.actores_alternativos = ["ACT-NOPE", "ACT-COORD"];
  const report: Report = { errors: [], warnings: [] };
  const actors = new Map(["ACT-ADMIN", "ACT-RECEP", "ACT-TECH", "ACT-CLIENT", "ACT-SYSTEM", "ACT-COORD"].map((id) => [id, { id, name: id }]));
  validateProcessIntegrity(broken, actors, new Map(rules.map((r) => [r.id, r])), report);
  assert.ok(report.errors.some((e) => e.includes('actor alternativo inexistente "ACT-NOPE"')), JSON.stringify(report.errors));
  assert.ok(report.errors.some((e) => e.includes('"ACT-COORD" ya es el actor principal')), JSON.stringify(report.errors));
});

check("registro de decisiones: es consistente y el validador detecta referencias inexistentes, reglas nuevas sin decision y UAT sin aprobacion formalizado", () => {
  const log = loadYaml<DecisionLog>(LOG_FILE);
  assert.deepEqual(validateDecisionLog(log), []);
  const broken = structuredClone(log);
  broken.decisions[0].rules = [...(broken.decisions[0].rules ?? []), "BR-REP-999"];
  assert.ok(validateDecisionLog(broken).some((e) => e.includes("regla inexistente BR-REP-999")));
  const uncovered = structuredClone(log);
  for (const x of [...uncovered.decisions, ...uncovered.uat_items]) x.rules = (x.rules ?? []).filter((r) => r !== "BR-REP-049");
  assert.ok(validateDecisionLog(uncovered).some((e) => e.includes("regla nueva BR-REP-049 sin decision")));
  const unapproved = structuredClone(log);
  const pending = unapproved.uat_items.find((u) => u.status === "PENDIENTE");
  assert.ok(pending, "hay al menos un comportamiento UAT sin aprobacion documentada");
  pending.rules = ["BR-REP-020"];
  assert.ok(validateDecisionLog(unapproved).some((e) => e.includes("no puede formalizarse como regla")));
  // todo lo abierto de la devolucion sigue abierto, sin regla inventada
  const titles = log.open_items.map((o) => o.title).join(" | ");
  for (const fragment of ["Precedencias concretas", "Equipos sin IMEI", "evento de custodia", "devoluciones que el cliente no retira", "firmas", "tipo de Ajuste Comercial", "Reparto de puntaje", "Compras", "WhatsApp", "Capacidades de tecnicos", "Reporting", "AUD-V14-005", "AUD-V14-011"]) {
    assert.ok(titles.toLowerCase().includes(fragment.toLowerCase()), `pendiente registrado: ${fragment}`);
  }
});

console.log("\nCorreccion final previa a DC01 - B1 a B4 de la auditoria focalizada y M2, M5, M7, M8, M9\n");

const decisionLog = loadYaml<DecisionLog>(LOG_FILE);
const implementation = loadImplementation();
const openItem = (id: string) => {
  const found = decisionLog.open_items.find((o) => o.id === id);
  assert.ok(found, `existe ${id}`);
  return found;
};
const uatItem = (id: string) => {
  const found = decisionLog.uat_items.find((u) => u.id === id);
  assert.ok(found, `existe ${id}`);
  return found;
};
const README = "docs/consolidation/README.md";
const DESIGN = "docs/consolidation/diseno-logico-v1.4.md";

check("B1: volver a registrar el check-in no es regla aprobada; queda como comportamiento tecnico y como pendiente ABI-32", () => {
  assert.doesNotMatch(rule("BR-REP-045"), /volver a registrarse|registrarse de nuevo/);
  assert.match(rule("BR-REP-045"), /Si el check-in puede corregirse o registrarse otra vez antes de la entrega, hasta cuando y como afecta eso al comprobante final siguen pendientes de decision/);
  assert.doesNotMatch(readFileSync(README, "utf8"), /al volver a registrar/);
  const abi = openItem("ABI-32");
  assert.equal(abi.impact, "BLOQUEA_IMPLEMENTACION");
  assert.ok(abi.decisions.includes("DC16") && abi.decisions.includes("DC13"));
  const i01 = uatItem("UAT-I01");
  assert.ok(i01.pending?.includes("ABI-32"));
  assert.ok(i01.technical_only?.some((t) => /Volver a registrar el check-in hasta la entrega.*sin aprobacion funcional demostrada/.test(t)));
});

check("B2: la condicion del check-in es la misma en regla, nodos, Feature, Scenarios y diseno; garantia aplicable pendiente en ABI-37", () => {
  const WITH = /trabajos realizados y\s+garantia aplicable/;
  const texts: Array<[string, string]> = [
    ["BR-REP-045", rule("BR-REP-045")],
    ["BR-REP-017", rule("BR-REP-017")],
    ["PROC-REP-265", nodeText("PROC-REP-265")],
    ["PROC-REP-269", nodeText("PROC-REP-269")],
    ["PROC-REP-270", nodeText("PROC-REP-270")],
    ["FEAT-REP-008", flat(feature("FEAT-REP-008").scope?.includes?.join(" "))],
  ];
  for (const [id, text] of texts) {
    assert.match(text, WITH, id);
    // ninguna mencion de la exigencia la reduce a "cualquier trabajo realizado"
    assert.doesNotMatch(text, /CLIENTE_EXTERNO,? con trabajos realizados(?! y\s+garantia aplicable)/, id);
  }
  assert.match(rule("BR-REP-045"), /el criterio exacto para determinar cuando la garantia es aplicable sigue pendiente de definicion/);
  const labels = scenarios.flatMap((s) => (s.facts ?? []).filter((f) => f.key === "checkin_required_for_delivery").map((f) => `${s.id}: ${f.label}`));
  assert.equal(labels.length, 5);
  for (const label of labels) assert.match(label, /CLIENTE_EXTERNO con trabajos realizados y garantia aplicable/);
  // separado de ABI-02 antes de cerrarlo con DC01
  const abi37 = flat(openItem("ABI-37").needed);
  assert.match(abi37, /Definir el criterio exacto para determinar cuando la garantia es aplicable/);
  assert.match(abi37, /Interpretacion provisional de la implementacion, no aprobada como regla/);
  assert.doesNotMatch(flat(openItem("ABI-02").needed), /garantia aplicable/);
  assert.match(readFileSync(DESIGN, "utf8"), /trabajos realizados y garantía aplicable no se entrega sin check-in/);
});

check("B3: garantia vencida con tres pendientes vinculados a 036, EVT-REP-998 y FEAT-REP-001, sin transiciones ni estados nuevos", () => {
  for (const id of ["ABI-33", "ABI-34", "ABI-35"]) {
    const abi = openItem(id);
    assert.equal(abi.impact, "BLOQUEA_IMPLEMENTACION", id);
    assert.deepEqual(abi.decisions, ["DC15B"], id);
    assert.ok(abi.nodes?.includes("PROC-REP-036") && abi.nodes.includes("EVT-REP-998"), id);
    assert.deepEqual(abi.features, ["FEAT-REP-001"], id);
    assert.ok(decisionLog.decisions.find((d) => d.id === "DC15B")?.open?.includes(id), `DC15B cita ${id}`);
  }
  assert.match(openItem("ABI-33").title, /parcialmente vigente/);
  assert.match(openItem("ABI-34").title, /reparacion paga/);
  assert.match(openItem("ABI-35").title, /reclamo de garantia rechazado/);
  // el grafo no cambia: 036 conserva sus tres salidas y EVT-REP-998 sigue siendo un fin sin salidas
  assert.deepEqual(out("PROC-REP-036"), ["Vencida, excepcion autorizada->PROC-REP-040", "Vencida, sin excepcion->EVT-REP-998", "Vigente->PROC-REP-040"]);
  assert.deepEqual(out("EVT-REP-998"), []);
  assert.equal(model.nodes.length, 76);
  assert.equal(model.edges.length, 142);
  const t036 = nodeText("PROC-REP-036");
  assert.match(t036, /Siguen pendientes de decision, sin transiciones ni estados nuevos/);
  for (const fragment of [/garantia parcialmente vigente/, /reparacion paga que conserve la relacion con el reclamo rechazado/, /se audita el intento de reclamo rechazado/]) assert.match(t036, fragment);
  assert.match(nodeText("EVT-REP-998"), /siguen pendientes de decision: este fin no los resuelve/);
  assert.ok(feature("FEAT-REP-001").open_questions?.some((q) => /garantia parcialmente vigente/.test(q) && /reclamo rechazado/.test(q)));
  assert.equal(expectedOf(scenario("VAR-REP-038"), "next_route_assumed"), false);
});

check("B4: la liberacion ajena incluye la interrupcion como excepcion especifica, sin permiso general para interrumpir, y queda auditada", () => {
  const t18 = rule("BR-REP-018");
  assert.match(t18, /Esa interrupcion es una excepcion especifica al permiso habitual de interrumpir/);
  assert.match(t18, /no concede un permiso general para interrumpir Ejecuciones ajenas/);
  assert.match(t18, /registra quien realiza la operacion, el titular, la Orden, la Ejecucion afectada cuando la hay, el motivo, la fecha\/hora, la estacion y el resultado/);
  assert.match(t18, /En PROC-REP-212 decide el titular de la toma o, en una liberacion ajena, quien libera con ese permiso/);
  assert.match(t18, /La definicion exacta del motivo de interrupcion que deriva de la liberacion \(BR-REP-004\) sigue pendiente/);
  const t39 = rule("BR-REP-039");
  assert.match(t39, /Excepcion especifica: la liberacion de una Orden tomada por otro tecnico incluye la interrupcion de su Ejecucion en curso/);
  assert.match(t39, /el permiso de liberar no concede un permiso general para interrumpir Ejecuciones ajenas/);
  assert.match(nodeText("PROC-REP-212"), /decide el tecnico titular de la toma o, cuando se libera una Orden tomada por otro tecnico, quien la libera con el permiso configurado/);
  assert.match(nodeText("PROC-REP-213"), /la operacion de liberacion incluye su interrupcion/);
  assert.match(nodeText("PROC-REP-213"), /no le concede un permiso general para interrumpir Ejecuciones ajenas/);
  // la interrupcion habitual sigue siendo del tecnico: 200 no gana responsables alternativos
  assert.equal(node("PROC-REP-200").actor, "ACT-TECH");
  assert.equal(node("PROC-REP-200").actores_alternativos, undefined);
  const s = scenario("VAR-REP-037");
  assert.equal(expectedOf(s, "interruption_part_of_release"), true);
  assert.equal(expectedOf(s, "general_interruption_permission_granted"), false);
  assert.match(s.expected?.find((e) => e.key === "release_audited")?.label ?? "", /quien la realiza, titular, Orden, Ejecucion afectada, motivo, fecha\/hora, estacion y resultado/);
  const abi = openItem("ABI-36");
  assert.ok(abi.decisions.includes("DC04") && abi.rules?.includes("BR-REP-004"));
  assert.ok(uatItem("UAT-I12").pending?.includes("ABI-36"));
});

check("M2, M5, M8 y M9: check-in registrado como no realizado, casos de liberacion, descuento por Recepcion y reglas sin detalles tecnicos", () => {
  assert.match(rule("BR-REP-041"), /check-in registrado como no realizado, 30 dias/);
  assert.doesNotMatch(rule("BR-REP-041"), /sin check-in realizado 30 dias/);
  const readme = readFileSync(README, "utf8");
  assert.match(readme, /\| Liberar la Orden antes de iniciar el primer Detalle: .* \| 180 → 212 \[No\] → 213 \| BR-REP-018 \|/);
  assert.match(readme, /\| Liberar una Orden tomada por otro técnico sin Ejecución en curso: .* \| 212 \[No\] → 213 \| BR-REP-018, 039 \|/);
  assert.match(flat(openItem("ABI-09").needed), /cambio 4\) aprobo aplicar descuentos desde Recepcion/);
  const technical = /registros_checkin|RecepcionEquipo|archivos JSON|PostgreSQL|cola persistente|tipo reservado|miniatura|camara|galeria|contador visible|audita temporalmente/;
  for (const r of rules.filter((x) => Number(x.id.slice(-3)) >= 39 || ["BR-REP-024"].includes(x.id))) {
    assert.doesNotMatch(flat(r.description), technical, r.id);
  }
  assert.ok(uatItem("UAT-I02").technical_only?.some((t) => /contador visible, captura con la camara/.test(t)), "la interfaz retirada de BR-REP-024 se conserva en UAT-I02");
});

check("M7: cada incorporacion CONFIRMADA cita commits de rt-rma-mvp; CONFIRMADO no es aceptacion UAT formal", () => {
  assert.equal(implementation.formal_uat_acceptance?.status, "PENDIENTE");
  const commits = new Map(implementation.uat_items.map((u) => [u.id, u.implemented_in]));
  for (const u of decisionLog.uat_items.filter((x) => x.status === "CONFIRMADO")) {
    assert.ok((commits.get(u.id) ?? []).length > 0, `${u.id} cita su implementacion`);
  }
  assert.match(readFileSync("docs/consolidation/matriz-trazabilidad-v1.4.md", "utf8"), /CONFIRMADO significa decision de negocio confirmada por el responsable funcional; no es aceptacion UAT formal/);
  const broken = structuredClone(decisionLog);
  broken.uat_items[2].confirmed_by = ["DC99"];
  const brokenImplementation = structuredClone(implementation);
  brokenImplementation.uat_items = brokenImplementation.uat_items.filter((u) => u.id !== "UAT-I01");
  brokenImplementation.uat_items[0].implemented_in = ["3b31d35"];
  delete brokenImplementation.formal_uat_acceptance;
  const errors = validateDecisionLog(broken, undefined, brokenImplementation);
  for (const fragment of ["UAT-I01: CONFIRMADO sin commit de rt-rma-mvp", "no es rt-rma-mvp@<commit>", "confirmed_by cita una decision inexistente DC99", "falta formal_uat_acceptance"]) {
    assert.ok(errors.some((e) => e.includes(fragment)), fragment);
  }
});

check("mejoras posteriores M1, M3, M4 y M6 trazadas; el validador rechaza referencias rotas en pendientes, mejoras y documentos", () => {
  assert.deepEqual((decisionLog.improvements ?? []).map((m) => `${m.id}:${m.audit_ref}`), ["MEJ-01:M1", "MEJ-02:M3", "MEJ-03:M4", "MEJ-04:M6"]);
  assert.ok(decisionLog.improvements?.find((m) => m.audit_ref === "M4")?.open?.includes("ABI-32"));
  const broken = structuredClone(decisionLog);
  broken.open_items.find((o) => o.id === "ABI-33")!.nodes = ["PROC-REP-999"];
  broken.improvements![0].files = ["scripts/no-existe.ts"];
  broken.improvements![1].open = ["ABI-99"];
  const errors = validateDecisionLog(broken);
  for (const fragment of ["ABI-33: nodo inexistente PROC-REP-999", "MEJ-01: archivo inexistente scripts/no-existe.ts", "MEJ-02: pendiente inexistente ABI-99"]) {
    assert.ok(errors.some((e) => e.includes(fragment)), fragment);
  }
  assert.deepEqual(danglingOpenItemIds("ver ABI-02, ABI-36 y ABI-77", new Set(decisionLog.open_items.map((o) => o.id))), ["ABI-77"]);
});

console.log("\nCierre de DC01 - baseline V1.4 vigente\n");

check("DC01 aprobada: baseline VIGENTE sobre b6cc3a5, con fecha, responsable y etiqueta; proceso y reglas V1.4 aprobados", () => {
  const dc01 = decisionLog.decisions.find((d) => d.id === "DC01");
  assert.equal(dc01?.status, "APROBADA");
  assert.equal(dc01?.open, undefined, "DC01 no deja pendientes abiertos");
  assert.equal(decisionLog.consolidation.status, "VIGENTE");
  const approval = decisionLog.consolidation.approval;
  assert.equal(approval?.decision, "DC01");
  assert.equal(approval?.approved_commit, "b6cc3a53587376213cb3bbdaea66e13b5488e5c3");
  assert.equal(approval?.approved_on, "2026-10-24");
  assert.match(approval?.approved_by ?? "", /responsable de producto/);
  assert.equal(approval?.tag, "v1.4-baseline");
  assert.equal(model.process.status, "approved");
  assert.ok(rules.every((r) => r.status === "approved"), "las 49 reglas V1.4 estan aprobadas");
  // Features y Scenarios conservan su propio ciclo de definicion, como con V1.2
  assert.ok(features.every((f) => f.status === "draft") && scenarios.every((s) => s.status === "draft"));
});

check("ABI-01 y ABI-02 cerrados por DC01; ABI-37 separado como bloqueante de implementacion; ABI-32 a 36 siguen abiertos", () => {
  for (const id of ["ABI-01", "ABI-02"]) {
    const o = openItem(id);
    assert.equal(o.status, "CERRADO", id);
    assert.equal(o.closed_by, "DC01", id);
    assert.equal(o.closed_on, "2026-10-24", id);
    assert.ok(o.resolution, id);
  }
  assert.match(flat(openItem("ABI-02").resolution), /se separo el criterio de garantia aplicable del check-in de entrega en ABI-37/);
  const abi37 = openItem("ABI-37");
  assert.equal(abi37.status, undefined, "ABI-37 esta abierto");
  assert.equal(abi37.impact, "BLOQUEA_IMPLEMENTACION");
  assert.deepEqual(abi37.rules, ["BR-REP-041", "BR-REP-045"]);
  assert.deepEqual(abi37.nodes, ["PROC-REP-265", "PROC-REP-269"]);
  assert.deepEqual(abi37.features, ["FEAT-REP-008", "FEAT-REP-010"]);
  assert.ok(decisionLog.decisions.find((d) => d.id === "DC15A")?.open?.includes("ABI-37"));
  assert.ok(uatItem("UAT-I01").pending?.includes("ABI-37") && !uatItem("UAT-I01").pending?.includes("ABI-02"));
  for (let n = 3; n <= 37; n++) {
    const id = `ABI-${String(n).padStart(2, "0")}`;
    assert.equal(openItem(id).status, undefined, `${id} sigue abierto`);
  }
  assert.ok(!decisionLog.open_items.some((o) => o.impact === "BLOQUEA_APROBACION" && o.status !== "CERRADO"));
});

check("la aprobacion no aprueba la UAT: UAT-I18 sigue PENDIENTE, UAT-I19 NO_FUNCIONAL y la aceptacion formal PENDIENTE", () => {
  assert.equal(uatItem("UAT-I18").status, "PENDIENTE");
  assert.equal(uatItem("UAT-I19").status, "NO_FUNCIONAL");
  assert.equal(implementation.formal_uat_acceptance?.status, "PENDIENTE");
  assert.match(flat(decisionLog.consolidation.approval?.scope), /No aprueba los casos de UAT pendientes ni la aceptacion UAT formal/);
});

check("el validador rechaza una baseline VIGENTE incompleta, un pendiente cerrado sin resolucion y citar como abierto un pendiente cerrado", () => {
  const broken = structuredClone(decisionLog);
  broken.consolidation.approval!.approved_commit = "b6cc3a5";
  broken.open_items.find((o) => o.id === "ABI-02")!.status = undefined;
  delete broken.open_items.find((o) => o.id === "ABI-01")!.resolution;
  broken.decisions.find((d) => d.id === "DC04")!.open = ["ABI-36", "ABI-01"];
  const errors = validateDecisionLog(broken);
  for (const fragment of ["approved_commit debe ser el hash completo", "ABI-02: ABIERTO con datos de cierre", "ABI-01: CERRADO sin resolucion", "DC04: cita como abierto el pendiente cerrado ABI-01"]) {
    assert.ok(errors.some((e) => e.includes(fragment)), fragment);
  }
  const reopened = structuredClone(decisionLog);
  for (const o of reopened.open_items.filter((x) => x.id === "ABI-02")) {
    delete o.status;
    delete o.closed_by;
    delete o.closed_on;
    delete o.resolution;
  }
  assert.ok(validateDecisionLog(reopened).some((e) => e.includes("ABI-02: bloquea la aprobacion y sigue ABIERTO en una baseline VIGENTE")));
  const candidate = structuredClone(decisionLog);
  candidate.consolidation.status = "CANDIDATA";
  assert.ok(validateDecisionLog(candidate).some((e) => e.includes("DC01: APROBADA en una consolidacion CANDIDATA")));
});

console.log("\nEstado de implementacion fuera de la copia funcional y DC02 implementada\n");

check("el estado de implementacion vive fuera de business/: el registro no lo contiene y cada decision tiene una entrada", () => {
  assert.ok(!IMPLEMENTATION_FILE.startsWith("business/"), "no se exporta con la copia funcional (DC02)");
  assert.ok(!("formal_uat_acceptance" in decisionLog.consolidation));
  for (const d of decisionLog.decisions) assert.ok(!("implementation" in d), `${d.id} sin implementation en el registro`);
  for (const u of decisionLog.uat_items) assert.ok(!("implemented_in" in u), `${u.id} sin implemented_in en el registro`);
  assert.deepEqual(implementation.decisions.map((e) => e.id), decisionLog.decisions.map((d) => d.id));
  assert.equal(implementation.baseline.commit, "e99b28386695df537aabd02d7068c0102de09eae");
  assert.equal(implementation.baseline.tag, decisionLog.consolidation.approval?.tag);
  const reintroduced = structuredClone(decisionLog) as DecisionLog & { decisions: Record<string, unknown>[] };
  reintroduced.decisions[0].implementation = { status: "PARCIAL" };
  const missing = structuredClone(implementation);
  missing.decisions = missing.decisions.filter((e) => e.id !== "DC04");
  const errors = validateDecisionLog(reintroduced, undefined, missing);
  for (const fragment of [`DC03: implementation vive en ${IMPLEMENTATION_FILE}`, "falta el estado de implementacion de DC04"]) {
    assert.ok(errors.some((e) => e.includes(fragment)), fragment);
  }
});

check("DC02 implementada en rt-rma-mvp mvp-v2 (fe560dd); la etiqueta v1.4-baseline no cambia", () => {
  const dc02 = implementation.decisions.find((e) => e.id === "DC02");
  assert.equal(dc02?.status, "IMPLEMENTADO");
  assert.match(dc02?.evidence ?? "", /rt-rma-mvp mvp-v2 fe560dd/);
  assert.match(dc02?.evidence ?? "", /FUNCTIONAL_SOURCE\.json/);
  assert.match(readFileSync("docs/consolidation/sincronizacion-dc02.md", "utf8"), /mvp-v2.*fe560dd/);
});

if (failures > 0) {
  console.log(`\nFAILED: ${failures} test(s) failed.`);
  process.exit(1);
}
console.log("\nOK: consolidacion V1.4 - todas las verificaciones de las decisiones confirmadas pasaron.");
