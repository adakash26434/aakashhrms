/**
 * Branch service — business orchestration layer.
 */

import * as repository from "@/lib/repositories/branch.repository";
import {
  sortBranchesByName,
  validateBranch,
  type BranchValidationErrors,
} from "@/lib/engines/branch.engine";
import type { Branch, BranchFormData } from "@/lib/types/branch";
import type { BranchWriteInput } from "@/lib/data/mock-branches";

export class BranchValidationError extends Error {
  constructor(public errors: BranchValidationErrors) {
    super("Branch validation failed");
    this.name = "BranchValidationError";
  }
}

export class BranchNotFoundError extends Error {
  constructor(public id: string) {
    super(`Branch ${id} not found`);
    this.name = "BranchNotFoundError";
  }
}

export async function getBranchData(): Promise<Branch[]> {
  const branches = await repository.findAllBranches();
  return sortBranchesByName(branches);
}

function toWriteInput(data: BranchFormData): BranchWriteInput {
  return {
    code: data.code,
    name: data.name,
    location: data.location,
    phone: data.phone,
    email: data.email,
    status: data.status,
  };
}

export async function createBranch(
  data: BranchFormData,
): Promise<Branch> {
  const existing = await repository.findAllBranches();
  const errors = validateBranch({ data, existing });
  if (Object.keys(errors).length > 0) {
    throw new BranchValidationError(errors);
  }
  return repository.createBranch(toWriteInput(data));
}

export async function updateBranch(
  id: string,
  data: BranchFormData,
): Promise<Branch> {
  const existingAll = await repository.findAllBranches();
  const existing = existingAll.find((b) => b.id === id);
  if (!existing) {
    throw new BranchNotFoundError(id);
  }
  const errors = validateBranch({ data, existing: existingAll, excludeId: id });
  if (Object.keys(errors).length > 0) {
    throw new BranchValidationError(errors);
  }
  return repository.updateBranch(id, toWriteInput(data));
}

export async function deleteBranch(id: string): Promise<void> {
  const existing = await repository.findBranchById(id);
  if (!existing) {
    throw new BranchNotFoundError(id);
  }
  return repository.deleteBranch(id);
}