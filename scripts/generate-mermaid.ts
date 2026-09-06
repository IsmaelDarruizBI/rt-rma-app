/**
 * Generates a Mermaid flowchart from a business process YAML file.
 *
 * YAML is the single source of truth. This script is a one-way
 * transformation: YAML -> Mermaid. Mermaid is never edited by hand
 * and never read back into the process model.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse } from "yaml";

type NodeType = "start" | "end" | "activity" | "decision" | "event";

interface ProcessNode {
  id: string;
  type: NodeType;
  name: string;
  actor?: string;
}

interface ProcessEdge {
  from: string;
  to: string;
  condition?: string;
}

interface ProcessModel {
  process: { id: string; name: string; version: string; status?: string };
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

const SOURCE_FILE = join("business", "processes", "repair-management.yaml");
const OUTPUT_FILE = join("generated", "mermaid", "repair-management.mmd");

/** Escapes text so it is safe to place inside a quoted Mermaid node label. */
function escapeLabel(text: string): string {
  return text.replace(/"/g, "'");
}

/** Wraps a node id in the Mermaid shape that corresponds to its process node type. */
function renderNode(node: ProcessNode): string {
  const label = escapeLabel(node.name);
  switch (node.type) {
    case "start":
      return `${node.id}(["${label}"])`;
    case "end":
      return `${node.id}((("${label}")))`;
    case "decision":
      return `${node.id}{"${label}"}`;
    case "event":
      return `${node.id}{{"${label}"}}`;
    case "activity":
    default:
      return `${node.id}["${label}"]`;
  }
}

function renderEdge(edge: ProcessEdge): string {
  if (edge.condition) {
    return `${edge.from} -->|${escapeLabel(edge.condition)}| ${edge.to}`;
  }
  return `${edge.from} --> ${edge.to}`;
}

function generateMermaid(model: ProcessModel): string {
  const lines: string[] = [];
  lines.push("%% AUTO-GENERATED FILE.");
  lines.push("%% DO NOT EDIT MANUALLY.");
  lines.push(`%% SOURCE: ${SOURCE_FILE.replace(/\\/g, "/")}`);
  lines.push("");
  lines.push("flowchart TD");

  for (const node of model.nodes) {
    lines.push(`    ${renderNode(node)}`);
  }

  lines.push("");

  for (const edge of model.edges) {
    lines.push(`    ${renderEdge(edge)}`);
  }

  return lines.join("\n") + "\n";
}

function main(): void {
  const raw = readFileSync(SOURCE_FILE, "utf8");
  const model = parse(raw) as ProcessModel;

  const mermaid = generateMermaid(model);

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, mermaid, "utf8");

  console.log(`Mermaid diagram generated: ${OUTPUT_FILE}`);
}

main();
