/**
 * Validates business/decisions/decision-log-v1.4.yaml against the V1.4
 * process, rules, Features and Scenarios, and keeps the generated
 * traceability matrix (docs/consolidation/matriz-trazabilidad-v1.4.md) in
 * sync with it.
 *
 * Run:
 *   npm run validate:decisions:v1.4            validate and check the matrix is up to date
 *   npm run generate:decision-matrix:v1.4      rewrite the matrix from the log
 *
 * Checks:
 *  1. IDs unique across decisions, uat_items, open_items and improvements;
 *     known enums.
 *  2. Every rule, node, Feature and Scenario a decision, UAT item, open item
 *     or improvement cites exists in the V1.4 YAML; every open item cites
 *     existing decisions and every `open`/`pending` reference points to an
 *     existing open item.
 *  3. A CONFIRMADA decision cites at least one artifact (or the document
 *     that records it), and IMPLEMENTADO/PARCIAL/CONTRARIO carry evidence.
 *     A CONFIRMADO UAT item names the rt-rma-mvp commits that implemented it,
 *     every `confirmed_by` is a decision of the log, and the log declares the
 *     status of the formal UAT acceptance (CONFIRMADO is not that acceptance).
 *  4. Coverage: every rule, node and Scenario created by the consolidation,
 *     and every rule or node whose text says "Consolidacion V1.4", is cited
 *     by at least one decision or UAT item.
 *  5. Every ID mentioned in the text of the V1.4 YAML exists (no dangling
 *     BR-REP / PROC-REP / EVT-REP / FEAT-REP / HP / VAR / EXC references), and
 *     every ABI-xx mentioned in the consolidation documents is an open item.
 *  6. The matrix file equals what the log generates.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { FeatureModel } from "./lib/feature-model";
import { loadYaml, type BusinessRule, type ProcessModel } from "./lib/process-model";
import type { ScenarioModel } from "./lib/scenario-model";

export const LOG_FILE = "business/decisions/decision-log-v1.4.yaml";
export const MATRIX_FILE = "docs/consolidation/matriz-trazabilidad-v1.4.md";
const V14 = {
  process: "business/processes/repair-management-v1.4.yaml",
  rules: "business/rules/business-rules-v1.4.yaml",
  features: "business/features/repair-management-features-v1.4.yaml",
  scenarios: "business/scenarios/repair-management-scenarios-v1.4.yaml",
};

const DECISION_STATUS = ["CONFIRMADA", "APROBADA_COMO_CANDIDATA"];
const IMPLEMENTATION_STATUS = ["IMPLEMENTADO", "PARCIAL", "NO_IMPLEMENTADO", "CONTRARIO", "NO_APLICA"];
const UAT_STATUS = ["CONFIRMADO", "PENDIENTE", "NO_FUNCIONAL"];
const IMPACT = ["BLOQUEA_APROBACION", "BLOQUEA_IMPLEMENTACION", "BLOQUEA_MIGRACION", "POSTERIOR"];

interface Traced {
  id: string;
  title: string;
  rules?: string[];
  nodes?: string[];
  features?: string[];
  scenarios?: string[];
}
interface Decision extends Traced {
  block: string | number;
  status: string;
  notes?: string;
  documented_in?: string[];
  implementation: { status: string; evidence?: string; gap?: string };
  open?: string[];
}
interface UatItem extends Traced {
  status: string;
  approval_evidence: string[];
  confirmed_by?: string[];
  implemented_in?: string[];
  technical_only?: string[];
  notes?: string;
  pending?: string[];
}
interface OpenItem extends Traced {
  impact: string;
  decisions: string[];
  needed: string;
}
interface Improvement extends Traced {
  audit_ref: string;
  files?: string[];
  open?: string[];
  needed: string;
}
export interface DecisionLog {
  consolidation: {
    id: string;
    status: string;
    decided_on: string;
    base_tag: string;
    formal_uat_acceptance?: { status: string; evidence: string };
  };
  decisions: Decision[];
  uat_items: UatItem[];
  open_items: OpenItem[];
  improvements?: Improvement[];
}

/** IDs created by the consolidation of 23/10/2026: each must be traced to a decision or UAT item. */
export const CONSOLIDATION_NEW = {
  rules: Array.from({ length: 11 }, (_, i) => `BR-REP-0${39 + i}`),
  nodes: ["PROC-REP-036", "PROC-REP-269", "EVT-REP-998"],
  scenarios: Array.from({ length: 7 }, (_, i) => `VAR-REP-0${37 + i}`),
};

