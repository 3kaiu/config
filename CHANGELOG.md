# Changelog

All notable changes to the 3kaiu/config Loon & Quantumult X configuration project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [v7.8] — 2026-07-22

### Added

- **流媒体路由补全**：新增 Netflix CDN（nflximg.net / nflximg.com / nflxext.com / netflixcdn.net / nrdns.netflix.com）、Spotify CDN（spotify.map.fastly.net）、TikTok CDN（tiktokcdn.com / tiktokv.com / muscdn.com）、HBO Max CDN（hbo.com / hbomaxcdn.com）、Disney+ CDN（disney.api.edge.bamgrid.com，DOMAIN 精确匹配）、Crunchyroll（crunchyroll.com / v.vrv.co）、Hulu、Paramount+、Peacock、NOW TV、Bilibili 国际版（bilibili.tv）、Apple TV+（tv.apple.com，DOMAIN 精确匹配）、Pandora、SoundCloud、Tidal、Deezer 的路由规则。
- **社交平台路由补全**：新增 WhatsApp、Signal、Line、Threads、Mastodon、VK、Tumblr、Bluesky 路由规则；补充 Reddit CDN（redditmedia.com / redd.it / reddesignimg.com）；Discord CDN 域名在主配置 Rule 中已有声明，snippet 中添加注释说明。**中文社区补全**：新增 V2EX、Linux.do、NodeSeek、HostLoc、1024、Matters、LIHKG、Dcard 路由规则——这些中文内容社区在中国大陆需代理访问，原配置缺失会导致走 FINAL(direct) 无法打开。
- **AI 服务路由补全**：将 `ai.plugin` 全部域名同步到 snippet。新增 OpenAI CDN（openaiapi-site.azureedge.net / openaicom-api…azurefd.net，auth0.openai.com 用 DOMAIN 精确匹配）、Google AI 补全（bard.google.com / makersuite.google.com / generativelanguage.googleapis.com / alkalimakersuite-pa.googleapis.com / deepmind.com）、AI 音视频（elevenlabs.com）、新兴 AI（mistral.ai / cohere.com / replicate.com / together.ai / fireworks.ai）、AI 编程工具补全（cursor.com / cursor-api.com / github.copilot.com 用 DOMAIN / copilot-proxy.githubusercontent.com / codeiumserver.com / windsurf.ai / supermaven.com）。
- **开发者平台路由补全**：新增 Google 开发者（developers.google.com / cloud.google.com / firebase.google.com 用 DOMAIN / firebaseio.com / firebase.googleapis.com）、Microsoft 开发者补全（visualstudio.com / azure.com / azure-devices.com / nuget.org / msdn.com）、包管理器（npmjs.com / npmjs.org / pypi.org / pythonhosted.org / crates.io / rubygems.org / packagist.org）、代码托管/CI（gitlab.com / bitbucket.org / circleci.com / travis-ci.org）、开发工具（atlassian.com / confluence.com / jira.com / hashicorp.com）、文档/知识库（dev.to / hashnode.com / digitalocean.com / herokuapp.com / vercel.com / netlify.com / netlify.app / cloudflare.com / workers.dev）、Stack Exchange 补充（stackexchange.com / serverfault.com / superuser.com）、Linux/开源（kernel.org / gnu.org / opensuse.org / fedoraproject.org / archlinux.org / debian.org / ubuntu.com）。
- **Google 全家桶代理域名**：新增 googleusercontent.com / ggpht.com / withgoogle.com 走 Proxy，g.co 用 DOMAIN 精确匹配走 Proxy。
- **Google 广告与分析 SDK REJECT 规则（20 条）**：googleadservices.com / doubleclick.net / googlesyndication.com / google-analytics.com / googletagmanager.com / googletagservices.com / adservice.google.com / firebaseinstallations.googleapis.com / app-measurement.com / analytics.google.com / crashlytics.googleapis.com / segment.io / amplitude.com / mixpanel.com / branch.io / adjust.com / appsflyer.com / kochava.com / sentry.io，双端同步。
- **QX MitM hostname 补充 9 个域名**：amdc.m.taobao.com、m5.amap.com、m5-zb.amap.com、m-cloud.zhihu.com、tiebac.baidu.com、tieba.baidu.com、tiebaapi.baidu.com、gql.reddit.com、gql-fed.reddit.com，修复 QX 端高德/贴吧/Reddit/知乎插件 MitM 解密不生效问题。
- **QX HTTPDNS Rewrite 补充 2 条**：1.12.12.12/d、120.53.53.53/d，与 Loon 端对齐（共 5 条）。
- **QX DNS 泄露检测域名补充 16 条**：expressvpn.com / nordvpn.com / surfshark.com / perfect-privacy.com / browserleaks.org / vpnunlimited.com / whrq.net / astrill.com / astrill.org / dnsleak.asn247.net / surfsharkdns.com / pixelscan.net / ipapi.co / ipv4.ping0.cc / ipv6.ping0.cc / ip-scan.adspower.net，与 Prevent_DNS_Leaks.plugin 对齐（共 21 条）。
- **CI 防护新增 3 项检查**：Step 5 MitM hostname 双端 diff 检查（warning）、Step 6 HTTPDNS Rewrite 对齐检查（warning）、Step 7 Snippet 双端对齐检查（fail）。CI 检查项从 5 项扩展到 8 项。
- **策略组拆分**：新增 Streaming / AI / Developer / Social 四个独立 select 策略组（Loon + QX 双端），snippet 中流媒体/AI/社交/开发者域名从硬编码 `Proxy` 改为各自策略组名。单节点场景下核心价值是：当某节点被 ChatGPT 封锁时可手动切换 AI 组而不影响流媒体。`ai.plugin` 的 `AI_Policy` 默认值从 `"Proxy"` 改为 `"AI"`。
- **定时通知脚本**：新增 `Scripts/health-notify.js`（每6小时通过 Cloudflare generate_204 检测节点连通性，失败时推送 Bark/Telegram 通知）和 `Scripts/traffic-notify.js`（每晚22点推送 Loon 运行状态/流量摘要心跳通知），配套 `Plugin/notify.plugin` 包含两个 cron 任务。
- **Sub-Store / QuickSearch 本地化**：从停更 2 年的 `ajune0527/vpn_tool` 仓库迁移到自维护的 `Plugin/sub-store.plugin` 和 `Plugin/quicksearch.plugin`，引用 URL 从 `raw.githubusercontent.com/ajune0527/...` 切换到 `ws.wenn.in/main/Plugin/...`，完全消除对 ajune0527 仓库的依赖。
- **NSRingo bundle.js 镜像**：发现 6 个 NSRingo 插件依赖 8 个版本固定的 `.bundle.js` 文件（如 `releases/download/v3.1.0/response.bundle.js`）。在 `mirror-scripts.yml` 中添加每日 mirror 逻辑到 `Mirror/nsringo/` 目录，在 `upstream-health.yml` 中添加 8 个 bundle.js URL 的健康检查。消除 NSRingo 清理旧 release 导致 404 的风险。
- **real-ip 补充 Apple 推送域名**：Loon `real-ip` 和 QX `dns_exclusion_list` 双端新增 `*.push.apple.com`、`*.apns.apple.com`、`captive.apple.com`，确保 Apple 推送服务和网络检测不被 Fake-IP 干扰。

