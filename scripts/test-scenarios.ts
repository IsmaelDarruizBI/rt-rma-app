/**
 * Dependency-free tests for the Scenario layer (Happy Paths today, Variant
 * scaffolding tomorrow): the real HP-REP-001/HP-REP-002 in
 * business/scenarios/repair-management-scenarios-v1.3.yaml, plus NEGATIVE
 * cases built by mutating a deep clone of a real Happy Path and asserting
 * validateScenario() reports the expected error (so the validator is proven
 * to actually detect these defects, not just to pass on good data).
 *
 * Run with `tsx scripts/test-scenarios.ts`. Same style as
 * test-feature-scenario-mapping.ts: node:assert/strict, no framework.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import { loadYaml, type ProcessModel } from "./lib/process-model";
import type { FeatureModel } from "./lib/feature-model";
import { deriveScenarioFeatures } from "./lib/feature-scenario-mapping";
import { isProcessEdgeStep, type Scenario, type ScenarioModel } from "./lib/scenario-model";
import { findDuplicateIds, validateScenario } from "./validate-scenarios";

const PROCESS_FILE = "business/processes/repair-management-v1.3.yaml";
const FEATURES_FILE = "business/features/repair-management-features-v1.3.yaml";
const SCENARIOS_FILE = "business/scenarios/repair-management-scenarios-v1.3.yaml";
const SCHEMA_FILE = "business/schemas/scenario.schema.json";

const processModel = loadYaml<ProcessModel>(PROCESS_FILE);
const featuresModel = loadYaml<FeatureModel>(FEATURES_FILE);
const scenariosModel = loadYaml<ScenarioModel>(SCENARIOS_FILE);
const featureIds = new Set(featuresModel.features.map((feature) => feature.id));
const scenariosById = new Map(scenariosModel.scenarios.map((scenario) => [scenario.id, scenario]));

function real(id: string): Scenario {
  const scenario = scenariosById.get(id);
  assert.ok(scenario, `scenario ${id} must exist`);
  return scenario;
}

function clone(id: string): Scenario {
  return structuredClone(real(id));
}

function errorsOf(scenario: Scenario): string[] {
  const map = new Map(scenariosById);
  map.set(scenario.id, scenario);
  return validateScenario(scenario, processModel, featureIds, map);
}

function traversedNodes(scenario: Scenario): Set<string> {
  const set = new Set<string>();
  for (const step of scenario.steps) {
    if (isProcessEdgeStep(step)) {
      set.add(step.from);
      set.add(step.to);
    }
  }
  return set;
}

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK   ${name}`);
  } catch (error) {
    failures++;
    console.error(`  FAIL ${name}`);
    console.error(`       ${error instanceof Error ? error.message : String(error)}`);
  }
}

function expectError(scenario: Scenario, fragment: string): void {
  const errors = errorsOf(scenario);
  assert.ok(
    errors.some((error) => error.includes(fragment)),
    `expected an error containing "${fragment}", got: ${JSON.stringify(errors)}`
  );
}

console.log("Happy Paths reales\n");

check("HP-REP-001 y HP-REP-002 existen, IDs unicos", () => {
  assert.deepEqual(findDuplicateIds(scenariosModel.scenarios), []);
  assert.ok(scenariosById.has("HP-REP-001"));
  assert.ok(scenariosById.has("HP-REP-002"));
});

check("ambos Happy Paths validan sin errores", () => {
  assert.deepEqual(errorsOf(real("HP-REP-001")), []);
  assert.deepEqual(errorsOf(real("HP-REP-002")), []);
});

/** Ordered list of edge steps' "to" nodes, for order assertions (start node prepended). */
function orderOf(scenario: Scenario): string[] {
  const edges = scenario.steps.filter(isProcessEdgeStep);
  return [edges[0].from, ...edges.map((step) => step.to)];
}

check("HP-REP-002 sigue siendo un camino valido, RT_INTERNO, de inicio a fin", () => {
  const scenario = real("HP-REP-002");
  assert.deepEqual(errorsOf(scenario), []);
  const order = orderOf(scenario);
  assert.equal(order[0], "EVT-REP-001");
  assert.equal(order[order.length - 1], "EVT-REP-999");
  assert.ok(order.includes("PROC-REP-020"), "recibe contexto del equipo RT (PROC-REP-020)");
  assert.ok(!order.includes("PROC-REP-030"), "no registra cliente");
});

