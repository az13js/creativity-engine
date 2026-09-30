/**
 * 最小可运行示例：把机制当成一个函数用。
 *
 *   node examples/quickstart.ts
 *
 * 需要模型端点（环境变量或本机 OpenCode 配置）。第一次运行会真的调用模型，
 * 之后同样的提示词会走磁盘缓存。
 */
import { loadLlmConfig } from "../src/core/config.ts";
import { ChatClient } from "../src/llm/client.ts";
import { EmbeddingApiSpace } from "../src/core/semantic-space.ts";
import { loadCatalog } from "../src/llm/prompts.ts";
import { runCreativeEngine } from "../src/agents/engine.ts";

const cfg = loadLlmConfig();
const client = new ChatClient(cfg, { concurrency: 6 });
const space = new EmbeddingApiSpace(
  { baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.embedModel },
  "runs/cache/embeddings.jsonl"
);

const task = "办公室里的打印机经常卡纸，请给出让这件事不再发生的方案。";
const knownSolutions = [
  "定期清理纸屑",
  "换更贵的纸",
  "贴一张操作说明在机器上",
  "让行政每周检查一次"
];

const result = await runCreativeEngine({
  client,
  catalog: loadCatalog(),
  space,
  taskId: "quickstart-printer",
  task,
  knownSolutions,
  config: {
    generations: 1,
    generators: 2,
    ideasPerGenerator: 2,
    blendPairs: 0,
    useCritic: true,
    useMetaReflector: false
  }
});

console.log("产出 " + result.ideas.length + " 条想法，档案 " + result.archive.size + " 格");
for (const idea of result.archive.elites) {
  console.log("- 新颖度 " + (idea.novelty ?? 0).toFixed(2) + "，可行性 " + (idea.feasibility ?? 0).toFixed(2) + "：" + idea.text);
  if (idea.failureMode && idea.failureMode !== "none") console.log("  失败模式：" + idea.failureMode);
}

space.flush();
