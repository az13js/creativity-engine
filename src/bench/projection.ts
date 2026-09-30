/**
 * Two-dimensional projection for visualising the explored idea space.
 * Uses kernel PCA on the Gram matrix so it works for 4096-dimensional embeddings
 * without ever materialising a D x D covariance matrix. Deterministic.
 */

export interface ProjectionPoint { x: number; y: number }

export interface Projection {
  points: ProjectionPoint[];
  /** Share of total variance carried by each of the two axes (eigenvalue / trace). */
  explained: [number, number];
}

function gram(vectors: readonly (readonly number[])[]): number[][] {
  const n = vectors.length;
  const mean = new Array(vectors[0]?.length ?? 0).fill(0);
  for (const v of vectors) for (let d = 0; d < v.length; d++) mean[d] += v[d]! / n;
  const centered = vectors.map((v) => v.map((x, d) => x - mean[d]!));
  const K: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    let s = 0;
    const a = centered[i]!, b = centered[j]!;
    for (let d = 0; d < a.length; d++) s += a[d]! * b[d]!;
    K[i]![j] = s; K[j]![i] = s;
  }
  return K;
}

function matVec(K: readonly (readonly number[])[], v: readonly number[], n: number): number[] {
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) { let s = 0; const row = K[i]!; for (let j = 0; j < n; j++) s += row[j]! * v[j]!; out[i] = s; }
  return out;
}

function norm(v: readonly number[]): number { return Math.sqrt(v.reduce((a, x) => a + x * x, 0)); }

function powerIteration(K: number[][], n: number, iterations = 200, start?: number[]): { u: number[]; lambda: number } {
  let u = start ? start.slice() : new Array(n).fill(0).map((_, i) => Math.sin(i + 1) + 1);
  let lambda = 0;
  for (let it = 0; it < iterations; it++) {
    const Ku = matVec(K, u, n);
    const nrm = norm(Ku);
    if (nrm === 0) break;
    u = Ku.map((x) => x / nrm);
    lambda = nrm;
  }
  return { u, lambda };
}

export function project2d(vectors: readonly (readonly number[])[]): Projection {
  const n = vectors.length;
  if (n === 0) return { points: [], explained: [0, 0] };
  if (n === 1) return { points: [{ x: 0, y: 0 }], explained: [1, 0] };
  const K = gram(vectors);
  const n2 = n;
  const first = powerIteration(K, n2);
  const deflated = K.map((row, i) => row.map((x, j) => x - first.lambda * first.u[i]! * first.u[j]!));
  const second = powerIteration(deflated, n2);
  const trace = K.reduce((a, row, i) => a + row[i]!, 0) || 1;
  const c1 = Math.sqrt(Math.max(first.lambda, 1e-12));
  const c2 = Math.sqrt(Math.max(second.lambda, 1e-12));
  const Ku1 = matVec(K, first.u, n2);
  const Ku2 = matVec(K, second.u, n2);
  const points = vectors.map((_, i) => ({ x: Ku1[i]! / c1, y: Ku2[i]! / c2 }));
  return { points, explained: [first.lambda / trace, second.lambda / trace] };
}
