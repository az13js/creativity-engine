/**
 * Alternative Uses Test (AUT) scoring, following the four classic divergent-thinking
 * dimensions plus a semantic novelty component:
 *   fluency      = number of distinct valid uses
 *   flexibility  = number of distinct categories (lexicon rules and/or clustering)
 *   originality  = 1 - max similarity to the nearest answer in a reference set of common answers
 *   elaboration  = normalised detail (length + mechanism/variation markers)
 * The composite "DT index" is an explicit, configurable weighted mean; weights are
 * recorded with every report so results stay interpretable.
 */
import { lexiconFlexibility, type CategoryLexicon, type FlexibilityResult } from "./flexibility.ts";
import type { SemanticSpace } from "./semantic-space.ts";
import { dedupeNear, normalize, tokenize } from "./text.ts";
import { round } from "./stats.ts";

export interface AutReferenceAnswer { text: string; count?: number }
export interface AutScoringOptions {
  object: string;
  responses: readonly string[];
  reference?: readonly AutReferenceAnswer[];
  lexicon?: CategoryLexicon;
  space?: SemanticSpace;
  weights?: Partial<DtwWeights>;
  fluencyTarget?: number;
  elaborationTarget?: number;
}
export interface DtwWeights { fluency: number; flexibility: number; originality: number; elaboration: number }
export const DEFAULT_WEIGHTS: DtwWeights = { fluency: 0.2, flexibility: 0.25, originality: 0.4, elaboration: 0.15 };

const MECHANISM_MARKERS = ["因为", "通过", "利用", "使得", "从而", "借助", "改成", "加上", "结合", "instead", "because", "using", "converted", "attached", "combined", "reused"];
const VARIETY_MARKERS = ["不同", "多种", "各种", "大小", "形状", "颜色", "位置", "角度", "various", "different", "any", "multiple"];

export interface AutResponseScore { text: string; valid: boolean; reason?: string; category?: string; originality: number; elaboration: number }
export interface AutReport {
  object: string;
  fluency: number;
  flexibility: number;
  meanOriginality: number;
  maxOriginality: number;
  elaboration: number;
  invalid: number;
  dtIndex: number;
  weights: DtwWeights;
  flexibilitySource: "lexicon" | "clustering" | "none";
  responses: AutResponseScore[];
  categories: Record<string, string[]>;
}

function isEchoOfObject(text: string, object: string): boolean {
  const t = normalize(text), o = normalize(object);
  if (t === o) return true;
  return t.length <= o.length + 1 && t.includes(o);
}

export function validity(text: string, object: string): { valid: boolean; reason?: string } {
  const t = text.trim();
  if (t.length < 2) return { valid: false, reason: "过短" };
  if (t.length > 300) return { valid: false, reason: "过长" };
  if (isEchoOfObject(t, object)) return { valid: false, reason: "重复物品名称" };
  return { valid: true };
}

export function elaborationScore(text: string, target = 12): number {
  const toks = tokenize(text).length;
  const lengthPart = Math.min(1, toks / target);
  const hasMechanism = MECHANISM_MARKERS.some((m) => text.toLowerCase().includes(m)) ? 0.25 : 0;
  const hasVariety = VARIETY_MARKERS.some((m) => text.toLowerCase().includes(m)) ? 0.15 : 0;
  return Math.min(1, lengthPart + hasMechanism + hasVariety);
}

export async function scoreAut(opts: AutScoringOptions): Promise<AutReport> {
  const weights: DtwWeights = { ...DEFAULT_WEIGHTS, ...(opts.weights ?? {}) };
  const object = opts.object;
  const raw = (opts.responses ?? []).map((r) => r.trim()).filter(Boolean);
  const deduped = dedupeNear(raw, 0.85);
  const kept: string[] = [];
  const scores: AutResponseScore[] = [];
  let invalid = 0;
  for (const r of deduped) {
    const v = validity(r, object);
    if (!v.valid) { invalid++; scores.push({ text: r, valid: false, reason: v.reason, originality: 0, elaboration: 0 }); continue; }
    kept.push(r);
  }

  let flex: FlexibilityResult = { categories: 0, labels: [], byCategory: {} };
  let flexibilitySource: AutReport["flexibilitySource"] = "none";
  if (opts.lexicon && kept.length > 0) { flex = lexiconFlexibility(kept, opts.lexicon); flexibilitySource = "lexicon"; }

  let originalityByText = new Map<string, number>();
  if (opts.reference && opts.reference.length > 0 && opts.space && kept.length > 0) {
    const refs = opts.reference.map((r) => r.text);
    const sim = await opts.space.similarityMatrix([...kept, ...refs]);
    kept.forEach((text, i) => {
      let maxSim = -Infinity;
      for (let j = 0; j < refs.length; j++) maxSim = Math.max(maxSim, sim[i]![kept.length + j]!);
      originalityByText.set(text, 1 - maxSim);
    });
  } else {
    for (const t of kept) originalityByText.set(t, 0.5);
  }

  for (const text of kept) {
    const category = flex.labels[kept.indexOf(text)];
    scores.push({ text, valid: true, category, originality: originalityByText.get(text) ?? 0.5, elaboration: elaborationScore(text, opts.elaborationTarget) });
  }

  const fluencyTarget = opts.fluencyTarget ?? 10;
  const fluencyNorm = Math.min(1, kept.length / fluencyTarget);
  const flexNorm = Math.min(1, flex.categories / Math.max(1, Math.min(kept.length, fluencyTarget)));
  const origs = kept.map((t) => originalityByText.get(t) ?? 0.5);
  const meanOrig = origs.length ? origs.reduce((a, b) => a + b, 0) / origs.length : 0;
  const maxOrig = origs.length ? Math.max(...origs) : 0;
  const elab = scores.filter((s) => s.valid).length ? scores.filter((s) => s.valid).reduce((a, s) => a + s.elaboration, 0) / scores.filter((s) => s.valid).length : 0;

  const dtIndex = weights.fluency * fluencyNorm + weights.flexibility * flexNorm + weights.originality * meanOrig + weights.elaboration * elab;
  return {
    object,
    fluency: kept.length,
    flexibility: flex.categories,
    meanOriginality: round(meanOrig, 4),
    maxOriginality: round(maxOrig, 4),
    elaboration: round(elab, 4),
    invalid,
    dtIndex: round(dtIndex, 4),
    weights,
    flexibilitySource,
    responses: scores,
    categories: flex.byCategory
  };
}