check("HP-REP-002 no recorre pago, validacion de saldo, comprobante final ni notificacion comercial a cliente", () => {
  const nodes = traversedNodes(real("HP-REP-002"));
  for (const commercial of ["PROC-REP-265", "PROC-REP-266", "PROC-REP-280", "PROC-REP-260", "PROC-REP-060"]) {
    assert.ok(!nodes.has(commercial), `${commercial} no debe ser atravesado`);
  }
  assert.ok(!real("HP-REP-002").steps.some((step) => step.kind === "FUNCTIONAL_ACTION"), "sin acciones funcionales de pago");
});

check("HP-REP-002 recorre PROC-REP-290 y luego la entrega/devolucion PROC-REP-270", () => {
  const order = orderOf(real("HP-REP-002"));
  assert.ok(order.includes("PROC-REP-290"), "recorre PROC-REP-290");
  assert.ok(order.includes("PROC-REP-270"), "recorre PROC-REP-270 (entrega/devolucion a Gestion RT)");
});

check("orden: REPARACION_LISTA(240) -> 250 -> 290 (informar) -> 270 (entrega/devolucion) -> cierre -> FIN", () => {
  const order = orderOf(real("HP-REP-002"));
  const at = (id: string): number => order.indexOf(id);
  assert.ok(at("PROC-REP-240") < at("PROC-REP-250"));
  assert.ok(at("PROC-REP-250") < at("PROC-REP-290"));
  assert.ok(at("PROC-REP-290") < at("PROC-REP-270"), "el resultado se informa ANTES de registrar la devolucion");
  assert.ok(at("PROC-REP-270") < at("EVT-REP-999"), "la entrega/devolucion ocurre antes del cierre/fin");
  assert.deepEqual(order.slice(-5), ["PROC-REP-240", "PROC-REP-250", "PROC-REP-290", "PROC-REP-270", "EVT-REP-999"]);
});

check("PROC-REP-270 no esta en skipped_nodes de HP-REP-002 (es entrega/devolucion a Gestion RT)", () => {
  assert.ok(!(real("HP-REP-002").skipped_nodes ?? []).some((skipped) => skipped.node === "PROC-REP-270"));
});

check("HP-REP-001 no cambia: no recorre PROC-REP-290 y entrega a cliente via 265 -> 280 -> 270", () => {
  const order = orderOf(real("HP-REP-001"));
  assert.ok(!order.includes("PROC-REP-290"));
  assert.ok(order.lastIndexOf("PROC-REP-265") < order.indexOf("PROC-REP-280"));
  assert.ok(order.indexOf("PROC-REP-280") < order.indexOf("PROC-REP-270"));
});

check("terminal_state de HP-REP-002 sigue PENDIENTE_DE_DEFINIR (sin estado inventado)", () => {
  const terminal = (real("HP-REP-002").expected).find((fact) => fact.key === "terminal_state");
  assert.equal(terminal?.value, "PENDIENTE_DE_DEFINIR");
});

check("todo skipped_nodes de HP-REP-002 esta realmente omitido y tiene motivo", () => {
  const scenario = real("HP-REP-002");
  const nodes = traversedNodes(scenario);
  assert.ok((scenario.skipped_nodes ?? []).length > 0);
  for (const skipped of scenario.skipped_nodes ?? []) {
    assert.ok(!nodes.has(skipped.node), `${skipped.node} esta en skipped_nodes pero se atraviesa`);
    assert.ok(skipped.reason.trim().length > 0, `${skipped.node} sin motivo`);
  }
});

check("HP-REP-001 y HP-REP-002 son caminos distintos (no se duplica un HP por origen)", () => {
  const a = traversedNodes(real("HP-REP-001"));
  const b = traversedNodes(real("HP-REP-002"));
  assert.ok(a.has("PROC-REP-030") && !b.has("PROC-REP-030"));
  assert.ok(b.has("PROC-REP-290") && !a.has("PROC-REP-290"));
});

check("active_features HP-REP-002 = FEAT-REP-001..008, sin FEAT-REP-009", () => {
  const { activeFeatureIds } = deriveScenarioFeatures(featuresModel, real("HP-REP-002"));
  assert.deepEqual(activeFeatureIds, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `FEAT-REP-00${n}`));
});

