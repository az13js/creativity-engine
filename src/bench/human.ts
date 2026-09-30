/**
 * Human-baseline layer. The benchmark on its own can only compare machine configs
 * against each other; this module brings in published human data so that
 *
 *   1. the automatic instruments can be validated against human raters, and
 *   2. machine output can be placed inside the human distribution.
 *
 * It contains no model calls: loaders read the committed files under data/human/,
 * and every measurement goes through the same SemanticSpace as the benchmark.
 */
import fs from "node:fs";
import { cosine } from "../core/distance.ts";
import { isSingleWord } from "../core/text.ts";
import { embedItems, type SemanticSpace } from "../core/semantic-space.ts";
import { mean, sd, pearson, spearman, percentileRank, quantile, cliffsDelta } from "../core/stats.ts";

export const HUMAN_FILES = {
  aut: "data/human/semdis-aut.json",
  wa: "data/human/semdis-wa.json",
  dat: "data/human/olson-dat.json"
} as const;

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
  dataset: string;
  task: string;
  title: string;
  citation: string;
  usageNote: string;
  sources: { file: string; url: string; sha256: string; bytes: number; records: number }[];
  records: R[];
}

export function loadHumanDataset<R = HumanRecord>(file: string = HUMAN_FILES.aut): HumanDatasetFile<R> {
  return JSON.parse(fs.readFileSync(file, "utf8")) as HumanDatasetFile<R>;
}

export function meanRating(record: HumanRecord): number { return mean(record.ratings); }

// ---------------------------------------------------------------------------
// Distances
// ---------------------------------------------------------------------------

export interface DistanceProfile {
  /** 1 - cosine(response, item): the operationalisation the published SemDis scores use. */
  toItem: number;
  /** Mean distance to the other responses given for the same item. */
  meanOther: number;
  /** Distance to the nearest other response (1 - max similarity). */
  minOther: number;
  /** Largest distance to another response. */
  maxOther: number;
  /** Mean distance to the K nearest other responses (K = 3 by default). */
  meanKOther: number;
}

function offDiagonals(sim: readonly number[][], row: number, skip: Set<number>): number[] {
  const out: number[] = [];
  for (let j = 0; j < sim.length; j++) if (j !== row && !skip.has(j)) out.push(1 - sim[row]![j]!);
  return out;
}

/**
 * Distances of every human response to its item prompt and to the other responses
 * of the same item. Responses are compared inside their item only, matching how the
 * original studies scored them.
 */
export async function distanceProfiles(records: readonly HumanRecord[], space: SemanticSpace, nearK = 3): Promise<DistanceProfile[]> {
  const byItem = new Map<string, number[]>();
  records.forEach((r, i) => {
    const list = byItem.get(r.item) ?? [];
    list.push(i);
    byItem.set(r.item, list);
  });
  const out = new Array<DistanceProfile>(records.length);
  for (const [item, idx] of byItem) {
    const texts = [item, ...idx.map((i) => records[i]!.response)];
    const sim = await space.similarityMatrix(texts);
    idx.forEach((recordIndex, k) => {
      const row = k + 1;
      const others = offDiagonals(sim, row, new Set([0]));
      const nearest = others.slice().sort((a, b) => b - a).slice(0, Math.min(nearK, others.length));
      out[recordIndex] = {
        toItem: 1 - sim[row]![0]!,
        meanOther: others.length ? mean(others) : 0,
        minOther: others.length ? Math.min(...others) : 0,
        maxOther: others.length ? Math.max(...others) : 0,
        meanKOther: nearest.length ? mean(nearest) : 0
      };
    });
  }
  return out;
}

export interface ReferenceDistance extends DistanceProfile {
  /** Mean distance to the K nearest reference responses: rewards leaving a whole neighbourhood. */
  meanKRef: number;
}

/**
 * Distances of arbitrary texts (typically machine ideas) to a fixed human reference set,
 * grouped by the item they answer. Used for "how far is this idea from anything a human said".
 */
