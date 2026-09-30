/**
 * Human-baseline CLI. Brings the published human datasets into the same pipeline as
 * the benchmark, so that the automatic instruments can be checked against human
 * raters and machine output can be placed inside the human distribution.
 *
 *   node scripts/human.ts --stage validation             # instruments vs human ratings
 *   node scripts/human.ts --stage dat --dat-sample 2000  # human DAT distribution
 *   node scripts/human.ts --stage compare --run runs/main-live
 *   node scripts/human.ts                                # all three stages
 *
 * Options
 *   --limit N        keep only N responses per item in both human datasets
 *   --limit-aut N    override the AUT limit (default 600)
 *   --limit-wa N     override the word-association limit (default 120)
 *   --dat-sample N   DAT participants to re-score in our own space (default 2000)
 *   --ref-limit N    human reference responses per item in the compare stage (default 900)
 *   --run DIRS       benchmark run directory (or comma-separated list) for the compare stage
 *   --out DIR        output directory (default runs/human-<timestamp>)
 *   --cache FILE     reuse an embedding cache file (default: in-memory only, because
 *                    the human stage embeds thousands of texts and the JSONL cache is bulky)
 *   --no-condense    skip the LLM condensation of long ideas into short use phrases
 */
import fs from "node:fs";
import path from "node:path";
import { loadLlmConfig } from "../src/core/config.ts";
import { ChatClient } from "../src/llm/client.ts";
import { EmbeddingApiSpace } from "../src/core/semantic-space.ts";
import { extractStringList } from "../src/core/text.ts";
import { mean, round } from "../src/core/stats.ts";
import {
  HUMAN_FILES, loadHumanDataset, distanceProfiles, distanceToReference, validateMetric,
  scoreDatParticipants, subsample, compareToHuman, describe, correlate, meanRating,
  type HumanRecord, type HumanDatRecord, type DistanceProfile, type MetricValidation, type Comparison, type Distribution
} from "../src/bench/human.ts";
import { extractDatWords } from "../src/bench/scoring.ts";
import { buildHumanHtml } from "../src/bench/human-report.ts";

/**
 * Benchmark tasks that answer the same prompt as a human data item. The Chinese
 * AUT items have no human counterpart, so the only Chinese row is flagged as a
 * cross-lingual robustness check rather than a like-for-like comparison.
 */
const HUMAN_ITEM_BY_TASK: Record<string, { item: string; crossLingual?: boolean }> = {
  "aut-brick": { item: "brick", crossLingual: true },
  "aut-brick-en": { item: "brick" },
  "aut-box-en": { item: "box" },
  "aut-rope-en": { item: "rope" }
};

function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  if (i === -1) return dflt;
  return process.argv[i + 1] ?? "true";
}

