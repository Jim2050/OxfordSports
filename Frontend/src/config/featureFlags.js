/**
 * Application-wide feature flags.
 *
 * AUTH_PUBLIC_MODE — when true, the entire member login/register flow
 * is bypassed and the site becomes publicly accessible.
 *
 * Currently set to true (temporary public mode).
 * To re-enable auth: change the value below to false, commit, and push.
 */
export const AUTH_PUBLIC_MODE = false;
