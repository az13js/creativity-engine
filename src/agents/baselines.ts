/**
 * Baseline strategies the engine is compared against. All of them return the same
 * IdeaRecord shape so scoring code is shared and no baseline gets a scoring advantage.
 *  - zero-shot      : one call, "give me N ideas"
 *  - structured-cot : one call with explicit step-by-step category enumeration
 *  - self-refine    : generate -> critique -> revise (3 calls)
 */
import type { IdeaRecord, LlmLike } from "./types.ts";
import { Rng } from "../core/random.ts";

export interface BaselineOptions { ideas: number; temperature: number; maxTokens: number; seed: number; taskId: string }
const DEFAULTS: BaselineOptions = { ideas: 10, temperature: 1.0, maxTokens: 2600, seed: 7, taskId: "task" };

function parseList(raw: string): string[] {
  try {
    const { extractStringList } = require0();
    return extractStringList(raw);
  } catch { return []; }
}
// Small lazy import keep-around so this module has no top-level dependency on the parser.
function require0(): { extractStringList: (s: string) => string[] } {
  const mod = textModule as { extractStringList: (s: string) => string[] };
  return mod;
}
import * as textModule from "../core/text.ts";

function toIdeas(texts: readonly string[], cfg: BaselineOptions, agent: string, source: IdeaRecord["source"], gen = 1): IdeaRecord[] {
  return texts.map((t, i) => ({ id: agent + "-" + i, text: t.trim(), taskId: cfg.taskId, configId: agent, generation: gen, agent, source }));
}

export async function runZeroShot(client: LlmLike, task: string, options: Partial<BaselineOptions> = {}): Promise<{ ideas: IdeaRecord[]; calls: number }> {
  const cfg = { ...DEFAULTS, ...options };
  const res = await client.chat([
    { role: "system", content: "你是一名创意顾问。只输出 JSON。" },
    { role: "user", content: "【任务】" + task + "\n\n请给出 " + cfg.ideas + ' 个想法。输出格式：{"ideas":["...","..."]}' }
  ], { temperature: cfg.temperature, maxTokens: cfg.maxTokens, tag: "baseline:zero-shot" });
  return { ideas: toIdeas(textModule.extractStringList(res.content), cfg, "zero-shot", "baseline"), calls: 1 };
}

export async function runStructuredCot(client: LlmLike, task: string, options: Partial<BaselineOptions> = {}): Promise<{ ideas: IdeaRecord[]; calls: number }> {
  const cfg = { ...DEFAULTS, ...options };
  const res = await client.chat([
    { role: "system", content: "你是一名系统的创意顾问，习惯先分类再逐类展开。只输出 JSON。" },
    { role: "user", content: "【任务】" + task + "\n\n请按以下步骤工作：1) 列出至少 5 个不同的切入口/子领域；2) 每个切入口下给出具体想法；3) 合并去重。" +
      "\n共给出 " + cfg.ideas + ' 个彼此不同的想法，每个写清手段与机制。只输出 JSON：{"ideas":["...","..."]}' }
  ], { temperature: cfg.temperature, maxTokens: cfg.maxTokens, tag: "baseline:structured-cot" });
  return { ideas: toIdeas(textModule.extractStringList(res.content), cfg, "structured-cot", "baseline"), calls: 1 };
}

export async function runSelfRefine(client: LlmLike, task: string, options: Partial<BaselineOptions> = {}): Promise<{ ideas: IdeaRecord[]; calls: number }> {
  const cfg = { ...DEFAULTS, ...options };
  const draft = await client.chat([
    { role: "system", content: "你是一名创意顾问。只输出 JSON。" },
    { role: "user", content: "【任务】" + task + "\n\n先给出 " + cfg.ideas + ' 个想法。输出格式：{"ideas":["...","..."]}' }
  ], { temperature: cfg.temperature, maxTokens: cfg.maxTokens, tag: "baseline:self-refine:1" });
  const critique = await client.chat([
    { role: "system", content: "你是严格的评审，指出这些想法里哪些太平庸、哪些不可行，并说明可改进方向。" },
    { role: "user", content: "任务：" + task + "\n\n想法：\n" + draft.content.slice(0, 6000) }
  ], { temperature: 0.3, maxTokens: 1200, tag: "baseline:self-refine:2" });
  const revised = await client.chat([
    { role: "system", content: "你是一名创意顾问。只输出 JSON。" },
    { role: "user", content: "【任务】" + task + "\n\n初稿：\n" + draft.content.slice(0, 6000) + "\n\n评审意见：\n" + critique.content.slice(0, 3000) +
      "\n\n请依据评审意见重写，去掉平庸想法，给出更具体、更少套路的 " + cfg.ideas + ' 个想法。只输出 JSON：{"ideas":["...","..."]}' }
  ], { temperature: cfg.temperature, maxTokens: cfg.maxTokens, tag: "baseline:self-refine:3" });
  return { ideas: toIdeas(textModule.extractStringList(revised.content), cfg, "self-refine", "refine"), calls: 3 };
}

export { Rng };
