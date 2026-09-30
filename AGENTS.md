# AGENTS.md

给在这个仓库里干活的编码 Agent 看的约定。人也可以看：README 讲怎么用，这里讲怎么改。

## 项目速览

把「让 AI 有创造力」做成可运行、可评分的流程。三块内容：多 Agent 生成引擎（`src/agents/`）、Agent Skill（`.agents/skills/creativity-engine/SKILL.md`）、自动评分基准（`src/bench/`）。入口在 `scripts/`。

技术栈刻意压到最小：Node 22.6+、零第三方依赖、用 Node 自带的 TypeScript 类型擦除直接跑 `.ts`。没有 tsconfig，没有构建步骤，没有打包器。

## 硬性约束

1. **不要引入 npm 依赖。** 标准库和全局 `fetch` 够用。确实需要新依赖时，先说明理由再动手。
2. **只用类型擦除（strip-only）语法。** 禁止 `enum`、`namespace`、构造函数参数属性（`constructor(private x: T)`）——这些在运行时会直接抛 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`。相对导入必须带 `.ts` 后缀。
3. **测试必须离线且确定性。** 测试里不允许真实网络调用、真实时间等待、无种子随机。随机用 `src/core/random.ts` 里的种子 RNG；模型通信用 `test-support/fake-llm.ts` 的 `FakeLlm`；语义空间用 `test-support/spaces.ts` 的确定性夹具。
4. **测试文件放 `test/`，辅助文件放 `test-support/`。** `node --test` 会把 `test/` 目录下所有 `.ts` 都当测试文件执行，辅助文件放进去会直接报错。
5. **密钥不进仓库。** 端点凭据只从环境变量（`CREATIVE_BASE_URL`、`CREATIVE_API_KEY` 等）或本机 OpenCode 配置读取，不写进代码、文档、日志、实验产物。
6. **`runs/` 是证据链，要提交；`runs/cache/` 是模型缓存，不提交**（已在 `.gitignore`）。每个分数都要能追到对应的想法原文。
7. **不要手改生成物。** `docs/results.md`、`runs/*/report.md`、`runs/*/report.html`、`runs/*/summary.json`、`runs/*/score__*.json` 都由脚本产出，改了会被下一次运行覆盖。
8. **术语用标准说法。** 首次出现给英文原文；自造词必须在文档里定义清楚（prompt.txt 里专门提过这一点）。「算子」在本仓库指创造力技法（creativity technique），不是数学或神经网络意义上的算子。

## 常用命令

```bash
npm test                                          # 全部单元测试，离线，改完必须全绿
npm run smoke                                     # 端点连通性自检（需要模型端点）
npm run demo -- aut-brick                         # 单任务演示
npm run demo -- --task "你的问题" --generations 1  # 自由文本任务
npm run bench:dry                                 # 假模型跑通基准流水线，不联网
npm run bench -- --tasks aut-brick --configs engine,zero-shot --out runs/try
npm run rescore -- --run runs/try                 # 只重算分数与报告
npm run analyze -- runs/try > docs/results.md     # 结果导成 Markdown 表
bash scripts/run-all.sh                           # 主实验 + 消融 + 报告
```

## 代码结构与依赖方向

依赖只能单向流动，不要出现反向引用：

```
src/core/    纯逻辑：语义空间、距离、新颖度、AUT/RAT 评分、质量-多样性档案、统计、配置、RNG
   ↑
src/llm/     端点客户端（缓存、并发、重试、审计日志）与提示词模板
   ↑
src/agents/  引擎、基线策略、成对比较评审；只依赖 LlmLike 接口，不直接 new ChatClient
   ↑
src/bench/   任务加载、自动评分、矩阵运行器、报告生成、PCA 投影
   ↑
