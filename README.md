这是一个 Node 项目，不用装第三方依赖。它干的事说起来只有一件：把「让 AI 有点创造力」拆成能跑、能测、也能被别人复现的步骤。里面有三块东西，一套多 Agent 的生成机制（[engine.ts](src/agents/engine.ts)），一份给 Agent 读的操作手册（[SKILL.md](skills/creativity-engine/SKILL.md)），一套自动评分的基准（[src/bench/](src/bench/)）。三块都能单独用。

什么人会用到它。手上有个开放问题——办公室里怎么减少打印卡纸，社区怎么让快递纸箱多用几次——想先要一批不落俗套、还能说清机制的想法，用第一块。想知道某个提示词、某个模型、某种多 Agent 编排是不是真的更有创造力，而不是感觉上更有，用第三块，它给的是数字。在搭自己的 Agent，想把发散、评审、融合、筛选这一整套固定下来，用第二块，拷进 skill 目录或者贴进系统提示词就行。

跑之前需要两样东西。Node 22.6 以上，代码用了类型擦除，不需要编译；还有一个 OpenAI 兼容的模型端点，聊天和嵌入都要能用。端点从环境变量 `CREATIVE_BASE_URL`、`CREATIVE_API_KEY`、`CREATIVE_CHAT_MODEL`、`CREATIVE_EMBED_MODEL` 读，读不到就退回本机 OpenCode 的配置。密钥只在运行时取，不写进任何产物。

先跑这三条。

```bash
npm test                        # 35 个单元测试，离线，不碰网络
node scripts/smoke.ts           # 连通性自检：一次对话，一次嵌入
node scripts/demo.ts aut-brick  # 跑一遍机制，打印每轮过程和精英想法
```

第一条不用网络，第二条验证端点，第三条最快能看出这套东西产出什么样。demo 默认跑两轮，想更快就加 `--generations 1`，想指定存哪里就加 `--save runs/demo/brick.json`，不加也会存进 `runs/demo/`。想法原文、每条用了哪条技法、哪个角色、哪个随机刺激词，还有新颖度、可行性、失败模式，都在那个 JSON 里。默认值可以不改。先看结果。

自己的问题可以直接写在命令行上：

```bash
node scripts/demo.ts --task "社区里的共享单车经常被人推倒，设计一个让它不容易倒的办法"
```

这条路最快。用 `--task` 就没有已知方案清单，新颖度会一律记成 1.00，这时只看可行性那一列。想让新颖度有意义，要么把已知做法写进代码里的 `knownSolutions`——最短的例子是 [quickstart.ts](examples/quickstart.ts)，`node examples/quickstart.ts` 就能跑；要么在 [briefs.json](data/briefs.json) 里添一条自己的任务，再按 id 调用。

想验证「这套机制是不是真的比一句『请有创意』更好」，换命令：

```bash
node scripts/bench.ts --dry                                # 用假模型跑通整条流水线，不联网
node scripts/bench.ts --tasks aut-brick,brief-box --configs engine,zero-shot --out runs/my-run
node scripts/rescore.ts --run runs/my-run                  # 只重算分数和报告，不重新生成想法
node scripts/analyze.ts runs/my-run > docs/my-results.md   # 结果导成 Markdown 表
```

四类任务，四个配置。基准里有替代用途测验、发散联想任务、远距离联想测验，还有两个带已知方案清单的设计简报；可选配置是零样本、结构化分类单轮、自我批评再修改、本机制，另外两个消融配置 `engine-flat` 和 `engine-noadapt` 要显式写在 `--configs` 里。指标全是程序算的：流畅性、灵活性、原创性、具体化、新颖度、可行性、多样性、跨配置区分度。跑完在 `runs/my-run/` 下能找到原始想法、逐格分数、summary.json 和两份报告；现成的例子是主实验的 [report.md](runs/main-live/report.md) 和 [report.html](runs/main-live/report.html)，后者能用鼠标悬停看每条想法的原文和想法空间的投影。想一次把主实验、消融实验和报告都跑完，用 `bash scripts/run-all.sh`，它按顺序调用上面这几条。

接到别的 Agent 上不用这段代码。单独就能用。[SKILL.md](skills/creativity-engine/SKILL.md) 是独立的 Markdown，拷进你那个 Agent 的 skill 目录，或者把内容贴进系统提示词，它就能照里面的七步走：任务框定、算子分发、异质发散、严格评审、概念融合、质量-多样性策展、元反思纠偏。提示词模板和常见的坑都写在里面。

要在自己代码里调用，核心是一个函数，最短的完整例子在 [examples/quickstart.ts](examples/quickstart.ts)：

```ts
const result = await runCreativeEngine({
  client, catalog: loadCatalog(), space,
  taskId: "my-task",
  task: "把要解决的问题写在这里",
  knownSolutions: ["已知做法一", "已知做法二"],
  config: { generations: 3, generators: 4, ideasPerGenerator: 3, blendPairs: 2 }
});
for (const idea of result.archive.elites) {
  console.log(idea.novelty, idea.feasibility, idea.text);
}
```

参数不多。`generations` 是发散轮数，多了更花时间；`generators` 是每轮几路生成者，每路换一条技法；`ideasPerGenerator` 是每路要几条；`blendPairs` 是每轮跨格融合几对；`diversityFloor` 是触发升温换算子的多样性地板，默认 0.35，设成 0 就关掉；`useCritic` 和 `useMetaReflector` 管评审和元反思开不开。默认值都在 [engine.ts](src/agents/engine.ts) 顶上的 DEFAULT_ENGINE_CONFIG 里，抄一份改就行。

东西在哪儿。任务数据在 [data/](data/)，提示词模板在 [prompts.ts](src/llm/prompts.ts)，评分逻辑在 [src/core/](src/core/)，基准在 [src/bench/](src/bench/)，命令行在 [scripts/](scripts/)，测试在 [test/](test/)。实验记录和报告在 `runs/` 下；模型调用按模型、消息、采样参数做磁盘缓存，同一个实验重跑基本不花时间，每次调用的耗时和 token 记在 `runs/cache/chat-log.jsonl` 里，方便对账。

几个已知的坑。每份配置每个任务只跑了一次，一个种子，数字只能看方向，不能当显著性结论。没有人类被试，「超过人类」这句话在报告里没有出现过。可行性由模型评委给分，而字数越多它给得越低，机制的想法又比基线长两倍多，这个偏置写在 [report.md](docs/report.md) 里。触屏上还没有点击看提示框的支持。

报告里的每个小数都能追到一条想法原文，文件就在 `runs/` 下面的 JSON 里；`npm test` 那 35 个测试不用网络，也不用先配密钥。
