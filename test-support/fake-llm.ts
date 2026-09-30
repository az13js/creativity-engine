/** Deterministic stand-in for the chat client, so orchestration logic can be unit-tested without network. */
import { extractJson } from "../src/core/text.ts";
import type { ChatMessage, ChatOptions, ChatResult } from "../src/llm/client.ts";
import type { LlmLike } from "../src/agents/types.ts";

export type FakeHandler = (tag: string, messages: readonly ChatMessage[]) => unknown;

export class FakeLlm implements LlmLike {
  calls: { tag: string; messages: readonly ChatMessage[] }[] = [];
  private handler: FakeHandler;
  constructor(handler: FakeHandler) { this.handler = handler; }
  async chat(messages: readonly ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const tag = options.tag ?? "";
    this.calls.push({ tag, messages });
    const v = this.handler(tag, messages);
    const content = typeof v === "string" ? v : JSON.stringify(v);
    return { content, model: "fake", cached: false, ms: 0, key: tag, usage: { promptTokens: 0, completionTokens: 0 } };
  }
  async json<T>(messages: readonly ChatMessage[], options: ChatOptions = {}): Promise<{ value: T; raw: ChatResult }> {
    const raw = await this.chat(messages, options);
    return { value: extractJson(raw.content) as T, raw };
  }
}
