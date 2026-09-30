# AI 创造力/想象力机制调研笔记

> 调研日期：2026-09-30（本机环境时间）。主题：为"提示词 + Skill + 多子 Agent 机制复现/超越人类创造力，并用可自动评分的基准验证"提供可测量、可复现、有出处的依据。
>
> **本笔记的证据标注约定**（每条关键结论后给出）：
> - 【实验·强】多研究/大规模实验/系统综述支持；【实验·中】单篇受控实验或基准论文；【实验·弱】小样本、单一任务、仅示范；
> - 【理论】概念性主张（常无直接实证）；【工程】系统实现/工具实践（有效性来自工程报告而非对照实验）。
> - "元数据核实"= 本次通过 Crossref / PubMed / Europe PMC 的机读记录核实了标题、DOI、期刊、年份，但**未打开正文**（付费墙或站点屏蔽）。
> - 所有 URL 均为本次实际请求过的地址；被屏蔽站点与"未能核实"的条目集中列在 §8。

---

## 1. 发散思维（divergent thinking）测验与自动评分

### 1.1 TTCT：四维度说法需要修正

**关键结论**
1. 【实验·强，元数据核实】TTCT（Torrance Tests of Creative Thinking，托兰斯创造性思维测验）最权威的综述是 Kim, K. H. (2006), *Can We Trust Creativity Tests? A Review of the Torrance Tests of Creative Thinking (TTCT)*, Creativity Research Journal 18(1)，DOI <https://doi.org/10.1207/s15326934crj1801_2>。
2. 【实验·中】TTCT 分**言语版（TTCT–Verbal）**与**图形版（TTCT–Figural）**两套，计分维度不同："fluency / flexibility / originality / elaboration 四维度"是常见简化说法，**不能当作两套测验的统一口径**。一篇 2025 年用 TTCT–F 做的实证研究（N=135 名医学生）明确按 **Fluency、Originality、Elaboration、Abstractness of Titles（标题抽象性）** 四个分测验分量 + 合成的 **Creativity Index（创造力指数）** 报告结果。来源（正文经 NCBI E-utilities 全文接口读取）：<https://pmc.ncbi.nlm.nih.gov/articles/PMC12699210/>（MedEdPublish 2025，DOI 10.12688/mep.20889.1）。
3. 【实验·中，负面证据】同一研究中，TTCT–F 的 Creativity Index 与五年 GPA 相关"弱且不显著"；只有 Abstractness of Titles 与 GPA 中等正相关（解释约 8% 方差）。→ 把 TTCT 总分当作"通用创造力/能力"指标时，效标效度证据并不稳固。
4. 【实验·中】TTCT 的 scoring 需要受训评分者按手册计分，人工成本高，这是自动评分研究（AUT/DAT）的直接动因。来源（UConn 国家资优研究中心的评分说明 PDF，本次未解析）：<https://nrcgt.uconn.edu/wp-content/uploads/sites/953/2015/04/rm95222.pdf>。
5. ⚠️ 常见说法"1984 年修订后图形版取消 flexibility 计分"本次**未核实到一手来源**（见 §8），不要写进正式报告。

**对设计的意义**：TTCT 适合做"人类基线/外部效标"，不适合做线上自动评分；自动评分请走 AUT/DAT（§1.2、§1.3）。

### 1.2 AUT（Alternative Uses Test，替代用途测验）的自动评分

**关键结论**
1. 【工程/实验·中】**SemDis**（Beaty, R. E., & Johnson, D. R., 2021, *Automating creativity assessment with SemDis: An Open Platform for Computing Semantic Distance*, Behavior Research Methods 53(2): 757–780）是 AUT 自动语义距离评分的公开平台方案。DOI（元数据核实）：<https://doi.org/10.3758/s13428-020-01453-w>；预印本 DOI：<https://doi.org/10.31234/osf.io/nwvps>；平台地址 <https://semdis.wlu.psu.edu/>（本次抓取失败）。论文摘要点明动机与两个局限："labor cost (raters…)" 与主观性。
2. 【实验·中】**LLM 评分相对纯语义距离明显更贴近人类评分**：Organisciak, P., Acar, S., Dumas, D., Berthiaume, K. (2023), *Beyond semantic distance: Automated scoring of divergent thinking greatly improves with large language models*, Thinking Skills and Creativity, DOI <https://doi.org/10.1016/j.tsc.2023.101356>（元数据核实；正文付费墙未打开）。**结论方向由标题给出：LLM 评分大幅优于只用语义距离**；具体相关系数本次未核实，引用时请只给方向、不要编造 r 值。
3. 【实验·中】工程上常见的三条 AUT 自动评分路径：① **统计稀有度（statistical rarity / frequency-based originality）**：统计每个答案在样本中的出现频率，越低分越高；② **语义距离（semantic distance）**：答案与提示词/其他答案的 embedding 距离（与 §1.3 的 DAT 公式同源）；③ **LLM-as-judge**：用大模型按 novelty/usefulness 打分。其中 ①② 是"新颖性"代理，**不度量 usefulness/appropriateness**。①的原始方法文献本次未核实（§8），但 ②③ 有上述两篇支撑。
4. 【理论】自动评分要报告**评分者一致性**，常用门槛是 Cohen's κ / Landis & Koch (1977) 的经验区间（Biometrics 33(1)，DOI <https://doi.org/10.2307/2529310>，元数据核实）：κ 0.61–0.80 为 substantial、0.81–1.00 为 almost perfect。任何"自动评分替代人工"的主张都应给出该证据。

### 1.3 DAT（Divergent Association Task，发散联想任务）：公式与效度

**计分公式（逐字核实）**
> "we compute the semantic distance (i.e., cosine distance) between all 21 possible pairs of the seven words, take the average, and then multiply it by 100."

- 任务：让被试说出 **10 个彼此尽可能不同的词**；评分时只保留前 **7 个**合法词 → 全部 **C(7,2)=21** 个词对 → 每对算 **cosine distance（= 1 − cosine similarity）** → 取平均 → **×100**。
- 取值范围：0（所有词相同）到 200（理论最大）；实际个体分数远低于上限。
- 词向量：**GloVe**（Pennington et al. 2014），论文使用 **Common Crawl** 预训练模型；选择理由是作者报告该组合在 AUT 上与人类判断相关性最好。
- 官方算法代码：<https://osf.io/bm5fd/>（论文内引用；本次未抓取）。

