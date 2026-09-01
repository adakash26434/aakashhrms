import * as repository from "@/lib/repositories/system-control.repository";
import {
  validateSystemControl,
  type SystemControlValidationErrors,
} from "@/lib/engines/system-control.engine";
import type { SystemControlData } from "@/lib/types/system-control";
import { recordAuditLog } from "@/lib/services/audit.service";

/** Thrown when the engine rejects the payload. */
export class SystemControlValidationError extends Error {
  constructor(public errors: SystemControlValidationErrors) {
    super("System Control validation failed");
    this.name = "SystemControlValidationError";
  }
}

export async function getSystemControlData(): Promise<SystemControlData> {
  return repository.findSettings();
}

export async function saveSystemControlSettings(
  next: SystemControlData,
): Promise<SystemControlData> {
  const existing = await repository.findSettings();

  const errors = validateSystemControl(next);
  if (Object.keys(errors).length > 0) {
    throw new SystemControlValidationError(errors);
  }

  const updated = await repository.updateSettings(next);

  await recordAuditLog({
    action: "EDIT",
    module: "SYSTEM_CONTROL",
    recordId: "Global System Rules & Thresholds",
    oldValues: existing as unknown as Record<string, unknown>,
    newValues: updated as unknown as Record<string, unknown>,
  });

  return updated;
}
