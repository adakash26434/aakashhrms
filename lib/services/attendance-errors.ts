import { UserFacingError } from "@/lib/errors/action-error";

// Errors shared by the attendance and shift services; the actions audit
// OwnAttendanceError as DENIED_SELF and OutOfScopeError as DENIED_SCOPE.

export class AttendanceValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super("Check the highlighted fields.");
    this.name = "AttendanceValidationError";
  }
}

/** A refusal because the request is about the user's own attendance (the action audits DENIED_SELF). */
export class OwnAttendanceError extends UserFacingError {
  constructor(message = "You can't change or approve your own attendance. Ask someone else.") {
    super(message);
    this.name = "OwnAttendanceError";
  }
}

/** A request naming employees outside the user's scope (the action audits DENIED_SCOPE). */
export class OutOfScopeError extends UserFacingError {
  constructor() {
    super("Some employees are not in your branch / department. Refresh and try again.");
    this.name = "OutOfScopeError";
  }
}