const stage = arg("stage", "all")!;
const limitBoth = Number(arg("limit", "0"));
const limitAut = Number(arg("limit-aut", limitBoth > 0 ? String(limitBoth) : "600"));
const limitWa = Number(arg("limit-wa", limitBoth > 0 ? String(limitBoth) : "120"));
const datSample = Number(arg("dat-sample", "2000"));
/** Human reference responses per item kept for the machine comparison (0 = all). */
const refLimit = Number(arg("ref-limit", "900"));
const cacheFile = arg("cache", "");
const runDir = arg("run", "runs/main-live")!;
const runDirs = runDir.split(",").map((s) => s.trim()).filter(Boolean);
const seed = Number(arg("seed", "20240930"));
const condenseEnabled = !process.argv.includes("--no-condense");
const outDir = arg("out", "runs/human-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19))!;
const wants = (s: string): boolean => stage === "all" || stage === s;

/**
 * Keep at most `limit` responses per item, sampled with a fixed seed. Sampling rather
 * than taking the file head matters because the files are grouped by study: a head slice
 * would silently drop whole participant groups and their rater conventions.
 */
function capPerItem(records: readonly HumanRecord[], limit: number, seed: number): HumanRecord[] {
  if (limit <= 0) return records.slice();
  const byItem = new Map<string, HumanRecord[]>();
  for (const r of records) {
    const list = byItem.get(r.item) ?? [];
    list.push(r);
    byItem.set(r.item, list);
  }
  const out: HumanRecord[] = [];
  for (const list of byItem.values()) out.push(...subsample(list, limit, seed));
  return out;
}

/** Distance columns published alongside the SemDis responses, used as reference rows. */
const PUBLISHED_KEYS = ["pub_glov", "pub_tasa", "pub_cbowu", "pub_cbows", "pub_cboww"];

/** Published distance columns are reference rows; a few missing cells are tolerated. */
function publishedMetrics(records: readonly HumanRecord[], keys: readonly string[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const key of keys) {
    const values = records.map((r) => r.extra?.[key] ?? Number.NaN);
    const present = values.filter((v) => Number.isFinite(v)).length;
    if (present > 0 && present >= 0.8 * records.length) out[key] = values;
  }
  return out;
}

function metricRows(records: readonly HumanRecord[], profiles: readonly DistanceProfile[], extra: Record<string, number[]>): { rows: MetricValidation[]; metrics: Record<string, number[]> } {
  const metrics: Record<string, number[]> = {
    toItem: profiles.map((p) => p.toItem),
    meanKOther: profiles.map((p) => p.meanKOther),
    minOther: profiles.map((p) => p.minOther),
    meanOther: profiles.map((p) => p.meanOther),
    maxOther: profiles.map((p) => p.maxOther),
    responseLength: records.map((r) => r.response.length),
    ...extra
  };
  const rows = Object.entries(metrics).map(([name, values]) => validateMetric(name, values, records));
  return { rows, metrics };
}

async function validationStage(space: EmbeddingApiSpace): Promise<unknown> {
  const aut = loadHumanDataset<HumanRecord>(HUMAN_FILES.aut);
  const autRecords = capPerItem(aut.records, limitAut, seed);
  console.log("validation: scoring " + autRecords.length + " AUT responses in " + space.name);
  const autProfiles = await distanceProfiles(autRecords, space);
  const published = publishedMetrics(autRecords, PUBLISHED_KEYS);
  const autOut = metricRows(autRecords, autProfiles, published);

  const wa = loadHumanDataset<HumanRecord>(HUMAN_FILES.wa);
  const waRecords = capPerItem(wa.records, limitWa, seed);
  console.log("validation: scoring " + waRecords.length + " word-association responses");
  const waProfiles = await distanceProfiles(waRecords, space);
  const waPublished = publishedMetrics(waRecords, PUBLISHED_KEYS);
  const waOut = metricRows(waRecords, waProfiles, waPublished);

  // Human fluency: how many answers one participant produced. Counted on the full file,
  // not the sampled subset, because sampling would truncate each person's total.
  const perParticipant = new Map<string, number>();
  for (const r of aut.records) {
    const key = r.study + "/" + r.id;
    perParticipant.set(key, (perParticipant.get(key) ?? 0) + 1);
  }
  return {
    space: space.name,
    aut: { dataset: "semdis-aut", n: autRecords.length, items: [...new Set(autRecords.map((r) => r.item))].sort(), validation: autOut.rows,
      humanRatings: describe(autRecords.map((r) => meanRating(r)).filter((x) => Number.isFinite(x))),
      humanFluency: { participants: perParticipant.size, perParticipant: describe([...perParticipant.values()]) } },
    wa: { dataset: "semdis-wa", n: waRecords.length, items: [...new Set(waRecords.map((r) => r.item))].sort(), validation: waOut.rows,
      humanRatings: describe(waRecords.map((r) => meanRating(r)).filter((x) => Number.isFinite(x))) }
  };
}

async function datStage(space: EmbeddingApiSpace): Promise<unknown> {
  const ds = loadHumanDataset<HumanDatRecord>(HUMAN_FILES.dat);
  // Everyone who also has human AUT ratings is always kept: those participants are the
  // only way to check that the re-scored DAT still tracks human-rated divergent thinking,
  // and a random slice would leave too few of them.
  const rated = ds.records.filter((r) => r.aut?.originality !== undefined);
  const picked = datSample > 0 ? [...subsample(ds.records, datSample, seed), ...rated].filter((r, i, all) => all.indexOf(r) === i) : ds.records;
  console.log("dat: re-scoring " + picked.length + " human participants in " + space.name);
  const scores = await scoreDatParticipants(picked, space);
  const ours = scores.map((s) => s.score);
  const publishedPicked = picked.map((r) => r.datPublished ?? Number.NaN);
  const publishedAll = ds.records.map((r) => r.datPublished ?? Number.NaN).filter((x) => Number.isFinite(x));
  const byStudy = [...new Set(picked.map((r) => r.study))].sort().map((study) => {
    const idx = picked.map((r, i) => [r, i] as const).filter(([r]) => r.study === study).map(([, i]) => i);
    const mine = idx.map((i) => ours[i]!);
    const pub = idx.map((i) => publishedPicked[i]!).filter((x) => Number.isFinite(x));
    return {
      study, n: idx.length,
      ours: describe(mine), published: describe(pub),
      correlation: correlate(mine, idx.map((i) => publishedPicked[i]!))
    };
  });
  return {
    space: space.name,
    participantsRescored: picked.length,
    participantsAvailable: ds.records.length,
    seed,
    oursInOurSpace: describe(ours),
    publishedSameSample: describe(publishedPicked.filter((x) => Number.isFinite(x))),
    publishedFullSample: describe(publishedAll),
    correlationOursVsPublished: correlate(ours, publishedPicked),
    criterionValidity: datCriterionValidity(scores, picked),
    byStudy,
    participants: scores.map((s, i) => ({ study: s.study, id: s.id, words: s.used, score: round(s.score, 2), published: picked[i]!.datPublished })),
    machine: await datMachineComparison(space, ours)
  };
}

/**
 * Criterion validity of the instrument: within the participants who also took the AUT,
 * a DAT score should rise with the human-rated originality of their AUT answers
 * (Olson et al. report a small positive relation). Both the published score and the
 * re-scored one are checked, so a weak re-scored relation is visible rather than hidden.
 */
function datCriterionValidity(scores: readonly { score: number }[], picked: readonly HumanDatRecord[]): unknown {
  const ours: number[] = [], published: number[] = [], originality: number[] = [];
  picked.forEach((r, i) => {
    const o = r.aut?.originality;
    if (o === undefined) return;
    ours.push(scores[i]!.score);
    published.push(r.datPublished ?? Number.NaN);
    originality.push(o);
  });
  return {
    n: originality.length,
    oursVsAutOriginality: correlate(ours, originality),
    publishedVsAutOriginality: correlate(published, originality)
  };
}

/**
 * The headline question "is the machine's DAT score human?" only needs word lists,
 * so every dat-* artifact in the run directory is re-scored in the same space as the
 * humans. dat-en-7 shares the human wording; the Chinese items are flagged as
 * cross-lingual and are not directly comparable.
 */
async function datMachineComparison(space: EmbeddingApiSpace, humanScores: readonly number[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const cell of collectCells(runDirs).filter((c) => c.taskId.startsWith("dat-"))) {
    const artifact = readArtifact(cell.dir, cell.taskId, cell.configId);
    if (!artifact) continue;
    const taskId = cell.taskId, configId = cell.configId;
    const words = extractDatWords(artifact.ideas.map((i) => i.text), 7).words;
    if (words.length < 2) continue;
    const scored = await scoreDatParticipants(
      [{ study: taskId, id: configId, words, datPublished: null, valids: words.length }], space, { count: 7 });
    const machineScores = scored.map((s) => s.score);
    out.push({
      taskId, configId, crossLingual: taskId !== "dat-en-7", words: scored[0]!.used, score: round(machineScores[0]!, 2),
      comparison: compareToHuman(machineScores, humanScores)
    });
  }
  return out;
}

const CONDENSE_SYSTEM =
  "你是数据标注员。把你的输入里每条想法压缩成一个简短的用途短语：2~6 个词，像被试用「砖头/盒子/绳子有什么用途」测验作答时写的那样，只保留核心用途，不要解释、不要标点、不要编号。\n" +
  "只输出一个 JSON 字符串数组，长度与输入相同，顺序一一对应。";

async function condenseIdeas(client: ChatClient, taskId: string, ideas: readonly string[]): Promise<string[]> {
  if (ideas.length === 0) return [];
  const { value } = await client.json<unknown>([
    { role: "system", content: CONDENSE_SYSTEM },
    { role: "user", content: JSON.stringify(ideas) }
  ], { temperature: 0, maxTokens: 2000, tag: "condense:" + taskId });
  const list = Array.isArray(value) ? value.map((x) => String(x).trim()).filter(Boolean)
    : extractStringList(typeof value === "string" ? value : JSON.stringify(value));
  if (list.length !== ideas.length) {
    throw new Error("condense returned " + list.length + " phrases for " + ideas.length + " ideas (" + taskId + ")");
  }
  return list;
}

function readArtifact(dir: string, taskId: string, configId: string): { ideas: { text: string }[] } | null {
  const file = path.join(dir, taskId + "__" + configId + ".json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as { ideas: { text: string }[] };
}

/**
 * Collect the benchmark cells to compare against human data across one or more run
 * directories (first directory wins on conflicts). Cells are keyed by task/config so
 * that a Chinese run and an English run can be combined in one table.
 */
function collectCells(dirs: readonly string[]): { taskId: string; configId: string; dir: string }[] {
  const seen = new Map<string, { taskId: string; configId: string; dir: string }>();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).sort()) {
      const m = /^([A-Za-z0-9-]+)__([A-Za-z0-9._-]+).json$/.exec(file);
      if (!m || m[2]!.includes("__")) continue; // skip score__task__config.json aggregates
      const key = m[1] + "/" + m[2];
      if (!seen.has(key)) seen.set(key, { taskId: m[1]!, configId: m[2]!, dir });
    }
  }
  return [...seen.values()];
}