### Fixed

- **README 脚本引用修复**：移除正文中不存在的 `Scripts/UnionPay.js` 引用，改为"云闪付净化通过 DNS 级 REJECT 实现，无独立脚本"。
- **README 目录树修复**：移除虚假的 `weibo.plugin`（实际不存在）；插件数从 "22个" 修正为 "21个"；移除重复列出的 `zhihu.plugin`；Loon 端描述移除 `weibo`；补充 `doc/`、`CHANGELOG.md`、`package.json`、`surgio.conf.js` 等缺失目录。
- **googleapis.com 路由冲突修复 (P1-1)**：streaming snippet 中的 Google 通配域名（gstatic.com / googleapis.com / google.com / google.co.jp）在 QX 顺序匹配中截胡了 developer snippet 的 `host, firebase.googleapis.com, Developer`。将 Google 通配域名移至 developer snippet include 之后，六端同步（streaming.qx/.tpl + quantumultx.tpl + QX.conf + loon.tpl + Loon.lcf）。
- **插件 MitM hostname %APPEND% 改造**：5 个插件（life / qidian / quicksearch / sub-store / zhihuifangdong）的 `hostname =` 改为 `hostname = %APPEND%`，避免覆盖主配置全局 hostname 列表导致银行域名负向排除失效。
- **JS 脚本 $response 守卫**：7 个 JS 脚本（Zhihuifangdong / Amap / JD / Cainiao / Zhihu / Reddit / Tieba）添加 `if (typeof $response === "undefined") { $done(); return; }` 守卫，防止 AllInOne 重写规则以非 response 模式触发时脚本崩溃。
- **QX 端 QQ 音乐 REJECT 补全**：补充 14 条 QQ 音乐 DNS REJECT 规则（adstats/ad/adcdn/adcdn6/adexpo/adclick.tencentmusic.com + otheve.beacon/mazu.m.qq/monitor.music.qq/stat.y/tmead.y.qq + oth.str.mdt/h.trace/sdk.e/p.l/us.l.qq + imtmp.net + qreport）。
- **QX 端 GDT DIRECT 补全**：补充 6 条 GDT 广告 SDK DIRECT 规则（mi.gdt/ii.gdt/c.gdt/adsmind.gdtimg/adsmind.ugdtimg/pgdt.gtimg）。
- **QX task_local 同步**：同步 Loon 端 3 个 cron 任务到 QX task_local（起点签到 / health-notify / traffic-notify）。
- **QX apple conf script-path 迁移**：5 个 QX apple conf 文件（Maps / News / Siri / TestFlight / WeatherKit）的 24 个 `script-path` 从 `github.com/NSRingo/.../releases/download/vX.Y.Z/*.bundle.js` 迁移到 `ws.wenn.in/main/Mirror/nsringo/*.bundle.js` 自建 CDN。
- **Loon × QX 语法兼容性审计**：全量交叉审计两端语法差异（规则关键字大小写、reject 变体支持、rewrite 语法格式、MitM 机制、Plugin 支持、Cron 机制、DNS 分流机制）。确认两端语法各自正确，无功能失效。
- **Loon 端 GDT 白名单补全**：补充 `adsmind.gdtimg.com`、`adsmind.ugdtimg.com`、`pgdt.gtimg.cn` 3 条 DIRECT 规则，与 QX 端 6 条对齐（原仅 3 条）。
- **QX 端 QuickSearch 补全**：QX 端补充 8 条 DuckDuckGo 302 重定向规则（Safari 快捷搜索），MitM hostname 添加 `duckduckgo.com`，与 Loon 端 `quicksearch.plugin` 功能对齐。
- **QX rewrite_local 风格统一**：2 条 Zhihu 规则从 `http-response ^pattern url script-response-body` 改为 `^pattern url script-response-body`（无阶段前缀），与段内其余 40 条规则风格一致。
- **snippet 注释修正**：`.qx` 文件标注 `QX 格式`，`.tpl` 文件标注 `Loon 格式`，移除误导性的"QX 通过 quantumultx filter 转换"措辞。

