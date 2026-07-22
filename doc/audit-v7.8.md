# v7.8 路由规则补全与双端对齐审计报告

**日期**: 2026-07-22
**版本**: v7.8
**审计方式**: 全量双端配置交叉审查 + CI 防护增强 + 文档一致性校验
**审计范围**: Loon.lcf + QX.conf + quantumultx.tpl + loon.tpl + 5 个 snippet pair + config-validate.yml + README.md

---

## v7.8 变更摘要

v7.8 围绕路由规则补全展开，覆盖以下 4 个维度：

1. **流媒体路由补全**：新增 Netflix/Spotify/TikTok/HBO Max/Disney+/Crunchyroll/Hulu/Paramount+/Peacock/NOW TV/Bilibili 国际版/Apple TV+/Pandora/SoundCloud/Tidal/Deezer CDN 域名。
2. **社交平台路由补全**：新增 WhatsApp/Signal/Line/Threads/Mastodon/VK/Tumblr/Bluesky，补充 Reddit CDN。
3. **AI 服务路由补全**：新增 OpenAI CDN/Google AI 补全/AI 音视频/新兴 AI/AI 编程工具补全，全部域名同步到 snippet。
4. **开发者平台路由补全**：新增 Google/Microsoft 开发者、包管理器、代码托管/CI、开发工具、文档/知识库、Stack Exchange、Linux/开源域名。

---

## 发现的问题

### P0 — 功能缺失

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| D1 | QX MitM hostname 缺失 9 个域名（amdc.m.taobao.com / m5.amap.com / m5-zb.amap.com / m-cloud.zhihu.com / tiebac.baidu.com / tieba.baidu.com / tiebaapi.baidu.com / gql.reddit.com / gql-fed.reddit.com） | quantumultx.tpl + QX.conf | QX 端高德地图、贴吧、Reddit、知乎(m-cloud) 的插件 MitM 解密不生效，去广告规则无法命中 |
| D2 | QX HTTPDNS Rewrite 缺失 2 条（1.12.12.12 / 120.53.53.53） | quantumultx.tpl + QX.conf | DNSPod 新 IP 的 HTTPDNS 请求未被 reject，可能导致 DNS 泄露 |

### P1 — 对齐缺失

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| D3 | QX DNS 泄露检测域名仅 5 条，Loon 通过 Prevent_DNS_Leaks.plugin 覆盖 21 个 | quantumultx.tpl + QX.conf | QX 端 DNS 泄露检测覆盖不全 |

### P2 — 文档错误

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| D4 | README 引用不存在的 Scripts/UnionPay.js | README.md | 用户按文档查找文件会 404 |
| D5 | README 目录树缺少 provider/ template/ template/snippet/ Mirror/ 目录 | README.md | 项目结构信息不完整 |

### P3 — CI 防护缺失

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| D6 | config-validate.yml 无 MitM hostname 双端 diff 检查 | .github/workflows/config-validate.yml | MitM 域名缺失无法被 CI 发现（D1 的根因） |
| D7 | config-validate.yml 无 HTTPDNS Rewrite 对齐检查 | .github/workflows/config-validate.yml | HTTPDNS rewrite 缺失无法被 CI 发现（D2 的根因） |
| D8 | config-validate.yml 无 Snippet 双端对齐检查 | .github/workflows/config-validate.yml | snippet 域名数量不一致无法被 CI 发现 |

---

## 修复措施

### A 组 — MitM hostname 与 HTTPDNS 补全

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| A1 | QX MitM hostname 补充 9 个域名（zhuanlan.zhihu.com 之后追加） | quantumultx.tpl + QX.conf | ✅ |
| A2 | QX HTTPDNS Rewrite 补充 2 条（1.12.12.12 + 120.53.53.53） | quantumultx.tpl + QX.conf | ✅ |
| A3 | QX DNS 泄露检测域名补充 16 条（与 Prevent_DNS_Leaks.plugin 对齐，共 21 条） | quantumultx.tpl + QX.conf | ✅ |

**补充的 9 个 MitM hostname 清单**:
- `amdc.m.taobao.com` — 淘宝/高德 AMDC
- `m5.amap.com` — 高德地图 Script
- `m5-zb.amap.com` — 高德地图 Script
- `m-cloud.zhihu.com` — 知乎 MitM
- `tiebac.baidu.com` — 贴吧 Proto
- `tieba.baidu.com` — 贴吧 JSON
- `tiebaapi.baidu.com` — 贴吧 API
- `gql.reddit.com` — Reddit GraphQL
- `gql-fed.reddit.com` — Reddit GraphQL

**补充的 16 个 DNS 泄露检测域名清单**:
- `expressvpn.com` / `nordvpn.com` / `surfshark.com` / `perfect-privacy.com` — 主流 VPN 检测
- `browserleaks.org` / `vpnunlimited.com` / `whrq.net` — 浏览器泄露检测
- `astrill.com` / `astrill.org` / `dnsleak.asn247.net` — Astrill 检测
- `surfsharkdns.com` — Surfshark 检测
- `pixelscan.net` — Pixelscan 检测
- `ipapi.co` — IPAPI 检测
- `ipv4.ping0.cc` / `ipv6.ping0.cc` — PING0 检测（DOMAIN 精确匹配）
- `ip-scan.adspower.net` — BrowserScan 检测（DOMAIN 精确匹配）

