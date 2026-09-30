import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHumanHtml, svgHistogram } from "../src/bench/human-report.ts";

test("histogram draws one bar per bin and a marker line per machine value", () => {
  const svg = svgHistogram([1, 2, 2, 3, 4, 5], { bins: 5, markers: [{ value: 4.5, label: "engine", color: "#e5484d" }] });
  assert.ok(svg.startsWith("<svg"));
  assert.equal((svg.match(/<rect /g) ?? []).length, 6, "one background plus five bars");
  assert.ok(svg.includes('stroke="#e5484d"'));
  assert.ok(svg.includes("engine"));
});

test("histogram survives constant and empty input", () => {
  assert.ok(svgHistogram([3, 3, 3]).includes("<svg"));
  assert.equal(svgHistogram([]), '<svg viewBox="0 0 560 170"></svg>');
});

test("human HTML report renders sections and escapes untrusted text", () => {
  const html = buildHumanHtml({
    generatedAt: "2026-01-01T00:00:00Z",
    space: "embeddings:test",
    validation: {
      aut: { n: 2, validation: [{ metric: "<script>alert(1)</script>", perItem: [{ item: "box", n: 2, spearman: 0.5 }], pooledWithinItem: { pearson: 0.4 }, meanSpearman: 0.5 }] },
      wa: { n: 2, validation: [{ metric: "toItem", perItem: [{ item: "horn", n: 2, spearman: 0.2 }], pooledWithinItem: { pearson: 0.1 }, meanSpearman: 0.2 }] }
    },
    dat: {
      participantsRescored: 2, participantsAvailable: 3,
      oursInOurSpace: { mean: 70, sd: 5, median: 70, q10: 60, q90: 80 },
      publishedFullSample: { n: 3, mean: 78, sd: 8 },
      correlationOursVsPublished: { pearson: 0.8, spearman: 0.7, n: 2 },
      byStudy: [{ study: "olson-2", n: 2, ours: { mean: 70 }, published: { mean: 78 }, correlation: { spearman: 0.7 } }],
      participants: [{ score: 60 }, { score: 80 }],
      machine: [{ taskId: "dat-en-7", configId: "engine", crossLingual: false, score: 90, comparison: { machineMeanPercentile: 0.9, cliffsDelta: 0.8, superiorityProbability: 0.9 } }]
    },
    compare: {
      run: "runs/x",
      tasks: [{
        taskId: "aut-brick-en", configId: "engine", item: "brick", crossLingual: false, humanChars: { mean: 8 },
        toItem: { machine: { mean: 0.2 }, human: { mean: 0.3 }, machineMeanPercentile: 0.4, cliffsDelta: -0.1 },
        nearestHumanDistance: { machine: { mean: 0.5 }, human: { mean: 0.4 }, machineMeanPercentile: 0.7, cliffsDelta: 0.2 }
      }]
    }
  });
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("人类数据基线"));
  assert.ok(html.includes("dat-en-7/engine"));
  assert.ok(html.includes("aut-brick-en/engine"));
  assert.ok(!html.includes("<script>alert(1)</script>"), "metric names must be escaped");
  assert.ok(html.includes("&lt;script&gt;"));
});
