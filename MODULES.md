# MODULES — Loon 资源模块地图

> 机器可读真源：[`MODULE-MANIFEST.json`](MODULE-MANIFEST.json)。本文件是它的可读投影；
> 归类一旦改动，以 JSON 为准，并由 `test/cases/module-manifest.test.js` 断言与磁盘零偏差。
> **本轮只做归类判定，未移动任何文件。**

## 坐标系：按「介入层」而非文档域分类

Loon 官方文档分 12 个域（交互UI / 节点订阅 / 规则系统 / 策略 / 复写 / 脚本 / 脚本API / 插件 / DNS&映射 / MitM / 配置文件 / 其他配置 / URL Scheme），但这个分法**不能用来组织资源** —— 它按「设置在哪」切，而一次拦截是跨域的有序过程。正确的切法是介入层：

| 层 | 段 | 需解密 | 粒度 | 失败表现 |
|---|---|---|---|---|
| **L0** 节点 | `[Proxy]` `[Proxy Group]` | — | — | 无节点可选 |
| **L1** DNS与映射 | `[General]` `dns-*` `[Host]` | — | 域名 | 解析失败 / 泄漏 |
| **L2** 分流 | `[Rule]` `[Remote Rule]` | 否 | 域名/IP/端口/协议/UA/URL | 走错链路 |
| **L3** 策略组 | `[Proxy Group]` | — | — | 策略组空 |
| **L4** 流量改写 | `[Rewrite]` | **是** | URL 正则 + 响应体 | 广告照显 / 误改业务 |
| **L5** 脚本 | `[Script]` | **是** | 任意 JS | 广告照显 / **请求挂死** |
| **L6** 解密面 | `[MitM]` | — | 域名通配 | HTTPS 静默失效 / 证书暴露面 |

`[Plugin]` **不是一层**，是聚合容器 —— 它把 L1–L6 任意组合打包复用。本仓 46 个插件全部是这种容器。

## 六个模块

### M1 分流 · L2+L3 · 2 插件 / 0 脚本 / 5 snippet / 10 策略组

**职责**：决定请求走哪条链路，不改写任何内容。
**资源**：`template/snippet/{ai-services,developer,gaming,social,streaming}.tpl`（289 条规则）、`Plugin/ai.plugin`、`Plugin/apple-services-pro.plugin`、主配置的分流段（Apple/微信/STUN/局域网/DNS泄漏/Google/误杀白名单/GEOIP+FINAL）。
**关键约束**：`FINAL, Final` 是全局兜底；`IP-CIDR` 必须带 `no-resolve`，否则触发无效 DNS 查询（官方明文：域名类规则优先，域名命中后不再走 IP 匹配）。

### M2 广告治理 · L2+L4+L5 · 39 插件 / 26 脚本 · **唯一跨 3 层的模块**

**职责**：拦广告。这是本仓的核心，也是唯一**无法用单一 L 层描述**的模块，因此内部必须再按处置方式分层：

| 处置方式 | 层 | 本仓实例 | 适用前提 |
|---|---|---|---|
| 硬拦截域 | L2 | 主配置 ~119 条 REJECT | 广告域与业务域不同 host |
| 整条 reject | L4 | `startup-adblock-pro` 447 条 | **纯**广告接口（丢整个响应可接受） |
| 字段重命名 | L4 | 京喜系 2 条 `response-body-replace-regex` | 广告字段与业务同响应，客户端认不出改名即消失 |
| 字段级净化 | L5 | 26 个 Scripts | 广告内嵌在业务数据里 |
| DNS 整域 | L2 | `privacy-shield` | 纯追踪域 |

**粒度分布（实测）**：single-app 28 / cross-app 10 / global 1（开屏通杀）。
**关键约束**：整条 reject 只用于纯广告接口。京东 `functionId=start` 同时下发启动配置与开屏图，整条 reject 会白屏 —— 已改为响应体改写，处置台账见 `test/cases/jingdong.test.js` 的 `AD_SURFACES`。

### M3 隐私 · L2 · 1 插件 / 0 脚本