check("FEAT-REP-007 permanece activa en HP-REP-002 (con comportamiento distinto al de HP-REP-001)", () => {
  const rt = deriveScenarioFeatures(featuresModel, real("HP-REP-002"));
  const ext = deriveScenarioFeatures(featuresModel, real("HP-REP-001"));
  assert.ok(rt.activeFeatureIds.includes("FEAT-REP-007"), "FEAT-REP-007 debe estar activa en HP-REP-002");
  assert.ok(ext.activeFeatureIds.includes("FEAT-REP-007"), "FEAT-REP-007 debe estar activa en HP-REP-001");
  // Same Feature, different behavior: only HP-REP-001 traverses its own payment/balance nodes.
  const feat7 = featuresModel.features.find((f) => f.id === "FEAT-REP-007");
  assert.ok(feat7);
  const ownPayment = ["PROC-REP-265", "PROC-REP-266"];
  assert.ok(ownPayment.every((n) => feat7.process_nodes.includes(n)));
  assert.ok(ownPayment.every((n) => traversedNodes(real("HP-REP-001")).has(n)));
  assert.ok(ownPayment.every((n) => !traversedNodes(real("HP-REP-002")).has(n)));
});

check("la derivacion explica POR QUE cada Feature esta activa (razones), sin implicar una unica causa", () => {
  const { activationReasons, activeFeatureIds } = deriveScenarioFeatures(featuresModel, real("HP-REP-002"));
  for (const featureId of activeFeatureIds) {
    assert.ok((activationReasons[featureId] ?? []).length > 0, `${featureId} sin razon de activacion`);
  }
  assert.ok(activationReasons["FEAT-REP-007"].some((reason) => reason.includes("PROC-REP-070")));
  assert.ok(activationReasons["FEAT-REP-008"].some((reason) => reason.includes("PROC-REP-270")));
  assert.ok(activationReasons["FEAT-REP-008"].some((reason) => reason.includes("PROC-REP-290")));
});

check("ningun nodo esta a la vez en steps[] y en skipped_nodes (HP-REP-001 y HP-REP-002)", () => {
  for (const id of ["HP-REP-001", "HP-REP-002"]) {
    const nodes = traversedNodes(real(id));
    for (const skipped of real(id).skipped_nodes ?? []) {
      assert.ok(!nodes.has(skipped.node), `${id}: ${skipped.node} en steps y skipped_nodes`);
    }
  }
});



console.log("\nCasos negativos del validador\n");

check("nodo inexistente", () => {
  const s = clone("HP-REP-002");
  (s.steps[1] as { to: string }).to = "PROC-REP-999";
  expectError(s, 'to inexistente "PROC-REP-999"');
});

check("edge inexistente (par sin transicion)", () => {
  const s = clone("HP-REP-002");
  (s.steps[2] as { to: string }).to = "PROC-REP-150";
  expectError(s, "no existe ninguna transicion");
});

check("condicion distinta a la del process", () => {
  const s = clone("HP-REP-002");
  (s.steps[1] as { condition?: string }).condition = "CLIENTE_EXTERNO";
  expectError(s, "no coincide con el process");
});

check("condicion inventada donde el edge no tiene", () => {
  const s = clone("HP-REP-002");
  (s.steps[0] as { condition?: string }).condition = "inventada";
  expectError(s, "no coincide con el process");
});

check("salto imposible (continuidad rota)", () => {
  const s = clone("HP-REP-002");
  s.steps.splice(3, 1);
  expectError(s, "continuidad rota");
});

check("Happy Path sin inicio", () => {
  const s = clone("HP-REP-002");
  s.steps.shift();
  expectError(s, "debe comenzar en");
});

check("Happy Path sin fin", () => {
  const s = clone("HP-REP-002");
  s.steps.pop();
  expectError(s, "debe terminar en");
});

check("Happy Path sin steps de proceso", () => {
  const s = clone("HP-REP-002");
  s.steps = [];
  expectError(s, "sin ningun step PROCESS_EDGE");
});

check("IDs de Scenario duplicados", () => {
  assert.deepEqual(findDuplicateIds([{ id: "A" }, { id: "A" }, { id: "B" }] as Scenario[]), ["A"]);
});

check("FUNCTIONAL_ACTION con Feature inexistente", () => {
  const s = clone("HP-REP-001");
  const action = s.steps.find((step) => step.kind === "FUNCTIONAL_ACTION") as { feature: string };
  action.feature = "FEAT-REP-999";
  expectError(s, 'feature inexistente "FEAT-REP-999"');
});

