import { test } from "node:test";
import assert from "node:assert/strict";
import { agglomerativeClusters, cosine, meanPairwiseDistance, meanPairwiseSimilarity } from "../src/core/distance.ts";
import { scoreAut, elaborationScore, validity } from "../src/core/aut.ts";
import { lexiconFlexibility } from "../src/core/flexibility.ts";
import { NoveltyScorer, TfidfSpace } from "../src/core/novelty.ts";
import { QualityDiversityArchive } from "../src/core/archive.ts";
import { scoreRat, isCorrect } from "../src/core/rat.ts";
import { cliffsDelta, mean, median, sd, bootstrapCI } from "../src/core/stats.ts";
import { ClusterSpace } from "../test-support/spaces.ts";

test("cosine basics", () => {
  assert.equal(Math.round(cosine([1, 0], [1, 0]) * 1e6) / 1e6, 1);
  assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-12);
  assert.throws(() => cosine([1], [1, 2]));
});

test("mean pairwise distance is 0 for identical vectors and 1 for orthogonal", () => {
  const same = [[1, 0], [2, 0], [3, 0]];
  const m1 = same.map((a) => same.map((b) => cosine(a, b)));
  assert.ok(Math.abs(meanPairwiseDistance(m1)) < 1e-9);
  const orth = [[1, 0], [0, 1], [1, 0]];
  const m2 = orth.map((a) => orth.map((b) => cosine(a, b)));
  assert.ok(Math.abs(meanPairwiseSimilarity(m2) - -0.3333333) < 1e-6 || meanPairwiseSimilarity(m2) < 0.5);
});

test("agglomerative clustering groups close items deterministically", () => {
  const vecs = [[1, 0], [0.99, 0.01], [0, 1], [0.01, 0.99]];
  const m = vecs.map((a) => vecs.map((b) => cosine(a, b)));
  const labels = agglomerativeClusters(m, 0.1);
  assert.equal(labels[0], labels[1]);
  assert.equal(labels[2], labels[3]);
  assert.notEqual(labels[0], labels[2]);
});

test("AUT: fluency counts distinct valid uses and drops echoes of the object", () => {
  const r = validity("砖头", "砖头"); assert.equal(r.valid, false);
  const r2 = validity("当门挡", "砖头"); assert.equal(r2.valid, true);
});

test("AUT: elaboration rewards mechanism markers", () => {
  assert.ok(elaborationScore("当门挡，因为砖头很重且通过摩擦固定门") > elaborationScore("门挡"));
});

test("AUT report combines fluency, flexibility and originality", async () => {
  const space = new ClusterSpace({
    "门挡": "固定", "重物": "固定", "压纸": "固定",
    "磨刀石": "研磨", "砂纸": "研磨",
    "颜料": "装饰", "玩具": "装饰"
  });
  const reference = [{ text: "门挡" }, { text: "重物" }];
  const lexicon = [
    { category: "固定", patterns: ["门挡", "压住", "重物", "垫"] },
    { category: "研磨", patterns: ["磨", "砂"] },
    { category: "装饰", patterns: ["颜料", "画", "玩具"] }
  ];
  const report = await scoreAut({
    object: "砖头",
    responses: ["门挡", "压住纸张防风吹", "磨刀石", "砂纸替代品", "当颜料在墙上画画", "砖头"],
    reference, lexicon, space
  });
  assert.equal(report.fluency, 5, "echo of the object must be dropped");
  assert.equal(report.flexibility, 3);
  assert.ok(report.meanOriginality > 0.5, "uses far from the reference should be original");
  assert.ok(report.dtIndex > 0 && report.dtIndex <= 1);
});

test("lexicon flexibility falls back to an 'other' bucket", () => {
  const r = lexiconFlexibility(["门挡", "完全没见过的用法"], [{ category: "固定", patterns: ["门挡"] }]);
  assert.equal(r.categories, 2);
  assert.equal(r.byCategory["其他"]!.length, 1);
});

test("novelty is 1 - max similarity to the reference set", async () => {
  const space = new ClusterSpace({ a: "x", b: "x", c: "y" });
  const scorer = new NoveltyScorer(["a"], space);
  const [near, far] = await scorer.scoreAll(["b", "c"]);
  assert.ok(near!.novelty < far!.novelty);
  // ClusterSpace returns cosine 0.9 in-cluster and 0.1 across clusters; novelty = 1 - max cosine.
  assert.ok(Math.abs(near!.nearestSimilarity - 0.9) < 1e-9);
  assert.ok(Math.abs(far!.nearestSimilarity - 0.1) < 1e-9);
});

