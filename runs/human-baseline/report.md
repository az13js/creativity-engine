# 人类数据基线报告

本报告由 `npm run human` 生成，原始数据见 `data/human/`，导入脚本见 `scripts/fetch-human-data.ts`。

- 语义空间：embeddings:qwen3-embedding:latest
- 生成时间：2026-09-30T13:35:33.301Z
- 抽样：AUT 每题 600 条，词语联想每题 100 条，机器对比的每题人类参照 900 条，DAT 2000 人（种子 20240930）

## 1. 自动指标与人类评分的相关

人类数据：SemDis（Beaty & Johnson, 2021）公开的 AUT 与词语联想作答，每题 1~4 名人类评分者。相关性都在题目内部计算（不同题目的分数不可直接合并）。

人类流畅性（每人给出的作答条数，含所有题目）：446 名参与者，均值 15.91，中位数 14.00，P10~P90 7.00~27.00；机器一次运行给出一道题的 30 条左右。两者任务时长不同，只能作为量级参照。

### AUT 题目（n = 1800 条人类作答）

| 自动指标 | 题目数 | Fisher 平均 Spearman | Fisher 平均 Pearson | 合并（题内标准化）r | 为正的题目占比 | 各题目 Spearman |
| --- | --- | --- | --- | --- | --- | --- |
| toItem | 3 | 0.398 | 0.395 | 0.395 | 1.00 | box 0.42；rope 0.39；brick 0.39 |
| meanKOther | 3 | 0.199 | 0.209 | 0.207 | 1.00 | box 0.14；rope 0.29；brick 0.16 |
| minOther | 3 | 0.518 | 0.504 | 0.502 | 1.00 | box 0.48；rope 0.59；brick 0.48 |
| meanOther | 3 | 0.398 | 0.395 | 0.394 | 1.00 | box 0.43；rope 0.42；brick 0.34 |
| maxOther | 3 | 0.203 | 0.204 | 0.202 | 1.00 | box 0.17；rope 0.29；brick 0.14 |
| responseLength | 3 | 0.404 | 0.420 | 0.420 | 1.00 | box 0.46；rope 0.40；brick 0.35 |
| pub_glov | 3 | 0.196 | 0.195 | 0.192 | 1.00 | box 0.25；rope 0.32；brick 0.01 |
| pub_tasa | 3 | 0.132 | 0.152 | n/a | 1.00 | box 0.08；rope 0.24；brick 0.08 |
| pub_cbowu | 3 | 0.282 | 0.286 | 0.260 | 1.00 | box 0.34；rope 0.37；brick 0.13 |
| pub_cbows | 3 | 0.283 | 0.271 | 0.255 | 1.00 | box 0.31；rope 0.29；brick 0.25 |
| pub_cboww | 3 | 0.245 | 0.261 | 0.259 | 1.00 | box 0.35；rope 0.27；brick 0.10 |

### 词语联想题目（n = 4984 条人类作答）

