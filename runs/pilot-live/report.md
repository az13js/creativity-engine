# 创造力机制基准实验结果

- 运行目录：`runs/pilot-live`
- 随机种子：2 个单元格，seed 见 summary.json
- 单元格数：2，配置数：2，任务数：1

> 所有指标均由程序自动计算，不含人工评分。指标定义见 docs/benchmark.md。

## AUT 任务

### 发散思维综合指数 DT-index（`dtIndex`）

| 任务 | zero-shot | engine |
| --- | --- | --- |
| AUT: 砖头 | 0.687 | 0.739 |

### 平均原创性（`meanOriginality`）

| 任务 | zero-shot | engine |
| --- | --- | --- |
| AUT: 砖头 | 0.531 | 0.536 |

### 类别数（灵活性）（`flexibility`）

| 任务 | zero-shot | engine |
| --- | --- | --- |
| AUT: 砖头 | 5 | 7 |

### 有效想法数（流畅性）（`fluency`）

| 任务 | zero-shot | engine |
| --- | --- | --- |
| AUT: 砖头 | 12 | 26 |

## 配置汇总（跨任务平均）

| 指标 | zero-shot | engine |
| --- | --- | --- |
| meanPairwiseDistance | 0.524 | 0.482 |
| clusters | 8 | 6 |
| meanNovelty | 0.531 | 0.536 |
| maxNovelty | 0.59 | 0.63 |
| meanElaboration | 1 | 1 |
| fluency | 12 | 26 |
| flexibility | 5 | 7 |
| meanOriginality | 0.531 | 0.536 |
| maxOriginality | 0.59 | 0.63 |
| elaboration | 1 | 1 |
| invalid | 0 | 0 |
| dtIndex | 0.687 | 0.739 |

## 机制 vs 基线：逐任务配对差异

### engine − zero-shot

| 任务 | 指标 | engine | zero-shot | 差值 |
| --- | --- | --- | --- | --- |
| AUT: 砖头 | 发散思维综合指数 DT-index | 0.739 | 0.687 | +0.052 |

## 成本

| 配置 | 平均调用次数 | 平均提示 token | 平均生成 token |
| --- | --- | --- | --- |
| zero-shot | 1 | 64 | 308 |
| engine | 13 | 8529 | 4871 |

## 引擎过程指标（模式坍塌监控）

| 任务 | 轮次 | 新想法 | 平均两两距离 | 平均新颖度 | 簇数 | 温度 | 档案规模 | 覆盖率 | QD 分数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| aut-brick | 1 | 14 | 0.458 | 1 | 3 | 1 | 3 | 0.333 | 2.28 |
| aut-brick | 2 | 12 | 0.466 | 1 | 4 | 1 | 3 | 0.333 | 2.28 |

---

生成时间：2026-09-30T06:16:53.698Z