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

## D 组 — NSRingo bundle.js 版本固定风险消除 (v7.8 补充)

### 发现

6 个 NSRingo Apple 增强插件（WeatherKit/Maps/News/Siri/Search/TestFlight）内部通过 `script-path` 引用了 **版本固定的 `.bundle.js`** 下载链接，而非 `releases/latest` 动态链接：

| 插件 | 仓库 | bundle.js | 版本 |
|------|------|-----------|------|
| WeatherKit | NSRingo/WeatherKit | response.bundle.js | v3.1.0 |
| Maps | NSRingo/GeoServices | request.bundle.js + response.bundle.js | v4.6.1 |
| News | NSRingo/News | request.bundle.js | v3.2.1 |
| Siri | NSRingo/Siri | request.bundle.js + response.bundle.js | v4.2.7 |
| Search | NSRingo/Siri | (同 Siri) | v4.2.7 |
| TestFlight | NSRingo/TestFlight | request.bundle.js + response.bundle.js | v3.4.0 |

**风险**：如果 NSRingo 清理旧版 Release，这些 `releases/download/vX.Y.Z/` 链接会 404，导致插件脚本加载失败。

### 修复措施

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| D9 | 在 `mirror-scripts.yml` 中添加 8 个 NSRingo bundle.js 的每日 mirror 逻辑，同步到 `Mirror/nsringo/` 目录 | mirror-scripts.yml | ✅ |
| D10 | 创建 `Mirror/nsringo/` 目录 | Mirror/nsringo/.gitkeep | ✅ |
| D11 | 在 `upstream-health.yml` 中添加 8 个 NSRingo bundle.js 版本固定产物的健康检查 | upstream-health.yml | ✅ |

**注意**：当前 NSRingo `.plugin` 文件仍通过 `releases/latest/download/` 动态链接获取（非版本固定），仅其内部 `script-path` 引用的 `.bundle.js` 是版本固定的。mirror 的 `.bundle.js` 作为灾备缓存，未来若需要可修改 `.plugin` 中的 `script-path` 指向自建 CDN。

---

## E 组 — 策略组拆分与定时通知 (v7.8 补充)

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| E1 | 新增 Streaming/AI/Developer/Social 四个独立 select 策略组 | loon.tpl + quantumultx.tpl + Loon.lcf + QX.conf | ✅ |
| E2 | snippet 文件中 `Proxy` 替换为各自策略组名（streaming→Streaming, social→Social, ai-services→AI, developer→Developer） | 8 个 snippet 文件 (.tpl + .qx) | ✅ |
| E3 | ai.plugin 的 `AI_Policy` 默认值从 `Proxy` 改为 `AI` | Plugin/ai.plugin | ✅ |
| E4 | 新增 `Scripts/health-notify.js` — 节点健康检测通知（每6小时，支持 Bark/Telegram） | Scripts/health-notify.js | ✅ |
| E5 | 新增 `Scripts/traffic-notify.js` — 流量统计/心跳通知（每晚22点） | Scripts/traffic-notify.js | ✅ |
| E6 | 新增 `Plugin/notify.plugin` — 定时通知插件（cron 0 */6 + cron 0 22） | Plugin/notify.plugin | ✅ |
| E7 | Loon [Plugin] 段添加 notify.plugin 引用 | loon.tpl + Loon.lcf | ✅ |
| E8 | Sub-Store/QuickSearch 从 ajune0527 远程 URL 迁移到自维护 `Plugin/sub-store.plugin` + `Plugin/quicksearch.plugin` | loon.tpl + Loon.lcf + Plugin/ | ✅ |
| E9 | upstream-health.yml 移除 ajune0527 检查（已自维护） | upstream-health.yml | ✅ |
| E10 | real-ip 补充 Apple 推送域名（*.push.apple.com / *.apns.apple.com / captive.apple.com） | loon.tpl + Loon.lcf + quantumultx.tpl + QX.conf | ✅ |
| E11 | config-validate.yml Step 7 Snippet 对齐检查升级为逐域名内容 diff | config-validate.yml | ✅ |