### Changed

- **版本号全面升级**：Loon.lcf / QX.conf → v7.8、全部 20 个 plugin `#!version=` → 7.8、`package.json` → 7.8.0、ai-services snippet 注释 → v7.8。

---

## [v7.7] — 2026-07-22

### Added

- **mirror-scripts.yml 工作流正式建立**：创建 `Mirror/` 目录，每日从 4 个上游源（ddgksf2013/app2smile/Maasea 等）mirror 7 个外部脚本（netease.adblock.js、amdc.js、applet.js、bilibili-json.js、bilibili-proto.js、youtube.request.js、youtube.response.js）到 `Mirror/`，通过 GitHub raw 提供自建 CDN，消除 gist/raw.githubusercontent 单点依赖。
- **上游健康检查扩展**：`upstream-health.yml` 从 4 个检查点扩展到 12 个，新增 ws.wenn.in CDN、ddgksf2013 gist、ddgksf2013/Scripts、5 个 NSRingo 仓库、ajune0527。
- **config-validate.yml CI 创建**：新增配置验证 CI，包含 5 项检查（Plugin 元信息完整性、script-path URL 可达性、Loon vs QX 双端交叉核对、银行域名 MitM 冲突检测、版本号一致性）。
- **QX.conf 补充微信 DIRECT 规则**：wechat.com / weixin.qq.com / wx.qq.com / qpic.cn。
- **QX.conf 补充 5 条缺失 Proxy 路由**：twittercdn / tdesktop / steamcdn-a.akamaihd.net / onedrive.live / wikimediafoundation.org。
- **银行域名负向排除交叉引用注释**：双端配置添加银行域名 MitM 排除的交叉引用注释。
- **新兴 AI 服务域名补充**：DeepSeek / xAI / Midjourney / Suno / ElevenLabs / Runway / Luma。

### Changed

- **全量 script-path 切换到自建 CDN**：18 个 plugin + QX.conf + YouTube plugin 的引用全部切换到 `ws.wenn.in/main/Mirror/`。Netease 插件 22 处 gist 依赖一次性消除。
- **版本号全面统一**：Loon.lcf → v7.7（原 v7.6）、QX.conf → v7.7（原 v17.0 typo）、全部 20 个 plugin → v7.7（原 v7.4/v7.6 混用）。
- **退化存根诚实标注**：`qishui.plugin` 和 `wechat.plugin` 的描述准确反映上游脚本已删除、改用纯 reject 规则的实际状态。

### Fixed

