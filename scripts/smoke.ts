/**
 * Connectivity smoke test: one chat call and one embedding call.
 *   node scripts/smoke.ts
 */
import { loadLlmConfig } from "../src/core/config.ts";
import { ChatClient } from "../src/llm/client.ts";
import { EmbeddingApiSpace } from "../src/core/semantic-space.ts";

const cfg = loadLlmConfig();
const client = new ChatClient(cfg, { concurrency: 2 });
const t0 = Date.now();
const r = await client.chat([{ role: "user", content: '只输出JSON：{"n":3,"words":["砖头","风筝","潮汐"]}' }], { maxTokens: 300, tag: "smoke" });
console.log("chat:", JSON.stringify(r.content).slice(0, 200), "cached:", r.cached, "ms:", Date.now() - t0);

const space = new EmbeddingApiSpace({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.embedModel }, "runs/cache/embeddings.jsonl");
const m = await space.similarityMatrix(["cat", "dog", "quasar", "brick", "砖头", "风筝"]);
console.log("sim cat~dog", m[0]![1]!.toFixed(3), "cat~quasar", m[0]![2]!.toFixed(3), "cat~brick", m[0]![3]!.toFixed(3));
console.log("sim cat~砖头", m[0]![4]!.toFixed(3), "砖头~风筝", m[4]![5]!.toFixed(3));
space.flush();
console.log("stats", JSON.stringify(client.getStats()));
