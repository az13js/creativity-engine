/**
 * Minimal OpenAI-compatible chat client:
 *  - deterministic on-disk cache keyed by (model, messages, sampling parameters),
 *    so re-running the benchmark is free and results stay auditable;
 *  - bounded concurrency, retries with exponential backoff, hard timeouts;
 *  - every call appended to a JSONL audit log with token usage.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { LlmConfig } from "../core/config.ts";

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  /** Kept for API symmetry: this endpoint rejects response_format, so JSON is enforced by prompt + tolerant parsing. */
  json?: boolean;
  /** Reasoning effort ("off" disables the reasoning trace on this endpoint). */
  reasoningEffort?: string;
  /** Label stored in the audit log, e.g. "generator-blender". */
  tag?: string;
  /** Bypass the on-disk cache (used when deliberately sampling the same prompt again). */
  noCache?: boolean;
}

export interface ChatResult {
  content: string;
  reasoning?: string;
  model: string;
  cached: boolean;
  ms: number;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  key: string;
}

export interface ClientStats { calls: number; cached: number; promptTokens: number; completionTokens: number; failures: number }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;
  private limit: number;
  constructor(limit: number) { this.limit = limit; }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    try { return await fn(); } finally { this.active--; const next = this.queue.shift(); if (next) next(); }
  }
}

export interface ChatClientOptions {
  cacheDir?: string;
  logFile?: string;
  concurrency?: number;
  maxRetries?: number;
  timeoutMs?: number;
  /** Set to false to disable the cache entirely (tests). */
  useCache?: boolean;
}

export class ChatClient {
  readonly config: LlmConfig;
  private opts: Required<ChatClientOptions>;
  private sem: Semaphore;
  private stats: ClientStats = { calls: 0, cached: 0, promptTokens: 0, completionTokens: 0, failures: 0 };

  constructor(config: LlmConfig, options: ChatClientOptions = {}) {
    this.config = config;
    this.opts = {
      cacheDir: options.cacheDir ?? "runs/cache/chat",
      logFile: options.logFile ?? "runs/cache/chat-log.jsonl",
      concurrency: options.concurrency ?? 4,
      maxRetries: options.maxRetries ?? 4,
      timeoutMs: options.timeoutMs ?? 180_000,
      useCache: options.useCache ?? true
    };
    this.sem = new Semaphore(this.opts.concurrency);
  }

  private cacheKey(body: Record<string, unknown>): string {
    return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 32);
  }

  private cachePath(key: string): string { return path.join(this.opts.cacheDir, key + ".json"); }

  async chat(messages: readonly ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const model = options.model ?? this.config.chatModel;
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 1.0,
      max_tokens: options.maxTokens ?? 2048,
      seed: options.seed ?? 1234
    };
    // "off" is not accepted by this endpoint; "none" disables the reasoning trace.
    const effort = options.reasoningEffort ?? this.config.reasoningEffort;
    if (effort) body.reasoning_effort = effort === "off" ? "none" : effort;
    const key = this.cacheKey({ ...body, tag: options.tag ?? "" });

    if (this.opts.useCache && !options.noCache) {
      const p = this.cachePath(key);
      if (fs.existsSync(p)) {
        const hit = JSON.parse(fs.readFileSync(p, "utf8")) as ChatResult;
        this.stats.calls++; this.stats.cached++;
        return { ...hit, cached: true };
      }
    }

    const started = Date.now();
    const result = await this.sem.run(() => this.request(messages, body));
    const elapsed = Date.now() - started;
    const out: ChatResult = { ...result, model, cached: false, ms: elapsed, key };
    this.stats.calls++;
    this.stats.promptTokens += result.usage?.promptTokens ?? 0;
    this.stats.completionTokens += result.usage?.completionTokens ?? 0;
    if (this.opts.useCache) {
      fs.mkdirSync(this.opts.cacheDir, { recursive: true });
      fs.writeFileSync(this.cachePath(key), JSON.stringify(out, null, 2));
    }
    this.log({ tag: options.tag ?? "", model, temperature: body.temperature, ms: elapsed, usage: result.usage, key, messages: messages.length });
    return out;
  }

  private async request(messages: readonly ChatMessage[], body: Record<string, unknown>): Promise<{ content: string; reasoning?: string; usage?: ChatResult["usage"] }> {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < this.opts.maxRetries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
      try {
        const res = await fetch(this.config.baseURL.replace(/\/$/, "") + "/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + this.config.apiKey },
          body: JSON.stringify(body),
          signal: ctrl.signal
        });
        if (!res.ok) {
          const text = (await res.text()).slice(0, 300);
          throw new Error("HTTP " + res.status + ": " + text);
        }
        const json = (await res.json()) as {
          choices?: { message?: { content?: string; reasoning_content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        const msg = json.choices?.[0]?.message;
        if (!msg) throw new Error("empty response body");
        return {
          content: msg.content ?? "",
          reasoning: msg.reasoning_content,
          usage: json.usage ? { promptTokens: json.usage.prompt_tokens, completionTokens: json.usage.completion_tokens, totalTokens: json.usage.total_tokens } : undefined
        };
      } catch (err) {
        lastErr = err;
        if (attempt < this.opts.maxRetries - 1) await sleep(750 * 2 ** attempt);
      } finally { clearTimeout(timer); }
    }
    this.stats.failures++;
    throw new Error("chat request failed: " + String(lastErr));
  }

  private log(entry: Record<string, unknown>): void {
    try {
      fs.mkdirSync(path.dirname(this.opts.logFile), { recursive: true });
      fs.appendFileSync(this.opts.logFile, JSON.stringify({ t: new Date().toISOString(), ...entry }) + "\n");
    } catch { /* logging must never break a run */ }
  }

  getStats(): ClientStats { return { ...this.stats }; }

  /** JSON helper: parses the reply and retries once with a repair instruction when parsing fails. */
  async json<T>(messages: readonly ChatMessage[], options: ChatOptions = {}): Promise<{ value: T; raw: ChatResult }> {
    const first = await this.chat(messages, { ...options, json: true });
    const { extractJson } = await import("../core/text.ts");
    try {
      return { value: extractJson(first.content) as T, raw: first };
    } catch {
      const repair = await this.chat(
        [...messages, { role: "assistant", content: first.content.slice(0, 4000) }, { role: "user", content: "上一条回复不是合法 JSON。只输出一个合法 JSON，不要任何解释或代码围栏。" }],
        { ...options, json: true, noCache: true, tag: (options.tag ?? "") + ":repair" }
      );
      return { value: extractJson(repair.content) as T, raw: repair };
    }
  }
}
