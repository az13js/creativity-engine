/**
 * Flexibility (a.k.a. "categories of response" in the Torrance tradition) and
 * diversity of a response set.
 *  - LexiconFlexibility: keyword rules map a response to a semantic category.
 *  - ClusterFlexibility: unsupervised fallback that clusters the responses by
 *    semantic similarity, so flexibility can be measured without a hand-built lexicon.
 */
import { agglomerativeClusters, countClusters } from "./distance.ts";
import type { SemanticSpace } from "./semantic-space.ts";
import { normalize } from "./text.ts";

export interface CategoryRule { category: string; patterns: (string | RegExp)[] }
export type CategoryLexicon = readonly CategoryRule[];

function matches(text: string, rule: CategoryRule): boolean {
  const t = normalize(text);
  return rule.patterns.some((p) => (typeof p === "string" ? t.includes(normalize(p)) : p.test(text)));
}

export interface FlexibilityResult {
  categories: number;
  labels: string[];
  byCategory: Record<string, string[]>;
}

export function lexiconFlexibility(responses: readonly string[], lexicon: CategoryLexicon, fallback = "其他"): FlexibilityResult {
  const byCategory: Record<string, string[]> = {};
  const labels: string[] = [];
  for (const r of responses) {
    const rule = lexicon.find((x) => matches(r, x));
    const label = rule?.category ?? fallback;
    labels.push(label);
    (byCategory[label] ??= []).push(r);
  }
  return { categories: new Set(labels).size, labels, byCategory };
}

export interface ClusterFlexibilityOptions { threshold?: number }

export async function clusterFlexibility(responses: readonly string[], space: SemanticSpace, opts: ClusterFlexibilityOptions = {}): Promise<FlexibilityResult> {
  if (responses.length === 0) return { categories: 0, labels: [], byCategory: {} };
  const sim = await space.similarityMatrix(responses);
  const labels = agglomerativeClusters(sim, opts.threshold ?? 0.45);
  const byCategory: Record<string, string[]> = {};
  responses.forEach((r, i) => { (byCategory["簇" + labels[i]] ??= []).push(r); });
  return { categories: countClusters(labels), labels: labels.map((l) => "簇" + l), byCategory };
}
