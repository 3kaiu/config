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

`[Plugin]` **不是一层**，是聚合容器 —— 它把 L1–L6 任意组合打包复用。本仓 9 个插件全部经 `template/loon.tpl` 的 `[Plugin]` 段分发（该段是**唯一分发渠道**，漏登记即 `npm test` 的 wiring-check 判红）。

**插件内部再分两层**（2026-09-30 架构分层，顺序由 `test/cases/plugin-layering.test.js` 钉死 —— 官方《规则》页：插件之间按 `[Plugin]` 登记顺序匹配）：
- **L0 依赖层（必须最前三条）**：`ad-block` 广告平台拦截器（M2，968 域 = 60 人工策展 + 418 生成式覆盖 + 490 社区清单复核收录）+ `dns-httpdns` HTTPDNS 拦截器（M3，72）+ `dns-leak` DNS 防泄漏（M3，35）。生成式覆盖见 `tools/ad-coverage.mjs`（五道判据 + 证据台账 + 每月自动刷新 PR）。三者是"域名 REJECT 真正生效"的**前置条件**：域名拒绝在 DNS 阶段完成，而自带 HTTPDNS/DoH 的 SDK 与浏览器会绕过系统 DNS 拿到真实 IP。用户仍需 L1 插件搭配使用。
- **L1 消费层**：`qidian` 聚合容器（L4+L5+L6，全部 `[Script]` 能力寄生于此）+ `jd`（M2, 带 `[Script]`+`[MitM]`）+ `soda`（M2, 汽水音乐 luna 接口净化, 8 条整条转空 + 7 条字段级 + 3 域）+ `zhifu-fangdong`（M2, 智慧房东自营活动位, 1 条整条转空, 解密面 1 host）+ `wechat`（M2, 微信公众号文章广告, 2 条字段级净化 + 1 条纯推广端点整条转空, **零域名规则** —— 朋友圈/视频号走 MMTLS 不可达）+ `probe-block`（M3 上报/埋点拦截, 6 通道零重叠并集）。

## 六个模块

### M1 分流 · L2+L3 · 0 插件 / 0 脚本 / 5 snippet / 10 策略组

**职责**：决定请求走哪条链路，不改写任何内容。
**资源**：`template/snippet/{ai-services,developer,gaming,social,streaming}.tpl`（实测 49+79+25+62+57 = **272 条规则**）、主配置的分流段（Apple/微信/STUN/局域网/DNS泄漏/Google/误杀白名单/GEOIP+FINAL）。原 `Plugin/ai.plugin` 与 `Plugin/apple-services-pro.plugin` 已随收敛删除 —— 分流职责现全部由 snippet + 主配置承担。
**关键约束**：`FINAL, Final` 是全局兜底；`IP-CIDR` 必须带 `no-resolve`，否则触发无效 DNS 查询（官方明文：域名类规则优先，域名命中后不再走 IP 匹配）。

### M2 广告治理 · L2+L4+L5 · 5 插件 / 1 脚本 · **唯一跨 3 层的模块**

**职责**：拦广告。这是本仓的核心，也是唯一**无法用单一 L 层描述**的模块，因此内部必须再按处置方式分层：

| 处置方式 | 层 | 本仓实例 | 适用前提 |
|---|---|---|---|
| 硬拦截域 | L2 | 主配置 **127 条 REJECT** + 4 个纯 L2 插件（1 广告平台拦截器 + 2 DNS 收编 + 1 上报拦截）的 **1112 条域级 REJECT**（968+72+35+37，其中 418 条生成式覆盖，逐条证据在台账） | 广告域与业务域不同 host |
| 整条 reject | L4 | `soda.plugin`（8 条纯广告端点）+ `zhifu-fangdong.plugin`（1 条自营活动位）+ `wechat.plugin`（1 条商品推广 CPS 端点） | **纯**广告接口（丢整个响应可接受） |
| 字段重命名 | L4 | 已随插件删除（京喜系 `response-body-replace-regex`） | 广告字段与业务同响应，客户端认不出改名即消失 |
| 字段级净化 | L4+L5 | `Scripts/jingdong.js`（京东 7 个 functionId，一律改写不整条拒）+ `Scripts/Qidian.js`（起点广告/福利/发现页白名单）+ `soda.plugin`（7 条 luna 业务接口）+ `wechat.plugin`（2 条文章接口：`advertisement_num`/`advertisement_info` 置空） | 广告内嵌在业务数据里 |
| DNS 整域 | L2 | 已随插件删除（`privacy-shield`） | 纯追踪域 |

> M2 的 L2 面已从「CDN 插件 + 12 万条长尾域名表」收敛为「主配置 REJECT + 1 个广告平台集合插件（7 平台 59 域）+ 6 个探针插件」（2026-09-30 集合化：原 7 个 ad-* 合并，域级零重叠）；L4/L5 面自 `jd.plugin`（2026-09-29）起重新有资源，故 M2 再次跨 L2+L4+L5。

