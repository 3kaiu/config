# v7.7 可靠性加固审计报告

**日期**: 2026-07-22
**审计方式**: 全量代码审查 + 3 个并行 Agent 深度分析 + 对抗审计
**审计范围**: 19 个 Plugin + 9 个 JS 脚本 + Loon.lcf + QX.conf + 3 个 Workflow + 2 个 Kelee 插件 + 5 个 QX/apple 配置

---

## 修复清单

### A 组 — 紧急修复（本次变更）

| # | 修复 | 文件 | 风险等级 |
|---|------|------|---------|
| A1 | WeChat DIRECT 规则 (wechat.com/weixin.qq.com/wx.qq.com/qpic.cn) | QX.conf | P1 — 功能缺失 |
| A2 | 5 条缺失 Proxy 路由 (twittercdn/tdesktop/steamcdn/onedrive.live/wikimedia) | QX.conf | P2 — 遗漏覆盖 |
| A3 | 版本号 v17.0 → v7.7 | QX.conf | P0 — 信息错误 |
| A4 | `$.done()` → `$done()` (6 个 JS 脚本 catch 块 ReferenceError) | Amap/JD/Tieba/Reddit/Zhihu/Cainiao | P0 — Runtime Bug |
| A5 | PushPlus HTTP → HTTPS | Qidian.js | P0 — 安全漏洞 |
| A6 | 重复规则 tangram.e.qq.com + 死规则 httpdns 显式域名 | QX.conf + Loon.lcf | P2 — 维护垃圾 |

### B 组 — 可靠性加固

| # | 修复 | 状态 |
|---|------|------|
| B1 | 创建 `mirror-scripts.yml` + `Mirror/` 目录 | ✅ |
| B2 | 7 个外部脚本全部切换到 `ws.wenn.in/main/Mirror/` CDN | ✅ |
| B3 | upstream-health.yml 扩展 4→12 个上游检查点 | ✅ |
| B4 | 20 个 plugin + 2 个主配置版本号统一为 v7.7 | ✅ |
| B5 | qishui/wechat 退化存根诚实标注 | ✅ |

### C 组 — 架构演进

| # | 修复 | 状态 |
|---|------|------|
| C1 | 银行域名负向排除 — 添加双端交叉引用注释 | ✅ |
| C3 | 新兴 AI 服务域名补充 (DeepSeek/xAI/Midjourney/Suno/ ElevenLabs/Runway/Luma) | ✅ |
| C4 | 创建 `config-validate.yml` CI (5 项检查) | ✅ |
| C6 | DoH3 对称化 — QX 已有 `prefer-doh3` | ✅ 天然满足 |

### 未修复（设计决策）

| 项 | 原因 |
|----|------|
| C2 小脚本 Env 兼容层 | `$done()` 修复已足够，Env 样板代码过度工程化 |
| C7 备用代理节点 | 超出配置范围，需要实际节点资源 |
| C8 协议演进 | 取决于 Loon/QX 客户端支持 |
| QX 冗余 Google AI 子域名 | 作为文档性规则保留，无害 |

---

## 审计方法

### 自动化检查

```yaml
config-validate.yml:
  - Plugin 元信息完整性 (#!name/#!version/#!desc)
  - script-path URL 可达性
  - Loon vs QX 双端交叉核对 (WeChat DIRECT)
  - 银行域名 MitM 冲突检测
  - 版本号一致性
```

### 人工对抗审计

每项修复后执行：
1. **一致性检查**: 修改与 Loon.lcf / QX.conf 对应规则是否匹配
2. **语法检查**: 无拼写错误、无漏引号
3. **顺序检查**: 规则是否在正确优先级位置
4. **边界检查**: 是否存在其他未覆盖的相关域名
5. **回归检查**: 修改是否引入新问题

---

## 现状评估

| 维度 | 状态 |
|------|------|
| 外部依赖 | 12 个上游源日常监控 |
| 单点故障 | 消除 gist/raw.githubusercontent 脚本级依赖 (← CDN mirror) |
| 双端一致性 | WeChat/routes/AI 对齐，银行排除列表一致 |
| 代码质量 | 6 个 Runtime Bug 修复，1 个安全漏洞修复 |
| CI 防护 | 新增 config-validate.yml (PR/merge 时自动检查) |
| 版本信噪 | 全部版本号统一，退化存根诚实标注 |