| 自动指标 | 题目数 | Fisher 平均 Spearman | Fisher 平均 Pearson | 合并（题内标准化）r | 为正的题目占比 | 各题目 Spearman |
| --- | --- | --- | --- | --- | --- | --- |
| toItem | 67 | 0.279 | 0.243 | 0.250 | 0.91 | horn 0.40；home 0.23；belt 0.43；clay 0.33；shoe 0.10；phone 0.45；key 0.38；blade 0.39；manual 0.07；cafe 0.15；oven 0.60；music 0.24；rock 0.03；drug 0.05；boot 0.30；pan 0.33；golf 0.40；soup -0.25；canoe 0.12；cart 0.26；church 0.38；candle 0.29；taxi 0.47；grass 0.28；tree 0.29；muscle 0.07；hair 0.12；fist 0.37；dish 0.25；shovel 0.52；pillow 0.07；oath 0.18；cannon 0.66；drum 0.30；baby 0.15；glass -0.56；office 0.27；artist 0.24；tongue 0.07；pill 0.35；note 0.44；paper -0.00；house -0.09；lamp 0.26；money 0.51；letter 0.47；snow 0.18；ship 0.52；couch 0.18；ring -0.16；soap 0.05；bucket 0.31；hole 0.50；feet 0.15；infant 0.55；street 0.47；tune 0.16；sofa -0.26；finger 0.33；debt 0.47；bureau 0.60；chamber 0.40；death 0.57；duty 0.34；expert 0.35；hood 0.13；law 0.65 |
| meanKOther | 67 | 0.142 | 0.148 | 0.137 | 0.72 | horn 0.40；home 0.25；belt 0.15；clay -0.43；shoe -0.21；phone 0.14；key -0.07；blade 0.34；manual 0.07；cafe 0.05；oven -0.08；music -0.03；rock -0.14；drug 0.33；boot 0.39；pan -0.05；golf 0.06；soup -0.15；canoe 0.19；cart 0.36；church 0.02；candle 0.49；taxi 0.06；grass 0.30；tree 0.25；muscle 0.19；hair 0.35；fist 0.27；dish 0.12；shovel 0.30；pillow 0.02；oath -0.17；cannon 0.45；drum 0.25；baby 0.45；glass -0.27；office -0.05；artist 0.04；tongue -0.23；pill 0.58；note 0.48；paper 0.13；house 0.19；lamp 0.49；money 0.11；letter 0.42；snow -0.22；ship -0.10；couch 0.08；ring 0.04；soap 0.33；bucket 0.23；hole 0.63；feet 0.20；infant 0.38；street 0.23；tune 0.21；sofa 0.11；finger 0.27；debt -0.31；bureau -0.15；chamber 0.31；death 0.21；duty -0.36；expert -0.07；hood -0.01；law 0.22 |
| minOther | 67 | 0.309 | 0.305 | 0.293 | 0.90 | horn 0.49；home 0.19；belt 0.14；clay 0.27；shoe -0.16；phone 0.38；key 0.03；blade 0.23；manual -0.27；cafe 0.21；oven 0.52；music 0.36；rock 0.03；drug 0.26；boot 0.06；pan 0.07；golf 0.48；soup 0.07；canoe -0.02；cart -0.03；church 0.63；candle 0.24；taxi 0.17；grass 0.28；tree 0.20；muscle 0.44；hair 0.44；fist 0.33；dish 0.48；shovel 0.43；pillow -0.19；oath 0.27；cannon 0.39；drum 0.23；baby 0.28；glass -0.08；office 0.24；artist 0.00；tongue -0.02；pill 0.37；note 0.05；paper 0.42；house 0.21；lamp 0.03；money 0.50；letter 0.30；snow 0.33；ship 0.34；couch 0.27；ring 0.25；soap 0.23；bucket 0.18；hole 0.56；feet 0.71；infant 0.51；street 0.47；tune 0.61；sofa 0.27；finger 0.51；debt 0.51；bureau 0.65；chamber 0.59；death 0.49；duty 0.63；expert 0.50；hood 0.48；law 0.59 |
| meanOther | 67 | 0.337 | 0.320 | 0.307 | 0.93 | horn 0.49；home 0.26；belt 0.23；clay 0.26；shoe -0.23；phone 0.44；key 0.32；blade 0.56；manual 0.05；cafe 0.27；oven 0.60；music 0.33；rock 0.02；drug 0.34；boot 0.38；pan 0.29；golf 0.59；soup -0.29；canoe 0.25；cart 0.40；church 0.28；candle 0.55；taxi 0.45；grass 0.42；tree 0.38；muscle 0.56；hair 0.37；fist 0.50；dish 0.47；shovel 0.29；pillow -0.13；oath 0.02；cannon 0.65；drum 0.40；baby 0.47；glass 0.07；office 0.18；artist 0.37；tongue -0.16；pill 0.57；note 0.48；paper 0.26；house 0.14；lamp 0.45；money 0.31；letter 0.49；snow -0.05；ship 0.42；couch 0.40；ring 0.10；soap 0.39；bucket 0.22；hole 0.67；feet 0.38；infant 0.42；street 0.42；tune 0.50；sofa 0.35；finger 0.60；debt 0.58；bureau 0.38；chamber 0.43；death 0.38；duty 0.12；expert 0.10；hood 0.07；law 0.41 |
| maxOther | 67 | 0.127 | 0.140 | 0.129 | 0.72 | horn 0.39；home 0.28；belt 0.17；clay -0.41；shoe -0.25；phone 0.07；key -0.05；blade 0.34；manual 0.08；cafe 0.07；oven -0.03；music -0.05；rock -0.17；drug 0.37；boot 0.31；pan -0.12；golf 0.01；soup -0.04；canoe 0.22；cart 0.25；church 0.00；candle 0.44；taxi -0.03；grass 0.28；tree 0.28；muscle 0.15；hair 0.28；fist 0.09；dish 0.17；shovel 0.19；pillow 0.02；oath -0.01；cannon 0.32；drum 0.23；baby 0.20；glass 0.35；office 0.20；artist 0.02；tongue -0.21；pill 0.53；note 0.48；paper 0.10；house 0.28；lamp 0.52；money 0.11；letter 0.39；snow -0.17；ship -0.08；couch 0.05；ring -0.05；soap 0.30；bucket 0.16；hole 0.60；feet 0.09；infant 0.43；street 0.18；tune 0.09；sofa 0.04；finger 0.16；debt -0.33；bureau -0.18；chamber 0.28；death 0.22；duty -0.47；expert -0.22；hood -0.00；law 0.16 |
| responseLength | 67 | 0.268 | 0.268 | 0.253 | 0.90 | horn 0.50；home 0.31；belt 0.06；clay 0.39；shoe 0.25；phone 0.42；key 0.63；blade 0.10；manual 0.51；cafe 0.36；oven 0.47；music 0.14；rock 0.21；drug 0.40；boot 0.13；pan 0.34；golf 0.31；soup 0.26；canoe 0.34；cart 0.28；church 0.22；candle 0.52；taxi 0.02；grass 0.49；tree 0.54；muscle 0.37；hair 0.45；fist -0.06；dish 0.36；shovel 0.23；pillow 0.47；oath -0.17；cannon 0.13；drum 0.26；baby 0.62；glass 0.35；office 0.37；artist 0.48；tongue 0.06；pill -0.21；note 0.30；paper 0.31；house 0.27；lamp 0.09；money 0.13；letter 0.35；snow 0.21；ship 0.23；couch 0.30；ring 0.26；soap 0.35；bucket 0.18；hole 0.55；feet 0.23；infant 0.52；street 0.37；tune 0.45；sofa 0.34；finger 0.06；debt 0.49；bureau -0.41；chamber 0.29；death 0.07；duty -0.38；expert -0.33；hood -0.01；law 0.09 |
| pub_glov | 67 | 0.379 | 0.348 | 0.343 | 0.91 | horn 0.60；home 0.24；belt 0.47；clay 0.61；shoe -0.05；phone 0.45；key 0.55；blade 0.35；manual -0.21；cafe 0.12；oven 0.57；music 0.46；rock 0.15；drug 0.51；boot 0.33；pan 0.43；golf 0.62；soup 0.22；canoe -0.06；cart -0.23；church 0.50；candle 0.37；taxi 0.51；grass 0.40；tree 0.46；muscle 0.41；hair 0.52；fist 0.22；dish 0.35；shovel 0.50；pillow -0.22；oath 0.39；cannon 0.61；drum 0.07；baby 0.47；glass -0.12；office 0.27；artist 0.22；tongue 0.06；pill 0.41；note 0.24；paper 0.28；house 0.45；lamp 0.15；money 0.34；letter 0.56；snow 0.38；ship 0.56；couch 0.33；ring 0.10；soap 0.08；bucket 0.20；hole 0.57；feet 0.36；infant 0.63；street 0.65；tune 0.57；sofa 0.21；finger 0.70；debt 0.69；bureau 0.67；chamber 0.39；death 0.41；duty 0.72；expert 0.62；hood 0.21；law 0.46 |
| pub_tasa | 67 | 0.281 | 0.267 | 0.288 | 0.87 | horn 0.58；home 0.23；belt 0.51；clay 0.27；shoe 0.19；phone 0.38；key 0.30；blade 0.35；manual -0.30；cafe 0.08；oven 0.50；music 0.39；rock -0.21；drug 0.15；boot -0.19；pan 0.19；golf 0.15；soup 0.31；canoe -0.21；cart -0.10；church 0.49；candle 0.35；taxi 0.47；grass 0.05；tree 0.12；muscle 0.33；hair 0.45；fist 0.15；dish 0.30；shovel 0.47；pillow 0.29；oath 0.37；cannon 0.51；drum 0.10；baby 0.21；glass -0.28；office 0.29；artist 0.29；tongue 0.17；pill 0.31；note 0.12；paper 0.18；house 0.40；lamp 0.21；money 0.40；letter 0.34；snow 0.37；ship 0.43；couch 0.24；ring -0.01；soap 0.19；bucket 0.54；hole 0.51；feet -0.07；infant 0.60；street 0.32；tune 0.59；sofa -0.07；finger 0.31；debt 0.74；bureau 0.45；chamber 0.22；death 0.27；duty 0.59；expert 0.38；hood 0.22；law 0.47 |
| pub_cbowu | 67 | 0.333 | 0.310 | 0.294 | 0.90 | horn 0.59；home 0.22；belt 0.59；clay 0.13；shoe -0.10；phone 0.37；key 0.49；blade 0.46；manual -0.10；cafe 0.17；oven 0.59；music 0.37；rock -0.06；drug 0.07；boot 0.06；pan 0.20；golf 0.62；soup 0.00；canoe -0.03；cart -0.01；church 0.57；candle 0.29；taxi 0.70；grass 0.34；tree 0.30；muscle 0.47；hair 0.52；fist 0.32；dish 0.27；shovel 0.64；pillow 0.03；oath 0.12；cannon 0.52；drum 0.23；baby 0.18；glass -0.13；office 0.28；artist 0.30；tongue 0.04；pill 0.28；note 0.14；paper 0.16；house 0.18；lamp 0.18；money 0.34；letter 0.50；snow 0.40；ship 0.55；couch 0.42；ring 0.03；soap 0.22；bucket -0.24；hole 0.57；feet 0.45；infant 0.47；street 0.51；tune 0.59；sofa 0.36；finger 0.42；debt 0.67；bureau 0.64；chamber 0.26；death 0.46；duty 0.65；expert 0.37；hood 0.30；law 0.57 |
| pub_cbows | 67 | 0.219 | 0.214 | 0.216 | 0.79 | horn 0.53；home 0.15；belt 0.39；clay 0.40；shoe -0.14；phone 0.32；key 0.19；blade 0.23；manual -0.22；cafe -0.02；oven 0.41；music 0.23；rock -0.38；drug -0.03；boot -0.31；pan 0.10；golf 0.55；soup -0.14；canoe -0.17；cart -0.09；church 0.38；candle 0.19；taxi 0.60；grass 0.26；tree -0.13；muscle 0.32；hair 0.41；fist 0.17；dish 0.16；shovel 0.51；pillow -0.15；oath 0.04；cannon 0.36；drum 0.05；baby 0.08；glass -0.07；office 0.25；artist 0.22；tongue -0.04；pill 0.18；note 0.18；paper 0.17；house 0.03；lamp 0.00；money 0.31；letter 0.28；snow 0.25；ship 0.43；couch 0.34；ring 0.03；soap 0.01；bucket -0.21；hole 0.53；feet 0.27；infant 0.29；street 0.41；tune 0.43；sofa 0.28；finger 0.41；debt 0.52；bureau 0.65；chamber 0.11；death 0.44；duty 0.67；expert 0.36；hood 0.32；law 0.50 |
| pub_cboww | 67 | 0.208 | 0.192 | 0.176 | 0.75 | horn 0.35；home -0.03；belt 0.40；clay 0.32；shoe 0.09；phone 0.33；key 0.30；blade 0.31；manual -0.32；cafe -0.06；oven 0.53；music 0.32；rock -0.40；drug -0.33；boot -0.01；pan 0.25；golf 0.49；soup -0.09；canoe -0.19；cart -0.14；church 0.55；candle 0.02；taxi 0.63；grass 0.13；tree 0.14；muscle 0.21；hair 0.32；fist 0.31；dish 0.16；shovel 0.58；pillow -0.14；oath 0.19；cannon 0.51；drum 0.03；baby -0.03；glass -0.55；office 0.20；artist 0.09；tongue -0.01；pill 0.23；note -0.16；paper 0.09；house -0.20；lamp 0.18；money 0.32；letter 0.38；snow 0.30；ship 0.53；couch 0.22；ring 0.06；soap -0.07；bucket 0.02；hole 0.36；feet 0.31；infant 0.36；street 0.43；tune 0.57；sofa 0.16；finger -0.23；debt 0.61；bureau 0.64；chamber 0.27；death 0.39；duty 0.53；expert 0.52；hood 0.13；law 0.56 |

