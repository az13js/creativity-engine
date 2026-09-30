/**
 * Report generation from a BenchmarkResult: Markdown for version control,
 * a self-contained interactive HTML page for reading (no external assets).
 */
import { mean, round, sd } from "../core/stats.ts";
import type { BenchmarkResult } from "./runner.ts";
import type { TaskScore } from "./scoring.ts";
import type { Projection } from "./projection.ts";

export interface ReportExtras {
  projection?: Projection;
  points?: { text: string; configId: string; taskId: string; generation: number }[];
  runDir?: string;
}

export const PRIMARY_METRIC: Record<string, { key: string; label: string; lowerIsBetter?: boolean }[]> = {
  aut: [
    { key: "dtIndex", label: "发散思维综合指数 DT-index" },
    { key: "meanOriginality", label: "平均原创性" },
    { key: "meanFeasibility", label: "平均可行性（LLM 评委，0-1）" },
    { key: "flexibility", label: "类别数（灵活性）" },
    { key: "fluency", label: "有效想法数（流畅性）" }
  ],
  brief: [
    { key: "meanNovelty", label: "平均新颖度（全量）" },
    { key: "ctrl_meanNovelty", label: "平均新颖度（固定 12 条抽样）" },
    { key: "meanFeasibility", label: "平均可行性（LLM 评委，0-1）" },
    { key: "noveltyUsefulness", label: "新颖度 × 可行性" },
    { key: "ctrl_meanPairwiseDistance", label: "想法间平均语义距离（固定 12 条抽样，多样性）" },
    { key: "crossConfigDistinctiveness", label: "相对其它配置想法的区分度（同质化审计）" },
    { key: "meanPairwiseDistance", label: "想法间平均语义距离（全量，受条数影响）" },
    { key: "ctrl_clusters", label: "想法簇数（固定 12 条抽样）" },
    { key: "meanElaboration", label: "平均具体化程度" }
  ],
  dat: [
    { key: "dispersion", label: "DAT 计分（前 7 个有效词，21 对余弦距离均值 ×100）" },
    { key: "validRate", label: "有效单词比例" },
    { key: "dispersionVsCalibration", label: "相对随机词基线的差值" }
  ],
  rat: [
    { key: "passAtK", label: "至少一个候选命中的题目比例" },
    { key: "strictAccuracy", label: "严格命中率" }
  ]
};

function metricValue(s: TaskScore, key: string): number {
  return s.metrics[key] ?? Number.NaN;
}

function fmt(x: number, digits = 3): string { return Number.isFinite(x) ? String(round(x, digits)) : "—"; }

function configOrder(result: BenchmarkResult): string[] {
  const seen: string[] = [];
  for (const s of result.scores) if (!seen.includes(s.configId)) seen.push(s.configId);
  return seen;
}

function labelOf(result: BenchmarkResult, configId: string): string {
  const known = result.scores.find((s) => s.configId === configId);
  return configId + (known ? " · " + known.kind : "");
}

