/**
 * Re-score an existing run without regenerating ideas (free: only judging calls are new).
 *   node scripts/rescore.ts --run runs/main-live [--no-judge]
 * Rewrites score__*.json, summary.json, report.md and report.html for that run.
 */
import fs from "node:fs";
import path from "node:path";
import { loadLlmConfig } from "../src/core/config.ts";
import { ChatClient } from "../src/llm/client.ts";
import { EmbeddingApiSpace, embedItems } from "../src/core/semantic-space.ts";
import { loadDatCalibration, loadTasks } from "../src/bench/tasks.ts";
import { addCrossConfigMetrics, scoreArtifact, type TaskScore } from "../src/bench/scoring.ts";
import { buildHtmlReport, buildMarkdownReport } from "../src/bench/report.ts";
import { project2d } from "../src/bench/projection.ts";
import type { RunArtifact } from "../src/agents/types.ts";

function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  if (i === -1) return dflt;
  return process.argv[i + 1] ?? "true";
}

const runDir = arg("run", "runs/main-live")!;
const useJudge = !process.argv.includes("--no-judge");
const cfg = loadLlmConfig();
const client = new ChatClient(cfg, { concurrency: 6 });
const embed = new EmbeddingApiSpace({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.embedModel }, "runs/cache/embeddings.jsonl");
const space = embed;

const tasks = loadTasks();
const files = fs.readdirSync(runDir).filter((f) => f.endsWith(".json") && !f.startsWith("score__") && f !== "summary.json");
const artifacts: RunArtifact[] = files.map((f) => JSON.parse(fs.readFileSync(path.join(runDir, f), "utf8")) as RunArtifact);
const scores: TaskScore[] = [];
for (const artifact of artifacts) {
  const task = tasks.find((t) => t.id === artifact.taskId);
  if (!task) { console.warn("unknown task", artifact.taskId); continue; }
  const score = await scoreArtifact(task, artifact, { space, datCalibration: loadDatCalibration(), judge: useJudge ? { client, tag: "rescore" } : undefined });
  scores.push(score);
  fs.writeFileSync(path.join(runDir, "score__" + artifact.taskId + "__" + artifact.configId + ".json"), JSON.stringify(score, null, 2));
  console.log("scored", artifact.taskId, artifact.configId, "novelty=", score.metrics.meanNovelty ?? "-", "feasibility=", score.metrics.meanFeasibility ?? "-");
}
await addCrossConfigMetrics(scores, artifacts, space);
embed.flush();

const previous = fs.existsSync(path.join(runDir, "summary.json")) ? JSON.parse(fs.readFileSync(path.join(runDir, "summary.json"), "utf8")) : {};
const configIds = [...new Set(artifacts.map((a) => a.configId))];
const summary = {
  ...previous,
  runId: path.basename(runDir),
  rescoredAt: new Date().toISOString(),
  judge: useJudge ? { model: cfg.chatModel, note: "可行性由同一个 LLM 评委对每个配置独立评分" } : null,
  configs: previous.configs ?? configIds.map((id) => ({ id, label: id, budget: "" })),
  tasks: previous.tasks ?? tasks.filter((t) => artifacts.some((a) => a.taskId === t.id)).map((t) => ({ id: t.id, kind: t.kind, title: t.title, ideasTarget: t.ideasTarget })),
  scores
};
fs.writeFileSync(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2));

const flat = artifacts.flatMap((a) => a.ideas.map((i) => ({ text: i.text, configId: a.configId, taskId: a.taskId, generation: i.generation })));
let extras: { projection?: ReturnType<typeof project2d>; points?: typeof flat; runDir: string; seed?: number } = { runDir, seed: summary.seed };
if (flat.length >= 3) {
  try {
    const vecs = await embedItems(space, flat.map((f) => f.text));
    extras = { projection: project2d(vecs), points: flat, runDir, seed: summary.seed };
  } catch (err) { console.warn("projection skipped:", String(err).slice(0, 160)); }
}
fs.writeFileSync(path.join(runDir, "report.md"), buildMarkdownReport({ runId: summary.runId, dir: runDir, scores, artifacts, files: [] }, extras));
fs.writeFileSync(path.join(runDir, "report.html"), buildHtmlReport({ runId: summary.runId, dir: runDir, scores, artifacts, files: [] } as never, extras));
const stats = client.getStats();
console.log("done. cells:", scores.length, "judge calls:", stats.calls, "cached:", stats.cached, "tokens:", stats.promptTokens + stats.completionTokens);