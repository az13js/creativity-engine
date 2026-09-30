import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadHumanDataset, HUMAN_FILES } from "../src/bench/human.ts";

test("imported AUT dataset keeps human responses and rater scores coherent", () => {
  const ds = loadHumanDataset(HUMAN_FILES.aut);
  assert.equal(ds.dataset, "semdis-aut");
  assert.ok(ds.records.length > 6000, "expected thousands of AUT responses");
  const items = new Set(ds.records.map((r) => r.item));
  for (const item of ["box", "rope", "brick"]) assert.ok(items.has(item), "missing AUT item " + item);
  for (const r of ds.records) {
    assert.ok(r.response.length > 0);
    assert.ok(r.ratings.length >= 1, "every response keeps at least one human rating");
    for (const v of r.ratings) assert.ok(v >= 1 && v <= 5, "rater scores are on the 1-5 scale, got " + v);
  }
  const box = ds.records.filter((r) => r.item === "box");
  // Study 1 used four raters, study 2 three, and a handful of responses lack one score.
  assert.ok(box.every((r) => r.ratings.length >= 2 && r.ratings.length <= 4));
});

test("imported word-association dataset carries the human scales", () => {
  const ds = loadHumanDataset(HUMAN_FILES.wa);
  assert.ok(ds.records.length > 6000);
  const study41 = ds.records.filter((r) => r.study === "semdis-4.1");
  assert.ok(study41.length > 1000);
  // Single-rater scores, except a couple of responses the original table left unscored.
  assert.ok(study41.filter((r) => r.ratings.length === 1).length > study41.length - 10);
});

test("imported DAT dataset keeps valid word lists and published scores", () => {
  const ds = loadHumanDataset<{ study: string; id: string; words: string[]; datPublished: number | null }>(HUMAN_FILES.dat);
  assert.ok(ds.records.length > 8000);
  for (const r of ds.records.slice(0, 200)) {
    assert.ok(r.words.length >= 7, "DAT needs at least seven usable words");
    assert.ok(r.words.length <= 10);
    assert.ok(r.datPublished === null || (r.datPublished > 40 && r.datPublished < 120));
  }
  const studies = new Set(ds.records.map((r) => r.study));
  assert.deepEqual([...studies].sort(), ["olson-1a", "olson-1b", "olson-2"]);
});

test("human data files stay small enough to commit", () => {
  for (const f of Object.values(HUMAN_FILES)) {
    const size = fs.statSync(f).size;
    assert.ok(size > 1000 && size < 3_000_000, f + " size " + size);
  }
});
