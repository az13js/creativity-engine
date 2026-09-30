/** Remote Associates Test (convergent thinking) scoring against known answer sets. */
import { normalize } from "./text.ts";

export interface RatItem { id: string; cues: string[]; answers: string[]; note?: string }

export function normalizeAnswer(s: string): string {
  return normalize(s).replace(/^(a|an|the) /, "").replace(/ (a|an|the)$/, "").replace(/[^\p{L}\p{Script=Han}0-9 ]/gu, "").replace(/\s+/g, " ").trim();
}

export function isCorrect(given: string, item: RatItem): boolean {
  const g = normalizeAnswer(given);
  if (g === "") return false;
  const gWords = new Set(g.split(" "));
  return item.answers.some((a) => {
    const na = normalizeAnswer(a);
    if (na === g) return true;
    // Accept the answer embedded in a short phrase, e.g. "cheese (瑞士奶酪)" -> cheese.
    if (g.length <= na.length + 24 && (g === na || g.includes(na) || na.includes(g))) return true;
    return na.split(" ").every((w) => gWords.has(w));
  });
}

export interface RatReport {
  items: number;
  correct: number;
  accuracy: number;
  perItem: { id: string; given: string; correct: boolean; expected: string[] }[];
}

export function scoreRat(answers: readonly { id: string; answer: string }[], items: readonly RatItem[]): RatReport {
  const perItem = items.map((item) => {
    const given = answers.find((a) => a.id === item.id)?.answer ?? "";
    return { id: item.id, given, correct: isCorrect(given, item), expected: item.answers };
  });
  const correct = perItem.filter((p) => p.correct).length;
  return { items: items.length, correct, accuracy: items.length ? correct / items.length : 0, perItem };
}