**职责**：拦追踪/统计/归因 SDK 与 DNS 泄漏，纯 DNS 级 REJECT，不解密内容。
**资源**：`Plugin/privacy-shield.plugin`（11 条 + 1 开关）、主配置的常见分析 SDK 段（GA/AppsFlyer/Adjust/Sentry 等）、DNS 泄漏检测域（18 条 → 强制走代理远端解析）。
**关键约束**：推送保活 —— 只拦统计子域，保留 `config.jpush.cn` / `api.getui.com`，全拦 SUFFIX 会断推送。

### M4 银行与支付 · L2+L6 · 1 插件 / 1 snippet

**职责**：银行/支付类 App **免解密 + 免广告**。这是唯一以「不解密」为目标的功能域。
**资源**：`Plugin/bank.plugin` + `template/snippet/bank-ad-reject.tpl`（16 条 URL 路径级）+ 主配置 19 条银行域 DIRECT + `[MitM]` 负号列表（约 40 个银行域）。
**关键约束**：负号列表是**证书暴露面的收窄面**，误删会破银行 App。逻辑规则里 IP 子规则要放后面，防 DNS 查询。

### M5 工具 · L5 · 3 插件 / 3 脚本

**职责**：与业务无关的自建工具，零常驻流量。
**资源**：`Plugin/notify.plugin`（cron）、`Plugin/diagnostics.plugin`（generic 手动触发）、`Plugin/quicksearch.plugin`（唯一非 L5，8 条 rewrite）、`Scripts/{Diagnostics,health-notify,traffic-notify}.js`。

### M7 功能增强 · L4+L5 · 0 主责 / 14 个次要成员

**职责**：非广告、非隐私、非分流的功能改写 —— VIP/画质/倍速解锁、签到打卡（cron）、去水印、领券、外链与区域解锁。
**成员**：全部以 `also_members` 挂在 M2 下（它们的主责仍是去广告），共 14 个：`taobao-tmall-pro`(88VIP) / `iqiyi-pro`(4K+VIP) / `tencent-video-pro`(4K+VIP) / `bdpan-pro`(倍速+VIP) / `alipay-pro`(会员) / `didi-pro`(D豆) / `sunshufu-pro`(银行优惠) / `xiaohongshu-pro`(去水印) / `jd-pro`(领券) / `netease-pro`(每日签到+周打卡) / `weibo-pro`(微博签到) / `bilibili-pro`(画质+cron) / `qidian`(cron 签到+Token+Cookie) / `apple-services-pro`(Music/Maps/News/Siri 解锁)。
**关键约束**：归入本模块必须有**真实规则消费**该开关，仅措辞含"解锁/增强"不算 —— 门禁逐条断言理由里指明规则数或 cron 事实。

### M6 基建 · 不产生运行时资源

**职责**：`src/*.ts → Scripts/` 唯一构建链（esbuild + inject）、`tools/*.mjs` 门禁（每条必须被接线）、`test/cases/*.test.js` 行为回归、`Loon.lcf` 生成与幂等。

## 当前布局的问题（重构要解决的）

现有 46 个插件的切分轴**不一致**：

- 25 个 `-pro` 插件是**单 App** 粒度
- 13 个 `*-purify` 是**跨 App 聚合** 粒度（`social-netdisk-purify` 一个插件 225 条 rewrite 覆盖网盘+社交+工具类 App）
- 这条轴来自**上游作者的原始切分**，不是按职责切的

后果：想「改一下京东的广告处理」得先知道京东在哪个插件；想「审计全部 L5 脚本」得横跨 13 个插件 + 主配置。**M2 内部尤其碎**。

重构方向（待你确认后再动）：M2 内按「单 App / 跨 App 聚合」两层收口，把 6 个 `*-purify` 显式标注为聚合层并登记其覆盖的 App 清单。

## 对抗审计记录（2026-09-29）

本清单自身经对抗审计：把每条数字与断言拿去跟磁盘、官方文档对账。抓到 6 个错误并已修：

