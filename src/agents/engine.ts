/**
 * The multi-agent creativity engine.
 *
 * Ring 1 - operators: every generator agent is bound to one established cognitive
 *          operator (SCAMPER / TRIZ / structure mapping / conceptual blending ...),
 *          which is what forces heterogeneity instead of "be creative" prompting.
 * Ring 2 - agents: generators, a conceptual blender, a critic, a meta-reflector.
 *          A breadth-first population per generation, then cross-pollination.
 * Ring 3 - archive: a MAP-Elites style quality-diversity archive keeps the best idea
 *          per niche, so the run ends with a diverse portfolio rather than one answer.
 *
 * An adaptive controller raises temperature and re-picks operators when the measured
 * mean pairwise semantic distance falls below \`diversityFloor\` (mode-collapse guard).
 */
import { Rng } from "../core/random.ts";
import { QualityDiversityArchive } from "../core/archive.ts";
import { NoveltyScorer } from "../core/novelty.ts";
import { agglomerativeClusters, countClusters, meanPairwiseDistance } from "../core/distance.ts";
import { dedupeNear } from "../core/text.ts";
import type { SemanticSpace } from "../core/semantic-space.ts";
import { blenderMessages, criticMessages, generatorMessages, metaMessages, type OperatorCatalog, type OutputStyle } from "../llm/prompts.ts";
import type { IdeaRecord, LlmLike } from "./types.ts";
import { mean } from "../core/stats.ts";

export interface EngineConfig {
  generations: number;
  generators: number;
  ideasPerGenerator: number;
  blendPairs: number;
  temperature: number;
  temperatureStep: number;
  maxTemperature: number;
  seed: number;
  /** Average pairwise semantic distance below this value triggers adaptation. */
  diversityFloor: number;
  /** Number of archived elites offered to the next generation as seeds. */
  seedCount: number;
  /** How many existing ideas are listed as "must avoid" for the next generation. */
  avoidSample: number;
  useCritic: boolean;
  useMetaReflector: boolean;
  maxTokens: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  generations: 3,
  generators: 4,
  ideasPerGenerator: 3,
  blendPairs: 2,
  temperature: 1.0,
  temperatureStep: 0.15,
  maxTemperature: 1.4,
  seed: 20240930,
  diversityFloor: 0.35,
  seedCount: 4,
  avoidSample: 12,
  useCritic: true,
  useMetaReflector: true,
  maxTokens: 2600
};

export interface EngineRunOptions {
  client: LlmLike;
  catalog: OperatorCatalog;
  space: SemanticSpace;
  taskId: string;
  task: string;
  knownSolutions?: readonly string[];
  config?: Partial<EngineConfig>;
  /** Extra constraints injected into every generator prompt (used by ablation configs). */
  extraConstraints?: string[];
  /** Output shape required by the task (sentences, single words, or labelled answers). */
  style?: OutputStyle;
}

export interface EngineResult {
  ideas: IdeaRecord[];
  events: { generation: number; stage: string; detail: string; metric?: number }[];
  generations: { index: number; newIdeas: number; meanPairwiseDistance: number; meanNovelty: number; clusters: number; temperature: number }[];
  archive: { size: number; coverage: number; qdScore: number; elites: IdeaRecord[] };
  adaptations: number;
}

let ideaCounter = 0;
export function resetIdeaCounter(): void { ideaCounter = 0; }

function makeIdea(partial: Omit<IdeaRecord, "id">): IdeaRecord {
  ideaCounter += 1;
  return { id: "i" + ideaCounter, ...partial };
}

export const OBJECTIVE_WEIGHTS = { novelty: 0.45, feasibility: 0.35, impact: 0.2 };

export function objectiveOf(idea: IdeaRecord, w = OBJECTIVE_WEIGHTS): number {
  return w.novelty * (idea.novelty ?? 0.5) + w.feasibility * (idea.feasibility ?? 0.5) + w.impact * (idea.impact ?? 0.5);
}

interface RawIdea { idea?: unknown; rationale?: unknown; text?: unknown }

function normalizeIdeas(payload: { ideas?: RawIdea[] } | RawIdea[] | undefined): { text: string; rationale?: string }[] {
  const list = Array.isArray(payload) ? payload : payload?.ideas;
  if (!Array.isArray(list)) return [];
  const out: { text: string; rationale?: string }[] = [];
  for (const raw of list) {
    if (typeof raw === "string") { out.push({ text: raw.trim() }); continue; }
    if (raw && typeof raw === "object") {
      const t = (raw as RawIdea).idea ?? (raw as RawIdea).text;
      if (typeof t === "string" && t.trim()) out.push({ text: t.trim(), rationale: typeof (raw as RawIdea).rationale === "string" ? (raw as RawIdea).rationale as string : undefined });
    }
  }
  return out.filter((x) => x.text.length >= 2);
}