- **JS 脚本 Runtime Bug 修复**：6 个脚本（Amap / JD / Tieba / Reddit / Zhihu / Cainiao）的 catch 块 `$.done()` → `$done()`，消除 JSON 解析失败时的 ReferenceError。
- **PushPlus 安全修复**：`Qidian.js` 的推送端点 `http://` → `https://`。
- **死规则清理**：移除 QX.conf 中重复的 `tangram.e.qq.com`（line 431）；移除 Loon.lcf 中被 `DOMAIN-KEYWORD httpdns` 通杀覆盖的 2 条显式 httpdns 规则。

---

## [v7.5] — 2026-07-22

### Added

- **外部脚本 CDN Mirror**：新建 `mirror-scripts.yml` 工作流，每日从 ddgksf2013/app2smile/Maasea 等 4 个上游源 mirror 外部脚本到 `Mirror/` 目录，通过 GitHub raw 提供自建 CDN，消除上游删库/离线单点故障风险。

### Changed

- **全量 plugin 引用迁移**：7 个 plugin + QX.conf + YouTube plugin 的 `script-path` 全部从上游原始 URL 切换到自建 mirror URL。
- **19 个 plugin 统一添加 `#!version=7.4` 元信息**，便于版本追踪。

### Fixed

- **对抗审计加固**：全部 9 个 JS 脚本添加 `$response` 守卫（防 AllInOne MitM 误触）；双端 MitM 移除 `*.google.com` 防止 Gmail/Drive 被意外解密；冗余 MitM 域名清理；curl GitHub Actions 超时加固。

---

## [v7.0]

### Added

- **自维护 19 个 Loon 插件**：新建 `Plugin/` 目录，包含 19 个 App 覆盖插件（bilibili、bilicomics、weibo、wechat、netease、goofish、qishui、taopiaopiao、amap、jd、qqmusic、reddit、tieba、zhihu、qidian、bank、life、ai、zhihuifangdong），引用 ddgksf2013/app2smile 活跃上游脚本，替代停更的 ajune0527 体系。
- **QX 端独立 conf 覆盖**：WeiboAds、WeChat、NeteaseAds、AmapAds、TieBaAds、GoofishAds、SmzdmAds、BiliBiliComicsAds、QiShuiMusicAds、RedditAds、CainiaoAds、TaoPiaoPiaoAds、CaiYunAds、Applet 等独立 conf，每日更新。
- **通用去广告层**：引入 `blackmatrix7/AllInOne.plugin`（Loon + QX 双端统一），740+ MitM hostname + 698 reject 规则 + 21 response 脚本，每日更新。已修复 safebrowsing/jiguang/umeng 误杀风险。
- **广告脚本增强层**：引入 `blackmatrix7/AdvertisingScript.plugin`（Loon），含哲也知乎深度净化 + B站/京东/爱奇艺/美团开屏脚本。
- **开屏广告通杀层**：引入 `ddgksf2013/FakeiOSAds`（QX）拦截 iOS 系统/第三方 SDK 开屏广告。
- **追踪/埋点拦截层**：主配置内置 20+ 条腾讯/字节/阿里系追踪域名 REJECT。
- **HTTPDNS 多维拦截**：`DOMAIN-KEYWORD httpdns REJECT` + `[Host]` 静态映射 + `[Rewrite]` 三层防御。
- **Kelee 插件镜像复用保留**：仅保留 `Prevent_DNS_Leaks.plugin`（DNS 泄露防护）和自维护的 `YouTube_remove_ads.plugin`。

### Changed

- **ajune0527/vpn_tool 插件体系淘汰**：停更 2 年（最后一次更新 2024-07）的 22 个插件文件移至 `archive/ajune0527-legacy/`，全部替换为自维护的 19 个 `Plugin/*.plugin`。
- **GeoIP/ASN 数据库迁移**：改用 `Loyalsoldier/geoip`（Country.mmdb）+ `P3TERX/GeoLite.mmdb`（ASN），不再依赖 kelee.one。
- **`Remove_ads_by_keli.plugin` / `myblockads.plugin` 停用**：由 `blackmatrix7/AllInOne.plugin`（740+ hostname 每日更新）全面取代，更全面且无 safebrowsing 误杀风险。
- **同步工作流**：`sync-kelee.yml` 每日同步 Kelee 核心插件，`mirror-scripts.yml` 每日 mirror 外部脚本到 `Mirror/` 目录，`upstream-health.yml` 每日检查所有上游源可用性。

### Removed

- **ajune0527/vpn_tool 全部 22 个插件文件**：移至 `archive/ajune0527-legacy/` 存档。
- **`Remove_ads_by_keli.plugin`**：由 blackmatrix7/AllInOne.plugin 取代。
- **`myblockads.plugin`**：由 blackmatrix7/AllInOne.plugin 取代。
- **kelee.one GeoIP/ASN 依赖**：改用 Loyalsoldier/geoip + P3TERX/GeoLite.mmdb。