**效度证据（作为整体）**【实验·中→强】
- 样本：摘要称 **8,914 名参与者**，Study 2 覆盖 **98 个国家**；人口学变量对 DAT 分数影响很小。
- Study 1 与两个传统创造力测量的相关（AUT 分量，全样本、未人工筛选）：**flexibility r = 0.34 [0.18, 0.48]；originality r = 0.32 [0.16, 0.46]；fluency r = 0.22 [0.06, 0.37]**；手动筛选后 fluency 相关不显著（r(55)=0.21, P=0.057）。
- 摘要原句："semantic distance correlated at least as strongly with established creativity measures as those measures did with each other."（DAT 与既有测验的相关，不低于这些测验彼此之间的相关。）
- 结论句："Naming unrelated words in what we call the Divergent Association Task can thus serve as a brief, reliable, and objective measure of divergent thinking."
- 全部来源：Olson, Nahas, Chmoulevitch, Cropper, Webb (2021), *Naming unrelated words predicts creativity*, PNAS, DOI <https://doi.org/10.1073/pnas.2022340118>；OA 全文 PMC8237676（本次经 E-utilities 读取）：<https://pmc.ncbi.nlm.nih.gov/articles/PMC8237676/>。

**延伸**【工程/实验·中】S-DAT（Synthetic-DAT）：多语言、用 LLM 生成/评分的 DAT 变体，Haase, Hanel, Pokutta, arXiv:2505.09068：<https://arxiv.org/abs/2505.09068>。

### 1.4 RAT（Remote Associates Test，远距离联想测验）：形式与公开数据

**形式**【理论·强，元数据核实】Mednick, S. A. (1962), *The associative basis of the creative process*, Psychological Review 69(3)，DOI <https://doi.org/10.1037/h0048850>：创造力被视为**联想层级（associative hierarchy）**的函数——"平缓联想层级"者更容易检索到远距离概念。
**当代实现**：给 3 个线索词（如 cottage / swiss / cake），要求说出与三者都能组成常见搭配的第 4 个词（cheese）。

**公开数据（关键结论）**
1. 【实验·强，元数据核实】标准题集与规范数据：Bowden, E. M., & Jung-Beeman, M. (2003), *Normative data for 144 compound remote associate problems*, Behavior Research Methods, Instruments, & Computers 35(4): 634–639，DOI <https://doi.org/10.3758/bf03195543>（PubMed 14748508）。**144 个 CRA（Compound Remote Associate）题目 + 各题正确率/解出时间**是事实标准，许多实验直接引用该表。
2. 【实验·中】面向大样本的**多选题版 CRAT**：Mather, K. A., Weston, S. J., Condon, D. M. (2024), *Scaling a common assessment of associative ability: Development and validation of a multiple-choice compound remote associates task*, Behavior Research Methods 56(7)，DOI <https://doi.org/10.3758/s13428-024-02422-3>（Europe PMC 摘要核实，PMID 38839705）。摘要指出过往 CRA 研究"open response format and relatively small participant samples"，该文开发并验证了适合大规模施测的多选版本。
3. ⚠️ 本次**没有核实到**一个可稳定下载的"官方 RAT 题库压缩包"URL（GitHub 在本环境不可达，OSF 搜索接口 404）。工程建议：以 Bowden & Jung-Beeman (2003) 的表为源手工建库，并在论文/README 中声明来源与许可；不要声称存在"官方开源数据集"。

---

## 2. 语义距离 / 嵌入资源

### 2.1 预训练词向量（可离线）

| 资源 | 本次核实的具体内容 | URL |
|---|---|---|
| **GloVe** | 官网给出下载矩阵：glove.6B（Wikipedia 2014 + Gigaword 5，6B tokens，400K 词表，822 MB，含 50/100/200/300d）；glove.42B.300d（Common Crawl 42B tokens，1.9M 词表，1.75 GB）；glove.840B.300d（840B tokens，2.2M 词表，2.03 GB） | <https://nlp.stanford.edu/projects/glove/> |
| **fastText** | 官方 157 语言 300 维向量，字符 n-gram 长度 5、窗口 5、10 negatives；中文用 Stanford word segmenter 分词；**CC BY-SA 3.0**；提供 `./download_model.py zh` 命令行/Python 下载 | <https://fasttext.cc/docs/en/crawl-vectors.html> |
| **word2vec（Google News 300d）** | 经典资源，托管在已归档的 Google Code 页面；**本次未核实可访问性**（§8） | — |
| **sentence-transformers（句向量）** | 通过 hf-mirror 可下载；示例模型页返回 200 | <https://hf-mirror.com/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2> |

### 2.2 国内镜像：hf-mirror 的准确用法【工程·强】

hf-mirror 首页直接给出（本次抓取核实）：
1. 网页下载：在 hf-mirror.com 搜索模型/数据集，在 Files and Version 中下载；
2. 命令行：
   - `pip install -U huggingface_hub`
   - Linux：`export HF_ENDPOINT=https://hf-mirror.com`（Windows PowerShell：`$env:HF_ENDPOINT = "https://hf-mirror.com"`）
   - `huggingface-cli download --resume-download gpt2 --local-dir gpt2`
   - `huggingface-cli download --repo-type dataset --resume-download wikitext --local-dir wikitext`
   - 可加 `--local-dir-use-symlinks False`。
   来源：<https://hf-mirror.com/>。
3. 模型检索可用镜像的 API（本次核实返回 JSON）：<https://hf-mirror.com/api/models?search=glove>，其中可见 `DataikuNLP/average_word_embeddings_glove.6B.300d`、`Gensim/glove-twitter-25` 等。
4. ⚠️ 直连 `huggingface.co` 与 `github.com` 在本环境**失败**；`hf-mirror.com` 正常。因此凡"从 HF 拉模型"的脚本，**必须在文档里写死 `HF_ENDPOINT` 或在代码里 `os.environ["HF_ENDPOINT"]=...`**，否则复现会挂。

### 2.3 不依赖预训练模型的三种替代

