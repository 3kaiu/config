# 3kaiu/config — Loon & Quantumult X 个人专属网络配置库

这是一个专为个人网络环境（**单节点东京代理主路由**）深度优化的 iOS 网络工具（Loon 与 Quantumult X）自用配置库。针对您实际使用的 App 进行精准净化，并在双端实现模块化开关控制。

---

## 1. 快速导入链接

### 🍏 Loon
```text
https://raw.githubusercontent.com/3kaiu/config/main/Profile/Loon.lcf
```

### 🍎 Quantumult X
```text
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX.conf
```

---

## 2. 核心净化与增强组件 (按需开启)

本项目秉持“精简且强力”的原则，仅针对您实际使用的 App 进行净化与增强，不集成未安装的应用：

### 📚 2.1 起点读书 (全能助手 Pro - 默认开启)
*   **脚本路径**：`Plugin/qidian.plugin` (Loon) / `QX/qidian.conf` (QX) -> 关联本地 [Qidian.js](https://github.com/3kaiu/config/blob/main/Scripts/Qidian.js)
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
*   **脚本路径**：`Plugin/bank.plugin` (Loon) / `QX/bank.conf` (QX)
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
*   **脚本路径**：`Plugin/zhihuifangdong.plugin` (Loon) / `QX/zhihuifangdong.conf` (QX)
*   **净化效果**：通过 [Zhihuifangdong.js](https://github.com/3kaiu/config/blob/main/Scripts/Zhihuifangdong.js) 拦截开屏与 Banner 横幅广告，Loon 端支持独立开关控制。

### 🤖 2.4 AI 服务分流
*   **规则路径**：`Plugin/ai.plugin` (Loon) / `QX/ai.conf` 远程规则引用 (QX)
*   **分流服务**：OpenAI (ChatGPT)、Anthropic (Claude)、Google AI (Gemini)、Perplexity、Groq、编程助手 (Cursor / Copilot / Windsurf / Supermaven) 等。所有 AI 流量自动走向 Proxy 代理策略组。

### 📹 2.5 YouTube 增强
*   **脚本路径**：主配置 `[Rule]` 规则路由 (Loon/QX) + 远程去广告插件 (Loon Kelee `YouTube_remove_ads.lpx` / QX `youtube.conf`)
*   **净化效果**：屏蔽 YouTube App 视频中插广告、首页信息流推广，并提供后台播放 (画中画) 支持。

### 🚫 2.6 全网系统级与 App 深度去广告 (多引擎全覆盖)
*   **规则路径**：Loon 插件 (`Plugin`) / QX 远程重写 (`rewrite_remote`) 默认内置。
*   **净化范围**：整合全网最有价值的 App 去广告方案，采用**多引擎分层覆盖**设计：
    *   **通用去广告层**：`blackmatrix7/AllInOne`（QX）+ `Remove_ads_by_keli.plugin` + `myblockads.plugin`(RuCu6)（Loon）覆盖系统级广告域名、追踪 SDK。
    *   **开屏广告通杀层**：`ddgksf2013/FakeiOSAds`（QX）拦截 iOS 系统/第三方 SDK 开屏广告。
    *   **按 App 精细化去广告层**（v5.4 新增，v5.5 扩展备份）：
        *   **Loon 端**（ajune0527/vpn_tool 插件）：微博、微信公众号、Bilibili、网易云音乐、高德地图、淘宝、京东、百度贴吧、喜马拉雅、酷安、IT之家、百度网盘、Reddit、Soul 等 14+ App 独立去广告插件。v5.5 起全部纳入 GitHub Actions 每日同步备份至 `Plugins/` 目录，防上游删除/改名失效。
        *   **QX 端**（ddgksf2013 + app2smile）：微博、微信、网易云音乐、高德地图、百度贴吧、闲鱼、喜马拉雅、什么值得买、Bilibili(主App+漫画)、车来了、中国联通、网易邮箱、墨迹天气、汽水音乐、小宇宙播客、Reddit 等 16+ App 独立去广告配置。
    *   **追踪/埋点拦截层**：主配置 `[Rule]` 段内置 23 条腾讯/字节/阿里系追踪域名 REJECT，与去广告插件互补。
    *   **多维度 HTTPDNS 拦截**：`DOMAIN-KEYWORD httpdns REJECT` + `[Host]` 静态映射 `0.0.0.0` + `[Rewrite]` reject，三层拦截防 DNS 污染。

### 🌍 2.7 全球社交平台与流媒体分流 (v5.4 新增)
*   **规则路径**：`Profile/Loon.lcf` / `Profile/QX.conf` 的 `[Rule]` / `[filter_local]` 段。
*   **分流覆盖**：
    *   **流媒体**：YouTube、Netflix（含 CDN）、Disney+、HBO Max、Spotify、TikTok、Prime Video、Twitch、AbemaTV、TVB。
    *   **社交平台**：Instagram、Twitter/X、Facebook/Meta、Telegram、Reddit、Discord。
    *   **AI 服务**：OpenAI、Claude、Gemini（含 CDN）、Perplexity、Cursor、Copilot、Codeium 等。
    *   **Google 全家桶**：google.com、googleapis.com、gstatic.com、googlevideo.com 等。
    *   所有海外流量统一走向 `Proxy` 代理组（自动延迟检测选优）。

### 🎮 2.7 Epic Games & epic-kiosk 领游戏分流支持
*   **分流规则**：`Profile/Loon.lcf` (Loon) / `Profile/QX.conf` (QX) -> 远程引用 `blackmatrix7` 维护的 `Epic.list`。
*   **核心功能**：
    *   将 Epic Games 相关的登录、商城、CDN 流量自动路由至 `Proxy` 代理组，支持自动化领取工具 `epic-kiosk`。
    *   将其独立分组，方便您在客户端 UI 中单独切换其节点到 **Proxy Chain 代理链（前置中转节点 ➡️ 原生住宅 IP 出口节点）**，完美规避 Epic 严格的 Cloudflare 防刷盾和 hCaptcha 验证码封锁。

### 🛵 2.8 生活出行去广告 (默认开启)
*   **脚本路径**：`Plugin/life.plugin` (Loon) / `QX/life.conf` (QX)
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
    *   主代理策略组采用自动延迟检测设计：`Proxy = url-test, 🇯🇵 Tokyo_Proxy, url=..., interval=300, tolerance=50` (Loon) / `url-latency-benchmark=Proxy, 🇯🇵 Tokyo_Proxy, check-interval=600, alive-checking=false, tolerance=50` (QX)。
    *   **自动选优**：单节点场景下，持续监测节点延迟与可用性，节点可用时自动走节点，无需手动切换。
    *   **流量防泄露优化**：策略组中**不放 DIRECT / direct 作为回落**。当节点不可用时显式报错，让您及时感知并调整。这避免了原本需要代理的敏感流量（如海外搜索、AI、流媒体）在无感知的状态下直接打向真实 IP 导致泄露。
    *   **省电设计**：QX 端 `alive-checking=false` 空闲时不测速，Loon 端 `interval=300` 每5分钟一次，平衡实时性与电量。
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
4.  **UDP 443 禁用与 YouTube 去广告兼容 (v5.3 新增)**：
    *   双端禁用 UDP 协议的 443 端口（Loon `disable-udp-ports = 443` / QX `udp_drop_list = 443`），满足 Kelee YouTube 去广告插件"必须禁用 UDP 443"的要求。否则 YouTube QUIC 流量会绕过 MitM 解密，导致视频广告无法拦截。
5.  **银行 App 网络错误根治 (v5.5 P0 修复)**：
    *   **根因**：`myblockads.plugin`(RuCu6) 的 MitM hostname 声明了 `wallet.95516.com`(云闪付)、`mobilepaas.abchina.com.cn`(农行)、`image.mybank.icbc.com.cn`(工行) 等银行核心域名，并对部分域名做 rewrite；QX 端 `blackmatrix7/AllInOne.conf` 声明了 `creditcardapp.bankcomm.*`(交行)、`hcz-member.pingan.com.cn`(平安)、`lban.spdb.com.cn`(浦发)、`v.icbc.com.cn`(工行)、`adv.ccb.com`/`yunbusiness.ccb.com`(建行) 等；`Toperlock/AdBlock.conf` 声明了 `midc.cdn-static.abchina.com.cn`(农行)、`image.spdbccc.com.cn`(浦发信用卡)。这些域名被 MitM 解密后，银行 App 的 SSL Pinning 会拒绝伪造证书 → TLS 握手失败 → App 显示"网络错误"。
    *   **修复**：双端主配置 `[MitM]`/`[mitm]` hostname 列表**前置负向通配符**排除所有银行域名（覆盖 17 家银行 + 银联/云闪付），负向声明优先级高于远程插件的正向声明，确保银行域名**永不被 MitM 解密**。银行去广告完全通过主配置 DNS 级 REJECT 实现，无需解密。

---

## 4. Kelee 插件镜像复用与 Cloudflare Turnstile 规避机制

可莉官方插件（`kelee.one`）部署了 **Cloudflare Turnstile** 验证机制。Turnstile 是一种 JS challenge，需要浏览器引擎执行 JavaScript 才能通过。实测结论：

- **任何 HTTP 客户端（curl/wget/GitHub Actions）即使携带 `Loon/3.3.9` UA 也无法通过**，返回 403。
- **只有 Loon App 内部的 WebKit 引擎**能执行 Turnstile JS challenge 通过验证，但不稳定（验证有概率失败）。
- GitHub Actions 中的 `curl` 下载 kelee.one 资源也返回 403，**无法通过 Actions 同步 kelee.one 的 lpx/geoip 文件到本地**。

因此，本项目对 kelee.one 资源采取**完全去依赖**策略：

*   **Loon 核心 Kelee 插件本地镜像**（通过 ajune0527/vpn_tool 镜像同步）：`Prevent_DNS_Leaks.plugin`、`Remove_ads_by_keli.plugin`、`myblockads.plugin`、`YouTube_remove_ads.plugin` 重定向至本项目本地 GitHub 镜像 Raw 链接（每天通过 Actions 从 ajune0527 同步）。
*   **kelee.one 直连 lpx 全部移除 (v5.3 修复)**：
    *   `Block_HTTPDNS.lpx` / `BlockAdvertisers.lpx` — 功能已被主配置完全覆盖，无需引用。
    *   `Sub-Store.lpx` / `QuickSearch.lpx` — 改用 `ajune0527/vpn_tool` 镜像源（`.plugin` 格式）。
*   **GeoIP/ASN 数据库 (v5.3 修复)**：`geodata.kelee.one` 同样 403，改用 `Loyalsoldier/geoip`（Country.mmdb）+ `P3TERX/GeoLite.mmdb`（ASN）。
*   **同步数据源说明**：通过 [sync-kelee.yml](https://github.com/3kaiu/config/blob/main/.github/workflows/sync-kelee.yml) 工作流，每天从 `ajune0527/vpn_tool`（kelee 官方授权的免 CF 镜像）及 `jqyisbest/RuCu6` 拉取最新插件缓存至本地 [Kelee/](https://github.com/3kaiu/config/tree/main/Kelee) 目录。
*   **Quantumult X 原生集成 DNS 防泄露**：针对 QX 无法直接解析 Loon `.plugin` 插件的问题，我们已将 Kelee `Prevent_DNS_Leaks.plugin` 中的全部规则静态转换为 QX 语法，并原生集成在 `QX.conf` 的 `[filter_local]` 中，无需使用 Script-Hub 等工具进行繁琐的外部格式转换。
*   **RuCu6 (广告必须死) 镜像与修复**：由于原作者删库导致双端原配置链接失效（404），我们已将 QX 端链接重定向为长期维护且国内直连的 `Toperlock/Quantumult` 激活镜像；同时将 Loon 端的 `AdBlock.plugin` 替换为存活的 `jqyisbest/RuCu6` 核心去广告插件（`myblockads.plugin`），并已将其纳入 Actions 定时工作流，每日自动拉取至本地 `Kelee/myblockads.plugin` 托管，彻底解决 404 彻底阻断的问题。
*   **ddgksf2013 (墨鱼) 仓库重构适配 (v5.3 修复)**：ddgksf2013 仓库已全面重构，`Filter/Loon/AdBlock.plugin`、`Filter/QuantumultX/AdBlock.conf`、`Rewrite/AdBlock/StartUp.conf` 全部 404。Loon 端移除了失效的墨鱼引用（由 RuCu6 + 可莉双重覆盖）；QX 端改用 `Rewrite/AdBlock/` 目录下按 App 拆分的新文件（`FakeiOSAds.conf`、`KeepAds.conf`、`YoutubeAds.conf`）。
*   **同步数据源说明**：我们通过 [sync-kelee.yml](https://github.com/3kaiu/config/blob/main/.github/workflows/sync-kelee.yml) 工作流，每天定时从公开且免 CF 拦截的 `ajune0527/vpn_tool` 仓库及 `jqyisbest/RuCu6` 仓库拉取最新版插件缓存至本地 [Kelee/](https://github.com/3kaiu/config/tree/main/Kelee) 目录，供 QX 用户自行选择使用 Script-Hub 转换引用（如 `Remove_ads_by_keli.plugin`）。

---

## 5. 项目目录结构

```text
3kaiu/config/
├── .github/
│   └── workflows/
│       └── sync-kelee.yml       # 每天自动从公共镜像源同步可莉插件 + ajune0527 App 插件
├── Kelee/                      # 本地缓存的可莉 & RuCu6 插件镜像 (QX转换用)
│   ├── Prevent_DNS_Leaks.plugin
│   ├── myblockads.plugin
│   ├── Remove_ads_by_keli.plugin
│   └── YouTube_remove_ads.plugin
├── Plugins/                   # ajune0527 Loon App 去广告插件每日同步备份 (防上游失效)
│   ├── Weibo_remove_ads.plugin
│   ├── Bilibili_remove_ads.plugin
│   ├── NeteaseCloudMusic_remove_ads.plugin
│   └── ... (16 个 App 独立去广告插件)
├── Plugin/                     # 自维护 Loon 插件
│   ├── qidian.plugin            # 起点全能助手 Pro (全能增强版，含签到与高阶任务)
│   ├── bank.plugin              # 银行与云闪付去广告
│   ├── life.plugin              # 生活出行去广告
│   ├── ai.plugin                # AI 服务分流
│   └── zhihuifangdong.plugin    # 智慧房东去广告
├── QX/                         # 自维护 QX 配置模块 (分流/重写)
│   ├── qidian.conf              # 起点全能助手 Pro (全能增强版，含签到与高阶任务)
│   ├── bank.conf                # 银行与云闪付去广告 (QX)
│   ├── life.conf                # 生活出行去广告 (QX)
│   ├── zhihuifangdong.conf      # 智慧房东去广告 (QX)
│   └── ai.conf                  # AI 服务分流规则 (QX 远程引用)
├── Profile/
│   ├── Loon.lcf                # Loon 客户端主配置文件
│   └── QX.conf                 # Quantumult X 客户端主配置文件
└── Scripts/                    # 自维护脚本
    ├── Qidian.js               # 起点全能增强运行脚本 (含签到+福利抽奖)
    ├── Zhihuifangdong.js       # 智慧房东去广告脚本
    └── UnionPay.js             # 云闪付净化脚本
```
