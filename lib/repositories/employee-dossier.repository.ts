import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { employeeAttachments, employeeDocumentFiles, employeeQualifications, employeeWorkHistory } from '@/lib/db/schema';
import { UserFacingError } from '@/lib/errors/action-error';
import type { AttachmentInput, EmployeeDossierInput, QualificationInput, WorkHistoryInput } from '@/lib/types/employee-dossier';
import type { DocumentFileRef } from '@/lib/types/employee-document';
import { dossierFileIds } from '@/lib/engines/employee-dossier.engine';

// Employee dossier (4.2c): Drizzle queries only. Rows are saved with the
// employee inside its transaction (saveDossierTx); a row's scan is claimed
// from the staged uploads exactly like an identity document's (uploader,
// within a day, not yet owned), and marked attached_to so it is never pruned.

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>['transaction']>[0]>[0];
const DAY_MS = 24 * 60 * 60 * 1000;
const stagedSince = () => new Date(Date.now() - DAY_MS);

const FILE_REF = { id: employeeDocumentFiles.id, name: employeeDocumentFiles.fileName, size: employeeDocumentFiles.sizeBytes, mime: employeeDocumentFiles.mimeType };

async function fileRefs(ids: string[]): Promise<Map<string, DocumentFileRef>> {
  if (!ids.length) return new Map();
  const db = await getDb();
  const rows = await db.select(FILE_REF).from(employeeDocumentFiles).where(inArray(employeeDocumentFiles.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function findDossier(employeeId: string): Promise<EmployeeDossierInput> {
  const db = await getDb();
  const [q, w, a] = await Promise.all([
    db.select().from(employeeQualifications).where(eq(employeeQualifications.employeeId, employeeId)).orderBy(asc(employeeQualifications.sortOrder), asc(employeeQualifications.createdAt)),
    db.select().from(employeeWorkHistory).where(eq(employeeWorkHistory.employeeId, employeeId)).orderBy(asc(employeeWorkHistory.fromAd)),
    db.select().from(employeeAttachments).where(eq(employeeAttachments.employeeId, employeeId)).orderBy(asc(employeeAttachments.sortOrder), asc(employeeAttachments.createdAt)),
  ]);
  const refs = await fileRefs([...q, ...w, ...a].flatMap((r) => (r.fileId ? [r.fileId] : [])));
  const ref = (id: string | null) => (id ? refs.get(id) ?? null : null);
  return {
    qualifications: q.map((r): QualificationInput => ({ id: r.id, level: r.level as QualificationInput['level'], degree: r.degree, institution: r.institution, board: r.board, passedYear: r.passedYear, division: r.division, major: r.major, file: ref(r.fileId) })),
    workHistory: w.map((r): WorkHistoryInput => ({ id: r.id, organisation: r.organisation, designation: r.designation, fromAd: r.fromAd, toAd: r.toAd ?? '', duties: r.duties ?? '', reference: r.reference, file: ref(r.fileId) })),
    attachments: a.map((r): AttachmentInput => ({ id: r.id, kind: r.kind as AttachmentInput['kind'], title: r.title, note: r.note ?? '', file: ref(r.fileId) })),
  };
}

/** Claims a staged upload for this employee, or confirms a file the employee already owns. Throws when it expired or belongs to someone else. */
async function claimFile(tx: Tx, employeeId: string, fileId: string, attachedTo: string, userId: string, what: string): Promise<void> {
  const owned = await tx
    .update(employeeDocumentFiles)
    .set({ attachedTo })
    .where(and(eq(employeeDocumentFiles.id, fileId), eq(employeeDocumentFiles.employeeId, employeeId), eq(employeeDocumentFiles.attachedTo, attachedTo)))
    .returning({ id: employeeDocumentFiles.id });
  if (owned.length) return;
  const claimed = await tx
    .update(employeeDocumentFiles)
    .set({ attachedTo, employeeId, side: 'scan' })
    .where(
      and(
        eq(employeeDocumentFiles.id, fileId),
        isNull(employeeDocumentFiles.documentId),
        isNull(employeeDocumentFiles.attachedTo),
        eq(employeeDocumentFiles.uploadedBy, userId),
        gt(employeeDocumentFiles.uploadedAt, stagedSince()),
        or(isNull(employeeDocumentFiles.employeeId), eq(employeeDocumentFiles.employeeId, employeeId)),
      ),
    )
    .returning({ id: employeeDocumentFiles.id });
  if (!claimed.length) throw new UserFacingError(`The file for ${what} has expired or can't be used. Upload it again and save.`);
}

/**
 * Replaces the employee's dossier with the form's rows: rows no longer listed
 * are deleted (with their scans), listed rows are updated or inserted, and
 * each row's scan is claimed. Called inside the employee transaction.
 */
export async function saveDossierTx(tx: Tx, employeeId: string, d: EmployeeDossierInput, userId: string): Promise<void> {
  const wanted = new Set(dossierFileIds(d));

  // Scans this employee's dossier owned that the form no longer lists.
  const owned = await tx.select({ id: employeeDocumentFiles.id }).from(employeeDocumentFiles).where(and(eq(employeeDocumentFiles.employeeId, employeeId), inArray(employeeDocumentFiles.attachedTo, ['qualification', 'work_history', 'attachment'])));
  const dropped = owned.map((f) => f.id).filter((id) => !wanted.has(id));
  if (dropped.length) await tx.delete(employeeDocumentFiles).where(and(eq(employeeDocumentFiles.employeeId, employeeId), inArray(employeeDocumentFiles.id, dropped)));

  // Qualifications
  const qExisting = new Set((await tx.select({ id: employeeQualifications.id }).from(employeeQualifications).where(eq(employeeQualifications.employeeId, employeeId))).map((r) => r.id));
  const qKeep = d.qualifications.filter((r) => r.id && qExisting.has(r.id)).map((r) => r.id as string);
  const qGone = [...qExisting].filter((id) => !qKeep.includes(id));
  if (qGone.length) await tx.delete(employeeQualifications).where(and(eq(employeeQualifications.employeeId, employeeId), inArray(employeeQualifications.id, qGone)));
  for (const [i, r] of d.qualifications.entries()) {
    if (r.file) await claimFile(tx, employeeId, r.file.id, 'qualification', userId, `the ${r.degree || 'qualification'} certificate`);
    const values = { level: r.level, degree: r.degree, institution: r.institution, board: r.board, passedYear: r.passedYear, division: r.division, major: r.major, fileId: r.file?.id ?? null, sortOrder: i, updatedBy: userId, updatedAt: new Date() };
    if (r.id && qExisting.has(r.id)) await tx.update(employeeQualifications).set(values).where(and(eq(employeeQualifications.id, r.id), eq(employeeQualifications.employeeId, employeeId)));
    else await tx.insert(employeeQualifications).values({ id: randomUUID(), employeeId, ...values, createdBy: userId });
  }

  // Past employment
  const wExisting = new Set((await tx.select({ id: employeeWorkHistory.id }).from(employeeWorkHistory).where(eq(employeeWorkHistory.employeeId, employeeId))).map((r) => r.id));
  const wKeep = d.workHistory.filter((r) => r.id && wExisting.has(r.id)).map((r) => r.id as string);
  const wGone = [...wExisting].filter((id) => !wKeep.includes(id));
  if (wGone.length) await tx.delete(employeeWorkHistory).where(and(eq(employeeWorkHistory.employeeId, employeeId), inArray(employeeWorkHistory.id, wGone)));
  for (const [i, r] of d.workHistory.entries()) {
    if (r.file) await claimFile(tx, employeeId, r.file.id, 'work_history', userId, `the ${r.organisation || 'past employment'} letter`);
    const values = { organisation: r.organisation, designation: r.designation, fromAd: r.fromAd, toAd: r.toAd || null, duties: r.duties || null, reference: r.reference, fileId: r.file?.id ?? null, sortOrder: i, updatedBy: userId, updatedAt: new Date() };
    if (r.id && wExisting.has(r.id)) await tx.update(employeeWorkHistory).set(values).where(and(eq(employeeWorkHistory.id, r.id), eq(employeeWorkHistory.employeeId, employeeId)));
    else await tx.insert(employeeWorkHistory).values({ id: randomUUID(), employeeId, ...values, createdBy: userId });
  }

  // Attachments (the file is required)
  const aExisting = new Set((await tx.select({ id: employeeAttachments.id }).from(employeeAttachments).where(eq(employeeAttachments.employeeId, employeeId))).map((r) => r.id));
  const aKeep = d.attachments.filter((r) => r.id && aExisting.has(r.id)).map((r) => r.id as string);
  const aGone = [...aExisting].filter((id) => !aKeep.includes(id));
  if (aGone.length) await tx.delete(employeeAttachments).where(and(eq(employeeAttachments.employeeId, employeeId), inArray(employeeAttachments.id, aGone)));
  for (const [i, r] of d.attachments.entries()) {
    if (!r.file) throw new UserFacingError(`Attach the file for ${r.title || 'the attachment'}.`);
    await claimFile(tx, employeeId, r.file.id, 'attachment', userId, r.title || 'the attachment');
    const values = { kind: r.kind, title: r.title, note: r.note || null, fileId: r.file.id, sortOrder: i, updatedBy: userId, updatedAt: new Date() };
    if (r.id && aExisting.has(r.id)) await tx.update(employeeAttachments).set(values).where(and(eq(employeeAttachments.id, r.id), eq(employeeAttachments.employeeId, employeeId)));
    else await tx.insert(employeeAttachments).values({ id: randomUUID(), employeeId, ...values, createdBy: userId });
  }
}