1. **共现 PMI / 关联比率**【理论·强】Church, K. W., & Hanks, P. (1990), *Word Association Norms, Mutual Information, and Lexicography*, Computational Linguistics 16(1)，ACL Anthology 页面核实：<https://aclanthology.org/J90-1003/>。
   工程做法：在语料上算 `PMI(w1,w2)=log[P(w1,w2)/(P(w1)P(w2))]`，或 **PPMI + SVD** 得到低维向量，再用余弦距离。方法学对照（SGNS ≈ 隐式矩阵分解）：Levy & Goldberg, *Neural Word Embedding as Implicit Matrix Factorization*, NeurIPS 2014（**本次未核实到可访问的官方页面**，§8）。
2. **WordNet 路径相似度**【工程·强】NLTK 文档逐字核实了四类函数：`path_similarity`（is-a/hypernym 拓扑中最短路径，0–1，默认 simulate_root 会补一个假根）、`lch_similarity`（Leacock–Chodorow：路径 + 分类学最大深度）、`res_similarity`（Resnik：需要 Information Content 语料统计）、`wup_similarity`（Wu–Palmer）。来源：<https://www.nltk.org/howto/wordnet.html>。
   适用：词级、可解释、完全离线；缺点：只有名词/动词有较完整层级，跨词性差。
3. **TF-IDF 余弦**【工程·强】scikit-learn 官方文档给出定义 `tf-idf(t,d) = tf(t,d) × idf(t)`，默认 `TfidfTransformer(norm='l2', use_idf=True, smooth_idf=True, sublinear_tf=False)`，并给出与教科书 idf 写法的差异。来源：<https://scikit-learn.org/stable/modules/feature_extraction.html>。

### 2.4 中文资源（存在性提示）
- Chinese-Word-Vectors（Li et al., ACL 2018, *Analogical Reasoning on Chinese Morphological and Semantic Relations*，Anthology 页面核实）：<https://aclanthology.org/P18-2023/>；其 GitHub 仓库（`Embedding/Chinese-Word-Vectors`）**本环境不可抓取**。
- 腾讯 AI Lab 中文词向量：官方页面本次只返回空壳（§8），**引用前请自行复核**。
- 实践建议：若只要 DAT 式评分，可直接用 fastText 中文向量（§2.1）或自训 PPMI 向量（§2.3），避免依赖不可达站点。

---

## 3. LLM 创造力增强的提示工程：实验证据盘点

> 总原则：**"有效"的绝大多数证据来自推理/事实性任务；直接测"创意产出质量"的对照实验少得多。** 下表按证据强度排序。

### 3.1 persona / 多角色提示
- 【实验·中，负面结果】*When "A Helpful Assistant" Is Not Really Helpful: Personas in System Prompts Do Not Improve Performances of Large Language Models*，Findings of EMNLP 2024（页面核实）：<https://aclanthology.org/2024.findings-emnlp.888/>。系统提示里的人设（persona）在该文评测中没有带来性能提升。
- 【实验·弱】*Principled Personas: Defining and Measuring the Intended Effects of Persona Prompting on Task Performance*（EMNLP 2025 主会，检索页可见，本次未打开正文）：<https://aclanthology.org/2025.emnlp-main.1364/>。
- 结论：**"多角色"是工程常用手段，但作为"提升创意"的独立变量缺乏正面证据**；不能把它当作已验证的增益来源。

### 3.2 chain-of-thought（CoT）与 self-consistency（自洽性投票）
- 【实验·强（限推理任务）】Wei et al. 2022, *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models*, arXiv:2201.11903：<https://arxiv.org/abs/2201.11903>。证据来自算术、常识、符号推理。
- 【实验·强（限推理任务）】Wang et al. 2022, *Self-Consistency Improves Chain of Thought Reasoning in Language Models*, arXiv:2203.11171：<https://arxiv.org/abs/2203.11171>。采样多条推理路径再投票。
- ⚠️ **外推风险**：这两篇都没有测"创意/发散思维"指标。把 CoT 当创造力增强手段属于**未验证外推**；在自建基准里必须作为对照条件单独度量。

### 3.3 temperature / 采样多样性
- 【实验·中，最直接的证据】Peeperkorn, Kouwenhoven, Brown, Jordanous (2024), *Is Temperature the Creativity Parameter of Large Language Models?*，arXiv:2405.00492：<https://arxiv.org/abs/2405.00492>。逐字核实的关键结论：
  > "We find that temperature is weakly correlated with novelty, and unsurprisingly, moderately correlated with incoherence, but there is no relationship with either cohesion or typicality."
  以及作者的要点：温度**并不能**让模型利用 embedding 空间的不同区域；只有在样本量有限时带来一点新颖性；温度与创造力之间的关系"far more nuanced and weak than suggested by the 'creativity parameter' claim"。
  → **不要把"调高 temperature"当成创造力开关**；它更接近"新颖性微升 + 不连贯性上升"。
- 【实验·中】min-p 采样：*Turning Up the Heat: Min-p Sampling for Creative and Coherent LLM Outputs*，ICLR 2025（会议页面核实）：<https://proceedings.iclr.cc/paper_files/paper/2025/hash/afa5f124e36bed5cc2125067005d43f5-Abstract-Conference.html>。作为 top-p/top-k 的替代，目标是"高温下仍保持连贯"。
- 【工程】采样多样性更适合用**多次独立采样后去重/聚类**来度量（见 §7 的 NoveltyBench/Vendi 指标），而不是只报告多样性参数。

### 3.4 约束与"随机刺激"（random stimulus）
- 【实验·中】约束可以提升创意：Haught-Tromp, C. (2016), *The Green Eggs and Ham Hypothesis: How Constraints Facilitate Creativity*, Psychology of Aesthetics, Creativity, and the Arts 10(1): 10–17，DOI <https://doi.org/10.1037/aca0000061>（元数据核实；结论方向由题名给出，具体效应量未核实）。
- 【工程/理论·弱】"随机刺激/随机词"（如 Oblique Strategies 类卡片）在工业界常用，但**本次未核实到受控实验**支持其独立增益。建议在自己基准里把它作为消融项，而不是先验有效项。
- 提示：约束的实证价值可能在"缩小搜索空间、提高可行性"，而非"提高新颖性"——这正是 novel vs. useful 的权衡（§6.2）。

