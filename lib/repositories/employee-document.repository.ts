import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { employeeDocumentFiles, employeeDocuments } from "@/lib/db/schema";
import { UserFacingError } from "@/lib/errors/action-error";
import { DOCUMENT_SIDE, DOCUMENT_TYPE_LABEL, PRIMARY_DOCUMENT_TYPES, type DocumentFileRef, type DocumentType, type EmployeeDocument, type EmployeeDocumentInput } from "@/lib/types/employee-document";

export type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

/** How long an upload waits for its form to be saved. */
export const STAGED_FILE_HOURS = 24;
export const stagedSince = () => new Date(Date.now() - STAGED_FILE_HOURS * 3600_000);

/** File columns without the content: what lists, forms and checks read (S25). */
const FILE_META = {
  id: employeeDocumentFiles.id,
  documentId: employeeDocumentFiles.documentId,
  attachedTo: employeeDocumentFiles.attachedTo,
  employeeId: employeeDocumentFiles.employeeId,
  side: employeeDocumentFiles.side,
  fileName: employeeDocumentFiles.fileName,
  mimeType: employeeDocumentFiles.mimeType,
  sizeBytes: employeeDocumentFiles.sizeBytes,
  uploadedBy: employeeDocumentFiles.uploadedBy,
  uploadedAt: employeeDocumentFiles.uploadedAt,
};

export type DocumentFileMeta = { id: string; documentId: string | null; attachedTo: string | null; employeeId: string | null; side: string; fileName: string; mimeType: string; sizeBytes: number; uploadedBy: string; uploadedAt: Date };

const toRef = (f: Pick<DocumentFileMeta, "id" | "fileName" | "sizeBytes" | "mimeType">): DocumentFileRef => ({
  id: f.id,
  name: f.fileName,
  size: f.sizeBytes,
  mime: f.mimeType,
});

const TYPE_ORDER: Record<string, number> = { citizenship: 0, nid: 1, passport: 2, driving_licence: 3, voter_id: 4 };

/** One employee's documents with their scan (name and size only). */
export async function findDocuments(employeeId: string): Promise<EmployeeDocument[]> {
  const db = await getDb();
  const docs = await db.select().from(employeeDocuments).where(eq(employeeDocuments.employeeId, employeeId));
  if (docs.length === 0) return [];
  const files = await db
    .select(FILE_META)
    .from(employeeDocumentFiles)
    .where(and(inArray(employeeDocumentFiles.documentId, docs.map((d) => d.id)), eq(employeeDocumentFiles.side, DOCUMENT_SIDE)));
  return docs
    .map((d) => {
      const file = files.find((f) => f.documentId === d.id);
      return {
        id: d.id,
        type: d.docType as DocumentType,
        number: d.docNumber,
        district: d.issuedDistrict,
        office: d.issuingOffice ?? "",
        issuedDate: d.issuedDate ?? null,
        file: file ? toRef(file) : null,
      };
    })
    .sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));
}

/** Employees with a Citizenship / NID that has its issued date and a scan (the rest show under Records to fix). */
export async function employeesWithIdentityScan(): Promise<Set<string>> {
  const rows = await (await getDb())
    .selectDistinct({ employeeId: employeeDocuments.employeeId })
    .from(employeeDocuments)
    .where(
      and(
        inArray(employeeDocuments.docType, [...PRIMARY_DOCUMENT_TYPES]),
        isNotNull(employeeDocuments.issuedDate),
        sql`EXISTS (SELECT 1 FROM ${employeeDocumentFiles} f WHERE f."document_id" = ${employeeDocuments.id})`
      )
    );
  return new Set(rows.map((r) => r.employeeId));
}

// ---------------------------------------------------------------------------
// Uploads (not yet saved with an employee)
// ---------------------------------------------------------------------------

export async function countStagedBy(userId: string): Promise<number> {
  const [row] = await (await getDb())
    .select({ n: sql<number>`count(*)::int` })
    .from(employeeDocumentFiles)
    .where(and(isNull(employeeDocumentFiles.documentId), isNull(employeeDocumentFiles.attachedTo), eq(employeeDocumentFiles.uploadedBy, userId), gt(employeeDocumentFiles.uploadedAt, stagedSince())));
  return Number(row?.n ?? 0);
}

/** Uploads never saved with a form are removed after a day. */
export async function pruneStaged(): Promise<void> {
  await (await getDb()).delete(employeeDocumentFiles).where(and(isNull(employeeDocumentFiles.documentId), isNull(employeeDocumentFiles.attachedTo), lt(employeeDocumentFiles.uploadedAt, stagedSince())));
}

export async function insertStagedFile(file: {
  employeeId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  content: Buffer;
  uploadedBy: string;
}): Promise<DocumentFileRef> {
  const id = randomUUID();
  await (await getDb()).insert(employeeDocumentFiles).values({ id, documentId: null, side: DOCUMENT_SIDE, ...file });
  return { id, name: file.fileName, size: file.sizeBytes, mime: file.mimeType };
}

