# Creativity Engine：可自动评分的 AI 创造力机制

本仓库回答一个问题：**如果 AI 能通过提示词、Skill、多子 Agent 机制学会或复现人类级别的想象力/
创造力/灵感，那么这套提示词、Skill、机制长什么样，怎么证明它有效？**

答案不是一个"咒语"，而是一套可检验的流水线：

1. **提示词层**：生成者被绑定到**认知算子**（SCAMPER、TRIZ 矛盾消解、结构映射、概念融合等 12 个
   有文献出处的算子）而不是"请有创意"；评审被要求给失败原因而不是打分鼓励。
2. **Skill 层**：[skills/creativity-engine/SKILL.md](skills/creativity-engine/SKILL.md) 把协议固定成
   可复用的操作手册（何时使用、七个步骤、提示词模板、反模式、自检方法）。
3. **多 Agent 层**：4 个异质生成者 + 1 个评审者 + 1 个概念融合者 + 1 个元反思者，
   外加一个**自适控制器**（平均两两语义距离低于阈值时升温并换算子）。
4. **档案层**：MAP-Elites 式质量-多样性档案，交付"覆盖多个格子的精英集合"而不是单一最佳答案。
5. **基准层**：AUT、DAT、RAT、设计简报四类任务 + 十来个全自动指标（流畅性/灵活性/原创性/
   新颖度/可行性/多样性/同质化/路线覆盖），可以拿来做消融实验。

## 快速开始

```bash
npm test                               # 31 个单元测试，全部离线、确定性
node scripts/smoke.ts                  # 连通性自检：一次对话 + 一次嵌入
node scripts/bench.ts --dry            # 用假模型跑通整条基准流水线（不需要网络）
node scripts/bench.ts --generations 3  # 真模型全量运行（写入 runs/<时间戳>/）
node scripts/bench.ts --tasks aut-brick --configs engine,zero-shot
node scripts/rescore.ts --run runs/<目录名>   # 只重算分数与报告，不重新生成想法
```

模型端点优先从环境变量读取（`CREATIVE_BASE_URL` / `CREATIVE_API_KEY` /
`CREATIVE_CHAT_MODEL` / `CREATIVE_EMBED_MODEL`），否则回退到本机 OpenCode 配置。
**密钥只从配置文件读入，不写入任何产物**；所有实验产物在 `runs/`（已 gitignore）。

## 实验结果

跨任务均值（4 配置 × 7 任务，全部指标自动计算）：

| 配置 | 新颖度↑ | 可行性↑ | 新颖×可行↑ | 多样性(抽样)↑ | AUT DT 指数↑ | RAT 命中↑ | 平均调用 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **engine（本机制）** | **0.441** | 0.460 | 0.205 | **0.445** | **0.738** | 0.45 | 33.1 |
| self-refine | 0.387 | **0.727** | **0.287** | 0.403 | 0.638 | 1.00 | 12.1 |
| structured-cot | 0.405 | 0.700 | **0.287** | 0.406 | 0.700 | 0.05 | 12.1 |
| zero-shot | 0.393 | 0.708 | 0.281 | 0.406 | 0.667 | 1.00 | 12.1 |

机制在**新颖度、灵活性、多样性、跨配置区分度**（7/7 任务最高）上领先，
在**可行性**上付出代价；消融显示增益主要来自**算子异质化 + 概念融合**。
逐条评判显示评委可能把"长"当成"不可行"（字数 vs 可行性 r = −0.497），这是一个已记录的混淆。
详见 [docs/results.md](docs/results.md) 与 [docs/report.md](docs/report.md)。

- 主实验（4 配置 × 7 任务）：[runs/main-live/report.md](runs/main-live/report.md) ·
  [runs/main-live/report.html](runs/main-live/report.html)
- 消融实验（机制各部分贡献）：[runs/ablation/report.md](runs/ablation/report.md) ·
  [runs/ablation/report.html](runs/ablation/report.html)
- 综合结论与局限：[docs/report.md](docs/report.md)
- 文献调研笔记（71 条已核实出处）：[docs/research-notes.md](docs/research-notes.md)
- 机制设计说明：[docs/design.md](docs/design.md)
- 基准方法与指标定义：[docs/benchmark.md](docs/benchmark.md)

## 目录结构

```
data/                 算子目录、AUT/DAT/RAT/简报任务与已知方案语料
skills/creativity-engine/SKILL.md   Skill 交付物（可直接被 Agent 加载）
src/core/             语义距离、语义空间、新颖度、AUT/RAT 评分、QD 档案、统计
src/llm/              OpenAI 兼容客户端（磁盘缓存、并发、重试、审计日志）与提示词
src/agents/           多 Agent 引擎、基线策略、成对比较评审
src/bench/            任务加载、自动评分、矩阵运行器、报告生成、PCA 投影
test/                 31 个单元测试（全部使用确定性夹具或假模型）
scripts/              smoke / bench / rescore 命令行
runs/                 实验产物（原始想法、逐格分数、报告）
```

## 设计原则

- **可测试性优先**：LLM 被抽象成 `LlmLike` 接口，编排逻辑用假模型测试；
  评分逻辑用确定性夹具测试（`npm test` 不需要网络）。
- **可复现**：固定种子；LLM 调用按 (模型, 消息, 采样参数) 做磁盘缓存，
  重跑基准不花钱；每次调用写入 `runs/cache/chat-log.jsonl` 供审计。
- **可审计**：每个分数都能追溯到原始想法文本（`runs/<dir>/<task>__<config>.json`）。
- **诚实**：同时报告新颖度与可行性，报告随机词基线与已知度量局限；
  不声称"超过人类"，因为没有人类被试数据。