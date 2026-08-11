import { z } from "zod";

/**
 * Client-side environment, validated once at module load so a misconfigured
 * deploy fails loudly at boot instead of as a confusing runtime error later.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` only for literal member access,
 * so each variable is read explicitly rather than through a loop.
 */
const clientEnvSchema = z.object({
  /** Empty means same-origin — the normal case, since the API ships with the app. */
  apiBaseUrl: z.string().default(""),
  environment: z.enum(["development", "test", "production"]),
  /** Where client-side errors are POSTed. Empty disables remote reporting. */
  errorReportingUrl: z.string().default(""),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export const env: ClientEnv = clientEnvSchema.parse({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  environment: process.env.NODE_ENV,
  errorReportingUrl: process.env.NEXT_PUBLIC_ERROR_REPORTING_URL ?? "",
});

export const isProduction = env.environment === "production";
export const isDevelopment = env.environment === "development";