**粒度分布**：5 个插件成员 —— 1 个 `global`（`ad-block.plugin`：7 平台 60 域集合，2026-09-30 由 7 个 ad-* 合并）+ 4 个 `single-app`（`jd.plugin` 京东；`soda.plugin` 汽水音乐 —— 8 条纯广告端点整条转空 + 7 条业务接口字段级净化 + 3 域 + 2 条 AND 锚定，解密面 5 个具体 host；`zhifu-fangdong.plugin` 智慧房东 —— 1 条活动位整条转空，解密面 1 host；`wechat.plugin` 微信 —— 2 条字段级净化 + 1 条纯推广端点整条转空，解密面 1 host、零域名规则）。
**关键约束**：整条 reject 只用于纯广告接口。京东 `functionId=start` 同时下发启动配置与开屏图，整条 reject 会白屏 —— 已改为响应体改写；该处置台账随 `test/cases/jingdong.test.js` 一并删除。

### M3 隐私 · L2 · 3 插件 / 0 脚本

**职责**：拦追踪/统计/归因 SDK 与 DNS 泄漏，纯 DNS 级 REJECT，不解密内容。
**资源**：主配置的常见分析 SDK 段（GA/AppsFlyer/Adjust/Sentry 等）+ DNS 泄漏检测域（18 条 → 强制走代理远端解析）。原 `Plugin/privacy-shield.plugin`（11 条 + 1 开关）已随收敛删除。现行拦截面是 `probe-block.plugin`（友盟 15 + 厂商遥测 11 + 前端监控 7 + Bugly 2 + ARMS 1 + Firebase 1 = **37 域**），全部 L2 DNS 级 REJECT、无 `[MitM]`。2026-09-30 由 6 个 `probe-*.plugin` 按 `ad-block` 同形合并（形状一致、无独立生命周期；通道分类保留为 ①–⑥ 小节注释，代价是通道级开关收敛为单插件开关）；并集时移出 `resolver.msg.xiaomi.net`（已由 L0 的 `dns-httpdns` 拦，留着是死规则）。
**关键约束**：推送保活 —— 只拦统计子域，保留 `config.jpush.cn` / `api.getui.com`，全拦 SUFFIX 会断推送。

### M4 银行与支付 · L2+L6 · 0 插件 / 1 snippet

**职责**：银行/支付类 App **免解密 + 免广告**。这是唯一以「不解密」为目标的功能域。
**资源**：`template/snippet/bank-ad-reject.tpl`（16 条 URL 路径级）+ 主配置 19 条银行域 DIRECT + `[MitM]` 负号列表（约 40 个银行域）。原 `Plugin/bank.plugin` 已随收敛删除。
**关键约束**：负号列表是**证书暴露面的收窄面**，误删会破银行 App。逻辑规则里 IP 子规则要放后面，防 DNS 查询。

### M5 工具 · L5 · 0 插件 / 0 脚本

**职责**：与业务无关的自建工具，零常驻流量。
**资源**：无成员。

> 当前最显著的单点：主配置**没有 `[Script]` 段**，全部脚本能力寄生在 2 个插件内（`qidian.plugin` 6 条 `[Script]` + `jd.plugin` 1 条）—— 任一停用，对应 App 的能力即全灭。

### M7 功能增强 · L4+L5 · 1 主责 / 0 次要成员

**职责**：非广告、非隐私、非分流的功能改写 —— VIP/画质/倍速解锁、签到打卡（cron）、去水印、领券、外链与区域解锁。
**成员**：仅 `qidian`（cron 签到 + Token/Cookie 捕获 + 发现页白名单），归 M7 主责，无次要成员。
**关键约束**：归入本模块必须有**真实规则消费**该开关，仅措辞含"解锁/增强"不算 —— 门禁逐条断言理由里指明规则数或 cron 事实。

### M6 基建 · 不产生运行时资源

**职责**：`src/*.ts → Scripts/` 唯一构建链（esbuild + inject）、`tools/*.mjs` 门禁（每条必须被接线）、`test/cases/*.test.js` 行为回归、`Loon.lcf` 生成与幂等。

## 当前布局的问题

能力过度集中（见 M5 段注）：全部脚本能力寄生在 2 个插件内（`qidian.plugin` / `jd.plugin`）。插件域的**存活覆盖**已于 2026-09-29 补齐 —— `dns-liveness` 原只读 `template/loon.tpl`，现扩到 `Plugin/*.plugin` 的 139 条可探针条目（138 精确 DOMAIN + 1 SUFFIX），判据按精确 host 收紧。