`pub_glov` 是原论文用 GloVe 词向量算出的语义距离，作为自动指标的参照行：本仓库算的 `toItem` 需要在同一个数量级上。`responseLength` 是作答字数与人类评分的相关，用来检查「长度混入评分」的干扰。

## 2. 发散联想任务（DAT）：人类分布与机器位置

- 人类参与者总数：8998，本次用本仓库的嵌入在本机重算了 2524 人（固定种子抽样）
- 重算分布：均值 39.41，标准差 3.91，中位数 39.50（P10 34.70 ~ P90 44.07）
- 同一批人用原论文 GloVe 分数：均值 78.40；全样本（n = 8998）均值 78.19
- 两套分数相关：Pearson 0.451，Spearman 0.370（n = 2524）
- 效标效度（本仓库重算的 DAT 分 vs 同一批人的人类 AUT 原创性评分）：Spearman 0.094（n = 721）；原论文分数同一关系 Spearman 0.221。两套分数都要能复现「DAT 与 AUT 原创性弱正相关」这一原论文结论。

| 子研究 | n | 本仓库重算均值 | 原论文分数均值 | 相关（Spearman） |
| --- | --- | --- | --- | --- |
| olson-1a | 141 | 39.44 | 78.38 | 0.569 |
| olson-1b | 241 | 39.29 | 78.35 | 0.492 |
| olson-2 | 2142 | 39.42 | 78.40 | 0.347 |

