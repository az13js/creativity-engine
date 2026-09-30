#!/usr/bin/env bash
# 一键复现全部实验（需要本机可用的模型端点；已有缓存时重跑几乎不花时间）
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 单元测试 =="
node --test

echo "== 主实验：4 配置 × 7 任务 =="
node scripts/bench.ts --generations 3 --seed 20240930 --out runs/main-live

echo "== 消融实验：机制各部分的贡献 =="
node scripts/bench.ts --tasks aut-brick,brief-box,dat-10 --configs engine,engine-noadapt,engine-flat,zero-shot --generations 3 --seed 20240930 --out runs/ablation

echo "== 重新评分：加入独立可行性评委与跨配置同质化审计 =="
node scripts/rescore.ts --run runs/main-live
node scripts/rescore.ts --run runs/ablation

echo "== 完成 =="
echo "报告：runs/main-live/report.html  与  runs/ablation/report.html"