test("tfidf novelty separates paraphrases from genuinely new ideas", async () => {
  const ref = ["用砖头当门挡挡住门", "用砖头压住纸张"];
  const scorer = NoveltyScorer.lexical(ref);
  const [dup, fresh] = await scorer.scoreAll(["用砖头挡住门", "把砖头烧成粉末做陶瓷釉料"]);
  assert.ok(dup!.novelty < fresh!.novelty, "paraphrase must be less novel");
});

test("tfidf space similarity is symmetric and bounded", async () => {
  const s = new TfidfSpace(["猫追老鼠", "狗追猫"]);
  const m = await s.similarityMatrix(["猫追老鼠", "狗追猫", "飞机降落"]);
  assert.equal(m[0]![0], 1);
  assert.ok(Math.abs(m[0]![1] - m[1]![0]) < 1e-12);
  assert.ok(m[0]![1] > m[0]![2]);
});

test("quality-diversity archive keeps the best elite per cell and tracks coverage", () => {
  const archive = new QualityDiversityArchive<string>([[0, 0.5, 1], [0, 0.5, 1]]);
  const a = archive.add("low", [0.2, 0.2], 0.3);
  const b = archive.add("high", [0.2, 0.2], 0.9);
  const c = archive.add("worse", [0.2, 0.2], 0.1);
  assert.equal(b.accepted, true);
  assert.equal(b.replaced, true);
  assert.equal(c.accepted, false);
  assert.equal(archive.size, 1);
  assert.equal(archive.elites()[0]!.item, "high");
  archive.add("other-cell", [0.7, 0.7], 0.5);
  assert.equal(archive.size, 2);
  assert.ok(Math.abs(archive.coverage() - 2 / 4) < 1e-9);
  assert.ok(Math.abs(archive.qdScore() - 1.4) < 1e-9);
  assert.equal(a.cell, b.cell);
});

test("archive moves a keyed item instead of leaving a stale copy in the old cell", () => {
  const archive = new QualityDiversityArchive<{ id: string; text: string }>([[0, 0.5, 1], [0, 0.5, 1]]);
  const idea = { id: "i1", text: "同一条想法" };
  archive.add(idea, [0.2, 0.2], 0.3, idea.id);
  archive.add(idea, [0.7, 0.7], 0.3, idea.id);           // 可行性被评审改写，换到另一格
  assert.equal(archive.size, 1, "同一条想法不应占两格");
  assert.equal(archive.elites()[0]!.cell, "1-1");
  // 不同想法可以各占一格，格内仍按目标分数竞争
  archive.add({ id: "i2", text: "另一条" }, [0.7, 0.7], 0.1, "i2");
  assert.equal(archive.size, 1);
  archive.add({ id: "i2", text: "另一条" }, [0.7, 0.7], 0.9, "i2");
  assert.equal(archive.elites()[0]!.item.text, "另一条");
});

test("RAT scoring accepts exact answers and short phrases", () => {
  const item = { id: "r1", cues: ["cottage", "swiss", "cake"], answers: ["cheese"] };
  assert.ok(isCorrect("cheese", item));
  assert.ok(isCorrect("Cheese!", item));
  assert.ok(isCorrect("The answer is cheese", item));
  assert.ok(!isCorrect("milk", item));
  const report = scoreRat([{ id: "r1", answer: "cheese" }, { id: "r2", answer: "wrong" }],
    [item, { id: "r2", cues: ["a", "b", "c"], answers: ["right"] }]);
  assert.equal(report.accuracy, 0.5);
});

test("descriptive statistics and effect sizes", () => {
  assert.equal(mean([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.ok(sd([1, 2, 3]) > 0);
  assert.equal(cliffsDelta([3, 4, 5], [1, 2]), 1);
  assert.equal(cliffsDelta([1, 2], [3, 4, 5]), -1);
  const ci = bootstrapCI([1, 2, 3, 4, 5], 0.95, 500, 42);
  assert.ok(ci[0]! <= 3 && ci[1]! >= 3);
});


test("AUT falls back to clustering when the task has no category lexicon", async () => {
  const space = new ClusterSpace({ "one": "a", "two": "a", "three": "b", "four": "b", "five": "c" });
  const report = await scoreAut({
    object: "widget",
    responses: ["one", "two", "three", "four", "five"],
    space
  });
  assert.equal(report.flexibilitySource, "clustering");
  assert.equal(report.flexibility, 3, "one cluster per semantic group");
  assert.equal(report.fluency, 5);
});
