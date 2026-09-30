/**
 * Pairwise judging with position-swap control.
 * Each comparison is judged twice with A/B exchanged; a judge that prefers the slot
 * rather than the content therefore yields ties, which removes position bias from
 * the tournament score (a standard control in LLM-as-judge work).
 */
import type { ChatClient, ChatMessage } from "../llm/client.ts";
import { judgeMessages } from "../llm/prompts.ts";
import { extractJson } from "../core/text.ts";

export interface PairOutcome { winner: "A" | "B" | "tie"; reason: string; calls: number }

export async function judgePair(
  client: ChatClient,
  task: string,
  a: string,
  b: string,
  opts: { temperature?: number; tag?: string; orderRandomized?: boolean } = {}
): Promise<PairOutcome> {
  const template: ChatMessage[] = judgeMessages(task, a, b);
  const forward = await client.chat(template, { temperature: opts.temperature ?? 0, tag: (opts.tag ?? "judge") + ":fwd" });
  const swapped: ChatMessage[] = judgeMessages(task, b, a);
  const backward = await client.chat(swapped, { temperature: opts.temperature ?? 0, tag: (opts.tag ?? "judge") + ":rev" });
  const parse = (raw: string, flip: boolean): "A" | "B" | "tie" => {
    try {
      const v = extractJson(raw) as { winner?: string };
      const w = (v.winner ?? "").toUpperCase();
      if (w === "A") return flip ? "B" : "A";
      if (w === "B") return flip ? "A" : "B";
      return "tie";
    } catch { return "tie"; }
  };
  const f = parse(forward.content, false);
  const r = parse(backward.content, true);
  const winner = f === r ? f : "tie";
  return { winner, reason: "", calls: 2 };
}

/** Round-robin tournament: returns a ranked list of idea indices by win count. */
export async function tournament(
  client: ChatClient,
  task: string,
  ideas: readonly string[],
  opts: { maxPairs?: number; temperature?: number; seed?: number } = {}
): Promise<{ order: number[]; wins: number[]; pairs: number }> {
  const n = ideas.length;
  const wins = new Array(n).fill(0);
  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  const limit = opts.maxPairs ?? pairs.length;
  const chosen = pairs.slice(0, limit);
  for (const [i, j] of chosen) {
    const out = await judgePair(client, task, ideas[i]!, ideas[j]!, { temperature: opts.temperature, tag: "tournament" });
    if (out.winner === "A") wins[i]! += 1;
    else if (out.winner === "B") wins[j]! += 1;
    else { wins[i]! += 0.5; wins[j]! += 0.5; }
  }
  const order = ideas.map((_, i) => i).sort((x, y) => wins[y]! - wins[x]! || x - y);
  return { order, wins, pairs: chosen.length };
}
