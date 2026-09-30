# 实验结果（自动生成）

由 `node scripts/analyze.ts` 从各次运行的 summary.json 与逐格 score 文件生成。

## 运行 runs/main-live

### 平均新颖度（AUT/简报） `meanNovelty`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 0.528 | 0.512 | 0.498 | 0.491 |
| aut-brick | aut | 0.535 | 0.492 | 0.566 | 0.531 |
| brief-box | brief | 0.33 | 0.253 | 0.248 | 0.277 |
| brief-stove | brief | 0.372 | 0.29 | 0.309 | 0.273 |

### 平均可行性（独立评委 0-1） `meanFeasibility`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 0.473 | 0.717 | 0.7 | 0.708 |
| aut-brick | aut | 0.464 | 0.833 | 0.733 | 0.75 |
| brief-box | brief | 0.358 | 0.642 | 0.625 | 0.617 |
| brief-stove | brief | 0.547 | 0.717 | 0.742 | 0.758 |

### 新颖度 × 可行性 `noveltyUsefulness`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 0.25 | 0.367 | 0.349 | 0.348 |
| aut-brick | aut | 0.248 | 0.41 | 0.415 | 0.398 |
| brief-box | brief | 0.118 | 0.163 | 0.155 | 0.171 |
| brief-stove | brief | 0.203 | 0.208 | 0.229 | 0.207 |

### 多样性（固定 12 条抽样） `ctrl_meanPairwiseDistance`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 0.441 | 0.512 | 0.428 | 0.446 |
| aut-brick | aut | 0.484 | 0.477 | 0.548 | 0.524 |
| brief-box | brief | 0.366 | 0.322 | 0.323 | 0.312 |
| brief-stove | brief | 0.34 | 0.385 | 0.34 | 0.358 |
| dat-10 | dat | 0.581 | 0.357 | 0.42 | 0.436 |
| dat-7 | dat | 0.594 | 0.429 | 0.42 | 0.418 |
| rat-20 | rat | 0.313 | 0.337 | 0.361 | 0.349 |

### 簇数（固定 12 条抽样） `ctrl_clusters`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 3 | 8 | 3 | 3 |
| aut-brick | aut | 4 | 4 | 8 | 8 |
| brief-box | brief | 1 | 2 | 1 | 1 |
| brief-stove | brief | 1 | 2 | 1 | 1 |
| dat-10 | dat | 9 | 1 | 2 | 2 |
| dat-7 | dat | 11 | 2 | 2 | 2 |
| rat-20 | rat | 1 | 1 | 2 | 1 |

### AUT 平均原创性 `meanOriginality`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 0.528 | 0.512 | 0.498 | 0.491 |
| aut-brick | aut | 0.535 | 0.492 | 0.566 | 0.531 |

### AUT 灵活性（词表类别数） `flexibility`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 6 | 3 | 4 | 4 |
| aut-brick | aut | 8 | 4 | 7 | 5 |

### AUT 流畅性（有效想法数） `fluency`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 33 | 12 | 12 | 12 |
| aut-brick | aut | 39 | 12 | 12 | 12 |

### AUT 综合指数 `dtIndex`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 0.711 | 0.63 | 0.649 | 0.646 |
| aut-brick | aut | 0.764 | 0.647 | 0.751 | 0.687 |

### 跨配置区分度（同质化审计） `crossConfigDistinctiveness`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 0.361 | 0.34 | 0.289 | 0.309 |
| aut-brick | aut | 0.457 | 0.354 | 0.405 | 0.352 |
| brief-box | brief | 0.284 | 0.177 | 0.166 | 0.174 |
| brief-stove | brief | 0.271 | 0.203 | 0.184 | 0.181 |
| dat-10 | dat | 0.595 | 0.308 | 0.12 | 0.137 |
| dat-7 | dat | 0.568 | 0.36 | 0.191 | 0.204 |
| rat-20 | rat | 0.303 | 0 | 0.539 | 0 |

### DAT 计分（×100） `dispersion`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| dat-10 | dat | 43.24 | 33.56 | 41.62 | 43.09 |
| dat-7 | dat | 41.04 | 42.9 | 41.97 | 41.75 |

### RAT 候选命中率 `passAtK`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| rat-20 | rat | 0.45 | 1 | 0.05 | 1 |

### 去重后想法数 `nUnique`

| 任务 | 类型 | engine | self-refine | structured-cot | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-bottle | aut | 33 | 12 | 12 | 12 |
| aut-brick | aut | 39 | 12 | 12 | 12 |
| brief-box | brief | 40 | 12 | 12 | 12 |
| brief-stove | brief | 34 | 12 | 12 | 12 |
| dat-10 | dat | 34 | 10 | 10 | 10 |
| dat-7 | dat | 30 | 7 | 7 | 7 |
| rat-20 | rat | 22 | 20 | 20 | 20 |

### 跨任务均值

