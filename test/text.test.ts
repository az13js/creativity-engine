import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupe, dedupeNear, extractJson, extractStringList, isSingleWord, jaccard, tokenize, contentTokens } from "../src/core/text.ts";

test("tokenize keeps Latin words and CJK bigrams", () => {
  const t = tokenize("把 Brick 用作 paperweight 和 门挡");
  assert.ok(t.includes("brick"));
  assert.ok(t.includes("paperweight"));
  assert.ok(t.includes("门挡"));
  assert.ok(t.includes("用作"));
});

test("jaccard on overlapping sets", () => {
  const a = contentTokens("用砖头压住纸张防风吹");
  const b = contentTokens("用砖头压住纸张");
  assert.ok(jaccard(a, b) > 0.5);
  assert.equal(jaccard(new Set(["x"]), new Set(["y"])), 0);
});

test("dedupe removes exact and normalised duplicates", () => {
  assert.deepEqual(dedupe(["A", "a", "B", "A "]), ["A", "B"]);
});

test("dedupeNear removes near duplicates but keeps distinct ideas", () => {
  const out = dedupeNear(["把砖头当门挡", "把砖头当门挡用", "用砖头磨刀"], 0.8);
  assert.equal(out.length, 2);
});

test("extractJson tolerates fences and prose", () => {
  const v = extractJson('Sure!\n```json\n{"ideas": ["a", "b"]}\n```\nHope that helps');
  assert.deepEqual(v, { ideas: ["a", "b"] });
});

test("extractJson handles nested braces and strings containing braces", () => {
  const v = extractJson('prefix [{"t": "} not a brace"}, {"t": "ok"}] suffix');
  assert.deepEqual(v, [{ t: "} not a brace" }, { t: "ok" }]);
});

test("extractStringList falls back to line parsing", () => {
  const out = extractStringList("1. first idea\n2. second idea\n- third idea");
  assert.deepEqual(out, ["first idea", "second idea", "third idea"]);
});

test("extractStringList reads arrays of objects", () => {
  const out = extractStringList('[{"idea": "one"}, {"idea": "two"}]');
  assert.deepEqual(out, ["one", "two"]);
});

test("extractStringList keeps object keys for id=answer replies", () => {
  const out = extractStringList('{"rat-01": "cheese", "rat-02": "ice"}');
  assert.deepEqual(out, ["rat-01=cheese", "rat-02=ice"]);
});

test("isSingleWord enforces DAT-style single nouns", () => {
  assert.ok(isSingleWord("quasar"));
  assert.ok(isSingleWord("石头"));
  assert.ok(!isSingleWord("two words"));
  assert.ok(!isSingleWord(""));
});