async function compareStage(space: EmbeddingApiSpace, client: ChatClient | null): Promise<unknown> {
  const aut = loadHumanDataset<HumanRecord>(HUMAN_FILES.aut);
  const cells = collectCells(runDirs);
  const tasks: any[] = [];
  for (const [taskId, spec] of Object.entries(HUMAN_ITEM_BY_TASK)) {
    const item = spec.item;
    const humanRecords = capPerItem(aut.records.filter((r) => r.item === item), refLimit, seed);
    if (humanRecords.length === 0) continue;
    console.log("compare: " + taskId + " vs " + humanRecords.length + " human '" + item + "' responses");
    const humanProfiles = await distanceProfiles(humanRecords, space);
    const reference = new Map([[item, humanRecords.map((r) => r.response)]]);
    for (const cell of cells.filter((c) => c.taskId === taskId)) {
      const configId = cell.configId;
      const artifact = readArtifact(cell.dir, taskId, configId);
      if (!artifact || artifact.ideas.length === 0) continue;
      const ideas = artifact.ideas.map((i) => i.text);
      const condensed = condenseEnabled && client ? await condenseIdeas(client, taskId + "/" + configId, ideas) : ideas;
      const rawDistances = await distanceToReference(ideas.map((text) => ({ item, text })), reference, space);
      const shortDistances = condensed === ideas ? rawDistances
        : await distanceToReference(condensed.map((text) => ({ item, text })), reference, space);
      const humanToItem = humanProfiles.map((p) => p.toItem);
      const humanNear = humanProfiles.map((p) => p.meanKOther);
      tasks.push({
        taskId, configId, item, crossLingual: spec.crossLingual === true, nIdeas: ideas.length,
        meanChars: round(mean(ideas.map((i) => i.length)), 1),
        meanCondensedChars: round(mean(condensed.map((c) => c.length)), 1),
        humanChars: describe(humanRecords.map((r) => r.response.length)),
        // Long, elaborate machine answers are not comparable to one-phrase human answers,
        // so the headline comparison uses the condensed form and the raw form is kept alongside.
        toItem: compareToHuman(shortDistances.map((d) => d.toItem), humanToItem),
        toItemRaw: compareToHuman(rawDistances.map((d) => d.toItem), humanToItem),
        nearestHumanDistance: compareToHuman(shortDistances.map((d) => d.meanKRef), humanNear),
        nearestHumanDistanceRaw: compareToHuman(rawDistances.map((d) => d.meanKRef), humanNear),
        examples: condensed.slice(0, 5)
      });
    }
  }
  return { run: runDir, condensedWithLlm: condenseEnabled && client !== null, tasks };
}

