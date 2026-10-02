# AGENTS.md

Loon 单入口配置仓库：`Profile/Loon.lcf` 由 `template/` + `surgio.conf.js` 生成；`Scripts/` 除 `Qidian.js` 外均为 `src/*.ts` 的 esbuild 产物。

**资源组织以 [`MODULE-MANIFEST.json`](MODULE-MANIFEST.json) 为单一真源**（人类可读投影见 [`MODULES.md`](MODULES.md)），按 **Loon 介入层 L0–L6** 而非官方文档域归类为 **M1–M7** 七个模块。改动任何插件/脚本/snippet 前先查归属。

## 命令

- `npm run build`：注入 `src/env.ts` 与 `src/lib/*.ts`，把 `src/*.ts` 压缩到 `Scripts/`。改源码后必须执行。
- `npm test`：227 个行为级用例（含复写×脚本互斥门禁），引用全部 2 个 Scripts 产物（`Qidian.js` 手工轨 + `jingdong.js` 构建轨）；随后执行规则顺序与接线检查。关键文档数字由 `tools/doc-claims-check.mjs` 对照实测（该系统扫 `AGENTS.md` + `MODULES.md` + `MODULE-MANIFEST.json` 三份，跨文件矛盾判红）。
- `npm run lint`：ESLint flat config，检查 `Scripts/`、`test/`、`tools/`。
- `npm run generate`：Surgio 3.19 从纯静态模板生成 `Profile/Loon.lcf`。该命令会创建空 `dist/`，`.gitignore` 中对应规则必须保留。
- `npm run check:all`：串行执行 sync、rewrite、src、orphan、plugin、contract、workflows、scripts、index、secrets、profile-hash、**coverage** 门禁；不包含 build、test、lint、generate。`scripts` 把 build 命令重定向到**临时目录**重建后与 `Scripts/` 逐字节比对 —— 补的是本地盲区：手改产物或改了 src 没 build 时，其余门禁会全绿。
- `npm run audit:ci`：固定使用 `registry.npmjs.org` 获取审计数据。

## 七个模块

| 模块 | 职责 | 介入层 |
|---|---|---|
| **M1 分流** | 决定请求走哪条链路，不改写内容 | L2+L3 |
| **M2 广告治理** | 拦广告。**唯一跨 3 层的模块** | L2+L4+L5 |
| **M3 隐私** | 拦追踪/统计 SDK 与 DNS 泄漏 | L2 |
| **M4 银行与支付** | 银行域**免解密** + 免广告 | L2+L6 |
| **M5 工具** | 通知/诊断/搜索，零常驻流量 | L5 |
| **M6 基建** | 源码、构建、门禁、生成 | — |
| **M7 功能增强** | VIP/画质/倍速解锁、签到打卡、去水印、领券 | L4+L5 |

粒度分三级：`single-app`（单 App）/ `cross-app`（跨 App 聚合）/ `global`（全局）。
主责唯一；次要职责用 `also_members` 挂在**次要责任方**模块上（`from` 字段指回真实主责）。

## 关键路径

