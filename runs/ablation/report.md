# 创造力机制基准实验结果

- 运行目录：`runs/ablation`
- 随机种子：12 个单元格，seed 见 summary.json
- 单元格数：12，配置数：4，任务数：3

> 所有指标均由程序自动计算，不含人工评分。指标定义见 docs/benchmark.md。

## AUT 任务

### 发散思维综合指数 DT-index（`dtIndex`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| AUT: 砖头 | 0.547 | 0.655 | 0.718 | 0.687 |

### 平均原创性（`meanOriginality`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| AUT: 砖头 | 0.484 | 0.513 | 0.545 | 0.531 |

### 平均可行性（LLM 评委，0-1）（`meanFeasibility`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| AUT: 砖头 | 0.583 | 0.564 | 0.595 | 0.75 |

### 类别数（灵活性）（`flexibility`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| AUT: 砖头 | 2 | 4 | 6 | 5 |

### 有效想法数（流畅性）（`fluency`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| AUT: 砖头 | 6 | 39 | 37 | 12 |

## BRIEF 任务

### 平均新颖度（全量）（`meanNovelty`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| 快递纸箱的重复利用 | 0.337 | 0.335 | 0.311 | 0.277 |

### 平均新颖度（固定 12 条抽样）（`ctrl_meanNovelty`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| 快递纸箱的重复利用 | 0.337 | 0.39 | 0.303 | 0.277 |

### 平均可行性（LLM 评委，0-1）（`meanFeasibility`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| 快递纸箱的重复利用 | 0.433 | 0.435 | 0.43 | 0.617 |

### 新颖度 × 可行性（`noveltyUsefulness`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| 快递纸箱的重复利用 | 0.146 | 0.146 | 0.134 | 0.171 |

### 想法间平均语义距离（固定 12 条抽样，多样性）（`ctrl_meanPairwiseDistance`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| 快递纸箱的重复利用 | 0.258 | 0.405 | 0.344 | 0.312 |

### 相对其它配置想法的区分度（同质化审计）（`crossConfigDistinctiveness`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| 快递纸箱的重复利用 | 0.256 | 0.149 | 0.133 | 0.22 |

### 想法间平均语义距离（全量，受条数影响）（`meanPairwiseDistance`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| 快递纸箱的重复利用 | 0.258 | 0.349 | 0.348 | 0.312 |

### 想法簇数（固定 12 条抽样）（`ctrl_clusters`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| 快递纸箱的重复利用 | 1 | 2 | 1 | 1 |

### 平均具体化程度（`meanElaboration`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| 快递纸箱的重复利用 | 1 | 1 | 1 | 1 |

## DAT 任务

### DAT 计分（前 7 个有效词，21 对余弦距离均值 ×100）（`dispersion`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| DAT: 10 words | 0 | 43.59 | 41.38 | 41.48 |

### 有效单词比例（`validRate`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| DAT: 10 words | 0 | 0.6 | 0.3 | 1 |

### 相对随机词基线的差值（`dispersionVsCalibration`）

| 任务 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| DAT: 10 words | -40.97 | 2.62 | 0.41 | 0.52 |

## 配置汇总（跨任务平均）

| 指标 | engine-flat | engine-noadapt | engine | zero-shot |
| --- | --- | --- | --- | --- |
| meanPairwiseDistance | 0.347 ±0.08 | 0.472 ±0.13 | 0.498 ±0.14 | 0.416 ±0.11 |
| clusters | 1.333 ±0.58 | 8.333 ±7.77 | 8.667 ±7.09 | 3.667 ±3.79 |
| ctrl_n | 6 ±0 | 12 ±0 | 12 ±0 | 11.333 ±1.15 |
| ctrl_meanPairwiseDistance | 0.347 ±0.08 | 0.494 ±0.11 | 0.504 ±0.16 | 0.416 ±0.11 |
| ctrl_clusters | 1.333 ±0.58 | 5 ±3.61 | 5.667 ±4.51 | 3.667 ±3.79 |
| meanNovelty | 0.411 ±0.1 | 0.424 ±0.13 | 0.428 ±0.17 | 0.404 ±0.18 |
| maxNovelty | 0.457 ±0.12 | 0.552 ±0.08 | 0.55 ±0.09 | 0.543 ±0.07 |
| meanElaboration | 1 ±0 | 1 ±0 | 1 ±0 | 1 ±0 |
| ctrl_meanNovelty | 0.411 ±0.1 | 0.466 ±0.11 | 0.417 ±0.16 | 0.404 ±0.18 |
| meanFeasibility | 0.508 ±0.11 | 0.5 ±0.09 | 0.512 ±0.12 | 0.683 ±0.09 |
| meanImpact | 0.517 ±0.09 | 0.386 ±0.02 | 0.341 ±0.01 | 0.338 ±0.12 |
| noveltyUsefulness | 0.214 ±0.1 | 0.217 ±0.1 | 0.229 ±0.13 | 0.284 ±0.16 |
| fluency | 6 | 39 | 37 | 12 |
| flexibility | 2 | 4 | 6 | 5 |
| meanOriginality | 0.484 | 0.513 | 0.545 | 0.531 |
| maxOriginality | 0.539 | 0.612 | 0.612 | 0.59 |
| elaboration | 1 | 1 | 1 | 1 |
| invalid | 0 | 0 | 0 | 0 |
| dtIndex | 0.547 | 0.655 | 0.718 | 0.687 |
| crossConfigDistinctiveness | 0.354 ±0.12 | 0.226 ±0.08 | 0.216 ±0.07 | 0.37 ±0.13 |
| wordsGiven | 0 | 6 | 3 | 10 |
| wordsScored | 0 | 6 | 3 | 7 |
| validRate | 0 | 0.6 | 0.3 | 1 |
| dispersion | 0 | 43.59 | 41.38 | 41.48 |
| minPairDistance | 0 | 30.344 | 37.045 | 31.536 |
| maxPairDistance | 0 | 52.556 | 49.031 | 50.283 |
| calibrationDispersion | 40.969 | 40.969 | 40.969 | 40.969 |
| dispersionVsCalibration | -40.97 | 2.62 | 0.41 | 0.52 |

