/**
 * Validates a Scenario YAML file, in two stages:
 *
 * A) Structural validation against business/schemas/scenario.schema.json
 *    (same scope as validate-process.ts/validate-features.ts: shape only).
 *
 * B) Referential integrity against the Business Process and its Features:
 *    - every PROCESS_EDGE step must reference a `from`/`to` node that
 *      exists, and an edge from -> to that exists EXACTLY in
 *      process.edges - same condition if the process edge has one, no
 *      invented condition if it doesn't (an edge is identified by
 *      from + condition + to, never by from/to alone, because several
 *      transitions can exist between the same two nodes);
 *    - PROCESS_EDGE continuity: ignoring FUNCTIONAL_ACTION steps (they
 *      never move the "current node"), step[n].to must equal
 *      step[n+1].from;
 *    - a HAPPY_PATH/E2E scenario must start at the process's start/event
 *      node and end at its end node;
 *    - every FUNCTIONAL_ACTION step's `feature` must exist in the
 *      Features file.
 *
 * This script never derives or stores covers_nodes/covers_edges - the
 * viewer computes those on the fly from steps[]. It does print
 * touched_features (diagnostic) and active_features (the Features
 * genuinely involved, per ALWAYS/CONTEXTUAL shared_node_bindings) via
 * ./lib/feature-scenario-mapping.ts, the same helper the viewer uses, so
 * the semantics never drift between the CLI and the HTML output.
 *

 * All three source files are parameterizable via optional positional CLI
 * args (`tsx scripts/validate-scenarios.ts [scenariosFile] [processFile]
 * [featuresFile]`), the same convention as validate-references.ts. There
 * is no V1.2 Scenarios file yet, so the defaults point at V1.3 - the only
 * revision that has one today.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import Ajv from "ajv";
import { parse } from "yaml";
import { loadYaml, type ProcessModel } from "./lib/process-model";
import type { FeatureModel } from "./lib/feature-model";
import { deriveScenarioFeatures } from "./lib/feature-scenario-mapping";
import {
  isFunctionalActionStep,
  isProcessEdgeStep,
  type Scenario,
  type ScenarioModel,
} from "./lib/scenario-model";

const SCHEMA_FILE = "business/schemas/scenario.schema.json";
const DEFAULT_SCENARIOS_FILE = "business/scenarios/repair-management-scenarios-v1.3.yaml";
const DEFAULT_PROCESS_FILE = "business/processes/repair-management-v1.3.yaml";
const DEFAULT_FEATURES_FILE = "business/features/repair-management-features-v1.3.yaml";

const cliArgs = process.argv.slice(2);
const SCENARIOS_FILE = cliArgs[0] ?? DEFAULT_SCENARIOS_FILE;
const PROCESS_FILE = cliArgs[1] ?? DEFAULT_PROCESS_FILE;
const FEATURES_FILE = cliArgs[2] ?? DEFAULT_FEATURES_FILE;

function findDuplicateIds(scenarios: Scenario[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const scenario of scenarios) {
    if (seen.has(scenario.id)) duplicates.add(scenario.id);
    seen.add(scenario.id);
  }
  return [...duplicates];
}

/** Identifies a process edge by from + condition + to, never by from/to alone. */
function edgeKey(from: string, condition: string | undefined, to: string): string {
  return `${from}::${condition ?? ""}::${to}`;
}

