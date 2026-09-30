/**
 * Novelty of an idea measured as distance from a reference set of known solutions
 * (the operational definition used by the "novelty search" literature):
 *     novelty(idea) = 1 - max cosine similarity to any reference solution
 * Raw cosine is used (embeddings of natural language are nearly always positively
 * correlated, so novelty = 1 - max cosine lies in [0,1] in practice). `npm run bench`
 * additionally reports a random-word baseline so the score can be read relatively.
 */
import { TfidfSpace, type SemanticSpace } from "./semantic-space.ts";
import { mean } from "./stats.ts";

export interface NoveltyResult {
  /** 1 - max similarity to the reference set. */
  novelty: number;
  /** Similarity to the nearest known solution. */
  nearestSimilarity: number;
  /** Index of the nearest reference item, -1 when the reference set is empty. */
  nearestIndex: number;
  /** Mean distance to the closest K references (K default 3): rewards staying away from an entire neighbourhood, not just one point. */
  meanDistanceToNearestK: number;
}

export class NoveltyScorer {
  private reference: readonly string[];
  private space: SemanticSpace;
  private nearK: number;
  constructor(reference: readonly string[], space: SemanticSpace, nearK = 3) {
    this.reference = reference; this.space = space; this.nearK = nearK;
  }

  async scoreAll(items: readonly string[]): Promise<NoveltyResult[]> {
    if (this.reference.length === 0) return items.map(() => ({ novelty: 1, nearestSimilarity: 0, nearestIndex: -1, meanDistanceToNearestK: 1 }));
    const all = [...items, ...this.reference];
    const sim = await this.space.similarityMatrix(all);
    const n = items.length;
    return items.map((_, i) => {
      const sims: { s: number; j: number }[] = [];
      for (let j = 0; j < this.reference.length; j++) sims.push({ s: sim[i]![n + j]!, j });
      sims.sort((a, b) => b.s - a.s || a.j - b.j);
      const nearest = sims[0]!;
      const k = Math.min(this.nearK, sims.length);
      const meanTop = mean(sims.slice(0, k).map((x) => x.s));
      return { novelty: 1 - nearest.s, nearestSimilarity: nearest.s, nearestIndex: nearest.j, meanDistanceToNearestK: 1 - meanTop };
    });
  }

  /** Convenience for callers that only need lexical novelty and no network access. */
  static lexical(reference: readonly string[], nearK = 3): NoveltyScorer { return new NoveltyScorer(reference, new TfidfSpace(reference), nearK); }
}

export { TfidfSpace };
