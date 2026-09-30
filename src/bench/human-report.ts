/**
 * Self-contained HTML view of the human-baseline summary. Everything is inline SVG
 * plus a little CSS: no scripts, no external assets, so the file opens offline and
 * survives being copied around. The point is to see the human distributions with the
 * machine's position marked, which tables of numbers hide.
 */

export interface HistogramOptions {
  width?: number;
  height?: number;
  bins?: number;
  markers?: { value: number; label: string; color: string }[];
  xLabel?: string;
  color?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + step * i);
}

/** Histogram of a numeric sample, with optional vertical markers for machine values. */
export function svgHistogram(values: readonly number[], opts: HistogramOptions = {}): string {
  const width = opts.width ?? 560;
  const height = opts.height ?? 170;
  const padL = 44, padR = 14, padT = 12, padB = 28;
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return '<svg viewBox="0 0 ' + width + ' ' + height + '"></svg>';
  let lo = Math.min(...finite), hi = Math.max(...finite);
  for (const m of opts.markers ?? []) { lo = Math.min(lo, m.value); hi = Math.max(hi, m.value); }
  if (hi === lo) { hi = lo + 1; lo -= 1; }
  const bins = Math.max(4, opts.bins ?? 24);
  const counts = new Array<number>(bins).fill(0);
  for (const v of finite) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)));
    counts[idx]!++;
  }
  const peak = Math.max(...counts, 1);
  const x = (v: number): number => padL + ((v - lo) / (hi - lo)) * plotW;
  const barW = plotW / bins;
  const parts: string[] = ['<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" class="hist">'];
  parts.push('<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#fff"/>');
  for (let i = 0; i < bins; i++) {
    const h = (counts[i]! / peak) * plotH;
    parts.push('<rect x="' + (padL + i * barW).toFixed(1) + '" y="' + (padT + plotH - h).toFixed(1) + '" width="' + Math.max(1, barW - 1).toFixed(1) +
      '" height="' + h.toFixed(1) + '" fill="' + (opts.color ?? "#7aa2f7") + '" fill-opacity="0.75"/>');
  }
  for (const t of niceTicks(lo, hi)) {
    const px = x(t);
    parts.push('<line x1="' + px.toFixed(1) + '" y1="' + (padT + plotH) + '" x2="' + px.toFixed(1) + '" y2="' + (padT + plotH + 4) + '" stroke="#666"/>');
    parts.push('<text x="' + px.toFixed(1) + '" y="' + (height - 8) + '" font-size="10" text-anchor="middle" fill="#666">' + t.toFixed(1) + '</text>');
  }
  parts.push('<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (padL + plotW) + '" y2="' + (padT + plotH) + '" stroke="#999"/>');
  parts.push('<text x="4" y="' + (padT + 8) + '" font-size="10" fill="#666">peak ' + peak + '</text>');
  if (opts.xLabel) parts.push('<text x="' + (padL + plotW / 2) + '" y="' + (height - 22) + '" font-size="10" text-anchor="middle" fill="#666">' + escapeHtml(opts.xLabel) + '</text>');
  let legendY = padT + 10;
  for (const m of opts.markers ?? []) {
    if (!Number.isFinite(m.value)) continue;
    const px = x(m.value);
    parts.push('<line x1="' + px.toFixed(1) + '" y1="' + padT + '" x2="' + px.toFixed(1) + '" y2="' + (padT + plotH) + '" stroke="' + m.color + '" stroke-width="1.5" stroke-dasharray="4 3"/>');
    parts.push('<text x="' + (px + 4).toFixed(1) + '" y="' + legendY + '" font-size="10" fill="' + m.color + '">' + escapeHtml(m.label) + '</text>');
    legendY += 12;
  }
  parts.push('</svg>');
  return parts.join("");
}

