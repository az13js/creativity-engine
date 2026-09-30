# 实验环境

| 项目 | 值 |
| --- | --- |
| 机器日期 | 2026-09-30 |
| Node.js | （见运行日志） |
| 操作系统 | Linux |
| 对话模型 | deepseek-v4.1-flash（本地 OpenAI 兼容端点，reasoning_effort=none） |
| 嵌入模型 | qwen3-embedding:latest（4096 维） |
| 端点 | 由 `CREATIVE_BASE_URL`/OpenCode 配置提供，密钥不写入产物 |
| 随机种子 | 20240930 |

依赖：无第三方 npm 依赖；Node 22.6+ 的 TypeScript 类型擦除（type stripping）即可运行。
