/**
 * Application-wide feature flags.
 *
 * AUTH_OFF — when true, the entire member login/register flow is
 * bypassed and the site becomes publicly accessible.
 *
 * Currently set to true (temporary public mode).
 * To re-enable auth: change the value below to false, commit, and push.
 */
export const DISABLE_AUTH = true;