### 3.5 类比迁移（analogy transfer）与 structure mapping
- 【实验·中】Webb, T., Holyoak, K. J., Lu, H., *Emergent Analogical Reasoning in Large Language Models*，arXiv:2212.09196（v3）：<https://arxiv.org/abs/2212.09196>。摘要逐字：把 **GPT-3（text-davinci-003）与人类**在一系列类比任务（含基于瑞文标准推理测验规则结构的非视觉矩阵推理）上直接对比，发现"GPT-3 displayed a surprisingly strong capacity for abstract pattern induction"。期刊版（Nature Human Behaviour 2023）DOI 元数据核实：<https://doi.org/10.1038/s41562-023-01659-w>。
- 【实验·中】*Large Language Models as Analogical Reasoners*（analogical prompting，让模型自己生成相关类比/示例），arXiv:2310.01714：<https://arxiv.org/abs/2310.01714>。证据是推理类任务；用于创意任务需自行验证。
- 理论根基（structure mapping / 结构映射）：Gentner, D. (1983), *Structure-mapping: A theoretical framework for analogy*，Cognitive Science 7(2)（本笔记**未核实**该 DOI，仅作为理论背景列出）。

### 3.6 SCAMPER 与 TRIZ
- 【理论/工程】SCAMPER（Eberle, R. F., 1971/1996，*SCAMPER: Games for Imagination Development*）与 TRIZ（Altshuller, G., 1984，*Creativity as an Exact Science*）都是**结构化的启发式清单法**，原始文献是书籍、本次未核实到可访问页面（§8）。
- 【实验·中，LLM 集成】iDesignGPT（*iDesignGPT enhances conceptual design via large language model agentic workflows*, Nature Communications 2026, DOI <https://doi.org/10.1038/s41467-026-68672-1>，PMID 41577703；摘要经 Europe PMC 核实）把形态分析、仿生设计、头脑风暴、**SCAMPER**、**TRIZ** 串成 agent 流水线，并报告在 6 个公开设计挑战上"competitive novelty and consistently higher originality and modularity than GPT-4o zero-shot, GPT-4o chain-of-thought and Deepseek-r1, based on metrics and expert assessments"。→ SCAMPER/TRIZ 在 LLM 工作流中有**中等强度**的正向对照证据（单篇、任务特定）。

### 3.7 头脑风暴的对照证据（人类基线）
- 【实验·强】Mullen, B., Johnson, C., Salas, E. (1991), *Productivity Loss in Brainstorming Groups: A Meta-Analytic Integration*, Basic and Applied Social Psychology 12(1)，DOI <https://doi.org/10.1207/s15324834basp1201_1>（元数据核实）：**名义组（nominal groups，独立产出后拼合）在数量与质量上优于面对面头脑风暴组**（productivity loss）。
  → 对多 Agent 设计的直接含义：**"多 agent 独立产出 + 后期汇聚"应当作为默认结构**，而不是让 agent 互相实时对话（对应 §4.4 的辩论证据）。

### 3.8 LLM 创意产出 vs 人类
- 【实验·中】Girotra, K., Meincke, L., Terwiesch, C., Ulrich, K. T., *Ideas are Dimes a Dozen: Large Language Models for Idea Generation in Innovation*，SSRN 工作论文，DOI <https://doi.org/10.2139/ssrn.4457677>（Crossref 元数据核实；正文未打开）。引用时只描述其研究问题（LLM 生成创新创意的数量与质量），不要引具体百分比。

---

## 4. 多 Agent 创意/科学发现框架

### 4.1 Google 的 AI co-scientist
- 【工程/实验·中】arXiv 论文：*Towards an AI co-scientist*（v1, 2025-02-26；**v2 改题为** *Accelerating scientific discovery with Co-Scientist*，2026-06-29 修订）：<https://arxiv.org/abs/2502.18864>。
- 【实验·中，同行评审版】Nature 论文（Crossref 元数据核实：Nature，2026-07-09 印刷版，含摘要正文）：DOI <https://doi.org/10.1038/s41586-026-10644-y>。页面：<https://link.springer.com/article/10.1038/s41586-026-10644-y>（本环境重定向到登录页，未打开正文）。
- **架构（arXiv v1 正文逐字核实）**：一组专职 agent ——
  - **Generation agent**：探索文献、综合发现、生成初始假设与提案，并进行 "simulated scientific debates" 迭代改进；
  - **Reflection agent**：扮演同行评审者，审查正确性/质量/新颖性；
  - **Ranking agent**：通过**成对比较（pairwise comparisons）+ 模拟科学辩论**做锦标赛式排序；
  - **Proximity agent**：异步计算假设的**邻近图**，做聚类、去重与假设空间探索；
  - **Evolution agent**：迭代改进假设；
  - **Meta-review agent**：高层综合。
  原文："specialized agents — Generation, Reflection, Ranking, Evolution, Proximity (which evaluates relatedness), Meta-review (which provides high level analysis) — to continuously generate, debate, and evolve research hypotheses within a tournament framework"；并称有 "self-play based scientific debate step"。
  ⚠️ 具体排序算法细节（如 Elo 式分数、"hypotheses are more likely to be compared with similar ones"）**只在检索片段中出现，本次未打开 Nature 正文核实**（§8）。
- **验证（摘要逐字）**：在三个生物医学方向（drug repurposing、novel target discovery、抗微生物耐药机制解释）验证；"Co-Scientist helped identify new drug repurposing candidates and synergistic combination therapies for acute myeloid leukemia, which were validated through in vitro experiments"。论文 157 页（正文 42 页 + 附录 115 页）。
- **可复用要点**：① 生成/评审/排序**角色分离**；② **锦标赛 + 邻近图**同时优化"质量"与"探索覆盖"；③ 用 test-time compute 扩展（更多轮次 → 更好假设）是核心主张；④ 最终判定必须落到**外部实验**（in vitro），而不是 LLM 自评。