| 路径 | 角色 | 规则 |
|---|---|---|
| `src/*.ts` | 唯一脚本源码 | 可改；改后必须 build 并补行为测试 |
| `src/lib/*.ts` | esbuild 注入模块 | 导出名在消费者中按全局标识符使用 |
| `src/env.ts` | `Env` 兼容与宿主封装 | 只经 `--inject` 注入 |
| `Scripts/*.js` | CDN 运行时脚本 | **仅 `Qidian.js` 存在**（手工轨，无 src）；新增脚本须走 src/ 构建并由 CI 检查漂移 |
| `Scripts/Qidian.js` | 无源码手工轨 | 引擎 marker 内变更须同步 `ENGINE-MANIFEST.json` |
| `Plugin/*.plugin` | Loon 插件外壳（**9 个**，**分两层**：L0 依赖层 = `ad-block.plugin` 广告平台拦截器（968 = 人工策展 + 418 生成 + 490 社区复核）+ `dns-httpdns.plugin` HTTPDNS 拦截器（72）+ `dns-leak.plugin` DNS 防泄漏（35）；L1 消费层 = `qidian.plugin` 起点 + `jd.plugin` 京东 + `soda.plugin` 汽水音乐（M2·luna 接口净化）+ `zhifu-fangdong.plugin` 智慧房东（M2·活动位净化）+ `wechat.plugin` 微信（M2·公众号文章广告净化）+ `probe-block.plugin` 上报/埋点拦截（M3·6 通道并集）。L0 必须是 `[Plugin]` 段最前三条） | `[Script]`/`[Rewrite]`/`[MitM]` 与参数必须配套；**新增插件必须同时登记进 `template/loon.tpl` 的 `[Plugin]` 段**（该段是唯一分发渠道），否则 `npm test` 的 wiring-check 判红；插件元数据只用官方 `#!` 集合（**10 个**：name/desc/author/homepage/icon/system/system_version/loon_version/tag/type）—— 由 `tools/plugin-lint-check.mjs` 的 `META_KEYS` 白名单**判红**（2026-09-30 前是纸面纪律：`#!version` 曾照抄本仓基准里的错记录混进两个插件）；`#!name` 内不得嵌数量（会漂移）；参数唯一真源是 `[Argument]`。扩展名官方无规定（转换器接受 `.lpx/.plugin/.conf/.txt`），详见 [LOON-FEATURES.md](LOON-FEATURES.md) §1.9 |
| `template/loon.tpl` | Loon 模板 | 修改后 regenerate + `check:sync`；`Proxy` 必须直接聚合外部订阅策略组"东京"；`[Plugin]` 增删 URL 后须同步 `.github/workflows/upstream-health.yml` 的 CDN 探活（`upstream-coverage` 双向断言） |
| `template/snippet/*.tpl` | 分流规则片段 | 归 M1（5 个）或 M4（1 个） |
| `MODULE-MANIFEST.json` | 资源归类真源 | 改插件/脚本必须同步，否则 `module-manifest` 门禁判红 |
| `APP-INDEX.json` | App→归属反查 | **由 `tools/app-index.mjs` 从插件本体抽取，勿手改**；`check:index` 判红即漂移 |
| `tools/app-index.mjs` | 索引生成器 + `--check` 门禁 | App 名只认 manifest 声明，不从开关 tag 猜 |
| `provider/empty.js` | Surgio 零节点适配器 | 不读取订阅、不保存凭据 |
| Loon 外部订阅 | 用户在客户端导入，策略组名固定为"东京" | 节点与凭据不进仓库 |
| `Profile/Loon.lcf` | 唯一发布入口（客户端导入的**唯一**文件） | 生成物，不手改。**发布完整性**：旁文件 `Profile/Loon.lcf.sha256`（`sha256sum -c` 兼容）由 `tools/profile-hash.mjs` 生成、`check:all` 与 CI 守同步、`surgio-build` 自动刷新；导入地址与验真步骤见 `APP-ONBOARDING.md`「0. 分发与验真」 |
| `tools/*.mjs` | 已接线门禁 | 每个工具必须被 workflow、npm check 或测试调用 |
| `test/cases/*.test.js` | 行为与静态回归 | 响应脚本必须断言 `$done` |
| `APP-ONBOARDING.md` | **单 App 接入标准** | 逐个 App 接入时照此执行：取证 → 处置分层 → 解密面最小化 → 语法版本 → 参数契约 → 跨层矛盾自查 → 收尾门禁 |
| `test/lib/mitm-hosts.mjs` | MitM 解密面 host 提取 | 非用例文件，勿删 |
| `tools/lib/*.mjs` | 门禁共享原语与台账（`rule-scan.mjs` 规则扫描/域匹配、`ad-exclusions.mjs` 广告平台排除台账、`ad-platform-map.mjs` **端点域→平台归属台账**） | 非独立门禁条目，不按 `tools/*.mjs` 逐个接线；改排除决策须连 `APP-ONBOARDING.md` 附六一起改。归属**不许后缀猜**：`startappservice.com→startapp.com`、`adview.cn→adview.com` 都是后缀回退抓不到的跨域别名，必须显式记账 |
| `test/fixtures/appads/SOURCE.json` | app-ads.txt 基准 = **多份第三方发行商一手声明语料**（`kind=first-party-attestation`、`pinned`、`threshold_files`）+ `provenance_audit`（首版「某份 App 的 app-ads.txt」叙述的**证伪留档**）+ `references.sources` | 语料即基准（回答「是不是 ad system」）；单份清单只能作可选叠加层（`--file`）；未钉死与「无声明的保留项」两种缺口都必须每次运行可见 |
| `test/fixtures/appads/reference/*.json` | 一手声明语料**派生**文件（URL + sha256 + bytes + 域集；原始文件最大 669KB 不入库） | 由 `node tools/appads-check.mjs --fetch` 生成，勿手改；sha256 是漂移检测的锚 |
| `tools/appads-check.mjs` | app-ads.txt 核对：**平台层取证门禁**（被拦平台须有一手声明，或台账记账且每次运行列出）+ 语料 sha256 漂移（`--check`）+ IAB 解析与四桶比对（`--file`）+ 共识/缺域/反向核对（`--refs`）+ **候选流水线**（`--triage [--probe]`：平台声明 × 前缀枚举 × 双解析器实测；**只报告不写规则**） | 平台层 0 声明且台账无归属即判红 —— **端点活着不能代替平台声明**；`gap` 只报告，变规则前须 DoH + HTTPS 取证。范围限广告集合插件 `Plugin/ad-block.plugin`（国内 SDK 与 Google 族按 `OUT_OF_CORPUS_ROOTS` 结构性排除，每次运行打印，死豁免判红） |
| `LOON-FEATURES.md` | **官方文档功能基准**：nsloon.app 现行文档 ↔ 本仓用法 ↔ 版本锚点 ↔ 路线图 ↔ 不采用清单 | 口径冲突时以官方现行文档实测页为准，并同步修订本文件与下方已定论表；不进 doc-claims 扫描面（不承载可反算数字） |
| `tools/secret-scan.mjs` | 密钥/凭据扫描门禁：扫 **已跟踪 ∪ 未跟踪未忽略**文件，匹配已知密钥形状（GitHub/AWS/Slack/Google/OpenAI 前缀、私钥块、JWT、带凭据 URL、Loon 订阅键）；占位符与 `${{ secrets.* }}` 引用不计；只豁免扫描器自身 | 发布面是公开 GitHub + CDN ⇒ **提交即公开、删历史挽不回**；原唯一相关检查只覆盖 `Profile/Loon.lcf` 的 4 个订阅键名 |
| `tools/ad-coverage.mjs` | **L0 覆盖管线**：把"覆盖全面"做成可复跑判据 —— ① 平台在 app-ads.txt 语料有 ≥N 份声明 ② 双解析器 A 存活 ③ HTTPS 非 200+HTML ④ 非多业务大厂/功能即产品 ⑤ 非泛解析根域；五道全过才写规则，逐条证据落 `test/fixtures/ad-coverage/ledger.json`，三个 L0 插件的生成块由 `--check` 守一致 | 手工逐条写域名无法覆盖 500+ 个有声明平台；实测 10,573 候选里 9,490 个无 A、660 个转人工，只有 423 条能自动生成 —— **批量与取证不矛盾, 但批量必须过判据**（首版 21 域的坑） |
| `tools/profile-hash.mjs` | Profile 发布完整性：生成/校验 `Profile/Loon.lcf.sha256`（`sha256sum -c` 兼容） | 用户侧验真入口；`check:sync` 只证 模板↔产物 一致，证不了**分发出去的那份**没被动过。自动生成流程（surgio-build）会同步刷新旁文件 |
| `tools/lib/dns-rule-shapes.mjs` | dns-* 依赖层的**规则形状白名单**(精确 DOMAIN / AND 锚定关键词 / HTTPDNS SDK UA / IP 形态明文 URL-REGEX / AND 门控定向放行) + 明文不变量 | 形状知识原散在三处用例里, 加一种形态就要各改一遍(2026-09-30 吸纳 kelee 三技法时同时弄红两个用例) ⇒ 收敛到一处 |
| `tools/rewrite-script-mutex-check.mjs` | 复写×脚本互斥门禁（官方《Script 新语法》互斥语义的固化） | R1：同侧存在脚本时**无条件** suppressing 复写判红；R2：复写与脚本**共用开关**且 URL 前缀重叠判红；由 `test/cases/rewrite-script-mutex.test.js` 调用，编排范式 = qidian 的 `${CAPTURE_ENABLE}` 逐条条件 |

