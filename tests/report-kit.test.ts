import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildXlsx, columnName, crc32, escapeXml, sheetNames, zipStored } from '../lib/export/xlsx';
import { columnTotal, formatReportValue, groupRows, reportCsv, reportFileName, reportSheet, type ReportColumn } from '../lib/kit/report';

// Report viewer kit (4.11): the Excel writer (a stored zip of SpreadsheetML parts) and the column
// model that the printed sheet, the CSV and the workbook share.

/** Reads a stored zip back, checking every signature, offset and CRC on the way. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50, 'end of central directory');
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  const offset = view.getUint32(end + 16, true);
  assert.equal(offset + size, end, 'central directory sits right before its end record');
  const files = new Map<string, string>();
  let p = offset;
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(p, true), 0x02014b50, 'central header');
    assert.equal(view.getUint16(p + 10, true), 0, 'stored');
    const crc = view.getUint32(p + 16, true);
    const length = view.getUint32(p + 24, true);
    assert.equal(view.getUint32(p + 20, true), length, 'stored: compressed = uncompressed');
    const nameLength = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLength));
    assert.equal(view.getUint32(local, true), 0x04034b50, `local header of ${name}`);
    assert.equal(view.getUint32(local + 14, true), crc, `local CRC of ${name}`);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + length);
    assert.equal(crc32(data), crc, `CRC of ${name}`);
    files.set(name, new TextDecoder().decode(data));
    p += 46 + nameLength;
  }
  return files;
}

describe('xlsx writer', () => {
  it('CRC-32 and column names', () => {
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
    assert.deepEqual([0, 25, 26, 51, 52, 701, 702].map(columnName), ['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA']);
  });

  it('zips entries that read back with their CRCs', () => {
    const files = unzip(zipStored([{ name: 'a.txt', data: new TextEncoder().encode('hello') }, { name: 'b/c.xml', data: new TextEncoder().encode('<x/>') }]));
    assert.deepEqual([...files.entries()], [['a.txt', 'hello'], ['b/c.xml', '<x/>']]);
  });

  it('writes a workbook with typed cells, styles, frozen header, merges and print titles', () => {
    const bytes = buildXlsx(
      [
        {
          name: 'Salary sheet',
          rows: [[{ value: 'Demo Sahakari', style: 'title' }], [], [{ value: 'Name', style: 'header' }, { value: 'Net', style: 'headerRight' }], ['Ram & Sita <A>', { value: 45000.5, style: 'money' }], ['=HYPERLINK("x")', -200]],
          widths: [24, 14],
          freezeRows: 3,
          repeatRow: 3,
          merges: [[0, 0, 0, 1]],
          landscape: true,
        },
        { name: 'Salary sheet', rows: [['second']] },
      ],
      { title: 'Salary sheet', creator: 'Admin', created: new Date('2026-10-10T08:00:00Z') }
    );
    const files = unzip(bytes);
    for (const part of ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
      assert.ok(files.has(part), part);
    }
    const sheet = files.get('xl/worksheets/sheet1.xml')!;
    assert.match(sheet, /<c r="B4" s="7"><v>45000\.5<\/v><\/c>/, 'money is a number with the money style');
    assert.match(sheet, /<c r="B5"><v>-200<\/v><\/c>/);
    assert.match(sheet, /<c r="A4" t="inlineStr"><is><t xml:space="preserve">Ram &amp; Sita &lt;A&gt;<\/t><\/is><\/c>/);
    // Text that looks like a formula stays text: there is no formula element at all.
    assert.match(sheet, /<t xml:space="preserve">=HYPERLINK\(&quot;x&quot;\)<\/t>/);
    assert.doesNotMatch(sheet, /<f>/);
    assert.match(sheet, /<pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"\/>/);
    assert.match(sheet, /<mergeCell ref="A1:B1"\/>/);
    assert.match(sheet, /<col min="1" max="1" width="24" customWidth="1"\/>/);
    assert.match(sheet, /orientation="landscape"/);
    const workbook = files.get('xl/workbook.xml')!;
    assert.match(workbook, /<sheet name="Salary sheet" sheetId="1" r:id="rId1"\/><sheet name="Salary sheet \(2\)" sheetId="2" r:id="rId2"\/>/);
    assert.match(workbook, /<definedName name="_xlnm\.Print_Titles" localSheetId="0">&apos;Salary sheet&apos;!\$3:\$3<\/definedName>/);
    assert.match(files.get('[Content_Types].xml')!, /\/xl\/worksheets\/sheet2\.xml/);
    assert.match(files.get('docProps/core.xml')!, /<dc:title>Salary sheet<\/dc:title><dc:creator>Admin<\/dc:creator>/);
  });

  it('cleans what XML and Excel cannot take', () => {
    assert.equal(escapeXml('a\u0001b\u0008c\td\ne'), 'abc\td\ne');
    assert.equal(escapeXml('x\uD800y'), 'xy', 'lone surrogate dropped');
    assert.equal(escapeXml('नेपाल 😀'), 'नेपाल 😀');
    assert.deepEqual(sheetNames(['A/B:C*?', '', 'x'.repeat(40), 'Report', 'report', "'quoted'"]), ['A B C', 'Sheet 2', 'x'.repeat(31), 'Report', 'report (2)', 'quoted']);
    assert.throws(() => buildXlsx([]));
  });
});

interface Row {
  code: string;
  name: string;
  dept: string;
  net: string | number;
  days: number;
}

const columns: ReportColumn<Row>[] = [
  { id: 'code', header: 'Code', kind: 'code', value: (r) => r.code },
  { id: 'name', header: 'Name', value: (r) => r.name },
  { id: 'days', header: 'Days', kind: 'days', value: (r) => r.days, total: true },
  { id: 'net', header: 'Net payable', kind: 'amount', value: (r) => r.net, total: true },
];
const rows: Row[] = [
  { code: 'EMP-2', name: '=cmd|calc', dept: 'Loans', net: '0.10', days: 1.5 },
  { code: 'EMP-1', name: 'Ram', dept: '', net: 0.2, days: 30 },
  { code: 'EMP-3', name: 'Sita', dept: 'Accounts', net: '125000.00', days: 29.5 },
];

describe('report columns', () => {
  it('totals in decimals; groups in label order with blanks last', () => {
    assert.equal(columnTotal(columns[3], rows), 125000.3);
    assert.equal(columnTotal(columns[2], rows), 61);
    assert.equal(columnTotal(columns[1], rows), null);
    const groups = groupRows(rows, (r) => r.dept, (r) => r.dept);
    assert.deepEqual(groups.map((g) => [g.label, g.rows.map((r) => r.code)]), [['Accounts', ['EMP-3']], ['Loans', ['EMP-2']], ['', ['EMP-1']]]);
  });

  it('formats for the page: lakh grouping, zero money as a dash, days trimmed', () => {
    assert.equal(formatReportValue('amount', '125000.5'), '1,25,000.50');
    assert.equal(formatReportValue('amount', 0), '–');
    assert.equal(formatReportValue('amount', -1500), '-1,500.00');
    assert.equal(formatReportValue('days', 29.5), '29.5');
    assert.equal(formatReportValue('days', '30.00'), '30');
    assert.equal(formatReportValue('text', null), '');
    assert.equal(formatReportValue('code', 'EMP-1'), 'EMP-1');
  });

  it('CSV: numbered, plain amounts, formulas neutralised', () => {
    const csv = reportCsv(columns, rows, { numbered: true }).split('\r\n');
    assert.equal(csv[0], '"S.N.","Code","Name","Days","Net payable"');
    assert.equal(csv[1], `"1","EMP-2","'=cmd|calc","1.5","0.10"`);
    assert.equal(csv[3], '"3","EMP-3","Sita","29.5","125000.00"');
    assert.equal(csv.length, 4, 'no title or total lines');
  });

  it('Excel sheet: titles, header, groups with subtotals, total, frozen header row', () => {
    const groups = groupRows(rows, (r) => r.dept, (r) => r.dept);
    const sheet = reportSheet(columns, rows, { name: 'Sheet', title: ['Demo Sahakari', 'Salary sheet — Aswin 2083'], groups, numbered: true, totals: true, landscape: true });
    assert.deepEqual(sheet.rows[0], [{ value: 'Demo Sahakari', style: 'title' }]);
    assert.deepEqual(sheet.rows[3][0], { value: 'S.N.', style: 'headerRight' });
    assert.deepEqual(sheet.rows[3][4], { value: 'Net payable', style: 'headerRight' });
    assert.deepEqual(sheet.rows[4], [{ value: 'Accounts', style: 'bold' }]);
    assert.deepEqual(sheet.rows[5], [{ value: 1, style: 'number' }, 'EMP-3', 'Sita', { value: 29.5, style: 'number' }, { value: 125000, style: 'money' }]);
    assert.deepEqual(sheet.rows[6], [{ value: 'Subtotal — Accounts', style: 'bold' }, null, null, { value: 29.5, style: 'numberBold' }, { value: 125000, style: 'moneyBold' }]);
    assert.deepEqual(sheet.rows[10], [{ value: 'Not set', style: 'bold' }]);
    assert.deepEqual(sheet.rows.at(-1), [{ value: 'Total', style: 'bold' }, null, null, { value: 61, style: 'numberBold' }, { value: 125000.3, style: 'moneyBold' }]);
    assert.equal(sheet.freezeRows, 4);
    assert.equal(sheet.repeatRow, 4);
    assert.deepEqual(sheet.merges, [[0, 0, 0, 4], [1, 0, 1, 4]]);
    assert.deepEqual(sheet.widths, [6, 12, 22, 9, 14]);
    // The sheet builds into a valid workbook.
    assert.ok(unzip(buildXlsx([sheet])).get('xl/worksheets/sheet1.xml')!.includes('<v>125000.3</v>'));
  });

  it('file names', () => {
    assert.equal(reportFileName(['salary-sheet', 'Aswin 2083', null, 'Lekhnath / HO'], 'xlsx'), 'salary-sheet-Aswin-2083-Lekhnath-HO.xlsx');
    assert.equal(reportFileName([], 'csv'), 'report.csv');
  });
});
