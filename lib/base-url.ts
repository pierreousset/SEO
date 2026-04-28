/**
 * Single source of truth for the app's base URL.
 * Reads from BETTER_AUTH_URL env var. Fallback to localhost only in dev.
 */
export function getBaseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
}