const ID_IN_TEXT = /\b(?:BR-REP|PROC-REP|EVT-REP|FEAT-REP|HP-REP|VAR-REP|EXC-REP)-\d{3}\b/g;
const MVP_COMMIT = /^rt-rma-mvp@[0-9a-f]{7,40}$/;
/** Hand-written consolidation documents that cite open items (the matrix is generated from the log). */
export const DOCS_CITING_OPEN_ITEMS = [
  "docs/consolidation/README.md",
  "docs/consolidation/diseno-logico-v1.4.md",
  "docs/consolidation/sincronizacion-dc02.md",
  "docs/audits/repair-management-v1.4-transversal-audit.md",
];

/** ABI-xx IDs mentioned in `text` that are not open items of the log. */
export function danglingOpenItemIds(text: string, openIds: Set<string>): string[] {
  return [...new Set(text.match(/\bABI-\d{2}\b/g) ?? [])].filter((id) => !openIds.has(id));
}

export function loadModels() {
  return {
    process: loadYaml<ProcessModel>(V14.process),
    rules: loadYaml<{ rules: BusinessRule[] }>(V14.rules).rules,
    features: loadYaml<FeatureModel>(V14.features).features,
    scenarios: loadYaml<ScenarioModel>(V14.scenarios).scenarios,
  };
}

