// Employee dossier (4.2c): pure validation of qualification, past-employment
// and attachment rows, unit-tested in tests/employee-dossier.test.ts. Errors
// are keyed like the documents list: qualifications.<row>.<field>.

import { ATTACHMENT_KINDS, DOSSIER_LIMITS, QUALIFICATION_LEVELS, type AttachmentInput, type EmployeeDossierInput, type QualificationInput, type WorkHistoryInput } from '@/lib/types/employee-dossier';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const file = (v: unknown) => {
  const f = v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  return f && typeof f.id === 'string' && typeof f.name === 'string' ? { id: f.id, name: String(f.name).slice(0, 150), size: Number(f.size) || 0, mime: String(f.mime ?? '') } : null;
};
const rows = (v: unknown) => (Array.isArray(v) ? v : []).map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>) : {}));

export function normalizeDossier(raw: unknown): EmployeeDossierInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    qualifications: rows(r.qualifications)
      .slice(0, DOSSIER_LIMITS.qualifications)
      .map(
        (q): QualificationInput => ({
          id: typeof q.id === 'string' ? q.id : undefined,
          level: QUALIFICATION_LEVELS.some((l) => l.code === q.level) ? (q.level as QualificationInput['level']) : '',
          degree: s(q.degree, 120),
          institution: s(q.institution, 200),
          board: s(q.board, 200),
          passedYear: s(q.passedYear, 10),
          division: s(q.division, 40),
          major: s(q.major, 120),
          file: file(q.file),
        }),
      ),
    workHistory: rows(r.workHistory)
      .slice(0, DOSSIER_LIMITS.workHistory)
      .map(
        (w): WorkHistoryInput => ({
          id: typeof w.id === 'string' ? w.id : undefined,
          organisation: s(w.organisation, 200),
          designation: s(w.designation, 120),
          fromAd: s(w.fromAd, 10),
          toAd: s(w.toAd, 10),
          duties: s(w.duties, 1000),
          reference: s(w.reference, 200),
          file: file(w.file),
        }),
      ),
    attachments: rows(r.attachments)
      .slice(0, DOSSIER_LIMITS.attachments)
      .map(
        (a): AttachmentInput => ({
          id: typeof a.id === 'string' ? a.id : undefined,
          kind: ATTACHMENT_KINDS.some((k) => k.code === a.kind) ? (a.kind as AttachmentInput['kind']) : '',
          title: s(a.title, 150),
          note: s(a.note, 500),
          file: file(a.file),
        }),
      ),
  };
}

/** Row errors keyed <list>.<row>.<field>; a qualification needs a level and a degree, a job its organisation, designation and start, an attachment its kind, title and file. */
export function validateDossier(d: EmployeeDossierInput, options: { today: string; joiningDate?: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  d.qualifications.forEach((q, i) => {
    const k = (f: string) => `qualifications.${i}.${f}`;
    if (!q.level) errors[k('level')] = 'Choose the level.';
    if (q.degree.length < 2) errors[k('degree')] = 'Name the degree or certificate.';
    if (q.passedYear && !/^\d{4}$/.test(q.passedYear)) errors[k('passedYear')] = 'A four-digit year (BS or AD).';
  });
  const seenJobs = new Set<string>();
  d.workHistory.forEach((w, i) => {
    const k = (f: string) => `workHistory.${i}.${f}`;
    if (w.organisation.length < 2) errors[k('organisation')] = 'Name the organisation.';
    if (w.designation.length < 2) errors[k('designation')] = 'The position held.';
    if (!ISO.test(w.fromAd)) errors[k('fromAd')] = 'Choose the start date.';
    if (w.toAd && !ISO.test(w.toAd)) errors[k('toAd')] = 'A date, or leave it empty.';
    if (ISO.test(w.fromAd) && ISO.test(w.toAd) && w.toAd < w.fromAd) errors[k('toAd')] = 'Ends before it starts.';
    if (ISO.test(w.fromAd) && w.fromAd > options.today) errors[k('fromAd')] = 'Past employment only.';
    if (ISO.test(w.toAd) && options.joiningDate && ISO.test(options.joiningDate) && w.toAd > options.joiningDate) errors[k('toAd')] = 'Past employment ends before joining here.';
    const key = `${w.organisation.toLowerCase()}|${w.fromAd}`;
    if (seenJobs.has(key)) errors[k('organisation')] = 'Listed twice.';
    seenJobs.add(key);
  });
  d.attachments.forEach((a, i) => {
    const k = (f: string) => `attachments.${i}.${f}`;
    if (!a.kind) errors[k('kind')] = 'Choose the kind.';
    if (a.title.length < 2) errors[k('title')] = 'Give it a title.';
    if (!a.file) errors[k('file')] = 'Attach the file.';
  });
  return errors;
}

/** True when any row (or any row's file) differs — for the audit history and the dirty check. */
export function dossierChanged(a: EmployeeDossierInput, b: EmployeeDossierInput): boolean {
  const strip = (d: EmployeeDossierInput) => JSON.stringify({ q: d.qualifications.map((r) => ({ ...r, file: r.file?.id ?? null })), w: d.workHistory.map((r) => ({ ...r, file: r.file?.id ?? null })), a: d.attachments.map((r) => ({ ...r, file: r.file?.id ?? null })) });
  return strip(a) !== strip(b);
}

/** Every file id a dossier references (to keep when saving, to link on insert). */
export function dossierFileIds(d: EmployeeDossierInput): string[] {
  return [...d.qualifications, ...d.workHistory, ...d.attachments].flatMap((r) => (r.file ? [r.file.id] : []));
}
