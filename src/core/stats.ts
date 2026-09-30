/** Descriptive statistics and paired comparisons, all seeded for reproducibility. */
import { Rng } from "./random.ts";

export function mean(xs: readonly number[]): number { return xs.length === 0 ? Number.NaN : xs.reduce((a, b) => a + b, 0) / xs.length; }
export function sd(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
}
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
export function round(x: number, digits = 3): number { const f = 10 ** digits; return Math.round(x * f) / f; }

/** Non-parametric bootstrap confidence interval for the mean. */
export function bootstrapCI(xs: readonly number[], level = 0.95, iterations = 2000, seed = 7): [number, number] {
  if (xs.length < 2) return [Number.NaN, Number.NaN];
  const rng = new Rng(seed);
  const means: number[] = [];
  for (let it = 0; it < iterations; it++) {
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += xs[Math.floor(rng.float() * xs.length)]!;
    means.push(s / xs.length);
  }
  means.sort((a, b) => a - b);
  const lo = means[Math.floor((1 - level) / 2 * iterations)]!;
  const hi = means[Math.min(iterations - 1, Math.floor((1 + level) / 2 * iterations))]!;
  return [lo, hi];
}

export function cohensD(a: readonly number[], b: readonly number[]): number {
  const na = a.length, nb = b.length;
  if (na < 2 || nb < 2) return Number.NaN;
  const sp = Math.sqrt(((na - 1) * sd(a) ** 2 + (nb - 1) * sd(b) ** 2) / (na + nb - 2));
  return sp === 0 ? 0 : (mean(a) - mean(b)) / sp;
}

/** Cliff's delta: probability-of-superiority effect size, robust to non-normality. */
export function cliffsDelta(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length === 0) return Number.NaN;
  let gt = 0, lt = 0;
  for (const x of a) for (const y of b) { if (x > y) gt++; else if (x < y) lt++; }
  return (gt - lt) / (a.length * b.length);
}

/** Pearson product-moment correlation. Returns NaN when either side has no variance. */
export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return Number.NaN;
  const mx = mean(xs.slice(0, n)), my = mean(ys.slice(0, n));
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return Number.NaN;
  return sxy / Math.sqrt(sxx * syy);
}

/** Ranks with average ties, the standard input for Spearman's rho. */
export function ranks(xs: readonly number[]): number[] {
  const order = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
  const out = new Array<number>(xs.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.v === order[i]!.v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k]!.i] = avg;
    i = j + 1;
  }
  return out;
}

/** Spearman rank correlation, robust to the monotone-but-nonlinear ratings judges give. */
export function spearman(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return Number.NaN;
  return pearson(ranks(xs.slice(0, n)), ranks(ys.slice(0, n)));
}

/** Fraction of the sample at or below the value, in [0,1]: the human percentile of a machine score. */
export function percentileRank(value: number, sample: readonly number[]): number {
  if (sample.length === 0) return Number.NaN;
  let below = 0, equal = 0;
  for (const x of sample) { if (x < value) below++; else if (x === value) equal++; }
  return (below + 0.5 * equal) / sample.length;
}

/** Linear-interpolated quantile (0..1), matching the usual "type 7" definition. */
export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return Number.NaN;
  const s = xs.slice().sort((a, b) => a - b);
  const pos = (s.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? s[lo]! : s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}