/** Removes an upload that is not saved yet, only by the person who uploaded it. */
export async function deleteStagedFile(id: string, userId: string): Promise<boolean> {
  const rows = await (await getDb())
    .delete(employeeDocumentFiles)
    .where(and(eq(employeeDocumentFiles.id, id), isNull(employeeDocumentFiles.documentId), isNull(employeeDocumentFiles.attachedTo), eq(employeeDocumentFiles.uploadedBy, userId)))
    .returning({ id: employeeDocumentFiles.id });
  return rows.length > 0;
}

export async function findFileMeta(id: string): Promise<DocumentFileMeta | undefined> {
  const [row] = await (await getDb()).select(FILE_META).from(employeeDocumentFiles).where(eq(employeeDocumentFiles.id, id)).limit(1);
  return row;
}

/** The only query that reads a scan's bytes (the download). */
export async function findFileContent(id: string): Promise<Buffer | undefined> {
  const [row] = await (await getDb()).select({ content: employeeDocumentFiles.content }).from(employeeDocumentFiles).where(eq(employeeDocumentFiles.id, id)).limit(1);
  return row?.content;
}

// ---------------------------------------------------------------------------
// Saving with the employee (inside employee.repository's transaction)
// ---------------------------------------------------------------------------

/**
 * Makes the employee's documents match the form: removed documents go (their scans with
 * them), the rest are updated or added. A scan removed or replaced is deleted; a new one is
 * attached only when it is this user's own upload from the last day, not yet saved and not
 * uploaded for another employee. Anything else stops the whole save.
 */
export async function saveDocumentsTx(tx: Tx, employeeId: string, rows: readonly EmployeeDocumentInput[], userId: string): Promise<void> {
  const existing = await tx.select({ id: employeeDocuments.id }).from(employeeDocuments).where(eq(employeeDocuments.employeeId, employeeId));
  const existingIds = new Set(existing.map((d) => d.id));
  const keep = rows.filter((r) => r.id && existingIds.has(r.id)).map((r) => r.id as string);
  const gone = [...existingIds].filter((id) => !keep.includes(id));
  if (gone.length > 0) await tx.delete(employeeDocuments).where(and(eq(employeeDocuments.employeeId, employeeId), inArray(employeeDocuments.id, gone)));

  // Scans this employee has now that the form no longer lists (removed or replaced).
  const wanted = new Set(rows.flatMap((r) => (r.file ? [r.file.id] : [])));
  const attached = await tx.select({ id: employeeDocumentFiles.id }).from(employeeDocumentFiles).where(and(eq(employeeDocumentFiles.employeeId, employeeId), isNotNull(employeeDocumentFiles.documentId)));
  const attachedIds = new Set(attached.map((f) => f.id));
  const dropped = [...attachedIds].filter((id) => !wanted.has(id));
  if (dropped.length > 0) await tx.delete(employeeDocumentFiles).where(and(eq(employeeDocumentFiles.employeeId, employeeId), inArray(employeeDocumentFiles.id, dropped)));

  for (const r of rows) {
    const values = {
      docType: r.type,
      docNumber: r.number.trim(),
      issuedDistrict: r.district.trim(),
      issuingOffice: r.office.trim(),
      issuedDate: r.issuedDate || null,
      updatedBy: userId,
      updatedAt: new Date(),
    };
    let documentId: string;
    if (r.id && existingIds.has(r.id)) {
      documentId = r.id;
      await tx.update(employeeDocuments).set(values).where(and(eq(employeeDocuments.id, documentId), eq(employeeDocuments.employeeId, employeeId)));
    } else {
      documentId = randomUUID();
      await tx.insert(employeeDocuments).values({ id: documentId, employeeId, ...values, createdBy: userId });
    }

    const f = r.file;
    if (!f) continue;
    if (attachedIds.has(f.id)) {
      await tx
        .update(employeeDocumentFiles)
        .set({ documentId, side: DOCUMENT_SIDE })
        .where(and(eq(employeeDocumentFiles.id, f.id), eq(employeeDocumentFiles.employeeId, employeeId)));
      continue;
    }
    const claimed = await tx
      .update(employeeDocumentFiles)
      .set({ documentId, employeeId, side: DOCUMENT_SIDE })
      .where(
        and(
          eq(employeeDocumentFiles.id, f.id),
          isNull(employeeDocumentFiles.documentId),
          eq(employeeDocumentFiles.uploadedBy, userId),
          gt(employeeDocumentFiles.uploadedAt, stagedSince()),
          or(isNull(employeeDocumentFiles.employeeId), eq(employeeDocumentFiles.employeeId, employeeId))
        )
      )
      .returning({ id: employeeDocumentFiles.id });
    if (claimed.length === 0) {
      throw new UserFacingError(`The scan for ${r.type ? DOCUMENT_TYPE_LABEL[r.type] : "a document"} has expired or can't be used. Upload it again and save.`);
    }
  }
}
