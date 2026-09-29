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

`[Plugin]` **不是一层**，是聚合容器 —— 它把 L1–L6 任意组合打包复用。本仓唯一成员 `qidian.plugin` 即是这种容器。

## 六个模块

### M1 分流 · L2+L3 · 0 插件 / 0 脚本 / 5 snippet / 10 策略组

**职责**：决定请求走哪条链路，不改写任何内容。
**资源**：`template/snippet/{ai-services,developer,gaming,social,streaming}.tpl`（实测 49+79+25+62+57 = **272 条规则**）、主配置的分流段（Apple/微信/STUN/局域网/DNS泄漏/Google/误杀白名单/GEOIP+FINAL）。原 `Plugin/ai.plugin` 与 `Plugin/apple-services-pro.plugin` 已随收敛删除 —— 分流职责现全部由 snippet + 主配置承担。
**关键约束**：`FINAL, Final` 是全局兜底；`IP-CIDR` 必须带 `no-resolve`，否则触发无效 DNS 查询（官方明文：域名类规则优先，域名命中后不再走 IP 匹配）。

### M2 广告治理 · L2 · 0 插件 / 0 脚本 · **唯一跨 3 层的模块**

**职责**：拦广告。这是本仓的核心，也是唯一**无法用单一 L 层描述**的模块，因此内部必须再按处置方式分层：

| 处置方式 | 层 | 本仓实例 | 适用前提 |
|---|---|---|---|
| 硬拦截域 | L2 | 主配置 **120 条 REJECT** | 广告域与业务域不同 host |
| 整条 reject | L4 | 已随插件删除（`startup-adblock-pro` 493 条） | **纯**广告接口（丢整个响应可接受） |
| 字段重命名 | L4 | 已随插件删除（京喜系 `response-body-replace-regex`） | 广告字段与业务同响应，客户端认不出改名即消失 |
| 字段级净化 | L5 | 已随插件删除（26 个 Scripts） | 广告内嵌在业务数据里 |
| DNS 整域 | L2 | 已随插件删除（`privacy-shield`） | 纯追踪域 |

> M2 现只剩 L2 一个层 —— App 内部结构化广告位（L4/L5）无任何资源，是功能回退而非分层退化。

**粒度分布**：插件成员归零，无粒度分布可言。
**关键约束**：整条 reject 只用于纯广告接口。京东 `functionId=start` 同时下发启动配置与开屏图，整条 reject 会白屏 —— 已改为响应体改写；该处置台账随 `test/cases/jingdong.test.js` 一并删除。

### M3 隐私 · L2 · 0 插件 / 0 脚本

**职责**：拦追踪/统计/归因 SDK 与 DNS 泄漏，纯 DNS 级 REJECT，不解密内容。
**资源**：主配置的常见分析 SDK 段（GA/AppsFlyer/Adjust/Sentry 等）+ DNS 泄漏检测域（18 条 → 强制走代理远端解析）。原 `Plugin/privacy-shield.plugin`（11 条 + 1 开关）已随收敛删除。
**关键约束**：推送保活 —— 只拦统计子域，保留 `config.jpush.cn` / `api.getui.com`，全拦 SUFFIX 会断推送。

### M4 银行与支付 · L2+L6 · 0 插件 / 1 snippet

**职责**：银行/支付类 App **免解密 + 免广告**。这是唯一以「不解密」为目标的功能域。
**资源**：`template/snippet/bank-ad-reject.tpl`（16 条 URL 路径级）+ 主配置 19 条银行域 DIRECT + `[MitM]` 负号列表（约 40 个银行域）。原 `Plugin/bank.plugin` 已随收敛删除。
**关键约束**：负号列表是**证书暴露面的收窄面**，误删会破银行 App。逻辑规则里 IP 子规则要放后面，防 DNS 查询。

### M5 工具 · L5 · 0 插件 / 0 脚本

**职责**：与业务无关的自建工具，零常驻流量。
**资源**：无成员。

> 当前最显著的单点：主配置**没有 `[Script]` 段**，所有脚本能力寄生在唯一插件 `qidian.plugin` 内 —— 插件一旦停用即全灭。

### M7 功能增强 · L4+L5 · 1 主责 / 0 次要成员

**职责**：非广告、非隐私、非分流的功能改写 —— VIP/画质/倍速解锁、签到打卡（cron）、去水印、领券、外链与区域解锁。
**成员**：仅 `qidian`（cron 签到 + Token/Cookie 捕获 + 发现页白名单），归 M7 主责，无次要成员。
**关键约束**：归入本模块必须有**真实规则消费**该开关，仅措辞含"解锁/增强"不算 —— 门禁逐条断言理由里指明规则数或 cron 事实。

### M6 基建 · 不产生运行时资源

**职责**：`src/*.ts → Scripts/` 唯一构建链（esbuild + inject）、`tools/*.mjs` 门禁（每条必须被接线）、`test/cases/*.test.js` 行为回归、`Loon.lcf` 生成与幂等。

## 当前布局的问题

能力过度集中在单一插件（见 M5 段注）：所有脚本能力寄生在 `qidian.plugin` 内。

## 对抗审计的教训

本清单经对抗审计（把每条数字与断言拿去跟磁盘、官方文档对账）后定型，其中一条教训值得长期保留：