| # | 错误 | 修法 |
|---|---|---|
| E1 | M2 粒度分布写 25/13/1，磁盘实测 **28/10/1** | 已按实测改 |
| E2 | 缺口 G1 写"仅用裸 REJECT"，**不准确** —— `[Rewrite]` 动作层实际用了 951 次变体（reject-dict 901 / reject 25 / reject-img 9 / mock-response-body 16） | G1 收窄为"缺口仅在 `[Rule]` 策略层 107 条" |
| E3 | `apple-services-pro` 误归 M1 分流 —— 该插件**没有任何策略组或分流规则**，实为 6 条 `apps.apple.com/v1/*` reject-dict（含 `/advertising`） | 改归 M2 |
| E4 | **taxonomy 缺第 7 类职责**：18/46 插件的开关 tag 命中"解锁/增强/签到"，逐一验证后 **14 个有真实规则消费**（每个开关 2–4 处） | 新增 **M7 功能增强** |
| E5 | schema 强制"一插件一模块"，**在逼我误分类** —— 5 个插件真跨模块 | 改为 primary 唯一 + `also_members` 表达次要职责 |
| E6 | 我把同一段跨模块关系登记两次（`safari-webview-pro` 同时写成"M2 跨 M3"和"M3 跨 M2"） | also 只在**次要责任方**声明一次，加门禁防复发 |

E4 的教训值得单独记：我最初宣称 M1–M6 是完备的，并写了门禁强制它。**门禁只会把我相信的东西固化，不会替我发现我没想过的东西。** 真正的发现来自"翻开关 tag 看作者自己怎么描述职责"——这个动作和清单是否自洽无关。

## 能力缺口台账

| # | Loon 能力 | 本仓用量 | 影响 | 归属 |
|---|---|---|---|---|
| G1 | `[Rule]` 策略层 REJECT 的 12 种变体 | **107 条全是裸 REJECT**（`-IMG`/`-DICT`/`-ARRAY`/`-VIDEO`/`-NO-DROP` 均 0）；`[Rewrite]` 动作层变体充足（reject-dict 901 / reject 25 / reject-img 9 / mock-response-body 16） | 策略层全部退化为 404；且 Loon 3.1.4+ 会把 REJECT 自动升级为 `REJECT-DROP`（App 疯狂重试致 CPU 发烫），`-NO-DROP` 正是禁用该升级的手段 | M2 |
| G2 | `NOT` 逻辑规则 | 0 | 无法表达「排除某类的兜底」 | M2 |
| G3 | `SRC-PORT` 规则 | 0 | 未使用（DEST-PORT 用了 7 条） | M1 |
| G4 | `CELLULAR` / `SSID` 规则 | 0 | 未做蜂窝 / WiFi 分流 | M1 |
| G5 | 新版权重 | 0 | 插件 `[Rule]` 无法限定「仅非 Final 策略下生效」 | M1 |

已用满的：`DOMAIN-SUFFIX` 241 / `DOMAIN` 109 / `PROTOCOL` 8 / `AND` 14 / `URL-REGEX` 7 / `DEST-PORT` 7 / `USER-AGENT` 6 / `IP-ASN` 3 / `IP-CIDR6` 1 / `DOMAIN-KEYWORD` 13（少是**优点** —— 官方警告该类型耗时随数量线性增长）。

## 已定论（不再反复）

| 问题 | 结论 | 依据 |
|---|---|---|
| 本地 `[Rule]` vs 插件 `[Rule]` 谁优先 | **本地 > 插件 > 订阅** | 官方《规则系统 3.1 规则优先级》明文 |
| 域名类 vs IP 类规则先后 | 域名类优先；域名命中后不再走 IP 匹配；其余按配置顺序 | 同上 |
| 插件里的 `DIRECT` 会不会遮蔽主配置的 `REJECT` | **不会** | 同上 |

第二条推论：`privacy-shield.plugin:12` 写的「本地规则 > 插件规则」是对的；社区知识库里「插件里的规则优先生效」的说法**有误**，不必再作为待验证项挂着。
