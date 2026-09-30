/**
 * Imports the published human creativity datasets that the human-baseline stage
 * compares against. The raw files are downloaded from OSF, checked against pinned
 * SHA-256 hashes, and normalised into data/human/*.json so that every later step
 * runs offline from committed data.
 *
 *   node scripts/fetch-human-data.ts               # download missing files, verify, convert
 *   node scripts/fetch-human-data.ts --check       # verify the cache only, convert nothing
 *   node scripts/fetch-human-data.ts --update-hashes
 *
 * Raw downloads live in runs/cache/human-raw/ (gitignored); the normalised JSON in
 * data/human/ is committed and carries the source URL, hash and citation per file.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { readXlsxTable } from "../src/core/xlsx.ts";

type Dataset = "semdis-aut" | "semdis-wa" | "olson-dat";

interface RawSource {
  key: string;
  url: string;
  sha256: string;
  bytes: number;
  dataset: Dataset;
  study: string;
  kind: "xlsx" | "tsv";
}

const SEMDIS_CITATION =
  "Beaty, R. E., & Johnson, D. R. (2021). Automating creativity assessment with SemDis: An open platform for " +
  "computing semantic distance. Behavior Research Methods, 53, 757-780. Data: https://osf.io/gz4fc/";
const OLSON_CITATION =
  "Olson, J. A., Nahas, J., Chmoulevitch, D., Cropper, S. J., & Webb, M. E. (2021). Naming unrelated words " +
  "predicts creativity. PNAS, 118(25), e2102340118. Data: https://osf.io/kbeq6/";

const SOURCES: RawSource[] = [
  { key: "s1_data_long.xlsx", url: "https://osf.io/download/ksgup/", sha256: "b86d5d29c95fa457d08a527ac3671a0f0868a954b85b08cfa8cecba0ad5a08d1", bytes: 359474, dataset: "semdis-aut", study: "semdis-1", kind: "xlsx" },
  { key: "s2_data_long.xlsx", url: "https://osf.io/download/cbrst/", sha256: "8575fafd201955c8d77da535ff157b3c3445b0d2e3eb5354e2aa9f35ec49905e", bytes: 219286, dataset: "semdis-aut", study: "semdis-2", kind: "xlsx" },
  { key: "s3_data_long.xlsx", url: "https://osf.io/download/fhab6/", sha256: "3094781c5c9525cdaf57c4fb6c77f61dbcf568b961a7f9d853fd2d2f45ed8a0f", bytes: 186881, dataset: "semdis-aut", study: "semdis-3", kind: "xlsx" },
  { key: "s4.1_data_long.xlsx", url: "https://osf.io/download/sx5hb/", sha256: "612af1022969f91203a3b4989dd1494ee3db54d6c36f36e00d705b6c6f556ff8", bytes: 119709, dataset: "semdis-wa", study: "semdis-4.1", kind: "xlsx" },
  { key: "s4.2_data_long.xlsx", url: "https://osf.io/download/qdx56/", sha256: "28d994b8b674f2fdce83e57fcae02141b5246745f1cc2d32e6636fb345a1e0cd", bytes: 308841, dataset: "semdis-wa", study: "semdis-4.2", kind: "xlsx" },
  { key: "s5_data_long.xlsx", url: "https://osf.io/download/tk25x/", sha256: "d49e810ef0a58966f162811e7888107a2b4bb1ecc90b0d45fd1a2bd45af66e1a", bytes: 153705, dataset: "semdis-wa", study: "semdis-5", kind: "xlsx" },
  { key: "study1a.tsv", url: "https://osf.io/download/dyvxw/", sha256: "29f4b1929db8620fabf3dd44eb7bf804c1a68863d45b8a3e8ab62520b0a18f62", bytes: 28417, dataset: "olson-dat", study: "olson-1a", kind: "tsv" },
  { key: "study1b.tsv", url: "https://osf.io/download/67bhr/", sha256: "71d6750b2e73b74b5cb9a308a2e25076a15cdbb3db1dd54ed29d49daf195770f", bytes: 52228, dataset: "olson-dat", study: "olson-1b", kind: "tsv" },
  { key: "study2.tsv", url: "https://osf.io/download/a83q9/", sha256: "e54f80182775fd82c36cfa928958cc90fc8a7e74cb3e33fb449cb2930ec28b97", bytes: 1288629, dataset: "olson-dat", study: "olson-2", kind: "tsv" }
];

export interface HumanRecord {
  study: string;
  item: string;
  id: string;
  response: string;
  ratings: number[];
  extra?: Record<string, number>;
}

export interface HumanDatRecord {
  study: string;
  id: string;
  words: string[];
  datPublished: number | null;
  valids: number | null;
  aut?: { fluency?: number; originality?: number; flexibility?: number };
}

export interface HumanDatasetFile<R> {
  dataset: Dataset;
  task: "aut" | "word-association" | "dat";
  title: string;
  citation: string;
  usageNote: string;
  sources: { file: string; url: string; sha256: string; bytes: number; records: number }[];
  records: R[];
}

const CACHE_DIR = "runs/cache/human-raw";
const OUT_DIR = "data/human";

function sha256(buf: Buffer): string { return crypto.createHash("sha256").update(buf).digest("hex"); }

function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const t = raw.trim();
  if (t === "" || t.toUpperCase() === "NA" || t.toUpperCase() === "NAN" || t === "#N/A") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function writeJson(file: string, value: unknown): number {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = JSON.stringify(value) + "\n";
  fs.writeFileSync(file, text);
  return Buffer.byteLength(text);
}

/** AUT rows: raters score originality on a 1-5 scale; the published columns are semantic distances. */
function autRecords(rows: Record<string, string>[], study: string, raters: string[], pub: Record<string, string>): HumanRecord[] {
  const out: HumanRecord[] = [];
  for (const r of rows) {
    const response = (r.response ?? "").trim();
    if (response === "") continue;
    const ratings = raters.map((c) => num(r[c])).filter((v): v is number => v !== null);
    const extra: Record<string, number> = {};
    for (const [key, col] of Object.entries(pub)) {
      const v = num(r[col]);
      if (v !== null) extra[key] = Number(v.toFixed(4));
    }
    out.push({ study, item: (r.item ?? "").trim(), id: (r.id ?? "").trim(), response, ratings, ...(Object.keys(extra).length ? { extra } : {}) });
  }
  return out;
}