export interface HumanReportData {
  generatedAt?: string;
  space?: string;
  validation?: {
    aut?: { n: number; validation: { metric: string; perItem: { item: string; n: number; spearman: number }[]; pooledWithinItem: { pearson: number }; meanSpearman: number }[] };
    wa?: { n: number; validation: { metric: string; perItem: { item: string; n: number; spearman: number }[]; pooledWithinItem: { pearson: number }; meanSpearman: number }[] };
  };
  dat?: {
    participantsRescored: number;
    participantsAvailable: number;
    oursInOurSpace: { mean: number; sd: number; median: number; q10: number; q90: number };
    publishedFullSample: { n: number; mean: number; sd: number };
    correlationOursVsPublished: { pearson: number; spearman: number; n: number };
    criterionValidity?: { n: number; oursVsAutOriginality: { spearman: number }; publishedVsAutOriginality: { spearman: number } };
    byStudy: { study: string; n: number; ours: { mean: number }; published: { mean: number }; correlation: { spearman: number } }[];
    participants: { score: number }[];
    machine?: { taskId: string; configId: string; crossLingual: boolean; score: number; comparison: { machineMeanPercentile: number; cliffsDelta: number; superiorityProbability: number } }[];
  };
  compare?: {
    run: string;
    tasks: {
      taskId: string; configId: string; item: string; crossLingual: boolean;
      humanChars: { mean: number };
      toItem: { machine: { mean: number }; human: { mean: number }; machineMeanPercentile: number; cliffsDelta: number };
      nearestHumanDistance: { machine: { mean: number }; human: { mean: number }; machineMeanPercentile: number; cliffsDelta: number };
    }[];
  };
}

function fmt(x: number | undefined, digits = 2): string { return x === undefined || !Number.isFinite(x) ? "n/a" : x.toFixed(digits); }

function metricTable(rows: HumanReportData["validation"] extends undefined ? never : NonNullable<NonNullable<HumanReportData["validation"]>["aut"]>["validation"]): string {
  const head = "<tr><th>自动指标</th><th>题目数</th><th>平均 Spearman</th><th>合并 r</th><th>各题目 Spearman</th></tr>";
  const body = rows.map((r) => "<tr><td>" + escapeHtml(r.metric) + "</td><td>" + r.perItem.length + "</td><td>" + fmt(r.meanSpearman) +
    "</td><td>" + fmt(r.pooledWithinItem.pearson) + "</td><td class='muted'>" +
    r.perItem.map((p) => escapeHtml(p.item) + " " + fmt(p.spearman)).join("；") + "</td></tr>").join("");
  return "<table>" + head + body + "</table>";
}

