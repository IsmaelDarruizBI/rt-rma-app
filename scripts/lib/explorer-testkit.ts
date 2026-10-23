/**
 * Fixture and helpers shared by the explorer tests (scripts/test-explorer.ts and scripts/test-explorer-browser.ts).
 * It loads the REAL V1.4 Source of Truth and drives the same pure engine the generated HTML embeds.
 */
import assert from "node:assert/strict";
import { buildExplorerData, type ExplorerData } from "./explorer-data";
import { buildGraph, replay, type Action, type EngineConfig, type EngineGraph, type ReplayResult } from "./explorer-engine";
import { scenarioOrigins, type Origin } from "./origin-filter";
import { edgeKey, loadYaml, type Actor, type BusinessRule, type ProcessModel } from "./process-model";
import type { FeatureModel } from "./feature-model";
import { isProcessEdgeStep, type Scenario, type ScenarioModel } from "./scenario-model";

export const PROCESS_FILE = "business/processes/repair-management-v1.4.yaml";
export const RULES_FILE = "business/rules/business-rules-v1.4.yaml";
export const ACTORS_FILE = "business/actors/actors.yaml";
export const FEATURES_FILE = "business/features/repair-management-features-v1.4.yaml";
export const SCENARIOS_FILE = "business/scenarios/repair-management-scenarios-v1.4.yaml";