---

## F 组 — 深度对抗审计 P0/P1 修复 (v7.8 补充)

### F 组-1: 插件 MitM hostname %APPEND% 改造

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| F1 | 5 个插件 MitM hostname 改用 `%APPEND%` 而非覆盖式 `=` | life.plugin / qidian.plugin / quicksearch.plugin / sub-store.plugin / zhihuifangdong.plugin | ✅ |

**问题**: 使用 `hostname = xxx` 会覆盖主配置的全局 hostname 列表，导致银行域名负向排除和其他插件的 hostname 声明全部失效。改用 `hostname = %APPEND% xxx` 仅追加，不覆盖。

### F 组-2: JS 脚本 $response 守卫

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| F2 | 7 个 JS 脚本添加 `if (typeof $response === "undefined") { $done(); return; }` 守卫 | Zhihuifangdong.js / Amap.js / JD.js / Cainiao.js / Zhihu.js / Reddit.js / Tieba.js | ✅ |

**问题**: 当 `AllInOne` 重写规则以非 response 模式触发脚本时，`$response` 未定义会导致 `TypeError`，脚本崩溃后 `$done()` 不执行，请求挂起。

### F 组-3: QX 端 QQ 音乐 REJECT + GDT DIRECT

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| F3 | QX 端补充 QQ 音乐 14 条 DNS REJECT 规则 | QX.conf + quantumultx.tpl | ✅ |
| F4 | QX 端补充 GDT 广告 SDK 6 条 DIRECT 规则 | QX.conf + quantumultx.tpl | ✅ |
| F5 | QX 端补充 11 条 DNS 静态映射（Developer/AI/Streaming 精确域名） | QX.conf + quantumultx.tpl | ✅ |

### F 组-4: QX task_local 同步

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| F6 | QX task_local 同步 Loon cron 任务（起点签到 / health-notify / traffic-notify） | QX.conf + quantumultx.tpl | ✅ |

---

## G 组 — 路由冲突与文档修复 (v7.8 补充)

### G-1: googleapis.com 路由冲突修复 (P1-1)

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| G1 | streaming snippet 中的 Google 通配域名（gstatic.com / googleapis.com / google.com / google.co.jp）移至 developer snippet include 之后 | streaming.qx + streaming.tpl + quantumultx.tpl + QX.conf + loon.tpl + Loon.lcf | ✅ |

**问题**: `host-suffix, googleapis.com, Streaming` 在 `host, firebase.googleapis.com, Developer` 之前匹配（QX 按顺序从上到下匹配），导致 `firebase.googleapis.com` 被错误路由到 Streaming 策略组而非 Developer。将 Google 通配域名移到 developer 规则之后，确保精确 host 匹配先生效。

### G-2: README 目录树修复 (P2)

| # | 修复 | 状态 |
|---|------|------|
| G2 | 移除虚假的 `weibo.plugin`（实际不存在，只有微博去广告 QX rewrite 远程引用） | ✅ |
| G3 | 插件数从 "22个" 修正为 "21个" | ✅ |
| G4 | 移除重复列出的 `zhihu.plugin` 行 | ✅ |
| G5 | Loon 端插件描述移除 `weibo` | ✅ |
| G6 | 目录树补充 `doc/`（含 4 个审计/评估文档）、`CHANGELOG.md`、`package.json`、`package-lock.json`、`surgio.conf.js`、`README.md` | ✅ |

### G-3: QX apple conf 引用迁移 (P3-9)

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| G7 | 5 个 QX apple conf 文件的 `script-path` 从 `github.com/NSRingo/.../releases/download/vX.Y.Z/*.bundle.js` 迁移到 `ws.wenn.in/main/Mirror/nsringo/*.bundle.js` | Maps.conf / News.conf / Siri.conf / TestFlight.conf / WeatherKit.conf | ✅ |

**影响**: 24 个 script-path 引用全部切换到自建 CDN mirror，消除 GitHub Releases 单点故障风险。注释行保留原始来源 URL 作为标注。