function fmt(x: number, digits = 3): string { return Number.isFinite(x) ? x.toFixed(digits) : "n/a"; }

function validationTable(title: string, n: number, rows: readonly MetricValidation[]): string {
  const lines = ["### " + title + "（n = " + n + " 条人类作答）", "",
    "| 自动指标 | 题目数 | Fisher 平均 Spearman | Fisher 平均 Pearson | 合并（题内标准化）r | 为正的题目占比 | 各题目 Spearman |",
    "| --- | --- | --- | --- | --- | --- | --- |"];
  for (const r of rows) {
    const per = r.perItem.map((x) => x.item + " " + fmt(x.spearman, 2)).join("；");
    lines.push("| " + r.metric + " | " + r.perItem.length + " | " + fmt(r.meanSpearman) + " | " + fmt(r.meanPearson) + " | " +
      fmt(r.pooledWithinItem.pearson) + " | " + fmt(r.positiveShare, 2) + " | " + per + " |");
  }
  lines.push("");
  return lines.join("\n");
}

function comparisonTable(rows: readonly any[]): string {
  const lines = ["| 任务/配置 | 语言 | 想法数 | 压缩后平均字数 | 人类平均字数 | 与题目距离（机器均值 → 人类百分位） | Cliff's δ | 与最近人类作答的距离（机器均值 → 百分位） |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const t of rows) {
    lines.push("| " + t.taskId + "/" + t.configId + " | " + (t.crossLingual ? "中文（跨语言）" : "英文") + " | " + t.nIdeas + " | " + t.meanCondensedChars + " | " + fmt(t.humanChars.mean, 1) +
      " | " + fmt(t.toItem.machine.mean) + " → " + fmt(t.toItem.machineMeanPercentile, 2) + " | " + fmt(t.toItem.cliffsDelta) +
      " | " + fmt(t.nearestHumanDistance.machine.mean) + " → " + fmt(t.nearestHumanDistance.machineMeanPercentile, 2) + " |");
  }
  lines.push("");
  return lines.join("\n");
}

