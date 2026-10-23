/**
 * Dependency-free tests for the per-origin view (scripts/lib/origin-filter.ts)
 * and the generated CLIENTE_EXTERNO V1.4 artifacts.
 *
 * Run: npm run test:cliente-externo:v1.4   (after generate:*:cliente-externo:v1.4)
 *
 * It verifies BEHAVIOUR of the filter over the real V1.4 model (what is kept,
 * what is excluded and why) and, when the generated files exist, that the
 * Mermaid/HTML artifacts really contain only that subset. It never reads the
 * YAML as text: only the parsed model.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { buildOriginView, classifyCondition, originStem, scenarioOrigins, type Origin } from "./lib/origin-filter";
import { edgeKey, loadYaml, type ProcessModel } from "./lib/process-model";
import type { ScenarioModel } from "./lib/scenario-model";

const PROCESS_FILE = "business/processes/repair-management-v1.4.yaml";
const SCENARIOS_FILE = "business/scenarios/repair-management-scenarios-v1.4.yaml";
const MERMAID_FILE = "generated/mermaid/repair-management-cliente-externo-v1.4.mmd";
const HTML_FILE = "generated/viewer/repair-management-cliente-externo-v1.4.html";

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${(error as Error).message.split("\n").slice(0, 6).join("\n       ")}`);
  }
}

const model = loadYaml<ProcessModel>(PROCESS_FILE);
const scenarios = loadYaml<ScenarioModel>(SCENARIOS_FILE).scenarios;
const view = buildOriginView(model, scenarios, "CLIENTE_EXTERNO");
const fullKeys = new Set(model.edges.map((e) => edgeKey(e.from, e.condition, e.to)));
const keptKeys = new Set(view.model.edges.map((e) => edgeKey(e.from, e.condition, e.to)));
const keptIds = new Set(view.model.nodes.map((n) => n.id));
const hasEdge = (from: string, condition: string | undefined, to: string): boolean => keptKeys.has(edgeKey(from, condition, to));

console.log("\nVista por origen CLIENTE_EXTERNO V1.4\n");

check("clasificacion de condiciones: nombra otro origen / niega el origen / neutra / propia", () => {
  const t: Origin = "CLIENTE_EXTERNO";
  assert.equal(classifyCondition("CLIENTE_EXTERNO", t), "TARGET");
  assert.equal(classifyCondition("Alta durante la ejecucion, CLIENTE_EXTERNO", t), "TARGET");
  assert.equal(classifyCondition("RT_INTERNO", t), "OTHER");
  assert.equal(classifyCondition("RMA_GARANTIA_REPARACION", t), "OTHER");
  assert.equal(classifyCondition("RT_GARANTIA_VENTA", t), "OTHER");
  assert.equal(classifyCondition("Origen distinto de CLIENTE_EXTERNO", t), "OTHER");
  assert.equal(classifyCondition("Hay Detalles pendientes de factibilidad (origen distinto de CLIENTE_EXTERNO)", t), "OTHER");
  assert.equal(classifyCondition("Redefinicion posterior a una Ejecucion, origen distinto de CLIENTE_EXTERNO", t), "OTHER");
  assert.equal(classifyCondition("Si", t), "NEUTRAL");
  assert.equal(classifyCondition(undefined, t), "NEUTRAL");
  // la negacion de OTRO origen aplica al origen objetivo
  assert.equal(classifyCondition("Origen distinto de RT_INTERNO", t), "TARGET");
  assert.equal(classifyCondition("Origen distinto de CLIENTE_EXTERNO", "RT_INTERNO"), "TARGET");
});

check("origen de los Scenarios: cada HP por sus aristas propias; las variantes heredan; las genericas son ALL", () => {
  const o = scenarioOrigins(scenarios);
  assert.deepEqual(o.get("HP-REP-001"), ["CLIENTE_EXTERNO"]);
  assert.deepEqual(o.get("HP-REP-002"), ["RT_INTERNO"]);
  assert.deepEqual(o.get("HP-REP-003"), ["RMA_GARANTIA_REPARACION"]);
  assert.deepEqual(o.get("VAR-REP-002"), ["RT_INTERNO"]);
  assert.equal(o.get("VAR-REP-003"), "ALL");
  assert.deepEqual(o.get("VAR-REP-016"), ["CLIENTE_EXTERNO"]);
  assert.deepEqual([...(o.get("EXC-REP-004") as Origin[])].sort(), ["RMA_GARANTIA_REPARACION", "RT_INTERNO"]);
});

check("todo nodo y toda arista de la vista existen en V1.4 (subconjunto real, nada inventado)", () => {
  const fullIds = new Set(model.nodes.map((n) => n.id));
  for (const n of view.model.nodes) {
    assert.ok(fullIds.has(n.id), n.id);
    assert.deepEqual(n, model.nodes.find((x) => x.id === n.id), `${n.id} sin modificar`);
  }
  for (const k of keptKeys) assert.ok(fullKeys.has(k), k);
  assert.ok(view.model.nodes.length < model.nodes.length && view.model.edges.length < model.edges.length);
});

check("ninguna arista conservada nombra otro origen ni niega CLIENTE_EXTERNO", () => {
  for (const e of view.model.edges) assert.notEqual(classifyCondition(e.condition, "CLIENTE_EXTERNO"), "OTHER", edgeKey(e.from, e.condition, e.to));
});

check("ninguna arista conservada la recorren SOLO Scenarios de otro origen (evidencia de Scenarios)", () => {
  const origins = scenarioOrigins(scenarios);
  const users = new Map<string, string[]>();
  for (const s of scenarios) for (const st of s.steps ?? []) if (st.kind === "PROCESS_EDGE") {
    const k = edgeKey(st.from, st.condition, st.to);
    users.set(k, [...(users.get(k) ?? []), s.id]);
  }
  for (const k of keptKeys) {
    const u = users.get(k) ?? [];
    if (u.length === 0) continue;
    assert.ok(u.some((id) => {
      const o = origins.get(id) ?? "ALL";
      return o === "ALL" || o.includes("CLIENTE_EXTERNO");
    }), `${k} solo la recorren ${u.join(",")}`);
  }
});

check("exclusiones exactas: caminos de RT_INTERNO, RMA y RT_GARANTIA_VENTA fuera; nodos compartidos dentro", () => {
  for (const id of ["EVT-REP-002", "PROC-REP-020", "PROC-REP-025", "PROC-REP-035", "PROC-REP-036", "EVT-REP-998", "PROC-REP-290"]) assert.ok(!keptIds.has(id), `${id} no debe estar`);
  for (const id of ["EVT-REP-001", "PROC-REP-010", "PROC-REP-040", "PROC-REP-050", "PROC-REP-070", "PROC-REP-075", "PROC-REP-127", "PROC-REP-128", "PROC-REP-184", "PROC-REP-270"]) assert.ok(keptIds.has(id), `${id} compartido debe estar`);
  assert.ok(!hasEdge("PROC-REP-010", "RT_INTERNO", "PROC-REP-020"));
  assert.ok(!hasEdge("PROC-REP-040", "RMA_GARANTIA_REPARACION", "PROC-REP-045"));
  assert.ok(!hasEdge("PROC-REP-250", "No", "PROC-REP-290"));
  assert.ok(!hasEdge("PROC-REP-050", "No - Detalles definidos", "PROC-REP-080"));
  assert.ok(!hasEdge("PROC-REP-050", "No - aun en revision", "PROC-REP-065"));
  assert.ok(hasEdge("PROC-REP-010", "CLIENTE_EXTERNO", "PROC-REP-030"));
  assert.ok(hasEdge("PROC-REP-040", "CLIENTE_EXTERNO", "PROC-REP-032"));
  assert.ok(hasEdge("PROC-REP-050", "Si", "PROC-REP-060"));
  // VAR-REP-038/039 son de la garantia RMA (consolidacion, DC15B)
  assert.deepEqual(view.report.excludedScenarios.map((x) => x.id).sort(), ["EXC-REP-004", "HP-REP-002", "HP-REP-003", "VAR-REP-002", "VAR-REP-023", "VAR-REP-035", "VAR-REP-038", "VAR-REP-039"]);
  assert.ok(view.report.keptScenarios.includes("HP-REP-001"));
  for (const id of ["VAR-REP-010", "VAR-REP-011", "VAR-REP-020", "VAR-REP-024", "VAR-REP-026", "VAR-REP-027"]) assert.ok(view.report.keptScenarios.includes(id), id);
});

check("el Happy Path de Cliente Externo (HP-REP-001) es continuo de EVT-REP-001 a EVT-REP-999 dentro de la vista", () => {
  const hp = scenarios.find((s) => s.id === "HP-REP-001");
  assert.ok(hp);
  const steps = (hp?.steps ?? []).filter((st) => st.kind === "PROCESS_EDGE");
  assert.ok(steps.length > 30);
  for (const st of steps) assert.ok(hasEdge(st.from, st.condition, st.to), `${st.from} -[${st.condition ?? ""}]-> ${st.to}`);
  assert.equal(steps[0].from, "EVT-REP-001");
  assert.equal(steps.at(-1)?.to, "EVT-REP-999");
  assert.equal(view.report.primaryStart, "EVT-REP-001");
});

check("autorizacion diferida: EVT-REP-003 -> 046 como carril propio; ni 128 ni 184 conducen a 046/047; 128 vuelve a 190", () => {
  assert.ok(view.report.startEvents.includes("EVT-REP-003"));
  assert.ok(hasEdge("EVT-REP-003", undefined, "PROC-REP-046"));
  assert.deepEqual(view.report.laneEdgeKeys, [edgeKey("EVT-REP-003", undefined, "PROC-REP-046")]);
  for (const from of ["PROC-REP-128", "PROC-REP-184", "PROC-REP-182", "PROC-REP-183", "PROC-REP-190"]) {
    assert.ok(!view.model.edges.some((e) => e.from === from && (e.to === "PROC-REP-046" || e.to === "PROC-REP-047")), `${from} no conduce a 046/047`);
  }
  assert.ok(hasEdge("PROC-REP-128", "Alta durante la ejecucion, CLIENTE_EXTERNO", "PROC-REP-190"));
  assert.ok(hasEdge("PROC-REP-046", "Solicitud sin resolver, Detalles siguen pendientes de autorizacion", "PROC-REP-211"), "la falta de respuesta es una solicitud sin resolver en 046");
  assert.ok(hasEdge("PROC-REP-129", undefined, "PROC-REP-046"));
  // desde el alta se alcanza ejecucion sin pasar por la consulta
  const reach = new Set<string>(["PROC-REP-184"]);
  const q = ["PROC-REP-184"];
  while (q.length) {
    const cur = q.shift() as string;
    for (const e of view.model.edges.filter((x) => x.from === cur && x.to !== "PROC-REP-046" && x.to !== "PROC-REP-047")) if (!reach.has(e.to)) { reach.add(e.to); q.push(e.to); }
  }
  assert.ok(reach.has("PROC-REP-185") && reach.has("PROC-REP-190"));
});

check("decision del cliente simplificada (iteracion 10): 047 muestra solo tres decisiones y una Orden sin Detalles pasa por 056, no por 046/047", () => {
  const outs047 = view.model.edges.filter((e) => e.from === "PROC-REP-047").map((e) => `${e.condition}->${e.to}`).sort();
  assert.deepEqual(outs047, ["Acepta trabajos->PROC-REP-211", "Rechaza algunos Detalles->PROC-REP-300", "Rechaza todos los trabajos->PROC-REP-305"].sort());
  assert.ok(keptIds.has("PROC-REP-056"));
  assert.ok(hasEdge("PROC-REP-055", "CLIENTE_EXTERNO", "PROC-REP-056"));
  assert.ok(hasEdge("PROC-REP-056", "Acepta la revision tecnica", "PROC-REP-050"));
  assert.ok(hasEdge("PROC-REP-056", "Desiste sin Detalles", "PROC-REP-306"));
  assert.ok(!view.model.edges.some((e) => e.from === "PROC-REP-055" && e.to === "PROC-REP-046"), "055 ya no consulta por Detalle");
  assert.ok(hasEdge("PROC-REP-046", "Decision del cliente registrada", "PROC-REP-047"));
  // las condiciones internas las enruta el resolver, que ya estaba en la vista
  assert.ok(hasEdge("PROC-REP-211", "Antes del comprobante de recepcion", "PROC-REP-050"));
  assert.ok(hasEdge("PROC-REP-211", "Comprobante emitido, factibilidad pendiente", "PROC-REP-080"));
  assert.ok(!view.report.excludedScenarios.some((x) => ["VAR-REP-001", "VAR-REP-004", "VAR-REP-027", "VAR-REP-036"].includes(x.id)), "los Scenarios de la decision del cliente son de Cliente Externo y se conservan");
});

check("custodia, cancelacion y devolucion presentes: 060, 211/306 -> 270/271/fin, 300, 305, 306", () => {
  for (const id of ["PROC-REP-060", "PROC-REP-270", "PROC-REP-271", "PROC-REP-300", "PROC-REP-305", "PROC-REP-306"]) assert.ok(keptIds.has(id), id);
  assert.ok(hasEdge("PROC-REP-211", "Todos cancelados, equipo bajo custodia", "PROC-REP-270"));
  assert.ok(hasEdge("PROC-REP-211", "Todos cancelados, custodia sin confirmar", "PROC-REP-271"));
  assert.ok(hasEdge("PROC-REP-211", "Todos cancelados, sin equipo bajo custodia", "PROC-REP-268"));
  assert.ok(hasEdge("PROC-REP-306", "Custodia sin confirmar", "PROC-REP-271"));
  assert.ok(hasEdge("PROC-REP-271", "Equipo bajo custodia", "PROC-REP-270"));
});

check("saldo a favor y devolucion de dinero (AUD-V14-001) presentes en la vista: 265 -> 267, 267 -> 265/268, 268 -> 267/fin, y todo fin pasa por 268", () => {
  for (const id of ["PROC-REP-267", "PROC-REP-268"]) assert.ok(keptIds.has(id), `${id} esta en la vista`);
  assert.ok(hasEdge("PROC-REP-265", "No, saldo pendiente de cobro", "PROC-REP-266"));
  assert.ok(hasEdge("PROC-REP-265", "No, saldo a favor del cliente", "PROC-REP-267"));
  assert.ok(hasEdge("PROC-REP-267", "Devolucion registrada, validar entrega", "PROC-REP-265"));
  assert.ok(hasEdge("PROC-REP-267", "Devolucion registrada, validar fin de Orden", "PROC-REP-268"));
  assert.ok(hasEdge("PROC-REP-268", "Saldo a favor del cliente pendiente de devolver", "PROC-REP-267"));
  assert.ok(hasEdge("PROC-REP-268", "Sin saldo a favor pendiente", "EVT-REP-999"));
  for (const from of ["PROC-REP-270", "PROC-REP-306", "PROC-REP-271"]) {
    assert.ok(view.model.edges.some((e) => e.from === from && e.to === "PROC-REP-268"), `${from} -> 268 en la vista`);
  }
  assert.deepEqual(view.model.edges.filter((e) => e.to === "EVT-REP-999").map((e) => e.from), ["PROC-REP-268"], "el unico acceso al fin es 268");
  // las aristas nuevas existen en el modelo completo (la vista no inventa nada) y las recorre un Scenario de Cliente Externo
  for (const [f, c, t] of [["PROC-REP-265", "No, saldo a favor del cliente", "PROC-REP-267"], ["PROC-REP-268", "Saldo a favor del cliente pendiente de devolver", "PROC-REP-267"]] as const) {
    assert.ok(fullKeys.has(edgeKey(f, c, t)));
    assert.ok(scenarios.some((s) => s.steps.some((st) => st.kind === "PROCESS_EDGE" && st.from === f && st.to === t && st.condition === c)), `${f} -> ${t} lo recorre un Scenario`);
  }
  assert.ok(!view.report.excludedScenarios.some((x) => /^VAR-REP-03[0-4]$/.test(x.id)), "VAR-REP-030..034 son de Cliente Externo y se conservan");
});

check("ciclos reales conservados: cola/estacion, continuar/liberar, espera de recursos, cobro y retrabajo", () => {
  const cycles: [string, string | undefined, string][] = [
    ["PROC-REP-172", "Sesion o estacion invalida", "PROC-REP-170"],
    ["PROC-REP-212", "Si", "PROC-REP-181"],
    ["PROC-REP-213", undefined, "PROC-REP-170"],
    ["PROC-REP-120", "Revalidar", "PROC-REP-080"],
    ["PROC-REP-266", "Revalidar", "PROC-REP-265"],
    ["PROC-REP-267", "Devolucion registrada, validar entrega", "PROC-REP-265"],
    ["PROC-REP-268", "Saldo a favor del cliente pendiente de devolver", "PROC-REP-267"],
    ["PROC-REP-235", undefined, "PROC-REP-211"],
    ["PROC-REP-186", undefined, "PROC-REP-211"],
    ["PROC-REP-184", "Otra reparacion adicional por registrar", "PROC-REP-128"],
    ["PROC-REP-128", "Alta durante la evaluacion tecnica", "PROC-REP-184"],
    ["PROC-REP-211", "Ejecucion activa vigente", "PROC-REP-190"],
  ];
  for (const [f, c, t] of cycles) assert.ok(hasEdge(f, c, t), `${f} -[${c ?? ""}]-> ${t}`);
});

check("integridad de la vista: sin nodos sin salida (salvo finales), sin nodos inalcanzables, sin condiciones duplicadas por nodo", () => {
  const out = new Map<string, string[]>();
  for (const e of view.model.edges) out.set(e.from, [...(out.get(e.from) ?? []), e.condition ?? ""]);
  for (const n of view.model.nodes) {
    if (n.type !== "end") assert.ok(out.has(n.id), `${n.id} sin salida`);
    const c = out.get(n.id) ?? [];
    assert.equal(new Set(c).size, c.length, `${n.id} condiciones duplicadas`);
  }
  const seen = new Set<string>(view.report.startEvents);
  const q = [...view.report.startEvents];
  while (q.length) {
    const cur = q.shift() as string;
    for (const e of view.model.edges.filter((x) => x.from === cur)) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
  }
  for (const n of view.model.nodes) assert.ok(seen.has(n.id), `${n.id} inalcanzable`);
  for (const e of view.model.edges) assert.ok(keptIds.has(e.from) && keptIds.has(e.to));
});

check("determinista y generico: dos corridas iguales; los otros origenes tambien producen una vista consistente", () => {
  const again = buildOriginView(model, scenarios, "CLIENTE_EXTERNO");
  assert.deepEqual(again.model, view.model);
  assert.deepEqual(again.report.keptScenarios, view.report.keptScenarios);
  for (const origin of ["RT_INTERNO", "RMA_GARANTIA_REPARACION"] as Origin[]) {
    const other = buildOriginView(model, scenarios, origin);
    assert.ok(other.model.nodes.length > 20, origin);
    for (const e of other.model.edges) assert.notEqual(classifyCondition(e.condition, origin), "OTHER", `${origin}: ${e.from}`);
    assert.ok(!other.model.edges.some((e) => e.condition === "CLIENTE_EXTERNO"), `${origin} no incluye aristas de CLIENTE_EXTERNO`);
  }
  assert.equal(originStem("repair-management-v1.4", "CLIENTE_EXTERNO"), "repair-management-cliente-externo-v1.4");
  assert.equal(originStem("repair-management", "CLIENTE_EXTERNO"), "repair-management-cliente-externo");
});

if (existsSync(MERMAID_FILE)) {
  check("Mermaid generado: contiene exactamente los nodos y aristas de la vista (y ninguno de otro origen)", () => {
    const text = readFileSync(MERMAID_FILE, "utf8");
    const nodeIds = new Set([...text.matchAll(/^\s{4}((?:PROC|EVT)-REP-\d+)(?:\{\{|\{|\[|\(\(\(|\(\[)/gm)].map((m) => m[1]));
    assert.deepEqual([...nodeIds].sort(), [...keptIds].sort());
    const edgeLines = text.split("\n").filter((l) => /-->|-\.->/.test(l)).length;
    assert.equal(edgeLines, view.model.edges.length);
    for (const bad of ["PROC-REP-290", "PROC-REP-035", "PROC-REP-025", "PROC-REP-020", "EVT-REP-002"]) assert.ok(!text.includes(bad), `${bad} no debe aparecer`);
    assert.match(text, /EVT-REP-003 -\.->\s*PROC-REP-046/);
    assert.match(text, /%% VIEW: origen CLIENTE_EXTERNO/);
  });
} else {
  console.log(`  SKIP Mermaid (${MERMAID_FILE} no existe: ejecute npm run generate:mermaid:cliente-externo:v1.4)`);
}

if (existsSync(HTML_FILE)) {
  check("HTML generado: titulo, nodos, aristas y Scenarios embebidos coinciden con la vista; funciona sin servidor", () => {
    const html = readFileSync(HTML_FILE, "utf8");
    assert.ok(html.includes("Rosario Tecno — Flujo de Reparaciones | Cliente Externo V1.4"));
    const grab = (name: string): unknown => {
      const m = html.match(new RegExp(`var ${name} = (.*);\\n`));
      assert.ok(m, name);
      return JSON.parse((m as RegExpMatchArray)[1]);
    };
    const nodesById = grab("NODES_BY_ID") as Record<string, { id: string }>;
    assert.deepEqual(Object.keys(nodesById).sort(), [...keptIds].sort());
    const edges = grab("EDGES") as { from: string; to: string; condition?: string }[];
    assert.equal(edges.length, view.model.edges.length);
    const scen = grab("SCENARIOS_BY_ID") as Record<string, unknown>;
    assert.deepEqual(Object.keys(scen).sort(), [...view.report.keptScenarios].sort());
    const source = grab("DIAGRAM_SOURCE") as string;
    for (const bad of ["PROC-REP-290", "PROC-REP-035", "EVT-REP-002"]) assert.ok(!source.includes(bad), bad);
    // sin dependencias externas: mermaid embebido y sin recursos remotos
    assert.ok(!/<script[^>]+src=/i.test(html), "sin <script src>");
    assert.ok(!/<link[^>]+href=["']https?:/i.test(html), "sin hojas de estilo remotas");
    assert.ok(html.includes("AUTO-GENERATED FILE"));
  });
} else {
  console.log(`  SKIP HTML (${HTML_FILE} no existe: ejecute npm run generate:viewer:cliente-externo:v1.4)`);
}

console.log("");
if (failures > 0) {
  console.error(`FAILED: ${failures} test(s) failed.`);
  process.exit(1);
}
console.log("OK: all origin-view tests passed.");
