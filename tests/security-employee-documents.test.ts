import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isSameOriginRequest } from '../lib/security/same-origin';

// S25 Employee document files (4.2b): scans of citizenship / NID / passport are among
// the most sensitive things the system keeps. Uploads and downloads go through route
// handlers (files can't ride in a server action), so each check a server action gets
// for free is made here by hand, and these tests keep it that way.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const upload = read('app/api/employees/documents/files/route.ts');
const file = read('app/api/employees/documents/files/[id]/route.ts');
const service = read('lib/services/employee-document.service.ts');
const repo = read('lib/repositories/employee-document.repository.ts');
const photoUpload = read('app/api/employees/photos/route.ts');
const photoFile = read('app/api/employees/photos/[id]/route.ts');
const photoService = read('lib/services/employee-photo.service.ts');
const photoRepo = read('lib/repositories/employee-photo.repository.ts');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S25 employee document files', () => {
  it('checks the origin and the declared size before reading the upload, then the permission', () => {
    const post = body(upload, 'export async function POST(');
    const origin = post.indexOf('isSameOriginRequest(request.headers)');
    const size = post.indexOf('content-length');
    const permission = post.indexOf('checkPermissionWithScope(employeeId ? "EDIT" : "ADD", "EMPLOYEES")');
    const read = post.indexOf('request.formData()');
    assert.ok(origin >= 0 && size > origin && permission > size && read > permission, 'order: origin, size, permission, body');
    assert.match(post, /length > MAX_BODY/);
  });

  it('refuses cross-site requests', () => {
    const h = (o: Record<string, string>) => new Headers(o);
    assert.equal(isSameOriginRequest(h({ origin: 'https://hr.example.com', host: 'hr.example.com', 'sec-fetch-site': 'same-origin' })), true);
    assert.equal(isSameOriginRequest(h({ origin: 'https://hr.example.com', host: 'localhost:3000', 'x-forwarded-host': 'hr.example.com' })), true);
    assert.equal(isSameOriginRequest(h({ origin: 'https://evil.example', host: 'hr.example.com' })), false);
    assert.equal(isSameOriginRequest(h({ origin: 'https://hr.example.com', host: 'hr.example.com', 'sec-fetch-site': 'cross-site' })), false);
    assert.equal(isSameOriginRequest(h({ host: 'hr.example.com' })), false);
    assert.equal(isSameOriginRequest(h({ origin: 'null', host: 'hr.example.com' })), false);
  });

  it('checks permission and scope for every file, and an unsaved upload is its uploader\'s only', () => {
    assert.match(body(file, 'export async function GET('), /checkPermissionWithScope\("VIEW", "EMPLOYEES"\)/);
    assert.match(body(file, 'export async function DELETE('), /isSameOriginRequest\(request\.headers\)/);
    const open = body(service, 'export async function openScan(');
    assert.match(open, /isUuid\(fileId\)/);
    assert.match(open, /meta\.documentId === null[\s\S]*meta\.uploadedBy !== scope\.userId[\s\S]*return null/);
    assert.match(open, /getEmployeeInScope\(meta\.employeeId, scope, "VIEW"\)/);
    const up = body(service, 'export async function uploadScan(');
    assert.match(up, /getEmployeeInScope\(input\.employeeId, scope, "EDIT"\)/);
    assert.match(up, /sniffFileType\(input\.bytes\)/);
    assert.match(up, /DOCUMENT_MAX_BYTES/);
    assert.match(up, /MAX_STAGED_PER_USER/);
  });

  it('sends a scan only as a download of its real type, never cached', () => {
    const get = body(file, 'export async function GET(');
    assert.match(get, /"Content-Disposition": `attachment;/);
    assert.match(get, /"Content-Type": scan\.mime/);
    assert.match(get, /"X-Content-Type-Options": "nosniff"/);
    assert.match(get, /"Cache-Control": "private, no-store"/);
  });

  it('attaches only the saver\'s own recent, unsaved uploads, never another employee\'s', () => {
    const save = body(repo, 'export async function saveDocumentsTx(');
    for (const condition of [
      'isNull(employeeDocumentFiles.documentId)',
      'eq(employeeDocumentFiles.uploadedBy, userId)',
      'gt(employeeDocumentFiles.uploadedAt, stagedSince())',
      'or(isNull(employeeDocumentFiles.employeeId), eq(employeeDocumentFiles.employeeId, employeeId))',
    ]) {
      assert.ok(save.includes(condition), condition);
    }
    assert.match(save, /claimed\.length === 0\)[\s\S]*throw new UserFacingError/);
    // Removing scans only ever touches this employee's own files.
    assert.match(save, /delete\(employeeDocumentFiles\)\.where\(and\(eq\(employeeDocumentFiles\.employeeId, employeeId\)/);
  });

  it('reads the bytes in one place only (the download), never in lists', () => {
    const libFiles: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const p = join(dir, name);
        if (statSync(join(root, p)).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(name)) libFiles.push(p);
      }
    };
    walk('lib');
    walk('app');
    walk('components');
    const readers = libFiles.filter((p) => read(p).includes('employeeDocumentFiles.content'));
    assert.deepEqual(readers.map((p) => p.replace(/\\/g, '/')), ['lib/repositories/employee-document.repository.ts']);
    assert.equal((repo.match(/employeeDocumentFiles\.content/g) ?? []).length, 1);
    assert.match(body(repo, 'export async function findFileContent('), /employeeDocumentFiles\.content/);
    assert.ok(!/select\(\)\s*\.from\(employeeDocumentFiles\)/.test(repo), 'no select() of every file column');
  });

  it('audits uploads and views with ids and sizes only, never the content', () => {
    for (const fn of ['export async function uploadScan(', 'export async function openScan(']) {
      const audit = body(service, fn).match(/recordAuditLog\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
      assert.ok(audit, fn);
      assert.ok(!/content|bytes|number/.test(audit.replace(/sizeBytes/g, '')), audit);
    }
  });

  it('photos: origin and size before the body, then the permission; JPEG or PNG only', () => {
    const post = body(photoUpload, 'export async function POST(');
    const origin = post.indexOf('isSameOriginRequest(request.headers)');
    const size = post.indexOf('content-length');
    const permission = post.indexOf('checkPermissionWithScope(employeeId ? "EDIT" : "ADD", "EMPLOYEES")');
    const read = post.indexOf('request.formData()');
    assert.ok(origin >= 0 && size > origin && permission > size && read > permission, 'order: origin, size, permission, body');
    const up = body(photoService, 'export async function uploadPhoto(');
    assert.match(up, /getEmployeeInScope\(input\.employeeId, scope, "EDIT"\)/);
    assert.match(up, /mime !== "image\/jpeg" && mime !== "image\/png"/);
    assert.match(up, /PHOTO_MAX_BYTES/);
  });

  it('photos: shown only within scope, to the employee themself, or (unsaved) to the uploader; inline image with nosniff', () => {
    const open = body(photoService, 'export async function openPhoto(');
    assert.match(open, /meta\.employeeId === null[\s\S]*meta\.uploadedBy !== userId[\s\S]*return null/);
    assert.match(open, /viewer\.kind === "self"[\s\S]*meta\.employeeId !== viewer\.employeeId[\s\S]*return null/);
    assert.match(open, /getEmployeeInScope\(meta\.employeeId, viewer\.scope, "VIEW"\)/);
    const get = body(photoFile, 'export async function GET(');
    assert.match(get, /"Content-Type": photo\.mime/);
    assert.match(get, /"X-Content-Type-Options": "nosniff"/);
    assert.match(get, /"Cache-Control": "private, max-age=86400"/);
    // The employee for "self" comes from the session, never from the request.
    assert.match(photoFile, /getSessionEmployeeId\(\)/);
    assert.match(body(photoFile, 'export async function DELETE('), /isSameOriginRequest\(request\.headers\)/);
  });

  it("photos: a save attaches only the saver's own recent unsaved upload; bytes read in one place", () => {
    const save = body(photoRepo, 'export async function savePhotoTx(');
    for (const condition of ['isNull(employeePhotos.employeeId)', 'eq(employeePhotos.uploadedBy, userId)', 'gt(employeePhotos.uploadedAt, stagedSince())']) {
      assert.ok(save.includes(condition), condition);
    }
    assert.match(save, /claimed\.length === 0\) throw new UserFacingError/);
    assert.equal((photoRepo.match(/employeePhotos\.content/g) ?? []).length, 1);
    assert.match(body(photoRepo, 'export async function findPhotoContent('), /employeePhotos\.content/);
  });
});
