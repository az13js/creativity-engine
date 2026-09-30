# 基准方法：任务、指标、配置与可信度

## 1. 任务套件

所有任务数据位于 [data/](../data/)，由本仓库作为实验材料编写（不是标准化测验）：

| 任务 | 类型 | 测量什么 | 评分方式 |
| --- | --- | --- | --- |
| `aut-brick`、`aut-bottle` | 替代用途测验（AUT, Alternative Uses Test） | 发散思维的流畅性/灵活性/原创性/具体化 | 见 §2.1 |
| `aut-box-en`、`aut-rope-en`、`aut-brick-en` | 与 SemDis 公开人类数据同题的英文 AUT | 同上，并可和同题人类作答直接比较 | 见 §2.1；人类参照见 [human-baseline.md](human-baseline.md) |
| `dat-7`、`dat-10`、`dat-en-7` | 发散联想任务（DAT, Divergent Association Task）风格 | 语义空间的发散程度 | 见 §2.2，采用标准 DAT 计分公式；`dat-en-7` 与公开人类样本同题 |
| `rat-20` | 远距离联想测验（RAT, Remote Associates Test）格式 | 聚合思维（收敛能力）是否被机制损害 | 见 §2.3 |
| `brief-stove`、`brief-box` | 设计简报（带已知方案语料） | 相对已知方案的新颖度 + 可行性 + 多样性 | 见 §2.4 |

材料来源与诚实声明：
- AUT 的对象（砖头、塑料瓶）与"常见答案"参照表由本项目编写，用于定义原创性的参照点；
- DAT 使用标准计分程序（前 7 个有效词、21 对余弦距离、均值 ×100），但使用的嵌入模型是
  本地端点上的 `qwen3-embedding`，不是原论文的 GloVe/Common Crawl，因此**绝对值不可与论文常模直接比较**，
  本报告只做配置间相对比较，并提供随机词基线（`data/dat-items.json` 的 calibration 字段）；
- RAT 的 20 道题按 Mednick (1962) 的题型自行编写（提示词—共同答案），**不是**标准化的 Mednick 题集；
- 设计简报的"已知方案语料"（各 12 条）由本项目编写，代表大众化答案，用于计算新颖度；
- 三个英文 AUT 任务（`aut-box-en`、`aut-rope-en`、`aut-brick-en`）与 `dat-en-7` 的措辞对齐公开人类数据（SemDis；
  Olson et al. 的 DAT），它们的"常见答案"参照表直接取自人类作答里出现频率最高的回答。人类数据、导入流程与比较口径见
  [human-baseline.md](human-baseline.md)。

## 2. 指标定义

### 2.1 AUT 指标
- 有效想法（validity）：长度 2–300 字符、不是对象名称的回显、去重后保留；
- **流畅性 fluency** = 有效且互不重复（token Jaccard < 0.85）的想法条数；
- **灵活性 flexibility** = 词表类别数（`data/aut-items.json` 的 lexicon：建筑/承重/研磨/热学/装饰/…）；
  没有 lexicon 的 AUT 任务（例如三个与人类数据同题的英文任务）改用**聚类回退**：按 0.45 距离阈值做平均连接聚类，
  簇数即灵活性，分数里用 `flexibilitySource` 标出用的是 `lexicon` 还是 `clustering`；
- **原创性 originality** = 每条想法 `1 − 与常见答案参照表的最大余弦相似度`，报告均值与最大值；
- **具体化 elaboration** = min(1, token 数/12) + 机制标记词（因为/通过/利用/…）+ 变化标记词（不同/各种/…）；
- **DT-index** = 0.2×流畅性(归一) + 0.25×灵活性(归一) + 0.4×平均原创性 + 0.15×具体化（本项目定义，权重随分数一起存档）。

### 2.2 DAT 指标
按 Olson et al. (2021) 的标准程序：取生成词中**前 7 个有效且互不重复**的词 → 21 对余弦距离 →
取均值 ×100。另报有效词比例与"相对随机词基线的差值"（随机词基线 = `data/dat-items.json` 中的 12 个常见词，
取自前 7 个）。

