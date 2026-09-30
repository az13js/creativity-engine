/**
 * Human-readable single-task demo of the mechanism.
 *   node scripts/demo.ts [taskId]
 * Prints the operator dispatch, per-generation metrics, archive coverage and the elite set.
 */
import { loadLlmConfig } from "../src/core/config.ts";
import { ChatClient } from "../src/llm/client.ts";
import { EmbeddingApiSpace } from "../src/core/semantic-space.ts";
import { loadCatalog } from "../src/llm/prompts.ts";
import { runCreativeEngine, DEFAULT_ENGINE_CONFIG } from "../src/agents/engine.ts";
import { loadTasks } from "../src/bench/tasks.ts";

const taskId = process.argv[2] ?? "aut-brick";
const task = loadTasks().find((t) => t.id === taskId);
if (!task) { console.error("unknown task", taskId); process.exit(1); }

const cfg = loadLlmConfig();
const client = new ChatClient(cfg, { concurrency: 6 });
const embed = new EmbeddingApiSpace({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.embedModel }, "runs/cache/embeddings.jsonl");
const space = embed;

console.log("任务:", task.title);
console.log("提示词:", task.prompt);
console.log("已知方案语料条数:", task.knownSolutions?.length ?? task.reference?.length ?? 0);
console.log("");

const result = await runCreativeEngine({
  client, catalog: loadCatalog(), space, taskId: task.id, task: task.prompt,
  knownSolutions: task.knownSolutions ?? (task.reference ?? []).map((x) => x.text),
  config: { ...DEFAULT_ENGINE_CONFIG, generations: 2 }
});

for (const e of result.events) console.log("  [" + e.generation + "] " + e.stage.padEnd(10) + " " + e.detail);
console.log("");
console.log("逐轮指标:");
for (const g of result.generations) console.log("  第 " + g.index + " 轮: 新增 " + g.newIdeas + " 条, 平均两两距离 " + g.meanPairwiseDistance + ", 平均新颖度 " + g.meanNovelty + ", 簇数 " + g.clusters + ", 温度 " + g.temperature);
console.log("");
console.log("档案: " + result.archive.size + " 格, 覆盖率 " + result.archive.coverage.toFixed(3) + ", QD-score " + result.archive.qdScore.toFixed(3));
console.log("");
console.log("精英集合（每格最优）:");
for (const e of result.archive.elites.slice(0, 10)) {
  console.log("  · [" + e.cell + "] 新颖度=" + (e.novelty ?? 0).toFixed(2) + " 可行性=" + (e.feasibility ?? 0).toFixed(2) + "  " + e.text.slice(0, 90));
}
console.log("");
console.log("全部想法: " + result.ideas.length + " 条（详见 runs/ 目录的 JSON 产物）");
embed.flush();