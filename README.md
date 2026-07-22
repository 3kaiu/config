# 3kaiu/config — Loon & Quantumult X 个人专属网络配置库 (v7.7)

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
    *   **任务配置**：Loon 可直接在插件参数中调整各任务开关（默认全开），QX 用户通过 **BoxJs** 调整参数。

### 💳 2.2 银行及云闪付去广告
*   **脚本路径**：`Plugin/bank.plugin` (Loon) / `QX.conf` `[filter_local]` 段 (QX, v7.2 内联)
*   **覆盖应用**：云闪付、买单吧 (交通银行)、中国银行 (缤纷生活)、农业银行等主流金融机构。
*   **净化效果**：
    *   拦截启动开屏广告、首页弹窗、广告图加载。
    *   **云闪付净化**：通过 [UnionPay.js](https://github.com/3kaiu/config/blob/main/Scripts/UnionPay.js) 重写，剔除理财页推广、首页大图、 koala 权益推广（默认注释以防 SSL Pinning 崩溃，越狱/注入用户可手动开启）。
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
*   **分流服务**：OpenAI (ChatGPT)、Anthropic (Claude)、Google AI (Gemini)、Perplexity、Groq、编程助手 (Cursor / Copilot / Windsurf / Supermaven) 等。所有 AI 流量自动走向 Proxy 代理策略组。

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
*   **引用格式**：Loon 使用 `.plugin`（GitHub Releases 下载），QX 使用本地转换的 `.conf`（从 iRingo `.plugin` 手动转换为 QX 原生格式，托管在 `QX/apple/` 目录）。⚠️ iRingo 官方的 `.yaml` 不是 QX 原生格式（QX 无法解析），故 v5.8 改为本地转换。QX 端不支持 argument 传递，参数需通过 BoxJS 配置。

### 🚫 2.6 全网系统级与 App 深度去广告 (多引擎全覆盖, v7.0 重构)

*   **规则路径**：Loon 插件 (`Plugin/`) / QX 远程重写 (`rewrite_remote`) 默认内置。
*   **v7.0 架构重构**：淘汰停更 2 年的 `ajune0527/vpn_tool` 插件体系，全部改为自维护插件 (引用 ddgksf2013/app2smile 活跃上游脚本)。
*   **净化范围**：
    *   **通用去广告层**：`blackmatrix7/AllInOne.plugin`（Loon + QX 双端统一），740+ MitM hostname + 698 reject 规则 + 21 response 脚本，每日更新。已修复 safebrowsing/jiguang/umeng 误杀风险。
    *   **广告脚本增强层**：`blackmatrix7/AdvertisingScript.plugin`（Loon），含哲也知乎深度净化 + B站/京东/爱奇艺/美团开屏脚本。
    *   **开屏广告通杀层**：`ddgksf2013/FakeiOSAds`（QX）拦截 iOS 系统/第三方 SDK 开屏广告。
    *   **App 精细化去广告**（19 个自维护插件，Loon + QX 双端覆盖）：
        *   **Loon 端**：bilibili、bilicomics、weibo、wechat、netease、goofish、qishui、taopiaopiao、amap、jd、qqmusic、reddit、tieba、zhihu（ddgksf2013/app2smile 活跃上游脚本）
        *   **QX 端**：WeiboAds、WeChat、NeteaseAds、AmapAds、TieBaAds、GoofishAds、SmzdmAds、BiliBiliComicsAds、QiShuiMusicAds、RedditAds、CainiaoAds、TaoPiaoPiaoAds、CaiYunAds、Applet（ddgksf2013 独立 conf，每日更新）
        *   **京东**：ddgksf2013 无 JDAds.conf，Loon 端自维护 `jd.plugin`，QX 端本地 `[rewrite_local]` 维护
        *   **知乎**：ddgksf2013 无 ZhihuAds.conf，Loon 端自维护 `zhihu.plugin`，QX 端本地 `[rewrite_local]` 维护
        *   **QQ音乐**：纯 DNS REJECT，无需 MitM（Loon 端 `qqmusic.plugin`，QX 端 `[filter_local]`）
    *   **追踪/埋点拦截层**：主配置内置 20+ 条腾讯/字节/阿里系追踪域名 REJECT。
    *   **HTTPDNS 多维拦截**：`DOMAIN-KEYWORD httpdns REJECT` + `[Host]` 静态映射 + `[Rewrite]` 三层防御。

### 🌍 2.7 全球社交平台与流媒体分流 (v5.4 新增, v5.6 扩展)
*   **规则路径**：`Profile/Loon.lcf` / `Profile/QX.conf` 的 `[Rule]` / `[filter_local]` 段。
*   **分流覆盖**：
    *   **流媒体**：YouTube、Netflix（含 CDN）、Disney+、HBO Max、Spotify、TikTok、Prime Video、Twitch、AbemaTV、TVB。
    *   **社交平台**：Instagram、Twitter/X、Facebook/Meta、Telegram、Reddit、Discord。
    *   **AI 服务**：OpenAI、Claude、Gemini（含 CDN）、Perplexity、Cursor、Copilot、Codeium 等。
    *   **Google 全家桶**：google.com、googleapis.com、gstatic.com、googlevideo.com 等。
    *   **开发者平台 (v5.6 新增)**：GitHub、Microsoft/OneDrive/Office 365、Steam、Wikipedia/Wikimedia。
    *   所有海外流量统一走向 `Proxy` 代理组（自动延迟检测选优）。

### 🎮 2.7 Epic Games & epic-kiosk 领游戏分流支持
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
[网络请求] ────► [策略组 (Proxy)] ──► 🇯🇵 Tokyo_Proxy (自动健康检测)
                  │
                  └──► [节点不可用时] ───► 显式报错 (不回落 DIRECT，防泄露)
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

*   **Loon 核心 Kelee 插件**：仅保留 `Prevent_DNS_Leaks.plugin`（DNS 泄露防护）和自维护的 `YouTube_remove_ads.plugin`。
*   **`Remove_ads_by_keli.plugin` / `myblockads.plugin` 已停用**：v7.0 起由 `blackmatrix7/AllInOne.plugin`（740+ hostname 每日更新）全面取代，更全面且无 safebrowsing 误杀风险。
*   **ajune0527/vpn_tool App 插件体系已淘汰**：停更 2 年（最后一次更新 2024-07），22 个插件文件已移至 `archive/ajune0527-legacy/`。替换为自维护的 19 个 `Plugin/*.plugin`（引用 ddgksf2013/app2smile 活跃上游脚本）。
*   **GeoIP/ASN 数据库**：改用 `Loyalsoldier/geoip`（Country.mmdb）+ `P3TERX/GeoLite.mmdb`（ASN），不再依赖 kelee.one。
*   **同步工作流**：`sync-kelee.yml` 仍每日同步 Kelee 核心插件，`mirror-scripts.yml` 每日 mirror 7 个外部脚本到 `Mirror/` 目录，`upstream-health.yml` 每日检查所有上游源可用性。

### v7.5 演进

*   **外部脚本 CDN Mirror**：新建 `mirror-scripts.yml` 工作流，每日从 ddgksf2013/app2smile/Maasea 等 4 个上游源 mirror 外部脚本到 `Mirror/` 目录，通过 GitHub raw 提供自建 CDN。消除上游删库/离线单点故障风险。
*   **全量 plugin 引用迁移**：7 个 plugin + QX.conf + YouTube plugin 的 `script-path` 全部从上游原始 URL 切换到自建 mirror URL。
*   **19 个 plugin 统一添加 `#!version=7.4` 元信息**，便于版本追踪。
*   **对抗审计加固**：全部 9 个 JS 脚本添加 `$response` 守卫（防 AllInOne MitM 误触）、双端 MitM 移除 `*.google.com` 防止 Gmail/Drive 被意外解密、冗余 MitM 域名清理、curl GitHub Actions 超时加固。

### v7.7 可靠性加固 (2026-07-22)

*   **mirror-scripts.yml 正式建立**：创建 `Mirror/` 目录，工作流每日从 4 个上游源 mirror 7 个外部脚本（netease.adblock.js、amdc.js、applet.js、bilibili-json.js、bilibili-proto.js、youtube.request.js、youtube.response.js）到 `Mirror/`，消除 gist/raw.githubusercontent 单点依赖。
*   **全量 script-path 切换到自建 CDN**：18 个 plugin + QX.conf + YouTube plugin 的引用全部切换到 `ws.wenn.in/main/Mirror/`。Netease 插件 22 处 gist 依赖一次性消除。
*   **上游健康检查扩展**：从 4 个检查点扩展到 12 个：新增 ws.wenn.in CDN、ddgksf2013 gist、ddgksf2013/Scripts、5 个 NSRingo 仓库、ajune0527。
*   **双端配置对齐**：QX.conf 补充微信 DIRECT 规则（wechat.com/weixin.qq.com/wx.qq.com/qpic.cn）、补充 5 条缺失的 Proxy 路由（twittercdn/tdesktop/steamcdn-a.akamaihd.net/onedrive.live/wikimediafoundation.org）。
*   **版本号全面统一**：Loon.lcf → v7.7（原 v7.6）、QX.conf → v7.7（原 v17.0 typo）、全部 20 个 plugin → v7.7（原 v7.4/v7.6 混用）。
*   **JS 脚本 Runtime Bug 修复**：6 个脚本（Amap/JD/Tieba/Reddit/Zhihu/Cainiao）的 catch 块 `$.done()` → `$done()`，消除 JSON 解析失败时的 ReferenceError。
*   **PushPlus 安全修复**：Qidian.js 的推送端点 `http://` → `https://`。
*   **退化存根诚实标注**：qishui.plugin 和 wechat.plugin 的描述准确反映上游脚本已删除、改用纯 reject 规则。
*   **死规则清理**：移除 QX.conf 中重复的 `tangram.e.qq.com`（line 431）、移除 Loon.lcf 中被 keyword 通杀掉覆盖的 2 条显式 httpdns 规则。

---

## 5. 项目目录结构

```text
3kaiu/config/
├── .github/
│   └── workflows/
│       ├── sync-kelee.yml          # 每日同步 Prevent_DNS_Leaks.plugin
│       ├── mirror-scripts.yml      # 每日 mirror 外部脚本到 Mirror/
│       └── upstream-health.yml     # 上游依赖每日健康检查 (12 个源)
├── Mirror/                     # 外部脚本缓存 (每日自动同步)
├── Kelee/                      # 本地缓存的核心插件
│   ├── Prevent_DNS_Leaks.plugin  # DNS 泄露防护 (ajune0527 镜像, 每日同步)
│   └── YouTube_remove_ads.plugin  # YouTube 增强 (自维护, 基于 Maasea)
├── Plugin/                     # 自维护 Loon 插件 (19个App覆盖)
│   ├── qidian.plugin            # 起点全能助手 Pro
│   ├── bank.plugin              # 银行及云闪付去广告
│   ├── life.plugin              # 生活出行去广告 (菜鸟包裹)
│   ├── ai.plugin                # AI 服务分流
│   ├── zhihuifangdong.plugin    # 智慧房东去广告
│   ├── bilibili.plugin          # B站去广告
│   ├── bilicomics.plugin        # B站漫画去广告
│   ├── weibo.plugin             # 微博去广告
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
│   └── zhihu.plugin             # 知乎去广告 (v7.1 新增)
├── QX/                         # QX 配置模块
│   └── apple/                   # Apple 原生增强 (iRingo .plugin→.conf 转换)
│       ├── WeatherKit.conf      # 天气增强
│       ├── Maps.conf            # 地图增强
│       ├── News.conf            # News 解锁
│       ├── Siri.conf            # Siri + 搜索建议增强
│       └── TestFlight.conf      # TestFlight 区域解锁
├── Profile/
│   ├── Loon.lcf                # Loon 客户端主配置文件
│   └── QX.conf                 # Quantumult X 客户端主配置文件
└── Scripts/                    # 自维护脚本
    ├── Qidian.js               # 起点全能增强运行脚本
    ├── Zhihuifangdong.js       # 智慧房东去广告脚本
    ├── UnionPay.js             # 云闪付净化脚本
    ├── Cainiao.js              # 菜鸟包裹净化脚本
    ├── Amap.js                 # 高德地图去广告 (v7.1)
    ├── JD.js                   # 京东去广告 (v7.1)
    ├── Reddit.js               # Reddit去广告 (v7.1)
    ├── Tieba.js                # 贴吧去广告 (v7.1)
    └── Zhihu.js                # 知乎去广告 (v7.1)
```