### 4.2 Quality-Diversity（QD）算法
- 【理论/实验·强】MAP-Elites（Multi-dimensional Archive of Phenotypic Elites）：Mouret & Clune, *Illuminating search spaces by mapping elites*, arXiv:1504.04909：<https://arxiv.org/abs/1504.04909>。正文逐字核实的指标定义：**Coverage** = "Measures how many cells of the feature space a run of an algorithm is able to fill of the total number that are possible to fill"（行为/描述空间中被填满的格子比例）；QD 算法先设定描述子空间（descriptor space），再在每个格子里保留最优个体——**放弃了"只找单一最优解"的目标**。
- 【理论·强】统一框架：Cully & Demiris, *Quality and Diversity Optimization: A Unifying Modular Framework*, IEEE TEVC 2018（arXiv:1708.09251）：<https://arxiv.org/abs/1708.09251>。摘要逐字：该框架覆盖 **MAP-Elites** 与 **Novelty Search with Local Competition（NSLC）** 两大族，并提出新的选择机制；质量由"coverage of the descriptor space"与"global quality of the solutions that are kept in the collection"共同定义。
- 【理论·强】Novelty search：Lehman & Stanley (2011), *Abandoning Objectives: Evolution Through the Search for Novelty Alone*, Evolutionary Computation 19(2)，DOI <https://doi.org/10.1162/EVCO_a_00025>（元数据核实）。核心论证：在有"欺骗性（deception）"的目标函数上，直接优化目标会误导搜索，**只优化新颖性反而找到目标**。
- **对设计的意义**：把"创意"形式化为**双目标**——质量分（可自动评分）+ 描述子空间覆盖率（多样性/新奇性），并用 archive 保存"每格最佳"，而不是只留 top-k。

### 4.3 LLM + 演化搜索（把 QD 用在文本/代码创意上）
| 系统 | 类型 | 核实内容 | URL |
|---|---|---|---|
| **AlphaEvolve** | 工程/实验·中 | 演化式 coding agent：LLM 直接改写代码，多代进化；报告在数学与计算机科学问题中发现 "novel, provably correct algorithms"；arXiv:2506.13131 | <https://arxiv.org/abs/2506.13131> |
| **FunSearch** | 实验·强 | Nature 2024（DOI 元数据核实，含摘要）：用 LLM 与自动评估器共同搜索程序空间；Crossref 摘要开头 "Large language models (LLMs) have demonstrated tremendous capabilities in solving complex tasks…" | <https://doi.org/10.1038/s41586-023-06924-6> |
| **OpenEvolve** | 工程 | PyPI 包页面核实；包描述中出现 MAP-Elites 岛屿调度/`PopulationStrategy(replace_cell=...)` 等 API；GitHub 仓库本环境不可达 | <https://pypi.org/project/openevolve/> |
| **Heuresis** | 实验·中 | arXiv:2606.25198 *Search Strategies for Autonomous AI Research Agents Across Quality, Diversity and Novelty*：把研究流程抽象为可组合基元，并同时优化 quality/diversity/novelty 三种搜索策略 | <https://arxiv.org/abs/2606.25198> |

**设计要点**：LLM 提供"有知识的变异算子（mutation operator）"，自动评分器提供"适应度（fitness）"，QD archive 提供多样性约束——这三件套已被 AlphaEvolve/FunSearch 在可验证任务上证明有效；搬到开放式创意任务时，fitness 的可信度成为瓶颈（§6.3）。

### 4.4 多智能体辩论 / 评审对想法质量的影响
- 【实验·中，正面】Du, Y., Li, S., Torralba, A., Tenenbaum, J. B., Mordatch, I., *Improving Factuality and Reasoning in Language Models through Multiagent Debate*，arXiv:2305.14325：<https://arxiv.org/abs/2305.14325>。
- 【实验·中，正面（且直接面向发散思维）】Liang, T., He, Z., Jiao, W., et al., *Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate*，arXiv:2305.19118：<https://arxiv.org/abs/2305.19118>。正文逐字核实的机制：多个 agent 以 "tit for tat" 方式辩论（**affirmative/"devil"** 与 **negative/"angel"** 两方），由 **judge** 裁决；作者称其框架 "encourages divergent thinking in LLMs"；动机是自反思（self-reflection）会陷入 **Degeneration-of-Thought (DoT)**；在常识机器翻译与反事实推理两个数据集上做实验。
- 【实验·中，负面/条件性】Wang, Q., Wang, Z., Su, Y., Tong, H., Song, Y., *Rethinking the Bounds of LLM Reasoning: Are Multi-Agent Discussions the Key?*，arXiv:2402.18272：<https://arxiv.org/abs/2402.18272>。摘要：重新评估"多 agent 讨论提升推理"的说法，发现**单 agent 在配备同等机制时表现可比**。
- 【实验·中，负面/基准】Smit, A., Duckworth, P., Grinsztajn, N., Barrett, T. D., Pretorius, A., *Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs*，arXiv:2311.17371（ICML 2024 会议论文，DOI 10.5555/3692070.3693936）：<https://arxiv.org/abs/2311.17371>。系统基准多种辩论与提示策略，考察影响因素；**结论细节本次未逐字核实**（§8）。
- 【实验·中，失败模式】Cemri, M., et al., *Why Do Multi-Agent LLM Systems Fail?*，arXiv:2503.13657：<https://arxiv.org/abs/2503.13657>。摘要逐字："their performance gains on popular benchmarks are often minimal"；构建 MAST-Data（**1600+ 条标注轨迹**，覆盖 **7 个流行 MAS 框架**）。
- 【实验·中，廉价增益】*More Agents Is All You Need*，arXiv:2402.05120：<https://arxiv.org/abs/2402.05120>。"simply via a sampling-and-voting method, the performance of LLMs scales with the number of agents instantiated"——即：**多 agent 的增益可能主要来自采样+投票，而非"辩论"本身**。
- **综合判断**：多 agent 的**独立采样 + 去重/投票/锦标赛**有较稳证据；**实时互辩**的增益高度依赖配置，且存在退化（DoT）与失败模式（MAST）。若目标是创意产出，优先做"独立探索 + 结构化评审/排序"（与 §3.7 的人类头脑风暴证据一致）。

---

## 5. 认知科学理论基础（只保留可靠出处）

