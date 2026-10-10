// Excel workbook writer (4.11, report viewer): a small, dependency-free
// .xlsx builder for report exports. The workbook is a zip of a few XML
// parts; entries are stored (not compressed), so nothing here needs Node or
// a browser API beyond TextEncoder and it runs on either side.
//
// Cells are typed: numbers stay numbers (Excel can add them up), text is an
// inline string — never a formula, whatever it starts with — so the
// spreadsheet-injection risk of CSV (lib/export/csv.ts) does not arise.
// Money uses Excel's "#,##0.00", which groups digits the way the reader's
// Windows region does (lakh grouping on Nepali / Indian settings).

export type XlsxStyle =
  | "default"
  | "title"
  | "subtitle"
  | "muted"
  | "header"
  | "headerRight"
  | "bold"
  | "money"
  | "moneyBold"
  | "number"
  | "numberBold";

export interface XlsxCell {
  value: string | number | null;
  style?: XlsxStyle;
}

export type XlsxValue = string | number | null | XlsxCell;

export interface XlsxSheet {
  /** Tab name; cleaned to Excel's rules (≤ 31 characters, none of [ ] : * ? / \). */
  name: string;
  rows: XlsxValue[][];
  /** Column widths in characters (index = column). */
  widths?: number[];
  /** Rows kept in view while scrolling (titles and the header row). */
  freezeRows?: number;
  /** 1-based row repeated at the top of every printed page (the header row). */
  repeatRow?: number;
  /** Cell ranges merged into one, as [firstRow, firstCol, lastRow, lastCol] (0-based). */
  merges?: [number, number, number, number][];
  landscape?: boolean;
}

export interface XlsxMeta {
  title?: string;
  creator?: string;
  created?: Date;
}

/** Style name → index in styles.xml cellXfs (order below). */
const STYLE_INDEX: Record<XlsxStyle, number> = {
  default: 0,
  title: 1,
  subtitle: 2,
  muted: 3,
  header: 4,
  headerRight: 5,
  bold: 6,
  money: 7,
  moneyBold: 8,
  number: 9,
  numberBold: 10,
};

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="4">' +
  '<font><sz val="10"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="10"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="13"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><sz val="9"/><color rgb="FF595959"/><name val="Calibri"/><family val="2"/></font>' +
  "</fonts>" +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF1ED"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FF8A9387"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="11">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