function validateScenario(scenario: Scenario, processModel: ProcessModel, featureIds: Set<string>): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(processModel.nodes.map((node) => node.id));
  const edgeKeys = new Set(processModel.edges.map((edge) => edgeKey(edge.from, edge.condition, edge.to)));
  const edgesByPair = new Map<string, string[]>();
  for (const edge of processModel.edges) {
    const pairKey = `${edge.from}::${edge.to}`;
    const conditions = edgesByPair.get(pairKey) ?? [];
    conditions.push(edge.condition ?? "(sin condicion)");
    edgesByPair.set(pairKey, conditions);
  }

  for (const step of scenario.steps) {
    if (isProcessEdgeStep(step)) {
      if (!nodeIds.has(step.from)) {
        errors.push(`step PROCESS_EDGE: from inexistente "${step.from}"`);
      }
      if (!nodeIds.has(step.to)) {
        errors.push(`step PROCESS_EDGE: to inexistente "${step.to}"`);
      }
      if (!edgeKeys.has(edgeKey(step.from, step.condition, step.to))) {
        const pairKey = `${step.from}::${step.to}`;
        const candidates = edgesByPair.get(pairKey);
        if (!candidates) {
          errors.push(`step PROCESS_EDGE: no existe ninguna transicion ${step.from} -> ${step.to} en el process`);
        } else {
          errors.push(
            `step PROCESS_EDGE: ${step.from} -> ${step.to} con condition ${
              step.condition ? `"${step.condition}"` : "(ninguna)"
            } no coincide con el process (condiciones existentes: ${candidates.join(", ")})`
          );
        }
      }
    } else if (isFunctionalActionStep(step)) {
      if (!featureIds.has(step.feature)) {
        errors.push(`step FUNCTIONAL_ACTION "${step.name}": feature inexistente "${step.feature}"`);
      }
    }
  }

  // Continuity: ignoring FUNCTIONAL_ACTION, step[n].to must equal step[n+1].from.
  const edgeSteps = scenario.steps.filter(isProcessEdgeStep);
  for (let i = 0; i < edgeSteps.length - 1; i++) {
    if (edgeSteps[i].to !== edgeSteps[i + 1].from) {
      errors.push(
        `continuidad rota: "${edgeSteps[i].from} -> ${edgeSteps[i].to}" seguido de ` +
          `"${edgeSteps[i + 1].from} -> ${edgeSteps[i + 1].to}" (${edgeSteps[i].to} != ${edgeSteps[i + 1].from})`
      );
    }
  }

  if (scenario.type === "HAPPY_PATH" && scenario.scope === "E2E") {
    const startNode = processModel.nodes.find((node) => node.type === "start") ?? processModel.nodes.find((node) => node.type === "event");
    const endNode = processModel.nodes.find((node) => node.type === "end");
    if (edgeSteps.length === 0) {
      errors.push("HAPPY_PATH/E2E sin ningun step PROCESS_EDGE");
    } else {
      if (startNode && edgeSteps[0].from !== startNode.id) {
        errors.push(`HAPPY_PATH/E2E debe comenzar en "${startNode.id}", comienza en "${edgeSteps[0].from}"`);
      }
      if (endNode && edgeSteps[edgeSteps.length - 1].to !== endNode.id) {
        errors.push(`HAPPY_PATH/E2E debe terminar en "${endNode.id}", termina en "${edgeSteps[edgeSteps.length - 1].to}"`);
      }
    }
  }

  return errors;
}

function main(): void {
  const schema = JSON.parse(readFileSync(SCHEMA_FILE, "utf8"));
  const data = parse(readFileSync(SCENARIOS_FILE, "utf8")) as ScenarioModel;

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  let hasErrors = false;

  if (!validate(data)) {
    hasErrors = true;
    console.error(`Validacion fallida: ${SCENARIOS_FILE}`);
    for (const error of validate.errors ?? []) {
      const path = error.instancePath || "(raiz)";
      console.error(`  ${path} ${error.message}`);
    }
  }

  if (Array.isArray(data.scenarios)) {
    const duplicateIds = findDuplicateIds(data.scenarios);
    if (duplicateIds.length > 0) {
      hasErrors = true;
      console.error(`IDs de Scenario duplicados en ${SCENARIOS_FILE}:`);
      for (const id of duplicateIds) console.error(`  ${id}`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  const processModel = loadYaml<ProcessModel>(PROCESS_FILE);
  const featuresModel = loadYaml<FeatureModel>(FEATURES_FILE);
  const featureIds = new Set(featuresModel.features.map((feature) => feature.id));

  console.log("=== Validacion referencial de Scenarios ===\n");

  const allErrors: string[] = [];
  for (const scenario of data.scenarios) {
    const errors = validateScenario(scenario, processModel, featureIds);
    const edgeStepCount = scenario.steps.filter(isProcessEdgeStep).length;
    const actionStepCount = scenario.steps.filter(isFunctionalActionStep).length;
    const touchedNodes = new Set<string>();
    for (const step of scenario.steps) {
      if (isProcessEdgeStep(step)) {
        touchedNodes.add(step.from);
        touchedNodes.add(step.to);
      }
    }
    const { touchedFeatureIds, activeFeatureIds } = deriveScenarioFeatures(featuresModel, scenario);

    console.log(`${scenario.id} (${scenario.type}/${scenario.scope}): ${scenario.name}`);
    console.log(`  PROCESS_EDGE steps: ${edgeStepCount}`);
    console.log(`  FUNCTIONAL_ACTION steps: ${actionStepCount}`);
    console.log(`  Nodos recorridos: ${touchedNodes.size}`);
    console.log(`  touched_features (diagnostico, bruto): ${touchedFeatureIds.join(", ") || "(ninguna)"}`);
    console.log(`  active_features: ${activeFeatureIds.join(", ") || "(ninguna)"}`);
    if (errors.length > 0) {
      console.log(`  ERRORES:`);
      for (const error of errors) console.log(`    - ${error}`);
      allErrors.push(...errors.map((error) => `${scenario.id}: ${error}`));
    } else {
      console.log(`  OK`);
    }
    console.log("");
  }

  if (allErrors.length > 0) {
    console.error(`FAILED: ${allErrors.length} error(es) de integridad referencial en ${SCENARIOS_FILE}.`);
    process.exit(1);
  }

  console.log(`OK: ${SCENARIOS_FILE} es valido y referencialmente consistente con ${PROCESS_FILE} y ${FEATURES_FILE}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