## 广告面治理纪律

以下纪律的具体资源随插件下线已不存在，但**判据本身仍适用** —— 新增任何广告拦截都按此办理：

- **广告面台账**：逐条登记处置方式（`rejected` 整条拒 / `rewritten` 字段重命名 / `purged` 字段级净化 / `domained` DNS 整域）与状态（`covered`/`inert`/`uncertain`/`rejected`），并断言「已覆盖面全部有规则落地」「**已否决面必须不存在对应规则**（防上游误伤回流）」「台账自洽」——排除台账在 `tools/lib/ad-exclusions.mjs`，判红用例在 `test/cases/ad-exclusions.test.js`（域 + 语义 + 理由 + 取证四要素，含扫描面地板）。**app-ads.txt 平台层取证**（被拦平台 ↔ 一手声明语料）由 `tools/appads-check.mjs` + `test/fixtures/appads/SOURCE.json` 承载：**平台有一手声明 + 端点有 DoH/HTTPS 证据 = 两把钥匙**，缺一即类别误标。`gap` 是发现项，变规则前必须先取证。
- **平台层取证的两条硬结论（2026-09-30，可复跑）**：① **app-ads.txt 声明的是 ad system 根域，不是 SDK 端点主机** —— 首版 21 条全是子域（`d.applovin.com` / `ww251.smartadserver.com` / `init.startappservice.com`），在 44 份真实清单 **200005 行**声明里出现 **0 次**；口述的「基准取自某 App 的 app-ads.txt」因此**不成立**（真相 = 社区清单 + 候选子域枚举 + DoH 探针；本仓 `git show 4d4b8f7:Mirror/rules/goodbyeads-qx.list` 里就有 `d.applovin.com`）。② **平台集合也不唯一**：6 份公开清单各自都声明了同一批 16 个平台 ⇒ 规则不依赖任何单份文件，基准改用多源语料（现 15 份）。**证据类别要分开记**：`supersonicads.com`/`admost.com`/`startappservice.com`/`startappexchange.com` 在语料里 0 声明 —— `supersonicads` 的「未决」由此有了正面证据；后三者是**端点域**（`startapp*` 归 `startapp.com` 15/15），归属由 `tools/lib/ad-platform-map.mjs` 显式记账，其中 `admost.com` 标 `declaration_gap`，每次运行都列出来待裁决。
- **整条 reject 只用于纯广告接口**：京东 `functionId=start` 同时下发启动配置与开屏图，整条 `reject-200` 会致白屏 —— 必须改为响应体改写。**一个接口既下发业务数据又下发广告，就不能整条拒**。
- **字段重命名法**：`response-body-replace-regex` 把广告字段的 key 改名成客户端认不出的名字。响应结构与 code 校验全保留，比 reject 抗异常分支。用例禁止外溢到主 App 通道。
- **域名 REJECT 必须先取证**：京东 `du.jd.com`/`c-nfa.jd.com` 探针实证是**店铺域**（302 → `error2.aspx?from=shopdomain`），误拦直接破店铺页；`jzt.jd.com` 是对外 Jenkins CI。凭域名字义加 REJECT 是本仓已犯过的错 —— 新增前须 DoH + HTTPS 探针。取证之后还有**存活复核**：`test/cases/dns-liveness.test.js` 覆盖主配置 REJECT 后缀 + `Plugin/*.plugin` 的 **139 条人工策展**可探针条目（138 精确 DOMAIN + 1 SUFFIX；生成式覆盖的 443 条不在此重探 —— 它们的存活由覆盖管线在生成时逐条实测并写入台账，另由「台账证据 + ≤45 天新鲜度」用例守），**域名已注销（NS 亦无）判红**；「无 A 但 NS 活跃」只报告 —— 平台子域上下线频繁，删除属不可逆误伤。
  **取证的两条反向教训（2026-09-30 实测买来，都是过度断言）**：① **apex 无 A ≠ 域已死** —— `supersonicads.com` apex 无 A，但 `init.`/`outcome.` 各 4 条 A，排除台账里"已死域(解析 0 条)"的断言因此被推翻；② **A 记录存在 ≠ 端点存在** —— `ironsource.mobi` 是泛解析，其 `init.` 子域的 1A 与 HTTPS 200 是假信号。故存活类断言必须**逐子域 + 泛解析对照**（随机子域探一次）才能下，且排除台账的理由是**闭集**（`merged`/`site`/`infra`），不含任何存活断言。
  **存活判据的解析器必须是「不过滤」的**（2026-09-30 从 SukkaW/Surge 的解析器清单吸纳）：他们逐个标注了解析器的过滤状态（`AdGuard unfiltered`/`Ada 含过滤`/`Quad9 unfiltered`/TWNIC 有污染并因此弃用），因为**过滤型解析器对我们探的广告/追踪域会直接返回 NXDOMAIN 或 0.0.0.0** —— 拿它判死等于把「解析器不想让你访问」当成「域名已注销」，是假红/假绿的来源。现用 1.1.1.1 + 8.8.8.8（均不过滤）+ 国内两路做**分歧视图**，扩解析器时须先确认其过滤策略，不得只因「多一个解析器更稳」就加。
  **缺域发现**走 `tools/appads-check.mjs --refs`：第三方发行商公开 app-ads.txt 的共识（出现在几份、其中多少是 DIRECT）+ **反向核对**（本仓拦的根域有没有外部背书）。它**只产出候选**，且高共识也会被 host 层证伪（实例：7/7 声明的 `unity.com` 下所有广告子域 NXDOMAIN）。
