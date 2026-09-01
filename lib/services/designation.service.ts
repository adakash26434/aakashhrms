import * as repository from "@/lib/repositories/designation.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import {
  sortByDepartmentAndName,
  validateDesignation,
  type DesignationValidationErrors,
} from "@/lib/engines/designation.engine";
import type {
  Designation,
  DesignationData,
  DesignationFormData,
} from "@/lib/types/designation";

export class DesignationValidationError extends Error {
  constructor(public errors: DesignationValidationErrors) {
    super("Designation validation failed");
    this.name = "DesignationValidationError";
  }
}

export class DesignationNotFoundError extends Error {
  constructor(public id: string) {
    super(`Designation ${id} not found`);
    this.name = "DesignationNotFoundError";
  }
}

export class DesignationInUseError extends Error {
  constructor(public id: string) {
    super(`Designation ${id} is in use and cannot be deleted`);
    this.name = "DesignationInUseError";
  }
}

export async function getDesignationData(): Promise<DesignationData> {
  const [designations, departments] = await Promise.all([
    repository.findAllDesignations(),
    departmentRepository.findAllDepartments(),
  ]);
  const sorted = sortByDepartmentAndName(designations);
  return {
    designations: sorted,
    departments: departments,
  };
}

export async function createDesignation(
  data: DesignationFormData,
): Promise<Designation> {
  const existing = await repository.findAllDesignations();
  const allDepartments = await departmentRepository.findAllDepartments();
  const errors = validateDesignation({
    data,
    existing,
    validDepartmentIds: allDepartments.map((d) => d.id),
  });
  if (Object.keys(errors).length > 0) {
    throw new DesignationValidationError(errors);
  }
  return repository.createDesignation(data);
}

export async function updateDesignation(
  id: string,
  data: DesignationFormData,
): Promise<Designation> {
  const existingAll = await repository.findAllDesignations();
  const existing = existingAll.find((d) => d.id === id);
  if (!existing) {
    throw new DesignationNotFoundError(id);
  }

  const allDepartments = await departmentRepository.findAllDepartments();
  const errors = validateDesignation({
    data,
    existing: existingAll,
    excludeId: id,
    validDepartmentIds: allDepartments.map((d) => d.id),
  });
  if (Object.keys(errors).length > 0) {
    throw new DesignationValidationError(errors);
  }
  return repository.updateDesignation(id, data);
}

export async function deleteDesignation(id: string): Promise<void> {
  const existing = await repository.findDesignationById(id);
  if (!existing) {
    throw new DesignationNotFoundError(id);
  }
  if (existing.employeeCount > 0) {
    throw new DesignationInUseError(id);
  }
  return repository.deleteDesignation(id);
}