### B 组 — README 文档修复

| # | 修复 | 状态 |
|---|------|------|
| B1 | 移除 README 正文中 UnionPay.js 虚假引用，改为"云闪付净化通过 DNS 级 REJECT 实现，无独立脚本" | ✅ |
| B2 | README 目录树移除 Scripts/UnionPay.js 行 | ✅ |
| B3 | README 目录树补充 provider/（含 tokyo.js） | ✅ |
| B4 | README 目录树补充 template/（含 loon.tpl, quantumultx.tpl）+ template/snippet/（5 对 .tpl/.qx） | ✅ |
| B5 | README 目录树补充 Mirror/（7 个 mirror 脚本） | ✅ |

### C 组 — CI 防护增强

| # | 修复 | 状态 |
|---|------|------|
| C1 | 新增 Step 5: MitM hostname 双端 diff 检查（提取正向域名，比较 Loon vs QX 差异，输出 warning 不阻断） | ✅ |
| C2 | 新增 Step 6: HTTPDNS Rewrite 对齐检查（比较 Loon [Rewrite] 与 QX [rewrite_local] 的 /d reject-200 规则数） | ✅ |
| C3 | 新增 Step 7: Snippet 双端对齐检查（对 5 对 .tpl vs .qx 比较域名规则行数，不一致则 fail） | ✅ |

---

## 验证结果

### 自动化验证

```bash
# MitM hostname 验证 (9 个域名全部在 QX.conf hostname 行中找到)
✅ amdc.m.taobao.com    ✅ m5.amap.com          ✅ m5-zb.amap.com
✅ m-cloud.zhihu.com    ✅ tiebac.baidu.com     ✅ tieba.baidu.com
✅ tiebaapi.baidu.com  ✅ gql.reddit.com       ✅ gql-fed.reddit.com

# HTTPDNS Rewrite 验证 (QX.conf 和 tpl 均有 5 条)
✅ 119.29.29.29/d  ✅ 203.107.1.1/d  ✅ 223.5.5.5/d
✅ 1.12.12.12/d    ✅ 120.53.53.53/d

# DNS 泄露检测域名验证 (16 个新增域名全部找到)
✅ expressvpn.com      ✅ nordvpn.com         ✅ surfshark.com
✅ perfect-privacy.com ✅ browserleaks.org    ✅ vpnunlimited.com
✅ whrq.net            ✅ astrill.com         ✅ astrill.org
✅ dnsleak.asn247.net  ✅ surfsharkdns.com    ✅ pixelscan.net
✅ ipapi.co            ✅ ipv4.ping0.cc       ✅ ipv6.ping0.cc
✅ ip-scan.adspower.net
```

### CI 检查项总览（v7.8 更新后）

| 步骤 | 检查内容 | 阻断级别 |
|------|---------|---------|
| 1 | Plugin 元信息 (#!name/#!version/#!desc) | fail |
| 2 | script-path URL 可达性 | fail |
| 3 | Loon vs QX 双端交叉核对 (WeChat DIRECT / Proxy 路由) | fail |
| 4 | 银行域名 MitM 冲突检测 | warning |
| 5 | MitM hostname 双端 diff 检查 **(NEW)** | warning |
| 6 | HTTPDNS Rewrite 对齐检查 **(NEW)** | warning |
| 7 | Snippet 双端对齐检查 **(NEW)** | fail |
| 8 | 版本号一致性 | fail |

---

## 遗留问题和后续计划

| 项 | 优先级 | 说明 |
|----|--------|------|
| 策略组拆分 | 低 | 当前仅 Proxy/Apple/Final 三个策略组，未来可考虑按地区/用途拆分（如 Streaming/AI/Developer 子策略组），但单节点场景下收益有限 |
| Cron 任务扩展 | 低 | 当前仅起点签到 1 个 cron 任务，可考虑增加定时清理缓存、定时重置插件状态等运维任务 |
| BoxJS 集成 | 低 | QX 端参数配置仍需手动编辑 [prefs_local]，未来可考虑统一 BoxJS 入口简化配置流程 |
| Snippet 域名内容级 diff | 中 | 当前 CI 仅检查 snippet 域名数量是否一致，未来可升级为逐域名内容 diff 以发现遗漏 |
| MitM hostname 差异自动修复 | 中 | 当前 Step 5 仅输出 warning，未来可考虑自动生成补丁 PR |
| README 目录树自动生成 | 低 | 手动维护目录树易过时，未来可考虑 CI 自动生成 |

---

## 现状评估

| 维度 | v7.7 | v7.8 |
|------|------|------|
| 双端 MitM hostname 一致性 | ❌ 缺失 9 域名 | ✅ 已对齐 |
| HTTPDNS Rewrite 一致性 | ❌ 缺失 2 条 | ✅ 已对齐 (5/5) |
| DNS 泄露检测覆盖 | ❌ QX 仅 5 条 | ✅ QX 21 条 (与插件对齐) |
| CI 检查项数量 | 5 项 | 8 项 (+3) |
| README 目录树完整性 | ❌ 缺 4 个目录 | ✅ 完整 |
| README 脚本引用准确性 | ❌ UnionPay.js 虚假引用 | ✅ 已修正 |