export function buildHumanHtml(data: HumanReportData): string {
  const parts: string[] = [];
  parts.push("<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><title>人类数据基线</title>");
  parts.push("<style>body{font-family:system-ui,'Noto Sans CJK SC',sans-serif;margin:24px;color:#222;max-width:1080px}" +
    "h1{font-size:22px}h2{font-size:17px;margin-top:28px}table{border-collapse:collapse;margin:10px 0;font-size:13px}" +
    "th,td{border:1px solid #ddd;padding:4px 8px;text-align:left}.muted{color:#777;font-size:12px}" +
    ".hist{border:1px solid #eee;border-radius:6px;margin:8px 0}.note{color:#555;font-size:13px}" +
    ".cols{display:flex;flex-wrap:wrap;gap:18px}</style></head><body>");
  parts.push("<h1>人类数据基线</h1>");
  parts.push("<p class='note'>生成时间 " + escapeHtml(data.generatedAt ?? "") + "；语义空间 " + escapeHtml(data.space ?? "") +
    "。数据与口径见 docs/human-baseline.md，机器可读结果见同目录 summary.json。</p>");

  const aut = data.validation?.aut;
  const wa = data.validation?.wa;
  if (aut && wa) {
    parts.push("<h2>1. 自动指标 vs 人类评分</h2>");
    parts.push("<p class='note'>AUT：n = " + aut.n + "；词语联想：n = " + wa.n + "。相关性在题目内部计算；<code>pub_glov</code> 是原论文 GloVe 距离的参照行，<code>responseLength</code> 用来检查长度是否混入评分。</p>");
    parts.push(metricTable(aut.validation));
    parts.push(metricTable(wa.validation));
  }

  const dat = data.dat;
  if (dat) {
    parts.push("<h2>2. DAT：人类分布与机器位置</h2>");
    parts.push("<p class='note'>用本仓库的嵌入重算了 " + dat.participantsRescored + " / " + dat.participantsAvailable +
      " 名参与者（固定种子抽样）：均值 " + fmt(dat.oursInOurSpace.mean) + "，标准差 " + fmt(dat.oursInOurSpace.sd) +
      "；与原论文分数（同一批人）相关 Spearman " + fmt(dat.correlationOursVsPublished.spearman) +
      "，全样本 n = " + dat.publishedFullSample.n + " 的原论文均值为 " + fmt(dat.publishedFullSample.mean) + "。</p>");
    if (dat.criterionValidity) {
      parts.push("<p class='note'>效标效度：重算的 DAT 分与同一批人的人类 AUT 原创性评分相关 Spearman " +
        fmt(dat.criterionValidity.oursVsAutOriginality.spearman) + "（n = " + dat.criterionValidity.n + "）；原论文分数同一关系 Spearman " +
        fmt(dat.criterionValidity.publishedVsAutOriginality.spearman) + "。</p>");
    }
    const markers = (dat.machine ?? []).map((m, i) => ({
      value: m.score,
      label: m.taskId + "/" + m.configId + (m.crossLingual ? "（跨语言）" : "") + " P" + Math.round(m.comparison.machineMeanPercentile * 100),
      color: ["#e5484d", "#f76808", "#12a594", "#8e4ec6"][i % 4]!
    }));
    parts.push(svgHistogram(dat.participants.map((p) => p.score), { markers, xLabel: "DAT 分数（本仓库嵌入重算）" }));
    if ((dat.machine ?? []).length > 0) {
      parts.push("<table><tr><th>任务/配置</th><th>语言</th><th>引擎 DAT 分数</th><th>人类百分位</th><th>Cliff's δ</th></tr>" +
        dat.machine!.map((m) => "<tr><td>" + escapeHtml(m.taskId + "/" + m.configId) + "</td><td>" + (m.crossLingual ? "中文（跨语言）" : "英文") +
          "</td><td>" + fmt(m.score) + "</td><td>" + fmt(m.comparison.machineMeanPercentile) + "</td><td>" + fmt(m.comparison.cliffsDelta) + "</td></tr>").join("") + "</table>");
    }
  }

  const compare = data.compare;
  if (compare) {
    parts.push("<h2>3. 机器想法 vs 同题人类作答</h2>");
    parts.push("<p class='note'>对比运行 " + escapeHtml(compare.run) + "。横轴是想法与题目词的语义距离，图里只有机器一侧的分布形态（人类分布见 summary.json 的分位数）。</p>");
    parts.push("<table><tr><th>任务/配置</th><th>语言</th><th>机器距离均值</th><th>人类距离均值</th><th>人类百分位</th><th>Cliff's δ</th></tr>" +
      compare.tasks.map((t) => "<tr><td>" + escapeHtml(t.taskId + "/" + t.configId) + "</td><td>" + (t.crossLingual ? "中文（跨语言）" : "英文") +
        "</td><td>" + fmt(t.toItem.machine.mean) + "</td><td>" + fmt(t.toItem.human.mean) + "</td><td>" + fmt(t.toItem.machineMeanPercentile) +
        "</td><td>" + fmt(t.toItem.cliffsDelta) + "</td></tr>").join("") + "</table>");
  }

  parts.push("<p class='note'>局限：人类数据是英文被试，中文任务一行是跨语言稳健性检查；人类评分是 1~5 分顺序量表，自动距离是连续值，相关系数只说明单调关系。</p>");
  parts.push("</body></html>");
  return parts.join("\n");
}