## 机制 vs 基线：逐任务配对差异

### engine − engine-flat

| 任务 | 指标 | engine | engine-flat | 差值 |
| --- | --- | --- | --- | --- |
| AUT: 砖头 | 发散思维综合指数 DT-index | 0.718 | 0.547 | +0.171 |
| 快递纸箱的重复利用 | 平均新颖度（全量） | 0.311 | 0.337 | -0.026 |
| DAT: 10 words | DAT 计分（前 7 个有效词，21 对余弦距离均值 ×100） | 41.38 | 0 | +41.38 |

### engine − engine-noadapt

| 任务 | 指标 | engine | engine-noadapt | 差值 |
| --- | --- | --- | --- | --- |
| AUT: 砖头 | 发散思维综合指数 DT-index | 0.718 | 0.655 | +0.063 |
| 快递纸箱的重复利用 | 平均新颖度（全量） | 0.311 | 0.335 | -0.024 |
| DAT: 10 words | DAT 计分（前 7 个有效词，21 对余弦距离均值 ×100） | 41.38 | 43.59 | -2.21 |

### engine − zero-shot

| 任务 | 指标 | engine | zero-shot | 差值 |
| --- | --- | --- | --- | --- |
| AUT: 砖头 | 发散思维综合指数 DT-index | 0.718 | 0.687 | +0.031 |
| 快递纸箱的重复利用 | 平均新颖度（全量） | 0.311 | 0.277 | +0.034 |
| DAT: 10 words | DAT 计分（前 7 个有效词，21 对余弦距离均值 ×100） | 41.38 | 41.48 | -0.1 |

## 成本

| 配置 | 平均调用次数 | 平均提示 token | 平均生成 token |
| --- | --- | --- | --- |
| engine-flat | 4 | 1900 | 1209 |
| engine-noadapt | 19.7 | 15645 | 6101 |
| engine | 20.3 | 16393 | 7358 |
| zero-shot | 1 | 26 | 9 |

## 引擎过程指标（模式坍塌监控）

| 任务 | 轮次 | 新想法 | 平均两两距离 | 平均新颖度 | 簇数 | 温度 | 档案规模 | 覆盖率 | QD 分数 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| aut-brick | 1 | 14 | 0.4793 | 0.5254 | 3 | 1 | 3 | 0.333 | 1.641 |
| aut-brick | 2 | 14 | 0.4816 | 0.567 | 5 | 1 | 3 | 0.333 | 1.641 |
| aut-brick | 3 | 9 | 0.4533 | 0.5431 | 3 | 1 | 3 | 0.333 | 1.641 |
| brief-box | 1 | 14 | 0.3524 | 0.3449 | 1 | 1 | 5 | 0.556 | 2.129 |
| brief-box | 2 | 14 | 0.3318 | 0.274 | 1 | 1 | 5 | 0.556 | 2.129 |
| brief-box | 3 | 9 | 0.275 | 0.3145 | 1 | 1.15 | 5 | 0.556 | 2.129 |
| dat-10 | 1 | 13 | 0.5783 | 1 | 6 | 1 | 3 | 0.333 | 2.23 |
| dat-10 | 2 | 10 | 0.6014 | 1 | 6 | 1 | 3 | 0.333 | 2.23 |
| dat-10 | 3 | 9 | 0.568 | 1 | 5 | 1 | 3 | 0.333 | 2.23 |

---

生成时间：2026-09-30T07:20:52.257Z