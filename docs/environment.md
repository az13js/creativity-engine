# 实验环境

| 项目 | 值 |
| --- | --- |
| 运行日期 | 2026-09-30 |
| 操作系统 | Linux（x86_64） |
| Node.js | v24.19.0（原生 TypeScript 类型擦除，无需构建） |
| 对话模型 | deepseek-v4.1-flash（本地 OpenAI 兼容端点，reasoning_effort=none） |
| 嵌入模型 | qwen3-embedding:latest（4096 维） |
| 端点配置 | 环境变量 `CREATIVE_BASE_URL`/`CREATIVE_API_KEY` 优先，否则读取本机 OpenCode 配置；密钥不写入任何产物 |
| 随机种子 | 20240930 |
| 依赖 | 无第三方 npm 依赖；仅用 Node 内置模块与全局 fetch |

复现命令：

```bash
npm test          # 34 个单元测试（离线、确定性）
node scripts/bench.ts --dry   # 假模型跑通整条流水线（无需网络）
bash scripts/run-all.sh       # 主实验 + 消融 + 重新评分 + 报告
```