check("skipped_nodes: nodo inexistente", () => {
  const s = clone("HP-REP-002");
  s.skipped_nodes = [{ node: "PROC-REP-999", reason: "x" }];
  expectError(s, 'skipped_nodes: node inexistente "PROC-REP-999"');
});

check("skipped_nodes: nodo a la vez incluido y omitido (p. ej. 270 en HP-REP-002)", () => {
  const s = clone("HP-REP-002");
  s.skipped_nodes = [{ node: "PROC-REP-270", reason: "x" }];
  expectError(s, "included y skipped a la vez");
});

check("skipped_nodes: duplicado", () => {
  const s = clone("HP-REP-002");
  s.skipped_nodes = [
    { node: "PROC-REP-030", reason: "x" },
    { node: "PROC-REP-030", reason: "y" },
  ];
  expectError(s, "node duplicado");
});

console.log("\nArquitectura preparada para Variants (sin instanciar ninguna real)\n");

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(JSON.parse(readFileSync(SCHEMA_FILE, "utf8")));

function syntheticVariant(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "VAR-TEST-001",
    name: "Variant sintetica de prueba",
    type: "VARIANT",
    scope: "FEATURE",
    status: "draft",
    source_process: { id: "PROC-REP", version: "1.3" },
    description: "Solo para probar la forma; no forma parte del modelo real.",
    feature: "FEAT-REP-001",
    applies_to: ["HP-REP-001"],
    trigger: { node: "PROC-REP-010", edge: { from: "PROC-REP-010", to: "PROC-REP-030", condition: "CLIENTE_EXTERNO" } },
    affected_nodes: ["PROC-REP-265", "PROC-REP-270"],
    rules: ["BR-REP-016"],
    dependencies: { requires: [], enables: [], implies: [], excludes: [] },
    ...overrides,
  } as Scenario;
}

check("el schema acepta una Variant sin steps/facts/expected", () => {
  const ok = validateSchema({ process: { id: "PROC-REP", version: "1.3" }, scenarios: [syntheticVariant()] });
  assert.ok(ok, JSON.stringify(validateSchema.errors));
});

check("el schema sigue exigiendo steps/facts/expected a un HAPPY_PATH", () => {
  const hp = syntheticVariant({ type: "HAPPY_PATH", scope: "E2E" });
  assert.ok(!validateSchema({ process: { id: "PROC-REP", version: "1.3" }, scenarios: [hp] }));
});

check("una Variant con referencias validas no produce errores", () => {
  const variant = syntheticVariant();
  const map = new Map(scenariosById);
  map.set(variant.id, variant);
  assert.deepEqual(validateScenario(variant, processModel, featureIds, map), []);
});

check("Variant: referencias rotas se detectan (feature, trigger, applies_to, dependencies)", () => {
  const variant = syntheticVariant({
    feature: "FEAT-REP-999",
    trigger: { node: "PROC-REP-999" },
    affected_nodes: ["PROC-REP-998"],
    applies_to: ["HP-REP-999"],
    dependencies: { requires: ["VAR-NOPE"], excludes: ["VAR-TEST-001"] },
  });
  const map = new Map(scenariosById);
  map.set(variant.id, variant);
  const errors = validateScenario(variant, processModel, featureIds, map);
  for (const fragment of [
    'feature inexistente "FEAT-REP-999"',
    'trigger.node inexistente "PROC-REP-999"',
    'affected_nodes: node inexistente "PROC-REP-998"',
    'applies_to: scenario inexistente "HP-REP-999"',
    'dependencies.requires: scenario inexistente "VAR-NOPE"',
    "no puede depender de si mismo",
  ]) {
    assert.ok(errors.some((e) => e.includes(fragment)), `falta error "${fragment}" en ${JSON.stringify(errors)}`);
  }
});

check("no hay Variants reales todavia (sin explosion combinatoria)", () => {
  assert.deepEqual(
    scenariosModel.scenarios.filter((s) => s.type !== "HAPPY_PATH").map((s) => s.id),
    []
  );
  assert.equal(scenariosModel.scenarios.filter((s) => s.type === "HAPPY_PATH").length, 2);
});

console.log("");
if (failures > 0) {
  console.error(`FAILED: ${failures} test(s) failed.`);
  process.exit(1);
}
console.log("OK: all scenario tests passed.");
