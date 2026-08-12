/**
 * Feature flags. Static and build-time on purpose — a remote flag service is
 * infrastructure this product doesn't have yet, and reading flags through one
 * accessor now means adding that later touches this file only.
 */
export interface FeatureFlags {
  /** Natural-language ledger query box. */
  naturalLanguageQuery: boolean;
}

export const features: FeatureFlags = {
  naturalLanguageQuery: true,
};
