/** Loading and typing of the benchmark tasks. All task data lives in data/*.json. */
import fs from "node:fs";
import type { CategoryLexicon } from "../core/flexibility.ts";
import type { RatItem } from "../core/rat.ts";
import type { OutputStyle } from "../llm/prompts.ts";

export type TaskKind = "aut" | "dat" | "rat" | "brief";

export interface BenchTask {
  id: string;
  kind: TaskKind;
  title: string;
  prompt: string;
  ideasTarget: number;
  reference?: { text: string; count?: number }[];
  lexicon?: CategoryLexicon;
  knownSolutions?: string[];
  /** Object under test, for AUT items. */
  object?: string;
  ratItems?: RatItem[];
  datCount?: number;
  /** Output shape the task requires from any config. */
  style: OutputStyle;
  sourceFile: string;
}

function readJson<T>(file: string): T { return JSON.parse(fs.readFileSync(file, "utf8")) as T; }

export function loadTasks(dir = "data"): BenchTask[] {
  const tasks: BenchTask[] = [];
  const aut = readJson<{ items: any[] }>(dir + "/aut-items.json");
  for (const it of aut.items) {
    tasks.push({
      id: it.id, kind: "aut", title: "AUT: " + it.object, prompt: it.prompt, ideasTarget: it.ideasTarget, object: it.object,
      reference: it.reference, lexicon: it.lexicon, style: "sentence", sourceFile: dir + "/aut-items.json"
    });
  }
  const dat = readJson<{ items: any[] }>(dir + "/dat-items.json");
  for (const it of dat.items) {
    tasks.push({ id: it.id, kind: "dat", title: "DAT: " + it.count + " words", prompt: it.prompt, ideasTarget: it.count, datCount: it.count, sourceFile: dir + "/dat-items.json" });
  }
  const rat = readJson<{ items: RatItem[] }>(dir + "/rat-items.json");
  tasks.push({
    id: "rat-20", kind: "rat", title: "RAT: 20 constructed items",
    prompt: "下面每题给出三个提示词（cues），请各找一个能与三者都组成常见短语或复合词的英文单词。\n" +
      rat.items.map((i) => i.id + ": " + i.cues.join(" / ")).join("\n"),
    ideasTarget: rat.items.length, ratItems: rat.items, style: "labeled", sourceFile: dir + "/rat-items.json"
  });
  const briefs = readJson<{ briefs: any[] }>(dir + "/briefs.json");
  for (const b of briefs.briefs) {
    tasks.push({ id: b.id, kind: "brief", title: b.title, prompt: b.prompt, ideasTarget: b.ideasTarget, knownSolutions: b.knownSolutions, sourceFile: dir + "/briefs.json" });
  }
  return tasks;
}

export function loadDatCalibration(dir = "data"): string[] {
  return readJson<{ calibration: string[] }>(dir + "/dat-items.json").calibration;
}