> 我最初宣称 M1–M6 是完备的，并写了门禁强制它。**门禁只会把我相信的东西固化，不会替我发现我没想过的东西。** 真正的发现来自"翻插件开关 tag 看作者自己怎么描述职责"——这个动作和清单是否自洽无关。

由此确立的三条工作纪律：
1. **文档数字必须由门禁反算**（`tools/doc-claims-check.mjs`），不许凭记忆写。
2. **断言与官方文档对账**，引用不存在的参数/枚举即判错（如策略层 REJECT 实为 5 种）。
3. **能力台账须同时记「已停用」**，否则下任只会误以为那些能力仍在生效。

## 能力缺口台账

注：策略层 REJECT 官方共 **5 种**（REJECT / -IMG / -DICT / -ARRAY / -DROP）。`REJECT-VIDEO` 与 `REJECT-NO-DROP` 在官方《策略》文档中不存在；「REJECT 会被自动升级为 REJECT-DROP」亦无官方出处（文档只说 REJECT 返回 404 空体、REJECT-DROP 才丢包，并提示重试风暴时慎用）。

| # | Loon 能力 | 本仓用量 | 影响 | 归属 |
|---|---|---|---|---|
| G1 | `[Rule]` 策略层 REJECT 变体（官方共 5 种） | **120 条全是裸 REJECT**（`-IMG`/`-DICT`/`-ARRAY`/`-DROP` 均 0） | 策略层全部退化为 404，部分 App 会因非预期状态码而重试 | M2 |
| G2 | `NOT` 逻辑规则 | 0 | 无法表达「排除某类的兜底」 | M2 |
| G3 | `SRC-PORT` 规则 | 0 | 未使用（主配置 DEST-PORT 2 条） | M1 |
| G4 | `load-balance`（PCC / Round-Robin / Random） | 0 | 单订阅组下收益低，暂不引入 | M1 |
| G5 | 新版权重 | 0 | 插件 `[Rule]` 无法限定「仅非 Final 策略下生效」 | M1 |
| G6 | `ssid-trigger`（蜂窝/WiFi 分流） | 0 | 未做蜂窝 / WiFi 分流 | M1 |
| G7 | `disable-udp-ports` | 0（**主动不启用**） | 该参数自 Loon 3.1.7 起已被 `DEST-PORT`/`PROTOCOL`/逻辑规则取代；本仓的等价能力由 `PROTOCOL, STUN, REJECT` + `DEST-PORT, 3478` 承担 | M1 |

**已解决**：`PROTOCOL, STUN, REJECT` 取代 `DOMAIN-KEYWORD, stun, REJECT`。关键词规则只能匹配含 "stun" 的域名，裸 IP STUN 逃逸面够不着；协议规则无此缺口，且官方《规则系统 3.1》第 1 条保证域名规则先命中，5 条通话白名单不受影响。需 Loon ≥ 3.1.7。

**已解决**（域名存活性）：全量 121 条 REJECT 经 DoH 多解析器交叉审计，修正 1 处主机名错配（`alisc1.zijieapi.com` NXDOMAIN → 真实 host `tnc3-alisc1.zijieapi.com` 存活，规则从未生效）、删除 1 条错误补录（`qreport.cn` 系已全下线）。新增 `dns-liveness` 门禁守住此类静默失效——**语法合法的规则写错主机名，现有门禁一条都抓不到**。判据须落到子域（`imtmp.net` 裸域 NXDOMAIN 但 7 个子域存活，删掉即误伤），并区分「域名已注销」与「NS 活跃仅业务下线」。

**已解决**（UDP 面）：`udp-fallback-mode` 由 `DIRECT` 改为 `REJECT`。官方定义为「节点不支持 UDP 或未启用 UDP 转发时使用的策略」——取 DIRECT 时节点一旦无 UDP，全部 UDP（QUIC/游戏/通话）从本机真实 IP 直连漏出，与已用 `PROTOCOL, STUN, REJECT` 封 STUN 的 posture 矛盾。REJECT = 失败可见。**前置条件：东京组节点须启用 UDP**，否则通话/游戏不可用。

已用满的（`Profile/Loon.lcf` `[Rule]` 段 483 行）：`DOMAIN-SUFFIX` 361 / `DOMAIN` 108 / `DOMAIN-KEYWORD` 5 / `PROTOCOL` 1（关键词少是**优点** —— 官方警告该类型耗时随数量线性增长）/ `IP-CIDR` 4 / `DEST-PORT` 2 / `GEOIP` 1 / `FINAL` 1。`qidian.plugin` 另含 `AND` 3 / `DOMAIN` 13 / `DOMAIN-SUFFIX` 2。

**已停用**（随插件下线而失去，非主动选择）：`URL-REGEX` / `USER-AGENT` / `IP-ASN` / `IP-CIDR6` / `OR` / `NOT`。

## 已定论（不再反复）

| 问题 | 结论 | 依据 |
|---|---|---|
| 本地 `[Rule]` vs 插件 `[Rule]` 谁优先 | **本地 > 插件 > 订阅** | 官方《规则系统 3.1 规则优先级》明文 |
| 域名类 vs IP 类规则先后 | 域名类优先；域名命中后不再走 IP 匹配；其余按配置顺序 | 同上 |
| 插件里的 `DIRECT` 会不会遮蔽主配置的 `REJECT` | **不会** | 同上 |

第二条推论：社区知识库里「插件里的规则优先生效」的说法**有误**，不必再作为待验证项挂着。