- **策略层 REJECT 变体（已按官方文档定论，非缺口）**：`[Rule]` 全是裸 `REJECT` 是**正确**的。官方《策略》定义 REJECT-IMG=200+1×1 GIF / REJECT-DICT=200+`{}` / REJECT-ARRAY=200+`[]`，三者描述的都是 **HTTP 响应内容**，只有拒绝发生在请求转发阶段、客户端真收到响应时才有意义；而本配置 `domain-reject-mode = DNS`，域名拒绝在 DNS 阶段用 LOOPBACKIP 回环地址完成，请求到不了 HTTP 响应层。叠加官方《HTTP 规则》"HTTP 规则仅匹配 HTTP 和 HTTPS 请求"，而本配置 492 条规则中 `URL-REGEX`/`USER-AGENT` 合计 **0 条** —— 变体唯一的适用场景不存在。策略层 `REJECT-NO-DROP` 不存在，`REJECT-VIDEO` 不在《策略》五变体之列 —— 但《Rewrite 新语法》Action 层另有 `reject_video`（空白视频），两个层面勿混；「REJECT 被自动升级为 REJECT-DROP」亦无出处（现行《策略》：REJECT=404+空响应体，REJECT-DROP 才丢包并警示重试风暴）。重新引入的触发条件：改 `domain-reject-mode = Request`，或引入 HTTP 级规则做路径级拦截。功能 ↔ 官方语法 ↔ 版本锚点的全量对照见 [LOON-FEATURES.md](LOON-FEATURES.md)。
- **App 归属反查**：回答"某 App 的广告归谁管"用 `APP-INDEX.json`。**App 名不得从开关 tag 猜** —— tag 写法不统一（`是否开启X净化`/`X净化`/`开屏广告`/`总开关` 四类），启发式会把同一 App 记成两个名字；可靠的自描述是**开关 KEY**（`LUCKINCOFFEE_ENABLE`→瑞幸咖啡）。只能定位到插件级的归属必须标 `rules_basis=plugin-total`，不许假装精确。
- 清理冗余解密面由两条门禁守住：`mitm-orphan`（每个正包含 MitM 域须有规则消费）+ `mitm-coverage`（每条 Rewrite 规则须有解密面）。通配 host 会被判为 generic 而恒被报孤儿，须显式列举。