机器在同一个语义空间里的 DAT 分数与人类分布比较（对比运行：`runs/human-compare,runs/main-live`）：

| 任务/配置 | 语言 | 引擎 DAT 分数 | 人类百分位 | Cliff's δ | P(引擎 > 随机一名人类) |
| --- | --- | --- | --- | --- | --- |
| dat-en-7/engine | 英文 | 40.67 | 0.63 | 0.252 | 0.63 |
| dat-en-7/zero-shot | 英文 | 38.96 | 0.44 | -0.113 | 0.44 |
| dat-10/engine | 中文（跨语言） | 43.24 | 0.86 | 0.712 | 0.86 |
| dat-10/self-refine | 中文（跨语言） | 33.56 | 0.06 | -0.878 | 0.06 |
| dat-10/structured-cot | 中文（跨语言） | 41.62 | 0.73 | 0.454 | 0.73 |
| dat-10/zero-shot | 中文（跨语言） | 43.09 | 0.85 | 0.692 | 0.85 |
| dat-7/engine | 中文（跨语言） | 41.04 | 0.67 | 0.332 | 0.67 |
| dat-7/self-refine | 中文（跨语言） | 42.90 | 0.83 | 0.669 | 0.83 |
| dat-7/structured-cot | 中文（跨语言） | 41.97 | 0.76 | 0.528 | 0.76 |
| dat-7/zero-shot | 中文（跨语言） | 41.75 | 0.74 | 0.480 | 0.74 |

