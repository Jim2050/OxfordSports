/**
 * Application-wide feature flags.
 *
 * DISABLE_AUTH — when true, the entire member login/register flow is
 * bypassed and the site becomes publicly accessible.
 *
 * Currently HARDCODED to true (temporary public mode).
 * To re-enable auth: change the value below to false.
 *
 * Can also be overridden via environment variable:
 *   VITE_DISABLE_AUTH=true   (then restart Vite / rebuild)
 */
export const DISABLE_AUTH =
  String(import.meta.env.VITE_DISABLE_AUTH || "true").toLowerCase() === "true";