/** Word association rows: one human score per scale cell, plus the published distances. */
function waRecords(rows: Record<string, string>[], study: string, raters: string[], pub: Record<string, string>): HumanRecord[] {
  const out: HumanRecord[] = [];
  for (const r of rows) {
    const response = (r.response ?? "").trim();
    if (response === "") continue;
    const ratings = raters.map((c) => num(r[c])).filter((v): v is number => v !== null);
    const extra: Record<string, number> = {};
    for (const [key, col] of Object.entries(pub)) {
      const v = num(r[col]);
      if (v !== null) extra[key] = Number(v.toFixed(4));
    }
    out.push({ study, item: (r.item ?? "").trim(), id: (r.id ?? "").trim(), response, ratings, ...(Object.keys(extra).length ? { extra } : {}) });
  }
  return out;
}

const DAT_PUB = { pub_glov: "glov", pub_tasa: "tasa", pub_cbowu: "cbowu", pub_cbows: "cbows", pub_cboww: "cboww" };

function parseTsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const header = lines[0]!.split("\t").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const rec: Record<string, string> = {};
    header.forEach((h, i) => { rec[h] = cols[i] ?? ""; });
    return rec;
  });
}

function datRecords(rows: Record<string, string>[], study: string): HumanDatRecord[] {
  const out: HumanDatRecord[] = [];
  for (const r of rows) {
    const words: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const w = (r["word." + i] ?? "").trim();
      if (w !== "" && w.toUpperCase() !== "NA") words.push(w);
    }
    if (words.length === 0) continue;
    const aut: HumanDatRecord["aut"] = {};
    for (const [key, col] of [["fluency", "aut.fluency"], ["originality", "aut.originality"], ["flexibility", "aut.flexibility"]] as const) {
      const v = num(r[col]);
      if (v !== null) aut[key] = v;
    }
    out.push({
      study, id: (r.id ?? "").trim(), words,
      datPublished: num(r.dat), valids: num(r.valids) === null ? null : Math.round(num(r.valids)!),
      ...(Object.keys(aut).length ? { aut } : {})
    });
  }
  return out;
}

async function acquire(src: RawSource, updateHashes: boolean): Promise<Buffer> {
  const file = path.join(CACHE_DIR, src.key);
  let buf: Buffer;
  if (fs.existsSync(file)) {
    buf = fs.readFileSync(file);
  } else {
    const res = await fetch(src.url, { signal: AbortSignal.timeout(300_000) });
    if (!res.ok) throw new Error("download failed " + src.url + " -> HTTP " + res.status);
    buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(file, buf);
  }
  const digest = sha256(buf);
  if (updateHashes) {
    if (digest !== src.sha256) console.log("  hash update " + src.key + ": " + digest + " (bytes " + buf.length + ")");
    return buf;
  }
  if (digest !== src.sha256) {
    throw new Error("checksum mismatch for " + src.key + ": expected " + src.sha256 + " got " + digest +
      "; re-run with --update-hashes if the upstream file legitimately changed");
  }
  if (src.bytes !== 0 && buf.length !== src.bytes) {
    throw new Error("size mismatch for " + src.key + ": expected " + src.bytes + " got " + buf.length);
  }
  return buf;
}

const AUT_SOURCES: Record<string, { raters: string[]; pub: Record<string, string> }> = {
  "semdis-1": { raters: ["rater1", "rater2", "rater3", "rater4"], pub: { pub_glov: "glov_m", pub_tasa: "tasa_m", pub_cbowu: "cbowu_m", pub_cbows: "cbows_m", pub_cboww: "cboww_m" } },
  "semdis-2": { raters: ["rater1", "rater2", "rater3"], pub: DAT_PUB },
  "semdis-3": { raters: ["br_rater1", "br_rater2", "br_rater3"], pub: DAT_PUB }
};

