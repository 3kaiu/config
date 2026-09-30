# LOON-FEATURES.md — Loon 官方功能基准 × 本仓使用规划

> **定位**：本文件是「Loon 官方现行能力 ↔ 本仓用法 ↔ 版本锚点 ↔ 路线图 ↔ 不采用清单」的对照基准。
> AGENTS.md 的已定论表与关键路径表引用本文件；两者与官方文档冲突时，以官方现行文档实测页为准，并同步修订本文件与 AGENTS.md。
> 基准日：**2026-09-30**（当日在本仓完成 P0/P1/P2 落地，见 §3）。
> 本文件不进 `tools/doc-claims-check.mjs` 扫描面（AGENTS.md / MODULES.md / MODULE-MANIFEST.json 三文件），因此不承载可反算数字；数量类事实一律以 AGENTS.md 为准。

---

## 0. 文档基准与版本锚点

### 0.1 两代官方文档

| 来源 | 状态 | 覆盖版本 |
|---|---|---|
| **nsloon.app**（Docusaurus，`loon0x00.github.io` 已 302 过去） | **唯一现行基准** | 到 Loon **3.5.2 (996)**；含 MitM 章节、Rewrite v2、Script v2、订阅 Section 格式 |
| GitHub `Loon0x00/LoonManual`（docsify） | **已冻结**（2024-03-24 后无推送） | 约 3.0–3.2 早期；README"支持 ss/ssr"等描述已过时 |

