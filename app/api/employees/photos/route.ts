import { NextResponse } from "next/server";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { toActionError } from "@/lib/errors/action-error";
import { uploadPhoto } from "@/lib/services/employee-photo.service";
import { PHOTO_MAX_BYTES } from "@/lib/types/employee-document";

// Room for the multipart boundaries around a 1 MB photo.
const MAX_BODY = PHOTO_MAX_BYTES + 16 * 1024;

/**
 * Upload an employee photo (S25), already cropped to 512 x 512 in the browser, for a form not
 * saved yet. Checks, in order: same origin, a declared body size within the limit (before
 * anything is read), the permission (Edit for an existing employee, in scope; Add for a new
 * one); the service then checks the content.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers)) {
    return NextResponse.json({ success: false, error: "Refused." }, { status: 403 });
  }
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) {
    return NextResponse.json({ success: false, error: "The upload has no size." }, { status: 411 });
  }
  if (length > MAX_BODY) {
    return NextResponse.json({ success: false, error: "The photo is larger than 1 MB." }, { status: 413 });
  }

  await ensureTenantContext();
  try {
    const employeeId = new URL(request.url).searchParams.get("employee") || null;
    const scope = await checkPermissionWithScope(employeeId ? "EDIT" : "ADD", "EMPLOYEES");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Choose a photo." }, { status: 400 });
    }
    const result = await uploadPhoto({ bytes: new Uint8Array(await file.arrayBuffer()), employeeId }, scope);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const failure = toActionError(error, "employee-photo.upload");
    const status = failure.ref ? 500 : /^(Unauthorized|Forbidden):/.test(failure.error) ? 403 : 400;
    return NextResponse.json(failure, { status });
  }
}
