/**
 * Benchmark matrix runner: configs x tasks x seeds.
 * Results are written as one JSON artifact per cell plus a summary.json, so every
 * number in the report can be traced back to the raw model output.
 */
import fs from "node:fs";
import path from "node:path";
import type { SemanticSpace } from "../core/semantic-space.ts";
import type { ChatClient } from "../llm/client.ts";
import type { LlmLike } from "../agents/types.ts";

/** The runner only needs chat + optional usage statistics, so fakes work too. */
export type BenchClient = LlmLike & { getStats?: () => { calls: number; cached: number; promptTokens: number; completionTokens: number; failures: number } };
import { loadCatalog } from "../llm/prompts.ts";
import { runCreativeEngine, DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../agents/engine.ts";
import { runZeroShot, runStructuredCot, runSelfRefine } from "../agents/baselines.ts";
import type { IdeaRecord, RunArtifact } from "../agents/types.ts";
import { addCrossConfigMetrics, scoreArtifact, type TaskScore } from "./scoring.ts";
import type { BenchTask } from "./tasks.ts";

export interface BenchConfigDef {
  id: string;
  label: string;
  /** Human-readable description of the budget, for honest cost comparisons. */
  budget: string;
  run: (ctx: RunContext) => Promise<RunArtifact>;
}

export interface RunContext {
  client: BenchClient;
  task: BenchTask;
  space: SemanticSpace;
  seed: number;
  engineConfig?: Partial<EngineConfig>;
}

function deltaStats(client: BenchClient, before: { calls: number; cached: number; pt: number; ct: number; failures: number }, started: number, extra?: Partial<RunArtifact["stats"]>): RunArtifact["stats"] {
  const s = client.getStats?.() ?? { calls: 0, cached: 0, promptTokens: 0, completionTokens: 0, failures: 0 };
  return {
    calls: s.calls - before.calls,
    cachedCalls: s.cached - before.cached,
    promptTokens: s.promptTokens - before.pt,
    completionTokens: s.completionTokens - before.ct,
    failures: s.failures - before.failures,
    wallMs: Date.now() - started,
    generations: extra?.generations ?? [],
    archive: extra?.archive ?? { size: 0, coverage: 0, qdScore: 0 }
  } as RunArtifact["stats"];
}

function snapshot(client: BenchClient) {
  const s = client.getStats?.() ?? { calls: 0, cached: 0, promptTokens: 0, completionTokens: 0, failures: 0 };
  return { calls: s.calls, cached: s.cached, pt: s.promptTokens, ct: s.completionTokens, failures: s.failures };
}

function engineIdeasAsRecords(ideas: IdeaRecord[], configId: string): IdeaRecord[] { return ideas.map((i) => ({ ...i, configId })); }

export const CONFIGS: BenchConfigDef[] = [
  {
    id: "zero-shot",
    label: "零样本单轮（基线 A）",
    budget: "1 次调用",
    async run({ client, task, seed }) {
      const started = Date.now(); const before = snapshot(client);
      const { ideas } = await runZeroShot(client, task.prompt, { ideas: task.ideasTarget, seed, taskId: task.id });
      return { taskId: task.id, configId: "zero-shot", seed, ideas: engineIdeasAsRecords(ideas, "zero-shot"), events: [], stats: deltaStats(client, before, started) };
    }
  },
  {
    id: "structured-cot",
    label: "结构化分类单轮（基线 B）",
    budget: "1 次调用",
    async run({ client, task, seed }) {
      const started = Date.now(); const before = snapshot(client);
      const { ideas } = await runStructuredCot(client, task.prompt, { ideas: task.ideasTarget, seed, taskId: task.id });
      return { taskId: task.id, configId: "structured-cot", seed, ideas, events: [], stats: deltaStats(client, before, started) };
    }
  },
  {
    id: "self-refine",
    label: "自我批评再修改（基线 C）",
    budget: "3 次调用",
    async run({ client, task, seed }) {
      const started = Date.now(); const before = snapshot(client);
      const { ideas } = await runSelfRefine(client, task.prompt, { ideas: task.ideasTarget, seed, taskId: task.id });
      return { taskId: task.id, configId: "self-refine", seed, ideas, events: [], stats: deltaStats(client, before, started) };
    }
  },
  {
    id: "engine",
    label: "多Agent创造力引擎（本机制）",
    budget: "生成4x3 + 融合2 + 评审1 + 元反思1，共约 3 轮",
    async run({ client, task, space, seed, engineConfig }) {
      const started = Date.now(); const before = snapshot(client);
      const result = await runCreativeEngine({
        client, catalog: loadCatalog(), space, taskId: task.id, task: task.prompt,
        knownSolutions: task.knownSolutions ?? (task.reference ?? []).map((x) => x.text),
        style: task.style,
        config: { ...(engineConfig ?? {}), seed }
      });
      return {
        taskId: task.id, configId: "engine", seed,
        ideas: engineIdeasAsRecords(result.ideas, "engine"),
        events: result.events,
        stats: deltaStats(client, before, started, {
          generations: result.generations,
          archive: { size: result.archive.size, coverage: result.archive.coverage, qdScore: result.archive.qdScore }
        })
      };
    }
  }
];

/**
 * Ablation ladder for the mechanism itself, so the benchmark measures the contribution of
 * each design element rather than "multi-agent magic":
 *  - engine-flat     : parallel samples with one operator/one persona, no blending, no adaptation
 *  - engine-noadapt  : full heterogeneity and blending, but the mode-collapse guard is off
 *  - engine          : the full mechanism
 */
export function engineVariantConfig(id: string, label: string, budget: string, overrides: Partial<EngineConfig>, catalogPatch?: (c: ReturnType<typeof loadCatalog>) => ReturnType<typeof loadCatalog>): BenchConfigDef {
  return {
    id, label, budget,
    async run({ client, task, space, seed, engineConfig }) {
      const started = Date.now(); const before = snapshot(client);
      const catalog = catalogPatch ? catalogPatch(loadCatalog()) : loadCatalog();
      const result = await runCreativeEngine({
        client, catalog, space, taskId: task.id, task: task.prompt,
        knownSolutions: task.knownSolutions ?? (task.reference ?? []).map((x) => x.text),
        style: task.style,
        config: { ...(engineConfig ?? {}), ...overrides, seed }
      });
      return {
        taskId: task.id, configId: id, seed,
        ideas: engineIdeasAsRecords(result.ideas, id),
        events: result.events,
        stats: deltaStats(client, before, started, {
          generations: result.generations,
          archive: { size: result.archive.size, coverage: result.archive.coverage, qdScore: result.archive.qdScore }
        })
      };
    }
  };
}

export function getConfigs(ids?: readonly string[]): BenchConfigDef[] {
  const all = [...CONFIGS, ...ABLATION_CONFIGS];
  if (!ids || ids.length === 0) return CONFIGS;
  return all.filter((c) => ids.includes(c.id));
}

export const ABLATION_CONFIGS: BenchConfigDef[] = [
  engineVariantConfig("engine-flat", "引擎·单一算子无融合（消融）", "4 路并行同类采样 + 去重归档", {
    generations: 2, generators: 4, blendPairs: 0, useMetaReflector: false, diversityFloor: 0, temperatureStep: 0
  }, (c) => ({ ...c, operators: c.operators.slice(0, 1), personas: c.personas.slice(0, 1), stimuli: c.stimuli.slice(0, 1) })),
  engineVariantConfig("engine-noadapt", "引擎·关闭自适应（消融）", "全流程但无升温与元反思", {
    diversityFloor: 0, temperatureStep: 0, useMetaReflector: false
  })
];

export interface BenchmarkOptions {
  client: BenchClient;
  space: SemanticSpace;
  tasks: BenchTask[];
  configs: BenchConfigDef[];
  runDir: string;
  seed: number;
  engineConfig?: Partial<EngineConfig>;
  datCalibration?: string[];
  /** Skip cells whose artifact file already exists. */
  resume?: boolean;
}

export interface BenchmarkResult {
  runId: string;
  dir: string;
  scores: TaskScore[];
  artifacts: RunArtifact[];
  files: string[];
}

export async function runBenchmark(opts: BenchmarkOptions): Promise<BenchmarkResult> {
  fs.mkdirSync(opts.runDir, { recursive: true });
  const scores: TaskScore[] = [];
  const artifacts: RunArtifact[] = [];
  const files: string[] = [];
  for (const config of opts.configs) {
    for (const task of opts.tasks) {
      const file = path.join(opts.runDir, task.id + "__" + config.id + ".json");
      let artifact: RunArtifact;
      if (opts.resume && fs.existsSync(file)) {
        artifact = JSON.parse(fs.readFileSync(file, "utf8")) as RunArtifact;
      } else {
        const ctx: RunContext = { client: opts.client, task, space: opts.space, seed: opts.seed, engineConfig: opts.engineConfig };
        artifact = await config.run(ctx);
        fs.writeFileSync(file, JSON.stringify(artifact, null, 2));
        files.push(file);
      }
      artifacts.push(artifact);
      const score = await scoreArtifact(task, artifact, { space: opts.space, datCalibration: opts.datCalibration });
      scores.push(score);
      fs.writeFileSync(path.join(opts.runDir, "score__" + task.id + "__" + config.id + ".json"), JSON.stringify(score, null, 2));
    }
  }
  // Post-hoc homogenization audit across configs of the same task.
  await addCrossConfigMetrics(scores, artifacts, opts.space);
  for (const s of scores) fs.writeFileSync(path.join(opts.runDir, "score__" + s.taskId + "__" + s.configId + ".json"), JSON.stringify(s, null, 2));

  const summary = {
    runId: path.basename(opts.runDir),
    createdAt: new Date().toISOString(),
    seed: opts.seed,
    tasks: opts.tasks.map((t) => ({ id: t.id, kind: t.kind, title: t.title, ideasTarget: t.ideasTarget })),
    configs: opts.configs.map((c) => ({ id: c.id, label: c.label, budget: c.budget })),
    scores
  };
  fs.writeFileSync(path.join(opts.runDir, "summary.json"), JSON.stringify(summary, null, 2));
  return { runId: summary.runId, dir: opts.runDir, scores, artifacts, files };
}

export { DEFAULT_ENGINE_CONFIG };