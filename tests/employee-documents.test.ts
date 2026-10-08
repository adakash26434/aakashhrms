import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableDocumentTypes,
  documentsChanged,
  fileProblem,
  lacksIdentityScan,
  legacyDocumentColumns,
  normalizeDocuments,
  photoUrl,
  safeFileName,
  sniffFileType,
  suggestedIssuingOffice,
  validateDocuments,
} from '../lib/engines/employee-document.engine';
import { changedEmployeeFields, missingRecords } from '../lib/engines/employee.engine';
import { payrollReadiness } from '../lib/engines/dashboard.engine';
import { validateDrivingLicenceNo } from '../lib/utils/nepal-docs';
import { fieldLabel, sectionOfField } from '../lib/constants/employee-form';
import type { EmployeeDocumentInput } from '../lib/types/employee-document';

const ctx = { dateOfBirth: '1995-04-14', today: '2026-10-06' };
const scan = (id = 'f-1') => ({ id, name: 'scan.jpg', size: 1000, mime: 'image/jpeg' });
const citizenship = (over: Partial<EmployeeDocumentInput> = {}): EmployeeDocumentInput => ({
  type: 'citizenship', number: '27-01-75-01234', district: 'Kathmandu', office: 'District Administration Office, Kathmandu', issuedDate: '2013-02-01', file: scan(), ...over,
});

