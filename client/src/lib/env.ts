/**
 * Single choke point for `import.meta.env`.
 *
 * Vite injects `import.meta.env` at build time; jest does not, so reading it
 * directly from a component makes that component untestable. Everything goes
 * through here instead, and the optional chaining keeps it safe under jsdom.
 */
const env = ((import.meta as unknown as { env?: Record<string, unknown> }).env ??
  {}) as Record<string, unknown>;

export const IS_DEV = Boolean(env.DEV);
export const IS_PROD = Boolean(env.PROD);

/** Empty string means "same origin" — the normal deployed case. */
export const API_URL = typeof env.VITE_API_URL === "string" ? env.VITE_API_URL : "";

/** Falsy disables analytics entirely rather than hardcoding a measurement ID. */
export const GA_ID = typeof env.VITE_GA_ID === "string" ? env.VITE_GA_ID : "";
