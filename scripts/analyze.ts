/**
 * Turns run results into the report tables.
 *   node scripts/analyze.ts [runDir...] > docs/results.md
 */
import fs from "node:fs";
import path from "node:path";
import { cliffsDelta, mean, round, sd } from "../src/core/stats.ts";
import type { TaskScore } from "../src/bench/scoring.ts";

const dirs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const runs = (dirs.length ? dirs : ["runs/main-live", "runs/ablation"]).filter((d) => fs.existsSync(path.join(d, "summary.json")));

const out: string[] = [];
const fmt = (x: number | undefined, d = 3) => (typeof x === "number" && Number.isFinite(x) ? String(round(x, d)) : "—");

interface Run { dir: string; scores: TaskScore[]; configs: string[]; tasks: string[] }

const parsed: Run[] = runs.map((dir) => {
  const s = JSON.parse(fs.readFileSync(path.join(dir, "summary.json"), "utf8")) as { scores: TaskScore[] };
  return {
    dir,
    scores: s.scores,
    configs: [...new Set(s.scores.map((x) => x.configId))].filter((c) => c !== "engine" || true),
    tasks: [...new Set(s.scores.map((x) => x.taskId))]
  };
});

out.push("# 实验结果（自动生成）", "");
out.push("由 `node scripts/analyze.ts` 从各次运行的 summary.json 与逐格 score 文件生成。", "");

for (const run of parsed) {
  out.push("## 运行 " + run.dir, "");
  const configs = [...new Set(run.scores.map((s) => s.configId))];
  const engineFirst = configs.sort((a, b) => (a === "engine" ? -1 : b === "engine" ? 1 : a.localeCompare(b)));
  const tasks = run.tasks;

  const metricRows: { key: string; label: string }[] = [
    { key: "meanNovelty", label: "平均新颖度（AUT/简报）" },
    { key: "meanFeasibility", label: "平均可行性（独立评委 0-1）" },
    { key: "noveltyUsefulness", label: "新颖度 × 可行性" },
    { key: "ctrl_meanPairwiseDistance", label: "多样性（固定 12 条抽样）" },
    { key: "ctrl_clusters", label: "簇数（固定 12 条抽样）" },
    { key: "meanOriginality", label: "AUT 平均原创性" },
    { key: "flexibility", label: "AUT 灵活性（词表类别数）" },
    { key: "fluency", label: "AUT 流畅性（有效想法数）" },
    { key: "dtIndex", label: "AUT 综合指数" },
    { key: "crossConfigDistinctiveness", label: "跨配置区分度（同质化审计）" },
    { key: "dispersion", label: "DAT 计分（×100）" },
    { key: "passAtK", label: "RAT 候选命中率" },
    { key: "nUnique", label: "去重后想法数" }
  ];

  for (const m of metricRows) {
    const relevant = run.scores.filter((s) => typeof s.metrics[m.key] === "number" && Number.isFinite(s.metrics[m.key]));
    if (relevant.length === 0) continue;
    out.push("### " + m.label + " \`" + m.key + "\`", "");
    out.push("| 任务 | 类型 | " + engineFirst.join(" | ") + " |");
    out.push("|" + " --- |".repeat(engineFirst.length + 2));
    for (const t of tasks) {
      const any = run.scores.find((s) => s.taskId === t && typeof s.metrics[m.key] === "number" && Number.isFinite(s.metrics[m.key]));
      if (!any) continue;
      const row = engineFirst.map((c) => {
        const s = run.scores.find((x) => x.taskId === t && x.configId === c);
        return s && typeof s.metrics[m.key] === "number" ? fmt(s.metrics[m.key]) : "—";
      });
      out.push("| " + t + " | " + any.kind + " | " + row.join(" | ") + " |");
    }
    out.push("");
  }

  out.push("### 跨任务均值", "");
  out.push("| 配置 | 新颖度 | 可行性 | 新颖×可行 | 多样性(抽样) | DT 指数 | RAT 命中 | 平均调用 |");
  out.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const c of engineFirst) {
    const ss = run.scores.filter((s) => s.configId === c);
    const avg = (k: string) => {
      const v = ss.map((s) => s.metrics[k]).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
      return v.length ? fmt(mean(v)) : "—";
    };
    out.push("| " + c + " | " + avg("meanNovelty") + " | " + avg("meanFeasibility") + " | " + avg("noveltyUsefulness") + " | " + avg("ctrl_meanPairwiseDistance") + " | " + avg("dtIndex") + " | " + avg("passAtK") + " | " + avg("nUnique") + " |");
  }
  out.push("");

  // effect sizes on the novelty-usefulness product, engine vs each other config
  const engineScores = run.scores.filter((s) => s.configId === "engine");
  const others = engineFirst.filter((c) => c !== "engine");
  if (engineScores.length && others.length) {
    out.push("### 机制 vs 其它配置：配对的效应量（新颖度 / 可行性）", "");
    out.push("| 对照 | Δ新颖度 | Δ可行性 | Cliff's δ（可行性） |");
    out.push("| --- | --- | --- | --- |");
    for (const c of others) {
      const pairs = engineScores.map((e) => ({ e, o: run.scores.find((s) => s.taskId === e.taskId && s.configId === c) })).filter((p) => p.o);
      const dn = pairs.map((p) => (p.e.metrics.meanNovelty ?? 0) - (p.o!.metrics.meanNovelty ?? 0));
      const df = pairs.map((p) => (p.e.metrics.meanFeasibility ?? 0) - (p.o!.metrics.meanFeasibility ?? 0));
      const a = pairs.map((p) => p.e.metrics.meanFeasibility ?? 0);
      const b = pairs.map((p) => p.o!.metrics.meanFeasibility ?? 0);
      out.push("| " + c + " | " + (dn.length ? (mean(dn) >= 0 ? "+" : "") + fmt(mean(dn)) : "—") + " | " + (df.length ? (mean(df) >= 0 ? "+" : "") + fmt(mean(df)) : "—") + " | " + fmt(cliffsDelta(a, b)) + " |");
    }
    out.push("");
  }
}

