# Creativity Engine

把「让 AI 有创造力」做成可运行、可评分的流程：一套多 Agent 生成机制，一份 Agent Skill，一套自动评分基准。

## 这是什么

这是一个 Node 项目，不需要安装第三方依赖。它把创造力研究里几个有出处的做法拼成一条流水线：

- 每路生成者绑定一条**创造力技法**（SCAMPER、TRIZ 矛盾消解、结构映射类比、概念融合等 12 条，见 `data/operators.json`），而不是只说「请有创意」；
- 评审者只找漏洞，给出可行性、新颖度、影响和一条失败原因；
- 融合者从不同档案格里挑想法配对，输出它们共享的抽象结构和涌现性质；
- 质量-多样性档案（MAP-Elites 式网格）每格只留最好的一条，最后交付一组想法而不是一条「最佳答案」；
- 每轮测量想法之间的语义距离，同质化时升温并换一批技法。

同一套代码还带了一个基准：四类任务（替代用途测验 AUT、发散联想任务 DAT、远距离联想测验 RAT、带已知方案清单的设计简报）、多个自动指标（新颖度、可行性、多样性、灵活性、跨配置区分度等）和几个对照 / 消融配置。用来回答「某个提示词、某个模型、某种编排是不是真的更有创造力」。

## 三种用法

| 你想做的事 | 用哪个 | 要不要写代码 |
| --- | --- | --- |
| 让 Agent 在写方案、做设计时按这套方法想问题 | Skill | 不用 |
| 直接生成一批想法，或跑对照实验拿数字 | 命令行 | 不用 |
| 把机制接进自己的程序 | TypeScript API | 要 |

## 用法一：作为 Agent Skill

Skill 是给 Agent 读的 Markdown 指令包。放进应用会扫描的目录里，Agent 自己判断什么时候加载，**不需要执行任何脚本**。

本仓库已经把它放在 [`.agents/skills/creativity-engine/SKILL.md`](.agents/skills/creativity-engine/SKILL.md)。opencode 和 DSH 都会扫描项目里的 `.agents/skills/`，所以在仓库目录里打开任一个，技能列表里就有 `creativity-engine`。

各应用扫描的位置：

| 应用 | 项目级 | 全局（所有项目可用） |
| --- | --- | --- |
| opencode | `.opencode/skills/<name>/SKILL.md`、`.claude/skills/<name>/SKILL.md`、`.agents/skills/<name>/SKILL.md` | `~/.config/opencode/skills/<name>/SKILL.md` |
| DSH | `.dsh/skills/<name>/SKILL.md`、`.agents/skills/<name>/SKILL.md` | `~/.dsh/skills/<name>/SKILL.md` |

装到全局目录，任何项目都能用：

```bash
mkdir -p ~/.config/opencode/skills
cp -r .agents/skills/creativity-engine ~/.config/opencode/skills/
```

用法就是正常提需求，比如「给独居老人想 10 个防忘关火的方案，要具体、别落俗套」，Agent 会按 SKILL.md 里的七步走。手册里面是提示词协议和反模式，没有命令行步骤。