scripts/     命令行入口；examples/ 是最小调用示例
```

`src/core/` 不允许 import 上层任何东西。`test-support/` 只给测试用，不进 `src/`。

## 不能破坏的不变量

- **可测性**：评分和编排逻辑必须能在没有网络的情况下测。要加新的 LLM 调用，就让它经过 `LlmLike`。
- **可复现**：所有模型调用走 `ChatClient`，它按（模型、消息、采样参数）做磁盘缓存并写审计日志 `runs/cache/chat-log.jsonl`。绕过它就没法复现、也拿不到 token 统计。
- **指标口径**：指标定义写在 `docs/benchmark.md`，实现写在 `src/bench/scoring.ts`，两者必须一致。改口径要同步改文档，并在 `docs/report.md` 里说明哪些已发布的数字受影响。
- **档案按身份归档**：`QualityDiversityArchive.add(item, descriptor, objective, key)` 的 `key` 是想法 id。同一条想法被评审改写可行性后要**移动**到新格，不能留两份。
- **尺寸可比**：多样性一类会随想法条数变化的指标，比较时必须用固定条数抽样（`ctrl_*` 前缀那组）。
- **Skill 保持独立**：`.agents/skills/creativity-engine/SKILL.md` 可以被单独拷到别的项目用，里面不能引入对本仓库路径的硬依赖（提到仓库代码时必须写成可选）。

## 改动怎么验

| 改了什么 | 至少要做到 |
| --- | --- |
| `src/core/` 评分或工具 | `npm test`；新增行为补 `test/core-scoring.test.ts` 的夹具用例 |
| 提示词、引擎、Agent 角色 | 先 `npm run bench:dry`，再小范围真跑（`--tasks aut-brick --configs engine --out runs/try`），然后 `rescore` + `analyze` |
| 基准任务或指标 | 更新 `docs/benchmark.md`，重跑受影响的运行，提交原始产物与重新生成的报告 |
| 命令行或 npm script | 在 `package.json` 里加对应条目，README「用法二」同步 |
| 文档 | 链接用相对路径且必须指向真实文件（提交前手动核一遍） |

真跑会产生新的模型调用（提示词改了缓存键就失效），这是预期的；不要把缓存命中当成结果正确的证据。

## 加东西放哪儿

- **新认知算子** → `data/operators.json`，`origin` 字段写清出处传统；同时在 SKILL.md 的技法表里补一行。
- **新任务** → `data/aut-items.json`、`dat-items.json`、`rat-items.json` 或 `briefs.json`；字段定义见 `src/bench/tasks.ts`，注意 `style`（`sentence` / `word` / `labeled`）决定生成者的输出形态。
- **新指标** → `src/bench/scoring.ts` 计算，`scripts/analyze.ts` 加一行，`docs/benchmark.md` 写定义。
- **新命令** → `scripts/*.ts` + `package.json` 的 `scripts` + README 用法二。
- **新单元测试** → `test/*.test.ts`，夹具放 `test-support/`。

## 已知坑

- `node --test test/` 会报找不到模块；用 `npm test`（等价于 `node --test`）。
- 本机端点不接受 `response_format`（HTTP 400），也不接受 `reasoning_effort: "off"`；关推理用 `"none"`。JSON 靠提示词约束 + `src/core/text.ts` 的 `extractJson` 容错解析。
- 嵌入模型是 `qwen3-embedding:latest`（4096 维，本机端点）。它对无关词对的余弦相似度也在 0.5~0.65 之间，所以新颖度、多样性这类指标必须和随机词基线一起读。
- 中文分词会把 CJK 切成单字加双字组合（`src/core/text.ts`），写近重复判断时留意这个粒度。
- `runs/` 下的产物会进版本库，体量不小；跑实验时不要顺手把整个缓存目录复制进去。

## 提交与发布

- 主分支 `master`，远端 `origin` 指向 `git@gitee.com:az13js/creativity-engine.git`。
- 提交信息用中文，说清改了什么、为什么；一次提交只做一件事。
- 提交前：`npm test` 全绿、`git status` 干净、`docs/` 里的相对链接有效。
- 提交作者保持现状（`Creativity Engine Agent <agent@localhost>`），不要改。
