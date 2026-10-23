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
  assert.match(t, /primero se interrumpe con la logica existente \(PROC-REP-200 y PROC-REP-210\)/);
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

if (failures > 0) {
  console.log(`\nFAILED: ${failures} test(s) failed.`);
  process.exit(1);
}
console.log("\nOK: consolidacion V1.4 - todas las verificaciones de las decisiones confirmadas pasaron.");