export function validateDecisionLog(log: DecisionLog, models = loadModels()): string[] {
  const errors: string[] = [];
  const ruleIds = new Set(models.rules.map((r) => r.id));
  const nodeIds = new Set(models.process.nodes.map((n) => n.id));
  const featureIds = new Set(models.features.map((f) => f.id));
  const scenarioIds = new Set(models.scenarios.map((s) => s.id));
  const decisionIds = new Set(log.decisions.map((d) => d.id));
  const openIds = new Set(log.open_items.map((o) => o.id));

  const improvements = log.improvements ?? [];

  // 1. unique IDs and enums
  const all = [
    ...log.decisions.map((d) => d.id),
    ...log.uat_items.map((u) => u.id),
    ...log.open_items.map((o) => o.id),
    ...improvements.map((m) => m.id),
  ];
  for (const id of all.filter((id, i) => all.indexOf(id) !== i)) errors.push(`id duplicado: ${id}`);
  for (const d of log.decisions) {
    if (!DECISION_STATUS.includes(d.status)) errors.push(`${d.id}: status desconocido "${d.status}"`);
    if (!IMPLEMENTATION_STATUS.includes(d.implementation?.status)) errors.push(`${d.id}: implementation.status desconocido "${d.implementation?.status}"`);
  }
  for (const u of log.uat_items) if (!UAT_STATUS.includes(u.status)) errors.push(`${u.id}: status desconocido "${u.status}"`);
  for (const o of log.open_items) if (!IMPACT.includes(o.impact)) errors.push(`${o.id}: impact desconocido "${o.impact}"`);

  // 2. references
  const checkRefs = (owner: Traced): void => {
    for (const id of owner.rules ?? []) if (!ruleIds.has(id)) errors.push(`${owner.id}: regla inexistente ${id}`);
    for (const id of owner.nodes ?? []) if (!nodeIds.has(id)) errors.push(`${owner.id}: nodo inexistente ${id}`);
    for (const id of owner.features ?? []) if (!featureIds.has(id)) errors.push(`${owner.id}: Feature inexistente ${id}`);
    for (const id of owner.scenarios ?? []) if (!scenarioIds.has(id)) errors.push(`${owner.id}: Scenario inexistente ${id}`);
  };
  for (const d of log.decisions) {
    checkRefs(d);
    for (const id of d.open ?? []) if (!openIds.has(id)) errors.push(`${d.id}: pendiente inexistente ${id}`);
    for (const path of d.documented_in ?? []) if (!existsSync(path)) errors.push(`${d.id}: documento inexistente ${path}`);
  }
  for (const u of log.uat_items) {
    checkRefs(u);
    for (const id of u.pending ?? []) if (!openIds.has(id)) errors.push(`${u.id}: pendiente inexistente ${id}`);
    for (const id of u.confirmed_by ?? []) if (!decisionIds.has(id)) errors.push(`${u.id}: confirmed_by cita una decision inexistente ${id}`);
    for (const ref of u.implemented_in ?? []) if (!MVP_COMMIT.test(ref)) errors.push(`${u.id}: implemented_in "${ref}" no es rt-rma-mvp@<commit>`);
    if (u.approval_evidence.length === 0) errors.push(`${u.id}: sin evidencia de aprobacion`);
    if (u.status === "CONFIRMADO" && (u.rules ?? []).length === 0) errors.push(`${u.id}: CONFIRMADO sin regla que lo formalice`);
    if (u.status === "CONFIRMADO" && (u.implemented_in ?? []).length === 0) errors.push(`${u.id}: CONFIRMADO sin commit de rt-rma-mvp que lo implemente`);
    if (u.status !== "CONFIRMADO" && (u.rules ?? []).length > 0) errors.push(`${u.id}: ${u.status} no puede formalizarse como regla`);
  }
  if (!log.consolidation.formal_uat_acceptance?.status) errors.push("consolidation: falta formal_uat_acceptance (CONFIRMADO no es aceptacion UAT formal)");
  for (const o of log.open_items) {
    checkRefs(o);
    if (o.decisions.length === 0) errors.push(`${o.id}: no cita ninguna decision`);
    for (const id of o.decisions) if (!decisionIds.has(id)) errors.push(`${o.id}: decision inexistente ${id}`);
  }
  for (const m of improvements) {
    checkRefs(m);
    if (!m.audit_ref) errors.push(`${m.id}: sin referencia a la auditoria`);
    for (const id of m.open ?? []) if (!openIds.has(id)) errors.push(`${m.id}: pendiente inexistente ${id}`);
    for (const path of m.files ?? []) if (!existsSync(path)) errors.push(`${m.id}: archivo inexistente ${path}`);
  }

  // 3. content of a confirmed decision
  for (const d of log.decisions) {
    const artifacts = [...(d.rules ?? []), ...(d.nodes ?? []), ...(d.features ?? []), ...(d.scenarios ?? []), ...(d.documented_in ?? [])];
    if (artifacts.length === 0) errors.push(`${d.id}: decision sin artefactos ni documento`);
    if (["IMPLEMENTADO", "PARCIAL", "CONTRARIO"].includes(d.implementation.status) && !d.implementation.evidence) {
      errors.push(`${d.id}: ${d.implementation.status} sin evidencia en el codigo`);
    }
  }

  // 4. coverage of what the consolidation created or changed
  const traced = {
    rules: new Set([...log.decisions, ...log.uat_items].flatMap((x) => x.rules ?? [])),
    nodes: new Set([...log.decisions, ...log.uat_items].flatMap((x) => x.nodes ?? [])),
    scenarios: new Set([...log.decisions, ...log.uat_items].flatMap((x) => x.scenarios ?? [])),
  };
  for (const id of CONSOLIDATION_NEW.rules) if (!traced.rules.has(id)) errors.push(`regla nueva ${id} sin decision que la origine`);
  for (const id of CONSOLIDATION_NEW.nodes) if (!traced.nodes.has(id)) errors.push(`nodo nuevo ${id} sin decision que lo origine`);
  for (const id of CONSOLIDATION_NEW.scenarios) if (!traced.scenarios.has(id)) errors.push(`Scenario nuevo ${id} sin decision que lo origine`);
  for (const r of models.rules) {
    if (/consolidacion V1\.4/i.test(r.description ?? "") && !traced.rules.has(r.id)) errors.push(`${r.id} cambia en la consolidacion pero ninguna decision la cita`);
  }
  for (const n of models.process.nodes) {
    if (/consolidacion V1\.4/i.test(n.description ?? "") && !traced.nodes.has(n.id)) errors.push(`${n.id} cambia en la consolidacion pero ninguna decision lo cita`);
  }

  // 5. no dangling ID in the text of the V1.4 source of truth
  const known = new Set([...ruleIds, ...nodeIds, ...featureIds, ...scenarioIds]);
  for (const [name, path] of Object.entries(V14)) {
    const text = readFileSync(path, "utf8");
    for (const id of new Set(text.match(ID_IN_TEXT) ?? [])) if (!known.has(id)) errors.push(`${name}: el texto menciona ${id}, que no existe en V1.4`);
  }
  for (const path of DOCS_CITING_OPEN_ITEMS.filter((p) => existsSync(p))) {
    for (const id of danglingOpenItemIds(readFileSync(path, "utf8"), openIds)) errors.push(`${path}: menciona ${id}, que no es un pendiente del registro`);
  }
  return errors;
}