function buildReport(out: any): string {
  const lines: string[] = [];
  lines.push("# 人类数据基线报告", "");
  lines.push("本报告由 `npm run human` 生成，原始数据见 `data/human/`，导入脚本见 `scripts/fetch-human-data.ts`。", "");
  lines.push("- 语义空间：" + (out.space ?? out.validation?.space ?? "unknown"));
  lines.push("- 生成时间：" + out.generatedAt);
  lines.push("- 抽样：AUT 每题 " + out.limitAut + " 条，词语联想每题 " + out.limitWa + " 条，机器对比的每题人类参照 " +
    out.refLimit + " 条，DAT " + out.datSample + " 人（种子 " + out.seed + "）");
  if (out.validation) {
    lines.push("", "## 1. 自动指标与人类评分的相关", "",
      "人类数据：SemDis（Beaty & Johnson, 2021）公开的 AUT 与词语联想作答，每题 1~4 名人类评分者。相关性都在题目内部计算（不同题目的分数不可直接合并）。", "");
    if (out.validation.aut.humanFluency) {
      const f = out.validation.aut.humanFluency;
      lines.push("人类流畅性（每人给出的作答条数，含所有题目）：" + f.participants + " 名参与者，均值 " + fmt(f.perParticipant.mean, 2) +
        "，中位数 " + fmt(f.perParticipant.median, 2) + "，P10~P90 " + fmt(f.perParticipant.q10, 2) + "~" + fmt(f.perParticipant.q90, 2) +
        "；机器一次运行给出一道题的 30 条左右。两者任务时长不同，只能作为量级参照。", "");
    }
    lines.push(validationTable("AUT 题目", out.validation.aut.n, out.validation.aut.validation));
    lines.push(validationTable("词语联想题目", out.validation.wa.n, out.validation.wa.validation));
    lines.push("`pub_glov` 是原论文用 GloVe 词向量算出的语义距离，作为自动指标的参照行：本仓库算的 `toItem` 需要在同一个数量级上。`responseLength` 是作答字数与人类评分的相关，用来检查「长度混入评分」的干扰。", "");
  }
  if (out.dat) {
    const d = out.dat;
    lines.push("## 2. 发散联想任务（DAT）：人类分布与机器位置", "",
      "- 人类参与者总数：" + d.participantsAvailable + "，本次用本仓库的嵌入在本机重算了 " + d.participantsRescored + " 人（固定种子抽样）");
    lines.push("- 重算分布：均值 " + fmt(d.oursInOurSpace.mean, 2) + "，标准差 " + fmt(d.oursInOurSpace.sd, 2) +
      "，中位数 " + fmt(d.oursInOurSpace.median, 2) + "（P10 " + fmt(d.oursInOurSpace.q10, 2) + " ~ P90 " + fmt(d.oursInOurSpace.q90, 2) + "）");
    lines.push("- 同一批人用原论文 GloVe 分数：均值 " + fmt(d.publishedSameSample.mean, 2) + "；全样本（n = " + d.publishedFullSample.n + "）均值 " + fmt(d.publishedFullSample.mean, 2));
    lines.push("- 两套分数相关：Pearson " + fmt(d.correlationOursVsPublished.pearson) + "，Spearman " + fmt(d.correlationOursVsPublished.spearman) + "（n = " + d.correlationOursVsPublished.n + "）");
    if (d.criterionValidity) {
      lines.push("- 效标效度（本仓库重算的 DAT 分 vs 同一批人的人类 AUT 原创性评分）：Spearman " +
        fmt(d.criterionValidity.oursVsAutOriginality.spearman) + "（n = " + d.criterionValidity.n + "）；原论文分数同一关系 Spearman " +
        fmt(d.criterionValidity.publishedVsAutOriginality.spearman) + "。两套分数都要能复现「DAT 与 AUT 原创性弱正相关」这一原论文结论。");
    }
    lines.push("");
    lines.push("| 子研究 | n | 本仓库重算均值 | 原论文分数均值 | 相关（Spearman） |", "| --- | --- | --- | --- | --- |");
    for (const s of d.byStudy) lines.push("| " + s.study + " | " + s.n + " | " + fmt(s.ours.mean, 2) + " | " + fmt(s.published.mean, 2) + " | " + fmt(s.correlation.spearman) + " |");
    lines.push("");
    const machine = (d.machine ?? []) as any[];
    if (machine.length > 0) {
      lines.push("机器在同一个语义空间里的 DAT 分数与人类分布比较（对比运行：`" + runDir + "`）：", "",
        "| 任务/配置 | 语言 | 引擎 DAT 分数 | 人类百分位 | Cliff's δ | P(引擎 > 随机一名人类) |", "| --- | --- | --- | --- | --- | --- |");
      for (const m of machine) {
        lines.push("| " + m.taskId + "/" + m.configId + " | " + (m.crossLingual ? "中文（跨语言）" : "英文") + " | " + fmt(m.score, 2) +
          " | " + fmt(m.comparison.machineMeanPercentile, 2) + " | " + fmt(m.comparison.cliffsDelta) + " | " + fmt(m.comparison.superiorityProbability, 2) + " |");
      }
      lines.push("", "人类分布是 " + d.participantsRescored + " 名真实参与者用同一嵌入重算出来的；百分位指引擎分数在这批人类分数中的位置。", "");
    }
  }
  if (out.compare) {
    lines.push("## 3. 机器想法 vs 同一题目下的人类作答", "",
      "对比运行：" + out.compare.run + "。机器想法先用模型压缩成 2~6 个词的短语，再与人类的短语作答在同一嵌入空间里比较；`toItem` 是与题目词（brick/box/rope）的语义距离，人类一列即原始被试的分布。", "");
    lines.push(comparisonTable(out.compare.tasks));
  }
  lines.push("## 局限", "",
    "- 人类数据来自英文被试（美国/英国样本），机器任务是中文与英文两套，跨语言距离没有校准；因此第 3 节只在英文任务（`aut-box-en`、`aut-rope-en`）与 `aut-brick` 上做同题比较。",
    "- 人类评分是 1~5 分的顺序量表，自动距离是连续值；相关系数只说明单调关系强弱，不代表分数可直接换算。",
    "- 本报告不是「超过人类」的证据：它给出的是机器输出在人类分布中的位置（百分位）和自动指标相对人类评分的效度。", "");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const cfg = loadLlmConfig();
  const space = new EmbeddingApiSpace(
    { baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.embedModel, batchSize: 32 },
    cacheFile === "" ? undefined : cacheFile
  );
  const client = wants("compare") && condenseEnabled ? new ChatClient(cfg, { concurrency: 4 }) : null;
  fs.mkdirSync(outDir, { recursive: true });

  const out: Record<string, unknown> = { generatedAt: new Date().toISOString(), space: space.name, stage, limitAut, limitWa, refLimit, datSample, seed };
  if (wants("validation")) out.validation = await validationStage(space);
  if (wants("dat")) out.dat = await datStage(space);
  if (wants("compare")) out.compare = await compareStage(space, client);

  space.flush();
  const report = buildReport(out);
  const summaryFile = path.join(outDir, "summary.json");
  fs.writeFileSync(summaryFile, JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(outDir, "report.md"), report);
  fs.writeFileSync(path.join(outDir, "report.html"), buildHumanHtml(out as never));
  console.log(report);
  console.log("summary:", summaryFile);
  console.log("report:", path.join(outDir, "report.md"), path.join(outDir, "report.html"));
}

await main();
