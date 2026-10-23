/*
 * Client of the interactive route explorer. Plain browser JavaScript, no dependencies.
 *
 * The navigation logic is NOT here: it lives in scripts/lib/explorer-engine.ts (replay of the user's
 * actions over the real process graph), explorer-layout.ts and explorer-export.ts, which the generator
 * transpiles into window.ExplorerBundle. This file only draws the result and turns clicks into actions.
 */
(function () {
  "use strict";

  var B = window.ExplorerBundle;
  var EN = B.engine, LY = B.layout, EX = B.exporter;
  var DATA = JSON.parse(document.getElementById("explorer-data").textContent);
  var graph = EN.buildGraph(DATA.graph);
  var KINDS = DATA.kindLabels;
  var SCOPE_LABEL = { DETALLE: "Por Detalle", ORDEN: "Situación técnica agregada de la OR", CIERRE: "Condición de cierre de todos los Detalles" };
  var TYPE_LABEL = { activity: "actividad", decision: "decisión", event: "evento", start: "inicio", end: "fin" };
  var HIDDEN_REASON = {
    ORIGIN_EXPLICIT: "Condición propia de otro origen: el modelo lo prueba",
    ORIGIN_EVIDENCE: "Se resuelve por otro origen según la evidencia de Scenarios",
    ORIGIN_UNCONFIRMED: "Sin evidencia de Scenarios para este origen (se puede explorar activando «Incluir ramas sin evidencia»)",
    CONTEXT: "Salida rotulada para otro contexto de entrada del nodo"
  };

  var SELFTEST = /#selftest/.test(location.hash || ""); // read before the first persist() rewrites the hash
  var state = { start: DATA.graph.mainStarts[0], includeUncertain: true, actions: [], selected: null, full: false, previous: null };
  var view = { k: 1, x: 0, y: 0 };
  var result = null;
  var layout = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function node(id) { return DATA.nodes[id]; }
  function edge(id) { return DATA.edges[id]; }
  function nodeInfo(id) { var n = DATA.nodes[id]; return { id: id, type: n.type, name: n.name, actorName: n.actor ? n.actor.name : undefined }; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function originLabel(o) { var f = DATA.origins.filter(function (x) { return x.id === o; })[0]; return f ? f.label : o; }
  function kindTag(kind) { var k = KINDS[kind]; return '<span class="tag ' + kind + '" title="' + esc(k.hint) + '">' + esc(k.label) + "</span>"; }

  // ------------------------------------------------------------------ state -> result
  function config() { return { start: state.start, includeUncertain: state.includeUncertain }; }
  function compute() {
    result = EN.replay(graph, config(), state.actions);
    if (result.rejected) {
      state.actions = state.actions.slice(0, result.applied);
      result = EN.replay(graph, config(), state.actions);
    }
    layout = LY.layoutRoute(result, { nodeInfo: nodeInfo, conditionOf: function (id) { return edge(id) && edge(id).condition; } });
  }

  // ------------------------------------------------------------------ svg
  var MARKER_COLORS = { AUTO: "#9ca3af", CHOICE: "#4f46e5", CYCLE: "#d97706", EVENT: "#be185d" };
  function defsMarkup() {
    return "<defs>" + Object.keys(MARKER_COLORS).map(function (k) {
      return '<marker id="arrow-' + k + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + MARKER_COLORS[k] + '"/></marker>';
    }).join("") + "</defs>";
  }
  function shapeMarkup(b) {
    var w = b.w, h = b.h, c = 18;
    if (b.type === "decision") return '<polygon class="node-shape" points="' + [c + ",0", (w - c) + ",0", w + "," + h / 2, (w - c) + "," + h, c + "," + h, "0," + h / 2].join(" ") + '"/>';
    if (b.type === "event" || b.type === "start") return '<rect class="node-shape" width="' + w + '" height="' + h + '" rx="' + Math.min(22, h / 2) + '"/>';
    if (b.type === "end") return '<rect class="node-shape" width="' + w + '" height="' + h + '" rx="' + h / 2 + '"/><rect class="node-shape" x="4" y="4" width="' + (w - 8) + '" height="' + (h - 8) + '" rx="' + (h / 2 - 4) + '" fill="none"/>';
    return '<rect class="node-shape" width="' + w + '" height="' + h + '" rx="8"/>';
  }
  function boxMarkup(b) {
    var pad = b.type === "decision" ? 26 : b.type === "end" ? 22 : 14;
    var out = '<g class="node ' + b.type + (b.current ? " current" : "") + (state.selected === b.node ? " selected" : "") + '" data-key="' + b.key + '" data-node="' + b.node + '" transform="translate(' + b.x + "," + b.y + ')">';
    out += shapeMarkup(b);
    out += '<text class="node-id" x="' + pad + '" y="16">' + esc(b.idText) + " · " + (b.visitBadge ? '<tspan class="visit-badge">' + esc(b.visitBadge) + "</tspan>" : esc(TYPE_LABEL[b.type] || b.type)) + "</text>";
    b.nameLines.forEach(function (line, i) { out += '<text class="node-name" x="' + pad + '" y="' + b.nameBaselines[i] + '">' + esc(line) + "</text>"; });
    if (b.actorText) out += '<text class="node-actor" x="' + pad + '" y="' + b.actorBaseline + '">' + esc("Actor: " + b.actorText) + "</text>";
    return out + "</g>";
  }
  function linkMarkup(l) {
    var out = '<g class="link" data-edge="' + esc(l.edgeId) + '"><path class="edge-line ' + l.kind + '" d="M' + l.x + "," + l.y1 + " L" + l.x + "," + l.y2 + '" marker-end="url(#arrow-' + l.kind + ')"/>';
    if (l.labelLines.length) {
      var wid = Math.max.apply(null, l.labelLines.map(function (s) { return s.length; })) * 5.7 + 14;
      var hei = l.labelLines.length * 14 + 6;
      out += '<rect class="edge-label-bg" rx="6" x="' + (l.x - wid / 2) + '" y="' + (l.labelY - 12) + '" width="' + wid + '" height="' + hei + '"/>';
      l.labelLines.forEach(function (s, i) { out += '<text class="edge-label" text-anchor="middle" x="' + l.x + '" y="' + (l.labelY + i * 14) + '">' + esc(s) + "</text>"; });
    }
    return out + "</g>";
  }
  function ghostMarkup(g) {
    var out = '<g class="ghost ' + g.kind + '" transform="translate(' + g.x + "," + g.y + ')"><rect class="ghost-shape" width="' + g.w + '" height="' + g.h + '" rx="10"/>';
    g.lines.forEach(function (s, i) { out += '<text class="ghost-text' + (i ? " sub" : "") + '" x="' + g.w / 2 + '" y="' + (18 + i * 15) + '" text-anchor="middle">' + esc(s) + "</text>"; });
    return out + "</g>";
  }
  function connectorMarkup(c) {
    var mx = c.x1 + (c.x2 - c.x1) / 2;
    var out = '<path class="connector" d="M' + c.x1 + "," + c.y1 + " H" + mx + " V" + c.y2 + " H" + c.x2 + '"/>';
    c.labelLines.forEach(function (s, i) { out += '<text class="connector-label" text-anchor="middle" x="' + mx + '" y="' + (Math.min(c.y1, c.y2) - 8 - (c.labelLines.length - 1 - i) * 12) + '">' + esc(s) + "</text>"; });
    return out;
  }
  function svgContent(l) {
    return defsMarkup() +
      l.headers.map(function (h) { return '<text class="lane-header" x="' + h.x + '" y="' + h.y + '">' + esc(h.text) + "</text>"; }).join("") +
      l.connectors.map(connectorMarkup).join("") + l.links.map(linkMarkup).join("") + l.boxes.map(boxMarkup).join("") + l.ghosts.map(ghostMarkup).join("");
  }
  function standaloneSvg() {
    var b = layout.bounds;
    var css = document.getElementById("explorer-css").textContent;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(b.w) + '" height="' + Math.ceil(b.h) + '" viewBox="' + b.x + " " + b.y + " " + b.w + " " + b.h + '"><style>' + css + '</style><rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" fill="#ffffff"/>' + svgContent(layout) + "</svg>";
  }

  // ------------------------------------------------------------------ pan / zoom
  function stageSize() { var r = $("stage").getBoundingClientRect(); return { w: r.width, h: r.height }; }
  function applyView() { $("viewport").setAttribute("transform", "translate(" + view.x + "," + view.y + ") scale(" + view.k + ")"); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function zoomAt(px, py, factor) {
    var k2 = clamp(view.k * factor, 0.2, 2.5);
    view.x = px - (px - view.x) * (k2 / view.k);
    view.y = py - (py - view.y) * (k2 / view.k);
    view.k = k2;
    applyView();
  }
  function fitAll() {
    var s = stageSize(), b = layout.bounds;
    var k = clamp(Math.min(s.w / b.w, s.h / b.h), 0.2, 1.1);
    view.k = k;
    view.x = (s.w - b.w * k) / 2 - b.x * k;
    view.y = (s.h - b.h * k) / 2 - b.y * k;
    applyView();
  }
  function ensureVisible(rect) {
    var s = stageSize();
    if (view.k < 0.55) view.k = 0.9;
    var m = 60;
    var left = rect.x * view.k + view.x, right = (rect.x + rect.w) * view.k + view.x;
    var top = rect.y * view.k + view.y, bottom = (rect.y + rect.h) * view.k + view.y;
    if (left < m) view.x += m - left; else if (right > s.w - m) view.x -= right - (s.w - m);
    if (top < m) view.y += m - top; else if (bottom > s.h - m) view.y -= bottom - (s.h - m);
    // keep a chain narrower than the stage horizontally centered
    if ((layout.bounds.w * view.k) < s.w) view.x = (s.w - layout.bounds.w * view.k) / 2 - layout.bounds.x * view.k;
    applyView();
  }
  function latestRect() {
    var best = null;
    layout.boxes.forEach(function (b) { if (b.current && (!best || result.threads.filter(function (t) { return t.id === b.thread; })[0].visits[b.idx].seq > best.seq)) best = { seq: result.threads.filter(function (t) { return t.id === b.thread; })[0].visits[b.idx].seq, x: b.x, y: b.y, w: b.w, h: b.h }; });
    layout.ghosts.forEach(function (g) { if (best && g.y + g.h > best.y + best.h && g.x === best.x) { best.h = g.y + g.h - best.y; } });
    return best;
  }

  // ------------------------------------------------------------------ side panels
  function scenariosFor(edgeInfo) {
    var o = result.origin;
    return edgeInfo.scenarios.filter(function (id) {
      var s = DATA.scenarios[id];
      return o === undefined || s.origins === "ALL" || s.origins.indexOf(o) >= 0;
    });
  }
  function optionHtml(thread, opt) {
    var e = edge(opt.edge);
    var to = node(opt.to);
    var kind = e.kind ? e.kind.kind : (node(e.from).kind ? node(e.from).kind.kind : "SIN_CLASIFICAR");
    var sc = scenariosFor(e);
    var vars = e.variantTriggers.filter(function (id) { return sc.indexOf(id) >= 0; });
    var chips = sc.slice(0, 5).map(function (id) { return '<span class="chip' + (vars.indexOf(id) >= 0 ? " var" : "") + '" title="' + esc(DATA.scenarios[id].name) + '">' + esc(id) + "</span>"; }).join("");
    if (sc.length > 5) chips += '<span class="chip">+' + (sc.length - 5) + "</span>";
    var tags = kindTag(kind);
    if (vars.length) tags += kindTag("ESCENARIO");
    var org = DATA.origins.filter(function (x) { return x.id === opt.condition; })[0];
    if (org && !org.hasScenarios) tags += '<span class="tag HIPOTESIS" title="No existe ningún Scenario de este origen: se recorre solo con las condiciones del modelo">Sin Scenarios (fuera del MVP v2)</span>';
    if (opt.status === "UNCONFIRMED") tags += '<span class="tag HIPOTESIS" title="' + esc(opt.detail || "") + '">Hipótesis sin evidencia en este origen</span>';
    var previous = state.previous && state.previous.type === "CHOOSE" && state.previous.edge === opt.edge && state.previous.thread === thread;
    return '<button class="option' + (opt.status === "UNCONFIRMED" ? " uncertain" : "") + (previous ? " previous" : "") + '" data-act="choose" data-thread="' + thread + '" data-edge="' + esc(opt.edge) + '">' +
      '<div class="cond">' + esc(opt.condition || "Sin condición en el modelo") + (previous ? ' <span class="chip">elegida antes</span>' : "") + "</div>" +
      '<div class="to">→ ' + esc(opt.to) + " · " + esc(to.name) + "</div>" +
      '<div class="chips">' + tags + chips + "</div>" +
      (opt.status === "UNCONFIRMED" && opt.detail ? '<div class="hint" style="margin-top:4px">' + esc(opt.detail) + "</div>" : "") + "</button>";
  }
  function hiddenHtml(list) {
    if (!list || !list.length) return "";
    var groups = {};
    list.forEach(function (h) { (groups[h.reason] = groups[h.reason] || []).push(h); });
    return '<details><summary>' + list.length + " alternativa" + (list.length === 1 ? "" : "s") + " existen pero no se ofrecen aquí</summary>" +
      Object.keys(groups).map(function (r) {
        return '<div class="hint" style="margin-top:6px"><b>' + esc(HIDDEN_REASON[r] || r) + "</b></div><ul class='plain'>" +
          groups[r].map(function (h) { return "<li>" + esc(h.condition || "(sin condición)") + " → " + esc(h.to) + (h.detail ? '<div class="hint">' + esc(h.detail) + "</div>" : "") + "</li>"; }).join("") + "</ul>";
      }).join("") + "</details>";
  }
  function nodeNotes(n, prevNode) {
    var out = "";
    if (n.kind) out += '<div class="kind-note"><b>' + esc(KINDS[n.kind.kind].label) + ".</b> " + esc(KINDS[n.kind.kind].hint) + '<br><span class="hint">Clasificación del viewer (' + n.kind.grounding.toLowerCase() + "): " + esc(n.kind.basis) + "</span></div>";
    else out += '<div class="kind-note"><b>' + esc(KINDS.SIN_CLASIFICAR.label) + ".</b> " + esc(KINDS.SIN_CLASIFICAR.hint) + "</div>";
    if (n.scope) out += '<div class="field"><span class="k">Alcance de la condición:</span> ' + esc(SCOPE_LABEL[n.scope.scope]) + '<div class="hint">' + esc(n.scope.basis) + " El explorador no calcula este estado: permite recorrer cada resultado posible como hipótesis.</div></div>";
    if (n.contextExit) out += '<div class="field"><span class="k">Nodo compartido:</span> ofrece solo las salidas que corresponden al nodo de procedencia' + (prevNode ? " (se llegó desde " + esc(prevNode) + ")" : "") + '.<div class="hint">' + esc(n.contextExit.basis) + "</div></div>";
    if (n.description) out += "<details><summary>Qué dice el modelo sobre este nodo</summary><div class='body'>" + esc(n.description) + "</div></details>";
    return out;
  }
  function threadTitle(t) { return t.id === "main" ? "Recorrido principal" : "Carril independiente " + t.start; }
  function pendingCard(t) {
    var last = t.visits[t.visits.length - 1];
    var n = node(last.node);
    var prev = t.visits.length > 1 ? t.visits[t.visits.length - 2].node : null;
    var head = '<div class="id">' + esc(threadTitle(t)) + " · " + esc(n.id) + "</div><h3>" + esc(n.name) + "</h3>" + (n.actor ? '<div class="field"><span class="k">Actor:</span> ' + esc(n.actor.name) + "</div>" : "");
    var p = t.pending;
    if (p && p.kind === "DECISION") {
      var proven = p.options.filter(function (o) { return o.status === "ALLOWED"; });
      var unconfirmed = p.options.filter(function (o) { return o.status === "UNCONFIRMED"; });
      return '<div class="card current">' + head + nodeNotes(n, prev) +
        '<div class="hint" style="margin:6px 0">Elija una alternativa real del proceso. Solo se mostrará la rama elegida.</div>' +
        proven.map(function (o) { return optionHtml(t.id, o); }).join("") +
        (unconfirmed.length ? '<div class="subhead">Sin evidencia de Scenarios para este origen (hipótesis de exploración)</div>' + unconfirmed.map(function (o) { return optionHtml(t.id, o); }).join("") : "") +
        hiddenHtml(p.hidden) + "</div>";
    }
    if (p && p.kind === "CYCLE") {
      return '<div class="card current">' + head + '<div class="tag-row"><span class="tag HIPOTESIS">Ciclo detectado</span></div>' +
        '<p class="hint">El único avance posible vuelve a <b>' + esc(p.cycleTarget) + "</b>, que ya se visitó " + plural(p.cycleTargetVisits, "vez", "veces") + ". El explorador no repite ciclos por sí solo.</p>" +
        '<button class="option" data-act="cycle" data-thread="' + t.id + '"><div class="cond">Repetir el ciclo (visita ' + (p.cycleTargetVisits + 1) + ' de ' + esc(p.cycleTarget) + ')</div><div class="to">→ ' + esc(p.cycleTarget) + " · " + esc(node(p.cycleTarget).name) + "</div></button>" +
        '<p class="hint">Para salir por otra alternativa, vuelva a una decisión anterior desde «Mi recorrido».</p>' + nodeNotes(n, prev) + hiddenHtml(p.hidden) + "</div>";
    }
    if (p && p.kind === "EXTERNAL") {
      var only = p.options.length === 1 ? p.options[0] : null;
      return '<div class="card current">' + head + '<div class="tag-row">' + kindTag("EXTERNA") + "</div>" +
        '<p class="hint">El hilo espera algo que ocurre fuera de él: <b>' + esc(p.event) + "</b>.</p>" +
        '<button class="option" data-act="event" data-thread="' + t.id + '"><div class="cond">Se produjo el evento esperado → continuar</div>' + (only ? '<div class="to">→ ' + esc(only.to) + " · " + esc(node(only.to).name) + (only.condition ? " [" + esc(only.condition) + "]" : "") + "</div>" : "") + "</button>" + nodeNotes(n, prev) + hiddenHtml(p.hidden) + "</div>";
    }
    var msg = { ENDED: "Fin del proceso: este recorrido llegó al evento final.", DEAD_END: "No hay salidas demostradas desde este nodo para el origen elegido.", RETURNED: "Este carril regresó al recorrido principal vía " + (t.returnedAt || "") + ".", CLOSED: "Carril cerrado por el usuario." }[t.status] || "";
    return '<div class="card">' + head + '<p class="hint"><b>' + esc(msg) + "</b></p>" +
      (t.status === "DEAD_END" ? '<p class="hint">Puede activar «Incluir ramas sin evidencia» (en Opciones) o volver a una decisión anterior.</p>' + hiddenHtml(t.hiddenAtEnd) : "") + "</div>";
  }
  function renderCurrent() {
    var cards = result.threads.map(pendingCard).join("");
    $("sec-current").innerHTML = "<h2>Decisión actual</h2>" + cards;
  }

  function historyItems() {
    var items = [], group = null;
    var arrived = {};
    result.threads.forEach(function (t) { t.visits.forEach(function (v) { if (v.via && v.via.action != null) arrived[v.via.action] = v; }); });
    var events = [];
    result.threads.forEach(function (t) { t.visits.forEach(function (v) { events.push({ seq: v.seq, kind: "visit", v: v, t: t }); }); });
    result.actionLog.forEach(function (a) { events.push({ seq: a.seq, kind: "action", a: a }); });
    events.sort(function (x, y) { return x.seq - y.seq; });
    function flush() { if (group) { items.push(group); group = null; } }
    events.forEach(function (e) {
      if (e.kind === "action") { flush(); items.push({ type: "action", a: e.a, arrived: arrived[e.a.index] }); return; }
      var mode = e.v.via ? e.v.via.mode : "START";
      if (mode === "START") { flush(); items.push({ type: "start", v: e.v, t: e.t }); }
      else if (mode === "AUTO") { if (!group || group.thread !== e.t.id) { flush(); group = { type: "auto", thread: e.t.id, visits: [] }; } group.visits.push(e.v); }
    });
    flush();
    return items;
  }
  function renderHistory() {
    var items = historyItems();
    var html = '<h2>Mi recorrido <span class="count">' + plural(result.decisions, "decisión", "decisiones") + "</span></h2><ol class='history'>";
    items.forEach(function (it) {
      if (it.type === "start") {
        html += '<li class="' + (it.t.id === "main" ? "" : "lane") + '"><span class="meta">' + (it.t.id === "main" ? "Inicio" : "Inicio del carril") + "</span><br><b>" + esc(it.v.node) + "</b> · " + esc(node(it.v.node).name) + "</li>";
      } else if (it.type === "auto") {
        html += '<li class="auto">Avance automático' + (it.thread === "main" ? "" : " (" + esc(it.thread) + ")") + ": " + it.visits.map(function (v) { return esc(v.node.replace("PROC-REP-", "")) + (v.visitNo > 1 ? "<sup>" + v.visitNo + "</sup>" : ""); }).join(" → ") + "</li>";
      } else {
        var a = it.a, n = node(a.node), act = a.action, step = a.index + 1;
        var body;
        if (act.type === "CHOOSE") {
          var e = edge(act.edge);
          body = '<div class="alt">' + esc(n.name) + "</div><div><b>" + esc(a.node) + "</b> → <span class='alt'>" + esc(e.condition || "sin condición en el modelo") + "</span></div>" +
            '<div class="meta">' + (n.actor ? esc(n.actor.name) + " · " : "") + (n.kind ? esc(KINDS[(e.kind || n.kind).kind].label) : esc(KINDS.SIN_CLASIFICAR.label)) + "</div>";
        } else if (act.type === "CONTINUE_CYCLE") {
          body = '<div class="alt">Ciclo confirmado</div><div><b>' + esc(a.node) + "</b> → " + (it.arrived ? "<b>" + esc(it.arrived.node) + "</b> (visita " + it.arrived.visitNo + ")" : "") + "</div>";
        } else if (act.type === "EVENT_OCCURRED") {
          body = '<div class="alt">Evento externo ocurrido</div><div><b>' + esc(a.node) + "</b>: " + esc((graph.waits[a.node] || {}).event || "") + "</div>";
        } else if (act.type === "ACTIVATE_LANE") {
          body = '<div class="alt">Evento independiente activado</div><div><b>' + esc(act.start) + "</b> · " + esc(node(act.start).name) + '</div><div class="meta">Acción del usuario: no es una arista del modelo</div>';
        } else {
          body = '<div class="alt">Carril cerrado</div><div class="meta">' + esc(act.thread) + "</div>";
        }
        html += '<li class="action' + (act.type === "CONTINUE_CYCLE" ? " cycle" : "") + (act.type === "ACTIVATE_LANE" || act.type === "CLOSE_LANE" ? " lane" : "") + '"><span class="n">' + step + '.</span><div class="hbody">' + body +
          '<div><button class="mini" data-act="goto" data-index="' + a.index + '" title="Deshace esta y las acciones siguientes y vuelve a este punto">Volver a este punto</button></div></div></li>';
      }
    });
    $("sec-history").innerHTML = html + "</ol>";
  }

  function statusOf(n, origin) {
    var info = origin ? (graph.policy.statuses[origin] || {}) : {};
    return function (edgeId) { return info[edgeId]; };
  }
  function renderNode() {
    var id = state.selected || (result.threads[0].visits[result.threads[0].visits.length - 1].node);
    var n = node(id);
    var ins = Object.keys(DATA.edges).map(function (k) { return DATA.edges[k]; }).filter(function (e) { return e.to === id; });
    var outs = Object.keys(DATA.edges).map(function (k) { return DATA.edges[k]; }).filter(function (e) { return e.from === id; });
    var st = statusOf(n, result.origin);
    function edgeLi(e, dir) {
      var s = st(e.id);
      return "<li>" + (dir === "in" ? esc(e.from) + " → " : "→ " + esc(e.to) + " ") + (e.condition ? "[" + esc(e.condition) + "] " : "") + (dir === "in" ? "" : "· " + esc(node(e.to).name)) +
        (s ? ' <span class="tag ' + (s.status === "HIDDEN" ? "SIN_CLASIFICAR" : "HIPOTESIS") + '">' + (s.status === "HIDDEN" ? "no aplica al origen" : "sin evidencia en el origen") + "</span>" : "") + "</li>";
    }
    var html = '<h2>Detalle del nodo</h2><div class="card"><div class="id">' + esc(n.id) + " · " + esc(TYPE_LABEL[n.type] || n.type) + "</div><h3>" + esc(n.name) + "</h3>" +
      (n.actor ? '<div class="field"><span class="k">Actor responsable:</span> ' + esc(n.actor.name) + "</div>" : '<div class="field"><span class="k">Actor responsable:</span> no definido en el modelo</div>') +
      nodeNotes(n, null) +
      (n.inputs && n.inputs.length ? "<details><summary>Entradas</summary><ul class='plain'>" + n.inputs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></details>" : "") +
      (n.outputs && n.outputs.length ? "<details><summary>Salidas</summary><ul class='plain'>" + n.outputs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></details>" : "") +
      "<details open><summary>Business Rules (" + n.rules.length + ")</summary>" + (n.rules.length ? "<ul class='plain'>" + n.rules.map(function (r) { return "<li><b>" + esc(r.id) + "</b> " + esc(r.name) + (r.description ? "<details><summary>texto de la regla</summary><div class='body'>" + esc(r.description) + "</div></details>" : "") + "</li>"; }).join("") + "</ul>" : '<div class="hint">El nodo no cita reglas.</div>') + "</details>" +
      "<details><summary>Features relacionadas (" + n.features.length + ")</summary>" + (n.features.length ? "<ul class='plain'>" + n.features.map(function (f) { return "<li><b>" + esc(f.id) + "</b> " + esc(f.name) + "</li>"; }).join("") + "</ul>" : '<div class="hint">Ninguna Feature lo posee.</div>') + "</details>" +
      "<details open><summary>Condiciones de entrada (" + ins.length + ")</summary><ul class='plain'>" + (ins.map(function (e) { return edgeLi(e, "in"); }).join("") || "<li>Es un evento de inicio: no tiene aristas de entrada.</li>") + "</ul></details>" +
      "<details open><summary>Condiciones de salida (" + outs.length + ")</summary><ul class='plain'>" + (outs.map(function (e) { return edgeLi(e, "out"); }).join("") || "<li>No tiene salidas.</li>") + "</ul></details>" +
      "<details><summary>Escenarios que lo utilizan (" + n.scenarios.length + ")</summary><ul class='plain'>" + (n.scenarios.map(function (id2) { var s = DATA.scenarios[id2]; return "<li><b>" + esc(id2) + "</b> " + esc(s.name) + "</li>"; }).join("") || "<li>Ninguno.</li>") + "</ul></details></div>";
    $("sec-node").innerHTML = html;
  }

  function renderLanes() {
    var html = '<h2>Eventos independientes</h2><p class="hint">Eventos que el proceso permite iniciar sin que el hilo técnico los espere. Activarlos es una hipótesis de exploración: el modelo no codifica la condición que los habilita.</p>';
    result.lanes.forEach(function (slot) {
      var n = node(slot.start);
      html += '<div class="card"><div class="id">' + esc(slot.start) + "</div><h3>" + esc(n.name) + "</h3>" +
        (slot.available ? '<button class="btn primary" data-act="activate" data-start="' + slot.start + '">Activar evento independiente</button>' : '<div class="hint">No disponible: ' + esc(slot.reason || "") + "</div>") +
        "<details><summary>Qué dice el modelo</summary><div class='body'>" + esc(n.description || "") + "</div></details></div>";
    });
    result.threads.filter(function (t) { return t.id !== "main"; }).forEach(function (t) {
      html += '<div class="card"><div class="id">' + esc(t.id) + " · " + esc(t.status) + "</div><div class='hint'>Carril de " + esc(t.start) + (t.returnedAt ? ", regresó vía " + esc(t.returnedAt) : "") + "</div>" +
        (t.status === "WAITING" ? '<button class="mini" data-act="close-lane" data-thread="' + t.id + '">Cerrar este carril</button>' : "") + "</div>";
    });
    $("sec-lanes").innerHTML = html;
  }

  function renderSettings() {
    var anyOrigin = result.origin ? originLabel(result.origin) : "sin elegir";
    var starts = DATA.starts.filter(function (s) { return !s.independent; });
    $("sec-settings").innerHTML = '<h2>Opciones</h2>' +
      '<label class="field"><input type="checkbox" id="opt-uncertain" ' + (state.includeUncertain ? "checked" : "") + '> Incluir ramas sin evidencia de Scenarios para el origen (se muestran como hipótesis)</label>' +
      '<div class="hint">Origen elegido: <b>' + esc(anyOrigin) + "</b>. Con la casilla desmarcada, esas ramas se listan como «no se ofrecen» con su motivo.</div>" +
      '<div class="field" style="margin-top:8px"><span class="k">Evento de inicio:</span> <select id="opt-start">' + starts.map(function (s) { return '<option value="' + s.id + '"' + (s.id === state.start ? " selected" : "") + ">" + esc(s.id + " · " + s.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field" style="margin-top:8px"><button class="mini" data-act="copy-link">Copiar enlace a este recorrido</button> <input id="link-box" readonly style="width:100%;margin-top:6px;font-size:11px" value=""></div>';
    $("link-box").value = location.href;
  }

  function renderHelp() {
    var legendKinds = ["HUMANA", "SISTEMA", "DERIVADA", "DATO_ORDEN", "EXTERNA", "ESCENARIO", "SIN_CLASIFICAR"].map(function (k) { return "<li>" + kindTag(k) + " " + esc(KINDS[k].hint) + "</li>"; }).join("");
    var md = DATA.multiDetail;
    $("sec-help").innerHTML = "<h2>Cómo leer el explorador</h2>" +
      "<details><summary>Tipos de alternativa</summary><ul class='plain'>" + legendKinds + "</ul></details>" +
      "<details><summary>Varios Detalles en una misma OR</summary><div class='hint'>" + esc(md.intro) + "</div><ul class='plain'>" + md.levels.map(function (l) { return "<li><b>" + esc(l.label) + ".</b> " + esc(l.text) + "</li>"; }).join("") + "</ul><div class='hint'><b>Ejemplo ilustrativo (no calculado):</b> " + esc(md.example) + "</div></details>" +
      "<details open><summary>Límites de la representación</summary><ul class='plain'>" + DATA.limitations.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></details>";
  }

  // ------------------------------------------------------------------ header
  function renderHeader() {
    var main = result.threads[0];
    var pend = result.threads.filter(function (t) { return t.pending; });
    var label, cls = "";
    var p0 = main.pending;
    if (p0 && p0.kind === "DECISION") label = "Esperando decisión";
    else if (p0 && p0.kind === "EXTERNAL") { label = "Esperando evento externo"; }
    else if (p0 && p0.kind === "CYCLE") { label = "Ciclo detectado: confirmar"; cls = "cycle"; }
    else if (main.status === "ENDED") { label = "Fin del proceso"; cls = "ok"; }
    else if (main.status === "DEAD_END") { label = "Sin salidas demostradas"; cls = "warn"; }
    else label = main.status;
    if (pend.length > 1) label += " (+" + (pend.length - 1) + " carril)";
    $("b-state").className = "badge " + cls;
    $("b-state").textContent = label;
    $("b-origin").textContent = "Origen: " + (result.origin ? originLabel(result.origin) + " (" + result.origin + ")" : "sin elegir");
    $("b-origin").className = "badge" + (result.origin ? "" : " neutral");
    $("b-decisions").textContent = plural(result.decisions, "decisión tomada", "decisiones tomadas") + " · " + plural(result.threads.reduce(function (n, t) { return n + t.visits.length; }, 0), "nodo", "nodos");
    $("btn-back").disabled = state.actions.length === 0;
    $("btn-reset").disabled = state.actions.length === 0;
    $("btn-full").className = "btn" + (state.full ? " on" : "");
    $("btn-full").textContent = state.full ? "Seguir el recorrido" : "Ver recorrido completo";
  }

  // ------------------------------------------------------------------ main render
  function persist() {
    try {
      var payload = JSON.stringify({ s: state.start, u: state.includeUncertain, a: state.actions });
      history.replaceState(null, "", "#r=" + encodeURIComponent(btoa(unescape(encodeURIComponent(payload)))));
    } catch (e) { /* file:// restrictions: persistence is a convenience only */ }
  }
  function restore() {
    var m = /#r=([^&]+)/.exec(location.hash || "");
    if (!m) return;
    try {
      var obj = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      if (obj && Array.isArray(obj.a)) { state.start = obj.s || state.start; state.includeUncertain = obj.u !== false; state.actions = obj.a; }
    } catch (e) { /* invalid link: start from scratch */ }
  }
  function update(opts) {
    compute();
    $("viewport").innerHTML = svgContent(layout);
    renderHeader(); renderCurrent(); renderHistory(); renderNode(); renderLanes(); renderSettings();
    persist();
    if (opts && opts.keepView) { applyView(); return; }
    if (state.full) fitAll();
    else { var r = latestRect(); if (r) ensureVisible(r); }
  }

  // ------------------------------------------------------------------ actions
  function dispatch(action) { state.previous = null; state.actions = state.actions.concat([action]); state.selected = null; update(); }
  function goTo(index) { state.previous = state.actions[index] || null; state.actions = state.actions.slice(0, index); state.selected = null; update(); }
  function back() { if (state.actions.length) goTo(state.actions.length - 1); }
  function reset() { state.previous = null; state.actions = []; state.selected = null; update(); initialView(); }
  function initialView() {
    var s = stageSize();
    view.k = 1; view.x = (s.w - layout.bounds.w) / 2 - layout.bounds.x; view.y = 24 - layout.bounds.y;
    applyView();
  }

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportInfo(id) { var n = node(id); return { id: id, type: n.type, name: n.name, actorName: n.actor ? n.actor.name : undefined }; }
  var TITLE = "Rosario Tecno - Explorador de Recorridos V" + DATA.meta.process.version;
  var exporters = {
    mermaid: function () { return EX.routeToMermaid(result, graph, exportInfo, TITLE); },
    text: function () { return EX.routeToText(result, graph, exportInfo, TITLE); },
    json: function () { return EX.routeToJson(result, graph, exportInfo, { process: DATA.meta.process.id, version: DATA.meta.process.version, start: state.start, includeUncertain: state.includeUncertain }, state.actions); },
    svg: standaloneSvg
  };
  function exportPng() {
    var svg = standaloneSvg();
    var b = layout.bounds, scale = 2;
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = Math.ceil(b.w * scale); canvas.height = Math.ceil(b.h * scale);
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        var url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = "recorrido-v" + DATA.meta.process.version + ".png"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }, "image/png");
    };
    img.onerror = function () { alert("No se pudo generar la imagen PNG en este navegador. Use la exportación SVG."); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // ------------------------------------------------------------------ events
  function bind() {
    $("sidebar").addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-act]");
      if (!t) return;
      var act = t.getAttribute("data-act"), thread = t.getAttribute("data-thread");
      if (act === "choose") dispatch({ type: "CHOOSE", thread: thread, edge: t.getAttribute("data-edge") });
      else if (act === "cycle") dispatch({ type: "CONTINUE_CYCLE", thread: thread });
      else if (act === "event") dispatch({ type: "EVENT_OCCURRED", thread: thread });
      else if (act === "activate") dispatch({ type: "ACTIVATE_LANE", start: t.getAttribute("data-start"), lane: EN.nextLaneId(state.actions) });
      else if (act === "close-lane") dispatch({ type: "CLOSE_LANE", thread: thread });
      else if (act === "goto") goTo(Number(t.getAttribute("data-index")));
      else if (act === "copy-link") {
        var box = $("link-box"); box.select();
        try { if (navigator.clipboard) navigator.clipboard.writeText(location.href); else document.execCommand("copy"); } catch (e) { /* the selected text can be copied by hand */ }
      }
    });
    $("sidebar").addEventListener("change", function (ev) {
      if (ev.target.id === "opt-uncertain") { state.includeUncertain = ev.target.checked; update({ keepView: true }); }
      else if (ev.target.id === "opt-start") { state.start = ev.target.value; state.actions = []; state.previous = null; update(); initialView(); }
    });
    $("btn-back").addEventListener("click", back);
    $("btn-reset").addEventListener("click", reset);
    $("btn-fit").addEventListener("click", function () { fitAll(); });
    $("btn-full").addEventListener("click", function () { state.full = !state.full; update(); });
    $("zoom-in").addEventListener("click", function () { var s = stageSize(); zoomAt(s.w / 2, s.h / 2, 1.2); });
    $("zoom-out").addEventListener("click", function () { var s = stageSize(); zoomAt(s.w / 2, s.h / 2, 1 / 1.2); });
    $("btn-export").addEventListener("click", function (ev) { ev.stopPropagation(); $("export-menu").classList.toggle("open"); });
    document.addEventListener("click", function () { $("export-menu").classList.remove("open"); });
    $("export-menu").addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-export]");
      if (!t) return;
      var kind = t.getAttribute("data-export");
      if (kind === "mermaid") download("recorrido-v" + DATA.meta.process.version + ".mmd", exporters.mermaid(), "text/plain;charset=utf-8");
      else if (kind === "text") download("recorrido-v" + DATA.meta.process.version + ".txt", exporters.text(), "text/plain;charset=utf-8");
      else if (kind === "json") download("recorrido-v" + DATA.meta.process.version + ".json", exporters.json(), "application/json");
      else if (kind === "svg") download("recorrido-v" + DATA.meta.process.version + ".svg", exporters.svg(), "image/svg+xml");
      else if (kind === "png") exportPng();
    });
    var canvas = $("canvas"), drag = null;
    canvas.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      var r = canvas.getBoundingClientRect();
      zoomAt(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    canvas.addEventListener("pointerdown", function (ev) { drag = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y, moved: false, target: ev.target }; });
    window.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; canvas.classList.add("dragging"); }
      if (drag.moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); }
    });
    window.addEventListener("pointerup", function () {
      if (!drag) return;
      var d = drag; drag = null; canvas.classList.remove("dragging");
      if (!d.moved) {
        var g = d.target.closest && d.target.closest(".node");
        if (g) { state.selected = g.getAttribute("data-node"); $("viewport").innerHTML = svgContent(layout); renderNode(); }
      }
    });
    window.addEventListener("resize", function () { if (state.full) fitAll(); });
    window.addEventListener("keydown", function (ev) { if (ev.key === "Backspace" && !/input|select|textarea/i.test((ev.target.tagName || ""))) { ev.preventDefault(); back(); } });
  }

  // ------------------------------------------------------------------ boot
  window.__explorer = {
    data: DATA, graph: graph, state: state,
    dispatch: dispatch, goTo: goTo, back: back, reset: reset, update: update,
    result: function () { return result; }, layout: function () { return layout; },
    exporters: exporters
  };
  restore();
  bind();
  compute();
  update();
  if (!state.actions.length) initialView();
  renderHelp();

  // ------------------------------------------------------------------ built-in self-test (headless Chrome: open the file with #selftest)
  if (SELFTEST) {
    var out = { passed: 0, failed: [] };
    var ok = function (cond, name) { if (cond) out.passed++; else out.failed.push(name); };
    var count = function (sel) { return document.querySelectorAll(sel).length; };
    try {
      reset();
      ok(count("#viewport .node") === 2, "inicio: dos nodos (evento inicial y decisión de origen)");
      ok(count("#sec-current .option") === 4, "primera decisión: cuatro alternativas de origen");
      ok(count('#viewport .node[data-node="PROC-REP-020"]') === 0, "las ramas no elegidas no se dibujan");
      var ce = Array.prototype.filter.call(document.querySelectorAll("#sec-current .option"), function (b) { return /CLIENTE_EXTERNO/.test(b.querySelector(".cond").textContent); })[0];
      ce.click();
      ok(/CLIENTE_EXTERNO/.test($("b-origin").textContent), "el encabezado muestra el origen elegido");
      ok(count('#viewport .node[data-node="PROC-REP-045"]') === 1 && count('#viewport .node[data-node="PROC-REP-020"]') === 0, "elegir origen revela solo esa rama");
      ok(count("#sec-history li.action") === 1 && $("b-decisions").textContent.indexOf("1 decisión") === 0, "el historial registra la decisión");
      var before = count("#viewport .node");
      document.querySelector('#sec-current .option[data-act="choose"]').click();
      ok(count("#viewport .node") > before, "la siguiente elección agrega nodos");
      $("btn-back").click();
      ok(count("#viewport .node") === before, "Volver deshace la última decisión");
      document.querySelector('#sec-history [data-act="goto"]').click();
      ok(count("#viewport .node") === 2 && count("#sec-current .option") === 4, "volver a la primera decisión reconstruye el punto y vuelve a ofrecer el origen");
      ok(count("#sec-current .option.previous") === 1, "se marca la alternativa elegida antes");
      var ri = Array.prototype.filter.call(document.querySelectorAll("#sec-current .option"), function (b) { return /^RT_INTERNO/.test(b.querySelector(".cond").textContent); })[0];
      ri.click();
      ok(count('#viewport .node[data-node="PROC-REP-030"]') === 0 && count('#viewport .node[data-node="PROC-REP-020"]') === 1, "cambiar la decisión elimina los segmentos incompatibles");
      ok(exporters.mermaid().indexOf("flowchart TD") > 0 && exporters.text().indexOf("Decisiones elegidas") > 0, "las exportaciones se generan");
      $("btn-reset").click();
      ok(count("#viewport .node") === 2 && count("#sec-history li.action") === 0, "Reiniciar elimina el recorrido");
      var net = (performance.getEntriesByType("resource") || []).filter(function (r) { return /^https?:/.test(r.name); });
      ok(net.length === 0, "funciona sin conexión: ningún recurso externo");
      ok(!!document.querySelector("#canvas") && layout.bounds.w > 0, "el diagrama tiene dimensiones");
    } catch (e) { out.failed.push("excepción: " + (e && e.message)); }
    var pre = document.createElement("pre");
    pre.id = "selftest-result";
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
})();
