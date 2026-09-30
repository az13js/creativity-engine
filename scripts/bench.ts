/**
 * Benchmark CLI.
 *   node scripts/bench.ts                                  # all tasks x all configs, real model
 *   node scripts/bench.ts --tasks aut-brick --configs engine
 *   node scripts/bench.ts --dry                            # deterministic fake model, no network
 */
import fs from "node:fs";
import path from "node:path";
import { loadLlmConfig } from "../src/core/config.ts";
import { ChatClient } from "../src/llm/client.ts";
import { EmbeddingApiSpace, TfidfSpace, embedItems, type SemanticSpace } from "../src/core/semantic-space.ts";
import { loadDatCalibration, loadTasks } from "../src/bench/tasks.ts";
import { getConfigs, runBenchmark, type BenchClient } from "../src/bench/runner.ts";
import { FakeLlm } from "../test-support/fake-llm.ts";
import { buildHtmlReport, buildMarkdownReport } from "../src/bench/report.ts";
import { project2d } from "../src/bench/projection.ts";

function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  if (i === -1) return dflt;
  return process.argv[i + 1] ?? "true";
}

const dry = process.argv.includes("--dry");
const taskIds = arg("tasks")?.split(",").filter(Boolean);
const configIds = arg("configs")?.split(",").filter(Boolean);
const seed = Number(arg("seed", "20240930"));
const generations = Number(arg("generations", "3"));
const outDir = arg("out", "runs/" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + (dry ? "-dry" : ""))!;
const resume = process.argv.includes("--resume");

const tasks = loadTasks().filter((t) => !taskIds || taskIds.includes(t.id));
if (tasks.length === 0) { console.error("no tasks selected"); process.exit(1); }
const configs = getConfigs(configIds);

let client: BenchClient;
let space: SemanticSpace;
let embedSpace: EmbeddingApiSpace | null = null;

if (dry) {
  const fake = new FakeLlm((tag, messages) => {
    const user = messages.map((m) => m.content).join("\n");
    if (tag.startsWith("generator")) {
      const op = tag.split(":")[1] ?? "op";
      return { ideas: [1, 2, 3].map((k) => ({ idea: "[" + op + "] 用" + (user.length % 97) + "-" + k + "号机制改造对象", rationale: "dry" })) };
    }
    if (tag === "critic") return { reviews: [1, 2, 3].map((i) => ({ index: i, feasibility: 6, novelty: 5, impact: 4, failure_mode: "none" })) };
    if (tag === "blender") return { blend: "融合方案：把两种机制叠加成一体" };
    if (tag === "meta") return { diagnosis: "dry", recommended_operators: [], recommended_note: "" };
    return { ideas: ["想法一", "想法二", "想法三"] };
  });
  client = fake;
  space = new TfidfSpace(["砖头", "塑料瓶", "想法一", "想法二", "想法三", "用机制改造对象"]);
} else {
  const cfg = loadLlmConfig();
  client = new ChatClient(cfg, { concurrency: 6 });
  embedSpace = new EmbeddingApiSpace({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.embedModel }, "runs/cache/embeddings.jsonl");
  // EmbeddingApiSpace already caches every vector on disk; a pair-level cache would be quadratic.
  space = embedSpace;
}

console.log("tasks:", tasks.map((t) => t.id).join(","));
console.log("configs:", configs.map((c) => c.id).join(","));
console.log("out:", outDir, dry ? "(dry)" : "");

const result = await runBenchmark({
  client, space, tasks, configs, runDir: outDir, seed,
  engineConfig: { generations },
  datCalibration: loadDatCalibration(),
  resume
});

embedSpace?.flush();
fs.mkdirSync(outDir, { recursive: true });

// Project every idea of every config into two dimensions for the HTML scatter plot.
let extras: { projection?: ReturnType<typeof project2d>; points?: { text: string; configId: string; taskId: string; generation: number }[]; runDir?: string; seed?: number } = { runDir: outDir, seed };
const flat = result.artifacts.flatMap((a) => a.ideas.map((i) => ({ text: i.text, configId: a.configId, taskId: a.taskId, generation: i.generation })));
const spaceHasVectors = typeof (space as unknown as { embed?: unknown }).embed === "function";
if (flat.length >= 3 && spaceHasVectors) {
  try {
    const embedded = await embedItems(space, flat.map((f) => f.text));
    extras.projection = project2d(embedded);
    extras.points = flat;
    extras.seed = seed;
  } catch (err) {
    console.warn("projection skipped:", String(err).slice(0, 200));
  }
}
fs.writeFileSync(path.join(outDir, "report.md"), buildMarkdownReport(result, extras));
fs.writeFileSync(path.join(outDir, "report.html"), buildHtmlReport(result, extras));
console.log("scores:", result.scores.length, "files:", result.files.length);
const stats = client.getStats?.();
if (stats) console.log("llm calls:", stats.calls, "cached:", stats.cached, "prompt tokens:", stats.promptTokens, "completion tokens:", stats.completionTokens);
console.log("report:", path.join(outDir, "report.md"));