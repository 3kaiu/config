# 生态评估报告 (v7.7)

**日期**: 2026-07-22
**来源**: 深度研究 + 文档验证

---

## 1. sing-box iOS — 前景评估

| 维度 | 结论 |
|------|------|
| iOS App | ❌ **无 App Store 应用** — sing-box 是命令行核心，仅 macOS/桌面可用 |
| MITM/重写 | ❌ **不支持** — sing-box 无 HTTP rewrite 能力 |
| 协议支持 | ✅ Hysteria2, VLESS, TUIC, ShadowTLS — 协议端领先 |
| 去广告 | ❌ 无 MITM 拦截能力，仅规则级 blocking |
| 可行性 | 不可替代 Loon/QX 的 iOS 去广告功能 |

**建议**: 继续关注。如果未来出 sing-box iOS App，可能成为协议层面的替代品（如 VLESS/Reality 更好的支持），但无法替换去广告/rewrite 功能。

---

## 2. Stash (iOS) — 替代方案评估

| 维度 | 结论 |
|------|------|
| MITM 解密 | ✅ Stash 支持 HTTPS MITM decryption |
| 规则路由 | ✅ YAML 配置，规则系统与 Surge 兼容 |
| 脚本支持 | ✅ JavaScript Core 处理 HTTP request/response |
| 去广告 | ✅ 可通过 MITM + rewrite 实现 |
| 生态 | ⚠️ 兼容 Surge 规则格式，但 Loon/QX plugin 不兼容 |
| Loon/QX 对比 | ⚠️ 无直接对比信息 — 规则格式不兼容 |

**建议**: 不主动迁移。如果 Loon/QX 生态出现问题，Stash 是 Surge 路线上的替代选择。需要完全重写配置格式（Surge 格式）。

---

## 3. Sub-Store 数据泄露风险

**风险描述**: Sub-Store Cloud (sub.store) 可能有 MITM rewrite 数据泄露风险。

**当前状态**: ✅ **不受影响**。

| 风险因子 | 3kaiu/config | 说明 |
|----------|-------------|------|
| 使用 Sub-Store Cloud? | ❌ 否 | 仅使用 Sub-Store **本地 parser** |
| sub.store 域名 | ❌ 未配置 | MitM hostname 中无 sub.store |
| 数据经过第三方服务 | ❌ 否 | 订阅数据直接从订阅源 → Loon/QX |
| 引用内容 | ✅ 安全 | `resource-parser` → GitHub release |
| 自建 CDN | ✅ `ws.wenn.in` | 脚本和插件通过自建 CDN 分发 |

**安全确认**: 3kaiu/config 不使用 Sub-Store Cloud，不受此风险影响。

---

## 4. ddgksf2013 生态健康度

| 指标 | 值 | 趋势 |
|------|----|------|
| GitHub Stars | 13.3k | 稳步增长 |
| Forks | 579 | 活跃社区维护 |
| 更新频率 | 每日更新 | ✅ 活跃 |
| 风险 | 仓库存活 | 通过 Mirror/ 消除直接依赖风险 |

**当前措施**: 
- ✅ `mirror-scripts.yml` 每日缓存关键脚本
- ✅ `upstream-health.yml` 监控仓库可用性
- ✅ 自维护 19 个 plugin 引用活跃上游脚本

---

## 5. Go TLS 指纹 (uTLS) — 影响分析

**发现**: Go 标准库的 TLS ClientHello 指纹具有唯一性，可被 JA4/JA3 识别。

**对当前配置的影响**: **无**。

| 协议 | TLS 实现 | 指纹风险 |
|------|---------|---------|
| VLESS+Reality | Reality 将 TLS 握手重定向到 CDN | ✅ **无风险** — 握手由 CDN (真实目标) 完成，非 Go TLS |
| Hysteria2 | QUIC (基于 quic-go) | ⚠️ QUIC 握手指纹需单独评估 |

**建议**: Reality 协议天然绕过了 Go TLS 指纹问题（因为握手是重定向到目标 CDN 完成的）。Hysteria2 使用 QUIC，指纹分析方式不同。无需行动。