## 对抗审计的教训

本清单经对抗审计（把每条数字与断言拿去跟磁盘、官方文档对账）后定型，其中一条教训值得长期保留：

> 我最初宣称 M1–M6 是完备的，并写了门禁强制它。**门禁只会把我相信的东西固化，不会替我发现我没想过的东西。** 真正的发现来自"翻插件开关 tag 看作者自己怎么描述职责"——这个动作和清单是否自洽无关。

由此确立的三条工作纪律：
1. **文档数字必须由门禁反算**（`tools/doc-claims-check.mjs`），不许凭记忆写。
2. **断言与官方文档对账**，引用不存在的参数/枚举即判错（如策略层 REJECT 实为 5 种）。
3. **能力台账须同时记「已停用」**，否则下任只会误以为那些能力仍在生效。

## 能力缺口台账

**已关闭（G1，2026-09-29 按文档定论）**：策略层 REJECT 官方共 **5 种**（REJECT / -IMG / -DICT / -ARRAY / -DROP），本配置 127 条 REJECT（全部为裸 REJECT）——**这不是缺口**。三个变体描述的都是 HTTP 响应内容（官方《策略》：1×1 GIF / `{}` / `[]`），只有拒绝发生在请求转发阶段、客户端真收到 HTTP 响应时才有意义；而本配置 `domain-reject-mode = DNS`（官方《通用配置》），域名拒绝在 DNS 阶段用 `LOOPBACKIP` 完成，请求到不了 HTTP 响应层。叠加官方《HTTP 规则》"HTTP 规则仅匹配 HTTP 和 HTTPS 请求"——而本配置 490 条规则中 `URL-REGEX`/`USER-AGENT` 合计 **0 条**，变体唯一适用场景不存在。原台账把"未使用的功能"误记为"未做好的功能"，已关闭。重新引入的触发条件：改 `domain-reject-mode = Request`，或引入 `URL-REGEX`/`USER-AGENT` 做 HTTP 级拦截。

注：策略层 REJECT 官方共 **5 种**（REJECT / -IMG / -DICT / -ARRAY / -DROP）。`REJECT-VIDEO` 与 `REJECT-NO-DROP` 在官方《策略》文档中不存在；「REJECT 会被自动升级为 REJECT-DROP」亦无官方出处（文档只说 REJECT 返回 404 空体、REJECT-DROP 才丢包，并提示重试风暴时慎用）。

| # | Loon 能力 | 本仓用量 | 影响 | 归属 |
|---|---|---|---|---|
| G2 | `NOT` 逻辑规则 | 0 | 无法表达「排除某类的兜底」 | M2 |
| G3 | `SRC-PORT` 规则 | 0 | 未使用（主配置 DEST-PORT 2 条） | M1 |
| G4 | `load-balance`（PCC / Round-Robin / Random） | 0 | 单订阅组下收益低，暂不引入 | M1 |
| G5 | 新版权重 | 0 | 插件 `[Rule]` 无法限定「仅非 Final 策略下生效」 | M1 |
| G6 | `ssid-trigger`（蜂窝/WiFi 分流） | 0 | 未做蜂窝 / WiFi 分流 | M1 |
| G7 | `disable-udp-ports` | 0（**主动不启用**） | 该参数自 Loon 3.1.7 起已被 `DEST-PORT`/`PROTOCOL`/逻辑规则取代；本仓的等价能力由 `PROTOCOL, STUN, REJECT` + `DEST-PORT, 3478` 承担 | M1 |

**已解决**：`PROTOCOL, STUN, REJECT` 取代 `DOMAIN-KEYWORD, stun, REJECT`。关键词规则只能匹配含 "stun" 的域名，裸 IP STUN 逃逸面够不着；协议规则无此缺口，且官方《规则系统 3.1》第 1 条保证域名规则先命中，5 条通话白名单不受影响。需 Loon ≥ 3.1.7。

**已定论**（G16，经四条路径实测）：`GEOIP, CN, DIRECT` 维持不动。根因是官方《规则系统 3.1》第 2 条——域名规则未命中时再解析 DNS 并匹配 IP 规则，故任何需解析的 IP 兜底规则都会让长尾域产生本地解析。三条"零泄漏"替代路径全部实测否决：删 GEOIP 走纯域名规则 → 国内站走代理 4/4 超时；GEOIP 加 `no-resolve` → 域名类请求全部跳过 GEOIP 一律走代理，等同前者且更彻底；本地解析改走境外 DoH → 国内站解析到海外节点，直连 2/2 超时。第四条"恢复 CN 域名远程列表"隐私收益递减（长尾域仍解析），却需引入 Loon 无内建防护的依赖（官方未提供远程规则 hash/签名/版本锁定），否决。结论：泄漏面只是"解析器知道查过哪些域"，不改变流量走向；而三条零泄漏路全部实测损害可用性。