这个技能目录里只有 SKILL.md，可以单独拷到别的项目用，**不需要本仓库的其它代码，也不需要 Node 环境**。仓库里的实现只是把同一套协议自动化了：批量跑任务、自动算分、出报告。要自动评分才需要代码，要想法只要这个文件。两者各能做什么，见下面的[常见问题](#常见问题)。

## 用法二：命令行

先配模型端点。环境变量优先，读不到就退回本机 OpenCode 的配置：

```bash
export CREATIVE_BASE_URL=http://127.0.0.1:11434/v1
export CREATIVE_API_KEY=sk-...
export CREATIVE_CHAT_MODEL=deepseek-v4.1-flash   # 可选
export CREATIVE_EMBED_MODEL=qwen3-embedding:latest   # 可选
```

密钥只在运行时读取，不会写进任何产物。

**跑一个任务，看它产出什么**

```bash
node scripts/demo.ts aut-brick                              # data/ 里的任务
node scripts/demo.ts --task "社区里的共享单车经常被推倒，设计一个让它不容易倒的办法"
node scripts/demo.ts aut-brick --generations 1 --save runs/demo/brick.json
```

打印每轮的算子分派、语义距离、簇数、档案覆盖率和精英想法，结果存进 `runs/demo/`。用 `--task` 直接给文本时没有已知方案清单，新颖度会一律记成 1.00，这时只看可行性列。

**跑对照实验**

```bash
node scripts/bench.ts --dry                                                        # 假模型跑通流水线，不联网
node scripts/bench.ts --tasks aut-brick,brief-box --configs engine,zero-shot --out runs/my-run
node scripts/rescore.ts --run runs/my-run                                          # 只重算分数与报告
node scripts/analyze.ts runs/my-run > docs/my-results.md                           # 结果导成 Markdown 表
bash scripts/run-all.sh                                                            # 主实验 + 消融 + 报告一次跑完
```

配置：`zero-shot`、`structured-cot`、`self-refine`、`engine`，另外两个消融配置 `engine-flat`、`engine-noadapt` 需要显式写在 `--configs` 里。产出在 `runs/my-run/`：每条想法的 JSON 原文、逐格分数、`summary.json`，以及 `report.md` 和 `report.html`（后者可以用鼠标悬停看想法原文和 PCA 投影散点）。

其他命令：

```bash
npm test               # 35 个单元测试，离线，不需要模型端点
node scripts/smoke.ts  # 连通性自检：一次对话 + 一次嵌入
```

## 用法三：在自己的代码里调用

最短的完整例子是 [`examples/quickstart.ts`](examples/quickstart.ts)，`node examples/quickstart.ts` 可以直接跑。

```ts
import { runCreativeEngine } from "../src/agents/engine.ts";

const result = await runCreativeEngine({
  client,                       // ChatClient，或任何实现了 chat/json 的对象
  catalog: loadCatalog(),       // data/operators.json 里的技法与角色
  space,                        // 语义空间，用来算新颖度与多样性
  taskId: "my-task",
  task: "把要解决的问题写在这里",
  knownSolutions: ["已知做法一", "已知做法二"],  // 有它，新颖度才有意义
  config: { generations: 3, generators: 4, ideasPerGenerator: 3, blendPairs: 2 }
});

for (const idea of result.archive.elites) {
  console.log(idea.novelty, idea.feasibility, idea.text);
}
```

常用参数（默认值在 [`src/agents/engine.ts`](src/agents/engine.ts) 的 `DEFAULT_ENGINE_CONFIG`）：

| 参数 | 默认 | 作用 |
| --- | --- | --- |
| `generations` | 3 | 发散轮数 |
| `generators` | 4 | 每轮几路生成者，每路换一条技法 |
| `ideasPerGenerator` | 3 | 每路要几条想法 |
| `blendPairs` | 2 | 每轮跨格融合几对 |
| `diversityFloor` | 0.35 | 平均两两语义距离低于它时升温并换算子，设 0 关闭 |
| `temperature` / `temperatureStep` / `maxTemperature` | 1.0 / 0.15 / 1.4 | 采样温度及其自适应范围 |
| `useCritic` / `useMetaReflector` | true | 是否调用评审者和元反思者 |
| `seed` | 20240930 | 随机种子 |

## 基准与指标

| 任务 | 测什么 | 主要指标 |
| --- | --- | --- |
| AUT（`aut-brick`、`aut-bottle`） | 发散思维 | 流畅性、灵活性、原创性、具体化、DT 指数 |
| DAT（`dat-7`、`dat-10`） | 语义发散程度 | 前 7 个有效词的 21 对余弦距离均值 ×100（标准 DAT 计分） |
| RAT（`rat-20`） | 聚合思维 | 严格命中率、任意候选命中率 |
| 设计简报（`brief-stove`、`brief-box`） | 新颖且可用的方案 | 新颖度、可行性、新颖度×可行性、固定抽样多样性、跨配置区分度 |

新颖度 = 1 − 与已知方案的最大余弦相似度；可行性由独立评委按同一份提示词给所有配置打分；跨配置区分度衡量同一道题上各家的想法有多容易撞车。完整定义见 [`docs/benchmark.md`](docs/benchmark.md)。

## 目录结构

```
AGENTS.md              给编码 Agent 的项目约定（命令、约束、验证流程、已知坑）
.agents/skills/creativity-engine/SKILL.md   Agent Skill（opencode 与 DSH 都会扫描）
data/                  技法目录、AUT / DAT / RAT / 设计简报任务与已知方案语料
src/core/              语义空间、新颖度、AUT / RAT 评分、质量-多样性档案、统计
src/llm/               OpenAI 兼容客户端（磁盘缓存、并发、重试、审计日志）与提示词
src/agents/            多 Agent 引擎、基线策略、成对比较评审
src/bench/             任务加载、自动评分、矩阵运行器、报告生成、PCA 投影
examples/quickstart.ts 最小代码调用示例
scripts/               demo / bench / rescore / analyze / run-all 命令行
test/                  35 个单元测试（确定性夹具或假模型，离线）
runs/                  实验产物与报告（模型调用缓存在 runs/cache/）
docs/                  调研笔记、机制设计、基准方法、结果与结论
```

## 参与开发

改代码前先看 [`AGENTS.md`](AGENTS.md)：里面有不能引入依赖、只能用类型擦除语法、测试必须离线、生成物不要手改这些硬性约定，以及每类改动对应的验证流程。

## 环境要求

- Node.js 22.6 以上（代码用类型擦除直接运行 `.ts`，不需要编译）
- 一个 OpenAI 兼容的模型端点，需要支持 `/chat/completions` 和 `/embeddings`

## 实验结果

主实验（4 配置 × 7 任务）与消融实验（4 配置 × 3 任务）的完整数据在 [`docs/results.md`](docs/results.md)，交互报告是 [`runs/main-live/report.html`](runs/main-live/report.html) 和 [`runs/ablation/report.html`](runs/ablation/report.html)。

跨任务均值：机制的新颖度最高（0.441，基线 0.387–0.405），AUT 灵活性 8 / 6（基线 3–5），跨配置区分度在 7 道题上全部排第一；可行性最低（0.460，基线 0.700–0.727），调用次数约为基线的 2.7 倍。消融显示增益主要来自技法异质化和融合（去掉后多样性 0.504 → 0.347），自适应升温在这批任务上未触发。结论与局限见 [`docs/report.md`](docs/report.md)。

## 常见问题

### 用 Skill 需要先有这个仓库的代码吗

不需要。技能目录里只有一个 `SKILL.md`，内容是技法表、七步流程、提示词模板和自检方法。拷到别的项目或者全局技能目录就能用，那台机器上不需要 Node，也不需要仓库里的其它文件。

### 那仓库代码还有什么用

代码只负责自动化，不是 Skill 的前置条件。

| 能力 | 只有 SKILL.md | 加上仓库代码 |
| --- | --- | --- |
| 生成、评审、融合、挑选想法 | 能，Agent 用自己手里的工具做 | 能，还能批量并发 |
| 新颖度、多样性、可行性打分 | 按文件里的方法手工估算 | 自动计算，含标准 DAT 计分和独立评委 |
| 对照实验与消融 | 做不了 | `scripts/bench.ts` 一条命令 |
| 复现报告里的数字 | 只能定性比较 | 可以，`runs/` 里有原始想法和逐格分数 |

### 怎么装到别的项目

项目级：把 `.agents/skills/creativity-engine/` 整个目录拷到目标仓库的 `.agents/skills/` 下，opencode 和 DSH 都会扫描这里。全机器可用：拷到 `~/.config/opencode/skills/` 或 `~/.dsh/skills/`。不支持 Skill 的应用：把文件内容贴进系统提示词或自定义指令，效果一样，只是不会按需触发。

### 不用代码的时候，怎么判断结果好坏

文件最后一节写了手工近似：把想法向量化，算「1 − 与已知方案的最大余弦相似度」当新颖度，算两两余弦距离均值当多样性，数语义类别当灵活性。算法和仓库里的实现一致，但缺少同一批任务上的实测数据做参照，所以分数不要和 [`docs/results.md`](docs/results.md) 里的数字直接比。

### 命令行必须联网吗

`npm test` 和 `node scripts/bench.ts --dry` 不用网络，后者用假模型跑通整条流水线。其余命令需要一个 OpenAI 兼容的模型端点，`/chat/completions` 和 `/embeddings` 都要能用。

### 想用在自己的问题上，要改代码吗

不用。`node scripts/demo.ts --task "你的问题"` 可以直接跑。想让新颖度有意义，把已知做法写进 `knownSolutions`（见 [`examples/quickstart.ts`](examples/quickstart.ts)），或者在 [`data/briefs.json`](data/briefs.json) 里加一条自己的任务。

### 可以商用吗

可以，MIT 许可，见 [`LICENSE`](LICENSE)。

## 已知限制

- 每份配置每个任务只跑一次、一个种子，结果说明方向和量级，不是显著性结论；
- 没有人类被试数据，因此报告里没有「超过人类」这类结论；
- 可行性由模型评委打分，而字数越多它给分越低（逐条数据里两者负相关），机制的想法又比基线长两倍多，这个偏置写在 [`docs/report.md`](docs/report.md)；
- 投影图的提示框只支持鼠标悬停，触屏上还没有对应交互。

## 许可

MIT，见 [`LICENSE`](LICENSE)。

## 参考

- 调研笔记（71 条已核实出处）：[`docs/research-notes.md`](docs/research-notes.md)
- 机制设计说明：[`docs/design.md`](docs/design.md)
- 基准方法与指标定义：[`docs/benchmark.md`](docs/benchmark.md)
- 任务来源与数据：[`data/`](data/)