export async function distanceToReference(
  queries: readonly { item: string; text: string }[],
  reference: ReadonlyMap<string, readonly string[]>,
  space: SemanticSpace,
  nearK = 3
): Promise<ReferenceDistance[]> {
  const byItem = new Map<string, number[]>();
  queries.forEach((q, i) => {
    const list = byItem.get(q.item) ?? [];
    list.push(i);
    byItem.set(q.item, list);
  });
  const out = new Array<ReferenceDistance>(queries.length);
  for (const [item, idx] of byItem) {
    const refs = reference.get(item) ?? [];
    const texts = [item, ...refs, ...idx.map((i) => queries[i]!.text)];
    const sim = await space.similarityMatrix(texts);
    idx.forEach((queryIndex, k) => {
      const row = refs.length + 1 + k;
      const others = refs.map((_, j) => 1 - sim[row]![1 + j]!);
      const sorted = others.slice().sort((a, b) => b - a);
      out[queryIndex] = {
        toItem: 1 - sim[row]![0]!,
        meanOther: others.length ? mean(others) : 0,
        minOther: others.length ? Math.min(...others) : 0,
        maxOther: others.length ? Math.max(...others) : 0,
        meanKOther: sorted.length ? mean(sorted.slice(0, Math.min(nearK, sorted.length))) : 0,
        meanKRef: sorted.length ? mean(sorted.slice(0, Math.min(nearK, sorted.length))) : 0
      };
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Instrument validation
// ---------------------------------------------------------------------------

export interface Correlation { n: number; pearson: number; spearman: number }

export function correlate(xs: readonly number[], ys: readonly number[]): Correlation {
  const pairs = xs.map((x, i) => [x, ys[i]!] as const).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const a = pairs.map(([x]) => x), b = pairs.map(([, y]) => y);
  return { n: pairs.length, pearson: pearson(a, b), spearman: spearman(a, b) };
}

/** Mean correlation over groups via Fisher z, so groups of different size are weighted sensibly. */
export function fisherMean(rs: readonly number[]): number {
  const usable = rs.filter((r) => Number.isFinite(r) && Math.abs(r) < 0.999);
  if (usable.length === 0) return Number.NaN;
  const z = mean(usable.map((r) => 0.5 * Math.log((1 + r) / (1 - r))));
  return (Math.exp(2 * z) - 1) / (Math.exp(2 * z) + 1);
}

function standardizeWithin(xs: readonly number[]): number[] {
  const m = mean(xs), s = sd(xs);
  return s === 0 ? xs.map(() => 0) : xs.map((x) => (x - m) / s);
}

export interface MetricValidation {
  metric: string;
  /** Per-item correlations, then the sample-size-weighted mean via Fisher z. */
  perItem: { item: string; n: number; pearson: number; spearman: number }[];
  pooledWithinItem: Correlation;
  meanSpearman: number;
  meanPearson: number;
  /** Share of items whose Spearman rho is positive. */
  positiveShare: number;
}

/**
 * Correlate an automatic metric with the human ratings. Machine scores are correlated
 * inside each item (ratings and distances are not comparable across prompts) and the
 * per-item values are pooled through Fisher z.
 */
export function validateMetric(
  metric: string,
  perRecordMetric: readonly number[],
  records: readonly HumanRecord[]
): MetricValidation {
  const byItem = new Map<string, number[]>();
  records.forEach((r, i) => {
    const list = byItem.get(r.item) ?? [];
    list.push(i);
    byItem.set(r.item, list);
  });
  const perItem: MetricValidation["perItem"] = [];
  const standardizedMetric: number[] = [];
  const standardizedRating: number[] = [];
  for (const [item, idx] of byItem) {
    const m = idx.map((i) => perRecordMetric[i]!);
    const r = idx.map((i) => meanRating(records[i]!));
    const c = correlate(m, r);
    perItem.push({ item, n: c.n, pearson: c.pearson, spearman: c.spearman });
    standardizedMetric.push(...standardizeWithin(m));
    standardizedRating.push(...standardizeWithin(r));
  }
  const importable = perItem.filter((x) => Number.isFinite(x.spearman));
  return {
    metric,
    perItem,
    pooledWithinItem: correlate(standardizedMetric, standardizedRating),
    meanSpearman: fisherMean(importable.map((x) => x.spearman)),
    meanPearson: fisherMean(importable.map((x) => x.pearson)),
    positiveShare: importable.length ? importable.filter((x) => x.spearman > 0).length / importable.length : Number.NaN
  };
}

// ---------------------------------------------------------------------------
// Divergent Association Task
// ---------------------------------------------------------------------------

export interface DatScore { study: string; id: string; used: string[]; score: number }

/** Same validity filter as the benchmark: single words, no repeats, first N kept. */
export function cleanDatWords(words: readonly string[], count = 7): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of words) {
    const w = raw.normalize("NFKC").trim();
    if (!isSingleWord(w)) continue;
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= count) break;
  }
  return out;
}

/** DAT score = mean of the 21 pairwise cosine distances, scaled by 100 (Olson et al. 2021). */
export function datScore(vectors: readonly (readonly number[])[]): number {
  if (vectors.length < 2) return 0;
  let sum = 0, count = 0;
  for (let i = 0; i < vectors.length; i++) for (let j = i + 1; j < vectors.length; j++) { sum += 1 - cosine(vectors[i]!, vectors[j]!); count++; }
  return count === 0 ? 0 : (sum / count) * 100;
}

/**
 * Recompute the DAT score of every participant in the repository's own semantic space.
 * The published score used GloVe/word2vec; comparing the two is a direct check of the
 * instrument, and the recomputed values define the human distribution machines sit in.
 */
export async function scoreDatParticipants(
  records: readonly HumanDatRecord[],
  space: SemanticSpace,
  opts: { count?: number } = {}
): Promise<DatScore[]> {
  const count = opts.count ?? 7;
  const cleaned = records.map((r) => cleanDatWords(r.words, count));
  const unique = [...new Set(cleaned.flat())];
  let vectors: number[][] | null = null;
  try {
    vectors = await embedItems(space, unique);
  } catch {
    vectors = null; // spaces without raw vectors fall back to per-participant matrices
  }
  const index = new Map<string, number>(unique.map((w, i) => [w, i]));
  const out: DatScore[] = [];
  for (let i = 0; i < records.length; i++) {
    const used = cleaned[i]!;
    if (used.length < 2) { out.push({ study: records[i]!.study, id: records[i]!.id, used, score: 0 }); continue; }
    let score: number;
    if (vectors) {
      score = datScore(used.map((w) => vectors![index.get(w)!]!));
    } else {
      const sim = await space.similarityMatrix(used);
      score = datScoreMatrix(sim);
    }
    out.push({ study: records[i]!.study, id: records[i]!.id, used, score });
  }
  return out;
}

function datScoreMatrix(sim: readonly (readonly number[])[]): number {
  if (sim.length < 2) return 0;
  let sum = 0, count = 0;
  for (let i = 0; i < sim.length; i++) for (let j = i + 1; j < sim.length; j++) { sum += 1 - sim[i]![j]!; count++; }
  return count === 0 ? 0 : (sum / count) * 100;
}

/** Seeded, order-stable subsample used to keep the embedding bill bounded. */
export function subsample<T>(items: readonly T[], size: number, seed: number): T[] {
  if (size >= items.length) return items.slice();
  const idx = items.map((_, i) => i);
  let state = (seed >>> 0) || 1;
  for (let i = idx.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, size).sort((a, b) => a - b).map((i) => items[i]!);
}

// ---------------------------------------------------------------------------
// Machine vs human comparison
// ---------------------------------------------------------------------------

export interface Distribution {
  n: number;
  mean: number;
  sd: number;
  median: number;
  q10: number;
  q90: number;
}

export function describe(xs: readonly number[]): Distribution {
  return { n: xs.length, mean: mean(xs), sd: sd(xs), median: quantile(xs, 0.5), q10: quantile(xs, 0.1), q90: quantile(xs, 0.9) };
}

export interface Comparison {
  machine: Distribution;
  human: Distribution;
  /** Cliff's delta of machine scores against human scores: +1 machine always higher, -1 always lower. */
  cliffsDelta: number;
  /** Where the machine mean sits in the human distribution, in [0,1]. */
  machineMeanPercentile: number;
  /** Where the machine maximum sits in the human distribution. */
  machineMaxPercentile: number;
  /** P(machine score > random human score), the probabilistic index behind Cliff's delta. */
  superiorityProbability: number;
}

export function compareToHuman(machine: readonly number[], human: readonly number[]): Comparison {
  return {
    machine: describe(machine),
    human: describe(human),
    cliffsDelta: cliffsDelta(machine, human),
    machineMeanPercentile: percentileRank(mean(machine), human),
    machineMaxPercentile: percentileRank(Math.max(...machine), human),
    superiorityProbability: (cliffsDelta(machine, human) + 1) / 2
  };
}
