# 3kaiu/config — Loon & Quantumult X 个人专属网络配置库 (v7.8)

这是一个专为个人网络环境（**单节点东京代理主路由**）深度优化的 iOS 网络工具（Loon 与 Quantumult X）自用配置库。针对您实际使用的 App 进行精准净化，并在双端实现模块化开关控制。

---

## 1. 快速导入链接

### 🍏 Loon
```text
https://ws.wenn.in/main/Profile/Loon.lcf
```

### 🍎 Quantumult X
```text
https://ws.wenn.in/main/Profile/QX.conf
```

### 🛡️ Surge (第三端冗余, v7.8 新增)
```text
https://ws.wenn.in/main/Profile/Surge.conf
```
> Surge 端为 v1 覆盖（路由规则+基础净化脚本，详见配置头部注释）。
> 备用分发（ws.wenn.in 故障时，需先在仓库 Settings 启用 GitHub Pages）：
> `https://3kaiu.github.io/config/Profile/Surge.conf`（Loon/QX 同理，见 `doc/infrastructure.md`）。

---

## 2. 核心净化与增强组件 (按需开启)

本项目秉持“精简且强力”的原则，仅针对您实际使用的 App 进行净化与增强，不集成未安装的应用：

### 📚 2.1 起点读书 (全能助手 Pro - 默认开启)
*   **脚本路径**：`Plugin/qidian.plugin` (Loon) / `QX.conf` `[rewrite_local]` 段 (QX, v7.2 内联) -> 关联本地 [Qidian.js](https://github.com/3kaiu/config/blob/main/Scripts/Qidian.js) (v6.2)
*   **版本**: v6.2 — 修复 finishWatch 重放回归 bug + `$response` ReferenceError + QX cron argument
*   **核心功能**：
    *   **开屏与应用内净化**：全量覆写 getconf 广告配置，清空书架悬浮广告，净化我的账户页推广。
    *   **视频广告秒播**：篡改广告 SDK 数据，将腾讯/穿山甲广告时长修改为 1 秒并播放黑屏。
    *   **视频任务自动重放**：单次看视频自动重放 9 次（激励视频）或 3 次（福利任务），免去重复等待。
    *   **发现页净化**：过滤全部游戏/商城/红包模块，仅保留书单/专栏/IP专区/点点圈。
    *   **每日阅读积分满值**：重写阅读时长（7200秒），任务列表显示为已完成。
    *   **自动签到与高阶福利任务自动化**：每日自动运行，支持静默签到、激励视频碎片、广告起点币任务、每周日自动兑换章节卡以及大咖荐书等全套高阶福利。
    *   **消息推送与远程通知 (Push Notifications)**：默认在签到完成后推送系统级本地通知。支持将签到结果同步推送到第三方通道（如 Bark、Telegram Bot、PushPlus），只需在本地持久化存储中配置对应 Token 即可。
*   **抓取 Cookie 步骤**：
    1. 开启 **起点全能助手 Pro** 模块/重写引用，确保 MitM 包含 `h5.if.qidian.com`。
    2. 打开起点 App -> **我的** -> **福利中心**，弹出 `✨ 抓取起点 Cookie 成功` 通知即表示获取成功。
    3. 获取成功后，建议在列表中关闭/注释此获取 Cookie 的重写以减少网络开销。
*   **通知与任务配置**：
    *   **配置远程通知**：在客户端的本地持久化存储（Loon 的 Persistent Store，或 QX 的 [prefs_local] / 变量编辑）中添加以下对应键值对即可自动启用远程消息推送：
        *   `Bark_Key`：您的 Bark 秘钥（例如 `https://api.day.app/你的秘钥/` 中的秘钥段）
        *   `TG_BOT_TOKEN`：Telegram 机器人的 API Token
        *   `TG_USER_ID`：您的 Telegram 个人账户/频道 ID
        *   `PUSHPLUS_TOKEN`：PushPlus 一对一推送 Token
    *   **任务配置**：Loon 可直接在插件参数中调整各任务开关（默认全开）；QX 在 `QX.conf` 的 `[task_local]` 中通过 `argument=` 键值对调整（起点 cron 的全部开关已按此接好，格式：`debug=false&QDREADER_ADV_JOB_ENABLE=true&...`）。

### 💳 2.2 银行及云闪付去广告
*   **脚本路径**：`Plugin/bank.plugin` (Loon) / `QX.conf` `[filter_local]` 段 (QX, v7.2 内联)
*   **覆盖应用**：云闪付、买单吧 (交通银行)、中国银行 (缤纷生活)、农业银行等主流金融机构。
*   **净化效果**：
    *   拦截启动开屏广告、首页弹窗、广告图加载。
    *   **云闪付净化**：通过 DNS 级 REJECT 实现，无独立脚本。
    *   **类型安全 Mocking**：使用 `reject-dict` (返回 `{}`) 替代直接断网，防止 App 报错崩溃。
    *   **深度兼容与去广告平衡设计**：
        1. **DNS 绕过与 Fake-IP 排除**：在 QX `dns_exclusion_list` 与 Loon `real-ip` 中全量加入主流金融域名，强制使用真实 IP 解析，防范安全检测。
        2. **最高优先级置顶直连**：在分流规则最上方加入本地网银直连块，保障金融交易流量以最高优先级走 DIRECT。
        3. **DNS 级 REJECT 取代 MitM 劫持 (v5.3 修复)**：原先对 `creditcard.bankcomm.com`、`cdn1.mbs.boc.cn`、`enjoy.cdn-static.abchina.com` 等广告 CDN 使用 MitM rewrite 拦截，但这些域名会被 `DOMAIN-SUFFIX bankcomm.com / boc.cn / abchina.com` 的 DIRECT 规则先匹配，导致 MitM 劫持直连 TLS 流量 → 银行 App 网络错误。现改为纯 DNS 级 `REJECT` 在解析阶段直接掐断广告 CDN，完全绕开 MitM，既安全又不破坏网络连通性。所有包含 SSL Pinning 的银行交易/通信 API 域名（如 `creditcardapp.bankcomm.com`、`openapi.boc.cn`、`wallet.95516.com`）默认注释，需越狱设备才能启用。

### 🏠 2.3 智慧房东去广告
*   **脚本路径**：`Plugin/zhihuifangdong.plugin` (Loon) / `QX.conf` `[rewrite_local]` 段 (QX, v7.2 内联)
*   **净化效果**：通过 [Zhihuifangdong.js](https://github.com/3kaiu/config/blob/main/Scripts/Zhihuifangdong.js) 拦截开屏与 Banner 横幅广告，Loon 端支持独立开关控制。

### 🤖 2.4 AI 服务分流
*   **规则路径**：`Plugin/ai.plugin` (Loon) / `QX.conf` `[filter_local]` 段 (QX, v7.3 内联)
*   **分流服务**：OpenAI (ChatGPT)、Anthropic (Claude)、Google AI (Gemini)、Perplexity、Groq、编程助手 (Cursor / Copilot / Windsurf / Supermaven) 等。所有 AI 流量走向独立的 `AI` 策略组（默认指向 Proxy，可手动切换 DIRECT）。

### 📹 2.5 YouTube 增强 (v7.1 统一 Maasea 方案)
*   **脚本路径**：Loon 自维护插件 `Kelee/YouTube_remove_ads.plugin` / QX `[rewrite_local]` 本地规则
*   **脚本来源**：基于 [Maasea/sgmodule](https://github.com/Maasea/sgmodule) 最新脚本，双端统一
*   **增强功能**：
    *   **去广告**：移除视频前/中/后插广告、首页推广、搜索广告、Shorts 广告；拦截 `initplayback` 广告请求、`pagead`/`ptracking` 追踪、`qoe?adcontext` 统计；ctier 302 重定向绕过广告插入点
    *   **熄屏播放 / 画中画 (PiP) / 后台播放**：修改 player 响应播放器设置，原生启用 background play 和 PiP；隐藏技能：点开视频瞬间退出 APP 即可无 PiP 播放（适合听音频）
    *   **下一个播放此视频**：清理 `next` 端点 up next 广告，确保自动播放不被广告打断
    *   **UMP 加密 + log_event 头剥离**：`initplayback` request 检测 `encryptedClientKey` 一致性，按缓存状态清理 `x-youtube-hot-hash-data` 头
    *   **自动翻译字幕**：可通过插件参数配置字幕翻译语言
*   **SponsorBlock 跳段**：代理层无法实现（YouTube 加密 API）。如需自动跳过视频内的赞助商片段、订阅提醒、互动请求等，推荐客户端方案：
    *   iOS：[Yattee](https://github.com/yattee/yattee) (开源, 原生 SponsorBlock 集成) / [uYouEnhanced](https://github.com/arichornlover/uYouEnhanced) (侧载)
    *   Android：[NewPipe](https://newpipe.net/) (开源, SponsorBlock 插件) / [ReVanced](https://revanced.app/)
*   **MitM 保护**：双端 hostname 前置 `-redirector*.googlevideo.com` 负向排除，防止 MitM 解密视频 CDN 重定向服务导致播放故障

### 🍎 2.5b Apple 原生 App 增强 (v5.7 新增)
*   **方案来源**：[NSRingo/iRingo](https://github.com/NSRingo) 项目（原 VirgilClyne/iRingo 已迁移至 NSRingo 组织）
*   **增强范围**：
    *   **天气 (WeatherKit)**：解锁中国大陆被限制的空气质量数据、下一小时降水预报、天气地图。MitM 解密 `weatherkit.apple.com`。
    *   **地图 (Maps)**：解锁卫星地图、周边探索、国际版导航功能。MitM 解密 `configuration.ls.apple.com`、`gspe35-ssl.ls.apple.com`。
    *   **Apple News**：在中国大陆解锁 Apple News App（需走代理）。MitM 解密 `news-*.apple.com`，分流规则将 News 域名指向 Proxy。
    *   **Siri**：解锁 Siri 国际版功能与搜索建议。MitM 解密 `guzzoni.smoot.apple.com`、`api2.smoot.apple.com`。
    *   **TestFlight**：区域解锁、多账户切换、跨平台安装。MitM 解密 `testflight.apple.com`。
*   **MitM 安全**：所有 Apple 增强域名均为具体子域，不影响银行安全。QX 端在 ` -*.apple.com` 负向排除后显式声明这些具体域名来覆盖排除，确保正常解密。
*   **引用格式**：Loon 使用 `.plugin`（GitHub Releases 下载），QX 使用本地转换的 `.conf`（从 iRingo `.plugin` 手动转换为 QX 原生格式，托管在 `QX/apple/` 目录）。⚠️ iRingo 官方的 `.yaml` 不是 QX 原生格式（QX 无法解析），故 v5.8 改为本地转换。QX 端 rewrite 级参数由转换脚本内化处理或采用简化预设。

### 🚫 2.6 全网系统级与 App 深度去广告 (多引擎全覆盖, v7.0 重构)

*   **规则路径**：Loon 插件 (`Plugin/`) / QX 远程重写 (`rewrite_remote`) 默认内置。
*   **v7.0 架构重构**：淘汰停更 2 年的 `ajune0527/vpn_tool` 插件体系，全部改为自维护插件 (引用 ddgksf2013/app2smile 活跃上游脚本)。v7.8 起 Sub-Store.plugin 和 QuickSearch.plugin 也已本地化到 `Plugin/` 目录，完全消除对 ajune0527 仓库的依赖。
*   **净化范围**：
    *   **通用去广告层**：`blackmatrix7/AllInOne.plugin`（Loon + QX 双端统一），740+ MitM hostname + 698 reject 规则 + 21 response 脚本，每日更新。已修复 safebrowsing/jiguang/umeng 误杀风险。
    *   **广告脚本增强层**：`blackmatrix7/AdvertisingScript.plugin`（Loon），含哲也知乎深度净化 + B站/京东/爱奇艺/美团开屏脚本。
    *   **开屏广告通杀层**：`ddgksf2013/FakeiOSAds`（QX）拦截 iOS 系统/第三方 SDK 开屏广告。
    *   **App 精细化去广告**（19 个自维护插件，Loon + QX 双端覆盖）：
        *   **Loon 端**：bilibili、bilicomics、wechat、netease、goofish、qishui、taopiaopiao、amap、jd、qqmusic、reddit、tieba、zhihu（ddgksf2013/app2smile 活跃上游脚本）
        *   **QX 端**：WeiboAds、WeChat、NeteaseAds、AmapAds、TieBaAds、GoofishAds、SmzdmAds、BiliBiliComicsAds、QiShuiMusicAds、RedditAds、CainiaoAds、TaoPiaoPiaoAds、CaiYunAds、Applet（ddgksf2013 独立 conf，每日更新）
        *   **京东**：ddgksf2013 无 JDAds.conf，Loon 端自维护 `jd.plugin`，QX 端本地 `[rewrite_local]` 维护
        *   **知乎**：ddgksf2013 无 ZhihuAds.conf，Loon 端自维护 `zhihu.plugin`，QX 端本地 `[rewrite_local]` 维护
        *   **QQ音乐**：纯 DNS REJECT，无需 MitM（Loon 端 `qqmusic.plugin`，QX 端 `[filter_local]`）
    *   **追踪/埋点拦截层**：主配置内置 20+ 条腾讯/字节/阿里系追踪域名 REJECT。
    *   **HTTPDNS 多维拦截**：`DOMAIN-KEYWORD httpdns REJECT` + `[Host]` 静态映射 + `[Rewrite]` 三层防御。

### 🌍 2.7 全球社交平台与流媒体分流 (v5.4 新增, v5.6 扩展)
*   **规则路径**：`Profile/Loon.lcf` / `Profile/QX.conf` 的 `[Rule]` / `[filter_local]` 段。
*   **分流覆盖**：
    *   **流媒体**：YouTube、Netflix（含 CDN）、Disney+、HBO Max、Spotify、TikTok、Prime Video、Twitch、AbemaTV、TVB、Crunchyroll、Hulu、Paramount+、Peacock、NOW TV、Bilibili 国际版、Apple TV+、Pandora、SoundCloud、Tidal、Deezer。
    *   **社交平台**：Instagram、Twitter/X、Facebook/Meta、Telegram、Reddit、Discord、WhatsApp、Signal、Line、Threads、Mastodon、VK、Tumblr、Bluesky。**中文社区**：V2EX、Linux.do、NodeSeek、HostLoc、Matters、LIHKG、Dcard（需代理访问）。**小说/文学站**：69书吧、sytc.cc、xbiquge.la、biquge.com 等（需代理访问）。
    *   **AI 服务**：OpenAI、Claude、Gemini（含 CDN）、Perplexity、Cursor、Copilot、Codeium、Mistral、Cohere、Replicate、Together.ai、Fireworks.ai 等。
    *   **Google 全家桶**：google.com、googleapis.com、gstatic.com、googlevideo.com、googleusercontent.com、ggpht.com、withgoogle.com、g.co 等。
    *   **开发者平台 (v5.6 新增, v7.8 扩展)**：GitHub、Microsoft/OneDrive/Office 365、Steam、Wikipedia/Wikimedia、GitLab、BitBucket、Atlassian/Jira、npm/PyPI/crates.io、Vercel/Netlify/Cloudflare 等。
    *   **追踪拦截 (v7.8 新增)**：Google 广告与分析 SDK（doubleclick/google-analytics/googletagmanager）、Firebase、Segment/Amplitude/Mixpanel/Branch/Adjust/AppsFlyer/Kochava/Sentry 等 20 条 REJECT。
    *   海外流量按类别分流至独立策略组：流媒体→`Streaming`、AI服务→`AI`、开发者平台→`Developer`、社交平台→`Social`，各策略组默认指向 `Proxy`（自动延迟检测选优），可手动切换 DIRECT。

### 🎮 2.7b Epic Games & epic-kiosk 领游戏分流支持
*   **分流规则**：`Profile/Loon.lcf` (Loon) / `Profile/QX.conf` (QX) -> 远程引用 `blackmatrix7` 维护的 `Epic.list`。
*   **核心功能**：
    *   将 Epic Games 相关的登录、商城、CDN 流量自动路由至 `Proxy` 代理组，支持自动化领取工具 `epic-kiosk`。
    *   将其独立分流至 `Proxy` 策略组，您可在客户端 UI 中为 Epic 切换到住宅 IP 节点（或自行配置代理链）以规避 Epic 的 Cloudflare 防刷盾和 hCaptcha 验证码封锁。

### 🛵 2.8 生活出行去广告 (默认开启)
*   **脚本路径**：`Plugin/life.plugin` (Loon) / QX 端由 ddgksf2013 `CainiaoAds.conf` 覆盖
*   **核心功能**：
    *   **菜鸟包裹**：通过类型安全 JSON-JQ 移除首页瀑布流及推广、我的页面横幅及广告、发现页推广，并阻塞开屏广告下发，支持在 Loon UI 中一键启用/禁用该模块。

---

## 3. 网络运维深度优化设计 (NetOps Expert Rules)

针对您的 **单个东京代理节点**（配置文件中命名为 `🇯🇵 Tokyo_Proxy`）环境，我们实施了专家级的路由与网络加速优化：

```text
[网络请求] ────► [策略组] ──► 🇯🇵 Tokyo_Proxy (自动健康检测)
                  │
                  ├──► Streaming (流媒体) ──┐
                  ├──► AI (AI服务) ─────────┤
                  ├──► Developer (开发者) ──┤──► Proxy (url-test 自动选优) ──► 🇯🇵 Tokyo_Proxy
                  ├──► Social (社交平台) ──┘
                  ├──► Apple (Apple服务) ──┘
                  └──► Final (兜底) ────────┘
                  
[节点不可用时] ───► 显式报错 (不回落 DIRECT，防泄露)
```

1.  **策略组自动健康检测 (Proxy url-test / url-latency-benchmark)**：
    *   主代理策略组采用自动延迟检测设计：`Proxy = url-test, 🇯🇵 Tokyo_Proxy, url=..., interval=600, tolerance=50` (Loon) / `url-latency-benchmark=Proxy, 🇯🇵 Tokyo_Proxy, check-interval=600, alive-checking=false, tolerance=50` (QX)。
    *   **自动选优**：单节点场景下，持续监测节点延迟与可用性，节点可用时自动走节点，无需手动切换。
    *   **流量防泄露优化**：策略组中**不放 DIRECT / direct 作为回落**。当节点不可用时显式报错，让您及时感知并调整。这避免了原本需要代理的敏感流量（如海外搜索、AI、流媒体）在无感知的状态下直接打向真实 IP 导致泄露。
    *   **省电设计**：QX 端 `alive-checking=false` 空闲时不测速，Loon 端 `interval=600` 每10分钟一次（与QX端对齐），平衡实时性与电量。
2.  **Split DNS 分流与双加密加速 (DoQ / DoH3)**：
    *   **国内解析**：通过阿里/腾讯/火山引擎的高速加密 DNS（DoH / DoQ）在本地快速解析，新增火山引擎 DNS (`180.184.11.11`, `180.184.22.22`) 优化字节系/抖音应用解析。
    *   **双端 DoQ 与 DoH3 加速**：Loon 与 Quantumult X 均引入了 DNS over QUIC (`quic://dns.alidns.com`) 和 DoH3 并开启极速首选，极大降低握手延迟，防 DNS 污染与泄露。
    *   **DNS 泄露防护 (no-system)**：开启 QX `no-system`，杜绝并发查询本地方案，防止 DNS 解析泄露给运营商。
    *   **HTTPDNS 多维拦截机制**：
        *   **正则重写**：通过本地重写 `^https?:\/\/119\.29\.29\.29\/d` 直接置空腾讯、阿里等 HTTPDNS 解析接口，强制 App 退回系统安全 DNS。
        *   **规则通杀**：主配置引入 `DOMAIN-KEYWORD / host-keyword, httpdns, REJECT` 进行域名通杀。
        *   **DNS 级静态映射**：在 QX `[dns]` 与 Loon `[Host]` 中将 `httpdns.c.cdnhwc.com`、`httpdns.gslb.netease.com` 等 HTTPDNS 主机域名静态解析至 `0.0.0.0`，在 DNS 解析阶段实现秒杀拦截。
    *   **精准 WebRTC / STUN 阻断**：在双端部署精准 STUN 拦截规则（拦截 `stun` 关键字和 `3478` 端口），防止网页通过 WebRTC 协议泄露您的 IP 地址；同时**精准放行索尼 PlayStation、任天堂 Switch 和微软 Xbox 的联机 STUN 握手**（设置为直连并旁路 Fake-IP），兼顾隐私与主机联机体验。
3.  **TLS 减负与本地旁路 (MitM & skip_dst_ip)**：
    *   主配置中的 MitM 实行极严格的黑白名单隔离：排除微信、支付宝、各类网银等绝大部分安全敏感流量，仅对起点、智慧房东与少数联盟广告域名进行解密，**最大程度确保您的设备省电、网络低延迟与隐私安全**。
    *   **本地与回环旁路 (QX skip_dst_ip)**：对局域网及本地回环地址（如 `192.168.0.0/16`, `127.0.0.1/32`）强制绕过 MitM 握手流程，优化高频本地请求的响应速度，减少无谓的 CPU 加解密开销。
    *   **本地区域网与游戏 DNS 旁路 (QX dns_exclusion_list)**：防止 Apple 服务（AirPlay/HomeKit）和游戏主机联机遭遇 Fake-IP 映射问题，保障网络稳定性。
4.  **YouTube 去广告与 UDP 443 兼容 (v5.3 新增, v6.2 更新)**：
    *   ~~v5.3：双端禁用 UDP 443（Loon `disable-udp-ports = 443` / QX `udp_drop_list = 443`）~~
    *   **v6.2 更新**：移除 `disable-udp-ports = 443` / `udp_drop_list = 443`，因为该设置会直接杀掉 Hysteria2 (UDP 协议) 节点的所有数据包导致不可用。改靠 MitM hostname 覆盖 `*.googlevideo.com` + `-redirector*.googlevideo.com` 负向排除来拦截 YouTube QUIC 流量。如遇广告残留，可临时禁用 UDP 443 作为回退方案。
    *   **v6.3 更新**：YouTube 插件全面升级为 Maasea 最新脚本，新增 `initplayback` UMP 处理 + `log_event` 头剥离 + ctier 302 重定向 + `get_watch`/`config` 响应端点覆盖，广告拦截能力大幅提升。
5.  **银行 App 网络错误根治 (v5.5 P0 修复)**：
    *   **根因**：`myblockads.plugin`(RuCu6) 的 MitM hostname 声明了 `wallet.95516.com`(云闪付)、`mobilepaas.abchina.com.cn`(农行)、`image.mybank.icbc.com.cn`(工行) 等银行核心域名，并对部分域名做 rewrite；QX 端 `blackmatrix7/AllInOne.conf` 声明了 `creditcardapp.bankcomm.*`(交行)、`hcz-member.pingan.com.cn`(平安)、`lban.spdb.com.cn`(浦发)、`v.icbc.com.cn`(工行)、`adv.ccb.com`/`yunbusiness.ccb.com`(建行) 等；`Toperlock/AdBlock.conf` 声明了 `midc.cdn-static.abchina.com.cn`(农行)、`image.spdbccc.com.cn`(浦发信用卡)。这些域名被 MitM 解密后，银行 App 的 SSL Pinning 会拒绝伪造证书 → TLS 握手失败 → App 显示"网络错误"。
    *   **修复**：双端主配置 `[MitM]`/`[mitm]` hostname 列表**前置负向通配符**排除所有银行域名（覆盖 17 家银行 + 银联/云闪付），负向声明优先级高于远程插件的正向声明，确保银行域名**永不被 MitM 解密**。银行去广告完全通过主配置 DNS 级 REJECT 实现，无需解密。

---

## 4. Kelee 插件镜像复用与 v7.0 去依赖演进

### 历史背景

可莉官方插件（`kelee.one`）部署了 **Cloudflare Turnstile** 验证机制。实测结论：任何 HTTP 客户端（curl/wget/GitHub Actions）即使携带 UA 也无法通过，返回 403。只有 Loon App 内部的 WebKit 引擎能通过（且不稳定）。

### v7.0 演进

v7.0 淘汰停更 2 年的 `ajune0527/vpn_tool` 插件体系，替换为自维护的 19 个 `Plugin/*.plugin`；GeoIP/ASN 数据库改用 `Loyalsoldier/geoip` + `P3TERX/GeoLite.mmdb`；Kelee 插件仅保留 `Prevent_DNS_Leaks.plugin` 和自维护的 `YouTube_remove_ads.plugin`。See [CHANGELOG.md](./CHANGELOG.md) for full details.

### v7.8.1 Kelee 功能增强插件引入 (2026-07-23)

从 [hub.kelee.one](https://hub.kelee.one/) 引入 7 个功能增强类 `.lpx` 插件（Loon 专属，QX 不支持 `.lpx` 格式）：

| 插件 | 功能 | 默认状态 |
|------|------|----------|
| Google搜索重定向 | 将 Google 搜索重定向至 .com 域名 | ✅ 启用 |
| Spotify歌词翻译 | 外语歌词翻译为简体中文，双语翻译 | ✅ 启用 |
| 微信外部链接解锁 | 解锁微信外部链接访问限制，跳过中间界面 | ✅ 启用 |
| 京东比价 | 商品详情页面查看比价（需安装慢慢买 App） | ✅ 启用 |
| VVebo时间线修复 | 修复失效的用户时间线（**与微博去广告冲突**） | ❌ 默认禁用 |
| 节点检测工具 | 地理位置/节点解锁/入口落地查询 | ✅ 启用 |
| 代理链路检测 | 查看目标节点的代理走向 | ✅ 启用 |

> **注意**：这些插件通过 `https://kelee.one/Tool/Loon/Lpx/*.lpx` 远程引用。由于 kelee.one 部署了 Cloudflare Turnstile，curl/GitHub Actions 无法下载（返回 403），但 Loon App 内部的 WebKit 引擎可以正常加载。QX 端因不支持 `.lpx` 格式，这些功能增强仅限 Loon 用户使用。
>
> **⚠️ 供应链提示（2026-07 审计）**：`.lpx` 内容对本仓库和 CI 均为黑盒——无法镜像、无法哈希校验、无法健康检查，等于允许第三方站点向设备推送代码。介意者可在 Loon 内停用对应插件（功能降级但风险归零）。
>
> **QX 手动移植路径**（按需）：在 Loon 中导入对应 `.lpx` → 插件列表中查看其 `[Rewrite]`/`[Script]` 文本 → 翻译为 QX 的 `[rewrite_local]` 语法（`url reject-dict`/`url 302`/`url script-response-body`）。纯 rewrite 类（Google搜索重定向、微信外部链接解锁）可直接移植；脚本类（京东比价、Spotify歌词翻译、节点检测）需在 QX 端自写 `script-response-body` 脚本，未审计源码前不建议照搬。

### v7.5 演进

v7.5 新建 `mirror-scripts.yml` 工作流创建外部脚本 CDN Mirror，将全量 plugin `script-path` 迁移到自建 mirror URL，19 个 plugin 统一添加版本元信息，并完成对抗审计加固（`$response` 守卫、MitM 收窄、超时加固）。See [CHANGELOG.md](./CHANGELOG.md) for full details.

### v7.7 可靠性加固 (2026-07-22)

v7.7 正式建立 `mirror-scripts.yml` 与 `Mirror/` 目录，将全量 script-path 切换到自建 CDN；上游健康检查扩展至 12 个检查点；修复 6 个 JS 脚本 Runtime Bug 与 PushPlus 安全漏洞；统一全部版本号为 v7.7；清理死规则。See [CHANGELOG.md](./CHANGELOG.md) for full details.

### v7.8.1 增强插件引入与小说站路由 (2026-07-23)

v7.8.1 从 [hub.kelee.one](https://hub.kelee.one/) 引入 7 个 Loon 功能增强插件（Google搜索重定向/Spotify歌词翻译/微信外部链接解锁/京东比价/VVebo时间线修复/节点检测工具/代理链路检测），补充小说/文学站路由（69书吧/sytc.cc/xbiquge.la 等 9 条双端同步）。See [CHANGELOG.md](./CHANGELOG.md) for full details.

v7.8 完成流媒体/社交平台/AI 服务/开发者平台四维路由补全，新增 Google 广告与追踪 SDK REJECT 规则（20 条双端同步），修复 QX MitM hostname 与 HTTPDNS Rewrite 双端对齐问题，扩展 DNS 泄露检测覆盖至 21 条，修复 README 文档错误，CI 防护从 5 项扩展到 8 项。**策略组拆分**：新增 Streaming/AI/Developer/Social 四个独立策略组，snippet 域名从硬编码 `Proxy` 改为各自策略组名。**定时通知**：新增 `health-notify.js`（每6小时节点健康检测）+ `traffic-notify.js`（每晚22点流量统计/心跳）+ `notify.plugin`。**Sub-Store/QuickSearch 迁移**：从停更的 `ajune0527/vpn_tool` 迁移到自维护 `Plugin/sub-store.plugin` 和 `Plugin/quicksearch.plugin`。**NSRingo bundle.js 镜像**：发现 6 个 NSRingo 插件依赖 8 个版本固定的 `.bundle.js`，已在 `mirror-scripts.yml` 中添加每日 mirror 逻辑到 `Mirror/nsringo/`，并在 `upstream-health.yml` 中添加健康检查。See [CHANGELOG.md](./CHANGELOG.md) for full details.

---

## 5. 项目目录结构

```text
3kaiu/config/
├── .github/
│   └── workflows/
│       ├── sync-kelee.yml          # 每日同步 Prevent_DNS_Leaks.plugin
│       ├── mirror-scripts.yml      # 每日 mirror 外部脚本到 Mirror/
│       ├── upstream-health.yml     # 上游依赖每日健康检查 (12 个源)
│       ├── surgio-build.yml        # Surgio 构建工作流
│       ├── config-validate.yml     # 配置验证 CI (元信息/URL/双端对齐/MitM/引擎哈希)
│       ├── cdn-verify.yml          # CDN 内容哈希校验 (每日, ws.wenn.in vs 仓库)
│       └── pages-deploy.yml        # GitHub Pages 备用分发 (需 Settings 启用)
├── Mirror/                     # 外部脚本缓存 (每日自动同步)
│   ├── nsringo/                   # NSRingo bundle.js 镜像 (8个, 版本固定)
│   ├── youtube.response.js         # YouTube 响应增强
│   ├── youtube.request.js          # YouTube 请求拦截
│   ├── netease.adblock.js          # 网易云音乐去广告
│   ├── bilibili-proto.js           # B站 Proto 去广告
│   ├── bilibili-json.js            # B站 JSON 去广告
│   ├── applet.js                   # 微信小程序去广告
│   └── amdc.js                     # 淘宝/高德 AMDC
├── Kelee/                      # 本地缓存的核心插件
│   ├── Prevent_DNS_Leaks.plugin  # DNS 泄露防护 (ajune0527 镜像, 每日同步)
│   └── YouTube_remove_ads.plugin  # YouTube 增强 (自维护, 基于 Maasea)
├── Plugin/                     # 自维护 Loon 插件 (21个)
│   ├── qidian.plugin            # 起点全能助手 Pro
│   ├── bank.plugin              # 银行及云闪付去广告
│   ├── life.plugin              # 生活出行去广告 (菜鸟包裹)
│   ├── ai.plugin                # AI 服务分流
│   ├── zhihuifangdong.plugin    # 智慧房东去广告
│   ├── bilibili.plugin          # B站去广告
│   ├── bilicomics.plugin        # B站漫画去广告
│   ├── wechat.plugin            # 微信去广告
│   ├── netease.plugin           # 网易云音乐净化
│   ├── goofish.plugin           # 闲鱼去广告
│   ├── qishui.plugin            # 汽水音乐净化
│   ├── taopiaopiao.plugin       # 淘票票净化
│   ├── amap.plugin              # 高德地图去广告 (v7.1 新增)
│   ├── jd.plugin                # 京东去广告 (v7.1 新增)
│   ├── qqmusic.plugin           # QQ音乐去广告 (v7.1 新增)
│   ├── reddit.plugin            # Reddit去广告 (v7.1 新增)
│   ├── tieba.plugin             # 贴吧去广告 (v7.1 新增)
│   ├── zhihu.plugin             # 知乎去广告 (v7.1 新增)
│   ├── sub-store.plugin         # Sub-Store 订阅管理 (v7.8 从 ajune0527 迁移)
│   ├── quicksearch.plugin       # 快捷搜索 (v7.8 从 ajune0527 迁移)
│   └── notify.plugin            # 定时通知: 节点健康+流量统计 (v7.8 新增)
├── provider/                   # Surgio provider 定义
│   └── tokyo.js                   # 东京单节点 provider
├── template/                   # Surgio 模板
│   ├── loon.tpl                  # Loon 主配置模板
│   ├── quantumultx.tpl          # QX 主配置模板
│   ├── surge.tpl                # Surge 主配置模板 (第三端冗余, v7.8)
│   └── snippet/                  # 双端共享路由片段 (Surge 直接复用 .tpl)
│       ├── streaming.tpl         # 流媒体路由 (Loon)
│       ├── streaming.qx          # 流媒体路由 (QX)
│       ├── social.tpl            # 社交平台路由 (Loon)
│       ├── social.qx             # 社交平台路由 (QX)
│       ├── ai-services.tpl       # AI 服务路由 (Loon)
│       ├── ai-services.qx        # AI 服务路由 (QX)
│       ├── developer.tpl        # 开发者平台路由 (Loon)
│       ├── developer.qx         # 开发者平台路由 (QX)
│       ├── bank-ad-reject.tpl   # 银行广告 REJECT 规则 (Loon)
│       └── bank-ad-reject.qx    # 银行广告 REJECT 规则 (QX)
├── QX/                         # QX 配置模块
│   └── apple/                   # Apple 原生增强 (iRingo .plugin→.conf 转换)
│       ├── WeatherKit.conf      # 天气增强
│       ├── Maps.conf            # 地图增强
│       ├── News.conf            # News 解锁
│       ├── Siri.conf            # Siri + 搜索建议增强
│       └── TestFlight.conf      # TestFlight 区域解锁
├── Profile/
│   ├── Loon.lcf                # Loon 客户端主配置文件
│   ├── QX.conf                 # Quantumult X 客户端主配置文件
│   └── Surge.conf              # Surge 客户端主配置文件 (v7.8 新增)
├── Scripts/                    # 自维护脚本
│   ├── ENGINE-MANIFEST.json    # Qidian 内嵌引擎治理清单 (哈希/来源/风险, CI 强校验)
│   ├── Qidian.js               # 起点全能增强运行脚本
│   ├── Zhihuifangdong.js       # 智慧房东去广告脚本
│   ├── Cainiao.js              # 菜鸟包裹净化脚本
│   ├── Amap.js                 # 高德地图去广告 (v7.1)
│   ├── JD.js                   # 京东去广告 (v7.1)
│   ├── Reddit.js               # Reddit去广告 (v7.1)
│   ├── Tieba.js                # 贴吧去广告 (v7.1)
│   ├── Zhihu.js                # 知乎去广告 (v7.1)
│   ├── health-notify.js        # 节点健康检测通知 (v7.8 新增)
│   └── traffic-notify.js       # 流量统计通知 (v7.8 新增)
├── doc/                        # 审计与评估文档
│   ├── audit-v7.7.md           # v7.7 对抗审计报告
│   ├── audit-v7.8.md           # v7.8 对抗审计报告
│   ├── ecosystem-evaluation.md # Loon/QX 生态评估
│   ├── surgio-migration.md     # Surgio 迁移记录
│   └── infrastructure.md       # 分发基础设施台账 (CDN/域名/应急切换)
├── CHANGELOG.md                # 版本变更记录
├── package.json                # Surgio 依赖定义
├── package-lock.json           # 依赖锁定
├── surgio.conf.js              # Surgio 构建配置
└── README.md                   # 本文件
```
