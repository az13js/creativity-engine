/** Vector and matrix distance helpers. Pure functions: no I/O, no randomness. */

export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) throw new Error("cosine: dimension mismatch " + a.length + " vs " + b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i]!, y = b[i]!; dot += x * y; na += x * x; nb += y * y; }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

/** Similarity in [0,1] from cosine in [-1,1]; safer for averaging across spaces. */
export function rescaledCosine(a: readonly number[], b: readonly number[]): number { return (cosine(a, b) + 1) / 2; }

export function similarityMatrix(vectors: readonly (readonly number[])[]): number[][] {
  const n = vectors.length;
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    m[i]![i] = 1;
    for (let j = i + 1; j < n; j++) { const s = cosine(vectors[i]!, vectors[j]!); m[i]![j] = s; m[j]![i] = s; }
  }
  return m;
}

/** Mean of the off-diagonal similarities. Higher = more homogeneous set. */
export function meanPairwiseSimilarity(m: readonly (readonly number[])[]): number {
  const n = m.length;
  if (n < 2) return 0;
  let sum = 0, count = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { sum += m[i]![j]!; count++; }
  return count === 0 ? 0 : sum / count;
}

/** Mean off-diagonal cosine distance (1 - similarity): the Divergent Association Task style dispersion measure. */
export function meanPairwiseDistance(m: readonly (readonly number[])[]): number { return 1 - meanPairwiseSimilarity(m); }

/**
 * Agglomerative average-linkage clustering on a similarity matrix.
 * Deterministic: ties are broken by the lowest item index. Returns cluster id per item.
 */
export function agglomerativeClusters(sim: readonly (readonly number[])[], distanceThreshold = 0.45): number[] {
  const n = sim.length;
  if (n === 0) return [];
  const clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);
  const dist = (a: number[], b: number[]): number => {
    let s = 0, c = 0;
    for (const i of a) for (const j of b) { s += sim[i]![j]!; c++; }
    return 1 - (c === 0 ? 0 : s / c);
  };
  while (clusters.length > 1) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = dist(clusters[i]!, clusters[j]!);
        if (d < bestD - 1e-12) { bestD = d; best = [i, j]; }
      }
    }
    if (best === null || bestD > distanceThreshold) break;
    const [i, j] = best;
    clusters[i] = clusters[i]!.concat(clusters[j]!);
    clusters.splice(j, 1);
  }
  const labels = new Array(n).fill(0);
  clusters.forEach((c, idx) => { for (const i of c) labels[i] = idx; });
  return labels;
}

export function countClusters(labels: readonly number[]): number { return new Set(labels).size; }
