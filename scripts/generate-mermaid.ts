/**
 * Generates a Mermaid flowchart from a business process YAML file.
 *
 * YAML is the single source of truth. This script is a one-way
 * transformation: YAML -> Mermaid. Mermaid is never edited by hand
 * and never read back into the process model.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildFlowchartBody, loadYaml, type ProcessModel } from "./lib/process-model";

const SOURCE_FILE = join("business", "processes", "repair-management.yaml");
const OUTPUT_FILE = join("generated", "mermaid", "repair-management.mmd");

function generateMermaid(model: ProcessModel): string {
  const lines: string[] = [];
  lines.push("%% AUTO-GENERATED FILE.");
  lines.push("%% DO NOT EDIT MANUALLY.");
  lines.push(`%% SOURCE: ${SOURCE_FILE.replace(/\\/g, "/")}`);
  lines.push("");
  lines.push("flowchart TD");
  lines.push(...buildFlowchartBody(model));

  return lines.join("\n") + "\n";
}

function main(): void {
  const model = loadYaml<ProcessModel>(SOURCE_FILE);

  const mermaid = generateMermaid(model);

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, mermaid, "utf8");

  console.log(`Mermaid diagram generated: ${OUTPUT_FILE}`);
}

main();
