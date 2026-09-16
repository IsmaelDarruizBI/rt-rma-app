/**
 * Shared types for the Feature Definition YAML model
 * (business/features/*.yaml). Mirrors the shape validated by
 * business/schemas/feature.schema.json.
 *
 * Used by validate-features.ts and validate-references.ts so the shape of
 * a Feature is defined in exactly one place instead of duplicated locally
 * in each script; the viewer will also need these types in a future
 * evolution (Feature <-> Business Process visualization).
 *
 * No business logic here - types only. Loading is done via `loadYaml`
 * from ./process-model, reused rather than duplicated.
 */

export interface FeatureSourceProcess {
  id: string;
  version: string;
}

export interface FeatureScope {
  includes: string[];
  excludes: string[];
}

export interface FeatureDefinition {
  id: string;
  name: string;
  status: string;
  source_process: FeatureSourceProcess;
  purpose: string;
  inputs: string[];
  outputs: string[];
  process_nodes: string[];
  business_rules: string[];
  scope: FeatureScope;
  open_questions: string[];
}

export interface FeatureModel {
  process: {
    id: string;
    version: string;
  };
  features: FeatureDefinition[];
}
