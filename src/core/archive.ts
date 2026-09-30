/**
 * Quality-Diversity archive in the style of MAP-Elites: ideas are filed into a grid
 * over interpretable descriptors (e.g. novelty x feasibility) and each cell keeps
 * its best-scoring elite. The archive prevents the "one best idea" collapse that
 * plagues single-objective creativity loops and is the mechanism-level answer to
 * originality-vs-usefulness trade-offs.
 */
export interface ArchiveEntry<T> { item: T; descriptor: number[]; objective: number; cell: string; key?: string }

export interface ArchiveOptions {
  /** Bin edges per descriptor dimension, e.g. [[0,0.5,1],[0,0.5,1]]. Values outside are clamped to the nearest bin. */
  edges: number[][];
}

export class QualityDiversityArchive<T> {
  private cells = new Map<string, ArchiveEntry<T>>();
  /** Item identity -> occupied cell, so re-filing the same item never leaves a stale copy behind. */
  private keyToCell = new Map<string, string>();
  private edges: number[][];
  constructor(edges: number[][]) { this.edges = edges; }

  private binOf(dim: number, value: number): number {
    const e = this.edges[dim]!;
    for (let i = 0; i < e.length - 1; i++) if (value < e[i + 1]!) return i;
    return e.length - 1;
  }

  cellOf(descriptor: readonly number[]): string { return descriptor.map((v, d) => this.binOf(d, v)).join("-"); }

  /**
   * File an item into the grid. `key` identifies the item itself: filing the same item again
   * (for example after the critic revised its feasibility) moves it instead of duplicating it.
   */
  add(item: T, descriptor: readonly number[], objective: number, key?: string): { accepted: boolean; replaced: boolean; cell: string } {
    const cell = this.cellOf(descriptor);
    const cur = this.cells.get(cell);
    if (cur && cur.objective >= objective) return { accepted: false, replaced: false, cell };
    const replaced = cur !== undefined;
    if (cur?.key !== undefined && this.keyToCell.get(cur.key) === cell) this.keyToCell.delete(cur.key);
    if (key !== undefined) {
      const prev = this.keyToCell.get(key);
      if (prev !== undefined && prev !== cell && this.cells.get(prev)?.key === key) this.cells.delete(prev);
      this.keyToCell.set(key, cell);
    }
    this.cells.set(cell, { item, descriptor: [...descriptor], objective, cell, key });
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