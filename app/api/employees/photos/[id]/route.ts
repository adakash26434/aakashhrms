import { NextResponse } from "next/server";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { toActionError } from "@/lib/errors/action-error";
import { discardPhoto, openPhoto, type PhotoViewer } from "@/lib/services/employee-photo.service";
import { getSessionEmployeeId } from "@/lib/services/self-service.service";

const NOT_FOUND = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });

/** Employees → View with its scope, else the signed-in employee (own photo only), else nobody. */
async function viewers(): Promise<PhotoViewer[]> {
  const list: PhotoViewer[] = [];
  try {
    list.push({ kind: "scope", scope: await checkPermissionWithScope("VIEW", "EMPLOYEES") });
  } catch {
    // No Employees view: maybe an employee looking at their own photo in self-service.
  }
  try {
    const self = await getSessionEmployeeId();
    list.push({ kind: "self", userId: self.userId, employeeId: self.employeeId });
  } catch {
    // Not linked to an employee.
  }
  return list;
}

/**
 * One employee photo (S25), for <img>: shown inline because it is only ever a JPEG or PNG
 * (by content) sent with nosniff. A new photo gets a new id, so it can be cached privately.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureTenantContext();
  try {
    const { id } = await params;
    for (const viewer of await viewers()) {
      const photo = await openPhoto(id, viewer);
      if (!photo) continue;
      return new NextResponse(new Uint8Array(photo.content), {
        status: 200,
        headers: {
          "Content-Type": photo.mime,
          "Content-Length": String(photo.content.length),
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=86400",
        },
      });
    }
    return NOT_FOUND();
  } catch (error) {
    toActionError(error, "employee-photo.open");
    return NOT_FOUND();
  }
}

/** Removes a photo upload that was never saved with a form (only the person who uploaded it). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request.headers)) {
    return NextResponse.json({ success: false, error: "Refused." }, { status: 403 });
  }
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
    const { id } = await params;
    return (await discardPhoto(id, scope.userId)) ? NextResponse.json({ success: true }) : NOT_FOUND();
  } catch (error) {
    const failure = toActionError(error, "employee-photo.discard");
    return NextResponse.json(failure, { status: failure.ref ? 500 : 403 });
  }
}
