// Idle-lock policy (roadmap 2.8, security plan S4). Research summary in
// docs/redesign/03-security-plan.md → "Idle lock duration".
//
// 30 minutes matches OWASP's 15–30 min band for business applications and the
// Dynamics 365 Finance & Operations default, and stays inside NIST
// SP 800-63B-4's AAL2 ceiling (inactivity timeout no more than 1 hour). It is a
// *lock*, not a sign-out: the page and unsaved work stay put and only the
// password is needed to resume, so a moderate value costs users little.

/** Minutes without input (in any tab) before the session locks. */
export const IDLE_LOCK_MINUTES = 30;

/** Countdown shown in the status bar before the lock, in seconds. */
export const IDLE_WARNING_SECONDS = 120;

export const IDLE_LOCK_MS = IDLE_LOCK_MINUTES * 60 * 1000;
export const IDLE_WARNING_MS = IDLE_WARNING_SECONDS * 1000;