export async function runCreativeEngine(opts: EngineRunOptions): Promise<EngineResult> {
  const cfg: EngineConfig = { ...DEFAULT_ENGINE_CONFIG, ...(opts.config ?? {}) };
  const rng = new Rng(cfg.seed);
  const client = opts.client;
  const events: EngineResult["events"] = [];
  const all: IdeaRecord[] = [];
  const generations: EngineResult["generations"] = [];
  const archive = new QualityDiversityArchive<IdeaRecord>([[0, 0.34, 0.67, 1.01], [0, 0.34, 0.67, 1.01]]);
  const novelty = new NoveltyScorer(opts.knownSolutions ?? [], opts.space);
  let temperature = cfg.temperature;
  let adaptations = 0;
  let operatorIds = opts.catalog.operators.map((o) => o.id);
  let extraNote: string | undefined;

  const addIdeas = async (records: IdeaRecord[], generation: number): Promise<IdeaRecord[]> => {
    const seen = new Set(all.map((i) => i.text));
    const fresh: IdeaRecord[] = [];
    for (const r of records) {
      // dedupeNear keeps earlier items and drops the candidate when it is a near-duplicate,
      // so the candidate survived iff exactly one more item is kept.
      const kept = dedupeNear([...seen, r.text], 0.82);
      if (kept.length !== seen.size + 1) continue;
      seen.add(r.text);
      r.generation = generation;
      fresh.push(r);
    }
    if (fresh.length > 0) {
      const noveltyScores = await novelty.scoreAll(fresh.map((f) => f.text));
      fresh.forEach((f, i) => { f.novelty = noveltyScores[i]!.novelty; });
    }
    for (const f of fresh) {
      const descriptor = [f.novelty ?? 0.5, f.feasibility ?? 0.5];
      f.objective = objectiveOf(f);
      const res = archive.add(f, descriptor, f.objective, f.id);
      f.cell = res.cell;
    }
    all.push(...fresh);
    return fresh;
  };

  for (let g = 1; g <= cfg.generations; g++) {
    const opIds = rng.shuffle(operatorIds).slice(0, Math.min(cfg.generators, operatorIds.length));
    const ops = opIds.map((id) => opts.catalog.operators.find((o) => o.id === id)!);
    const seeds = archive.elites().sort((a, b) => b.objective - a.objective).slice(0, cfg.seedCount).map((e) => e.item.text);
    const avoid = rng.sample(all.map((i) => i.text), cfg.avoidSample);
    events.push({ generation: g, stage: "diverge", detail: "operators=" + ops.map((o) => o.id).join(",") + " temperature=" + temperature.toFixed(2) });

    const results = await Promise.all(ops.map(async (op, k) => {
      const persona = opts.catalog.personas[(rng.int(opts.catalog.personas.length) + k) % opts.catalog.personas.length]!;
      const stimulus = opts.catalog.stimuli[rng.int(opts.catalog.stimuli.length)]!;
      const messages = generatorMessages({
        task: opts.task, operator: op, persona, stimulus,
        count: cfg.ideasPerGenerator, generation: g, avoid, seeds, style: opts.style,
        extraConstraints: [...(opts.extraConstraints ?? []), ...(extraNote ? [extraNote] : [])]
      });
      try {
        const { value } = await client.json<{ ideas?: RawIdea[] }>(messages, { temperature, maxTokens: cfg.maxTokens, tag: "generator:" + op.id });
        return normalizeIdeas(value).map((x) => makeIdea({
          text: x.text, rationale: x.rationale, taskId: opts.taskId, configId: "engine",
          generation: g, agent: "gen-" + k + "-" + persona.id, operator: op.id, persona: persona.name, stimulus, source: "generate"
        }));
      } catch (err) {
        events.push({ generation: g, stage: "generator-error", detail: op.id + ": " + String(err) });
        return [];
      }
    }));

    let fresh = await addIdeas(results.flat(), g);
    events.push({ generation: g, stage: "collect", detail: "新增 " + fresh.length + " 条想法", metric: fresh.length });

    if (cfg.useCritic && fresh.length > 0) {
      try {
        const { value } = await client.json<{ reviews?: { index?: number; feasibility?: number; novelty?: number; impact?: number; failure_mode?: string }[] }>(
          criticMessages(opts.task, fresh.map((f) => f.text)), { temperature: 0, maxTokens: cfg.maxTokens, tag: "critic" });
        for (const rev of value.reviews ?? []) {
          const idx = (rev.index ?? 0) - 1;
          const target = fresh[idx];
          if (!target) continue;
          target.feasibility = typeof rev.feasibility === "number" ? Math.max(0, Math.min(1, rev.feasibility / 10)) : target.feasibility;
          target.impact = typeof rev.impact === "number" ? Math.max(0, Math.min(1, rev.impact / 10)) : target.impact;
          target.failureMode = typeof rev.failure_mode === "string" ? rev.failure_mode : undefined;
          target.objective = objectiveOf(target);
          archive.add(target, [target.novelty ?? 0.5, target.feasibility ?? 0.5], target.objective, target.id);
        }
        events.push({ generation: g, stage: "critique", detail: "评审 " + (value.reviews?.length ?? 0) + " 条" });
      } catch (err) {
        events.push({ generation: g, stage: "critic-error", detail: String(err) });
      }
    }

    // Cross-pollination: blend ideas that live in different archive niches.
    if (g < cfg.generations && cfg.blendPairs > 0 && archive.size >= 2) {
      const elites = archive.elites().sort((a, b) => b.objective - a.objective || a.cell.localeCompare(b.cell));
      const pairs: [IdeaRecord, IdeaRecord][] = [];
      for (let attempt = 0; attempt < cfg.blendPairs * 4 && pairs.length < cfg.blendPairs; attempt++) {
        const a = rng.pick(elites).item;
        const b = rng.pick(elites.filter((e) => e.cell !== archive.cellOf([a.novelty ?? 0, a.feasibility ?? 0]))).item ?? a;
        if (a.id === b.id) continue;
        pairs.push([a, b]);
      }
      const blended = await Promise.all(pairs.map(async ([a, b]) => {
        try {
          const { value } = await client.json<{ blend?: string; emergent?: string }>(
            blenderMessages({ task: opts.task, ideaA: a.text, ideaB: b.text, extraConstraints: opts.extraConstraints }),
            { temperature: Math.min(cfg.maxTemperature, temperature + 0.1), maxTokens: cfg.maxTokens, tag: "blender" });
          const text = typeof value.blend === "string" ? value.blend.trim() : "";
          if (text.length < 4) return null;
          return makeIdea({
            text, rationale: typeof value.emergent === "string" ? value.emergent : undefined,
            taskId: opts.taskId, configId: "engine", generation: g, agent: "blender",
            operator: "combination", source: "blend", parents: [a.id, b.id]
          });
        } catch (err) {
          events.push({ generation: g, stage: "blender-error", detail: String(err) });
          return null;
        }
      }));
      const blendFresh = await addIdeas(blended.filter((x): x is IdeaRecord => x !== null), g);
      events.push({ generation: g, stage: "blend", detail: "融合 " + blendFresh.length + " 条", metric: blendFresh.length });
      fresh = fresh.concat(blendFresh);
    }

    // Generation-level statistics drive the mode-collapse guard.
    const genIdeas = all.filter((i) => i.generation === g);
    let mpd = 0, clusters = 0;
    if (genIdeas.length >= 2) {
      const sim = await opts.space.similarityMatrix(genIdeas.map((i) => i.text));
      mpd = meanPairwiseDistance(sim);
      clusters = countClusters(agglomerativeClusters(sim, 0.45));
    }
    const genNovelty = genIdeas.length ? mean(genIdeas.map((i) => i.novelty ?? 0)) : 0;
    generations.push({ index: g, newIdeas: genIdeas.length, meanPairwiseDistance: Number(mpd.toFixed(4)), meanNovelty: Number(genNovelty.toFixed(4)), clusters, temperature });
    events.push({ generation: g, stage: "measure", detail: "平均两两距离=" + mpd.toFixed(3) + " 新颖度=" + genNovelty.toFixed(3) + " 簇数=" + clusters, metric: mpd });

    if (g < cfg.generations) {
      const collapsed = mpd > 0 && mpd < cfg.diversityFloor;
      if (collapsed) {
        adaptations += 1;
        temperature = Math.min(cfg.maxTemperature, temperature + cfg.temperatureStep);
        events.push({ generation: g, stage: "adapt", detail: "多样性低于阈值 " + cfg.diversityFloor + "，升温至 " + temperature.toFixed(2) });
      }
      if (cfg.useMetaReflector) {
        try {
          const { value } = await client.json<{ diagnosis?: string; recommended_operators?: string[]; recommended_note?: string }>(
            metaMessages({
              task: opts.task, meanPairwiseDistance: mpd, novelty: genNovelty,
              sample: genIdeas.slice(0, 8).map((i) => i.text), operatorIds
            }), { temperature: 0, maxTokens: 1200, tag: "meta" });
          const rec = (value.recommended_operators ?? []).filter((id) => operatorIds.includes(id));
          if (rec.length > 0) operatorIds = rec;
          if (typeof value.recommended_note === "string" && value.recommended_note.trim()) extraNote = value.recommended_note.trim().slice(0, 400);
          events.push({ generation: g, stage: "meta", detail: (value.diagnosis ?? "").slice(0, 200) });
        } catch (err) {
          events.push({ generation: g, stage: "meta-error", detail: String(err) });
        }
      }
    }
  }

  const elites = archive.elites().sort((a, b) => b.objective - a.objective).map((e) => e.item);
  return { ideas: all, events, generations, archive: { size: archive.size, coverage: archive.coverage(), qdScore: archive.qdScore(), elites }, adaptations };
}