### 5.1 Wallas 四阶段（准备–孕育–启发–验证）【理论·强】
- 术语与阶段：**preparation（准备）→ incubation（孕育）→ illumination（启发）→ verification（验证）**。原始出处为 Wallas, G. (1926), *The Art of Thought*（书籍；archive.org 在本环境不可达，§8）。
- 本次逐字核实的二手表述（OA 论文）："Graham Wallas proposed a four-stage theory of the creative process describing how original ideas form. These stages are preparation, incubation, illumination, and verification." 来源：*Attention unleashed: Creative therapy for thoughtful transformation*, iScience 2026, DOI <https://doi.org/10.1016/j.isci.2026.115387>（PMC13098521，正文经 E-utilities 读取）。
- 孕育效应的实证支持（**meta 分析**）：Sio, U. N., & Ormerod, T. C. (2009), *Does incubation enhance problem solving? A meta-analytic review*, Psychological Bulletin 135(1): 94–120，DOI <https://doi.org/10.1037/a0014212>（Europe PMC 元数据核实；**具体效应量未核实**）。

### 5.2 Koestler 的 bisociation（双联想）【理论·中】
- 出处：Koestler, A. (1964), *The Act of Creation*（书籍；本次未核实到可访问页面）。
- 定义（本次逐字核实的引用性表述）：创造性行为是把一个想法**同时连接到两个通常不相容的"矩阵/思维平面"**，Koestler 称之为 "bisociation"——"a clash between habit and insight"，新意义在习惯与洞见冲突处涌现。来源：*Oceanic states of consciousness—an existential-neuroscience perspective*, Frontiers in Human Neuroscience 2025, DOI <https://doi.org/10.3389/fnhum.2025.1653801>（PMC12375664，正文经 E-utilities 读取）。
- 评价：**概念性很强、可操作化很弱**；工程上可近似为"强制跨领域配对"（把 A 领域机制映射到 B 领域问题），但不要声称 bisociation 本身有实证效度。

### 5.3 Fauconnier & Turner 的概念融合（conceptual blending / integration）【理论·强】
- 一手论文：Fauconnier, G., & Turner, M. (1998), *Conceptual Integration Networks*, Cognitive Science 22(2): 133–187，DOI <https://doi.org/10.1207/s15516709cog2202_1>（Crossref 摘要逐字核实）："Conceptual integration—'blending'—is a general cognitive operation on a par with analogy, recursion, mental modeling, conceptual categorization, and framing."
- 标准描述（四空间模型）：两个**输入空间（input spaces）** + 一个**类属空间（generic space）** + 一个**融合空间（blended space）**，融合空间包含**涌现结构（emergent structure）**。该四空间细节来自作者 2002 年著作 *The Way We Think*（本次未逐字核实，标注为理论描述）。

### 5.4 默认模式网络（DMN）与创造性认知【实验·中】
- Beaty, R. E., Benedek, M., Silvia, P. J., Schacter, D. L. (2016), *Creative Cognition and Brain Network Dynamics*, Trends in Cognitive Sciences 20(2)，DOI <https://doi.org/10.1016/j.tics.2015.10.004>（元数据核实）。核心理论主张：创造性认知依赖 **默认模式网络（DMN）**、**执行控制网络（ECN）** 与 **突显网络（salience network）** 的协同（DMN 生成候选，ECN 评估/约束）。
- Beaty, R. E., et al. (2018), *Robust prediction of individual creative ability from brain functional connectivity*, PNAS 115(5)，DOI <https://doi.org/10.1073/pnas.1713532115>（元数据核实；**具体预测相关与样本量未核实**）。标题级结论：静息态功能连接可个体化预测创造力表现。
- ⚠️ 引用纪律：不要把"DMN = 创造力中枢"写成定论；现有证据支持的是**网络间协同**，且 fMRI 创造力研究的可复现性仍受批评（本次未核实具体复现研究，故不展开）。

### 5.5 Mednick 的联想理论【理论·强】
- Mednick, S. A. (1962), *The associative basis of the creative process*, Psychological Review 69(3): 220–232，DOI <https://doi.org/10.1037/h0048850>（元数据核实）。核心概念：**associative hierarchy（联想层级）**；"平缓层级（flat hierarchy）"更容易产生远距离联想，是 DAT/RAT 类测验的理论来源。

---

## 6. 已知的反面证据与风险

### 6.1 同质化（homogenization）与模式坍塌（mode collapse）
1. 【实验·强】Doshi, A. R., & Hauser, O. P. (2024), *Generative AI enhances individual creativity but reduces the collective diversity of novel content*, Science Advances 10(28)，DOI <https://doi.org/10.1126/sciadv.adn5290>；OA 全文 PMC11244532（本次经 E-utilities 读取）。**逐字核实的数字**：
   - 两个"用 GenAI 取灵感"条件下，**88.4% 的参与者至少调用一次 AI** 生成初始故事点子；
   - 有用性（usefulness）分别**提高 5.5% 与 11.5%**（1 个 vs 5 个 AI 点子条件）；
   - 低 DAT 分数的作者在"5 个 AI 点子"条件下：写作质量最高 **+26.6%**、趣味性 **+22.6%**、无聊程度 **−15.2%**，达到高 DAT 作者水平；
   - **但**："generative AI–enabled stories are more similar to each other than stories by humans alone"；论文称之为 social dilemma：个体变好、集体新颖性收窄（"the collective novelty of stories may be reduced further"）。
2. 【实验·中】Anderson, B. R., Shah, J. H., Kreminski, M. (2024), *Homogenization Effects of Large Language Models on Human Creative Ideation*（arXiv:2402.01536，v2）：<https://arxiv.org/abs/2402.01536>。**36 人对照用户研究**：与 ChatGPT 协作的用户，其想法在不同用户之间**语义上更不区分**（"different users tended to produce less semantically distinct ideas with ChatGPT than with an alternative CST"），但同时生成更多、更详细的想法，且**对想法的责任感更低**。
3. 【实验·强（基准规模）】*Artificial Hivemind: The Open-Ended Homogeneity of Language Models (and Beyond)*，NeurIPS 2025 Datasets & Benchmarks（arXiv:2510.22954）：<https://arxiv.org/abs/2510.22954>。逐字核实：提出 **Infinity-Chat**（26k+ 开放查询的层级分类，58.0% 属 Creative Content Generation，15.2% 属 Brainstorming & Ideation），收集 **31,250 条人类标注**、每条查询–回答 **25 名独立标注者**；结论是模式坍塌呈两种形态——**intra-model repetition（同模型内重复）** 与 **inter-model homogeneity（跨模型同质）**；并发现 LM/reward model/LLM judge 在评估"质量相当的不同回答"时**校准不良（miscalibrated）**。
4. 【实验·中】*NoveltyBench*（arXiv:2504.05228，v2）：<https://arxiv.org/abs/2504.05228>。评测 **20 个领先模型**：当前 SOTA 系统的多样性**显著低于人类写作者**；逐字："larger models within a family often exhibit less diversity than their smaller counterparts"；并指出评测范式问题："In an analysis of 67 benchmark papers published at COLM 2024 and ICLR 2025, we found that over 90% of these papers evaluate language models based on a single/best generation"。
5. 【理论/工程·中】多样性度量工具：**Vendi Score**（Friedman & Dieng, arXiv:2210.02410）：<https://arxiv.org/abs/2210.02410>，把多样性定义为"**有效不同项数量（effective number of distinct items）**"，可用任意相似度核。