describe('Employee documents: the list (4.2b)', () => {
  it('needs a citizenship certificate or a National ID', () => {
    assert.deepEqual(validateDocuments([citizenship()], ctx), {});
    assert.deepEqual(validateDocuments([citizenship({ type: 'nid', number: '1234567890' })], ctx), {});
    const passportOnly = validateDocuments([citizenship({ type: 'passport', number: 'PA1234567', file: null })], ctx);
    assert.match(passportOnly.documents ?? '', /citizenship certificate or a National ID/);
    assert.ok(validateDocuments([], ctx).documents);
  });

  it('lists each type once, and offers only the types still free', () => {
    const errors = validateDocuments([citizenship(), citizenship({ number: '11-22' })], ctx);
    assert.match(errors['documents.1.type'] ?? '', /already listed/);
    const rows = [citizenship(), citizenship({ type: 'passport', number: 'PA1234567' })];
    assert.deepEqual(availableDocumentTypes(rows, 1), ['nid', 'passport', 'driving_licence', 'voter_id']);
    assert.deepEqual(availableDocumentTypes(rows, -1), ['nid', 'driving_licence', 'voter_id']);
  });

  it('checks each number by its type, including driving licences', () => {
    assert.ok(validateDocuments([citizenship({ number: '!@#$' })], ctx)['documents.0.number']);
    assert.ok(validateDocuments([citizenship({ type: 'nid', number: '123' })], ctx)['documents.0.number']);
    assert.ok(validateDocuments([citizenship({ number: ' ' })], ctx)['documents.0.number']);
    assert.ok(validateDrivingLicenceNo('01-06-12345678').isValid);
    assert.ok(validateDrivingLicenceNo('123456').isValid);
    assert.ok(!validateDrivingLicenceNo('AB-123').isValid);
    assert.ok(!validateDrivingLicenceNo('12-34').isValid);
    const dl = [citizenship(), citizenship({ type: 'driving_licence', number: 'XYZ', file: null })];
    assert.ok(validateDocuments(dl, ctx)['documents.1.number']);
  });

  it('needs a district from the list of 77', () => {
    assert.match(validateDocuments([citizenship({ district: '' })], ctx)['documents.0.district'] ?? '', /issuing district/);
    assert.match(validateDocuments([citizenship({ district: 'Gotham' })], ctx)['documents.0.district'] ?? '', /from the list/);
  });

  it('needs the issued date on a new document; a saved one may still lack it', () => {
    assert.ok(validateDocuments([citizenship({ issuedDate: '' })], ctx)['documents.0.issuedDate']);
    assert.equal(validateDocuments([citizenship({ id: 'd1', issuedDate: '' })], ctx)['documents.0.issuedDate'], undefined);
    assert.match(validateDocuments([citizenship({ issuedDate: '2027-01-01' })], ctx)['documents.0.issuedDate'] ?? '', /future/);
    assert.match(validateDocuments([citizenship({ issuedDate: '1990-01-01' })], ctx)['documents.0.issuedDate'] ?? '', /date of birth/);
  });

  it('needs the issuing office on a new document, and pre-fills it from the type and district', () => {
    assert.match(validateDocuments([citizenship({ office: ' ' })], ctx)['documents.0.office'] ?? '', /issuing office/);
    assert.equal(validateDocuments([citizenship({ id: 'd1', office: '' })], ctx)['documents.0.office'], undefined);
    assert.ok(validateDocuments([citizenship({ office: 'x'.repeat(151) })], ctx)['documents.0.office']);
    assert.equal(suggestedIssuingOffice('citizenship', 'Kaski'), 'District Administration Office, Kaski');
    assert.equal(suggestedIssuingOffice('citizenship', ''), 'District Administration Office');
    assert.equal(suggestedIssuingOffice('nid', 'Kaski'), 'Department of National ID and Civil Registration');
    assert.equal(suggestedIssuingOffice('passport', 'Kaski'), 'Department of Passports');
    assert.equal(suggestedIssuingOffice('driving_licence', 'Lalitpur'), 'Transport Management Office, Lalitpur');
    assert.equal(suggestedIssuingOffice('voter_id', 'Jhapa'), 'District Election Office, Jhapa');
    assert.equal(suggestedIssuingOffice('', 'Jhapa'), '');
  });

  it('needs one scan (front and back in it) on a new citizenship or NID; optional for others', () => {
    assert.match(validateDocuments([citizenship({ file: null })], ctx)['documents.0.file'] ?? '', /front and back in one file/);
    assert.equal(validateDocuments([citizenship({ id: 'd1', file: null })], ctx)['documents.0.file'], undefined);
    assert.equal(validateDocuments([citizenship(), citizenship({ type: 'passport', number: 'PA1234567', file: null })], ctx)['documents.1.file'], undefined);
  });

  it('cleans what the browser sends: one scan, trimmed text, known types only', () => {
    const rows = normalizeDocuments([
      { id: 'd1', type: 'citizenship', number: ' 12-34 ', district: ' Kaski ', office: ' DAO Kaski ', issuedDate: '2013-02-01', file: { id: 'a', name: 'scan.jpg', size: 1000, mime: 'image/jpeg', extra: 1 }, extra: 'x' },
      { type: 'other', number: 5, issuedDate: '2013/02/01', file: { name: 'no id' } },
      'junk',
    ]);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], { id: 'd1', type: 'citizenship', number: '12-34', district: 'Kaski', office: 'DAO Kaski', issuedDate: '2013-02-01', file: scan('a') });
    assert.deepEqual(rows[1], { id: undefined, type: '', number: '', district: '', office: '', issuedDate: '', file: null });
    assert.deepEqual(normalizeDocuments('nope'), []);
  });

  it('keeps the old columns as a mirror (citizenship blank when only an NID)', () => {
    const cols = legacyDocumentColumns([citizenship({ type: 'nid', number: '1234567890', district: 'Kaski' }), citizenship({ type: 'passport', number: 'PA1', district: '' })]);
    assert.deepEqual(cols, {
      citizenshipNo: '', issuingDistrict: '', nidNo: '1234567890', nidIssuingDistrict: 'Kaski',
      passportNo: 'PA1', passportIssuingDistrict: null, votersId: null, voterIdIssuingDistrict: null,
    });
  });

  it('names a changed list or photo once in the audit, never its values', () => {
    const before = [{ id: 'd1', type: 'citizenship' as const, number: '12-34', district: 'Kaski', office: '', issuedDate: null, file: null }];
    const same = [{ id: 'd1', type: 'citizenship' as const, number: '12-34', district: 'Kaski', office: '', issuedDate: '', file: null }];
    assert.equal(documentsChanged(before, same), false);
    assert.equal(documentsChanged(before, [{ ...same[0], file: scan() }]), true);
    assert.equal(documentsChanged(before, [{ ...same[0], office: 'DAO Kaski' }]), true);
    assert.deepEqual(changedEmployeeFields({ documents: before }, { documents: [{ ...same[0], issuedDate: '2013-02-01' }] }), ['documents']);
    assert.deepEqual(changedEmployeeFields({ photoId: 'p1' }, { photoId: '' }), ['photoId']);
    assert.deepEqual(changedEmployeeFields({ photoId: null }, { photoId: '' }), []);
    assert.equal(fieldLabel('documents'), 'Identity documents');
    assert.equal(fieldLabel('documents.1.issuedDate'), 'Issued date (document 2)');
    assert.equal(fieldLabel('documents.0.office'), 'Issuing office (document 1)');
    assert.equal(fieldLabel('photoId'), 'Photo');
    assert.equal(fieldLabel('citizenshipNo'), 'Citizenship no.');
  });
});

