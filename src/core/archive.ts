/**
 * Quality-Diversity archive in the style of MAP-Elites: ideas are filed into a grid
 * over interpretable descriptors (e.g. novelty x feasibility) and each cell keeps
 * its best-scoring elite. The archive prevents the "one best idea" collapse that
 * plagues single-objective creativity loops and is the mechanism-level answer to
 * originality-vs-usefulness trade-offs.
 */
export interface ArchiveEntry<T> { item: T; descriptor: number[]; objective: number; cell: string }

export interface ArchiveOptions {
  /** Bin edges per descriptor dimension, e.g. [[0,0.5,1],[0,0.5,1]]. Values outside are clamped to the nearest bin. */
  edges: number[][];
}

export class QualityDiversityArchive<T> {
  private cells = new Map<string, ArchiveEntry<T>>();
  private edges: number[][];
  constructor(edges: number[][]) { this.edges = edges; }

  private binOf(dim: number, value: number): number {
    const e = this.edges[dim]!;
    for (let i = 0; i < e.length - 1; i++) if (value < e[i + 1]!) return i;
    return e.length - 1;
  }

  cellOf(descriptor: readonly number[]): string { return descriptor.map((v, d) => this.binOf(d, v)).join("-"); }

  add(item: T, descriptor: readonly number[], objective: number): { accepted: boolean; replaced: boolean; cell: string } {
    const cell = this.cellOf(descriptor);
    const cur = this.cells.get(cell);
    if (cur && cur.objective >= objective) return { accepted: false, replaced: false, cell };
    const replaced = cur !== undefined;
    this.cells.set(cell, { item, descriptor: [...descriptor], objective, cell });
    return { accepted: true, replaced, cell };
  }

  elites(): ArchiveEntry<T>[] { return [...this.cells.values()]; }
  get size(): number { return this.cells.size; }
  coverage(): number {
    const total = this.edges.reduce((acc, e) => acc * Math.max(1, e.length - 1), 1);
    return this.size / total;
  }
  /** Sum of elite objectives: the standard QD-score, rewarding quality and coverage at once. */
  qdScore(): number { return this.elites().reduce((a, e) => a + e.objective, 0); }
}
