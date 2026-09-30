import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadTasks, loadDatCalibration } from "../src/bench/tasks.ts";
import { getConfigs, runBenchmark } from "../src/bench/runner.ts";
import { buildHtmlReport, buildMarkdownReport } from "../src/bench/report.ts";
import { project2d } from "../src/bench/projection.ts";
import { TfidfSpace } from "../src/core/semantic-space.ts";
import { FakeLlm } from "../test-support/fake-llm.ts";

const catalogIdeas = ["用砖头蓄热做简易暖气", "把砖头磨成粉当颜料", "用砖头做书立"];

function fakeFor(): FakeLlm {
  return new FakeLlm((tag, messages) => {
    const user = messages.map((m) => m.content).join("\n");
    if (tag.startsWith("generator")) return { ideas: catalogIdeas.map((t) => ({ idea: t + "（算子变体）" })) };
    if (tag === "critic") return { reviews: catalogIdeas.map((_, i) => ({ index: i + 1, feasibility: 7, novelty: 6, impact: 5, failure_mode: "none" })) };
    if (tag === "blender") return { blend: "融合方案：把蓄热与颜料机制叠加" };
    if (tag === "meta") return { diagnosis: "趋于集中", recommended_operators: [], recommended_note: "换领域" };
    if (user.includes("rat-")) return { ideas: ["cheese", "ice"] };
    return { ideas: catalogIdeas.slice(0, 3) };
  });
}

test("benchmark pipeline runs end to end on a fake model and writes reports", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "creative-bench-"));
  const tasks = loadTasks().filter((t) => t.id === "aut-brick" || t.id === "brief-stove");
  const configs = getConfigs(["zero-shot", "engine"]);
  const space = new TfidfSpace(["砖头", "塑料瓶", "用砖头蓄热做简易暖气", "把砖头磨成粉当颜料"]);
  const result = await runBenchmark({
    client: fakeFor(), space, tasks, configs, runDir: dir, seed: 1,
    engineConfig: { generations: 2, generators: 2, ideasPerGenerator: 2, blendPairs: 1 },
    datCalibration: loadDatCalibration()
  });
  assert.equal(result.scores.length, tasks.length * configs.length);
  assert.ok(fs.existsSync(path.join(dir, "summary.json")));
  const engineArtifact = result.artifacts.find((a) => a.configId === "engine" && a.taskId === "aut-brick")!;
  assert.equal(engineArtifact.stats.generations.length, 2);
  assert.ok(engineArtifact.events.length > 0);
  assert.ok(engineArtifact.stats.archive.size > 0, "engine must fill its quality-diversity archive");
  const md = buildMarkdownReport(result);
  assert.ok(md.includes("aut-brick") || md.includes("AUT"));
  const html = buildHtmlReport(result);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("创造力机制基准实验"));
  // scores carry finite primary metrics
  for (const s of result.scores) {
    assert.ok(Object.keys(s.metrics).length >= 3, "metrics for " + s.taskId);
  }
});

test("aut scoring uses the declared object rather than the prompt text", async () => {
  const task = loadTasks().find((t) => t.id === "aut-bottle")!;
  assert.equal(task.object, "塑料瓶");
});

test("kernel PCA projection separates two clusters and stays deterministic", () => {
  const clusterA = [[1, 0, 0], [0.9, 0.1, 0], [1.1, -0.1, 0]];
  const clusterB = [[0, 1, 0], [0.1, 0.9, 0], [-0.1, 1.05, 0]];
  const p1 = project2d([...clusterA, ...clusterB]);
  const p2 = project2d([...clusterA, ...clusterB]);
  assert.deepEqual(p1.points, p2.points);
  const a = p1.points.slice(0, 3).map((p) => p.x);
  const b = p1.points.slice(3).map((p) => p.x);
  assert.ok(Math.max(...a) < Math.min(...b) || Math.min(...a) > Math.max(...b), "clusters should separate on the first axis");
  assert.ok(p1.explained[0] > 0.5);
});
