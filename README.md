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

### 📚 2.1 起点读书 (全能增强)
提供两个维度的解决方案，您可以自由选择或同时使用：

1.  **起点全能助手 Pro (默认开启)**：
    *   **脚本路径**：`Plugin/qidian.plugin` (Loon) / `QX/qidian.conf` (QX) -> 关联本地 [Qidian.js](file:///Users/edy/.gemini/antigravity/scratch/config/Scripts/Qidian.js)
    *   **核心功能**：
        *   **开屏与应用内净化**：全量覆写 getconf 广告配置，清空书架悬浮广告，净化我的账户页推广。
        *   **视频广告秒播**：篡改广告 SDK 数据，将腾讯/穿山甲广告时长修改为 1 秒并播放黑屏。
        *   **视频任务自动重放**：单次看视频自动重放 9 次（激励视频）或 3 次（福利任务），免去重复等待。
        *   **发现页净化**：过滤全部游戏/商城/红包模块，仅保留书单/专栏/IP专区/点点圈。
        *   **每日阅读积分满值**：重写阅读时长（7200秒），任务列表显示为已完成。
        *   **静默签到 (09:00)**：每日上午 9 点自动执行静默签到，并在签到成功后**自动进行每日 checkin 抽奖**。
2.  **起点自动签到高阶任务 (可选开启)**：
    *   **脚本路径**：`Plugin/qidian_tasks.plugin` (Loon) / `QX/qidian_tasks.conf` (QX) -> 引用远程 [Yuheng0101 高阶脚本](https://github.com/Yuheng0101/X)
    *   **核心功能**：除了签到外，支持**每日自动做激励视频碎片**、**广告起点币任务**、**每周日自动兑换章节卡**以及**大咖荐书（自动加书架/看视频抽双倍/删书架）**等全套高阶福利。
    *   **抓取 Cookie 步骤**：
        1. 开启 **起点自动签到(高阶任务)** 模块/重写引用，确保 MitM 包含 `h5.if.qidian.com`。
        2. 打开起点 App -> **我的** -> **福利中心**，弹出 `✨ 抓取起点 Cookie 成功` 通知即表示获取成功。
        3. 获取成功后，建议在列表中关闭/注释此获取 Cookie 的重写行以减少网络开销。
    *   **任务配置**：Loon 可直接在插件参数中勾选，QX 用户通过 **BoxJs** 调整参数。

### 💳 2.2 银行及云闪付去广告
*   **脚本路径**：`Plugin/bank.plugin` (Loon) / `QX/bank.conf` (QX)
*   **覆盖应用**：云闪付、买单吧 (交通银行)、中国银行 (缤纷生活)、农业银行。
*   **净化效果**：
    *   拦截启动开屏广告、首页弹窗、广告图加载。
    *   **云闪付净化**：通过 [UnionPay.js](file:///Users/edy/.gemini/antigravity/scratch/config/Scripts/UnionPay.js) 重写，剔除理财页推广、首页大图、 koala 权益推广。
    *   **类型安全 Mocking**：使用 `reject-dict` (返回 `{}`) 替代直接断网，防止 App 报错崩溃或因获取不到数据重复高频请求。

### 🏠 2.3 智慧房东去广告
*   **脚本路径**：`Plugin/zhihuifangdong.plugin` (Loon) / `QX/zhihuifangdong.conf` (QX)
*   **净化效果**：通过 [Zhihuifangdong.js](file:///Users/edy/.gemini/antigravity/scratch/config/Scripts/Zhihuifangdong.js) 拦截开屏与 Banner 横幅广告，Loon 端支持独立开关控制。

### 🤖 2.4 AI 服务分流
*   **规则路径**：`Plugin/ai.plugin` (Loon) / `Profile/QX.conf` 本地规则 (QX)
*   **分流服务**：OpenAI (ChatGPT)、Anthropic (Claude)、Google AI (Gemini)、Perplexity、Groq、编程助手 (Cursor / Copilot / Windsurf / Supermaven) 等。所有 AI 流量自动走向 AI 专用的策略组。

### 📹 2.5 YouTube 增强
*   **脚本路径**：`Plugin/youtube.plugin` (Loon) / `Profile/QX.conf` 重写引用 (QX)
*   **净化效果**：屏蔽 YouTube App 视频中插广告、首页信息流推广，并提供后台播放 (画中画) 支持。

---

## 3. 网络运维深度优化设计 (NetOps Expert Rules)

针对您的 **单个东京代理节点**（配置文件中命名为 `🇯🇵 Tokyo_Proxy`）环境，我们实施了专家级的路由与网络加速优化：

```text
                  ┌──► [直连流量] ──► DIRECT
                  │
[网络请求] ────► [策略组 (Proxy)] ──► fallback ──► 🇯🇵 Tokyo_Proxy
                  │                                   │ (若超时 / 宕机)
                  │                                   ▼
                  └──► [自动容灾回落] ─────────────────► DIRECT (国内直连)
```

1.  **自动容灾降级 (Proxy Fallback)**：
    *   主代理策略组采用 `fallback` 组设计：`Proxy = fallback, 🇯🇵 Tokyo_Proxy, DIRECT`。
    *   当您的单节点东京代理因为网络波动、故障或超时无法连接时，系统会自动将非区锁流量回落到 `DIRECT`（直连），**避免因代理失效导致手机完全断网**。
    *   移除了 `url-test` 测速组，节省定时 ping 的网络握手资源和电量。
2.  **Split DNS 分流与防泄露**：
    *   **国内解析**：通过阿里/腾讯的高速加密 DNS（DoH / DoQ）在本地快速解析。
    *   **国外解析**：代理流量完全交给东京代理服务器进行远端 DNS 解析，防止本地 ISP 监控并防止 DNS 污染。
    *   **HTTPDNS IP 级正则拦截**：
        *   通过本地重写 `^https?:\/\/119\.29\.29\.29\/d` 直接置空企鹅和阿里等 HTTPDNS 解析接口，强制 App 走系统安全 DNS。
        *   **避免使用 IP-CIDR 全阻断**，防止标准 UDP 53 端口本地 DNS 查询因 IP 阻断被误杀。
3.  **TLS 减负隔离 (MitM 精简)**：
    *   主配置中的 MitM 实行极严格的黑白名单隔离：排除微信、支付宝、各类网银等绝大部分安全敏感流量，仅对起点、智慧房东与少数联盟广告域名进行解密，**最大程度确保您的设备省电、网络低延迟与隐私安全**。

---

## 4. Kelee 插件自动镜像机制

可莉官方插件（`kelee.one`）部署了 Cloudflare Turnstile 验证，并限制必须具有 `Loon` 的 User-Agent 才能拉取，导致其他工具（如 QX 或 Script-Hub 转换器）访问时直接 403。

*   **同步数据源**：我们通过 [sync-kelee.yml](file:///Users/edy/.gemini/antigravity/scratch/config/.github/workflows/sync-kelee.yml) 工作流，每天定时从 GitHub 公开且免 CF 拦截的 `ajune0527/vpn_tool` 仓库拉取最新版插件，缓存至本地 [Kelee/](file:///Users/edy/.gemini/antigravity/scratch/config/Kelee) 目录。
*   **无缝转换**：如果您在 QX 中需要使用可莉的去广告或 DNS 防泄露插件，请使用 Script-Hub 转换您的本地镜像链接：
    `https://raw.githubusercontent.com/3kaiu/config/main/Kelee/Remove_ads_by_keli.plugin`

---

## 5. 项目目录结构

```text
3kaiu/config/
├── .github/
│   └── workflows/
│       └── sync-kelee.yml       # 每天自动从公共镜像源同步可莉插件
├── Kelee/                      # 本地缓存的可莉 Loon 插件镜像 (QX转换用)
│   ├── Prevent_DNS_Leaks.plugin
│   ├── QiDian_remove_ads.plugin
│   ├── Remove_ads_by_keli.plugin
│   └── YouTube_remove_ads.plugin
├── Plugin/                     # 自维护 Loon 插件
│   ├── qidian.plugin            # 起点全能助手 Pro (去广告与静默签到)
│   ├── qidian_tasks.plugin      # 起点自动签到高阶任务 (可选)
│   ├── bank.plugin              # 银行与云闪付去广告
│   ├── ai.plugin                # AI 服务分流
│   ├── zhihuifangdong.plugin    # 智慧房东去广告
│   └── youtube.plugin           # YouTube 增强
├── QX/                         # 自维护 QX 配置模块 (可用作 Remote Rewrite)
│   ├── qidian.conf              # 起点去广告与静默签到 (QX)
│   ├── qidian_tasks.conf        # 起点高阶任务模块 (QX, 可选)
│   ├── bank.conf                # 银行与云闪付去广告 (QX)
│   └── zhihuifangdong.conf      # 智慧房东去广告 (QX)
├── Profile/
│   ├── Loon.lcf                # Loon 客户端主配置文件
│   └── QX.conf                 # Quantumult X 客户端主配置文件
└── Scripts/                    # 自维护脚本
    ├── Qidian.js               # 起点全能增强运行脚本 (含签到+福利抽奖)
    ├── Zhihuifangdong.js       # 智慧房东去广告脚本
    └── UnionPay.js             # 云闪付净化脚本
```