## CI 门禁

- `script-tests.yml`：lint、build、Scripts 漂移、227 用例（含复写×脚本互斥、app-ads.txt 平台层取证、插件分层、插件↔插件死规则、密钥扫描、Profile 校验和、候选流水线、L0 覆盖管线与台账新鲜度、社区清单准入、JD 新协议 base64）、构建出处 attestation。
- `config-validate.yml`：MitM、插件结构、参数契约、源码反模式、workflow bash、模板同步、密钥扫描、Profile 校验和、**L0 覆盖管线产物一致性**、Qidian 哈希、规则冗余、模块清单、接线与银行域名断言；独立 job 重生成 Loon 配置验证幂等。
- `surgio-build.yml`：模板/构建配置变化后自动生成 PR；发布前检查无凭据且 `[Proxy]` 无静态节点。
- `upstream-health.yml`：客户端直连的 GeoIP mmdb + 自建 CDN（Plugin/Scripts）可用性。探活目标由 `upstream-coverage` 门禁双向锁死（漏探活与探死资源都判红）。**自建 CDN 不只是探状态码**（2026-09-30 吸纳 SukkaW/Surge 的 post-deploy marker 判据）：`ws.wenn.in/main/<path>` 实测是 `origin/main` 的纯字节镜像 ⇒ 同路径比对 sha256（不一致复取一次再判，避免边缘节点竞态开 issue），补三类静默失效：CDN 缓存滞后（200 但内容是旧版）、200 的 HTML 错误页/截断、产物改了没重新发布；「CDN 有内容但仓库无此文件」= 模板引用与仓库脱节，同样判红。
- `ad-baseline.yml`：每周（周一）跑 app-ads.txt 基准核对（`tools/appads-check.mjs --check`）——**平台层判红**（被拦平台 0 声明且台账无归属）与**语料 sha256 漂移**（上游清单变了 ⇒ 证据基础变了）都判红；基准未钉死时打 `::warning` 注解而不是静默通过。零依赖，不需要 `npm ci`。缺域发现（`--refs`）只报告不判红，由用例覆盖；**候选流水线**（`--triage --top 10 --probe`）每周把"有声明但未拦"的平台连端点实测一起写进 job summary（`continue-on-error`，永不判红、永不改文件）——把 800+ 缺口变成可跟踪队列，第三问（是否广告专有）仍交回人判断。
- `dependency-audit.yml` / `release.yml`：构建期依赖风险 / tag 版本快照。
- `codeql.yml`：advanced setup，扫描面由 `.github/codeql/codeql-config.yml` 的 `paths` 白名单限定为 `src/`/`tools/`/`.github/workflows/`。workflow 自身的 `on.push.paths` 只是**触发器**、不限定分析范围。advanced 与 default setup 互斥。

