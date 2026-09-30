import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDatWords, datScore, correlate, validateMetric, compareToHuman, subsample, describe, distanceProfiles, distanceToReference, type HumanRecord } from "../src/bench/human.ts";
import { TableSpace, ClusterSpace } from "../test-support/spaces.ts";

const records: HumanRecord[] = [
  { study: "s", item: "brick", id: "1", response: "doorstop", ratings: [1, 1] },
  { study: "s", item: "brick", id: "2", response: "paperweight", ratings: [3, 3] },
  { study: "s", item: "brick", id: "3", response: "sundial", ratings: [5, 5] },
  { study: "s", item: "rope", id: "4", response: "belt", ratings: [2, 2] },
  { study: "s", item: "rope", id: "5", response: "clothesline", ratings: [4, 4] }
];

test("distance profiles keep distances inside an item and expose nearest-K", async () => {
  // doorstop / paperweight are close together and close to the brick; sundial is far.
  const space = new TableSpace([
    ["brick", "doorstop", 0.9], ["brick", "paperweight", 0.8], ["brick", "sundial", 0.2],
    ["doorstop", "paperweight", 0.85], ["doorstop", "sundial", 0.1], ["paperweight", "sundial", 0.05],
    ["rope", "belt", 0.8], ["rope", "clothesline", 0.7], ["belt", "clothesline", 0.6]
  ]);
  const profiles = await distanceProfiles(records, space);
  assert.equal(profiles.length, 5);
  assert.ok(Math.abs(profiles[0]!.toItem - 0.1) < 1e-9);
  assert.ok(Math.abs(profiles[2]!.toItem - 0.8) < 1e-9);
  // sundial is farther from its fellow responses than doorstop is
  assert.ok(profiles[2]!.meanOther > profiles[0]!.meanOther);
  // nearest-K of doorstop averages the two others (0.15 and 0.9)
  assert.ok(Math.abs(profiles[0]!.meanKOther - (0.9 + 0.15) / 2) < 1e-9);
  // rope responses never influence brick distances
  assert.ok(Math.abs(profiles[3]!.meanOther - 0.4) < 1e-9);
});

test("distance to a reference set reports how far a machine idea is from human answers", async () => {
  const space = new TableSpace([
    ["brick", "doorstop", 0.9], ["brick", "paperweight", 0.8], ["doorstop", "paperweight", 0.85],
    ["brick", "quasar", 0.05], ["doorstop", "quasar", 0.05], ["paperweight", "quasar", 0.05]
  ]);
  const reference = new Map([["brick", ["doorstop", "paperweight"]]]);
  const out = await distanceToReference([{ item: "brick", text: "quasar" }, { item: "brick", text: "doorstop" }], reference, space);
  assert.ok(Math.abs(out[0]!.toItem - 0.95) < 1e-9);
  assert.ok(Math.abs(out[0]!.minOther - 0.95) < 1e-9);
  assert.ok(out[1]!.minOther < 0.2, "an idea identical to a human answer is close to it");
});

test("DAT scoring follows the published 21-pair mean and the validity filter", () => {
  const words = cleanDatWords(["brick", "brick", "two words", "cloud", "hat", "dog", "river", "sun", "sea", "key", "cup"]);
  assert.equal(words.length, 7);
  assert.deepEqual(words.slice(0, 3), ["brick", "cloud", "hat"]);
  // orthogonal vectors -> all 21 distances are 1 -> score 100
  const basis = [0, 1, 2, 3, 4, 5, 6].map((i) => [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0, i === 3 ? 1 : 0, i === 4 ? 1 : 0, i === 5 ? 1 : 0, i === 6 ? 1 : 0]);
  assert.equal(datScore(basis), 100);
  assert.equal(datScore([basis[0]!, basis[0]!]), 0);
});

test("metric validation correlates inside items and pools through Fisher z", () => {
  const metric = [0.1, 0.5, 0.9, 0.2, 0.8];
  const v = validateMetric("toItem", metric, records);
  assert.equal(v.perItem.length, 2);
  assert.ok(Math.abs(v.perItem[0]!.spearman - 1) < 1e-9, "monotone inside the brick item");
  assert.ok(Math.abs(v.pooledWithinItem.pearson - 1) < 1e-6, "standardising within items recovers the shared trend");
  assert.equal(v.positiveShare, 1);
});

test("correlation ignores non-finite pairs and constant input", () => {
  assert.equal(correlate([1, 2, 3], [1, 1, 1]).pearson, Number.NaN);
  const c = correlate([1, 2, Number.NaN, 4], [2, 4, 6, 8]);
  assert.equal(c.n, 3);
  assert.ok(Math.abs(c.pearson - 1) < 1e-9);
});

test("machine-vs-human comparison reports percentile and effect size", () => {
  const human = [10, 20, 30, 40, 50];
  const c = compareToHuman([60, 70], human);
  assert.equal(c.machineMeanPercentile, 1);
  assert.equal(c.cliffsDelta, 1);
  assert.equal(c.superiorityProbability, 1);
  const low = compareToHuman([5], human);
  assert.equal(low.machineMeanPercentile, 0);
  assert.equal(low.cliffsDelta, -1);
});

test("subsample is seeded, stable and order preserving", () => {
  const items = Array.from({ length: 100 }, (_, i) => i);
  const a = subsample(items, 10, 7);
  const b = subsample(items, 10, 7);
  assert.deepEqual(a, b);
  assert.equal(a.length, 10);
  assert.deepEqual(a.slice().sort((x, y) => x - y), a, "keeps original order");
  assert.deepEqual(subsample(items, 200, 7).length, 100);
});

test("describe reports spread of a human distribution", () => {
  const d = describe([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(d.n, 10);
  assert.equal(d.mean, 5.5);
  assert.ok(d.q10 < d.median && d.median < d.q90);
});

test("cluster space keeps dissimilar answers far apart", async () => {
  // doorstop and paperweight share a cluster; sundial sits alone, so it is farther from its peers.
  const space = new ClusterSpace({ brick: "a", doorstop: "a", paperweight: "a", sundial: "b" });
  const profiles = await distanceProfiles(records.slice(0, 3), space);
  assert.ok(profiles[2]!.meanOther > profiles[0]!.meanOther);
});
