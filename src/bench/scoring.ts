/**
 * Turns a RunArtifact into comparable metrics. Every metric here is automatic and
 * deterministic given the run's ideas plus the semantic space; no human or LLM judge
 * is required, which keeps the benchmark reproducible.
 */
import { scoreAut } from "../core/aut.ts";
import { NoveltyScorer } from "../core/novelty.ts";
import { agglomerativeClusters, countClusters, meanPairwiseDistance } from "../core/distance.ts";
import { isSingleWord, dedupeNear } from "../core/text.ts";
import { scoreRat, normalizeAnswer } from "../core/rat.ts";
import { mean } from "../core/stats.ts";
import { Rng, hashString } from "../core/random.ts";
import { elaborationScore } from "../core/aut.ts";
import type { SemanticSpace } from "../core/semantic-space.ts";
import type { IdeaRecord, RunArtifact } from "../agents/types.ts";
import type { BenchTask } from "./tasks.ts";
import { criticMessages } from "../llm/prompts.ts";
import type { LlmLike } from "../agents/types.ts";

export interface TaskScore {
  taskId: string;
  configId: string;
  kind: string;
  title: string;
  metrics: Record<string, number>;
  extras?: Record<string, unknown>;
}

function texts(artifact: RunArtifact): string[] { return artifact.ideas.map((i) => i.text); }

/** Fixed-size subsample so diversity/novelty comparisons are not driven by idea count. */
function controlledSample(items: readonly string[], k: number, seed: number): string[] {
  if (items.length <= k) return items.slice();
  return new Rng(seed).sample(items, k);
}

async function diversityMetrics(ideas: readonly string[], space: SemanticSpace): Promise<{ mpd: number; clusters: number }> {
  if (ideas.length < 2) return { mpd: 0, clusters: ideas.length };
  const sim = await space.similarityMatrix(ideas);
  return { mpd: meanPairwiseDistance(sim), clusters: countClusters(agglomerativeClusters(sim, 0.45)) };
}