export function createKit() {
  const model = loadYaml<ProcessModel>(PROCESS_FILE);
  const rules = loadYaml<{ rules: BusinessRule[] }>(RULES_FILE).rules;
  const actors = loadYaml<{ actors: Actor[] }>(ACTORS_FILE).actors;
  const features = loadYaml<FeatureModel>(FEATURES_FILE);
  const scenarios = loadYaml<ScenarioModel>(SCENARIOS_FILE).scenarios;
  const data: ExplorerData = buildExplorerData({ model, rules, actors, features, scenarios, sources: [PROCESS_FILE] });
  const graph: EngineGraph = buildGraph(data.graph);
  const scenarioOrigin = scenarioOrigins(scenarios);

  // default of the viewer: uncertainty is REPORTED (offered and flagged), not silently excluded
  const CFG: EngineConfig = { start: "EVT-REP-001", includeUncertain: true };
  const run = (actions: Action[], cfg: EngineConfig = CFG): ReplayResult => replay(graph, cfg, actions);
  const main = (r: ReplayResult) => r.threads[0];
  const nodesOf = (r: ReplayResult, thread = "main"): string[] => (r.threads.find((t) => t.id === thread)?.visits ?? []).map((v) => v.node);
  const optionByCondition = (r: ReplayResult, condition: string, thread = "main") => {
    const found = r.threads.find((t) => t.id === thread)?.pending?.options.find((o) => o.condition === condition);
    assert.ok(found, `alternativa "${condition}" en ${thread}: ${JSON.stringify(r.threads.find((t) => t.id === thread)?.pending?.options.map((o) => o.condition))}`);
    return found;
  };
  const choose = (actions: Action[], condition: string, thread = "main", cfg: EngineConfig = CFG): Action[] => {
    const r = run(actions, cfg);
    return [...actions, { type: "CHOOSE", thread, edge: optionByCondition(r, condition, thread).edge }];
  };
  const ids = (list: string[]): string[] => list.map((n) => `PROC-REP-${n}`);

  /**
   * Documented inconsistency of the Source of Truth (docs/audits/repair-management-v1.4-transversal-audit.md): VAR-REP-023 is
   * titled "origen distinto de CLIENTE_EXTERNO" and traverses 184 [... origen distinto de CLIENTE_EXTERNO] -> 080, but declares
   * applies_to HP-REP-001, so scenarioOrigins() reads it as CLIENTE_EXTERNO. The explorer is right to offer that edge only to
   * the other origins; the scenario is therefore driven with the origin its own title states. The YAML is not touched.
   */
  const SCENARIO_ORIGIN_OVERRIDES: Record<string, Origin> = { "VAR-REP-023": "RT_INTERNO" };

  /** Drives the engine along the PROCESS_EDGE steps of a scenario; returns the final replay or throws where the explorer deviates. */
  function driveScenario(s: Scenario, includeUncertain = true): { actions: Action[]; result: ReplayResult; expected: string[]; cfg: EngineConfig } {
    const steps = (s.steps ?? []).filter(isProcessEdgeStep);
    const expected = [steps[0].from, ...steps.map((st) => st.to)];
    const o = SCENARIO_ORIGIN_OVERRIDES[s.id] ? [SCENARIO_ORIGIN_OVERRIDES[s.id]] : scenarioOrigin.get(s.id);
    const midProcess = !graph.mainStarts.includes(steps[0].from);
    const cfg: EngineConfig = { start: steps[0].from, includeUncertain, ...(midProcess && Array.isArray(o) && o.length === 1 ? { forceOrigin: o[0] } : {}) };
    const actions: Action[] = [];
    for (let guard = 0; guard < 400; guard++) {
      const r = run(actions, cfg);
      assert.equal(r.rejected, undefined, `${s.id}: accion rechazada ${JSON.stringify(r.rejected)}`);
      const visits = nodesOf(r);
      // the explorer may legitimately keep advancing automatically past the last step of the Scenario
      const compared = Math.min(visits.length, expected.length);
      assert.deepEqual(visits.slice(0, compared), expected.slice(0, compared), `${s.id}: el recorrido automatico se desvia del Scenario`);
      if (visits.length >= expected.length) return { actions, result: r, expected, cfg };
      const t = main(r);
      const step = steps[visits.length - 1];
      const key = edgeKey(step.from, step.condition, step.to);
      assert.ok(t.pending, `${s.id}: el explorador se detuvo (${t.status}) antes del paso ${visits.length}: ${step.from} -> ${step.to}`);
      if (t.pending.kind === "DECISION") {
        assert.ok(t.pending.options.some((op) => op.edge === key), `${s.id}: la salida ${step.from} -[${step.condition ?? ""}]-> ${step.to} no esta disponible; opciones: ${t.pending.options.map((op) => op.condition).join(" | ")}`);
        actions.push({ type: "CHOOSE", thread: "main", edge: key });
      } else if (t.pending.kind === "CYCLE") {
        assert.equal(t.pending.cycleEdge, key, `${s.id}: el ciclo pendiente no es el paso del Scenario`);
        actions.push({ type: "CONTINUE_CYCLE", thread: "main" });
      } else {
        assert.ok(t.pending.options.some((op) => op.edge === key), `${s.id}: la salida de la espera no esta disponible`);
        actions.push({ type: "EVENT_OCCURRED", thread: "main" });
      }
    }
    throw new Error(`${s.id}: no termino`);
  }

  /** Seeded PRNG so the random walks are reproducible. */
  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** One random exploration; returns the final replay (never throws on a valid engine). */
  function randomWalk(seed: number, includeUncertain = true, maxActions = 160, forceOrigin?: Origin): { actions: Action[]; result: ReplayResult } {
    const rnd = mulberry32(seed);
    const cfg: EngineConfig = { start: "EVT-REP-001", includeUncertain, ...(forceOrigin ? { forceOrigin } : {}) };
    const actions: Action[] = [];
    for (let i = 0; i < maxActions; i++) {
      const r = run(actions, cfg);
      assert.equal(r.rejected, undefined, `semilla ${seed}: accion rechazada ${JSON.stringify(r.rejected)}`);
      const t = main(r);
      if (!t.pending) return { actions, result: r };
      if (t.pending.kind === "DECISION") actions.push({ type: "CHOOSE", thread: "main", edge: t.pending.options[Math.floor(rnd() * t.pending.options.length)].edge });
      else if (t.pending.kind === "CYCLE") actions.push({ type: "CONTINUE_CYCLE", thread: "main" });
      else actions.push({ type: "EVENT_OCCURRED", thread: "main" });
    }
    return { actions, result: run(actions, cfg) };
  }


  return {
    model, rules, actors, features, scenarios, data, graph, scenarioOrigin, CFG, run, main, nodesOf, optionByCondition, choose, ids,
    SCENARIO_ORIGIN_OVERRIDES, driveScenario, mulberry32, randomWalk,
  };
}

export type ExplorerKit = ReturnType<typeof createKit>;
export type { Action, EngineConfig, EngineGraph, ReplayResult, ExplorerData, Origin, ProcessModel, BusinessRule, Actor, FeatureModel, Scenario, ScenarioModel };