### 2.3 RAT 指标
- **strictAccuracy**：从回复中解析 `rat-xx=answer`（或按位置对应）后与答案集精确匹配的比例；
- **passAtK**：只要该题的任意一个候选答案命中即算解出（衡量"候选集合里有正确答案"的能力）。

### 2.4 设计简报指标
- **新颖度 novelty** = 1 − 与已知方案语料的最大余弦相似度（均值与最大值）；
- **可行性 feasibility / 影响 impact** = 由**同一个** LLM 评委对每个配置的想法独立按 0-10 打分后归一（对全部配置使用同一提示词与温度 0，保证公平）；
- **新颖度 × 可行性** = 两列相乘，用于惩罚"新颖但不可行"或"可行但老套"；
- **多样性 diversity** = 想法两两语义距离均值；由于该指标随条数下降，主表使用**固定 12 条抽样**（种子由任务与配置决定）；
- **簇数 clusters** = 平均连接层次聚类（距离阈值 0.45）的簇数；
- **同质化审计 crossConfigDistinctiveness** = 每条想法相对**其它配置**同任务想法的最大相似度的补（均值）；越低说明越容易与别人撞车。

### 2.5 过程指标（仅机制）
每轮记录：新增想法数、平均两两语义距离、平均新颖度、簇数、当前温度；
档案记录：格子数（size）、覆盖率（coverage）、QD-score（各格精英目标值之和）。

## 3. 配置与预算

| 配置 id | 说明 | 预算（每次任务） |
| --- | --- | --- |
| `zero-shot` | 单轮"请给 N 个想法" | 1 次调用 |
| `structured-cot` | 单轮、先列切入口再展开 | 1 次调用 |
| `self-refine` | 生成 → 自我批评 → 重写 | 3 次调用 |
| `engine-flat`（消融） | 4 路并行采样，单一算子/单一角色，无融合、无自适应 | 约 10 次调用 |
| `engine-noadapt`（消融） | 完整异质化 + 融合，关闭升温与元反思 | 约 20 次调用 |
| `engine` | 完整机制（4 生成者 × 3 轮 + 评审 + 2 融合 + 元反思） | 约 20 次调用 |

> 成本不等价是方法学事实：基线更便宜。因此报告同时给出调用次数与 token 量，
> 结论必须与成本一起读；本基准**不**主张"同等成本下比较"。

## 4. 可复现性

```bash
npm test                                        # 32 个单元测试（离线）
node scripts/bench.ts --dry                     # 假模型跑通流水线
node scripts/bench.ts --generations 3 --out runs/main-live
node scripts/bench.ts --tasks aut-brick,brief-box --configs engine,engine-noadapt,engine-flat --out runs/ablation
node scripts/rescore.ts --run runs/main-live    # 只重算分数/报告（可行性评委 + 跨配置审计）
```

- 所有 LLM 调用按 (模型, 消息, 采样参数) 做磁盘缓存（`runs/cache/chat/`），重跑不会重复付费；
- 每次调用记录到 `runs/cache/chat-log.jsonl`（tag、模型、温度、耗时、token）；
- 随机性来源只有种子（`--seed`，默认 20240930）与模型端温度；
- API 端点：环境变量优先，其次本机 OpenCode 配置（密钥不落盘到产物）。

## 5. 统计处理与可信度

- 每个任务只运行一次（单种子），因此**不做显著性检验**；报告逐任务原值与相对差值；
- 汇总表给出跨任务均值 ± 标准差，用于观察方向一致性；
- 自动评分的已知局限：与人类评分的一致性有限（文献中通常报告 κ 或相关系数），
  本报告不把自动分数等同于人类判断；
- 可行性由 LLM 评委给出，存在评委偏好（长度、具体性）；所有配置使用同一评委，只能用于相对比较；
- 嵌入模型的各向异性会压缩无关词对的余弦距离（实测无关词对约 0.5–0.65），因此同时报告随机词基线。

## 6. 结果

见 [runs/main-live/report.md](../runs/main-live/report.md)（主实验）、
[runs/ablation/report.md](../runs/ablation/report.md)（消融）与
[docs/report.md](report.md)（综合结论）。
