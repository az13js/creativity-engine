import { test } from "node:test";
import assert from "node:assert/strict";
import { runCreativeEngine, DEFAULT_ENGINE_CONFIG } from "../src/agents/engine.ts";
import { runZeroShot, runStructuredCot } from "../src/agents/baselines.ts";
import { judgePair } from "../src/agents/judge.ts";
import { loadCatalog, generatorMessages } from "../src/llm/prompts.ts";
import { ClusterSpace } from "../test-support/spaces.ts";
import { FakeLlm } from "../test-support/fake-llm.ts";

const catalog = loadCatalog("data/operators.json");

function engineIdeas(n: number, prefix = "方案"): { ideas: { idea: string }[] } {
  const chars = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥";
  return { ideas: Array.from({ length: n }, (_, i) => ({ idea: prefix + chars[i % chars.length] + "号做法", rationale: "r" })) };
}

test("operator catalogue is well formed and uses established techniques", () => {
  assert.ok(catalog.operators.length >= 10);
  for (const op of catalog.operators) {
    assert.ok(op.id && op.name && op.prompt.length > 10, "operator " + op.id);
    assert.ok(op.origin.length > 3, "operator " + op.id + " must cite its source tradition");
  }
  assert.ok(catalog.personas.length >= 6);
  assert.ok(catalog.stimuli.length >= 10);
});

test("engine runs the full diverge/critique/blend/meta loop and fills the archive", async () => {
  const tags: string[] = [];
  const fake = new FakeLlm((tag) => {
    tags.push(tag.split(":")[0]!);
    if (tag.startsWith("generator")) return engineIdeas(3);
    if (tag === "critic") return { reviews: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => ({ index: i, feasibility: 7, novelty: 6, impact: 5, failure_mode: "none" })) };
    if (tag === "blender") return { generic_space: "g", blend: "融合方案：把甲的承重结构与乙的排水机制叠加", emergent: "e" };
    if (tag === "meta") return { diagnosis: "d", recommended_operators: [catalog.operators[0]!.id], recommended_note: "换角度" };
    return {};
  });
  const space = new ClusterSpace({});
  const result = await runCreativeEngine({
    client: fake, catalog, space, taskId: "t1", task: "给砖头找新用途",
    config: { ...DEFAULT_ENGINE_CONFIG, generations: 2, generators: 3, ideasPerGenerator: 3, blendPairs: 1, seedCount: 2 }
  });
  assert.ok(result.ideas.length > 0);
  assert.ok(result.archive.size > 0);
  assert.ok(result.generations.length === 2);
  for (const stage of ["diverge", "collect", "critique", "blend", "measure", "meta"]) {
    assert.ok(result.events.some((e) => e.stage === stage), "missing stage " + stage);
  }
  // every idea has a novelty estimate and an objective
  for (const idea of result.ideas) {
    assert.equal(typeof idea.novelty, "number");
    assert.equal(typeof idea.objective, "number");
  }
});

test("duplicate ideas returned by the model are stored only once", async () => {
  const fake = new FakeLlm((tag) => {
    if (tag.startsWith("generator")) return { ideas: [{ idea: "把砖头磨成粉做颜料" }, { idea: "把砖头磨成粉做颜料" }] };
    if (tag === "critic") return { reviews: [] };
    if (tag === "blender") return { blend: "把砖头磨成粉做颜料" };
    return {};
  });
  const result = await runCreativeEngine({
    client: fake, catalog, space: new ClusterSpace({}), taskId: "t2", task: "x",
    config: { ...DEFAULT_ENGINE_CONFIG, generations: 2, generators: 2, ideasPerGenerator: 2, blendPairs: 0, useMetaReflector: false }
  });
  assert.equal(new Set(result.ideas.map((i) => i.text)).size, result.ideas.length);
});

