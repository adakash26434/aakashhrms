import { randomUUID } from "node:crypto";

// Security plan S9: server actions must not return raw error messages (they
// can carry SQL, constraint names or stack details). Expected, user-facing
// errors are thrown as UserFacingError and pass through unchanged; anything
// else becomes a generic message with a short reference that is logged on the
// server, so support can find the real cause. Modules adopt this in Phase 4.

/** An error whose message is safe and useful to show to the user. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export interface ActionFailure {
  success: false;
  error: string;
  /** Present for unexpected errors; quote it to support. */
  ref?: string;
}

/**
 * Messages from existing guards that are already written for users. Kept as
 * a narrow allow-list until every module throws UserFacingError.
 */
const SAFE_PREFIXES = ["Unauthorized:", "Forbidden:", "Validation:", "Not found:"];

export function isUserFacing(error: unknown): error is Error {
  if (error instanceof UserFacingError) return true;
  return error instanceof Error && SAFE_PREFIXES.some((p) => error.message.startsWith(p));
}

export function toActionError(
  error: unknown,
  context: string,
  log: (message: string, meta: Record<string, unknown>) => void = (m, meta) => console.error(m, meta)
): ActionFailure {
  if (isUserFacing(error)) {
    return { success: false, error: error.message };
  }
  const ref = randomUUID().slice(0, 8).toUpperCase();
  // The cause goes in the log line too (server log only), since some log sinks drop the object.
  const cause = error instanceof Error ? `${error.name}: ${error.message.slice(0, 300)}` : String(error).slice(0, 300);
  log(`[${context}] unexpected error (ref ${ref}): ${cause}`, {
    ref,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
  });
  return { success: false, error: `Something went wrong. Please try again or contact support (ref ${ref}).`, ref };
}
