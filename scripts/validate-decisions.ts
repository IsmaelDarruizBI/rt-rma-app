/**
 * Validates business/decisions/decision-log-v1.4.yaml against the V1.4
 * process, rules, Features and Scenarios, and the implementation status of
 * its decisions in the product (traceability/estado-implementacion-v1.4.yaml,
 * kept outside business/ so that updating it never changes the functional
 * copy exported to rt-rma-mvp), and keeps the generated traceability matrix
 * (docs/consolidation/matriz-trazabilidad-v1.4.md) in sync with both.
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
 *     that records it) and every `confirmed_by` is a decision of the log.
 *     The implementation status has exactly one entry per decision, with
 *     evidence for IMPLEMENTADO/PARCIAL/CONTRARIO, names the rt-rma-mvp
 *     commits of every CONFIRMADO UAT item and declares the formal UAT
 *     acceptance (CONFIRMADO is not that acceptance); none of it may appear
 *     inside the log, which is part of the exported functional copy.
 *     A VIGENTE consolidation names its approval (decision APROBADA, full
 *     commit hash, date, approver and tag) and has no open item that blocks
 *     the approval; a CERRADO open item names the decision that closed it,
 *     the date and the resolution, and nothing cites it as still open.
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
export const IMPLEMENTATION_FILE = "traceability/estado-implementacion-v1.4.yaml";
export const MATRIX_FILE = "docs/consolidation/matriz-trazabilidad-v1.4.md";
const V14 = {
  process: "business/processes/repair-management-v1.4.yaml",
  rules: "business/rules/business-rules-v1.4.yaml",
  features: "business/features/repair-management-features-v1.4.yaml",
  scenarios: "business/scenarios/repair-management-scenarios-v1.4.yaml",
};

const DECISION_STATUS = ["CONFIRMADA", "APROBADA"];
const CONSOLIDATION_STATUS = ["CANDIDATA", "VIGENTE"];
const OPEN_STATUS = ["ABIERTO", "CERRADO"];
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
  open?: string[];
}
interface UatItem extends Traced {
  status: string;
  approval_evidence: string[];
  confirmed_by?: string[];
  technical_only?: string[];
  notes?: string;
  pending?: string[];
}
interface OpenItem extends Traced {
  impact: string;
  status?: string;
  closed_by?: string;
  closed_on?: string;
  resolution?: string;
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
    approval?: { decision: string; approved_commit: string; approved_on: string; approved_by: string; tag: string; scope?: string };
  };
  decisions: Decision[];
  uat_items: UatItem[];
  open_items: OpenItem[];
  improvements?: Improvement[];
}
interface ImplementationEntry {
  id: string;
  status: string;
  evidence?: string;
  gap?: string;
}
/** Implementation status of the log's decisions in the product (outside business/). */
export interface ImplementationStatus {
  baseline: { tag: string; commit: string; decision_log: string };
  product: { repository: string; branch: string; evaluated_commit: string; updated_on: string };
  formal_uat_acceptance?: { status: string; evidence: string };
  decisions: ImplementationEntry[];
  uat_items: { id: string; implemented_in: string[] }[];
}

/** IDs created by the consolidation of 23/10/2026: each must be traced to a decision or UAT item. */
export const CONSOLIDATION_NEW = {
  rules: Array.from({ length: 11 }, (_, i) => `BR-REP-0${39 + i}`),
  nodes: ["PROC-REP-036", "PROC-REP-269", "EVT-REP-998"],
  scenarios: Array.from({ length: 7 }, (_, i) => `VAR-REP-0${37 + i}`),
};