人类分布是 2524 名真实参与者用同一嵌入重算出来的；百分位指引擎分数在这批人类分数中的位置。

## 3. 机器想法 vs 同一题目下的人类作答

对比运行：runs/human-compare,runs/main-live。机器想法先用模型压缩成 2~6 个词的短语，再与人类的短语作答在同一嵌入空间里比较；`toItem` 是与题目词（brick/box/rope）的语义距离，人类一列即原始被试的分布。

| 任务/配置 | 语言 | 想法数 | 压缩后平均字数 | 人类平均字数 | 与题目距离（机器均值 → 人类百分位） | Cliff's δ | 与最近人类作答的距离（机器均值 → 百分位） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aut-brick/engine | 中文（跨语言） | 39 | 7.3 | 26.5 | 0.494 → 0.93 | 0.735 | 0.781 → 1.00 |
| aut-brick/self-refine | 中文（跨语言） | 12 | 5.9 | 26.5 | 0.563 → 0.98 | 0.946 | 0.783 → 1.00 |
| aut-brick/structured-cot | 中文（跨语言） | 12 | 5.9 | 26.5 | 0.596 → 0.99 | 0.959 | 0.793 → 1.00 |
| aut-brick/zero-shot | 中文（跨语言） | 12 | 4 | 26.5 | 0.539 → 0.97 | 0.875 | 0.771 → 1.00 |
| aut-brick-en/engine | 英文 | 31 | 7.5 | 26.5 | 0.561 → 0.98 | 0.910 | 0.791 → 1.00 |
| aut-brick-en/zero-shot | 英文 | 12 | 4.3 | 26.5 | 0.554 → 0.98 | 0.945 | 0.775 → 1.00 |
| aut-box-en/engine | 英文 | 34 | 5.2 | 15.1 | 0.561 → 0.99 | 0.979 | 0.746 → 0.99 |
| aut-box-en/zero-shot | 英文 | 12 | 19.8 | 15.1 | 0.394 → 0.76 | 0.441 | 0.650 → 0.50 |
| aut-rope-en/engine | 英文 | 31 | 7.1 | 16.5 | 0.477 → 0.97 | 0.891 | 0.758 → 1.00 |
| aut-rope-en/zero-shot | 英文 | 12 | 3.6 | 16.5 | 0.472 → 0.97 | 0.876 | 0.713 → 1.00 |

## 局限

- 人类数据来自英文被试（美国/英国样本），机器任务是中文与英文两套，跨语言距离没有校准；因此第 3 节只在英文任务（`aut-box-en`、`aut-rope-en`）与 `aut-brick` 上做同题比较。
- 人类评分是 1~5 分的顺序量表，自动距离是连续值；相关系数只说明单调关系强弱，不代表分数可直接换算。
- 本报告不是「超过人类」的证据：它给出的是机器输出在人类分布中的位置（百分位）和自动指标相对人类评分的效度。
