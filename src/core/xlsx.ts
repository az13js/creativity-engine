/**
 * Minimal .xlsx reader for the human-data import stage: a zip container read with
 * node:zlib plus the subset of SpreadsheetML that open datasets actually use
 * (shared strings, inline strings, plain numeric cells). Zero dependencies, no
 * network, deterministic. It deliberately ignores styles, formulas' cached values
 * beyond <v>, and sheet order beyond file numbering.
 */
import zlib from "node:zlib";

interface ZipEntry {
  name: string;
  method: number;
  dataStart: number;
  compressedSize: number;
  uncompressedSize: number;
}

function u16(buf: Buffer, off: number): number { return buf.readUInt16LE(off); }
function u32(buf: Buffer, off: number): number { return buf.readUInt32LE(off); }

/** Locate the End Of Central Directory record (it is at the end, after a variable-length comment). */
function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= min; i--) {
    if (u32(buf, i) === 0x06054b50) return i;
  }
  throw new Error("xlsx: end of central directory not found (not a zip file?)");
}

function readCentralDirectory(buf: Buffer): ZipEntry[] {
  const eocd = findEocd(buf);
  const count = u16(buf, eocd + 10);
  let off = u32(buf, eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (u32(buf, off) !== 0x02014b50) throw new Error("xlsx: bad central directory entry at " + off);
    const method = u16(buf, off + 10);
    const compressedSize = u32(buf, off + 20);
    const uncompressedSize = u32(buf, off + 24);
    const nameLen = u16(buf, off + 28);
    const extraLen = u16(buf, off + 30);
    const commentLen = u16(buf, off + 32);
    const localOffset = u32(buf, off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString("utf8");
    if (u32(buf, localOffset) !== 0x04034b50) throw new Error("xlsx: bad local header for " + name);
    // Sizes come from the central directory: streamed writers put zeros in the local header.
    const localNameLen = u16(buf, localOffset + 26);
    const localExtraLen = u16(buf, localOffset + 28);
    entries.push({ name, method, dataStart: localOffset + 30 + localNameLen + localExtraLen, compressedSize, uncompressedSize });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** All files of a zip container, decompressed. */
export function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  for (const e of readCentralDirectory(buf)) {
    const raw = buf.subarray(e.dataStart, e.dataStart + e.compressedSize);
    if (e.method === 0) out.set(e.name, Buffer.from(raw));
    else if (e.method === 8) out.set(e.name, zlib.inflateRawSync(raw));
    else throw new Error("xlsx: unsupported compression method " + e.method + " for " + e.name);
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXmlEntities(s: string): string {
  return s.replace(/&(#x?[0-9A-Fa-f]+|[a-z]+);/g, (m, g: string) => {
    if (g.startsWith("#x") || g.startsWith("#X")) return String.fromCodePoint(parseInt(g.slice(2), 16));
    if (g.startsWith("#")) return String.fromCodePoint(parseInt(g.slice(1), 10));
    return ENTITIES[g] ?? m;
  });
}

/** Text of every <t> child, concatenated: handles plain and rich-text shared strings. */
function textOf(xml: string): string {
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out += decodeXmlEntities(m[1]!);
  return out;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(textOf(m[1]!));
  return out;
}

function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml: string, shared: readonly string[], maxRows: number): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(xml)) !== null && rows.length < maxRows) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(m[2]!)) !== null) {
      const attrs = c[1]!;
      const body = c[2] ?? "";
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const idx = ref ? columnIndex(ref) : cells.length;
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "n";
      const vMatch = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);
      const raw = vMatch ? decodeXmlEntities(vMatch[1]!) : "";
      let value: string;
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else value = raw;
      while (cells.length < idx) cells.push("");
      cells[idx] = value;
    }
    rows.push(cells);
  }
  return rows;
}

export interface XlsxSheet { name: string; rows: string[][]; }

/** Read every worksheet of a workbook, in file order. */
export function readXlsx(buf: Buffer, maxRows = 200_000): XlsxSheet[] {
  const files = unzip(buf);
  const sharedFile = files.get("xl/sharedStrings.xml");
  const shared = sharedFile ? parseSharedStrings(sharedFile.toString("utf8")) : [];
  const sheetNames = [...files.keys()].filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)/.exec(a)![1]) - Number(/(\d+)/.exec(b)![1]));
  return sheetNames.map((name) => ({
    name: name.replace(/^xl\/worksheets\//, "").replace(/\.xml$/, ""),
    rows: parseSheet(files.get(name)!.toString("utf8"), shared, maxRows)
  }));
}

/** Convenience: header row plus records keyed by column name, for single-sheet datasets. */
export function readXlsxTable(buf: Buffer): { header: string[]; records: Record<string, string>[] } {
  const sheet = readXlsx(buf)[0];
  if (!sheet || sheet.rows.length === 0) return { header: [], records: [] };
  const header = sheet.rows[0]!.map((h) => h.trim());
  const records = sheet.rows.slice(1).filter((r) => r.some((v) => v !== "")).map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => { rec[h] = r[i] ?? ""; });
    return rec;
  });
  return { header, records };
}