### 6.2 新颖性（novelty）与价值/可行性（usefulness/feasibility）的权衡
- 【理论·强】创造力的标准定义包含**原创性 + 适用性**两项：Runco, M. A., & Jaeger, G. J. (2012), *The Standard Definition of Creativity*, Creativity Research Journal 24(1)，DOI <https://doi.org/10.1080/10400419.2012.650092>（元数据核实）。
- 【实验·中】上文的 Doshi & Hauser 同时报告 novelty 与 usefulness 效应，且**集体新颖性下降**；温度研究（§3.3）显示"新颖性↑伴随不连贯性↑"。→ **任何只优化新颖性的自动评分，都会奖励噪声。** 设计上必须双列评分（novelty + usefulness/feasibility），并报告二者相关。
- 【工程】iDesignGPT（§3.6）用"novelty 竞争性 / originality 与 modularity 更高"+"专家评估"两类指标，是可行的双轨范式。

### 6.3 自动评分与人类评分的一致性
- 【实验·中】SemDis（Beaty & Johnson 2021，§1.2）与 Organisciak et al. 2023 是两条主轴：**embedding 语义距离** → **LLM 评分**。后者标题即"greatly improves"。
- 【实验·中，警示】**LLM judge 自身校准不良**：Artificial Hivemind（§6.1）明确报告 LM 与 LM-based judge 在"同等质量的不同回答"上校准很差；NoveltyBench 也强调单次生成评测的范式缺陷。
- 【理论/工程】一致性门槛用 Landis & Koch（§1.2 第 4 条）。**实践建议**：任何自动分数都要报告 ①与人类评分的相关/一致性，②重测或分半信度，③对"评分模型家族"的鲁棒性（换一个 judge 分数是否稳定）。

### 6.4 "AI 不能产生真正新意"的论证与反驳
**论证侧**
- 【理论】Boden, M. A. (1998), *Creativity and artificial intelligence*, Artificial Intelligence 103(1–2): 347–356，DOI <https://doi.org/10.1016/S0004-3702(98)00055-1>（元数据核实）。Boden 的三分法（**combinational / exploratory / transformational creativity**，组合式 / 探索式 / 转换式）是"AI 能否真正创新"讨论的标准框架（该三分法出自其著作 *The Creative Mind: Myths and Mechanisms*）。最强质疑是：LLM 式系统擅长组合式与探索式，**转换式（改变概念空间本身的规则）证据最弱**。
- 【理论】Searle, J. R. (1980), *Minds, brains, and programs*, Behavioral and Brain Sciences 3(3)，DOI <https://doi.org/10.1017/S0140525X00005756>（元数据核实）：句法操作不等于语义理解（"中文屋"论证），常被用来论证"生成文本 ≠ 有创意主体"。
- 【理论/批判】Bender, E. M., Gebru, T., McMillan-Major, A., Shmitchell, S. (2021), *On the Dangers of Stochastic Parrots: Can Language Models Be Too Big?*，FAccT '21，DOI <https://doi.org/10.1145/3442188.3445922>（元数据核实）：把 LLM 描述为"形式而不理解意义"的统计鹦鹉，是对"真正新意"主张的经典批评。
**反驳侧**
- 【实验·中】类比能力并非人类独有（Webb et al.，§3.5）；
- 【实验·强】演化式 LLM 搜索产生了**可证明正确的新算法**（FunSearch, Nature 2024；AlphaEvolve，§4.3）——在数学/算法这类"新颖性可被形式化验证"的领域，这是对"不可能有新意"的强反例；
- 【实验·中】Co-Scientist 的候选药物假设经 **in vitro 实验验证**（§4.1），说明"新"可以落到外部效度上。
- **可辩护的折中立场**：现有证据支持"LLM 能在给定概念空间内高效探索并组合出对人有价值的新组合（combinational/exploratory）"，而"改变概念空间规则（transformational）"仍缺乏独立验证。写报告务必用这个措辞，别用"AI 有/没有创造力"的二元判断。

---

## 7. 可直接复用的自动评分基准清单

| 目标维度 | 测验/指标 | 自动评分方式 | 主来源 |
|---|---|---|---|
| 发散联想（个体） | **DAT** | 固定公式：前 7 词 → 21 对 cosine distance → 均值 ×100；**完全可自动** | <https://doi.org/10.1073/pnas.2022340118> |
| 发散思维（AUT） | 语义距离 | embedding 距离（SemDis）；需报告与人类评分一致性 | <https://doi.org/10.3758/s13428-020-01453-w> |
| 发散思维（AUT） | LLM 评分 | LLM-as-judge 打 novelty/usefulness | <https://doi.org/10.1016/j.tsc.2023.101356> |
| 聚合思维 | **RAT/CRAT** | 准确率（单值，可自动） | <https://doi.org/10.3758/bf03195543>；<https://doi.org/10.3758/s13428-024-02422-3> |
| 人类基线 | **TTCT** | 需受训评分者（非自动） | <https://doi.org/10.1207/s15326934crj1801_2> |
| 输出多样性（重复采样） | **NoveltyBench** | 多次采样的"不同等价类"数量 | <https://arxiv.org/abs/2504.05228> |
| 泛开放式同质化 | **Artificial Hivemind / Infinity-Chat** | 分类体系 + 人类标注校准 | <https://arxiv.org/abs/2510.22954> |
| 集合多样性 | **Vendi Score**、distinct-n、inverse Simpson | 任意相似度核 + 有效项数 | <https://arxiv.org/abs/2210.02410> |
| 研究想法质量 | **IdeaBench** | 数据集 + 评估框架（自动指标 + 人评） | <https://arxiv.org/abs/2411.02429> |
| 搜索策略（质量/多样性/新颖性） | **Heuresis** | 基元化搜索策略的对照评测 | <https://arxiv.org/abs/2606.25198> |
| 覆盖度 | **QD：coverage / archive 质量** | 描述子空间填充率 + 每格最优的全局质量 | <https://arxiv.org/abs/1504.04909>；<https://arxiv.org/abs/1708.09251> |
| 真值可验证任务 | **FunSearch / AlphaEvolve 式评测** | 自动执行/形式化验证（fitness 无争议） | <https://doi.org/10.1038/s41586-023-06924-6> |
| 一致性门槛 | **Cohen's κ 解释区间** | 报告自动 vs 人工一致性 | <https://doi.org/10.2307/2529310> |

