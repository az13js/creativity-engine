/**
 * Text utilities shared by every scorer: normalisation, CJK-aware tokenisation,
 * duplicate detection and tolerant JSON extraction from LLM replies.
 * All functions are pure and deterministic, which is what makes the scorers testable.
 */

const STOPWORDS = new Set([
  "the","a","an","of","to","in","on","for","with","and","or","as","by","at","from","that","this","it","is","are","be","was","were",
  "的","了","和","与","及","在","是","对","把","被","用","把","可以","这个","那个","一个","它","他","她","我","你","们"
]);

/** Tokenise mixed Chinese/English text. CJK runs become character bigrams (plus unigrams), Latin runs become lowercase words. */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const latin = text.toLowerCase().match(/[a-z0-9][a-z0-9'_-]*/g) ?? [];
  tokens.push(...latin);
  const cjkRuns = text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/g) ?? [];
  for (const run of cjkRuns) {
    for (const ch of run) tokens.push(ch);
    for (let i = 0; i + 1 < run.length; i++) tokens.push(run.slice(i, i + 2));
  }
  return tokens.filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

export function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[\s\u3000]+/g, " ").replace(/[。，、；：！？“”‘’（）《》【】,.;:!?"'()\[\]{}<>]/g, " ").trim();
}

export function contentTokens(text: string): Set<string> { return new Set(tokenize(text)); }

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Deduplicate texts by normalised form, keeping first occurrence order. */
export function dedupe(texts: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of texts) {
    const key = normalize(t);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Near-duplicate removal: a later item is dropped when its token Jaccard overlap with a kept item exceeds `threshold`. */
export function dedupeNear(texts: readonly string[], threshold = 0.8): string[] {
  const kept: string[] = [];
  const keptSets: Set<string>[] = [];
  for (const t of texts) {
    const s = contentTokens(t);
    if (s.size === 0) continue;
    const dup = keptSets.some((k) => jaccard(k, s) >= threshold);
    if (dup) continue;
    kept.push(t);
    keptSets.push(s);
  }
  return kept;
}

/**
 * Extract the first balanced JSON value (object or array) from a model reply.
 * Handles markdown fences, leading prose and trailing commentary.
 */
export function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json|JSON)?/g, "").trim();
  const starts: number[] = [];
  for (let i = 0; i < cleaned.length; i++) if (cleaned[i] === "{" || cleaned[i] === "[") { starts.push(i); break; }
  const first = starts[0];
  if (first === undefined) throw new Error("no JSON value found in reply");
  const open = cleaned[first]!;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = first; i < cleaned.length; i++) {
    const c = cleaned[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        const slice = cleaned.slice(first, i + 1);
        return JSON.parse(slice);
      }
    }
  }
  throw new Error("unbalanced JSON in reply");
}

/** Pull a JSON array of strings out of a free-form reply, falling back to line splitting. */
export function extractStringList(raw: string): string[] {
  try {
    const v = extractJson(raw);
    // Object of the form {"rat-01": "cheese", ...}: keep the keys, they carry the item ids.
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const entries = Object.entries(v as Record<string, unknown>);
      if (entries.length > 0 && entries.every(([, val]) => typeof val === "string")) {
        return entries.map(([k, val]) => k + "=" + String(val).trim());
      }
    }
    const arr = Array.isArray(v) ? v : (typeof v === "object" && v !== null ? (v as Record<string, unknown>)[Object.keys(v as Record<string, unknown>)[0]!] : null);
    if (Array.isArray(arr)) {
      return arr.map((x) => (typeof x === "string" ? x : typeof x === "object" && x !== null ? String((x as Record<string, unknown>).text ?? (x as Record<string, unknown>).idea ?? JSON.stringify(x)) : String(x))).map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    /* fall through to line parsing */
  }
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*•\d.、)）]+/, "").trim())
    .filter((l) => l.length > 0 && !/^[`{}\[\]]+$/.test(l));
}

/** A single word usable by the Divergent Association Task (one token, no spaces, no proper-noun capital, alphabetic/CJK). */
export function isSingleWord(word: string): boolean {
  const w = word.normalize("NFKC").trim();
  if (w === "") return false;
  if (/\s/.test(w)) return false;
  if (/:|：|=|\(|\)/.test(w)) return false;
  return /^[\p{Script=Han}]{1,2}$|^[a-zA-Z][a-zA-Z'-]*$/u.test(w);
}