---

## H 组 — Loon × QX 语法兼容性审计 (v7.8 补充)

### 审计背景

Loon 和 QX 虽然都是 iOS 代理工具，但配置语法、支持的特性和行为有显著差异。本组审计关注两端配置是否正确处理了这些差异。

### 语法验证结论

| 语法特性 | Loon 格式 | QX 格式 | 配置正确性 |
|---|---|---|---|
| 规则关键字 | `DOMAIN-SUFFIX, xxx, DIRECT` (大写) | `host-suffix, xxx, direct` (小写) | ✅ 双端各自正确 |
| MitM 段名 | `[MITM]` | `[mitm]` | ✅ |
| Rewrite 段名 | `[Rewrite]` | `[rewrite_local]` | ✅ |
| Filter 段名 | `[Rule]` | `[filter_local]` | ✅ |
| DNS 段名 | `[DNS]` + `server = xxx` | `[dns]` + `server=xxx` | ✅ |
| reject 变体（规则段） | `[Rule]` 只支持 `REJECT` | `[filter_local]` 支持 `reject`/`reject-drop`/`reject-no-drop` | ✅ |
| reject 变体（重写段） | `[Rewrite]` 支持 `reject-200`（3.3+，无 `url` 关键字） | `[rewrite_local]` 支持 `reject-200`/`reject-dict`（需 `url` 关键字） | ✅ |
| 302 重定向 | `^pattern 302 url`（无 `url` 关键字） | `^pattern url 302 url`（需 `url` 关键字） | ✅ Loon 在 Plugin 中处理 |
| Cron 段 | `[Cron]`（Loon 通过 Plugin 内 `[Script]` 段） | `[task_local]` | ✅ |
| Plugin 支持 | 原生 `.plugin` 文件 | 不支持，需手动转换 | ✅ QX 通过 rewrite_remote + rewrite_local |
| `%APPEND%` | 支持（Plugin 级 hostname 追加） | 不支持（hostname 全局唯一） | ✅ QX 在主配置 mitm hostname 中预声明 |
| DNS 泄漏检测 | 通过 `Prevent_DNS_Leaks.plugin` 的 `[Rule]` 段 | 通过 `[filter_local]` 手动添加 21 条 | ✅ 机制不同但等价 |

### 修复项

| # | 修复 | 文件 | 状态 |
|---|------|------|------|
| H1 | Loon 端补充 GDT 白名单 3 条域名（adsmind.gdtimg.com / adsmind.ugdtimg.com / pgdt.gtimg.cn） | Loon.lcf + loon.tpl | ✅ |
| H2 | QX 端补充 QuickSearch 重写规则（8 条 DuckDuckGo 302 重定向）+ MitM hostname 添加 duckduckgo.com | QX.conf + quantumultx.tpl | ✅ |
| H3 | QX rewrite_local 统一风格：`http-response` 前缀格式 → 无前缀格式（2 条 Zhihu 规则） | QX.conf + quantumultx.tpl | ✅ |
| H4 | snippet 注释修正：`.qx` 文件标注 `QX 格式`，`.tpl` 文件标注 `Loon 格式`，移除误导性的"QX 通过 quantumultx filter 转换"措辞 | streaming.qx/.tpl + social.qx/.tpl + developer.qx/.tpl + QX.conf + Loon.lcf | ✅ |
| H5 | bank-ad-reject snippet 注释补充 Loon.lcf 同步维护提示 | bank-ad-reject.qx + bank-ad-reject.tpl | ✅ |

### 设计差异（非问题）