// Per-idea review analysis: is the feasibility judge biased against long ideas?
const reviews: { text: string; feasibility: number; chars: number; novelty: number | null; configId: string }[] = [];
for (const run of parsed) {
  for (const score of run.scores) {
    const r = (score.extras as { reviews?: { text: string; feasibility: number; chars: number; novelty: number | null }[] } | undefined)?.reviews;
    if (Array.isArray(r)) for (const x of r) reviews.push({ ...x, configId: score.configId });
  }
}
if (reviews.length > 3) {
  const xs = reviews.map((r) => r.chars);
  const ys = reviews.map((r) => r.feasibility);
  const mx = mean(xs), my = mean(ys);
  const num = reviews.reduce((a, r) => a + (r.chars - mx) * (r.feasibility - my), 0);
  const den = Math.sqrt(reviews.reduce((a, r) => a + (r.chars - mx) ** 2, 0) * reviews.reduce((a, r) => a + (r.feasibility - my) ** 2, 0));
  const r = den === 0 ? 0 : num / den;
  out.push("## 逐条评判的可信度检查", "");
  out.push("- 被独立评委打分的想法数：" + reviews.length);
  out.push("- 想法长度与可行性评分的皮尔逊相关：r = " + fmt(r) + "（若显著为负，说明评委可能把「长/复杂」当成「不可行」，这属于评委偏置）");
  out.push("- 平均可行性：" + fmt(mean(ys)) + "，标准差 " + fmt(sd(ys)));
  const byConfig = [...new Set(reviews.map((x) => x.configId))];
  out.push("");
  out.push("| 配置 | 条数 | 平均字数 | 平均可行性 |");
  out.push("| --- | --- | --- | --- |");
  for (const c of byConfig) {
    const sub = reviews.filter((x) => x.configId === c);
    out.push("| " + c + " | " + sub.length + " | " + fmt(mean(sub.map((x) => x.chars)), 1) + " | " + fmt(mean(sub.map((x) => x.feasibility))) + " |");
  }
  out.push("");
}
console.log(out.join("\n"));