describe('Employee documents: Records to fix', () => {
  it('flags a missing scan or issued date on the record, not on payroll readiness', () => {
    assert.equal(lacksIdentityScan([{ type: 'citizenship', issuedDate: '2013-02-01', file: scan() }]), false);
    assert.equal(lacksIdentityScan([{ type: 'citizenship', issuedDate: null, file: scan() }]), true);
    assert.equal(lacksIdentityScan([{ type: 'citizenship', issuedDate: '2013-02-01', file: null }]), true);
    assert.equal(lacksIdentityScan([{ type: 'passport', issuedDate: '2013-02-01', file: scan() }]), true);
    assert.equal(lacksIdentityScan(undefined), false);
    const subject = { panNumber: '601234567', bankAccountNumber: '1', basicSalary: 1, identityScanMissing: true };
    assert.deepEqual(missingRecords(subject), ['documents']);
    assert.deepEqual(payrollReadiness([{ id: 'e1', fullName: 'A', employeeCode: 'E1', ...subject }]), []);
  });
});

describe('Employee form tabs and photo (4.2b)', () => {
  it('finds the tab of every field and error key', () => {
    assert.equal(sectionOfField('fullName'), 'general');
    assert.equal(sectionOfField('photoId'), 'general');
    assert.equal(sectionOfField('basicSalary'), 'pay');
    assert.equal(sectionOfField('documents'), 'documents');
    assert.equal(sectionOfField('documents.2.issuedDate'), 'documents');
    assert.equal(sectionOfField('panNumber'), 'documents');
    assert.equal(sectionOfField('permanentAddress.district'), 'contact');
    assert.equal(sectionOfField('nothing'), undefined);
  });

  it('shows photos from the photo route only', () => {
    assert.equal(photoUrl('3f1c'), '/api/employees/photos/3f1c');
    assert.equal(photoUrl(''), null);
    assert.equal(photoUrl(null), null);
  });
});

describe('Employee documents: upload checks (S25)', () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);
  it('takes the type from the content: PDF, JPEG or PNG only', () => {
    assert.equal(sniffFileType(new TextEncoder().encode('%PDF-1.7\n...')), 'application/pdf');
    assert.equal(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
    assert.equal(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png');
    assert.equal(sniffFileType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
    assert.equal(sniffFileType(new TextEncoder().encode('<!doctype html><p>hi')), null);
    assert.equal(sniffFileType(bytes(0x4d, 0x5a, 0x90, 0x00)), null); // a Windows program renamed to .pdf
    assert.equal(sniffFileType(new TextEncoder().encode('plain text renamed to scan.pdf')), null);
    assert.equal(sniffFileType(new Uint8Array()), null);
  });

  it('stores a safe name with the real extension', () => {
    assert.equal(safeFileName('C:\\fakepath\\citizenship front.JPG', 'image/jpeg'), 'citizenship front.jpg');
    assert.equal(safeFileName('../../etc/passwd', 'application/pdf'), 'passwd.pdf');
    assert.equal(safeFileName('report.exe', 'application/pdf'), 'report.pdf');
    assert.equal(safeFileName('a\u0000b<c>"d|e?.png', 'image/png'), 'abcde.png');
    assert.equal(safeFileName('', 'image/png'), 'scan.png');
    assert.equal(safeFileName('x'.repeat(300) + '.pdf', 'application/pdf').length, 114);
  });

  it('refuses empty files and files over 3 MB in the browser too', () => {
    assert.ok(fileProblem(0));
    assert.equal(fileProblem(3 * 1024 * 1024), null);
    assert.match(fileProblem(3 * 1024 * 1024 + 1) ?? '', /3 MB/);
  });
});