---

## 8. 本次未能核实的条目（透明清单）

**站点层面不可达/被屏蔽**：`github.com`、`huggingface.co`（直连）、`archive.org`（解析到非公网 IP）、`nature.com`、`science.org`、`sciencedirect.com`、`tandfonline.com`、`dl.acm.org`、`openlibrary.org`、`radimrehurek.com`、`semdis.wlu.psu.edu`、NeurIPS 论文 PDF（工具明确"不支持 application/pdf"）。PDF 一律无法解析，因此基于 PDF 的页面（含 NeurIPS 论文正文、ERIC 报告）只做了"存在性/题名"级别的判断。

**具体未核实项**：
1. TTCT 图形式是否自 1984 年修订起不再计 flexibility，以及 Resistance to Premature Closure 的确切计分规则（未打开手册或 Kim 2006 正文）；
2. Kim (2006) 综述中的具体信度/效度系数；
3. SemDis（Beaty & Johnson 2021）与 Organisciak et al. (2023) 的具体相关系数、样本量、模型清单（正文在付费墙内）；
4. "统计稀有度（frequency-based originality）"评分的原始方法论文献；
5. Levy & Goldberg (2014) *Neural Word Embedding as Implicit Matrix Factorization* 的可访问官方页面（NeurIPS 2014）；
6. Google News word2vec 向量的现存下载地址；
7. Tencent AI Lab 中文词向量页面（返回空壳）与 Chinese-Word-Vectors 的 GitHub 仓库；
8. Wallas (1926) *The Art of Thought* 与 Koestler (1964) *The Act of Creation* 的原文页面（仅通过 OA 二手文献核实术语与定义）；
9. SCAMPER（Eberle）与 TRIZ（Altshuller）原始书籍的可访问书目页；
10. Sio & Ormerod (2009) 的孕育效应具体效应量；
11. Beaty et al. (2018, PNAS) 的预测相关值与样本量；
12. Co-Scientist 的 Elo/锦标赛排序细节（Nature 正文重定向到登录页）；
13. Smit et al. (arXiv:2311.17371) 的最终结论措辞；
14. RAT 题集的"官方开源下载包"（未找到可稳定访问的 URL）；
15. 仅在检索摘要中出现的基准（如 "AI Idea Bench 2025"）：未打开一手页面，故正文未引用。

---

## 9. 可直接用于设计的 10 条要点

1. **用 DAT 做"零成本、可自动、可复现"的发散思维主指标**：固定实现"10 词取前 7 → 21 对 cosine distance → 均值 ×100"，并锁定 embedding 模型与版本（论文用 GloVe/Common Crawl）。这一条完全满足"可自动评分"。
2. **双列评分：novelty 与 usefulness/feasibility 分开度量**，并报告两者关系；只优化语义距离会奖励噪声（创造力标准定义 = 原创性 + 适用性）。
3. **多样性必须跨样本度量，而不是只看单次输出**：用 NoveltyBench 式"多次采样的不同等价类数" + Vendi Score + distinct-n；注意 >90% 的既有基准只评单次最佳生成，这是范式缺陷。
4. **把 QD（MAP-Elites）作为"多子 Agent 的归档结构"**：为每个描述子格子保留最优解，报告 **coverage** 与 archive 全局质量；而不是只保留 top-k 想法。Novelty search 的证据支持在"目标函数有欺骗性"时以新颖性驱动搜索。
5. **多 Agent 结构优先"独立探索 → 结构化评审/排序 → 汇聚"，慎用实时互辩**：人类头脑风暴的强证据（名义组优于互动组）与 LLM 侧 MAST（1600+ 轨迹、7 框架、增益常微弱）、DoT 退化一致；"多 agent"的增益很大一部分来自 **sampling + voting**，要用消融实验把它与"辩论"本身区分开。
6. **角色分离 + 锦标赛排序**（生成者 / 评审者 / 排序者 / 演化者 / 邻近图去重 / 元评审），并让排序基于**成对比较**而非绝对打分——Co-Scientist 的架构可直接借鉴；但排序细节要自己实现并验证（官方 Elo 细节未能核实）。
7. **不要把 temperature 当创造力开关**：已有实验证据显示温度与新颖性仅弱相关、与不连贯性中等相关，且与连贯性/典型性无关；采样多样性策略（如 min-p）应作为"多样性–连贯性权衡"的对照条件，而不是默认增益项。
8. **提示词层面只把"有对照证据"的技术列为增益候选**：类比/结构映射提示（Webb et al.、analogical prompting）、约束（Haught-Tromp）、SCAMPER/TRIZ 流水线（iDesignGPT）有正面证据；persona 有负面结果、CoT/self-consistency 只在推理任务上有证据——三者都必须作为消融项而不是默认开启项。
9. **每个自动分数都要交付三项可信度证据**：与人类评分的相关/一致性（κ 用 Landis & Koch 区间解释）、重测/分半信度、对 judge 模型家族的鲁棒性；并保留人类评分锚点集作为回归测试。
10. **把"真值可验证任务"（代码/数学/算法，FunSearch/AlphaEvolve 式）与"开放式创意任务"分开报告**：前者的 fitness 无争议，可用作机制有效性的**干净证据**；后者的结论一律标注"证据强度：中/弱"，并明确区分 combinational / exploratory / transformational 三种创造力，避免"AI 是否有创造力"的二元论断。
