/**
 * Pluggable semantic similarity. The benchmark scores novelty and diversity with
 * cosine similarity, so every scorer accepts a SemanticSpace:
 *  - EmbeddingApiSpace  : production path, calls an OpenAI-compatible /embeddings endpoint
 *  - TfidfSpace         : fully offline lexical fallback (word-overlap based)
 * Tests use small deterministic fixtures through the same interface.
 */
import fs from "node:fs";
import path from "node:path";
import { cosine, similarityMatrix } from "./distance.ts";
import { tokenize } from "./text.ts";

export interface SemanticSpace {
  readonly name: string;
  similarityMatrix(items: readonly string[]): Promise<number[][]>;
}

export interface EmbeddingApiOptions {
  baseURL: string;
  apiKey: string;
  model: string;
  batchSize?: number;
  timeoutMs?: number;
  concurrency?: number;
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

/** OpenAI-compatible embedding endpoint with batching, retry and optional on-disk vector cache. */
export class EmbeddingApiSpace implements SemanticSpace {
  readonly name: string;
  private memo = new Map<string, number[]>();
  private cacheFile: string | null;
  private cacheDirty = false;

  private opts: EmbeddingApiOptions;
  constructor(opts: EmbeddingApiOptions, cacheFile?: string) {
    this.opts = opts;
    this.name = "embeddings:" + opts.model;
    this.cacheFile = cacheFile ?? null;
    if (this.cacheFile && fs.existsSync(this.cacheFile)) {
      for (const line of fs.readFileSync(this.cacheFile, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const rec = JSON.parse(line) as { k: string; v: number[] };
          this.memo.set(rec.k, rec.v);
        } catch { /* ignore corrupt cache lines */ }
      }
    }
  }

  private key(text: string): string { return this.opts.model + "\u0000" + text; }

  async embed(items: readonly string[]): Promise<number[][]> {
    const missing = items.filter((t) => !this.memo.has(this.key(t)));
    const batchSize = this.opts.batchSize ?? 32;
    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize);
      const vectors = await this.request(batch);
      batch.forEach((t, k) => this.memo.set(this.key(t), vectors[k]!));
      this.cacheDirty = true;
    }
    if (items.length === 0) return [];
    return items.map((t) => this.memo.get(this.key(t))!);
  }

  private async request(batch: readonly string[]): Promise<number[][]> {
    const timeout = this.opts.timeoutMs ?? 60_000;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(this.opts.baseURL.replace(/\/$/, "") + "/embeddings", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + this.opts.apiKey },
          body: JSON.stringify({ model: this.opts.model, input: batch }),
          signal: ctrl.signal
        });
        if (!res.ok) throw new Error("embeddings HTTP " + res.status + ": " + (await res.text()).slice(0, 200));
        const json = (await res.json()) as { data: { embedding: number[]; index?: number }[] };
        const out: number[][] = new Array(batch.length);
        json.data.forEach((d, i) => { out[d.index ?? i] = d.embedding; });
        if (out.some((v) => !v)) throw new Error("embeddings response missing vectors");
        return out;
      } catch (err) {
        lastErr = err;
        await sleep(500 * 2 ** attempt);
      } finally { clearTimeout(timer); }
    }
    throw new Error("embedding request failed after retries: " + String(lastErr));
  }

  async similarityMatrix(items: readonly string[]): Promise<number[][]> {
    const vecs = await this.embed(items);
    return similarityMatrix(vecs);
  }

  flush(): void {
    if (!this.cacheFile || !this.cacheDirty) return;
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    const lines: string[] = [];
    for (const [k, v] of this.memo) lines.push(JSON.stringify({ k, v }));
    fs.writeFileSync(this.cacheFile, lines.join("\n") + "\n");
    this.cacheDirty = false;
  }
}

/** Offline lexical space: TF-IDF cosine over the supplied reference documents. No network, fully deterministic. */
export class TfidfSpace implements SemanticSpace {
  readonly name = "tfidf";
  private idf = new Map<string, number>();
  private docs: Map<string, number>[] = [];
  private static readonly MAX_FEATURES = 20_000;

  constructor(corpus: readonly string[]) { this.fit(corpus); }

  private static termFreq(tokens: readonly string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return tf;
  }

  private fit(corpus: readonly string[]): void {
    const tfs = corpus.map((d) => TfidfSpace.termFreq(tokenize(d)));
    const df = new Map<string, number>();
    for (const tf of tfs) for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    const ranked = [...df.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, TfidfSpace.MAX_FEATURES);
    for (const [t, n] of ranked) this.idf.set(t, Math.log((corpus.length + 1) / (n + 1)) + 1);
    this.docs = tfs.map((tf) => this.vectorFromTf(tf));
  }

  private vectorFromTf(tf: Map<string, number>): Map<string, number> {
    const v = new Map<string, number>();
    let norm = 0;
    for (const [t, f] of tf) {
      const idf = this.idf.get(t);
      if (idf === undefined) continue;
      const w = (1 + Math.log(f)) * idf;
      v.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of v) v.set(t, w / norm);
    return v;
  }

  toVector(text: string): Map<string, number> { return this.vectorFromTf(TfidfSpace.termFreq(tokenize(text))); }

  static mapCosine(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): number {
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    let dot = 0;
    for (const [t, w] of small) { const o = big.get(t); if (o !== undefined) dot += w * o; }
    return dot;
  }

  similarity(a: string, b: string): number { return TfidfSpace.mapCosine(this.toVector(a), this.toVector(b)); }

  async similarityMatrix(items: readonly string[]): Promise<number[][]> {
    const vecs = items.map((t) => this.toVector(t));
    const n = items.length;
    const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) { m[i]![i] = 1; for (let j = i + 1; j < n; j++) { const s = TfidfSpace.mapCosine(vecs[i]!, vecs[j]!); m[i]![j] = s; m[j]![i] = s; } }
    return m;
  }
}

/** Best-effort raw vector access for visualisation: works for embedding spaces and unwraps caches. */
export async function embedItems(space: SemanticSpace, items: readonly string[]): Promise<number[][]> {
  const candidate = space as unknown as { embed?: (x: readonly string[]) => Promise<number[][]>; inner?: SemanticSpace };
  if (typeof candidate.embed === "function") return candidate.embed(items);
  if (candidate.inner) return embedItems(candidate.inner, items);
  throw new Error("semantic space " + space.name + " cannot produce raw vectors");
}

export { cosine };