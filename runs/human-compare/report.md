# 创造力机制基准实验结果

- 运行目录：`runs/human-compare`
- 随机种子：8 个单元格，seed 见 summary.json
- 单元格数：8，配置数：2，任务数：4

> 所有指标均由程序自动计算，不含人工评分。指标定义见 docs/benchmark.md。

## AUT 任务

### 发散思维综合指数 DT-index（`dtIndex`）

| 任务 | engine | zero-shot |
| --- | --- | --- |
| AUT: box | 0.809 | 0.576 |
| AUT: brick | 0.848 | 0.559 |
| AUT: rope | 0.79 | 0.47 |

### 平均原创性（`meanOriginality`）

| 任务 | engine | zero-shot |
| --- | --- | --- |
| AUT: box | 0.646 | 0.435 |
| AUT: brick | 0.621 | 0.399 |
| AUT: rope | 0.601 | 0.359 |

### 平均可行性（LLM 评委，0-1）（`meanFeasibility`）

| 任务 | engine | zero-shot |
| --- | --- | --- |
| AUT: box | 0.556 | 0.658 |
| AUT: brick | 0.542 | 0.708 |
| AUT: rope | 0.584 | 0.792 |

### 类别数（灵活性）（`flexibility`）

| 任务 | engine | zero-shot |
| --- | --- | --- |
| AUT: box | 8 | 5 |
| AUT: brick | 14 | 3 |
| AUT: rope | 8 | 2 |

### 有效想法数（流畅性）（`fluency`）

| 任务 | engine | zero-shot |
| --- | --- | --- |
| AUT: box | 34 | 12 |
| AUT: brick | 31 | 12 |
| AUT: rope | 31 | 12 |

## DAT 任务

### DAT 计分（前 7 个有效词，21 对余弦距离均值 ×100）（`dispersion`）

| 任务 | engine | zero-shot |
| --- | --- | --- |
| DAT: 7 words | 40.67 | 38.96 |

### 有效单词比例（`validRate`）

| 任务 | engine | zero-shot |
| --- | --- | --- |
| DAT: 7 words | 1 | 1 |

### 相对随机词基线的差值（`dispersionVsCalibration`）

| 任务 | engine | zero-shot |
| --- | --- | --- |
| DAT: 7 words | -0.29 | -2.01 |

## 配置汇总（跨任务平均）

| 指标 | engine | zero-shot |
| --- | --- | --- |
| meanPairwiseDistance | 0.52 ±0.06 | 0.428 ±0.03 |
| clusters | 11 ±3.46 | 2.75 ±1.71 |
| ctrl_n | 12 ±0 | 10.75 ±2.5 |
| ctrl_meanPairwiseDistance | 0.533 ±0.06 | 0.428 ±0.03 |
| ctrl_clusters | 6.75 ±2.22 | 2.75 ±1.71 |
| meanNovelty | 0.623 ±0.02 | 0.398 ±0.04 |
| maxNovelty | 0.714 ±0.02 | 0.551 ±0.07 |
| meanElaboration | 1 ±0 | 0.616 ±0.18 |
| ctrl_meanNovelty | 0.622 ±0.01 | 0.398 ±0.04 |
| meanFeasibility | 0.561 ±0.02 | 0.719 ±0.07 |
| meanImpact | 0.326 ±0.01 | 0.233 ±0.02 |
| noveltyUsefulness | 0.349 ±0.01 | 0.284 ±0 |
| fluency | 32 ±1.73 | 12 ±0 |
| flexibility | 10 ±3.46 | 3.333 ±1.53 |
| meanOriginality | 0.623 ±0.02 | 0.398 ±0.04 |
| maxOriginality | 0.714 ±0.02 | 0.551 ±0.07 |
| elaboration | 1 ±0 | 0.616 ±0.18 |
| invalid | 0 ±0 | 0 ±0 |
| dtIndex | 0.816 ±0.03 | 0.535 ±0.06 |
| crossConfigDistinctiveness | 0.578 ±0.09 | 0.533 ±0.09 |
| wordsGiven | 7 | 7 |
| wordsScored | 7 | 7 |
| validRate | 1 | 1 |
| dispersion | 40.67 | 38.96 |
| minPairDistance | 14.934 | 31.037 |
| maxPairDistance | 56.46 | 46.015 |
| calibrationDispersion | 40.969 | 40.969 |
| dispersionVsCalibration | -0.29 | -2.01 |

## 机制 vs 基线：逐任务配对差异

### engine − zero-shot

| 任务 | 指标 | engine | zero-shot | 差值 |
| --- | --- | --- | --- | --- |
| AUT: box | 发散思维综合指数 DT-index | 0.809 | 0.576 | +0.232 |
| AUT: brick | 发散思维综合指数 DT-index | 0.848 | 0.559 | +0.29 |
| AUT: rope | 发散思维综合指数 DT-index | 0.79 | 0.47 | +0.321 |
| DAT: 7 words | DAT 计分（前 7 个有效词，21 对余弦距离均值 ×100） | 40.67 | 38.96 | +1.71 |

## 成本

| 配置 | 平均调用次数 | 平均提示 token | 平均生成 token |
| --- | --- | --- | --- |
| engine | 18.5 | 11915 | 4923 |
| zero-shot | 1 | 110 | 134 |

## 引擎过程指标（模式坍塌监控）

| 任务 | 轮次 | 新想法 | 平均两两距离 | 平均新颖度 | 簇数 | 温度 | 档案规模 | 覆盖率 | QD 分数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| aut-box-en | 1 | 14 | 0.4471 | 0.6638 | 3 | 1 | 6 | 0.667 | 3.454 |
| aut-box-en | 2 | 14 | 0.4785 | 0.6416 | 6 | 1 | 6 | 0.667 | 3.454 |
| aut-box-en | 3 | 6 | 0.4249 | 0.6162 | 2 | 1 | 6 | 0.667 | 3.454 |
| aut-brick-en | 1 | 14 | 0.4774 | 0.6016 | 4 | 1 | 5 | 0.556 | 3.042 |
| aut-brick-en | 2 | 11 | 0.5114 | 0.6325 | 7 | 1 | 5 | 0.556 | 3.042 |
| aut-brick-en | 3 | 6 | 0.4643 | 0.6446 | 3 | 1 | 5 | 0.556 | 3.042 |
| aut-rope-en | 1 | 14 | 0.4163 | 0.6006 | 2 | 1 | 5 | 0.556 | 2.709 |
| aut-rope-en | 2 | 11 | 0.4568 | 0.6154 | 5 | 1 | 5 | 0.556 | 2.709 |
| aut-rope-en | 3 | 6 | 0.5212 | 0.5729 | 4 | 1 | 5 | 0.556 | 2.709 |
| dat-en-7 | 1 | 14 | 0.5966 | 1 | 6 | 1 | 3 | 0.333 | 2.255 |
| dat-en-7 | 2 | 14 | 0.5416 | 1 | 5 | 1 | 3 | 0.333 | 2.255 |
| dat-en-7 | 3 | 6 | 0.5846 | 1 | 4 | 1 | 3 | 0.333 | 2.255 |

---

生成时间：2026-09-30T12:43:25.442Z