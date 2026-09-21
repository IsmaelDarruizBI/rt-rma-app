/**
 * Generates a Mermaid flowchart from a business process YAML file.
 *
 * YAML is the single source of truth. This script is a one-way
 * transformation: YAML -> Mermaid. Mermaid is never edited by hand
 * and never read back into the process model.
 *
 * The source file is parameterizable via an optional CLI arg
 * (`tsx scripts/generate-mermaid.ts [sourceFile]`), so the same script
 * generates the diagram for any process revision. The output filename is
 * derived from the source filename's stem, so the default (no arg, V1.2,
 * `repair-management.yaml`) keeps producing exactly
 * `generated/mermaid/repair-management.mmd` as before, while an explicit
 * source like `repair-management-v1.3.yaml` produces a sibling
 * `repair-management-v1.3.mmd` without colliding with V1.2's output.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { buildFlowchartBody, loadYaml, type ProcessModel } from "./lib/process-model";

const DEFAULT_SOURCE_FILE = join("business", "processes", "repair-management.yaml");
const SOURCE_FILE = process.argv[2] ?? DEFAULT_SOURCE_FILE;
const OUTPUT_FILE = join("generated", "mermaid", `${basename(SOURCE_FILE, ".yaml")}.mmd`);

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