const IMPL_LABEL: Record<string, string> = {
  IMPLEMENTADO: "Implementado",
  PARCIAL: "Parcial",
  NO_IMPLEMENTADO: "No implementado",
  CONTRARIO: "Contrario (el codigo hace lo opuesto)",
  NO_APLICA: "No aplica",
};
const list = (ids: string[] | undefined): string => (ids && ids.length > 0 ? ids.join(", ") : "-");
const cell = (text: string | undefined): string => (text ?? "").replace(/\s+/g, " ").replace(/\|/g, "/").trim();

/** Markdown traceability matrix generated from the log (never edited by hand). */
export function renderMatrix(log: DecisionLog): string {
  const byImpl = (s: string): number => log.decisions.filter((d) => d.implementation.status === s).length;
  const lines: string[] = [
    "# Matriz de trazabilidad - consolidacion V1.4 (baseline candidata)",
    "",
    `> Generada desde \`${LOG_FILE}\` con \`npm run generate:decision-matrix:v1.4\`. No editar a mano:`,
    "> `npm run validate:decisions:v1.4` falla si este archivo no coincide con el registro.",
    "",
    `Estado: **${log.consolidation.status}** (${log.consolidation.id}, decisiones del ${log.consolidation.decided_on}, punto de partida \`${log.consolidation.base_tag}\`).`,
    "",
    `Decisiones: ${log.decisions.length}. Implementacion en el producto: ${IMPLEMENTATION_STATUS.map((s) => `${IMPL_LABEL[s]} ${byImpl(s)}`).join(", ")}.`,
    `Incorporaciones de UAT (DC16): ${log.uat_items.length}. Pendientes registrados: ${log.open_items.length}. Mejoras posteriores: ${(log.improvements ?? []).length}.`,
    "",
    "En las incorporaciones de UAT, CONFIRMADO significa decision de negocio confirmada por el responsable funcional; no es aceptacion UAT formal.",
    `Aceptacion UAT formal: **${log.consolidation.formal_uat_acceptance?.status ?? "sin declarar"}** (${cell(log.consolidation.formal_uat_acceptance?.evidence)}).`,
    "La evidencia de aprobacion son pedidos y decisiones del responsable funcional, no versionados; \"Confirmada en\" cita decisiones de este registro y \"Implementado en\" los commits de rt-rma-mvp, que prueban la implementacion, no la aprobacion.",
    "",
    "## Decision -> regla -> Feature -> nodo -> Scenario -> implementacion",
    "",
    "| Decision | Bloque | Titulo | Reglas | Features | Nodos | Scenarios | Implementacion | Pendientes |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const d of log.decisions) {
    const impl = `${IMPL_LABEL[d.implementation.status]}${d.implementation.evidence ? `: ${cell(d.implementation.evidence)}` : ""}${d.implementation.gap ? `. Falta: ${cell(d.implementation.gap)}` : ""}`;
    const nodes = [...(d.nodes ?? []), ...(d.documented_in ?? [])];
    lines.push(`| ${d.id} | ${d.block} | ${cell(d.title)} | ${list(d.rules)} | ${list(d.features)} | ${list(nodes)} | ${list(d.scenarios)} | ${impl} | ${list(d.open)} |`);
  }
  lines.push("", "## Incorporaciones de UAT (DC16)", "", "| ID | Comportamiento | Estado | Evidencia de aprobacion | Confirmada en | Implementado en | Reglas | Nodos | Solo implementacion tecnica | Pendientes |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const u of log.uat_items) {
    const commits = (u.implemented_in ?? []).map((c) => c.replace("rt-rma-mvp@", ""));
    lines.push(`| ${u.id} | ${cell(u.title)} | ${u.status} | ${u.approval_evidence.map(cell).join("; ")} | ${list(u.confirmed_by)} | ${list(commits)} | ${list(u.rules)} | ${list(u.nodes)} | ${cell([...(u.technical_only ?? []), ...(u.notes ? [u.notes] : [])].join("; ")) || "-"} | ${list(u.pending)} |`);
  }
  const artifacts = (x: Traced): string[] => [...(x.rules ?? []), ...(x.nodes ?? []), ...(x.features ?? []), ...(x.scenarios ?? [])];
  lines.push("", "## Decisiones abiertas", "", "| ID | Pendiente | Impacto | Decisiones | Artefactos | Que falta |", "|---|---|---|---|---|---|");
  for (const o of log.open_items) lines.push(`| ${o.id} | ${cell(o.title)} | ${o.impact} | ${list(o.decisions)} | ${list(artifacts(o))} | ${cell(o.needed)} |`);
  lines.push("", "## Mejoras posteriores", "", "| ID | Auditoria | Mejora | Artefactos | Pendientes | Que falta |", "|---|---|---|---|---|---|");
  for (const m of log.improvements ?? []) {
    lines.push(`| ${m.id} | ${m.audit_ref} | ${cell(m.title)} | ${list([...artifacts(m), ...(m.files ?? [])])} | ${list(m.open)} | ${cell(m.needed)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

export function main(): void {
  const log = loadYaml<DecisionLog>(LOG_FILE);
  const errors = validateDecisionLog(log);
  const matrix = renderMatrix(log);
  if (process.argv.includes("--write")) {
    writeFileSync(MATRIX_FILE, matrix);
    console.log(`Matriz generada: ${MATRIX_FILE}`);
  } else if (!existsSync(MATRIX_FILE) || readFileSync(MATRIX_FILE, "utf8").replace(/\r\n/g, "\n") !== matrix) {
    errors.push(`${MATRIX_FILE} no coincide con el registro: correr npm run generate:decision-matrix:v1.4`);
  }
  if (errors.length > 0) {
    console.error("ERRORES:");
    for (const error of errors) console.error(`  - ${error}`);
    console.error(`\nFAILED: ${errors.length} error(es) en el registro de decisiones.`);
    process.exit(1);
  }
  assert.ok(log.decisions.length > 0);
  console.log(`OK: ${LOG_FILE} es consistente (${log.decisions.length} decisiones, ${log.uat_items.length} incorporaciones de UAT, ${log.open_items.length} pendientes, ${(log.improvements ?? []).length} mejoras posteriores) y la matriz esta al dia.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