const WA_SOURCES: Record<string, { raters: string[]; pub: Record<string, string> }> = {
  "semdis-4.1": { raters: ["creativity"], pub: DAT_PUB },
  "semdis-4.2": { raters: ["creativity"], pub: DAT_PUB },
  "semdis-5": { raters: ["rater1", "rater2", "rater3"], pub: DAT_PUB }
};

export function normalize(rowsByStudy: Map<string, Record<string, string>[]>): { datasets: HumanDatasetFile<HumanRecord>[]; dat: HumanDatasetFile<HumanDatRecord> } {
  const autRecordsAll: HumanRecord[] = [];
  const waRecordsAll: HumanRecord[] = [];
  const datRecordsAll: HumanDatRecord[] = [];
  // Records actually kept per source (after dropping blanks and unratable rows), so the
  // provenance block matches the file contents rather than the raw row count.
  const keptBySource = new Map<string, number>();
  const sourcesOf = (dataset: Dataset) => SOURCES.filter((s) => s.dataset === dataset).map((s) => ({
    file: s.key, url: s.url, sha256: s.sha256, bytes: s.bytes,
    records: keptBySource.get(s.key) ?? 0
  }));

  for (const [study, rows] of rowsByStudy) {
    const src = SOURCES.find((s) => s.study === study)!;
    if (src.dataset === "semdis-aut") {
      const cfg = AUT_SOURCES[study]!;
      const recs = autRecords(rows, study, cfg.raters, cfg.pub);
      autRecordsAll.push(...recs);
      keptBySource.set(src.key, recs.length);
    } else if (src.dataset === "semdis-wa") {
      const cfg = WA_SOURCES[study]!;
      const recs = waRecords(rows, study, cfg.raters, cfg.pub);
      waRecordsAll.push(...recs);
      keptBySource.set(src.key, recs.length);
    } else {
      const recs = datRecords(rows, study);
      datRecordsAll.push(...recs);
      keptBySource.set(src.key, recs.length);
    }
  }

  const aut: HumanDatasetFile<HumanRecord> = {
    dataset: "semdis-aut", task: "aut",
    title: "Alternative Uses Test responses with 3-4 human originality raters",
    citation: SEMDIS_CITATION,
    usageNote: "Human responses and human ratings are the property of the original authors; this file only re-encodes the " +
      "published, openly shared tables. Published distance columns are kept under extra.pub_* for comparison with the " +
      "embedding-based distances computed here.",
    sources: sourcesOf("semdis-aut"), records: autRecordsAll
  };
  const wa: HumanDatasetFile<HumanRecord> = {
    dataset: "semdis-wa", task: "word-association",
    title: "Word association responses with human creativity/novelty/appropriateness ratings",
    citation: SEMDIS_CITATION,
    usageNote: "Studies 4.1/4.2 carry a single human rating per scale (creativity, novelty, appropriateness); study 5 carries " +
      "three raters. Only the response and the human scores are re-encoded.",
    sources: sourcesOf("semdis-wa"), records: waRecordsAll
  };
  const dat: HumanDatasetFile<HumanDatRecord> = {
    dataset: "olson-dat", task: "dat",
    title: "Divergent Association Task word lists from human participants, with published DAT scores and AUT ratings",
    citation: OLSON_CITATION,
    usageNote: "Words are reproduced so the DAT score can be recomputed in the semantic space used by this repository; " +
      "datPublished is the score the original authors computed with GloVe/word2vec. words keeps only the words the original " +
      "table lists for that participant (up to 10); participants whose list was empty are dropped.",
    sources: sourcesOf("olson-dat"), records: datRecordsAll
  };
  return { datasets: [aut, wa], dat };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  return i === -1 ? undefined : (process.argv[i + 1] ?? "true");
}

async function main(): Promise<void> {
  const updateHashes = process.argv.includes("--update-hashes");
  const checkOnly = process.argv.includes("--check");
  const rowsByStudy = new Map<string, Record<string, string>[]>();
  for (const src of SOURCES) {
    const buf = await acquire(src, updateHashes);
    if (checkOnly) { console.log("ok " + src.key + " " + buf.length + " bytes"); continue; }
    const rows = src.kind === "xlsx" ? readXlsxTable(buf).records : parseTsv(buf.toString("utf8"));
    rowsByStudy.set(src.study, rows);
    console.log("read " + src.key + ": " + rows.length + " rows");
  }
  if (checkOnly) return;

  const { datasets, dat } = normalize(rowsByStudy);
  const written: string[] = [];
  for (const ds of datasets) {
    const file = path.join(OUT_DIR, ds.dataset + ".json");
    const bytes = writeJson(file, ds);
    written.push(file + " (" + ds.records.length + " records, " + (bytes / 1024).toFixed(0) + " KB)");
  }
  const datFile = path.join(OUT_DIR, dat.dataset + ".json");
  const datBytes = writeJson(datFile, dat);
  written.push(datFile + " (" + dat.records.length + " records, " + (datBytes / 1024).toFixed(0) + " KB)");
  console.log("wrote:\n  " + written.join("\n  "));
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]!).href;
if (invokedDirectly) {
  await main();
}
