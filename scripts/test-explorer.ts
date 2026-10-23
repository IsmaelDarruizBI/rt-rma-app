/**
 * Dependency-free tests for the interactive route explorer (scripts/lib/explorer-*.ts and
 * the generated generated/viewer/repair-management-interactive-v1.4.html).
 *
 * Run: npm run test:interactive:v1.4   (after generate:interactive:v1.4 for the HTML checks)
 *
 * They test the NAVIGATION LOGIC over the real V1.4 model (not text searches in the HTML):
 * the same pure engine, layout and export modules that the HTML embeds are run here.
 * The HTML itself is checked statically (self-contained, no network) and in headless Chrome
 * by scripts/test-explorer-browser.ts.
 */
import assert from "node:assert/strict";
import { CONTEXT_EXITS, LANE_RETURN_NODES, NODE_KINDS, NODE_SCOPES, NODE_WAITS, kindOfEdge } from "./lib/explorer-annotations";
import { nextLaneId, optionsAt, MAX_VISITS_PER_THREAD, type Action, type EngineConfig } from "./lib/explorer-engine";
import { buildOriginPolicy } from "./lib/explorer-origin";
import { createKit } from "./lib/explorer-testkit";
import { buildOriginView, classifyCondition, ORIGINS, type Origin } from "./lib/origin-filter";
import { edgeKey } from "./lib/process-model";
import type { Scenario } from "./lib/scenario-model";

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${(error as Error).message.split("\n").slice(0, 10).join("\n       ")}`);
  }
}

const kit = createKit();
const { model, scenarios, data, graph, CFG, run, main, nodesOf, optionByCondition, choose, ids, driveScenario, randomWalk, SCENARIO_ORIGIN_OVERRIDES } = kit;

console.log("\nExplorador interactivo de recorridos V1.4\n");

// =============================================================== navigation
console.log("A) Navegacion paso a paso\n");

check("1) el recorrido comienza por el evento inicial y avanza solo hasta la primera decision (origen)", () => {
  const r = run([]);
  assert.deepEqual(nodesOf(r), ["EVT-REP-001", "PROC-REP-010"]);
  assert.equal(main(r).visits[0].via, undefined, "el evento inicial no tiene arista de entrada");
  assert.equal(main(r).visits[1].via?.mode, "AUTO", "EVT-REP-001 -> 010 es una transicion automatica");
  assert.equal(r.origin, undefined);
});

check("2) se detiene en la primera bifurcacion con las cuatro alternativas reales del origen", () => {
  const t = main(run([]));
  assert.equal(t.status, "WAITING");
  assert.equal(t.pending?.kind, "DECISION");
  assert.equal(t.pending?.node, "PROC-REP-010");
  assert.deepEqual(t.pending?.options.map((o) => o.condition).sort(), ["CLIENTE_EXTERNO", "RMA_GARANTIA_REPARACION", "RT_GARANTIA_VENTA", "RT_INTERNO"]);
  assert.deepEqual(t.pending?.hidden, [], "antes de elegir el origen no se oculta nada");
  for (const o of t.pending?.options ?? []) assert.equal(o.status, "ALLOWED");
});

check("3) elegir una rama revela unicamente esa rama y avanza hasta la siguiente decision (045)", () => {
  const r = run(choose([], "CLIENTE_EXTERNO"));
  assert.equal(r.origin, "CLIENTE_EXTERNO");
  assert.deepEqual(nodesOf(r), ["EVT-REP-001", ...ids(["010", "030", "040", "032", "045"])]);
  const t = main(r);
  assert.equal(t.pending?.node, "PROC-REP-045");
  assert.deepEqual(t.pending?.options.map((o) => o.condition).sort(), ["No", "Si"]);
  assert.deepEqual(t.visits.map((v) => v.via?.mode), [undefined, "AUTO", "CHOICE", "AUTO", "AUTO", "AUTO"]);
});

check("4) las ramas no elegidas permanecen ocultas: ningun nodo de otro origen ni de otra alternativa se revela", () => {
  const cliente = nodesOf(run(choose([], "CLIENTE_EXTERNO")));
  for (const other of ["PROC-REP-020", "PROC-REP-025", "PROC-REP-035", "PROC-REP-290"]) assert.ok(!cliente.includes(other), `CLIENTE_EXTERNO no revela ${other}`);
  const interno = nodesOf(run(choose([], "RT_INTERNO")));
  assert.deepEqual(interno.slice(0, 4), ["EVT-REP-001", "PROC-REP-010", "PROC-REP-020", "PROC-REP-040"]);
  for (const other of ["PROC-REP-030", "PROC-REP-032", "PROC-REP-035", "PROC-REP-046"]) assert.ok(!interno.includes(other), `RT_INTERNO no revela ${other}`);
  // elegir "Si" en 045 no revela nada de la rama "No" (055, revision tecnica)
  const si = nodesOf(run(choose(choose([], "CLIENTE_EXTERNO"), "Si")));
  assert.ok(si.includes("PROC-REP-070"));
  for (const n of ["PROC-REP-055", "PROC-REP-065", "PROC-REP-068"]) assert.ok(!si.includes(n), `la rama No (${n}) sigue oculta`);
});

check("5) el avance automatico se detiene en cada decision posterior (045 Si -> 070 -> 046 -> 047 -> 211 -> 050 -> 060)", () => {
  let actions = choose(choose([], "CLIENTE_EXTERNO"), "Si");
  let t = main(run(actions));
  assert.deepEqual(t.visits.map((v) => v.node).slice(-2), ["PROC-REP-070", "PROC-REP-046"]);
  // 046 registra la decision del cliente: o queda registrada (-> 047) o la solicitud sigue sin resolver (evento externo, no una decision)
  assert.equal(t.pending?.node, "PROC-REP-046");
  assert.deepEqual(t.pending?.options.map((o) => o.condition).sort(), ["Decision del cliente registrada", "Solicitud sin resolver, Detalles siguen pendientes de autorizacion"]);
  actions = choose(actions, "Decision del cliente registrada");
  t = main(run(actions));
  assert.equal(t.pending?.node, "PROC-REP-047", "se detiene en la decision del cliente");
  // PROC-REP-047: exactamente las tres alternativas de negocio
  assert.deepEqual(t.pending?.options.map((o) => o.condition).sort(), ["Acepta trabajos", "Rechaza algunos Detalles", "Rechaza todos los trabajos"]);
  assert.deepEqual(t.pending?.hidden, [], "no hay otras salidas de 047 que ocultar");
  actions = choose(actions, "Acepta trabajos");
  t = main(run(actions));
  // despues de la decision comercial el sistema enruta: 211 es una decision del sistema, no otra decision del cliente
  assert.equal(t.pending?.node, "PROC-REP-211");
  assert.equal(data.nodes["PROC-REP-211"].kind?.kind, "DERIVADA");
  for (const o of t.pending?.options ?? []) assert.equal(data.edges[o.edge].kind?.kind, "DERIVADA", `${o.condition}: condicion derivada del estado, no una eleccion del cliente`);
  for (const c of ["Antes del comprobante de recepcion", "Comprobante emitido, factibilidad pendiente"]) assert.ok(t.pending?.options.some((o) => o.condition === c), c);
  actions = choose(actions, "Antes del comprobante de recepcion");
  t = main(run(actions));
  // 050 ("Requiere comprobante") tiene una sola salida respaldada para CLIENTE_EXTERNO: se atraviesa solo y se detiene en la siguiente decision (060)
  assert.deepEqual(t.visits.map((v) => v.node).slice(-3), ["PROC-REP-211", "PROC-REP-050", "PROC-REP-060"]);
  assert.equal(t.pending?.node, "PROC-REP-060");
  assert.deepEqual(t.pending?.options.map((o) => o.condition).sort(), ["Aun en revision", "Detalles definidos"]);
});

check("la OR sin Detalles espera el diagnostico de RT sin consultar por Detalle: 045 No -> 055 -> 056 -> 050 -> 060 -> 065 -> 068 -> 075 -> recien entonces 046", () => {
  let actions = choose(choose([], "CLIENTE_EXTERNO"), "No");
  let t = main(run(actions));
  assert.deepEqual(t.visits.map((v) => v.node).slice(-2), ["PROC-REP-055", "PROC-REP-056"], "055 -> 056 es automatico");
  assert.equal(t.pending?.node, "PROC-REP-056");
  assert.deepEqual(t.pending?.options.map((o) => o.condition).sort(), ["Acepta la revision tecnica", "Desiste sin Detalles"]);
  for (const n of ["PROC-REP-046", "PROC-REP-047", "PROC-REP-211", "PROC-REP-090", "PROC-REP-129"]) assert.ok(!nodesOf(run(actions)).includes(n), `sin Detalles no se llega a ${n}`);
  // el desistimiento propio de esta etapa se conserva y lleva a 306 (custodia, saldo y cierre), no a la autorizacion por Detalle
  const desiste = run(choose(actions, "Desiste sin Detalles"));
  assert.ok(nodesOf(desiste).includes("PROC-REP-306") && !nodesOf(desiste).includes("PROC-REP-047"));
  actions = choose(actions, "Acepta la revision tecnica");
  actions = choose(actions, "Aun en revision");
  t = main(run(actions));
  assert.deepEqual(t.visits.map((v) => v.node).slice(-4), ["PROC-REP-050", "PROC-REP-060", "PROC-REP-065", "PROC-REP-068"]);
  assert.equal(t.pending?.node, "PROC-REP-068");
  actions = choose(actions, "Si");
  t = main(run(actions));
  const nodes = nodesOf(run(actions));
  assert.ok(nodes.indexOf("PROC-REP-075") < nodes.indexOf("PROC-REP-046"), "la consulta por Detalle ocurre despues de que el tecnico define los Detalles");
  assert.equal(t.pending?.node, "PROC-REP-046");
  for (const n of ["PROC-REP-211", "PROC-REP-090"]) assert.ok(!nodes.includes(n), `el resolver (${n}) no se invoca con cero Detalles`);
});

check("la solicitud sin respuesta es un evento externo en 046 (no una decision en 047) y no bloquea a los demas Detalles", () => {
  assert.equal(data.edges[edgeKey("PROC-REP-046", "Solicitud sin resolver, Detalles siguen pendientes de autorizacion", "PROC-REP-211")].kind?.kind, "EXTERNA");
  assert.equal(data.edges[edgeKey("PROC-REP-046", "Decision del cliente registrada", "PROC-REP-047")].kind?.kind, "HUMANA");
  for (const c of ["Acepta trabajos", "Rechaza algunos Detalles", "Rechaza todos los trabajos"]) {
    const e = Object.values(data.edges).find((x) => x.from === "PROC-REP-047" && x.condition === c);
    assert.ok(e, c);
    assert.equal(e?.kind?.kind, "HUMANA", `${c} es una decision humana del cliente`);
  }
  const base = run(choose(choose(choose([], "CLIENTE_EXTERNO"), "Si"), "Solicitud sin resolver, Detalles siguen pendientes de autorizacion"));
  assert.ok(nodesOf(base).includes("PROC-REP-211") && !nodesOf(base).includes("PROC-REP-047"), "sin decision ficticia: 046 -> 211");
});

check("6) cambiar una decision elimina los segmentos incompatibles", () => {
  const long = ["CLIENTE_EXTERNO", "Si", "Decision del cliente registrada", "Acepta trabajos", "Antes del comprobante de recepcion", "Detalles definidos"].reduce<Action[]>((acc, c) => choose(acc, c), []);
  const before = nodesOf(run(long));
  assert.ok(before.includes("PROC-REP-046") && before.includes("PROC-REP-060") && before.includes("PROC-REP-080"));
  // volver a la primera decision (accion 0) y elegir otro origen: nada del recorrido anterior sobrevive
  const changed = choose([], "RT_INTERNO");
  const after = run(changed);
  for (const n of ["PROC-REP-030", "PROC-REP-032", "PROC-REP-046", "PROC-REP-047", "PROC-REP-060"]) assert.ok(!nodesOf(after).includes(n), `${n} no sobrevive al cambio de origen`);
  assert.equal(after.origin, "RT_INTERNO");
  // volver a la segunda decision conserva la primera y descarta lo posterior
  const rewound = choose(long.slice(0, 1), "No");
  assert.ok(nodesOf(run(rewound)).includes("PROC-REP-055"));
  assert.ok(!nodesOf(run(rewound)).includes("PROC-REP-070"));
});

check("7) reiniciar elimina el recorrido anterior", () => {
  const used = choose(choose([], "CLIENTE_EXTERNO"), "Si");
  assert.ok(nodesOf(run(used)).length > 6);
  const fresh = run([]);
  assert.deepEqual(nodesOf(fresh), ["EVT-REP-001", "PROC-REP-010"]);
  assert.equal(fresh.origin, undefined);
  assert.equal(fresh.decisions, 0);
});

check("determinismo: las mismas decisiones producen exactamente el mismo recorrido", () => {
  const actions = ["CLIENTE_EXTERNO", "Si", "Decision del cliente registrada", "Acepta trabajos"].reduce<Action[]>((acc, c) => choose(acc, c), []);
  assert.deepEqual(run(actions), run(JSON.parse(JSON.stringify(actions)) as Action[]));
});

check("una accion incompatible se rechaza y el resto se descarta (no deja estados imposibles)", () => {
  const r = run([{ type: "CHOOSE", thread: "main", edge: "PROC-REP-999::inexistente::PROC-REP-000" }, { type: "CONTINUE_CYCLE", thread: "main" }]);
  assert.equal(r.applied, 0);
  assert.equal(r.rejected?.index, 0);
  assert.deepEqual(nodesOf(r), ["EVT-REP-001", "PROC-REP-010"]);
});

// =============================================================== cycles
console.log("\nB) Ciclos y repeticiones\n");

check("8) ningun avance automatico entra en un bucle: se detiene antes de repetir un nodo", () => {
  const maxAuto = model.nodes.length + 2;
  for (const origin of ORIGINS) {
    for (let seed = 1; seed <= 60; seed++) {
      const { result } = randomWalk(seed * 7 + origin.length, seed % 3 === 0);
      for (const t of result.threads) {
        assert.ok(t.visits.length < MAX_VISITS_PER_THREAD, `semilla ${seed}: el hilo ${t.id} llego al limite de visitas`);
        // runs of consecutive AUTO moves are bounded by the number of distinct nodes
        let run = 0;
        for (const v of t.visits) {
          run = v.via?.mode === "AUTO" ? run + 1 : 0;
          assert.ok(run <= maxAuto, `semilla ${seed}: ${run} saltos automaticos seguidos`);
        }
        // an AUTO move never lands on a node already visited before in the thread
        const seen = new Set<string>();
        for (const v of t.visits) {
          if (v.via?.mode === "AUTO") assert.ok(!seen.has(v.node), `semilla ${seed}: salto automatico a ${v.node} ya visitado`);
          seen.add(v.node);
        }
      }
    }
  }
});

check("9) un nodo puede repetirse legitimamente: cobro 265 -> 266 (espera) -> 265 (visita 2) y devolucion 265 -> 267 -> 265", () => {
  // build a CE path to PROC-REP-265 by driving HP-REP-001 (it contains 265 -> 266 -> 265)
  const hp = driveScenario(scenarios.find((s) => s.id === "HP-REP-001") as Scenario);
  const visits = main(hp.result).visits.filter((v) => v.node === "PROC-REP-265");
  assert.deepEqual(visits.map((v) => v.visitNo), [1, 2], "265 se visita dos veces con sus numeros de visita");
  assert.equal(main(hp.result).visits.find((v) => v.node === "PROC-REP-266")?.via?.mode, "CHOICE");
  const step = main(hp.result).visits.filter((v) => v.node === "PROC-REP-265")[1];
  assert.equal(step.via?.mode, "EVENT", "volver de 266 a 265 es la accion explicita 'se produjo el evento esperado'");
  const vf = driveScenario(scenarios.find((s) => s.id === "VAR-REP-031") as Scenario);
  assert.deepEqual(main(vf.result).visits.filter((v) => v.node === "PROC-REP-265").map((v) => v.visitNo), [1, 2, 3]);
  assert.ok(vf.actions.filter((a) => a.type === "CONTINUE_CYCLE").length >= 2, "cada repeticion automatica de 267 -> 265 pide confirmacion");
});

check("un ciclo pendiente ofrece continuar (nueva visita) sin repetir por si solo", () => {
  const hp = driveScenario(scenarios.find((s) => s.id === "VAR-REP-031") as Scenario);
  // find the first action that is a CONTINUE_CYCLE and check the state right before it
  const idx = hp.actions.findIndex((a) => a.type === "CONTINUE_CYCLE");
  assert.ok(idx > 0);
  const cfg: EngineConfig = { start: "PROC-REP-300", includeUncertain: false, forceOrigin: "CLIENTE_EXTERNO" };
  const before = run(hp.actions.slice(0, idx), cfg);
  assert.equal(main(before).pending?.kind, "CYCLE");
  assert.equal(main(before).pending?.cycleTargetVisits, 1, "el destino ya tenia una visita");
  const visitsBefore = main(before).visits.length;
  assert.equal(main(run(hp.actions.slice(0, idx), cfg)).visits.length, visitsBefore, "no avanza solo");
  assert.equal(main(run(hp.actions.slice(0, idx + 1), cfg)).visits.length, visitsBefore + 1);
});

// =============================================================== conditions & origins
console.log("\nC) Condiciones reales y origenes\n");

check("10) cada alternativa ofrecida es una arista real del proceso, con su condicion textual intacta", () => {
  const realEdges = new Map(model.edges.map((e) => [edgeKey(e.from, e.condition, e.to), e]));
  for (let seed = 1; seed <= 80; seed++) {
    const { result } = randomWalk(seed, seed % 2 === 0);
    for (const t of result.threads) {
      for (const v of t.visits) if (v.via) assert.ok(realEdges.has(v.via.edge), `visita sin arista real: ${v.via.edge}`);
      for (const o of t.pending?.options ?? []) {
        const e = realEdges.get(o.edge);
        assert.ok(e, `alternativa inventada: ${o.edge}`);
        assert.equal(o.condition, e?.condition);
        assert.equal(o.to, e?.to);
        assert.equal(e?.from, t.pending?.node);
      }
    }
  }
  // every offered label also exists verbatim in the payload shown to the user
  for (const e of Object.values(data.edges)) assert.ok(realEdges.has(e.id));
  assert.equal(Object.keys(data.edges).length, model.edges.length);
});

check("11) los caminos exclusivos de otros origenes quedan excluidos", () => {
  for (const origin of ORIGINS) {
    for (let seed = 1; seed <= 50; seed++) {
      const { result } = randomWalk(seed * 13, false, 200, origin);
      for (const t of result.threads) {
        for (const v of t.visits) {
          if (!v.via) continue;
          const edge = graph.edgeById[v.via.edge];
          // post-origin: never an edge whose condition names another origin or negates this one
          assert.notEqual(classifyCondition(edge.condition, origin), "OTHER", `${origin}: recorrio ${v.via.edge}`);
        }
      }
    }
  }
  for (const includeUncertain of [false, true]) {
    const ce = new Set<string>();
    for (let seed = 1; seed <= 120; seed++) for (const n of nodesOf(randomWalk(seed, includeUncertain, 220, "CLIENTE_EXTERNO").result)) ce.add(n);
    for (const n of ["PROC-REP-020", "PROC-REP-025", "PROC-REP-035", "PROC-REP-290", "EVT-REP-002"]) assert.ok(!ce.has(n), `CLIENTE_EXTERNO no debe alcanzar ${n} (sin evidencia incluida: ${includeUncertain})`);
    const ri = new Set<string>();
    for (let seed = 1; seed <= 120; seed++) for (const n of nodesOf(randomWalk(seed, includeUncertain, 220, "RT_INTERNO").result)) ri.add(n);
    for (const n of ["PROC-REP-030", "PROC-REP-032", "PROC-REP-035", "PROC-REP-025"]) assert.ok(!ri.has(n), `RT_INTERNO no debe alcanzar ${n}`);
    // without the uncertain branches RT_INTERNO also never reaches the customer-authorization / custody nodes
    if (!includeUncertain) for (const n of ["PROC-REP-046", "PROC-REP-047", "PROC-REP-306", "PROC-REP-271"]) assert.ok(!ri.has(n), `RT_INTERNO (solo con evidencia) no debe alcanzar ${n}`);
  }
});

check("las bifurcaciones por origen no codificadas (050 y 250) conservan la resolucion por evidencia de Scenarios", () => {
  const optionsAtNode = (origin: Origin, node: string, prev?: string) => optionsAt(graph, CFG, origin, node, prev).options.map((o) => o.condition);
  assert.deepEqual(optionsAtNode("CLIENTE_EXTERNO", "PROC-REP-250"), ["Si"]);
  assert.deepEqual(optionsAtNode("RT_INTERNO", "PROC-REP-250"), ["No"]);
  assert.deepEqual(optionsAtNode("RMA_GARANTIA_REPARACION", "PROC-REP-250"), ["Si"]);
  assert.deepEqual(optionsAtNode("CLIENTE_EXTERNO", "PROC-REP-050"), ["Si"]);
  assert.deepEqual(optionsAtNode("RT_INTERNO", "PROC-REP-050").sort(), ["No - Detalles definidos", "No - aun en revision"]);
  // the exits that are NOT offered are listed with their reason, never dropped
  const hidden = optionsAt(graph, CFG, "CLIENTE_EXTERNO", "PROC-REP-250", undefined).hidden;
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].reason, "ORIGIN_EVIDENCE");
  assert.match(hidden[0].detail, /solo la recorren HP-REP-002 \(otro origen\); en este nodo el origen CLIENTE_EXTERNO sigue por Si/);
  assert.deepEqual(data.graph.policy.originsWithoutScenarios, ["RT_GARANTIA_VENTA"]);
});

check("la incertidumbre se informa en lugar de excluir: 'incluir ramas sin evidencia' las ofrece marcadas como hipotesis", () => {
  const off = optionsAt(graph, { ...CFG, includeUncertain: false }, "RT_INTERNO", "PROC-REP-211", "PROC-REP-210");
  const on = optionsAt(graph, { ...CFG, includeUncertain: true }, "RT_INTERNO", "PROC-REP-211", "PROC-REP-210");
  assert.ok(off.hidden.some((h) => h.reason === "ORIGIN_UNCONFIRMED"), "sin la opcion, las salidas sin evidencia figuran como ocultas con motivo");
  assert.ok(on.options.length > off.options.length);
  assert.ok(on.options.some((o) => o.status === "UNCONFIRMED" && o.detail));
  // an alternative proven foreign is never offered, not even with the option on
  const resolverCE = optionsAt(graph, { ...CFG, includeUncertain: true }, "RT_INTERNO", "PROC-REP-070", "PROC-REP-045");
  assert.ok(!resolverCE.options.some((o) => o.condition === "CLIENTE_EXTERNO"), "070 -> 046 [CLIENTE_EXTERNO] sigue oculto para RT_INTERNO");
});

check("RT_GARANTIA_VENTA (fuera de MVP v2, sin Scenarios) ofrece las salidas sin evidencia marcadas, en lugar de quedar sin camino", () => {
  assert.ok(data.graph.policy.originsWithoutScenarios.includes("RT_GARANTIA_VENTA"));
  const r = run(choose([], "RT_GARANTIA_VENTA"));
  assert.equal(r.origin, "RT_GARANTIA_VENTA");
  assert.ok(nodesOf(r).includes("PROC-REP-025"));
  assert.ok(main(r).visits.length > 3, "el recorrido continua mas alla del origen");
  assert.notEqual(main(r).status, "DEAD_END");
  const strict = run(choose([], "RT_GARANTIA_VENTA", "main", { ...CFG, includeUncertain: false }), { ...CFG, includeUncertain: false });
  assert.equal(main(strict).status, "DEAD_END", "sin evidencia incluida no hay camino demostrado");
  assert.ok((main(strict).hiddenAtEnd?.length ?? 0) > 0, "y se informa que alternativas existen y por que no se ofrecen");
});

// 44 Scenarios de V1.4 mas los de la consolidacion del 23/10/2026 (VAR-REP-037 en adelante).
const V14_SCENARIO_COUNT = 47;
check(`14) el explorador no omite salidas validas: los ${V14_SCENARIO_COUNT} Scenarios se recorren completos, nodo por nodo`, () => {
  assert.equal(scenarios.length, V14_SCENARIO_COUNT);
  let steps = 0;
  for (const includeUncertain of [true, false]) {
    for (const s of scenarios) {
      // the mis-attributed scenario has no evidence for the origin its title states, so only the "hypothesis offered" mode can walk it
      if (!includeUncertain && SCENARIO_ORIGIN_OVERRIDES[s.id]) continue;
      const { expected } = driveScenario(s, includeUncertain);
      steps += expected.length - 1;
    }
  }
  assert.ok(steps > 300, `pasos recorridos: ${steps}`);
});

check("completitud: toda salida real de un nodo es una alternativa o figura entre las ocultas con motivo (nada se pierde en silencio)", () => {
  for (const origin of [undefined, ...ORIGINS]) {
    for (const node of model.nodes) {
      for (const includeUncertain of [false, true]) {
        const outs = graph.out[node.id] ?? [];
        // choose every entry context a context-labelled node can have, plus "unknown"
        const prevs: (string | undefined)[] = [undefined, ...model.edges.filter((e) => e.to === node.id).map((e) => e.from)];
        for (const prev of prevs) {
          const { options, hidden } = optionsAt(graph, { start: "EVT-REP-001", includeUncertain }, origin, node.id, prev);
          assert.deepEqual([...options.map((o) => o.edge), ...hidden.map((h) => h.edge)].sort(), outs.map((e) => e.id).sort(), `${node.id} (${origin ?? "sin origen"}, desde ${prev ?? "-"})`);
          for (const h of hidden) assert.ok(h.reason && h.detail, `${h.edge}: oculta sin motivo`);
        }
      }
    }
  }
});

check("las salidas rotuladas por contexto (127, 128, 267, 300) ofrecen solo la que corresponde a la entrada y ninguna se pierde", () => {
  for (const note of CONTEXT_EXITS) {
    const outs = graph.out[note.node].map((e) => e.condition ?? "");
    // every real exit is allowed by at least one entry context (so none becomes unreachable)
    for (const c of outs) assert.ok(note.entries.some((en) => en.allow.includes(c)), `${note.node}: la salida "${c}" no pertenece a ningun contexto`);
    for (const en of note.entries) {
      for (const from of en.from) {
        assert.ok(model.edges.some((e) => e.from === from && e.to === note.node), `${note.node}: ${from} no es un predecesor real`);
        for (const a of en.allow) assert.ok(outs.includes(a), `${note.node}: "${a}" no es una salida real`);
        for (const origin of [undefined, ...ORIGINS]) {
          const { options, hidden } = optionsAt(graph, { start: "x", includeUncertain: true }, origin, note.node, from);
          const offered = new Set(options.map((o) => o.condition));
          for (const o of offered) assert.ok(en.allow.includes(o ?? ""), `${note.node} desde ${from}: ofrece "${o}"`);
          for (const h of hidden.filter((x) => !en.allow.includes(x.condition ?? ""))) assert.equal(h.reason, "CONTEXT");
        }
      }
    }
  }
  // 267 entered from 265 only offers "validar entrega" and from 268 only "validar fin de Orden"
  assert.deepEqual(optionsAt(graph, CFG, "CLIENTE_EXTERNO", "PROC-REP-267", "PROC-REP-265").options.map((o) => o.condition), ["Devolucion registrada, validar entrega"]);
  assert.deepEqual(optionsAt(graph, CFG, "CLIENTE_EXTERNO", "PROC-REP-267", "PROC-REP-268").options.map((o) => o.condition), ["Devolucion registrada, validar fin de Orden"]);
});

// =============================================================== independent events
console.log("\nD) Eventos independientes y nodos nuevos\n");

/** Walks the CE main thread to the point where the technical thread is executing (a state with several pending decisions). */
const cePrefix = (): Action[] => {
  const hp = driveScenario(scenarios.find((s) => s.id === "HP-REP-001") as Scenario);
  // stop at the first decision after the order was enabled and reached the technical queue
  const upto = hp.actions.findIndex((_, i) => nodesOf(run(hp.actions.slice(0, i + 1))).includes("PROC-REP-150"));
  return hp.actions.slice(0, upto + 1);
};

check("12) EVT-REP-003 no bloquea artificialmente el trabajo tecnico: el carril es independiente y el hilo principal no cambia", () => {
  const base = cePrefix();
  const before = run(base);
  assert.equal(before.lanes[0].start, "EVT-REP-003");
  assert.equal(before.lanes[0].available, true, before.lanes[0].reason);
  const lane: Action = { type: "ACTIVATE_LANE", start: "EVT-REP-003", lane: nextLaneId(base) };
  const after = run([...base, lane]);
  assert.deepEqual(main(after).visits, main(before).visits, "activar el carril no cambia el hilo principal");
  assert.deepEqual(main(after).pending, main(before).pending, "la decision pendiente del hilo tecnico sigue igual");
  assert.equal(after.threads.length, 2);
  assert.deepEqual(nodesOf(after, "lane1").slice(0, 2), ["EVT-REP-003", "PROC-REP-046"]);
  assert.equal(after.threads[1].pending?.node, "PROC-REP-046");
  // the technical thread can keep deciding WITHOUT touching the lane, and vice versa
  const opts = main(after).pending?.options ?? [];
  assert.ok(opts.length >= 1);
  if (main(after).pending?.kind === "DECISION") {
    const progressed = run([...base, lane, { type: "CHOOSE", thread: "main", edge: opts[0].edge }]);
    assert.equal(progressed.rejected, undefined);
    assert.deepEqual(progressed.threads[1].visits, after.threads[1].visits, "el carril no avanza porque avance el hilo tecnico");
  }
  const registered = run([...base, lane, { type: "CHOOSE", thread: "lane1", edge: optionByCondition(after, "Decision del cliente registrada", "lane1").edge }]);
  assert.deepEqual(registered.threads[1].pending?.options.map((o) => o.condition).sort(), ["Acepta trabajos", "Rechaza algunos Detalles", "Rechaza todos los trabajos"], "en el carril, 047 tambien ofrece solo las tres decisiones");
  const laneFirst = run([...base, lane, { type: "CHOOSE", thread: "lane1", edge: optionByCondition(after, "Decision del cliente registrada", "lane1").edge }, { type: "CHOOSE", thread: "lane1", edge: optionByCondition(registered, "Rechaza todos los trabajos", "lane1").edge }]);
  assert.equal(laneFirst.rejected, undefined);
  assert.deepEqual(main(laneFirst).visits, main(before).visits, "resolver el carril no mueve el hilo tecnico");
  // the model really has no edge from the lane into the technical thread, nor from the technical thread into the lane
  assert.deepEqual(graph.out["EVT-REP-003"].map((e) => e.to), ["PROC-REP-046"]);
  assert.ok(!model.edges.some((e) => e.to === "EVT-REP-003"));
  for (const from of ["PROC-REP-128", "PROC-REP-184", "PROC-REP-182", "PROC-REP-183", "PROC-REP-190"]) {
    assert.ok(!graph.out[from].some((e) => e.to === "PROC-REP-046" || e.to === "PROC-REP-047"), `${from} no conduce a 046/047`);
  }
});

check("el carril vuelve al recorrido principal al llegar al resolver (211) y puede cerrarse en cualquier momento", () => {
  const base = cePrefix();
  const lane: Action = { type: "ACTIVATE_LANE", start: "EVT-REP-003", lane: "lane1" };
  const pick = (actions: Action[], condition: string): Action[] => {
    const r = run(actions);
    return [...actions, { type: "CHOOSE", thread: "lane1", edge: optionByCondition(r, condition, "lane1").edge }];
  };
  const returned = run(pick([...base, lane], "Solicitud sin resolver, Detalles siguen pendientes de autorizacion"));
  assert.equal(returned.threads[1].status, "RETURNED");
  assert.equal(returned.threads[1].returnedAt, "PROC-REP-211");
  assert.equal(returned.threads[1].pending, undefined);
  const closed = run([...base, lane, { type: "CLOSE_LANE", thread: "lane1" }]);
  assert.equal(closed.threads[1].status, "CLOSED");
  assert.equal(closed.rejected, undefined);
  assert.equal(run([...base, { type: "CLOSE_LANE", thread: "main" }]).rejected?.index, base.length, "el hilo principal no se cierra");
});

check("el evento independiente solo esta disponible para el origen donde existe (CLIENTE_EXTERNO) y despues de elegir origen", () => {
  assert.equal(run([]).lanes[0].available, false, "antes de elegir el origen no se ofrece");
  assert.match(run([]).lanes[0].reason ?? "", /origen/);
  const interno = run(choose([], "RT_INTERNO"));
  assert.equal(interno.lanes[0].available, false);
  assert.match(interno.lanes[0].reason ?? "", /Sin evidencia/);
  assert.equal(run(choose([], "CLIENTE_EXTERNO")).lanes[0].available, true);
  assert.equal(run([{ type: "ACTIVATE_LANE", start: "EVT-REP-003", lane: "lane1" }]).rejected?.index, 0, "no se puede activar antes de elegir el origen");
});

check("13) los nodos nuevos 267 y 268 aparecen cuando corresponde y todo fin pasa por 268", () => {
  const blocker = driveScenario(scenarios.find((s) => s.id === "VAR-REP-030") as Scenario);
  const nodes = nodesOf(blocker.result);
  assert.deepEqual(nodes.slice(nodes.indexOf("PROC-REP-265")), ["PROC-REP-265", "PROC-REP-267", "PROC-REP-265", "PROC-REP-280", "PROC-REP-270", "PROC-REP-268", "EVT-REP-999"]);
  assert.equal(main(blocker.result).status, "ENDED");
  const cancel = driveScenario(scenarios.find((s) => s.id === "VAR-REP-032") as Scenario);
  assert.deepEqual(nodesOf(cancel.result).slice(-5), ["PROC-REP-270", "PROC-REP-268", "PROC-REP-267", "PROC-REP-268", "EVT-REP-999"]);
  assert.ok(main(cancel.result).visits.filter((v) => v.node === "PROC-REP-268").length === 2, "268 se visita dos veces (antes y despues de devolver)");
  // property: every random walk that ends does it through 268, and 267 only appears after 265 or 268
  let ended = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const { result } = randomWalk(seed, seed % 4 === 0, 220);
    for (const t of result.threads) {
      const ns = t.visits.map((v) => v.node);
      if (t.status === "ENDED") {
        ended++;
        // un ingreso en garantia no admitido (EVT-REP-998, DC15B) no crea la Orden: no hay saldo que verificar en 268
        if (ns[ns.length - 1] === "EVT-REP-998") assert.equal(ns[ns.length - 2], "PROC-REP-036", `semilla ${seed}: 998 solo tras 036`);
        else assert.equal(ns[ns.length - 2], "PROC-REP-268", `semilla ${seed}: el fin no pasa por 268`);
      }
      ns.forEach((n, i) => {
        if (n === "PROC-REP-267") assert.ok(["PROC-REP-265", "PROC-REP-268"].includes(ns[i - 1]), `semilla ${seed}: 267 tras ${ns[i - 1]}`);
      });
    }
  }
  assert.ok(ended >= 20, `recorridos completos: ${ended}`);
});

check("esperas externas (129, 120, 125, 266) detienen el avance hasta que el usuario marca el evento", () => {
  for (const id of Object.keys(NODE_WAITS)) assert.ok(graph.waits[id], id);
  const hp = driveScenario(scenarios.find((s) => s.id === "HP-REP-001") as Scenario);
  const w = main(hp.result).visits.find((v) => v.node === "PROC-REP-266");
  assert.ok(w);
  const upto = hp.actions.findIndex((a, i) => a.type === "EVENT_OCCURRED" && nodesOf(run(hp.actions.slice(0, i))).at(-1) === "PROC-REP-266");
  assert.ok(upto > 0);
  const waiting = main(run(hp.actions.slice(0, upto)));
  assert.equal(waiting.pending?.kind, "EXTERNAL");
  assert.equal(waiting.status, "WAITING");
  assert.match(waiting.pending?.event ?? "", /Pagos adicionales/);
});

// =============================================================== annotations & data integrity
console.log("\nE) Anotaciones del viewer y datos\n");

check("las anotaciones del viewer solo referencian nodos, condiciones y predecesores reales del Source of Truth", () => {
  const nodeIds = new Set(model.nodes.map((n) => n.id));
  for (const id of [...Object.keys(NODE_KINDS), ...Object.keys(NODE_SCOPES), ...Object.keys(NODE_WAITS)]) assert.ok(nodeIds.has(id), id);
  for (const [id, note] of Object.entries(NODE_KINDS)) {
    for (const c of Object.keys(note.edgeKinds ?? {})) assert.ok(graph.out[id]?.some((e) => e.condition === c), `${id}: condicion "${c}" inexistente`);
    assert.ok(note.basis.length > 10, `${id}: toda anotacion cita su fundamento`);
  }
  for (const l of LANE_RETURN_NODES) assert.ok(nodeIds.has(l.node));
  // every node with >= 2 exits is classified (or explicitly a hypothesis): list the unclassified ones so none is forgotten
  const unclassified = model.nodes.filter((n) => (graph.out[n.id]?.length ?? 0) >= 2 && !NODE_KINDS[n.id]).map((n) => n.id);
  assert.deepEqual(unclassified, [], "todo nodo con bifurcacion tiene clasificacion del viewer");
  assert.equal(kindOfEdge("PROC-REP-170", "Cancelar Orden")?.kind, "HUMANA");
  assert.equal(kindOfEdge("PROC-REP-170", undefined)?.kind, "SISTEMA");
  assert.equal(kindOfEdge("PROC-REP-001", "x"), undefined);
});

check("el payload contiene toda la informacion real del nodo (actor, reglas, features, escenarios) sin reescribir la descripcion", () => {
  for (const n of model.nodes) {
    const info = data.nodes[n.id];
    assert.equal(info.name, n.name);
    assert.equal(info.type, n.type);
    assert.equal(info.description, n.description?.trim());
    assert.deepEqual(info.rules.map((r) => r.id), n.rules ?? []);
    assert.equal(info.actor?.id, n.actor);
  }
  assert.ok(data.nodes["PROC-REP-267"].features.some((f) => f.id === "FEAT-REP-007"));
  assert.ok(data.nodes["PROC-REP-268"].features.some((f) => f.id === "FEAT-REP-008"));
  assert.ok(data.nodes["PROC-REP-265"].scenarios.includes("VAR-REP-030"));
  assert.ok(data.edges[edgeKey("PROC-REP-265", "No, saldo a favor del cliente", "PROC-REP-267")].scenarios.includes("VAR-REP-031"));
  // variant triggers are exactly the trigger edges declared by the Scenarios
  const trig = data.edges[edgeKey("PROC-REP-268", "Saldo a favor del cliente pendiente de devolver", "PROC-REP-267")];
  assert.ok(trig.variantTriggers.includes("VAR-REP-032"));
});

check("la politica de origen reutiliza origin-filter: ALLOWED + HIDDEN + UNCONFIRMED cubre toda arista y Cliente Externo coincide con su vista", () => {
  const policy = buildOriginPolicy(model, scenarios);
  for (const origin of ORIGINS) {
    const view = buildOriginView(model, scenarios, origin);
    const kept = new Set(view.model.edges.map((e) => edgeKey(e.from, e.condition, e.to)));
    for (const e of model.edges) {
      const key = edgeKey(e.from, e.condition, e.to);
      assert.equal(kept.has(key), policy.statuses[origin][key] === undefined, `${origin}: ${key}`);
    }
    assert.equal(Object.keys(policy.statuses[origin]).length, model.edges.length - view.model.edges.length);
  }
  assert.deepEqual(Object.keys(policy.originChoiceEdges).length, 8, "010 y 040 definen el origen (4 + 4 aristas)");
  assert.equal(policy.startOrigins["EVT-REP-002"], "RMA_GARANTIA_REPARACION");
});

check("el inicio alternativo EVT-REP-002 fija el origen RMA y sigue el camino real de la garantia", () => {
  // la garantia valida primero la vigencia de origen (PROC-REP-036, DC15B); con la garantia vigente sigue a 040
  const rmaCfg = { start: "EVT-REP-002", includeUncertain: true };
  const atValidity = run([], rmaCfg);
  assert.equal(main(atValidity).pending?.node, "PROC-REP-036");
  const r = run(choose([], "Vigente", "main", rmaCfg), rmaCfg);
  assert.equal(r.origin, "RMA_GARANTIA_REPARACION");
  assert.deepEqual(nodesOf(r).slice(0, 5), ["EVT-REP-002", "PROC-REP-035", "PROC-REP-036", "PROC-REP-040", "PROC-REP-045"]);
  assert.equal(main(r).pending?.node, "PROC-REP-045");
  // 045 en una garantia RMA: 'No' respaldado por Scenarios, 'Si' solo como hipotesis sin evidencia (el nodo dice que siempre es No)
  assert.deepEqual(main(r).pending?.options.map((o) => `${o.condition}/${o.status}`).sort(), ["No/ALLOWED", "Si/UNCONFIRMED"]);
  const strictCfg = { start: "EVT-REP-002", includeUncertain: false };
  const strict = run(choose([], "Vigente", "main", strictCfg), strictCfg);
  assert.ok(nodesOf(strict).length > 5, "sin ramas sin evidencia 045 se resuelve solo por 'No'");
});

if (failures > 0) {
  console.log(`\nFAILED: ${failures} test(s) failed.`);
  process.exit(1);
}
console.log("\nOK: all explorer logic tests passed.");
