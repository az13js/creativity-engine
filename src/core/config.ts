/**
 * Resolves the OpenAI-compatible endpoint used by the benchmark.
 * Priority: environment variables -> the user's local OpenCode configuration.
 * The API key is read at runtime only and is never written into any artefact.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface LlmConfig {
  baseURL: string;
  apiKey: string;
  chatModel: string;
  embedModel: string;
  reasoningEffort?: string;
}

interface OpenCodeConfig {
  provider?: Record<string, { options?: { baseURL?: string; apiKey?: string }; models?: Record<string, unknown> }>;
  model?: string;
}

export function loadLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const out: Partial<LlmConfig> = {};
  if (env.CREATIVE_BASE_URL) out.baseURL = env.CREATIVE_BASE_URL;
  if (env.CREATIVE_API_KEY) out.apiKey = env.CREATIVE_API_KEY;
  if (env.CREATIVE_CHAT_MODEL) out.chatModel = env.CREATIVE_CHAT_MODEL;
  if (env.CREATIVE_EMBED_MODEL) out.embedModel = env.CREATIVE_EMBED_MODEL;
  if (out.baseURL && out.apiKey) {
    return { baseURL: out.baseURL, apiKey: out.apiKey, chatModel: out.chatModel ?? "deepseek-v4.1-flash", embedModel: out.embedModel ?? "qwen3-embedding:latest", reasoningEffort: env.CREATIVE_REASONING ?? "none" };
  }
  const cfgPath = path.join(os.homedir(), ".config", "opencode", "opencode.json");
  if (!fs.existsSync(cfgPath)) throw new Error("no LLM configuration: set CREATIVE_BASE_URL/CREATIVE_API_KEY or provide " + cfgPath);
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as OpenCodeConfig;
  const providers = Object.entries(cfg.provider ?? {});
  const proxy = providers.find(([, v]) => v.options?.baseURL && v.options?.apiKey);
  if (!proxy) throw new Error("no provider with baseURL/apiKey found in " + cfgPath);
  const modelFromCfg = cfg.model?.split("/").slice(1).join("/");
  return {
    baseURL: out.baseURL ?? proxy[1].options!.baseURL!,
    apiKey: out.apiKey ?? proxy[1].options!.apiKey!,
    chatModel: out.chatModel ?? modelFromCfg ?? "deepseek-v4.1-flash",
    embedModel: out.embedModel ?? "qwen3-embedding:latest",
    reasoningEffort: env.CREATIVE_REASONING ?? "none"
  };
}