| 差异 | Loon 处理方式 | QX 处理方式 | 状态 |
|---|---|---|---|
| DNS 泄漏检测 | `Prevent_DNS_Leaks.plugin` 远程引用 | `[filter_local]` 21 条手动添加 | ✅ 等价 |
| QQ音乐 DNS reject | 通过 `qqmusic.plugin` 处理 | `[filter_local]` 16 条 reject | ✅ 机制不同但覆盖 |
| 局域网 IP-CIDR | `[Rule]` 4 条 IP-CIDR DIRECT | `excluded_routes` + `skip_dst_ip` | ✅ 架构差异 |
| Sub-Store | 原生 Plugin + resource-parser | QX 有独立 Sub-Store 生态 | ⚠️ 设计差异，不强行转换 |
| AdvertisingScript | `AdvertisingScript.plugin` 远程引用 | `AllInOne.conf` 已覆盖类似功能 | ⚠️ 设计差异 |
| 起点签到 cron | `qidian.plugin` 内 `cron {CRONEXP}` | `[task_local]` `0 9 * * *` | ✅ 等价 |
| 健康检测/流量通知 cron | `notify.plugin` 内 cron | `[task_local]` cron | ✅ 等价 |
| `prefer-doh3` / `doq-server` | 原生支持 | 取决于 QX 版本，不支持则忽略 | ⚠️ QX 行为 |

---

## 遗留问题和后续计划

| 项 | 优先级 | 说明 |
|----|--------|------|
| ~~策略组拆分~~ | ~~低~~ | ✅ v7.8 已实现 Streaming/AI/Developer/Social 四个独立策略组 |
| ~~Cron 任务扩展~~ | ~~低~~ | ✅ v7.8 已实现节点健康检测（每6小时）+ 流量统计通知（每晚22点） |
| ~~NSRingo bundle.js 版本固定风险~~ | ~~中~~ | ✅ v7.8 已在 mirror-scripts.yml 中添加每日 mirror 逻辑 |
| ~~Sub-Store/QuickSearch ajune0527 依赖~~ | ~~中~~ | ✅ v7.8 已迁移到自维护 Plugin/ 目录 |
| BoxJS 集成 | 低 | QX 端参数配置仍需手动编辑 [prefs_local]，未来可考虑统一 BoxJS 入口简化配置流程 |
| ~~Snippet 域名内容级 diff~~ | ~~中~~ | ✅ v7.8 已升级为逐域名内容 diff |
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

---

## NSRingo bundle.js Investigation (v7.8)

**Date**: 2026-07-22
**Finding**: All 6 NSRingo plugins (WeatherKit, Maps, News, Siri, Search, TestFlight) reference external `.bundle.js` files via `script-path` directives. The plugins are NOT self-contained — they depend on 8 distinct version-pinned `bundle.js` artifacts hosted on GitHub Releases across 4 NSRingo repositories (WeatherKit, GeoServices, News, Siri, TestFlight).

**bundle.js dependency map**:

| Plugin | Version | bundle.js files | Source repo |
|--------|---------|-----------------|------------|
| WeatherKit | v3.1.0 | `response.bundle.js` | NSRingo/WeatherKit |
| Maps | v4.6.1 | `request.bundle.js`, `response.bundle.js` | NSRingo/GeoServices |
| News | v3.2.1 | `request.bundle.js` | NSRingo/News |
| Siri | v4.2.7 | `request.bundle.js` | NSRingo/Siri |
| Search | v4.2.7 | `request.bundle.js`, `response.bundle.js` | NSRingo/Siri |
| TestFlight | v3.4.0 | `request.bundle.js`, `response.bundle.js` | NSRingo/TestFlight |

**Risk**: Each `bundle.js` URL is version-pinned (e.g. `releases/download/v3.1.0/response.bundle.js`). If NSRingo deletes old releases or the repos go private/deleted, these URLs will 404 and the plugins will break silently.

**Mitigation implemented**:
1. **Mirror directory**: `/tmp/loon-config/Mirror/nsringo/` — 8 `bundle.js` files downloaded and committed (total ~830 KB).
2. **`mirror-scripts.yml`**: Added 8 `mirror()` calls (lines 67–89) to daily-download all NSRingo `bundle.js` files at 03:00 UTC.
3. **`upstream-health.yml`**: Added "Check NSRingo bundle.js artifacts" step (lines 70–87) with HTTP status checks for all 8 URLs, results surfaced in the health report and issue alert.
