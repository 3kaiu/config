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
*   **脚本路径**：`Plugin/qidian.plugin` (Loon) / `QX/qidian.conf` (QX) -> 关联本地 [Qidian.js](file:///Users/edy/.gemini/antigravity/scratch/config/Scripts/Qidian.js)
*   **核心功能**：
    *   **开屏与应用内净化**：全量覆写 getconf 广告配置，清空书架悬浮广告，净化我的账户页推广。
    *   **视频广告秒播**：篡改广告 SDK 数据，将腾讯/穿山甲广告时长修改为 1 秒并播放黑屏。
    *   **视频任务自动重放**：单次看视频自动重放 9 次（激励视频）或 3 次（福利任务），免去重复等待。
    *   **发现页净化**：过滤全部游戏/商城/红包模块，仅保留书单/专栏/IP专区/点点圈。
    *   **每日阅读积分满值**：重写阅读时长（7200秒），任务列表显示为已完成。
    *   **自动签到与高阶福利任务自动化**：每日自动运行，支持静默签到、激励视频碎片、广告起点币任务、每周日自动兑换章节卡以及大咖荐书等全套高阶福利。
    *   **智能静默运行 (Silent Mode)**：默认开启，每日签到成功及重放任务仅在后台记录日志，不再频繁弹窗打扰，仅在 Token 失效或任务发生故障时进行系统级推送通知。
*   **抓取 Cookie 步骤**：
    1. 开启 **起点全能助手 Pro** 模块/重写引用，确保 MitM 包含 `h5.if.qidian.com`。
    2. 打开起点 App -> **我的** -> **福利中心**，弹出 `✨ 抓取起点 Cookie 成功` 通知即表示获取成功。
    3. 获取成功后，建议在列表中关闭/注释此获取 Cookie 的重写以减少网络开销。
*   **任务配置**：Loon 可直接在插件参数中调整各任务开关（默认全开），QX 用户通过 **BoxJs** 调整参数。

### 💳 2.2 银行及云闪付去广告
*   **脚本路径**：`Plugin/bank.plugin` (Loon) / `QX/bank.conf` (QX)
*   **覆盖应用**：云闪付、买单吧 (交通银行)、中国银行 (缤纷生活)、农业银行等主流金融机构。
*   **净化效果**：
    *   拦截启动开屏广告、首页弹窗、广告图加载。
    *   **云闪付净化**：通过 [UnionPay.js](file:///Users/edy/.gemini/antigravity/scratch/config/Scripts/UnionPay.js) 重写，剔除理财页推广、首页大图、 koala 权益推广。
    *   **类型安全 Mocking**：使用 `reject-dict` (返回 `{}`) 替代直接断网，防止 App 报错崩溃或因获取不到数据重复高频请求。
    *   **深度兼容与去广告平衡设计**：
        1. **DNS 绕过与 Fake-IP 排除**：在 QX `dns_exclusion_list` 与 Loon `real-ip` 中全量加入主流金融域名，强制使用真实 IP 解析，防范安全检测与闪退。
        2. **最高优先级置顶直连**：在分流规则最上方加入本地网银直连块，保障金融交易流量以最高优先级走 DIRECT。
        3. **安全与去广告平衡 (免 MitM 劫持安全网关)**：从主配置的 `MitM` 排除列表中移除银行 wildcard (如 `-*.boc.cn` 等)，仅在 `bank.conf` 等远程重写中声明要解密的特定广告域名（如 `mlife.jf365.boc.cn`），确保涉及用户资金交易的核心 API (如 `ebsnew.boc.cn`) 绝不参与解密，完全绕过 MitM 劫持。

### 🏠 2.3 智慧房东去广告
*   **脚本路径**：`Plugin/zhihuifangdong.plugin` (Loon) / `QX/zhihuifangdong.conf` (QX)
*   **净化效果**：通过 [Zhihuifangdong.js](file:///Users/edy/.gemini/antigravity/scratch/config/Scripts/Zhihuifangdong.js) 拦截开屏与 Banner 横幅广告，Loon 端支持独立开关控制。

### 🤖 2.4 AI 服务分流
*   **规则路径**：`Plugin/ai.plugin` (Loon) / `QX/ai.conf` 远程规则引用 (QX)
*   **分流服务**：OpenAI (ChatGPT)、Anthropic (Claude)、Google AI (Gemini)、Perplexity、Groq、编程助手 (Cursor / Copilot / Windsurf / Supermaven) 等。所有 AI 流量自动走向 Proxy 代理策略组。

### 📹 2.5 YouTube 增强
*   **脚本路径**：主配置 `[Rule]` 规则路由 (Loon/QX) + 远程去广告插件 (Loon Kelee `YouTube_remove_ads.lpx` / QX `youtube.conf`)
*   **净化效果**：屏蔽 YouTube App 视频中插广告、首页信息流推广，并提供后台播放 (画中画) 支持。

### 🚫 2.6 全网系统级与 App 深度去广告 (RuCu6 / 墨鱼双引擎)
*   **规则路径**：Loon 插件 (`Plugin`) / QX 远程重写 (`rewrite_remote`) 默认内置。
*   **净化范围**：整合全网最有价值的 app 去广告方案，包括 **RuCu6** 与 **ddgksf2013/墨鱼** 的核心净化规则。针对微博、知乎、高德地图、小红书、美团等高频应用，全方位去除开屏广告、弹窗及推广信息，同时**采用多维度多层次设计（如 HTTPDNS 接口置空拦截）**，最大化缩减 CPU 开销以节省电池电量。

---

## 3. 网络运维深度优化设计 (NetOps Expert Rules)

针对您的 **单个东京代理节点**（配置文件中命名为 `🇯🇵 Tokyo_Proxy`）环境，我们实施了专家级的路由与网络加速优化：

```text
[网络请求] ────► [策略组 (Proxy)] ──► 🇯🇵 Tokyo_Proxy (手动选择)
                  │
                  └──► [手动回落] ───► DIRECT / direct
```

1.  **策略组手动掌控 (Proxy Select/Static)**：
    *   主代理策略组采用手动选择设计：`Proxy = select, 🇯🇵 Tokyo_Proxy, DIRECT` (Loon) / `static=Proxy, 🇯🇵 Tokyo_Proxy, direct` (QX)。
    *   **流量防泄露优化**：废除了原先的 `fallback` 组（即当节点宕机时自动降级到 `DIRECT`）。自动降级虽然不会断网，但会导致原本需要代理的敏感流量（如海外搜索、AI、流媒体）在无感知的状态下直接打向真实 IP。这不仅会由于直连打不开导致访问失败，还会让真实 IP 泄漏。现在调整为静态选择，当节点不可用时显式报错，让您及时感知并调整，全面保护隐私。
    *   移除了 `url-test` 测速组，节省定时 ping 的网络握手资源和电量。
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

---

## 4. Kelee 插件镜像复用与双端直连机制

可莉官方插件（`kelee.one`）部署了 Cloudflare Turnstile 验证，限制必须具有 `Loon` 的 User-Agent 且满足验证条件才能拉取，这导致客户端在刷新或下载插件时频繁遭遇 403 错误。

为解决该可用性问题，本项目进行了如下的深度复用与集成：

*   **Loon 客户端 100% 稳定连接**：我们已将 `Loon.lcf` 主配置中的 Kelee 插件链接（包括去广告、DNS 防泄露及 YouTube 增强）重定向至本项目本地 GitHub 镜像 Raw 链接（每天通过 Actions 自动同步更新），彻底免除了设备端的 Cloudflare 验证拦截。
*   **Quantumult X 原生集成 DNS 防泄露**：针对 QX 无法直接解析 Loon `.plugin` 插件的问题，我们已将 Kelee `Prevent_DNS_Leaks.plugin` 中的全部规则静态转换为 QX 语法，并原生集成在 `QX.conf` 的 `[filter_local]` 中，无需使用 Script-Hub 等工具进行繁琐的外部格式转换。
*   **RuCu6 (广告必须死) 镜像与修复**：由于原作者删库导致双端原配置链接失效（404），我们已将 QX 端链接重定向为长期维护且国内直连的 `Toperlock/Quantumult` 激活镜像；同时将 Loon 端的 `AdBlock.plugin` 替换为存活的 `jqyisbest/RuCu6` 核心去广告插件（`myblockads.plugin`），并已将其纳入 Actions 定时工作流，每日自动拉取至本地 `Kelee/myblockads.plugin` 托管，彻底解决 404 彻底阻断的问题。
*   **同步数据源说明**：我们通过 [sync-kelee.yml](file:///Users/edy/.gemini/antigravity/scratch/config/.github/workflows/sync-kelee.yml) 工作流，每天定时从公开且免 CF 拦截的 `ajune0527/vpn_tool` 仓库及 `jqyisbest/RuCu6` 仓库拉取最新版插件缓存至本地 [Kelee/](file:///Users/edy/.gemini/antigravity/scratch/config/Kelee) 目录，供 QX 用户自行选择使用 Script-Hub 转换引用（如 `Remove_ads_by_keli.plugin`）。

---

## 5. 项目目录结构

```text
3kaiu/config/
├── .github/
│   └── workflows/
│       └── sync-kelee.yml       # 每天自动从公共镜像源同步可莉插件
├── Kelee/                      # 本地缓存的可莉 & RuCu6 插件镜像 (QX转换用)
│   ├── Prevent_DNS_Leaks.plugin
│   ├── myblockads.plugin
│   ├── QiDian_remove_ads.plugin
│   ├── Remove_ads_by_keli.plugin
│   └── YouTube_remove_ads.plugin
├── Plugin/                     # 自维护 Loon 插件
│   ├── qidian.plugin            # 起点全能助手 Pro (全能增强版，含签到与高阶任务)
│   ├── bank.plugin              # 银行与云闪付去广告
│   ├── ai.plugin                # AI 服务分流
│   └── zhihuifangdong.plugin    # 智慧房东去广告
├── QX/                         # 自维护 QX 配置模块 (分流/重写)
│   ├── qidian.conf              # 起点全能助手 Pro (全能增强版，含签到与高阶任务)
│   ├── bank.conf                # 银行与云闪付去广告 (QX)
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
