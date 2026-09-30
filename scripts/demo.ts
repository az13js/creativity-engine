/**
 * 单任务演示：给定任务文本，跑一遍机制并打印过程与精英想法。
 *
 *   node scripts/demo.ts aut-brick                       # 用 data/ 里的任务
 *   node scripts/demo.ts --task "给独居老人设计防忘关火方案"
 *   node scripts/demo.ts aut-brick --generations 2 --save runs/demo/aut-brick.json
 *
 * 默认读本机 OpenCode 配置里的模型端点；生成结果会存成 JSON，便于回看。
 */
import fs from "node:fs";
import path from "node:path";
import { loadLlmConfig } from "../src/core/config.ts";
import { ChatClient } from "../src/llm/client.ts";
import { EmbeddingApiSpace } from "../src/core/semantic-space.ts";
import { loadCatalog } from "../src/llm/prompts.ts";
import { runCreativeEngine, DEFAULT_ENGINE_CONFIG } from "../src/agents/engine.ts";
import { loadTasks } from "../src/bench/tasks.ts";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf("--" + name);
  return i === -1 ? undefined : args[i + 1];
};
const takesValue = new Set(["--task", "--generations", "--save"]);
const inlineTask = flag("task");
const positional = args.find((a, i) => !a.startsWith("--") && !takesValue.has(args[i - 1] ?? ""));
const tasks = loadTasks();
const task = inlineTask
  ? { id: "inline", kind: "brief" as const, title: "自定义任务", prompt: inlineTask, ideasTarget: 12, style: "sentence" as const, sourceFile: "(命令行)" }
  : tasks.find((t) => t.id === positional);
if (!task) {
  console.error("找不到任务：" + (positional ?? "(空)"));
  console.error("可用任务：" + tasks.map((t) => t.id).join(", "));
  console.error('也可以直接给文本：node scripts/demo.ts --task "你的问题"');
  process.exit(1);
}

const generations = Number(flag("generations") ?? "2");
const savePath = flag("save") ?? path.join("runs", "demo", task.id + ".json");

const cfg = loadLlmConfig();
const client = new ChatClient(cfg, { concurrency: 6 });
const embed = new EmbeddingApiSpace({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.embedModel }, "runs/cache/embeddings.jsonl");

console.log("任务：" + task.title);
console.log("提示词：" + task.prompt);
const knownCount = task.knownSolutions?.length ?? task.reference?.length ?? 0;
console.log("已知方案：" + knownCount + " 条（用于算新颖度）");
if (knownCount === 0) console.log("提示：没有已知方案清单时，新颖度会一律记成 1.00，这时只看可行性一列。");

const result = await runCreativeEngine({
  client, catalog: loadCatalog(), space: embed,
  taskId: task.id, task: task.prompt, style: task.style,
  knownSolutions: task.knownSolutions ?? (task.reference ?? []).map((x) => x.text),
  config: { ...DEFAULT_ENGINE_CONFIG, generations, temperatureStep: DEFAULT_ENGINE_CONFIG.temperatureStep }
});

console.log("");
for (const e of result.events) console.log("  [" + e.generation + "] " + e.stage.padEnd(12) + e.detail);
console.log("");
for (const g of result.generations) {
  console.log("  第 " + g.index + " 轮：新增 " + g.newIdeas + " 条，平均两两距离 " + g.meanPairwiseDistance + "，平均新颖度 " + g.meanNovelty + "，簇数 " + g.clusters + "，温度 " + g.temperature);
}
console.log("");
console.log("档案：" + result.archive.size + " 格，覆盖率 " + result.archive.coverage.toFixed(3) + "，QD 分数 " + result.archive.qdScore.toFixed(3));
console.log("");
console.log("精英想法（每格一条，新颖度 / 可行性）：");
for (const e of result.archive.elites) {
  console.log("  " + (e.novelty ?? 0).toFixed(2) + " / " + (e.feasibility ?? 0).toFixed(2) + "  " + e.text);
}
console.log("");
console.log("共 " + result.ideas.length + " 条想法，全部存到 " + savePath);

fs.mkdirSync(path.dirname(savePath), { recursive: true });
fs.writeFileSync(savePath, JSON.stringify({
  task: { id: task.id, title: task.title, prompt: task.prompt },
  createdAt: new Date().toISOString(),
  config: { generations },
  generations: result.generations,
  archive: { size: result.archive.size, coverage: result.archive.coverage, qdScore: result.archive.qdScore },
  elites: result.archive.elites,
  ideas: result.ideas
}, null, 2));
embed.flush();
