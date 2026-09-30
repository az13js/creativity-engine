import { loadLlmConfig } from "../src/core/config.ts";
const cfg = loadLlmConfig();
const post = async (label: string, body: Record<string, unknown>) => {
  const r = await fetch(cfg.baseURL.replace(/\/$/, "") + "/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + cfg.apiKey }, body: JSON.stringify(body) });
  const t = await r.text();
  console.log(label, r.status, t.slice(0, 160).replace(/\s+/g, " "));
};
const M = "deepseek-v4.1-flash";
const msgs = [{ role: "user", content: "回答一个字：好" }];
await post("minimal           ", { model: M, messages: msgs });
await post("+max_tokens       ", { model: M, messages: msgs, max_tokens: 200 });
await post("+temperature      ", { model: M, messages: msgs, max_tokens: 200, temperature: 1.0 });
await post("+seed             ", { model: M, messages: msgs, max_tokens: 200, seed: 1234 });
await post("+reasoning off    ", { model: M, messages: msgs, max_tokens: 200, reasoning_effort: "off" });
await post("+reasoning none   ", { model: M, messages: msgs, max_tokens: 200, reasoning_effort: "none" });
await post("+response_format  ", { model: M, messages: msgs, max_tokens: 200, response_format: { type: "json_object" } });