官方站点附 6 件工具（产物仍须过本仓门禁；能力详情见 §1.12）：[证书工具](https://nsloon.app/certificate-tool)、[插件转换器](https://nsloon.app/plugin-converter)、[Rewrite 编辑器](https://nsloon.app/rewrite-builder)/[转换器](https://nsloon.app/rewrite-converter)、[Script 编辑器](https://nsloon.app/script-builder)/[转换器](https://nsloon.app/script-converter)。

### 0.2 版本锚点（决定语法选型）

| 能力 | 起始版本 | 对本仓的含义 |
|---|---|---|
| 旧复写 body 类（`request/response-body-*`、`*-json-*`、`mock-*`） | Build 729 | jd/qidian 字段净化语法面 |
| 旧复写一条改多个 header | 3.2.1 (730) | — |
| `[Argument]` 插件参数段 | Build 733 | 15 个插件声明下限 ≥3.2.4(787)，均满足 |
| 同侧同正则复写链式执行 | 3.2.3 (749) | — |
| `ip-mode`（替代 `ipv6`） / `ipasn-url` | 3.2.3 (754) | 模板已用 `ip-mode=ipv4-only` |
| `domain-reject-mode` / `udp-fallback-mode` | 3.2.0 (702) | 模板核心拒绝面机制，官方明文 |
| `force-http-engine-hosts` 弃用 | 3.2.3 (787) | 模板未用 ✓ |
| **`hijack-dns`** | **3.2.5 (789)** | 模板 `hijack-dns = *:53` ⇒ **Profile 实际客户端下限 3.2.5 (789)** |
| `#!type=parser` 插件类型 | 3.5.0 (969) | 本仓不用（无订阅消费面） |
| **Rewrite v2**（`request/response if … then …`） | **3.5.1 (978)** | qidian 已整体迁移 |
| **Script v2**（统一 `script(...)` + `with`） | **3.5.1 (983)** | qidian 声明 3.5.1(978) ⇒ **可用 v2 复写、不可用 v2 脚本** |
| 节点级 `server-dns` / 订阅 `server-dns` | 3.5.2 (996) | 暂无消费面（节点走外部订阅） |

---

## 1. 逐功能使用基准（官方语法 × 本仓现状）

### 1.1 `[General]`（template/loon.tpl:7）

| 功能 | 官方用法 | 本仓用法 |
|---|---|---|
| 流量绕过 | `bypass-tun`（TUN）/`skip-proxy`（HTTP Proxy） | **两段均已配置**（2026-09-30 L2 落地）：skip-proxy 含 localhost/*.local/*.lan/*.home.arpa；bypass-tun = 12 网段（v4 私网/CGNAT/环回/链路本地/组播/广播 + v6 前向冗余）+ 同款 4 主机名 |
| 局域网代理 | `allow-wifi-access` + `wifi-access-http/socks5-port` | `false` |
| 接口选择 | `interface-mode`: Auto/Cellular/**Performace**/Balance | `Performace`（官方原样拼写，勿纠正） |
| SSID 场景切换 | `ssid-trigger = "WiFi":DIRECT,"cellular":PROXY,"default":RULE` | 未启用（可选采纳项，见 §3 P1-可选项） |
| IP 栈 | `ip-mode`: ipv4-only/dual/ipv4-preferred/ipv6-preferred | `ipv4-only`；`ipv6` 参数已弃用 |
| DNS 劫持 | `hijack-dns = *:53`（3.2.5+） | `*:53` —— 决定 Profile 下限 789 |
| Fake IP 例外 | `real-ip = 域名列表` | 银行域 + APNs + STUN 主机（L6 银行免解密的一部分） |
| UDP | `disable-udp-ports` / `disable-stun` / `udp-fallback-mode=DIRECT\|REJECT` | fallback=REJECT；stun=false（M3 收紧时的官方开关） |
| 域名拒绝阶段 | `domain-reject-mode=DNS\|Request` + `dns-reject-mode=LOOPBACKIP\|NOANSWER\|NXDOMAIN` | **DNS + LOOPBACKIP** —— 133 条裸 REJECT 的语义根基，官方明文 |
| 测速 | `proxy-test-url` / `internet-test-url` / `test-timeout`（**秒**，全局默认） | hicloud 直连检测 / gstatic 代理测速；组级 `tolerance=100ms` / `max-timeout=5000ms` 精细控制 |
| 数据库 | `geoip-url` / `ipasn-url`（754+） | GeoIP 客户端直连 raw；**ipasn 已停用**（AGENTS 已定论），勿恢复 |
| 已弃用 | `ipv6`→ip-mode；`switch-node-after-failure-times`→自动；`force-http-engine-hosts`→787 弃用；`skip-first-packet`→968 弃用 | **四项全部未用**，不得回流 |

### 1.2 `[Host]` DNS 映射（官方 7 种类型）

```
域名→IPv4/IPv6        example.com = 192.0.2.10
域名别名              example.com = origin.example.com
域名指定 DNS          *.example.com = server:https://dns.example.com/dns-query
SSID 指定 DNS         ssid:Office-WiFi = server:system
域名 IP 栈            example.com = ip-mode:prefer-v4
IP→IP                198.51.100.10 = 192.0.2.20
代理内续用映射        example.com = 192.0.2.10,use-in-proxy=true
```

未吃到的候选能力：银行域固定 IP、订阅节点服务器域名 `server:` 指定 DNS。

### 1.3 节点 `[Proxy]` 与订阅 `[Remote Proxy]`

- **11 类协议**：SS(+obfs/ShadowTLS/udp-over-tcp)、SSR、HTTP/HTTPS、SOCKS5(+TLS/ShadowTLS)、VMess(ws/http/Reality)、VLESS(+XTLS Vision/Reality)、Trojan(+Reality)、WireGuard(v4/v6)、Hysteria2(salamander/端口跳跃)、AnyTLS、Custom by JS。
- **通用参数**：`server-dns`(996+)、`ip-mode`、`fast-open`、`udp`、`block-quic`、`udp-over-tcp`、`skip-cert-verify`、`sni`、`tls-profile`（ClientHello 指纹：global/default/safari-ios18/safari-ios-26/chrome/chrome147）、`tls-cert-sha256`/`tls-pubkey-sha256`（同配时 **pubkey 优先**；自签证书免装 CA）。⚠️ **节点/订阅侧 `ip-mode` 枚举是 `v4-only/dual/prefer-v4/prefer-v6/v6-only`，与 `[General] ip-mode`（ipv4-only/dual/ipv4-preferred/ipv6-preferred）拼写不同层不同，勿混用**。节点 `server-dns` 解析链：匹配到的 Host Map → 节点 server-dns → SSID DNS → 全局 DNS，**命中指定 DNS 后失败不回落**，CNAME 续用同组。节点筛选（nodefilter）：App 内置能力 NodeSelect / NameKeyword / NameRegex + 官方常用正则（`^(?!.*A)` 排除式）；**配置文件面 `[Remote Filter]`**（`HK = NameRegex,Subs,FilterKey = *HK` 形态）见于官方 2021 示例，现行文档页未载该 Section —— 采用前实测。
- **订阅**（`[Remote Proxy]`）：`parser-enabled`、`udp/block-quic/fast-open/vmess-aead/skip-cert-verify`（true/false/default 三态）、`flexible-sni`、`enabled`、`img-url`、`parser-plugin`+`argument`、`server-dns`；订阅文件可带 `[DNS]/[Host]/[Proxy]` 三个 Section；流量读 `Subscription-Userinfo` 头。
- **本仓**：`[Proxy]` 无静态节点（surgio-build 门禁）；订阅在客户端导入聚合为"东京"组 —— 凭据/节点不进仓库是 AGENTS 边界。若未来自建订阅文件，用 Section 格式。

### 1.4 `[Proxy Group]`

`select` / `url-test`(url+interval+tolerance ms) / `fallback`(url+interval+max-timeout ms) / `load-balance`(algorithm: **Random/PCC/Round-Robin**)。
"东京"= select 聚合外部订阅。银行/支付若要求"同会话同出口"，官方对应解法是 **PCC**（同主机名锁节点）。

遗留补充（2021 示例证据，现行《策略组》页未载，采用前实测）：`ssid` 组类型 `别名 = ssid, default=X, cellular=Y, "SSID名"=Z`；内置 `PROXY` 策略指向：有本地节点→第一个本地节点，无本地→第一订阅第一节点，都无→DIRECT —— 本仓不依赖内置 PROXY，显式聚合组"东京"。

### 1.5 规则 `[Rule]` / `[Remote Rule]` / `FINAL`

| 类别 | 语法 | 选用判据 |
|---|---|---|
| 域名 | `DOMAIN`/`DOMAIN-SUFFIX`/`DOMAIN-KEYWORD` | 本仓主力 |
| IP | `IP-CIDR`/`IP-CIDR6`/`GEOIP`/`IP-ASN`(+`no-resolve`) | 纯 IP 目标才加 no-resolve |
| HTTP | `URL-REGEX`/`USER-AGENT`（**仅 HTTP/HTTPS**） | 本仓 0 条（AGENTS 已定论的前提之一） |
| 端口 | `SRC-PORT`/`DEST-PORT`（`80-443`、`>=443`） | STUN 3478 等已在用 |
| 协议 | `PROTOCOL`(HTTP/HTTPS/TCP/QUIC/STUN/UDP) | `PROTOCOL,STUN,REJECT` 已用 |
| 逻辑 | `AND`/`OR`/`NOT`（IP 子规则放后面） | 需组合条件时再引入 |
| 订阅规则 | `URL, POLICY` | LRU 命中近 0ms（官方实测：枚举类 10–20 万条仍 1ms 内） |
| 兜底 | `FINAL` | 长尾广告域一律 Final ✓ |

优先级（官方明文）：域名类先行且命中即不查 IP 类；其余按配置顺序；**本地 > 插件 > 订阅**；未命中走 FINAL。

语法精度备注（2026-09-30 逐页核准）：`DOMAIN-SUFFIX` 是后缀**边界**匹配（`apple.com` 匹配 `www.apple.com` 但不匹配 `app-apple.com`）；官方实测 `DOMAIN-KEYWORD`/`USER-AGENT`/`URL-REGEX` 耗时随数量与表达式复杂度**线性恶化**（枚举类 DOMAIN-SUFFIX 20 万条仍 1ms 内、IP-CIDR 10 万 1ms、IP-ASN 5 千 1ms）—— 本仓「可枚举即不用宽匹配」纪律的官方原文落点；`SRC-PORT`/`DEST-PORT` 支持单端口、闭区间（`80-443`）、比较（`>=443`）；`AND`/`OR`/`NOT` 需 3.1.7+，**`NOT` 只能包含一个子规则**（可嵌 AND/OR），混合域名+IP 子规则时官方建议 **IP 子规则放后面**减少无谓 DNS 查询；订阅规则 `URL, POLICY` **无 hash/签名/版本锁定机制**（G16 否决远程清单的官方依据）。

### 1.6 策略与 REJECT 家族（⚠ 2026 口径变化）

- 现行《策略》：**`REJECT` = 404 + 空响应体**（旧手册为 200+空体）；`REJECT-IMG`=200+1×1 GIF、`REJECT-DICT`=200+`{}`、`REJECT-ARRAY`=200+`[]` 不变；`REJECT-DROP` 丢包不响应并警示重试风暴。
- `REJECT-NO-DROP` 不存在；`REJECT-VIDEO` 不在策略五变体之列，但 **Rewrite v2 Action 层有 `reject_video(空白视频)`** —— 两层面勿混（AGENTS 已定论表已收录）。
- 本仓 `[Rule]` 全裸 REJECT 且 `domain-reject-mode=DNS` ⇒ 拒绝在 DNS 层完成，上述 HTTP 响应面差异**行为无影响**；口径已按现行文档校准。

### 1.7 `[Rewrite]` 复写

**旧语法全表**（官方标注"仅维护旧配置，不再扩展"；含空格需 `\x20`）：

```
^url regex-replacement                     # URL 替换
^url 302|307 target                        # 重定向
^url reject|reject-200|reject-img|reject-dict|reject-array
^url header-add|header-del|header-replace|header-replace-regex …   # 730+ 一条多 header
^url request-body-replace-regex|request-body-json-add|…-replace|…-del|…-jq|mock-request-body …
^url response-header-… / response-body-replace-regex|response-body-json-…|response-body-json-jq|mock-response-body …
```

**v2 语法**（978+，qidian 范式）：

```
request|response if <条件> then <action> [| <action>…]
# 条件: == / ~= / && / || / ()；变量 ${url} ${request.method} ${request.header['X']} ${response.status} ${response.header['X']}；as 命名捕获
# Action: url.replace / redirect(302|307,…) / reject(status[,body]) / reject_img|reject_dict|reject_array|reject_video /
#         header.add|set|del|replace / body.replace / json.add|delete|replace|jq|jq_file / body.mock|mock_file / 批量平行数组
# JSON 值只支持 String/Number/Boolean/null/变量 —— 不含数组/对象（置空数组用 json.jq）
# 插件参数类型化: input / select / switch(Boolean) / type=number
```

执行要点：Rewrite 在**规则匹配之前**、仅对 HTTP 与经 MitM 解密的 HTTPS 生效；本地 > 插件，同文件自上而下，同侧同正则可链式（749+）。

官方转换器样例佐证（2026-09-30）：旧 `header` 动作 → `url.replace(...)`（捕获用 `as m` 绑定 + `${m.1}` 引用）、`mock-response-body` → `response.body.mock_file("json","path",200)`、`response-body-json-del` → `response.json.delete(...)`；转换器**自动为正则补 `i` 标志** —— 迁移后须逐条复核大小写语义。

### 1.8 `[Script]`

| 类型 | 旧语法 | v2（983+） |
|---|---|---|
| 请求/响应 | `http-request/http-response ^url script-path=…,requires-body=true,timeout=10,argument=[{KEY}]` | `request\|response if <条件> then script("a.js", {${KEY}}) with tag=…, timeout=…, requires_body=true` |
| 定时 | `cron "0 8 * * *" script-path=…` | `cron "0 8 * * *" then script(…)`（5/6 段；插件可动态 `cron ${cron}`） |
| 网络变化 | `network-changed script-path=…` | `network-changed then script(…)` |
| 手动 | `generic script-path=…` | `generic then script(…)` |

- **v2 新增**：`with` 字段（enable/tag/img_url/timeout/debug/requires_body/binary_body_mode，可引用插件参数）；`$argument` 三形态（null/String/插件对象）；Response 强制 URL Guard；HTTP 第一条命中。
- **行为差异**：旧语法多个 network-changed 只执行第一个，v2 全部执行；默认超时 Request/Response 20s（旧 10s）、Cron/其他 300s（旧 200s）。
- **⚠ 互斥（官方明文，已固化为 R1/R2 门禁）**：Request Body Rewrite/Mock 命中 → Request Script 不执行；Response Body Rewrite 命中 → Response Script 不执行；Request 阶段终止响应 → 两侧脚本均不执行。
- **Script API 面不变**：`$loon/$script/$config/$persistentStore/$notification/$httpClient/$done/$environment` —— 本仓 `src/env.ts` 封装不受迁移影响。

### 1.9 `[Plugin]`

- 元数据（官方 `#!` 集合）：`name/desc/author/homepage/icon/version/system/system_version/loon_version/tag/type`（type: normal｜parser）。**`#!arguments-desc` 不在官方集合内** —— 本仓已于 2026-09-30 从两个插件移除，参数唯一真源是 `[Argument]`。
- `[Argument]`：`input`/`select`/`switch` + `tag`/`desc`；脚本侧 `argument=[{KEY}]`（旧）/ `{${KEY}}`（v2 对象）；`enable={KEY}` 开关绑定（官方收录）；v2 复写用 `${KEY}` 条件。
- 插件规则策略白名单：**DIRECT / REJECT 系列 / PROXY**，缺省 DIRECT —— 13 个 L2 插件正踩此契约。
- 分发：`template/loon.tpl` `[Plugin]` 段是唯一渠道（wiring-check 判红）；客户端侧最短接入路径 `loon://import?plugin=encode(url)`。

### 1.10 `[MitM]`

```
hostname = example.com, *.example.org, -private.example.org   # 通配 + `-` 排除（官方能力）
ca-p12 = <Base64 单行>
ca-passphrase = <密码>
```

CA 用官网证书工具本地生成。**本仓纪律**：解密面最小化（mitm-orphan/mitm-coverage 双门禁）；**通配与 `-` 排除弃用** —— 通配 host 判 generic 恒报孤儿，显式列举是硬约束；银行域靠 `real-ip` + 不进 hostname 实现免解密（L6）。

### 1.11 Scheme / 统一链接 / App 能力

- `loon://on|off|editconfig|flowmodel=direct|filter|proxy|proxymode=tun|mix`；`loon://import?sub|nodelist|rules|plugin|iconset|geoip|parser=encode(url)`；`loon://update?sub=all`；网页侧替换为 `https://www.nsloon.com/openloon/`。
- App 侧：HTTP/HTTPS(含 HTTP/2) 抓包解密、请求/响应保存、tvOS、策略组延迟测试 —— 无配置语法面，属客户端操作。

### 1.12 官方工具链 × 官方示例仓库（2026-09-30 核准）

**六件工具**（全部浏览器本地完成、不上传；产物仍须过本仓门禁）：
- **插件转换器**：批量把旧版插件的 `[Rewrite]`/`[URL Rewrite]`/`[Script]` 迁到新语法（单文件/多文件/ZIP/RAR；≤50MB/文件、≤10MB/插件、单批 ≤100MB/1000 个）；元信息、`[Argument]`、注释与其他分区原样保留，已有新语法不重复转换，无法转换的行保留原文并给原因，报告随 ZIP 导出 —— **单 App 接入社区插件的预处理工具**（APP-ONBOARDING 取证前评估用）。
- **Script 转换器**：迁移 Trigger、脚本路径、`$argument`、指令属性；样例输出证实 v2 全形态（四触发器 × `script("path", args) with tag/timeout/requires_body/binary_body_mode/enable/img_url`）—— **P3 迁移底稿工具**。
- **Rewrite 转换器**：逐行迁移 Action/URL 正则/捕获引用（细节见 §1.7 佐证行）。
- **Rewrite/Script 编辑器**：图形化生成 v2 语法；**证书工具**：本地生成 MitM CA 或从现有配置提取证书（本仓纪律见 §1.10）。
- **教程博客为空置渠道**（2024-03 起仅 Welcome 一帖，承诺的"教程/app 公告/版本更新日志"无内容）—— 官方文档面以 §4 清单为全集，不存在更多隐藏文档页。

**官方示例仓库 `Loon0x00/LoonExampleConfig` 交叉核对**（`example.conf` 为 2021 样例；与现行文档的差异即"遗留面"，采用前一律实测）：
- `[Remote Filter]`（§1.3）、`ssid` 策略组类型（§1.4）；
- `allow-udp-proxy` 现行《通用配置》参数表**未收录**（遗留参数，勿凭样例启用）；
- `wifi-access-socket5-port` 为旧拼写，现行表为 `wifi-access-socks5-port`；
- `test-timeout` 单位为**秒**（组级 `max-timeout`/`tolerance` 为毫秒），分层勿混；
- 2021 样例与现行《DNS》页一致地暴露 doq 默认端口口径漂移（样例时代即存在，本仓显式 `:853` 免疫）。

---

## 2. 本仓纪律（由官方语义推导，防漂移）

1. **复写×脚本开关编排范式（qidian 样板）**：同一文件同一侧，`suppressing 复写`（body/json/reject/redirect 族）必须逐条带开关条件（`${KEY} == …` / 旧 `enable={KEY}`）；同侧脚本不带同开关 ⇒ 开=复写接管、关=脚本净化，互斥可预期。无条件复写（R1）与"同开关共激活 + URL 前缀重叠"（R2）由 `tools/rewrite-script-mutex-check.mjs` 判红。诚实边界：任意两条正则是否命中同一 URL 不可静态判定，非前缀重叠的疑似冲突按本节纪律人工自查。
2. **元数据契约**：插件元数据只用官方 `#!` 集合；参数唯一真源 `[Argument]`（app-index 从 `[Argument]` 的 switch KEY 反查 App 归属，KEY 命名不许改）。
3. **版本下限**：Profile ≥3.2.5(789)（hijack-dns）；qidian=3.5.1(978) ⇒ 只用 Rewrite v2、不用 Script v2(983)；Script v2 迁移门槛 = 全量用户 ≥983（见 §3 P3）。
4. **不采用清单（防反复评审，均为已定论而非缺口）**：
   - `[Proxy]` 静态节点（surgio-build 门禁：发布面无静态节点）；
   - `[Remote Proxy]`/订阅 URL 入库（凭据边界）；
   - `resource-parser` / `#!type=parser`（无订阅消费面）；
   - `allow-wifi-access` 局域网代理共享（单设备姿态：开启即在 LAN 暴露无认证代理端口）；
   - MitM 通配与 `-` 排除（孤儿门禁要求显式列举）；
   - 四个弃用参数（ipv6 / switch-node-after-failure-times / force-http-engine-hosts / skip-first-packet）；
   - `ipasn-url`（ASN mmdb 已停用）；
   - **脚本桩替换**（2026-09-30 评估 SukkaW/Surge 的 enhance ADBlock 手法后不采用）：他们把广告/分析脚本的 URL 302 到自托管 no-op JS 桩（`adsbygoogle.js`/`gpt.js`/`analytics.js` 等），优点是页面不再因脚本被拒而报错；代价是**必须开 MitM**（他们自己的 README 也写 URL-REGEX+MITM 开销极大）、要自托管并探活一批桩文件、且 `[URL Rewrite]` 只在我们已决定不进的解密面里生效。本仓判据是「DNS 阶段 REJECT + 零证书成本」，同一批域已在 L2 覆盖 —— 为去广告付证书与桩文件维护成本不划算。若将来真出现「被拒脚本导致页面白屏」的实例，再按 App 逐个取证后重开此议。
5. **字段级净化的升级备选（未执行，须重新取证后再动）**：`response-body-replace-regex` 改 key 可换 `response-body-json-del/replace/jq`（旧语法 729+ 即有）。取舍：字段重命名卖点是"结构全保留抗异常分支"，json-del 会少一个 key —— 按 APP-ONBOARDING 流程逐接口取证后再决定。
6. **DNS 收编分层（2026-09-30 架构分层；取代原"公共 DoH 端点封堵 6 条"）**：`hijack-dns` 只收编明文 UDP 53，自带 HTTPDNS/DoH 的 SDK 与浏览器会整体绕过 DNS 阶段拒绝面（广告域拿真实 IP → IP 规则 → GEOIP 直连放行）。现按**开关粒度**分三层处置：
   - **明文 UDP 53** → `hijack-dns = *:53`（General 层，插件开关动不了）；
   - **域名级加密解析端点** → `Plugin/dns-leak.plugin`（**19 条**公共 DoH/DoT 端点，含原 6 条并扩列；可按需启停、改名单经 CDN 生效不必重导入 Profile）+ `Plugin/dns-httpdns.plugin`（**11 条** HTTPDNS 厂商端点 + 2 条 `AND` 锚定关键词兜底，收编 App 自带解析）；
   - **端口级兜底** → 主配置 `DEST-PORT, 853, REJECT`（DoT/DoQ；插件被关也仍在。依据：853 是 IANA 的 DoT 端口，官方《DNS》页亦写作 DoQ 默认端口）。
   扩列判据 = 纯解析器端点 + 双解析器 A 一致 + `/dns-query` 响应形如解析器（400/415/505/200 DNS）+ **不在本仓解析链内**（`dns.alidns.com` / `doh.pub` 是 `doh-server`/`doh3-server`/`doq-server`/`doh_fallback` 的上游，拦它们 = 自断解析链；由 `test/cases/plugin-layering.test.js` 断言）。
   **自伤分析（端口规则）**：本仓 `doq-server = quic://dns.alidns.com:853` 与 DoT 同端口 —— 若 Loon 自身上游也过 `[Rule]` 匹配，该并发源会被自己拦掉；官方《DNS》页"并发查询**所有有效服务器**"⇒ 最坏是少一个并发源而非解析中断。**实机验证未做**，落地后按 `template/loon.tpl` 该规则上方的清单验证（临时只留 doq-server 观察解析）。
   **残留面（已知未覆盖）**：① IP 直连型 DoH（`https://8.8.8.8/dns-query`、`https://1.1.1.1/dns-query`）既无域名可匹配也不走 853 ⇒ 需 `IP-CIDR` 级封堵，代价是这些 IP 的其他用途（连通性检测/延迟测试）一并失效，**未落地**；② 非 853 端口的自定义 DoT/DoQ 服务器；③ 走代理远端解析（`doh-server` 由节点代理解析）不属绕过，是设计内行为。
   **已知未收录参数**：`sni-sniffing` / `ipv6-vif` 不在现行《通用配置》参数表 —— 保留现值、生效性待实测、不得作为论证前提（ipv4-only 的论证不依赖 ipv6-vif 存在）。

---

## 3. 路线图与状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| **P0 文档口径校准** | REJECT=404 新口径；reject_video 层面重定位；nsloon.app 定为唯一基准；Profile 下限 3.2.5(789) 落 AGENTS 已定论表 | ✅ 2026-09-30 |
| **P1 低风险补强** | 移除 `#!arguments-desc`（jd/qidian，`[Argument]` 为唯一真源）；15 插件 `#!loon_version` 复核（13×3.2.4(787) 为声明下限、qidian 3.5.1(978) 与 v2 复写一致）。可选未采纳：ssid-trigger、geoip-url 入模板（等用户决策） | ✅ 2026-09-30 |
| **P2 互斥门禁** | `tools/rewrite-script-mutex-check.mjs` R1/R2 + `test/cases/rewrite-script-mutex.test.js`（6 用例）；实测 qidian 5 脚本×15 复写全带编排开关、模板/jd/13 L2 插件零冲突 | ✅ 2026-09-30 |
| **P2.5 分流/DNS 深度核准** | 逐项核准 General/DNS/Rule/IP 规则/策略组/订阅 六页官方文档：L1 注释漂移修正（real-ip）+ 未收录参数标注；L2 bypass-tun 补主机名条目对齐 skip-proxy；L3 公共 DoH 端点封堵 6 条（取证后落地）。L4（ssid-trigger、DoQ 第二并发源）**未采纳**，仅留判据 | ✅ 2026-09-30 |
| **P2.6 规则/节点面逐页核准** | 规则 8 子页（domain/ip/http/port/protocol/logic/final/sub_rule）+ 单节点/节点筛选/策略主页全部核准：**零规则改动**；精度事实入档 §1（节点级 ip-mode 枚举与 General 不同、tls-pubkey-sha256 同配优先、节点 server-dns 解析链不回落、NOT 单子规则、KEYWORD/UA/URL-REGEX 规模警告、订阅规则无完整性机制） | ✅ 2026-09-30 |
| **P2.7 工具链/示例仓库/全参数表核准** | 官方 6 工具核准（转换器样例 = v2 语法权威佐证，P3 底稿就绪）；LoonExampleConfig 交叉核对产出遗留面清单（`[Remote Filter]`/`ssid` 组/`allow-udp-proxy`/旧拼写 socket5，采用前实测）；现行《通用配置》全参数表二次核对维持 sni-sniffing/ipv6-vif 未收录结论；修正本档 §1.1 bypass-tun 过期描述与 §1.3 nodefilter 配置面 | ✅ 2026-09-30 |
| **P2.8 广告平台集合化（全局整合第一步）** | 7 个按平台拆分的 `ad-*` 插件合并为 1 个 `Plugin/ad-block.plugin`（**59 域零重叠并集**，合并前实测 ad×ad = ad×probe = ad×主配置 = **0** ⇒ 分散的是结构不是内容；按平台分节保留全部取证注释）：`[Plugin]` 15→9 条、manifest M2 成员 8→2、CDN 探活 7→1、测试插件数下限 12→7；平台层门禁范围从「文件路径 `Plugin/ad-intl*`」改为集合插件 + `OUT_OF_CORPUS_ROOTS` 结构性排除（国内 SDK/Google 族；每次运行打印 + 死豁免判红）。⚠️ 代价：平台级开关收敛为**单插件开关**（纯 `[Rule]` 挂不了条件参数） | ✅ 2026-09-30 |
| **P2.9 插件分层与 DNS 收编（整合第二步）** | 引入 **L0 依赖层 / L1 消费层**：新增 `dns-httpdns.plugin`(HTTPDNS 拦截器, 11 域逐条取证 + 2 条 AND 锚定兜底) 与 `dns-leak.plugin`(DNS 防泄漏, 19 域公共 DoH/DoT 端点)，原主配置的裸 `httpdns` 关键词与 6 条 DoH 封堵**迁入插件**(单一真源, 避免本地规则把插件行遮蔽成死条目)；框架层保留 `DEST-PORT, 853, REJECT`(DoT/DoQ 端口兜底, 插件关掉也在)；`[Plugin]` 重排为 ad-block → dns-httpdns → dns-leak → qidian/jd/probe-*；新增 `test/cases/plugin-layering.test.js` 钉死顺序/依赖/单一真源/解析链不被拦。⚠️ 代价：关闭任一 L0 插件 = 该层收编失效(加密 DNS/HTTPDNS 绕过回归) | ✅ 2026-09-30 |
| **P2.10 L0 覆盖全面化（整合第三步）** | 手工逐条写域无法覆盖 500+ 个有一手声明的平台, 故把判据做成管线 `tools/ad-coverage.mjs`: ① 平台声明 ≥8/15 ② 双解析器 A 存活 ③ HTTPS 非 200+HTML ④ 非多业务大厂/功能即产品 ⑤ 非泛解析根域(随机子域对照); 产物 = 三个 L0 插件的**生成块**(ad 423 + httpdns 4 + dnsleak 16 = 443 条) + 证据台账 `test/fixtures/ad-coverage/ledger.json`(10,573 条候选逐条留档); 实测: 9,490 个候选无 A 记录(按父域推定就是 9,490 条死规则)、660 个转人工; 门禁 = `check:coverage`(产物↔台账) + 台账 ≤45 天新鲜度 + `coverage-refresh.yml` 每月重跑开 PR | ✅ 2026-09-30 |
| **P3 语法迁移（门槛制）** | Script v2：仅当全量用户 ≥3.5.1(983)（qidian 需同步抬 `#!loon_version`）；迁移用官方 script-converter 生成后过 `check:scripts` 临时目录比对；字段净化 json-* 备选见 §2-5 | ⏸ 门槛未到 |
| **P4 永久不采用** | §2-4 清单 | 🔒 长期 |

---

## 4. 官方文档引用页（nsloon.app）

| 域 | URL |
|---|---|
| 总入口 | `https://nsloon.app/docs/intro` |
| 节点 | `/docs/Node/` · `/docs/Node/subscription` · `/docs/Node/nodefilter` |
| 规则 | `/docs/Rule/`（含 domain/ip/http/port/protocol/logic/final/sub_rule 子页） |
| 策略 | `/docs/Policy/` · `/docs/Policy/policygroup` |
| 复写 | `/docs/Rewrite/rewrite_v2`（新） · `/docs/Rewrite/`（旧） |
| 脚本 | `/docs/Script/script_v2`（新） · `/docs/Script/`（旧） · `/docs/Script/script_api` |
| 插件 | `/docs/Plugin/` |
| DNS | `/docs/DNS/` · `/docs/DNS/hostmap` |
| MitM | `/docs/MitM/` |
| 通用配置 | `/docs/General/` |
| Scheme | `/docs/Scheme/` |
| 工具 | `/certificate-tool` · `/plugin-converter` · `/rewrite-builder` · `/rewrite-converter` · `/script-builder` · `/script-converter` |