/** Divergent Association Task: pull up to `count` single words out of the idea texts. */
export function extractDatWords(textsIn: readonly string[], count: number): { words: string[]; validRate: number } {
  const words: string[] = [];
  const seen = new Set<string>();
  for (const t of textsIn) {
    const candidates = t.split(/[^\p{L}\p{Script=Han}'-]+/u).filter(Boolean);
    const pick = candidates.find((c) => isSingleWord(c));
    if (!pick) continue;
    const key = pick.normalize("NFKC").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(pick);
    if (words.length >= count) break;
  }
  const clean = words.filter((w) => !/^[A-Z][a-z]$/.test(w));
  return { words: clean, validRate: count === 0 ? 0 : clean.length / count };
}

export interface ScoringContext {
  space: SemanticSpace;
  datCalibration?: readonly string[];
  /** Optional LLM-as-judge applied identically to every config, for the usefulness column. */
  judge?: { client: LlmLike; tag: string };
}

export interface FeasibilityReview { feasibility: number; impact: number; failureMode?: string }

/**
 * Usefulness is the second axis of the novelty-usefulness trade-off. The same critic
 * prompt is applied to every config's ideas, so the comparison stays fair. Scores are
 * normalised from the 0-10 rubric to [0,1].
 */
export async function judgeFeasibility(client: LlmLike, task: string, ideas: readonly string[], tag: string): Promise<FeasibilityReview[]> {
  if (ideas.length === 0) return [];
  const { value } = await client.json<{ reviews?: { index?: number; feasibility?: number; impact?: number; failure_mode?: string }[] }>(
    criticMessages(task, ideas), { temperature: 0, maxTokens: 2600, tag: "feasibility-judge:" + tag });
  const reviews = value.reviews ?? [];
  return ideas.map((_, i) => {
    const r = reviews.find((x) => (x.index ?? 0) === i + 1);
    return {
      feasibility: typeof r?.feasibility === "number" ? Math.max(0, Math.min(1, r.feasibility / 10)) : 0.5,
      impact: typeof r?.impact === "number" ? Math.max(0, Math.min(1, r.impact / 10)) : 0.5,
      failureMode: typeof r?.failure_mode === "string" ? r.failure_mode : undefined
    };
  });
}

export async function scoreArtifact(task: BenchTask, artifact: RunArtifact, ctx: ScoringContext): Promise<TaskScore> {
  const all = texts(artifact);
  const unique = dedupeNear(all, 0.9);
  let reviewDetail: unknown = undefined;
  const { mpd, clusters } = await diversityMetrics(unique, ctx.space);
  const ctrlSize = 12;
  const ctrl = controlledSample(unique, ctrlSize, hashString(task.id + "|" + artifact.configId));
  const ctrlDiv = await diversityMetrics(ctrl, ctx.space);
  const base: Record<string, number> = {
    nIdeas: all.length,
    nUnique: unique.length,
    meanPairwiseDistance: Number(mpd.toFixed(4)),
    clusters,
    // Size-controlled variants (same sample size for every config) keep comparisons fair.
    ctrl_n: ctrl.length,
    ctrl_meanPairwiseDistance: Number(ctrlDiv.mpd.toFixed(4)),
    ctrl_clusters: ctrlDiv.clusters
  };

  if (task.kind === "aut" || task.kind === "brief") {
    const noveltyScorer = new NoveltyScorer(task.knownSolutions ?? (task.reference ?? []).map((r) => r.text), ctx.space);
    const novelty = await noveltyScorer.scoreAll(unique);
    base.meanNovelty = Number(mean(novelty.map((n) => n.novelty)).toFixed(4));
    base.maxNovelty = Number(Math.max(0, ...novelty.map((n) => n.novelty)).toFixed(4));
    base.meanElaboration = Number(mean(unique.map((t) => elaborationScore(t))).toFixed(4));
    const ctrlNovelty = await noveltyScorer.scoreAll(ctrl);
    base.ctrl_meanNovelty = Number(mean(ctrlNovelty.map((n) => n.novelty)).toFixed(4));
    if (ctx.judge && unique.length > 0) {
      const reviews = await judgeFeasibility(ctx.judge.client, task.prompt, unique, task.id + "/" + artifact.configId);
      base.meanFeasibility = Number(mean(reviews.map((r) => r.feasibility)).toFixed(4));
      base.meanImpact = Number(mean(reviews.map((r) => r.impact)).toFixed(4));
      // Product form: an idea set scores badly if it is novel but useless, or useful but trite.
      base.noveltyUsefulness = Number((base.meanNovelty! * base.meanFeasibility!).toFixed(4));
      reviewDetail = unique.map((text, i) => ({
        text, feasibility: reviews[i]!.feasibility, impact: reviews[i]!.impact,
        failureMode: reviews[i]!.failureMode ?? "", chars: text.length,
        novelty: novelty[i]?.novelty ?? null
      }));
    }
  }

  if (task.kind === "aut") {
    const report = await scoreAut({
      object: task.object ?? "",
      responses: all, reference: task.reference, lexicon: task.lexicon, space: ctx.space
    });
    return {
      taskId: task.id, configId: artifact.configId, kind: task.kind, title: task.title,
      metrics: {
        ...base,
        fluency: report.fluency,
        flexibility: report.flexibility,
        meanOriginality: report.meanOriginality,
        maxOriginality: report.maxOriginality,
        elaboration: report.elaboration,
        invalid: report.invalid,
        dtIndex: report.dtIndex
      },
      extras: { weights: report.weights, categories: Object.keys(report.categories), reviews: reviewDetail }
    };
  }

  if (task.kind === "dat") {
    const count = task.datCount ?? 10;
    const { words } = extractDatWords(all, count);
    // Standard DAT procedure (Olson et al. 2021): from the words produced, keep the first
    // seven valid and distinct words, average the 21 pairwise cosine distances, scale by 100.
    const scored = words.slice(0, 7);
    const validRate = count === 0 ? 0 : words.length / count;
    let dispersion = 0, minPair = 0, maxPair = 0;
    if (scored.length >= 2) {
      const sim = await ctx.space.similarityMatrix(scored);
      dispersion = meanPairwiseDistance(sim) * 100;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < scored.length; i++) for (let j = i + 1; j < scored.length; j++) { const s = sim[i]![j]!; lo = Math.min(lo, 1 - s); hi = Math.max(hi, 1 - s); }
      minPair = lo === Infinity ? 0 : lo * 100; maxPair = hi === -Infinity ? 0 : hi * 100;
    }
    let calibrationDispersion: number | undefined;
    if (ctx.datCalibration && ctx.datCalibration.length >= 2) {
      const sim = await ctx.space.similarityMatrix(ctx.datCalibration.slice(0, 7));
      calibrationDispersion = meanPairwiseDistance(sim) * 100;
    }
    return {
      taskId: task.id, configId: artifact.configId, kind: task.kind, title: task.title,
      metrics: {
        ...base,
        wordsGiven: words.length,
        wordsScored: scored.length,
        validRate: Number(validRate.toFixed(4)),
        dispersion: Number(dispersion.toFixed(2)),
        minPairDistance: Number(minPair.toFixed(4)),
        maxPairDistance: Number(maxPair.toFixed(4)),
        calibrationDispersion: calibrationDispersion === undefined ? Number.NaN : Number(calibrationDispersion.toFixed(4)),
        dispersionVsCalibration: calibrationDispersion === undefined ? Number.NaN : Number((dispersion - calibrationDispersion).toFixed(2))
      },
      extras: { words, scored }
    };
  }

  if (task.kind === "rat") {
    const items = task.ratItems ?? [];
    // Answers may be written as "rat-01: cheese" or as a bare answer; both are accepted.
    const parsed: { id: string; answer: string }[] = [];
    for (const t of all) {
      const m = t.match(/(rat-\d+)[\s:=：-]+([A-Za-z][A-Za-z'-]*)/);
      if (m) parsed.push({ id: m[1]!.toLowerCase(), answer: m[2]! });
    }
    const positional = items.map((it, idx) => ({ id: it.id, answer: all[idx] ?? "" }));
    const strictReport = scoreRat(parsed.length >= items.length / 2 ? parsed : positional, items);
    // pass@k: an item counts as solved when any generated candidate contains the answer
    const solved = items.filter((it) => all.some((t) => scoreRat([{ id: it.id, answer: t }], [it]).perItem[0]!.correct)).length;
    return {
      taskId: task.id, configId: artifact.configId, kind: task.kind, title: task.title,
      metrics: {
        ...base,
        strictAccuracy: Number(strictReport.accuracy.toFixed(4)),
        strictSolved: strictReport.correct,
        passAtK: Number((solved / Math.max(1, items.length)).toFixed(4)),
        itemsSolvedByAnyCandidate: solved
      },
      extras: { parseMode: parsed.length >= items.length / 2 ? "tagged" : "positional" }
    };
  }

  // brief
  return {
    taskId: task.id, configId: artifact.configId, kind: task.kind, title: task.title,
    metrics: { ...base }
  };
}

/**
 * Cross-config homogenization audit ("artificial hivemind" check): for every idea of a
 * config, measure how close it is to the closest idea produced by the *other* configs on
 * the same task. Low values mean the config is just repeating what everyone else says.
 * Runs after all cells exist, and is pure post-hoc measurement.
 */
export async function addCrossConfigMetrics(scores: TaskScore[], artifacts: RunArtifact[], space: SemanticSpace): Promise<void> {
  const taskIds = [...new Set(artifacts.map((a) => a.taskId))];
  for (const taskId of taskIds) {
    const arts = artifacts.filter((a) => a.taskId === taskId);
    if (arts.length < 2) continue;
    for (const a of arts) {
      const others = arts.filter((x) => x.configId !== a.configId).flatMap((x) => x.ideas.map((i) => i.text));
      const mine = dedupeNear(a.ideas.map((i) => i.text), 0.9);
      if (others.length === 0 || mine.length === 0) continue;
      const scorer = new NoveltyScorer(others, space, 3);
      const res = await scorer.scoreAll(mine);
      const value = mean(res.map((r) => r.novelty));
      const score = scores.find((x) => x.taskId === taskId && x.configId === a.configId);
      if (score) score.metrics.crossConfigDistinctiveness = Number(value.toFixed(4));
    }
  }
}

export { normalizeAnswer };