export function buildMarkdownReport(result: BenchmarkResult, extras: ReportExtras = {}): string {
  const lines: string[] = [];
  const configs = configOrder(result);
  const tasks = [...new Map(result.scores.map((s) => [s.taskId, s])).values()];
  const labels = new Map<string, string>();
  for (const s of result.scores) labels.set(s.configId, s.configId);

  lines.push("# 创造力机制基准实验结果", "");
  lines.push("- 运行目录：`" + (extras.runDir ?? result.dir) + "`");
  lines.push("- 随机种子：" + result.scores.length + " 个单元格，seed 见 summary.json");
  lines.push("- 单元格数：" + result.scores.length + "，配置数：" + configs.length + "，任务数：" + tasks.length);
  lines.push("");
  lines.push("> 所有指标均由程序自动计算，不含人工评分。指标定义见 docs/benchmark.md。");
  lines.push("");

  for (const kind of ["aut", "brief", "dat", "rat"]) {
    const kindTasks = tasks.filter((t) => t.kind === kind);
    if (kindTasks.length === 0) continue;
    const prim = PRIMARY_METRIC[kind]!;
    lines.push("## " + kind.toUpperCase() + " 任务", "");
    for (const m of prim) {
      lines.push("### " + m.label + "（`" + m.key + "`）", "");
      lines.push("| 任务 | " + configs.map((c) => labels.get(c) ?? c).join(" | ") + " |");
      lines.push("|" + " --- |".repeat(configs.length + 1));
      for (const t of kindTasks) {
        const row = configs.map((c) => {
          const s = result.scores.find((x) => x.taskId === t.taskId && x.configId === c);
          return s ? fmt(metricValue(s, m.key)) : "—";
        });
        lines.push("| " + t.title + " | " + row.join(" | ") + " |");
      }
      lines.push("");
    }
  }

  lines.push("## 配置汇总（跨任务平均）", "");
  const metricKeys = [...new Set(result.scores.flatMap((s) => Object.keys(s.metrics)))].filter((k) => !["nIdeas", "nUnique"].includes(k));
  lines.push("| 指标 | " + configs.join(" | ") + " |");
  lines.push("|" + " --- |".repeat(configs.length + 1));
  for (const k of metricKeys) {
    const row = configs.map((c) => {
      const vals = result.scores.filter((s) => s.configId === c).map((s) => metricValue(s, k)).filter((v) => Number.isFinite(v));
      return vals.length ? fmt(mean(vals)) + (vals.length > 1 ? " ±" + fmt(sd(vals), 2) : "") : "—";
    });
    lines.push("| " + k + " | " + row.join(" | ") + " |");
  }
  lines.push("");

  lines.push("## 机制 vs 基线：逐任务配对差异", "");
  const baselines = configs.filter((c) => c !== "engine");
  for (const b of baselines) {
    lines.push("### engine − " + b, "");
    lines.push("| 任务 | 指标 | engine | " + b + " | 差值 |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const t of tasks) {
      const prim = PRIMARY_METRIC[t.kind]?.[0];
      if (!prim) continue;
      const e = result.scores.find((s) => s.taskId === t.taskId && s.configId === "engine");
      const base = result.scores.find((s) => s.taskId === t.taskId && s.configId === b);
      if (!e || !base) continue;
      const ev = metricValue(e, prim.key), bv = metricValue(base, prim.key);
      lines.push("| " + t.title + " | " + prim.label + " | " + fmt(ev) + " | " + fmt(bv) + " | " + (Number.isFinite(ev) && Number.isFinite(bv) ? (ev - bv >= 0 ? "+" : "") + fmt(ev - bv) : "—") + " |");
    }
    lines.push("");
  }

  lines.push("## 成本", "");
  lines.push("| 配置 | 平均调用次数 | 平均提示 token | 平均生成 token |");
  lines.push("| --- | --- | --- | --- |");
  for (const c of configs) {
    const arts = result.artifacts.filter((a) => a.configId === c);
    lines.push("| " + c + " | " + fmt(mean(arts.map((a) => a.stats.calls)), 1) + " | " + fmt(mean(arts.map((a) => a.stats.promptTokens ?? 0)), 0) + " | " + fmt(mean(arts.map((a) => a.stats.completionTokens ?? 0)), 0) + " |");
  }
  lines.push("");

  const engineArts = result.artifacts.filter((a) => a.configId === "engine" && a.stats.generations.length > 0);
  if (engineArts.length) {
    lines.push("## 引擎过程指标（模式坍塌监控）", "");
    lines.push("| 任务 | 轮次 | 新想法 | 平均两两距离 | 平均新颖度 | 簇数 | 温度 | 档案规模 | 覆盖率 | QD 分数 |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const a of engineArts) {
      for (const g of a.stats.generations) {
        lines.push("| " + a.taskId + " | " + g.index + " | " + g.newIdeas + " | " + g.meanPairwiseDistance + " | " + g.meanNovelty + " | " + g.clusters + " | " + g.temperature + " | " + a.stats.archive.size + " | " + fmt(a.stats.archive.coverage) + " | " + fmt(a.stats.archive.qdScore) + " |");
      }
    }
    lines.push("");
  }
  lines.push("---", "");
  lines.push("生成时间：" + new Date().toISOString());
  return lines.join("\n");
}