const ID_IN_TEXT = /\b(?:BR-REP|PROC-REP|EVT-REP|FEAT-REP|HP-REP|VAR-REP|EXC-REP)-\d{3}\b/g;
const MVP_COMMIT = /^rt-rma-mvp@[0-9a-f]{7,40}$/;
const FULL_COMMIT = /^[0-9a-f]{40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const statusOf = (o: OpenItem): string => o.status ?? "ABIERTO";
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

export function loadImplementation(): ImplementationStatus {
  return loadYaml<ImplementationStatus>(IMPLEMENTATION_FILE);
}

/** Problems of the implementation status against the log (empty when consistent). */
export function validateImplementation(log: DecisionLog, implementation: ImplementationStatus): string[] {
  const errors: string[] = [];
  const decisionIds = new Set(log.decisions.map((d) => d.id));
  const uatIds = new Set(log.uat_items.map((u) => u.id));
  const where = IMPLEMENTATION_FILE;
  if (implementation.baseline?.decision_log !== LOG_FILE) errors.push(`${where}: baseline.decision_log debe ser ${LOG_FILE}`);
  if (!/^[0-9a-f]{7,40}$/.test(implementation.product?.evaluated_commit ?? "")) errors.push(`${where}: product.evaluated_commit debe ser un commit de rt-rma-mvp`);
  if (!DATE.test(implementation.product?.updated_on ?? "")) errors.push(`${where}: product.updated_on debe ser una fecha AAAA-MM-DD`);
  if (!implementation.formal_uat_acceptance?.status) errors.push(`${where}: falta formal_uat_acceptance (CONFIRMADO no es aceptacion UAT formal)`);
  const seen = new Set<string>();
  for (const entry of implementation.decisions ?? []) {
    if (seen.has(entry.id)) errors.push(`${where}: ${entry.id} repetida`);
    seen.add(entry.id);
    if (!decisionIds.has(entry.id)) errors.push(`${where}: ${entry.id} no es una decision del registro`);
    if (!IMPLEMENTATION_STATUS.includes(entry.status)) errors.push(`${where}: ${entry.id} con status desconocido "${entry.status}"`);
    if (["IMPLEMENTADO", "PARCIAL", "CONTRARIO"].includes(entry.status) && !entry.evidence) errors.push(`${where}: ${entry.id} ${entry.status} sin evidencia en el codigo`);
  }
  for (const id of decisionIds) if (!seen.has(id)) errors.push(`${where}: falta el estado de implementacion de ${id}`);
  const commits = new Map((implementation.uat_items ?? []).map((u) => [u.id, u.implemented_in ?? []]));
  for (const [id, refs] of commits) {
    if (!uatIds.has(id)) errors.push(`${where}: ${id} no es una incorporacion de UAT del registro`);
    for (const ref of refs) if (!MVP_COMMIT.test(ref)) errors.push(`${where}: ${id} implemented_in "${ref}" no es rt-rma-mvp@<commit>`);
  }
  for (const u of log.uat_items) {
    if (u.status === "CONFIRMADO" && (commits.get(u.id) ?? []).length === 0) errors.push(`${u.id}: CONFIRMADO sin commit de rt-rma-mvp que lo implemente`);
  }
  // the log travels in the functional copy: implementation data must stay out of it
  const outside = `vive en ${where}, fuera de la copia funcional`;
  if ("formal_uat_acceptance" in log.consolidation) errors.push(`consolidation: formal_uat_acceptance ${outside}`);
  for (const d of log.decisions) if ("implementation" in d) errors.push(`${d.id}: implementation ${outside}`);
  for (const u of log.uat_items) if ("implemented_in" in u) errors.push(`${u.id}: implemented_in ${outside}`);
  return errors;
}

export function validateDecisionLog(log: DecisionLog, models = loadModels(), implementation = loadImplementation()): string[] {
  const errors: string[] = [...validateImplementation(log, implementation)];
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
  }
  for (const u of log.uat_items) if (!UAT_STATUS.includes(u.status)) errors.push(`${u.id}: status desconocido "${u.status}"`);
  for (const o of log.open_items) {
    if (!IMPACT.includes(o.impact)) errors.push(`${o.id}: impact desconocido "${o.impact}"`);
    if (!OPEN_STATUS.includes(statusOf(o))) errors.push(`${o.id}: status desconocido "${o.status}"`);
  }
  if (!CONSOLIDATION_STATUS.includes(log.consolidation.status)) errors.push(`consolidation: status desconocido "${log.consolidation.status}"`);

  // 2. references
  const checkRefs = (owner: Traced): void => {
    for (const id of owner.rules ?? []) if (!ruleIds.has(id)) errors.push(`${owner.id}: regla inexistente ${id}`);
    for (const id of owner.nodes ?? []) if (!nodeIds.has(id)) errors.push(`${owner.id}: nodo inexistente ${id}`);
    for (const id of owner.features ?? []) if (!featureIds.has(id)) errors.push(`${owner.id}: Feature inexistente ${id}`);
    for (const id of owner.scenarios ?? []) if (!scenarioIds.has(id)) errors.push(`${owner.id}: Scenario inexistente ${id}`);
  };
  const closedIds = new Set(log.open_items.filter((o) => statusOf(o) === "CERRADO").map((o) => o.id));
  const checkOpenRefs = (owner: string, ids: string[] | undefined): void => {
    for (const id of ids ?? []) {
      if (!openIds.has(id)) errors.push(`${owner}: pendiente inexistente ${id}`);
      else if (closedIds.has(id)) errors.push(`${owner}: cita como abierto el pendiente cerrado ${id}`);
    }
  };
  for (const d of log.decisions) {
    checkRefs(d);
    checkOpenRefs(d.id, d.open);
    for (const path of d.documented_in ?? []) if (!existsSync(path)) errors.push(`${d.id}: documento inexistente ${path}`);
  }
  for (const u of log.uat_items) {
    checkRefs(u);
    checkOpenRefs(u.id, u.pending);
    for (const id of u.confirmed_by ?? []) if (!decisionIds.has(id)) errors.push(`${u.id}: confirmed_by cita una decision inexistente ${id}`);
    if (u.approval_evidence.length === 0) errors.push(`${u.id}: sin evidencia de aprobacion`);
    if (u.status === "CONFIRMADO" && (u.rules ?? []).length === 0) errors.push(`${u.id}: CONFIRMADO sin regla que lo formalice`);
    if (u.status !== "CONFIRMADO" && (u.rules ?? []).length > 0) errors.push(`${u.id}: ${u.status} no puede formalizarse como regla`);
  }
  for (const o of log.open_items) {
    checkRefs(o);
    if (o.decisions.length === 0) errors.push(`${o.id}: no cita ninguna decision`);
    for (const id of o.decisions) if (!decisionIds.has(id)) errors.push(`${o.id}: decision inexistente ${id}`);
    if (statusOf(o) === "CERRADO") {
      if (!o.closed_by || !decisionIds.has(o.closed_by)) errors.push(`${o.id}: CERRADO sin una decision existente en closed_by`);
      if (!DATE.test(o.closed_on ?? "")) errors.push(`${o.id}: CERRADO sin fecha de cierre (closed_on AAAA-MM-DD)`);
      if (!o.resolution) errors.push(`${o.id}: CERRADO sin resolucion`);
    } else if (o.closed_by || o.closed_on || o.resolution) {
      errors.push(`${o.id}: ABIERTO con datos de cierre`);
    }
  }
  // the approval of the baseline
  const approval = log.consolidation.approval;
  const approvedDecisions = log.decisions.filter((d) => d.status === "APROBADA").map((d) => d.id);
  if (log.consolidation.status === "VIGENTE") {
    if (!approval) errors.push("consolidation: VIGENTE sin approval");
    else {
      if (!approvedDecisions.includes(approval.decision)) errors.push(`consolidation.approval: la decision ${approval.decision} no esta APROBADA`);
      if (!FULL_COMMIT.test(approval.approved_commit ?? "")) errors.push("consolidation.approval: approved_commit debe ser el hash completo del commit aprobado");
      if (!DATE.test(approval.approved_on ?? "")) errors.push("consolidation.approval: approved_on debe ser una fecha AAAA-MM-DD");
      if (!approval.approved_by) errors.push("consolidation.approval: falta approved_by");
      if (!approval.tag) errors.push("consolidation.approval: falta la etiqueta de la baseline");
    }
    for (const o of log.open_items.filter((x) => x.impact === "BLOQUEA_APROBACION" && statusOf(x) === "ABIERTO")) {
      errors.push(`${o.id}: bloquea la aprobacion y sigue ABIERTO en una baseline VIGENTE`);
    }
  } else if (approvedDecisions.length > 0) {
    errors.push(`${approvedDecisions.join(", ")}: APROBADA en una consolidacion ${log.consolidation.status}`);
  }
  for (const m of improvements) {
    checkRefs(m);
    if (!m.audit_ref) errors.push(`${m.id}: sin referencia a la auditoria`);
    checkOpenRefs(m.id, m.open);
    for (const path of m.files ?? []) if (!existsSync(path)) errors.push(`${m.id}: archivo inexistente ${path}`);
  }

  // 3. content of a confirmed decision
  for (const d of log.decisions) {
    const artifacts = [...(d.rules ?? []), ...(d.nodes ?? []), ...(d.features ?? []), ...(d.scenarios ?? []), ...(d.documented_in ?? [])];
    if (artifacts.length === 0) errors.push(`${d.id}: decision sin artefactos ni documento`);
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

/** Markdown traceability matrix generated from the log and the implementation status (never edited by hand). */
export function renderMatrix(log: DecisionLog, implementation = loadImplementation()): string {
  const implOf = new Map(implementation.decisions.map((entry) => [entry.id, entry]));
  const commitsOf = new Map(implementation.uat_items.map((u) => [u.id, u.implemented_in]));
  const byImpl = (s: string): number => log.decisions.filter((d) => implOf.get(d.id)?.status === s).length;
  const approval = log.consolidation.approval;
  const open = log.open_items.filter((o) => statusOf(o) === "ABIERTO");
  const closed = log.open_items.filter((o) => statusOf(o) === "CERRADO");
  const lines: string[] = [
    `# Matriz de trazabilidad - consolidacion V1.4 (baseline ${log.consolidation.status === "VIGENTE" ? "vigente" : "candidata"})`,
    "",
    `> Generada desde \`${LOG_FILE}\` y \`${IMPLEMENTATION_FILE}\` con \`npm run generate:decision-matrix:v1.4\`. No editar a mano:`,
    "> `npm run validate:decisions:v1.4` falla si este archivo no coincide con el registro.",
    "",
    `Estado: **${log.consolidation.status}** (${log.consolidation.id}, decisiones del ${log.consolidation.decided_on}, punto de partida \`${log.consolidation.base_tag}\`).`,
    ...(approval
      ? [
          "",
          `Aprobacion: ${approval.decision}, el ${approval.approved_on}, por ${cell(approval.approved_by)}, sobre el commit \`${approval.approved_commit}\` (etiqueta \`${approval.tag}\`).`,
        ]
      : []),
    "",
    `Decisiones: ${log.decisions.length}. Implementacion en el producto (${implementation.product.repository} ${implementation.product.branch}, evaluada sobre \`${implementation.product.evaluated_commit}\`, actualizada el ${implementation.product.updated_on}): ${IMPLEMENTATION_STATUS.map((s) => `${IMPL_LABEL[s]} ${byImpl(s)}`).join(", ")}.`,
    `Incorporaciones de UAT (DC16): ${log.uat_items.length}. Pendientes registrados: ${log.open_items.length} (${open.length} abiertos, ${closed.length} cerrados). Mejoras posteriores: ${(log.improvements ?? []).length}.`,
    "",
    "En las incorporaciones de UAT, CONFIRMADO significa decision de negocio confirmada por el responsable funcional; no es aceptacion UAT formal.",
    `Aceptacion UAT formal: **${implementation.formal_uat_acceptance?.status ?? "sin declarar"}** (${cell(implementation.formal_uat_acceptance?.evidence)}).`,
    "La evidencia de aprobacion son pedidos y decisiones del responsable funcional, no versionados; \"Confirmada en\" cita decisiones de este registro y \"Implementado en\" los commits de rt-rma-mvp, que prueban la implementacion, no la aprobacion.",
    "",
    "## Decision -> regla -> Feature -> nodo -> Scenario -> implementacion",
    "",
    "| Decision | Bloque | Titulo | Reglas | Features | Nodos | Scenarios | Implementacion | Pendientes |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const d of log.decisions) {
    const entry = implOf.get(d.id);
    const impl = entry
      ? `${IMPL_LABEL[entry.status] ?? entry.status}${entry.evidence ? `: ${cell(entry.evidence)}` : ""}${entry.gap ? `. Falta: ${cell(entry.gap)}` : ""}`
      : "-";
    const nodes = [...(d.nodes ?? []), ...(d.documented_in ?? [])];
    lines.push(`| ${d.id} | ${d.block} | ${cell(d.title)} | ${list(d.rules)} | ${list(d.features)} | ${list(nodes)} | ${list(d.scenarios)} | ${impl} | ${list(d.open)} |`);
  }
  lines.push("", "## Incorporaciones de UAT (DC16)", "", "| ID | Comportamiento | Estado | Evidencia de aprobacion | Confirmada en | Implementado en | Reglas | Nodos | Solo implementacion tecnica | Pendientes |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const u of log.uat_items) {
    const commits = (commitsOf.get(u.id) ?? []).map((c) => c.replace("rt-rma-mvp@", ""));
    lines.push(`| ${u.id} | ${cell(u.title)} | ${u.status} | ${u.approval_evidence.map(cell).join("; ")} | ${list(u.confirmed_by)} | ${list(commits)} | ${list(u.rules)} | ${list(u.nodes)} | ${cell([...(u.technical_only ?? []), ...(u.notes ? [u.notes] : [])].join("; ")) || "-"} | ${list(u.pending)} |`);
  }
  const artifacts = (x: Traced): string[] => [...(x.rules ?? []), ...(x.nodes ?? []), ...(x.features ?? []), ...(x.scenarios ?? [])];
  lines.push("", "## Decisiones abiertas", "", "| ID | Pendiente | Impacto | Decisiones | Artefactos | Que falta |", "|---|---|---|---|---|---|");
  for (const o of open) lines.push(`| ${o.id} | ${cell(o.title)} | ${o.impact} | ${list(o.decisions)} | ${list(artifacts(o))} | ${cell(o.needed)} |`);
  if (closed.length > 0) {
    lines.push("", "## Pendientes cerrados", "", "| ID | Pendiente | Impacto | Cerrado por | Fecha | Resolucion |", "|---|---|---|---|---|---|");
    for (const o of closed) lines.push(`| ${o.id} | ${cell(o.title)} | ${o.impact} | ${o.closed_by} | ${o.closed_on} | ${cell(o.resolution)} |`);
  }
  lines.push("", "## Mejoras posteriores", "", "| ID | Auditoria | Mejora | Artefactos | Pendientes | Que falta |", "|---|---|---|---|---|---|");
  for (const m of log.improvements ?? []) {
    lines.push(`| ${m.id} | ${m.audit_ref} | ${cell(m.title)} | ${list([...artifacts(m), ...(m.files ?? [])])} | ${list(m.open)} | ${cell(m.needed)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

export function main(): void {
  const log = loadYaml<DecisionLog>(LOG_FILE);
  const implementation = loadImplementation();
  const errors = validateDecisionLog(log, loadModels(), implementation);
  const matrix = renderMatrix(log, implementation);
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