## 约束与已知边界

- 不提交 secret。机场订阅由用户在 Loon 外部导入，仓库不保存 provider、节点或订阅 URL。
- 发布面是公开 GitHub 与 `ws.wenn.in` CDN；GitHub Pages 已退役。
- **单插件基线（2026-09-29 起为「双插件」，京东由 M2 接入）的已知代价**（均为用户决策，非缺陷；详见 git 历史）：
  - **App 内部结构化广告位仅覆盖 5 个 App**：去广告 = 主配置 129 条 REJECT（全部已取证）+ `[Plugin]` 段 4 个纯 L2 插件（1 广告平台拦截器 + 2 DNS 收编 + 1 上报拦截）的 **1112 条**域级 REJECT + bank-ad-reject snippet + 起点(15 条新语法 [Rewrite] 字段级)/京东(**整个 client.action** 字段级, 含 15.9.50+ base64 新协议)/汽水音乐(16 条新语法 [Rewrite]: 8 条纯广告端点整条转空 + 7 条业务接口字段级 + 1 组 L2 域名)/智慧房东(1 条 [Rewrite] 整条转空)/微信(3 条 [Rewrite]: 1 条纯推广端点整条转空 + 2 条广告字段级; 朋友圈/视频号走 MMTLS 结构性不可达) 五处净化。其余 App 仍只剩 L2 硬拦截。46 个 CDN 插件下线前实测全 200 存活（2130 条规则 / 994 个解密 host）。
  - **钉钉 DingTalk 接入（2026-09-30）是第一个「去广告只有 L2」的 App，且规则落主配置而非插件**（取证与已否决清单见 [APP-ONBOARDING.md](APP-ONBOARDING.md) 附十，门禁 `test/cases/dingtalk.test.js`）：官方《钉钉第三方SDK收集使用信息说明》自列 26 个 SDK，**唯一广告 SDK 是 BeiZi 倍孜（开屏）**、其域早已被 `beizi.biz` 覆盖 ⇒ 抄 SDK 清单拿不到新东西；真实缺口是 `adashx.ut.dingtalk.com` + `adash-emas.cn-hangzhou.aliyuncs.com` 两条**跨 App 阿里广告平台**域（同族 `adashx.ut.{alibaba,cainiao,taobao,amap,1688}` 实测全存活，**拦它对淘宝/高德等同样生效**）。**落主配置的理由**：两域 A 记录实测**全部境内**，而插件 `[Rule]` 优先级低于本地 `[Rule]`，会被 `GEOIP,CN,DIRECT` 截胡成死规则（跨层纪律 ①）—— 与「广告域单一真源在 ad-block.plugin」的集合化决策存在张力，**已登记待裁决，不静默**。**无 L4 是取证结论而非省事**：开放平台 `oapi/topapi/v2` 是可枚举 oracle（未知 ApiName=errcode 22、存在但缺 token=errcode 88），13 个广告命名空间全部 errcode 22 ⇒ 无广告 API；客户端主链路是 **DTIM 私有二进制协议 + 加密长连接**（同微信 MMTLS 一类）⇒ `[Rewrite]` 结构上不可达。业务前提：官方关闭广告已改为**付费钉钉365会员**，无 App 内开关可抄。
  - **长尾广告域不再被 REJECT，一律走 `Final`**：原 12 万条通用广告域名表 + 7 个镜像规则列表已移除。
  - 失去镜像供应链门禁（sha256 + 投毒/体积 + 漂移/孤儿）。
  - 失去 `check:shadow`（远程列表顺序遮蔽检测）—— 无远程列表后该失效面本身已不存在。