function esc(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

const COLORS = ["#d1495b", "#2e86ab", "#e0a458", "#3c9d6b", "#8a6fbf", "#4c4c4c"];

export function buildHtmlReport(result: BenchmarkResult, extras: ReportExtras = {}): string {
  const configs = configOrder(result);
  const tasks = [...new Map(result.scores.map((s) => [s.taskId, s])).values()];
  const totalCalls = result.artifacts.reduce((a, x) => a + x.stats.calls, 0);
  const totalTokens = result.artifacts.reduce((a, x) => a + (x.stats.promptTokens ?? 0) + (x.stats.completionTokens ?? 0), 0);
  const colorOf = (id: string) => COLORS[configs.indexOf(id) % COLORS.length]!;

  const scoreTable = (kind: string): string => {
    const kindTasks = tasks.filter((t) => t.kind === kind);
    if (!kindTasks.length) return "";
    const prim = PRIMARY_METRIC[kind]!;
    let html = "";
    for (const m of prim) {
      html += "<h3>" + esc(m.label) + " <code>" + m.key + "</code></h3><table><thead><tr><th>任务</th>" +
        configs.map((c) => "<th style='color:" + colorOf(c) + "'>" + esc(c) + "</th>").join("") + "</tr></thead><tbody>";
      for (const t of kindTasks) {
        const vals = configs.map((c) => {
          const s = result.scores.find((x) => x.taskId === t.taskId && x.configId === c);
          return s ? metricValue(s, m.key) : Number.NaN;
        });
        const finite = vals.filter((v) => Number.isFinite(v));
        const best = m.lowerIsBetter ? Math.min(...finite) : Math.max(...finite);
        html += "<tr><td>" + esc(t.title) + "</td>" + vals.map((v, i) =>
          "<td class='" + (Number.isFinite(v) && v === best ? "best" : "") + "' style='--c:" + colorOf(configs[i]!) + "'>" + fmt(v) + "</td>").join("") + "</tr>";
      }
      html += "</tbody></table>";
    }
    return "<section><h2>" + kind.toUpperCase() + " 任务</h2>" + html + "</section>";
  };

  // Simple HTML bar chart (no external libraries).
  const barChart = (metric: string, title: string): string => {
    const rowsByConfig = configs.map((c) => {
      const vals = result.scores.filter((s) => s.configId === c).map((s) => metricValue(s, metric)).filter((v) => Number.isFinite(v));
      return { c, v: vals.length ? mean(vals) : Number.NaN };
    }).filter((r) => Number.isFinite(r.v));
    if (!rowsByConfig.length) return "";
    const max = Math.max(...rowsByConfig.map((r) => Math.abs(r.v)), 1e-9);
    let html = "<div class='chart'><h3>" + esc(title) + "</h3>";
    for (const r of rowsByConfig) {
      const w = Math.max(2, Math.abs(r.v) / max * 100);
      html += "<div class='bar-row'><span class='bar-label'>" + esc(r.c) + "</span><span class='bar' style='width:" + w.toFixed(1) + "%;background:" + colorOf(r.c) + "'></span><span class='bar-val'>" + fmt(r.v) + "</span></div>";
    }
    return html + "</div>";
  };

  const scatter = extras.projection && extras.points && extras.points.length > 1
    ? "<section><h2>想法空间投影（核 PCA，二维）</h2><p class='note'>把全部配置产出的想法向量投影到两维，用来看不同配置探索到了空间的哪些区域。图中每个点是一条想法，鼠标悬停可看原文。1/4 均分线只作视觉参考。</p>" +
      "<div class='scatter-wrap'><canvas id='scatter' width='900' height='520'></canvas><div id='tip' class='tip'></div></div>" +
      "<div class='legend'>" + configs.map((c) => "<span><i style='background:" + colorOf(c) + "'></i>" + esc(c) + "</span>").join("") + "</div>" +
      "<script>window.__SCATTER__ = " + JSON.stringify({
        points: extras.projection.points.map((p, i) => ({ x: p.x, y: p.y, c: colorOf(extras.points![i]!.configId), t: extras.points![i]!.text, g: extras.points![i]!.taskId })),
        colors: Object.fromEntries(configs.map((c) => [c, colorOf(c)])),
        explained: extras.projection.explained
      }) + ";</script></section>"
    : "";

  const genTable = (() => {
    const arts = result.artifacts.filter((a) => a.stats.generations.length > 0);
    if (!arts.length) return "";
    let html = "<section><h2>引擎逐轮过程指标（模式坍塌监控）</h2><table><thead><tr><th>任务</th><th>轮次</th><th>新增想法</th><th>平均两两距离</th><th>平均新颖度</th><th>簇数</th><th>温度</th></tr></thead><tbody>";
    for (const a of arts) for (const g of a.stats.generations) {
      html += "<tr><td>" + esc(a.taskId) + "</td><td>" + g.index + "</td><td>" + g.newIdeas + "</td><td>" + g.meanPairwiseDistance + "</td><td>" + g.meanNovelty + "</td><td>" + g.clusters + "</td><td>" + g.temperature + "</td></tr>";
    }
    return html + "</tbody></table></section>";
  })();

  const costTable = "<section><h2>成本</h2><table><thead><tr><th>配置</th><th>平均调用次数</th><th>平均提示 token</th><th>平均生成 token</th><th>想法数</th></tr></thead><tbody>" +
    configs.map((c) => {
      const arts = result.artifacts.filter((a) => a.configId === c);
      return "<tr><td style='color:" + colorOf(c) + "'>" + esc(c) + "</td><td>" + fmt(mean(arts.map((a) => a.stats.calls)), 1) + "</td><td>" + fmt(mean(arts.map((a) => a.stats.promptTokens ?? 0)), 0) + "</td><td>" + fmt(mean(arts.map((a) => a.stats.completionTokens ?? 0)), 0) + "</td><td>" + fmt(mean(arts.map((a) => a.ideas.length)), 1) + "</td></tr>";
    }).join("") + "</tbody></table></section>";

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>创造力机制基准实验 · ${esc(result.runId)}</title>
<style>
  :root{--bg:#f7f7f5;--fg:#1b1b1b;--muted:#6b6b6b;--card:#fff;--line:#e2e0da}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.65 system-ui,"Noto Sans SC",sans-serif}
  header{padding:28px 36px;background:#1b1b1b;color:#fff}
  header h1{margin:0 0 6px;font-size:22px}
  header .meta{color:#bdbdbd;font-size:13px}
  main{padding:24px 36px 80px;max-width:1180px;margin:0 auto}
  section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin:18px 0}
  h2{margin:0 0 12px;font-size:18px}h3{margin:18px 0 8px;font-size:15px;color:#333}
  table{border-collapse:collapse;width:100%;font-size:13.5px}
  th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:right}
  th:first-child,td:first-child{text-align:left}
  td.best{font-weight:700;background:#f2f8f3}
  .cards{display:flex;gap:14px;flex-wrap:wrap}
  .card{flex:1 1 150px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px}
  .card b{display:block;font-size:22px}
  .card span{color:var(--muted);font-size:12.5px}
  .chart{margin:10px 0}
  .bar-row{display:flex;align-items:center;gap:8px;margin:4px 0}
  .bar-label{width:150px;color:var(--muted);font-size:12.5px;text-align:right}
  .bar{height:14px;border-radius:4px;display:inline-block}
  .bar-val{font-variant-numeric:tabular-nums;font-size:12.5px}
  .note{color:var(--muted);font-size:13px}
  .scatter-wrap{position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden}
  canvas{display:block;width:100%;height:auto;background:#fcfcfb}
  .tip{position:absolute;pointer-events:none;background:#1b1b1b;color:#fff;padding:6px 8px;border-radius:6px;font-size:12px;max-width:320px;display:none}
  .legend{display:flex;gap:14px;margin-top:8px;font-size:12.5px;color:var(--muted)}
  .legend i{width:10px;height:10px;display:inline-block;border-radius:2px;margin-right:5px}
  code{background:#eee;padding:1px 4px;border-radius:4px}
</style></head><body>
<header><h1>创造力机制基准实验</h1><div class="meta">运行 ${esc(result.runId)} · seed ${result.scores.length ? esc(String((result as unknown as { seed?: number }).seed ?? "")) : ""} · 生成于 ${new Date().toISOString()}</div></header>
<main>
<div class="cards">
  <div class="card"><b>${tasks.length}</b><span>任务</span></div>
  <div class="card"><b>${configs.length}</b><span>配置</span></div>
  <div class="card"><b>${result.scores.length}</b><span>实验结果单元</span></div>
  <div class="card"><b>${totalCalls}</b><span>模型调用次数</span></div>
  <div class="card"><b>${(totalTokens / 1000).toFixed(1)}k</b><span>token 总量</span></div>
</div>
<section><h2>配置汇总（跨任务平均）</h2>
${barChart("meanNovelty", "平均新颖度（越高越好）")}
${barChart("meanPairwiseDistance", "想法间平均语义距离（越高越分散）")}
${barChart("dtIndex", "AUT 发散思维综合指数")}
${barChart("passAtK", "RAT 至少一个候选命中率")}
</section>
${["aut", "brief", "dat", "rat"].map(scoreTable).join("")}
${costTable}
${genTable}
${scatter}
<section><h2>指标定义</h2><p class="note">全部指标由程序计算：发散思维综合指数 = 0.2×流畅性 + 0.25×灵活性 + 0.4×平均原创性 + 0.15×具体化程度；新颖度 = 1 − 与已知方案语料的最大余弦相似度；多样性 = 想法两两语义距离均值；灵活性 = 语义聚类簇数。已知方案语料与被试对象均由 data/*.json 提供。</p></section>
</main>
<script>
(function(){
  const d = window.__SCATTER__; if(!d) return;
  const cv = document.getElementById('scatter'); if(!cv) return;
  const ctx = cv.getContext('2d');
  const pad = 40, W = cv.width, H = cv.height;
  const xs = d.points.map(p=>p.x), ys = d.points.map(p=>p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = v => pad + (v - x0) / ((x1 - x0) || 1) * (W - 2*pad);
  const sy = v => H - pad - (v - y0) / ((y1 - y0) || 1) * (H - 2*pad);
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle = '#e6e3dc'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
  ctx.fillStyle = '#8a8a8a'; ctx.font = '12px system-ui';
  ctx.fillText('主成分 1（解释方差 ' + (d.explained[0]*100).toFixed(1) + '%）', W/2-80, H-12);
  ctx.save(); ctx.translate(14, H/2+60); ctx.rotate(-Math.PI/2); ctx.fillText('主成分 2（' + (d.explained[1]*100).toFixed(1) + '%）', 0, 0); ctx.restore();
  const tip = document.getElementById('tip');
  const draw = (hover)=> {
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle = '#e6e3dc'; ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
    d.points.forEach((p,i)=>{
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), hover===i?6:3.4, 0, Math.PI*2);
      ctx.fillStyle = p.c; ctx.globalAlpha = hover===i?1:0.75; ctx.fill(); ctx.globalAlpha = 1;
    });
  };
  draw(-1);
  cv.addEventListener('mousemove', (e)=>{
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (W / r.width), my = (e.clientY - r.top) * (H / r.height);
    let best = -1, bd = 14*14;
    d.points.forEach((p,i)=>{ const dx = sx(p.x)-mx, dy = sy(p.y)-my, dd = dx*dx+dy*dy; if(dd<bd){bd=dd;best=i;} });
    if(best>=0){ draw(best); tip.style.display='block'; tip.style.left = Math.min(mx+12, r.width-330)+'px'; tip.style.top = (my+12)+'px'; tip.textContent = '[' + d.points[best].g + '] ' + d.points[best].t; }
    else { draw(-1); tip.style.display='none'; }
  });
  cv.addEventListener('mouseleave', ()=>{ draw(-1); tip.style.display='none'; });
})();
</script>
</body></html>`;
}