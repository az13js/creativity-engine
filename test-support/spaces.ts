/** Deterministic SemanticSpace fixtures for unit tests: no network, no randomness. */
import type { SemanticSpace } from "../../src/core/semantic-space.ts";

export interface ClusterSpec { [word: string]: string }

/** Similarity 1.0 for the same word, 0.9 inside a cluster, 0.1 across clusters, 0 for unknown (OOV). */
export class ClusterSpace implements SemanticSpace {
  readonly name = "cluster-fixture";
  private cluster: Map<string, string>;
  constructor(spec: ClusterSpec) { this.cluster = new Map(Object.entries(spec)); }
  similarity(a: string, b: string): number {
    if (a === b) return 1;
    const ca = this.cluster.get(a), cb = this.cluster.get(b);
    if (ca === undefined || cb === undefined) return 0;
    return ca === cb ? 0.9 : 0.1;
  }
  async similarityMatrix(items: readonly string[]): Promise<number[][]> {
    return items.map((a) => items.map((b) => this.similarity(a, b)));
  }
}

/** Similarity supplied per ordered pair; anything unspecified is 0.1. */
export class TableSpace implements SemanticSpace {
  readonly name = "table-fixture";
  private table: Map<string, number>;
  private dflt: number;
  constructor(pairs: [string, string, number][], dflt = 0.1) {
    this.table = new Map(pairs.map(([a, b, s]) => [a + "|" + b, s]));
    this.dflt = dflt;
  }
  similarity(a: string, b: string): number {
    if (a === b) return 1;
    return this.table.get(a + "|" + b) ?? this.table.get(b + "|" + a) ?? this.dflt;
  }
  async similarityMatrix(items: readonly string[]): Promise<number[][]> {
    return items.map((a) => items.map((b) => this.similarity(a, b)));
  }
}