- [Rule] 492 行（其中 129 条 REJECT：126 条域名 REJECT + `DEST-PORT` 3 条 + `PROTOCOL` 1 条端口/协议级；行数与 REJECT 计数由 tools/doc-claims-check.mjs 实测）；**9 个插件 = 分两层**（2026-09-30 架构分层，顺序由 `test/cases/plugin-layering.test.js` 钉死）：
  - **L0 依赖层（必须排在 `[Plugin]` 段最前三条，`enabled=true`）**：`ad-block.plugin` **广告平台拦截器**（**968 条** = 60 人工策展〔2026-09-30 由 7 个 `ad-*.plugin` 零重叠并集 + 智慧房东接入补 1 域 `api.qttunion.com`〕+ 418 生成式覆盖 + **490 条社区清单复核收录**：449 精确 + 41 整域 `DOMAIN-SUFFIX`，整域拦只对「apex 是端点型(非 200/非 HTML)」的根域开放；中文平台结构性不在 app-ads.txt 语料里，故这是第二准入路径，红线过滤见 `tools/ad-coverage.mjs`）/ `dns-httpdns.plugin` **HTTPDNS 拦截器**（**72 域** = 11 人工 + 4 生成 + **57 条 2026-09-30 从 kelee `Block_HTTPDNS.lpx` 复核收录**，另 2 条 `AND` 锚定兜底 + 4 条 SDK UA + 2 条 IP 形态明文 `URL-REGEX` + 2 条定向放行）/ `dns-leak.plugin` **DNS 防泄漏**（35 域 = 19 人工 + 16 生成）。**生成式覆盖**由 `tools/ad-coverage.mjs` 按五道判据产出，逐条证据在 `test/fixtures/ad-coverage/ledger.json`，产物漂移判红、台账超 45 天判红、`coverage-refresh.yml` 每月重跑并开 PR（死域自动移除/新域自动加入）。三者共同构成"广告域 REJECT 真正生效"的前置条件：域名 REJECT 在 DNS 阶段完成，而自带解析的 SDK/浏览器会绕过系统 DNS 拿到真实 IP。
  - **L1 消费层**：`qidian.plugin` 起点 M7（全部 `[Script]` 能力寄生于此，停用即全灭）/ `jd.plugin` 京东 M2（唯一带 `[Script]`+`[MitM]`，解密面 +1）/ `soda.plugin` 汽水音乐 M2（L2+L4：3 域 + 2 条 AND 锚定的字节广告素材/自带 HTTPDNS 收编 + 16 条 luna 接口 [Rewrite]，解密面 5 个具体 host、无通配 —— 取证与不落地台账见 `APP-ONBOARDING.md` 附七）/ `zhifu-fangdong.plugin` 智慧房东 M2（L4：1 条自营活动位 [Rewrite]，解密面 1 个 host —— 台账见附八）/ `wechat.plugin` 微信 M2（L4：3 条 [Rewrite] 全在 `mp.weixin.qq.com`，解密面 1 个 host、**零 L2 域名** —— 覆盖天花板与已否决面台账见附九）/ `probe-block.plugin` 上报/埋点拦截（M3·6 通道零重叠并集 —— 2026-09-30 由 6 个 `probe-*.plugin` 按 `ad-block` 同形合并，通道分类保留为 ①–⑥ 小节注释）。
  - L0 三项 + `probe-block` 共 4 个**纯 L2** 插件（无 `[MitM]`/`[Script]`，零证书成本）合计 **1112 条域级 REJECT**（968+72+35+37，其中 418 条生成式覆盖、490+57 条社区复核收录）；**9 条全部已登记进 `template/loon.tpl` 的 `[Plugin]` 段**，启停插件即开关。**关掉 L0 任一项 = 加密 DNS/HTTPDNS 绕过面回归**，不只是"少拦几条广告"。