test("mode-collapse guard raises temperature when ideas stay in one cluster", async () => {
  // ClusterSpace puts every known term in one cluster (similarity 0.9 => distance 0.1 < diversityFloor 0.35)
  const space = new ClusterSpace({
    "方案甲号做法": "c", "方案乙号做法": "c", "方案丙号做法": "c",
    "方案丁号做法": "c", "方案戊号做法": "c", "方案己号做法": "c"
  });
  const fake = new FakeLlm((tag) => {
    if (tag.startsWith("generator")) return engineIdeas(3);
    if (tag === "critic") return { reviews: [] };
    if (tag === "blender") return { blend: "融合方案：方案甲号做法与方案乙号做法结合" };
    return {};
  });
  const result = await runCreativeEngine({
    client: fake, catalog, space, taskId: "t3", task: "x",
    config: { ...DEFAULT_ENGINE_CONFIG, generations: 3, generators: 3, ideasPerGenerator: 3, blendPairs: 0, diversityFloor: 0.35, useMetaReflector: false }
  });
  assert.ok(result.adaptations >= 1, "expected at least one adaptation, got " + result.adaptations);
  assert.ok(result.generations[1]!.temperature > result.generations[0]!.temperature);
});

test("generator prompt adapts to the task output style", () => {
  const op = catalog.operators[0]!;
  const persona = catalog.personas[0]!;
  const base = { task: "t", operator: op, persona, stimulus: "s", count: 3, generation: 1 };
  const sentence = generatorMessages({ ...base, style: "sentence" }).map((m) => m.content).join("\n");
  const word = generatorMessages({ ...base, style: "word" }).map((m) => m.content).join("\n");
  const labeled = generatorMessages({ ...base, style: "labeled" }).map((m) => m.content).join("\n");
  assert.ok(sentence.includes("手段 + 机制 + 预期效果"));
  assert.ok(word.includes("只写一个名词") && !word.includes("手段 + 机制 + 预期效果"));
  assert.ok(labeled.includes("题目编号=答案"));
});

test("engine forwards the task style to every generator call", async () => {
  const fake = new FakeLlm((tag) => {
    if (tag.startsWith("generator")) return { ideas: [{ idea: "石头" }, { idea: "潮汐" }] };
    if (tag === "critic") return { reviews: [] };
    if (tag === "blender") return { blend: "融合" };
    return {};
  });
  await runCreativeEngine({
    client: fake, catalog, space: new ClusterSpace({}), taskId: "t4", task: "x", style: "word",
    config: { ...DEFAULT_ENGINE_CONFIG, generations: 2, generators: 2, ideasPerGenerator: 2, blendPairs: 0, useMetaReflector: false }
  });
  const genCalls = fake.calls.filter((c) => c.tag.startsWith("generator"));
  assert.ok(genCalls.length > 0);
  assert.ok(genCalls.every((c) => c.messages[0]!.content.includes("只写一个名词")));
});

test("baselines return idea records in the shared shape", async () => {
  const fake = new FakeLlm(() => ({ ideas: ["a", "b", "c"] }));
  const z = await runZeroShot(fake, "任务", { ideas: 3 });
  const s = await runStructuredCot(fake, "任务", { ideas: 3 });
  assert.equal(z.ideas.length, 3);
  assert.equal(z.calls, 1);
  assert.equal(s.ideas[0]!.source, "baseline");
  assert.ok(z.ideas.every((i) => typeof i.text === "string" && i.text.length > 0));
});

test("position-swap judging cancels a judge that always prefers slot A", async () => {
  const biased = new FakeLlm(() => ({ winner: "A", reason: "first" }));
  const out = await judgePair(biased, "任务", "想法甲", "想法乙");
  assert.equal(out.winner, "tie");
  assert.equal(out.calls, 2);
  const contentJudge = new FakeLlm((_tag, messages) => {
    const text = messages.map((m) => m.content).join("\n");
    const aIsBetter = text.indexOf("优秀想法") < text.indexOf("平庸想法");
    return { winner: aIsBetter ? "A" : "B", reason: "content" };
  });
  const out2 = await judgePair(contentJudge, "任务", "优秀想法", "平庸想法");
  assert.equal(out2.winner, "A");
  const out3 = await judgePair(contentJudge, "任务", "平庸想法", "优秀想法");
  assert.equal(out3.winner, "B");
});