**已解决**（域名存活性）：主配置 127 条 REJECT + 9 个插件的 127 条域级 REJECT（合计 230 条）经 DoH 多解析器交叉审计，修正 1 处主机名错配（`alisc1.zijieapi.com` NXDOMAIN → 真实 host `tnc3-alisc1.zijieapi.com` 存活，规则从未生效）、删除 1 条错误补录（`qreport.cn` 系已全下线）。新增 `dns-liveness` 门禁守住此类静默失效——**语法合法的规则写错主机名，现有门禁一条都抓不到**。判据须落到子域（`imtmp.net` 裸域 NXDOMAIN 但 7 个子域存活，删掉即误伤），并区分「域名已注销」与「NS 活跃仅业务下线」。**2026-09-29 补齐覆盖**：该门禁原只读 `template/loon.tpl`，L0 三插件与 `qidian`/`probe-block` 的 139 条可探针域条目（138 精确 DOMAIN + 1 SUFFIX；生成块内的规则不重探, 由覆盖管线台账与 ≤45 天新鲜度守）**没有任何存活门禁**；现已扩面，实测 107 条存活、1 条「无 A 但 NS 活跃」只报告（`qidian.plugin` 的 `dl.tiku.qq.com`）。

**已解决**（UDP 面）：`udp-fallback-mode` 由 `DIRECT` 改为 `REJECT`。官方定义为「节点不支持 UDP 或未启用 UDP 转发时使用的策略」——取 DIRECT 时节点一旦无 UDP，全部 UDP（QUIC/游戏/通话）从本机真实 IP 直连漏出，与已用 `PROTOCOL, STUN, REJECT` 封 STUN 的 posture 矛盾。REJECT = 失败可见。**前置条件：东京组节点须启用 UDP**，否则通话/游戏不可用。

**已解决**（DoH 绕过面，2026-09-30）：`hijack-dns` 只收编**明文 UDP 53**；内置 DoH 的客户端（Chrome→`dns.google`、Firefox→`mozilla.cloudflare-dns.com`、Android 私有 DNS 等）自己加密解析，广告/追踪域拿到真实 IP 后 DNS 阶段域名 REJECT 被整体绕过 → 落到 IP 规则 → 境内 CDN 广告被 `GEOIP,CN,DIRECT` 直连放行。现封堵 6 个**纯公共解析器端点**（dns.google / cloudflare-dns.com / mozilla.cloudflare-dns.com / dns.quad9.net / doh.opendns.com / dns.adguard.com，双解析器 A 一致 + HTTPS `/dns-query` 探针取证），客户端回落明文 53 被 hijack 收编、拒绝面恢复。扩列判据：同语义（纯解析器端点）+ 双解析器取证 + 不与既有 REJECT/分流冲突，逐条登记。代价（用户接受）：手动配置上述解析器的客户端会失败回落明文 DNS —— 这正是收编目标。

已用满的（`Profile/Loon.lcf` `[Rule]` 段 490 行）：`DOMAIN-SUFFIX` 364 / `DOMAIN` 112 / `DOMAIN-KEYWORD` 4 / `PROTOCOL` 1（关键词少是**优点** —— 官方警告该类型耗时随数量线性增长）/ `IP-CIDR` 4 / `DEST-PORT` 3（含 DoT/DoQ 853 框架层兜底） / `GEOIP` 1 / `FINAL` 1。插件层另有：`qidian.plugin` `AND` 3 / `DOMAIN` 11 / `DOMAIN-SUFFIX` 1（共 15），`soda.plugin` `DOMAIN` 3 / `AND` 2（共 5），4 个纯 L2 插件：`ad-block`(人工策展 + 生成块) / `dns-httpdns` / `dns-leak` / `probe-block`(37) —— 生成块由 `tools/ad-coverage.mjs` 维护, 逐条证据在台账。

**已停用**（随插件下线而失去，非主动选择）：`URL-REGEX` / `USER-AGENT` / `IP-ASN` / `IP-CIDR6` / `OR` / `NOT`。

## 已定论（不再反复）

| 问题 | 结论 | 依据 |
|---|---|---|
| 本地 `[Rule]` vs 插件 `[Rule]` 谁优先 | **本地 > 插件 > 订阅** | 官方《规则系统 3.1 规则优先级》明文 |
| 域名类 vs IP 类规则先后 | 域名类优先；域名命中后不再走 IP 匹配；其余按配置顺序 | 同上 |
| 插件里的 `DIRECT` 会不会遮蔽主配置的 `REJECT` | **不会** | 同上 |

第二条推论：社区知识库里「插件里的规则优先生效」的说法**有误**，不必再作为待验证项挂着。
