---
kind: logging_system
name: 日志系统 — 基于原生 console.log 与 $.log 的轻量输出
category: logging_system
scope:
    - '**'
source_files:
    - Scripts/Qidian.js
    - Scripts/health-notify.js
    - Scripts/traffic-notify.js
    - ENGINE-MANIFEST.json
---

本仓库是一个 Loon / Quantumult X / Surge 的配置生成项目（Surgio），脚本语言为 JavaScript。仓库未引入任何第三方日志框架，日志输出完全依赖运行时环境提供的原生能力，呈现两种模式：

1. **console.log**：绝大多数脚本（如 `health-notify.js`、`traffic-notify.js` 以及 `Mirror/` 下的规则脚本）直接使用 `console.log` 输出调试信息，无级别区分、无结构化字段。
2. **$.log**：`Scripts/Qidian.js` 内部通过 `this.log = (...a) => console.log(`[${this.name}] ` + a.join(" "))` 封装了一个带脚本名前缀的日志方法，用于业务日志（如签到状态、任务执行进度等）。

所有日志均为纯文本字符串拼接，不存在统一的日志级别（info/debug/warn/error）、结构化 JSON 格式或集中式 sink 配置。通知类脚本通过 `$notification.post` / `$notify` 推送本地通知，并通过 Bark / Telegram 进行远程推送，但这些属于“通知”而非“日志”。

约束与约定：
- 日志仅用于开发调试与运行态观察，不写入持久化文件。
- 由于 Loon / QX / Surge 的 JS 上下文在 `$done()` 后会被回收，远程推送必须 await 完成后再结束（见注释说明），否则请求会被中止。
- 引擎清单 `ENGINE-MANIFEST.json` 中记录了嵌入的 qdreader 引擎会在 Cookie 更新时写入 Loon 调试日志，但该行为不受 `QDREADER_DEBUG` 开关控制，属于已知风险项。

综上，本仓库的“日志系统”仅为裸 `console.log` + 局部 `$.log` 包装，没有统一框架、级别管理或集中路由。