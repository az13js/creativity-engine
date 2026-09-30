/**
 * Prompt templates for the multi-agent creativity engine.
 * Everything here is data-driven: the operator catalogue lives in data/operators.json,
 * so the prompt layer can be swapped or unit-tested without touching orchestration code.
 */
import fs from "node:fs";
import { Rng } from "../core/random.ts";
import type { ChatMessage } from "./client.ts";

export interface Operator { id: string; name: string; origin: string; prompt: string }
export interface Persona { id: string; name: string; stance: string }
export interface OperatorCatalog { version: number; note: string; operators: Operator[]; personas: Persona[]; stimuli: string[] }

export function loadCatalog(file = "data/operators.json"): OperatorCatalog {
  return JSON.parse(fs.readFileSync(file, "utf8")) as OperatorCatalog;
}

export type OutputStyle = "sentence" | "word" | "labeled";

/**
 * The generator system prompt adapts to the task's output style:
 *  - sentence : normal design/ideation tasks, each idea is a mechanism sentence
 *  - word     : association tasks (DAT style), each idea is a single noun
 *  - labeled  : item-answer tasks (RAT style), each idea is "rat-01=answer"
 */
export function generatorSystem(style: OutputStyle = "sentence"): string {
  const common = [
    "你是一名发散思维生成器（divergent-thinking generator），只负责产出候选想法，不做取舍。",
    "要求：",
    "1. 严格遵守用户指定的认知算子（cognitive operator）；算子之外的一般化建议视为不合格。",
    "2. 想法之间必须来自不同思路，不要用同一句话换措辞。",
    "3. 不要输出解释、前言或总结，只输出 JSON。"
  ];
  if (style === "word") {
    return [...common,
      "2. 每条想法只写一个名词（2-6 个字符），不要写成句子、不要写解释；该任务测量的是词与词之间的语义距离。",
      '输出格式：{"ideas":[{"idea":"名词"},{"idea":"名词"}]}'
    ].join("\n");
  }
  if (style === "labeled") {
    return [...common,
      '2. 每条想法写成「题目编号=答案」，例如 {"idea":"rat-01=cheese"}；答案必须是单个英文单词，不要写解释。',
      '输出格式：{"ideas":[{"idea":"rat-01=answer"},{"idea":"rat-02=answer"}]}'
    ].join("\n");
  }
  return [...common,
    "2. 每个想法都写成「手段 + 机制 + 预期效果」的一句话，具体、可指认，避免「提高效率」「加强管理」这类空话。",
    '输出格式：{"ideas":[{"idea":"...","rationale":"..."}]}'
  ].join("\n");
}

export const GENERATOR_SYSTEM = generatorSystem("sentence");

export interface GeneratorPromptInput {
  task: string;
  operator: Operator;
  persona: Persona;
  stimulus: string;
  count: number;
  generation: number;
  /** Ideas already produced in this run; the generator must avoid repeating them. */
  avoid?: readonly string[];
  /** Elites inherited from the archive, to be improved upon rather than repeated. */
  seeds?: readonly string[];
  extraConstraints?: string[];
  /** Output shape for this task; defaults to full mechanism sentences. */
  style?: OutputStyle;
}

export function generatorMessages(input: GeneratorPromptInput): ChatMessage[] {
  const parts: string[] = [];
  parts.push("【任务】\n" + input.task);
  parts.push("【本轮认知算子】" + input.operator.name + "（" + input.operator.origin + "）\n" + input.operator.prompt);
  parts.push("【采用视角】" + input.persona.name + "：" + input.persona.stance);
  parts.push("【随机刺激词】" + input.stimulus);
  if (input.extraConstraints?.length) parts.push("【附加约束】" + input.extraConstraints.join("；"));
  if (input.seeds?.length) parts.push("【可继承并改进的已有最优想法】\n" + input.seeds.map((s, i) => (i + 1) + ". " + s).join("\n") + "\n请在其基础上改进、变体或反其道而行，不要原样复述。");
  if (input.avoid?.length) parts.push("【必须避免重复的想法】\n" + input.avoid.map((s, i) => (i + 1) + ". " + s).join("\n"));
  const styleHint = input.style === "word" ? "每条只写一个名词。" : input.style === "labeled" ? "每条写成「题目编号=答案」。" : "";
  parts.push("【产出要求】给出 " + input.count + " 条互不相同的想法（第 " + input.generation + " 轮）。" + styleHint);
  return [{ role: "system", content: generatorSystem(input.style ?? "sentence") }, { role: "user", content: parts.join("\n\n") }];
}

