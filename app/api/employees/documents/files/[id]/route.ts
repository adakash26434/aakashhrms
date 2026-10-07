import { NextResponse } from "next/server";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { toActionError } from "@/lib/errors/action-error";
import { discardScan, openScan } from "@/lib/services/employee-document.service";

const NOT_FOUND = () => NextResponse.json({ success: false, error: "Not found." }, { status: 404 });

/**
 * One scan's file (S25): View on Employees, the employee in the user's scope (an
 * unsaved upload: only its uploader). Always sent as a download with the type
 * found in its content, never shown as a page on this site; never cached.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
    const { id } = await params;
    const scan = await openScan(id, scope);
    if (!scan) return NOT_FOUND();
    const ascii = scan.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return new NextResponse(new Uint8Array(scan.content), {
      status: 200,
      headers: {
        "Content-Type": scan.mime,
        "Content-Length": String(scan.content.length),
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(scan.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const failure = toActionError(error, "employee-document.open");
    return NextResponse.json(failure, { status: failure.ref ? 500 : 403 });
  }
}

/** Removes an upload that was never saved with a form (only the person who uploaded it). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request.headers)) {
    return NextResponse.json({ success: false, error: "Refused." }, { status: 403 });
  }
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
    const { id } = await params;
    return (await discardScan(id, scope)) ? NextResponse.json({ success: true }) : NOT_FOUND();
  } catch (error) {
    const failure = toActionError(error, "employee-document.discard");
    return NextResponse.json(failure, { status: failure.ref ? 500 : 403 });
  }
}