/** Characters XML 1.0 cannot carry (control characters, lone surrogates, U+FFFE/U+FFFF). */
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function escapeXml(text: string): string {
  return text.replace(INVALID_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

const cellRef = (row: number, col: number) => `${columnName(col)}${row + 1}`;

/** Excel's tab-name rules: ≤ 31 characters, none of [ ] : * ? / \, not blank, unique (case-insensitive). */
export function sheetNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((raw, i) => {
    const base = (raw.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim() || `Sheet ${i + 1}`).replace(/^'+|'+$/g, "").slice(0, 31) || `Sheet ${i + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      const suffix = ` (${n})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

function cellXml(value: XlsxValue, row: number, col: number): string {
  const cell: XlsxCell = value !== null && typeof value === "object" ? value : { value };
  const s = STYLE_INDEX[cell.style ?? "default"] ?? 0;
  const ref = cellRef(row, col);
  const style = s ? ` s="${s}"` : "";
  if (cell.value === null || cell.value === undefined || cell.value === "") return s ? `<c r="${ref}"${style}/>` : "";
  if (typeof cell.value === "number") {
    if (!Number.isFinite(cell.value)) return `<c r="${ref}"${style}/>`;
    return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(cell.value))}</t></is></c>`;
}

function worksheetXml(sheet: XlsxSheet): string {
  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'];
  parts.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
  parts.push('<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
  const freeze = sheet.freezeRows && sheet.freezeRows > 0 ? Math.floor(sheet.freezeRows) : 0;
  parts.push(
    freeze
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
  );
  parts.push('<sheetFormatPr defaultRowHeight="14"/>');
  const widths = sheet.widths ?? [];
  if (widths.length) {
    parts.push("<cols>");
    widths.forEach((w, i) => {
      const width = Math.max(2, Math.min(80, Number(w) || 10));
      parts.push(`<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`);
    });
    parts.push("</cols>");
  }
  parts.push("<sheetData>");
  sheet.rows.forEach((row, r) => {
    const cells = row.map((v, c) => cellXml(v, r, c)).join("");
    parts.push(cells ? `<row r="${r + 1}">${cells}</row>` : `<row r="${r + 1}"/>`);
  });
  parts.push("</sheetData>");
  const merges = (sheet.merges ?? []).filter(([r1, c1, r2, c2]) => r2 >= r1 && c2 >= c1 && (r2 > r1 || c2 > c1));
  if (merges.length) {
    parts.push(`<mergeCells count="${merges.length}">`);
    for (const [r1, c1, r2, c2] of merges) parts.push(`<mergeCell ref="${cellRef(r1, c1)}:${cellRef(r2, c2)}"/>`);
    parts.push("</mergeCells>");
  }
  parts.push('<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>');
  parts.push(`<pageSetup paperSize="9" orientation="${sheet.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>`);
  parts.push("</worksheet>");
  return parts.join("");
}

const quoteSheet = (name: string) => `'${name.replace(/'/g, "''")}'`;

function workbookXml(names: string[], sheets: readonly XlsxSheet[]): string {
  const titles = sheets
    .map((s, i) => (s.repeatRow && s.repeatRow > 0 ? `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${escapeXml(quoteSheet(names[i]))}!$${s.repeatRow}:$${s.repeatRow}</definedName>` : ""))
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    "<sheets>" +
    names.map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    "</sheets>" +
    (titles ? `<definedNames>${titles}</definedNames>` : "") +
    "</workbook>"
  );
}

function workbookRelsXml(count: number): string {
  let rels = "";
  for (let i = 1; i <= count; i++) {
    rels += `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`;
  }
  rels += `<Relationship Id="rId${count + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function contentTypesXml(count: number): string {
  let overrides = '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
  for (let i = 1; i <= count; i++) {
    overrides += `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }
  overrides += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  overrides += '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    overrides +
    "</Types>"
  );
}

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
  "</Relationships>";

function coreXml(meta: XlsxMeta, created: Date): string {
  const stamp = `${created.toISOString().slice(0, 19)}Z`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    (meta.title ? `<dc:title>${escapeXml(meta.title)}</dc:title>` : "") +
    (meta.creator ? `<dc:creator>${escapeXml(meta.creator)}</dc:creator>` : "") +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>` +
    "</cp:coreProperties>"
  );
}

// ---------------------------------------------------------------------------
// Zip (stored entries)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    time: ((date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)) & 0xffff,
    day: (((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff,
  };
}

/** A zip archive of stored (uncompressed) entries. */
export function zipStored(entries: readonly { name: string; data: Uint8Array }[], date = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(date);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, entry.data);
    centrals.push(central);
    offset += local.length + size;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Workbook
// ---------------------------------------------------------------------------

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The .xlsx file's bytes. */
export function buildXlsx(sheets: readonly XlsxSheet[], meta: XlsxMeta = {}): Uint8Array {
  if (!sheets.length) throw new Error("A workbook needs at least one sheet.");
  const created = meta.created ?? new Date();
  const names = sheetNames(sheets.map((s) => s.name));
  const encoder = new TextEncoder();
  const text = (name: string, xml: string) => ({ name, data: encoder.encode(xml) });
  return zipStored(
    [
      text("[Content_Types].xml", contentTypesXml(sheets.length)),
      text("_rels/.rels", ROOT_RELS),
      text("docProps/core.xml", coreXml(meta, created)),
      text("xl/workbook.xml", workbookXml(names, sheets)),
      text("xl/_rels/workbook.xml.rels", workbookRelsXml(sheets.length)),
      text("xl/styles.xml", STYLES_XML),
      ...sheets.map((s, i) => text(`xl/worksheets/sheet${i + 1}.xml`, worksheetXml(s))),
    ],
    created
  );
}