| 配置 | 新颖度 | 可行性 | 新颖×可行 | 多样性(抽样) | DT 指数 | RAT 命中 | 平均调用 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| engine | 0.441 | 0.46 | 0.205 | 0.445 | 0.738 | 0.45 | 33.143 |
| self-refine | 0.387 | 0.727 | 0.287 | 0.403 | 0.638 | 1 | 12.143 |
| structured-cot | 0.405 | 0.7 | 0.287 | 0.406 | 0.7 | 0.05 | 12.143 |
| zero-shot | 0.393 | 0.708 | 0.281 | 0.406 | 0.667 | 1 | 12.143 |

### 机制 vs 其它配置：配对的效应量（新颖度 / 可行性）

| 对照 | Δ新颖度 | Δ可行性 | Cliff's δ（可行性） |
| --- | --- | --- | --- |
| self-refine | +0.031 | -0.152 | -0.327 |
| structured-cot | +0.021 | -0.137 | -0.327 |
| zero-shot | +0.028 | -0.142 | -0.327 |

## 运行 runs/ablation

### 平均新颖度（AUT/简报） `meanNovelty`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 0.545 | 0.484 | 0.513 | 0.531 |
| brief-box | brief | 0.311 | 0.337 | 0.335 | 0.277 |

### 平均可行性（独立评委 0-1） `meanFeasibility`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 0.595 | 0.583 | 0.564 | 0.75 |
| brief-box | brief | 0.43 | 0.433 | 0.435 | 0.617 |

### 新颖度 × 可行性 `noveltyUsefulness`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 0.324 | 0.283 | 0.289 | 0.398 |
| brief-box | brief | 0.134 | 0.146 | 0.146 | 0.171 |

### 多样性（固定 12 条抽样） `ctrl_meanPairwiseDistance`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 0.516 | 0.358 | 0.453 | 0.524 |
| brief-box | brief | 0.344 | 0.258 | 0.405 | 0.312 |
| dat-10 | dat | 0.653 | 0.425 | 0.623 | 0.412 |

### 簇数（固定 12 条抽样） `ctrl_clusters`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 6 | 1 | 4 | 8 |
| brief-box | brief | 1 | 1 | 2 | 1 |
| dat-10 | dat | 10 | 2 | 9 | 2 |

### AUT 平均原创性 `meanOriginality`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 0.545 | 0.484 | 0.513 | 0.531 |

### AUT 灵活性（词表类别数） `flexibility`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 6 | 2 | 4 | 5 |

### AUT 流畅性（有效想法数） `fluency`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 37 | 6 | 39 | 12 |

### AUT 综合指数 `dtIndex`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 0.718 | 0.547 | 0.655 | 0.687 |

### 跨配置区分度（同质化审计） `crossConfigDistinctiveness`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 0.252 | 0.322 | 0.217 | 0.42 |
| brief-box | brief | 0.133 | 0.256 | 0.149 | 0.22 |
| dat-10 | dat | 0.263 | 0.484 | 0.312 | 0.469 |

### DAT 计分（×100） `dispersion`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| dat-10 | dat | 41.38 | 0 | 43.59 | 41.48 |

### 去重后想法数 `nUnique`

| 任务 | 类型 | engine | engine-flat | engine-noadapt | zero-shot |
| --- | --- | --- | --- | --- | --- |
| aut-brick | aut | 37 | 6 | 39 | 12 |
| brief-box | brief | 37 | 6 | 40 | 12 |
| dat-10 | dat | 32 | 6 | 39 | 10 |

### 跨任务均值

| 配置 | 新颖度 | 可行性 | 新颖×可行 | 多样性(抽样) | DT 指数 | RAT 命中 | 平均调用 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| engine | 0.428 | 0.512 | 0.229 | 0.504 | 0.718 | — | 35.333 |
| engine-flat | 0.411 | 0.508 | 0.214 | 0.347 | 0.547 | — | 6 |
| engine-noadapt | 0.424 | 0.5 | 0.217 | 0.494 | 0.655 | — | 39.333 |
| zero-shot | 0.404 | 0.683 | 0.284 | 0.416 | 0.687 | — | 11.333 |

### 机制 vs 其它配置：配对的效应量（新颖度 / 可行性）

| 对照 | Δ新颖度 | Δ可行性 | Cliff's δ（可行性） |
| --- | --- | --- | --- |
| engine-flat | +0.012 | +0.003 | 0 |
| engine-noadapt | +0.003 | +0.008 | 0 |
| zero-shot | +0.016 | -0.114 | -0.444 |

## 逐条评判的可信度检查

- 被独立评委打分的想法数：238
- 想法长度与可行性评分的皮尔逊相关：r = -0.497（若显著为负，说明评委可能把「长/复杂」当成「不可行」，这属于评委偏置）
- 平均可行性：0.603，标准差 0.212

| 配置 | 条数 | 平均字数 | 平均可行性 |
| --- | --- | --- | --- |
| engine | 109 | 105.5 | 0.511 |
| self-refine | 24 | 51 | 0.775 |
| structured-cot | 24 | 48 | 0.717 |
| zero-shot | 36 | 39.2 | 0.736 |
| engine-flat | 6 | 121.2 | 0.583 |
| engine-noadapt | 39 | 110.5 | 0.564 |

