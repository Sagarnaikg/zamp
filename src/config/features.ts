import { isDevelopment } from "./env";

/**
 * Feature flags. Static and build-time on purpose — a remote flag service is
 * infrastructure this product doesn't have yet, and reading flags through one
 * accessor now means adding that later touches this file only.
 */
export interface FeatureFlags {
  /** The pipeline graph view — expensive to render, useful to hide while iterating. */
  pipelineVisualization: boolean;
  /** Natural-language ledger query box. */
  naturalLanguageQuery: boolean;
  /** React Query devtools panel. */
  queryDevtools: boolean;
}

export const features: FeatureFlags = {
  pipelineVisualization: true,
  naturalLanguageQuery: true,
  queryDevtools: isDevelopment,
};