- 依赖仅 3 个 devDependencies（esbuild、eslint、surgio）；`engines.node >= 22`。
- 仓库不引入 `tsc`：esbuild 只转译，不检查类型。修改 `src/` 必须用行为测试兜底。
- `Scripts/Qidian.js` 的内嵌加密引擎无法静态审计，只能做来源、marker 与哈希治理。
- `npm audit` 告警属于构建期工具链；禁止 `audit fix --force`。
- GeoIP mmdb 不入库，保持客户端直连 raw（实测 7.7MB 且每日变化，入 git 会月增约 600MB）。ASN mmdb 已随 `ipasn-url` 一并停用（无活跃消费者）。完整性由 `upstream-health.yml` 校验（体积 ≥5MB + 尾部含 `ab cd ef MaxMind.com` marker）。
- `interface-mode = Performace` 是 Loon 模板中的官方原样拼写，勿自行纠正。
- push 前必须确保 `npm test`、lint 与相关门禁全绿。

## 已定论（不必再当待验证项）

| 问题 | 结论 | 依据 |
|---|---|---|
| 本地 `[Rule]` vs 插件 `[Rule]` 优先级 | **本地 > 插件 > 订阅** | 官方《规则系统 3.1 规则优先级》 |
| 域名类 vs IP 类规则先后 | 域名类优先；域名命中后不再走 IP 匹配；其余按配置顺序 | 同上 |
| 插件里的 `DIRECT` 会不会遮蔽主配置 `REJECT` | **不会** | 同上 |
| REJECT 响应口径 | **REJECT = 404 + 空响应体**（2026 现行《策略》；旧手册为 200+空体）—— 本仓拒绝在 DNS 阶段完成，行为不受影响 | 官方《策略》（nsloon.app） |
| reject_video 的层面归属 | 策略层无 `REJECT-VIDEO`；《Rewrite 新语法》Action 层有 `reject_video`（空白视频）—— 复写响应面，与策略五变体是两回事 | 官方《Rewrite 新语法》Action 速查表 |
| 复写 × 脚本互斥 | 同文件同侧 body 类/终止性复写命中时**脚本不执行** —— 本仓 suppressing 复写必须带开关编排（qidian 范式），R1/R2 门禁固化 | 官方《Script 新语法》"Rewrite 与 Script" |
| Profile 客户端下限 | **≥3.2.5 (789)**，由 `[General] hijack-dns` 决定；主配置无版本闸，仅插件有 `#!loon_version` | 官方《通用配置》 |
| 文档基准 | **nsloon.app** 为唯一现行基准（覆盖 3.5.2 (996)）；GitHub LoonManual 已冻结（2024-03 起无推送） | 官网页脚 / 仓库提交史 |
| DNS 收编分层（2026-09-30） | **域名级在 `dns-leak.plugin`（19 端点，可按需启停/经 CDN 独立更新）+ 框架级在本地 `DEST-PORT, 853, REJECT`（DoT/DoQ 端口兜底，插件关掉也在）**；扩列判据 = 纯解析器端点 + 双解析器 A + `/dns-query` 探针 + 不在本仓解析链内。残留面 = IP 直连型 DoH（`https://8.8.8.8/dns-query`）需 IP-CIDR 级封堵，未落地 | 官方《通用配置》/《DNS》页 + 2026-09-30 双解析器探针 |
| sni-sniffing / ipv6-vif | **未收录于现行《通用配置》参数表**（2026-09-30 全参数核对）—— 保留现值但生效性待实测，任何论证不得以官方文档为其背书 | 官方《通用配置》逐参数核对 |
