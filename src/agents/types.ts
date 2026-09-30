/** Shared types for the agent layer. Keeping the LLM behind an interface is what makes the engine unit-testable. */
import type { ChatOptions, ChatResult, ChatMessage } from "../llm/client.ts";

export interface LlmLike {
  chat(messages: readonly ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  json<T>(messages: readonly ChatMessage[], options?: ChatOptions): Promise<{ value: T; raw: ChatResult }>;
}

export interface IdeaRecord {
  id: string;
  text: string;
  rationale?: string;
  taskId: string;
  configId: string;
  generation: number;
  agent: string;
  operator?: string;
  persona?: string;
  stimulus?: string;
  source: "generate" | "blend" | "baseline" | "refine";
  parents?: string[];
  novelty?: number;
  feasibility?: number;
  impact?: number;
  objective?: number;
  cell?: string;
  failureMode?: string;
}

export interface RunArtifact {
  taskId: string;
  configId: string;
  seed: number;
  ideas: IdeaRecord[];
  events: { generation: number; stage: string; detail: string; metric?: number }[];
  stats: {
    calls: number;
    cachedCalls: number;
    promptTokens: number;
    completionTokens: number;
    wallMs: number;
    generations: { index: number; newIdeas: number; meanPairwiseDistance: number; meanNovelty: number; clusters: number; temperature: number }[];
    archive: { size: number; coverage: number; qdScore: number };
  };
}