export const BLENDER_SYSTEM = [
  "你是一名概念融合器（conceptual blender）。你拿到来自不同思路簇的两组想法，",
  "任务是按 Fauconnier & Turner 的概念融合框架构造新想法：",
  "1. 写出两个输入空间共享的抽象结构（generic space）；",
  "2. 在融合空间中把双方的关键机制叠加；",
  "3. 明确说明融合后涌现出的、任何单一输入空间都不具备的新性质。",
  "只输出 JSON。"
].join("\n");

export interface BlendInput { task: string; ideaA: string; ideaB: string; extraConstraints?: string[] }

export function blenderMessages(input: BlendInput): ChatMessage[] {
  const user = [
    "【任务】" + input.task,
    "【输入空间 A】" + input.ideaA,
    "【输入空间 B】" + input.ideaB,
    input.extraConstraints?.length ? "【附加约束】" + input.extraConstraints.join("；") : "",
    '【输出】{"generic_space":"...","blend":"一句到三句话描述融合方案","emergent":"...","risks":"..."}'
  ].filter(Boolean).join("\n\n");
  return [{ role: "system", content: BLENDER_SYSTEM }, { role: "user", content: user }];
}

export const CRITIC_SYSTEM = [
  "你是一名严格的技术评审（critic）。你的职责不是鼓励，而是找出想法在物理、法规、成本、时间上的具体漏洞。",
  "评分尺度：feasibility 0-10（今天的技术能否实现）、novelty 0-10（相对常识是否新）、impact 0-10（若成立影响多大）。",
  "对每条想法给出一句最关键的失败原因（failure_mode），找不到就写 none。",
  '只输出 JSON：{"reviews":[{"index":1,"feasibility":0,"novelty":0,"impact":0,"failure_mode":"..."}]}'
].join("\n");

export function criticMessages(task: string, ideas: readonly string[]): ChatMessage[] {
  return [
    { role: "system", content: CRITIC_SYSTEM },
    { role: "user", content: "【任务】" + task + "\n\n【待评审想法】\n" + ideas.map((s, i) => (i + 1) + ". " + s).join("\n") + "\n\n请对全部 " + ideas.length + " 条逐一评分。" }
  ];
}

export const JUDGE_SYSTEM = [
  "你是一名成对比较评委（pairwise judge）。你会看到同一任务下的两个想法 A 和 B，",
  "请判断哪一个更好。判断标准按优先级：(1) 想法的机制是否具体可行；(2) 是否超出常规套路；(3) 若成立影响是否显著。",
  '只输出 JSON：{"winner":"A"|"B"|"tie","reason":"一句话"}'
].join("\n");

export function judgeMessages(task: string, a: string, b: string): ChatMessage[] {
  return [
    { role: "system", content: JUDGE_SYSTEM },
    { role: "user", content: "【任务】" + task + "\n\n【想法 A】" + a + "\n\n【想法 B】" + b + "\n\n哪一个更好？" }
  ];
}

export const META_SYSTEM = [
  "你是一名元反思者（meta-reflector），负责诊断一次发散思维循环是否陷入同质化。",
  "你会看到上一轮想法的统计特征与抽样文本。如果想法彼此雷同，请指出是哪一类套路在重复；",
  "如果已经足够分散，请指出下一轮应当转向的空白方向。",
  '只输出 JSON：{"diagnosis":"...","recommended_operators":["算子id"],"recommended_note":"给下一轮生成者的额外约束"}'
].join("\n");

export interface MetaInput { task: string; meanPairwiseDistance: number; novelty: number; sample: readonly string[]; operatorIds: readonly string[] }

export function metaMessages(input: MetaInput): ChatMessage[] {
  return [
    { role: "system", content: META_SYSTEM },
    { role: "user", content: [
      "【任务】" + input.task,
      "【上一轮统计】平均两两语义距离=" + input.meanPairwiseDistance.toFixed(3) + "，相对已知方案的新颖度=" + input.novelty.toFixed(3),
      "【上一轮想法抽样】\n" + input.sample.map((s, i) => (i + 1) + ". " + s).join("\n"),
      "【可选算子 id】" + input.operatorIds.join(", "),
      '【输出】{"diagnosis":"...","recommended_operators":["..."],"recommended_note":"..."}'
    ].join("\n") }]
    ;
}

export function pickStimulus(stimuli: readonly string[], rng: Rng): string { return rng.pick(stimuli); }