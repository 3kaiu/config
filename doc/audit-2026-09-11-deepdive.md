# 全方位深度审计（第二轮·独立复核）— 3kaiu/config

> 审计日期：2026-09-11（GMT+8 下午）
> 基线：`main` @ `2423943`
> 与既有审计的关系：本仓库当天已有 `doc/audit-2026-09-11.md`（横切六维）与
> `doc/module-audit-2026-09-11.md`（分模块 MOD-01~13）。本报告**不重复**其结论，
> 以「实测复现 + 新发现」为唯一增量标准。凡是既有报告已记录且未变化的条目，
> 只在第 5 节列为「已核实为良好」，不占篇幅。

---

## 0. 审计基线（全部实测，非引用）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 构建 + 产物漂移 | `npm run build` + `git diff --stat Scripts/` | 16 ms，**0 漂移** |
| 行为测试 | `npm test` | **156 / 156 通过** |
| 静态检查 | `npm run lint` | 0 error（15.3 s 墙钟） |
| 模板↔产物 | `npm run check:sync` | 641 条静态行全在 |
| MitM 孤儿域 | `npm run check:orphan` | 973 个正包含全部有消费 |
| 插件语法 | `npm run check:plugin` | 60 个插件通过 |
| 参数契约 | `npm run check:contract` | 60 个插件配对 |
| workflow bash | `npm run check:workflows` | 41 个 run 块，0 语法错 |
| 依赖漏洞 | `npm run audit:ci -- --json` | **42**（2 low / 7 mod / 32 high / 1 crit） |
| 线上告警 | `gh api …/dependabot/alerts?state=open` | **0** |
| 镜像清单↔磁盘 | 自建比对 | 40 条，0 缺失 / 0 多余 |
| PR #39 清单自洽 | 对 head 重算 sha256 | 53 条，**0 异常**（blob == manifest） |

结论：**工程化水平确实高于同类仓库**。本轮没有发现 P0 级的功能性缺陷；
发现的是**门禁本身的失效面**与**未被前一轮覆盖的同类残留**。

---

## 1. 严重度定义

| 等级 | 含义 | 处置窗口 |
|---|---|---|
| **P0** | 分发产物错误 / 凭据外泄 / 安全边界失效 | 立即 |
| **P1** | 门禁名存实亡、会重复产生红 run 或掩盖真实失败 | 本迭代 |
| **P2** | 局部正确性缺陷、文档与事实不符、同类问题残留 | 排期 |
| **P3** | 卫生问题、可维护性、观察项 | 观察 |

---

## 2. 优先级整改路线图

> **整改状态**：本节的 13 项（NEW-01 … NEW-13，含修复过程中连带发现的 NEW-09b / NEW-11b）
> 已于 2026-09-11 全部整改完毕。本报告保留为**整改前的快照**，逐项修法与 fail-before 证据见
> `CHANGELOG.md` 的 `### Fixed (2026-09-11 深度审计修复 — 逐项整改)`。
> **两处对本报告建议的更正**（均已写入 CHANGELOG）：①NEW-12 未引入
> `@typescript-eslint/parser`（与"仅 3 个 devDependencies"的既有取舍冲突，该决策留给仓库所有者）；
> ②**NEW-13 的"死目录"一半系本报告误报** —— 实测 `npm run generate`（surgio 自身，非 npm）
> 每次都会创建一个空 `dist/`，故 `.gitignore` 的 `dist/` 条目是承重的、删目录亦徒劳（下次 generate
> 即复现）。NEW-13 的真实内容只有死参数一半。

### P1 — 本迭代（3 项，全部有可复现证据）

| # | 问题 | 位置 | 证据 |
|---|---|---|---|
| **NEW-01** | **镜像 PR 的 CI 从未执行** — `pull_request` run 恒停在 `action_required`，审核清单的「CI 全绿」**永远无法满足** | `.github/workflows/mirror-scripts.yml:692`（`GH_TOKEN: ${{ github.token }}`）→ PR 由 `github-actions[bot]` 创建 | `gh pr checks 39` → *no checks reported*；`gh run list` 显示 `mirror/sync` 在 `2026-09-11T07:56` 的 Config Validation / Script Tests 均为 `action_required`。**每日镜像 run 都会把状态重置回 `action_required`**（09-10 22:55 曾因人工批准而 success，09-11 07:55 又跑一次即复位） |
| **NEW-02** | `dependabot.yml` 的 `ignore:` 仍有 **11 条裸 `dependency-name`（无 `versions`）**，**违反其上方 6 行自己写下的规则** | `.github/dependabot.yml:30-44`（规则文字在 `:25-29`） | 同一失败模式在最近 60 个 run 中占 **2 条**（`npm_and_yarn in /. for js-yaml - Update #…`）。当前未爆红是因为这 11 个包的易感副本都在 `node_modules/npm/node_modules/**`（bundled，Dependabot 无法操作）或 `fixAvailable=false`；但 `brace-expansion` / `ip` / `@tootallnate/once` / `cross-spawn` / `diff` 在 `npm audit` 中为 **`fixAvailable: true`**，且其中 3 个在 lockfile 里**同时存在于 npm bundle 之外** |
| **NEW-03** | **Qidian 引擎把完整 `cmfuToken` 写进锁屏通知** — 已记录但**未缓解**（仅"文档化"） | `Scripts/ENGINE-MANIFEST.json:19-23` `known_risks` | 清单自述：引擎为加密+双层混淆、静态不可审计、持有 `$httpClient` 与全部持久化读写；Cookie 更新时 `notify` 正文含完整 cmfuToken，且**不受 `QDREADER_DEBUG` 开关控制**。CI 只做 blob 哈希一致性（`config-validate.yml` step 8），无法约束行为 |

**建议动作**
- NEW-01：合并 PR #41，并按 PR 描述配置 fine-grained PAT `MIRROR_TOKEN`（Contents R/W + PR R/W，仅本仓库）。**在此之前任何镜像 PR 都应在描述里显式写明「CI 未运行」**，否则审核者会把 `UNSTABLE` 误读为"测试挂了"。
- NEW-02：给 11 条补 `versions`，取值用 `npm audit` 的 `via.range`（例：`got: "< 11.8.5"`、`decode-uri-component: "<= 0.4.2"`、`tar: "< 7.5.21"`）。这把"无界压制"变成"有界压制"，上游一旦出补丁即可被 Dependabot 捕获。**或**整体删除该块——若这 11 个包确实都 bundled，Dependabot 本就动不了它们，`ignore` 是纯冗余。
- NEW-03：把通知正文里的 token 做掩码（前 4 + 后 4），或关闭该 notify 分支。若无法改（混淆代码），至少在 `Plugin/qidian.plugin` 的 tag/描述里加"勿在锁屏通知中查看"警示，并把该风险从 `known_risks` 提升为 CHANGELOG 的显式条目。

### P2 — 排期（5 项）

| # | 问题 | 位置 |
|---|---|---|
| **NEW-04** | **文档与事实不符**：称 Global 列表有 34,579 条 SUFFIX，实测 **0 条** | `template/loon.tpl:400`、`CHANGELOG.md:284` |
| **NEW-05** | **规则遮蔽（1 处，实测）**：`Global DOMAIN-KEYWORD,google`(Proxy) 先于 `Advertising DOMAIN-KEYWORD,googleads`(REJECT) | `template/loon.tpl:403`（顺序） |
| **NEW-06** | **已修过的反模式残留**：`/^(?:ad\|sponsor\|promot\|recommend)/i` 前缀匹配会删掉 `address` / `adaptive` / `admin` | `src/LinkedIn.ts:11`、`src/Twitter.ts:13` |
| **NEW-07** | **`$done` 兜底缺口**（ROB-02 同型，未覆盖到这两个脚本） | `src/health-notify.ts:20`、`src/traffic-notify.ts:4-18` |
| **NEW-08** | **静默全量降级**：`e.realLink` 无守卫，任一元素缺字段 → 整个响应不净化 | `src/Ximalaya.ts:29`、`src/Ximalaya.ts:37` |

**建议动作**
- NEW-04：把注释改为实测数字（209 行 / 198 条规则 / 0 SUFFIX），并**重新论证**排序收益。真实的 Global 是 `DOMAIN-KEYWORD`+`IP-CIDR`+`USER-AGENT` 的**小**列表，把它放在 Advertising 之前**没有**"提前终止 3.5 万条扫描"的效果。若排序收益不成立，应把 Global 移到 REJECT 三列表之后（消除遮蔽面），或至少补一条 CI 断言：`Global.list` 的 `# DOMAIN-SUFFIX:` 头声明与正文条数一致。
- NEW-05：把 `Global` 的 `DOMAIN-KEYWORD,google` 改为更精确的 `DOMAIN-SUFFIX`，或把 Advertising 提到 Global 之前。同时把 CI 的「Global 纯净度检查」（`mirror-scripts.yml:239`）从**硬编码 20 个关键词 grep** 升级为**与 Advertising/Privacy/Hijacking 的实际集合交集断言**（含 KEYWORD 子串级）。
- NEW-06：套用 `src/lib/ad.ts` 的分词匹配（`isAdKey`）或 Feishu 的首尾锚定正则；补两条回归用例（键 `address` / `adaptive` 不得被删）。
- NEW-07：把 `finish()` 模式（`src/Bilibili.ts:57-62` 的 `finished` 幂等标志）推广到这两个脚本，并补 `doneCalled` 断言 + `$notification.post` 抛错的沙箱用例。
- NEW-08：`const rl = typeof e?.realLink === "string" ? e.realLink : ""`；并把 `header.length <= 1` 改成 `header.length === 1`（当前 `0` 会索引 `header[0]` 得 undefined）。

### P3 — 观察 / 卫生（5 项）

| # | 问题 | 位置 |
|---|---|---|
| **NEW-09** | **有效 MitM 解密面 1343 个正包含 / 120 个通配**；其中边界不安全通配由上游原样透传 | `Plugin/startup-adblock-pro.plugin:572`、`tools/build-startup-plugin.mjs:100`、`Plugin/ximalaya-pro.plugin:36` |
| **NEW-10** | **3 个已维护工具零接线**（无 CI / 无 npm script / 无测试） | `tools/aggregate-purify.mjs`、`tools/kelee-import.mjs`、`tools/mirror-drift-check.mjs` |
| **NEW-11** | 门禁失败**不使 workflow 变红**：镜像被拦截只写 step summary，job 仍绿 | `.github/workflows/mirror-scripts.yml:683-687`、`:735-745` |
| **NEW-12** | `src/*.ts`（3318 行，唯一编辑面）**不受任何静态检查**；lint 只覆盖压缩后的 `Scripts/**` | `package.json:11`、`eslint.config.mjs:84-97` |
| **NEW-13** | 死参数 / 死目录：`dns_primary` `dns_fallback` 无人引用；`dist/` 空且被 ignore | `surgio.conf.js:32-33`（模板硬编码于 `template/loon.tpl:11`）、`dist/` |

**建议动作**
- NEW-09：在 `build-startup-plugin.mjs` 的 hostname 最小化环节加一条规范化：`*` 前若无 `.` 则补成 `*.`（`*ziben.com` → `*.ziben.com`），并把 `*.flyert.*` / `*mangaapi.manhuaren.*` 这类"内部标签通配"列入生成器的拒绝模式（或降级为精确域）。同时把 `Plugin/ximalaya-pro.plugin` 的 `*.xima*.com` 收敛为 `*.ximalaya.com`。
- NEW-10：`mirror-drift-check.mjs` **今天就能报出价值**（7 条 URL 漂移 + 6 条孤儿保留），但它有两个缺陷必须先修：① 无法解析 `for n in …; do mirror …` 循环，把 `rules/loon-$n.list` 当成"从未抓到"的幻影条目；② 退出码语义（`drift` 只警告不失败）需与"是否要设门禁"一起决策。**要么接线并修 ①，要么删除**——不接线的门禁正是本仓库反复发现的"看起来有门禁其实没有"。
- NEW-11：把 `FAIL>0` 提升为 workflow 的 `::warning::` 注解（而非仅 step summary），让门禁触发在 PR 页面可见。注意 **不要**改成 `exit 1`——保留旧版是设计意图，只是"沉默"应当去掉。
- NEW-12：若要覆盖 `src/`，需引入 `@typescript-eslint/parser`（+1 devDependency，与"仅 3 个 devDependencies"的取舍冲突）。**低成本替代**：把 `eslint.config.mjs` 里对 `Scripts/**` 关闭的 7 条规则中的 `no-fallthrough` / `no-cond-assign` 打开（这两条在压缩产物上依然有效），或在 CI 加一条 `tsc --noEmit` 的**可选** job。
- NEW-13：删除两个死参数（与 2026-09-11 删除 `surge_node_policy_path` 同一理由）；`dist/` 从 `.gitignore` 与工作区一并清掉。

---

## 3. 分维度评估

### 3.1 代码质量与规范性 —— B+

**优点**：`src/` 3318 行里，注释密度与"为什么这么改"的留痕质量罕见（`src/lib/ad.ts:13-26`、`src/lib/argument.ts:4-20`、`src/Umetrip.ts:24-98` 的 protobuf wire 级实现尤其扎实）。重复代码已系统性收敛到 `src/lib/{net,ad,notify,argument}.ts` 并经 esbuild `--inject` 注入。

**问题**
1. **NEW-06（P2）**：前缀正则反模式残留 2 处 —— `src/LinkedIn.ts:11`、`src/Twitter.ts:13`。仓库已在 `src/lib/ad.ts`（子串→分词）、`src/Feishu.ts:39`（`\b`→首尾锚定）、`src/AlipayMini.ts:56`（`includes`→分词）修过同一类缺陷 **三次**，这两处是漏网。**同一根因的第四次出现，说明缺少"反向扫描"门禁**。
2. **NEW-12（P3）**：`src/*.ts` 无 lint / 无类型检查（无 `typescript` 依赖）。`esbuild` 只转译不校验，字段名拼错、接口不符都不会在 build 期报错——这条 AGENTS.md 已自认（DEP-03），但**代价被低估**：`Scripts/**` 上的 lint 是对压缩产物的二次检查，抓不到"源码里写了但被 minify 抹掉"的语义问题。
3. **`any` 使用密度**：`src/Weibo.ts` 819 行几乎全 `any`（`isAd(obj: any)`、`data: any`）。对忠实移植上游的脚本可以接受，但 `src/Weibo.ts:45-80` 已经为 `mainConfig` 建了显式 `interface`——同样的处理没有推广到 handler 层。
4. **新增门禁建议（针对 1）**：`tools/` 下加一条 30 行的正则扫描：禁止 `src/**` 出现 `/\^(?:[a-z]+)\|/` 形态的裸前缀 alternation（除非带 `$` 或 `\w*` 后缀），并在 `npm test` 里跑。成本极低，能永久封堵该类回归。

### 3.2 架构设计合理性 —— A-

**优点**：单一入口 `Profile/Loon.lcf` 由 `template/loon.tpl` + `snippet/` 经 surgio 生成；`artifact-idempotency` job 用「重新生成 + 断言零漂移」证明**产物 = f(模板)**，这比集合比对强得多（`config-validate.yml:383-429`）。构建 16 ms、无运行时依赖、`--inject` 共享模块的机制干净。

**问题**
1. **NEW-09（P3）**：MitM 面 1343 域 / 120 通配。`mitm-orphan-check` 的判定过宽——方法 B 是"注册根域对齐"、方法 C 是"主标签（≥4）出现在来源插件 Rewrite 文本中"（`tools/mitm-orphan-check.mjs:189-207`）。后者只要插件文本里出现 `ziben` 四个字母即算"被消费"，因此**任何** hostname 都极易通过。该门禁的实际约束力远低于其名字暗示的"最小范围原则"。
2. **NEW-13（P3）**：`surgio.conf.js` 的 `customParams` 已有 2 个死参数（`dns_primary`/`dns_fallback`）。模板第 11 行硬编码 DNS 列表，与 `customParams` 形成**双源**——改一处不生效。
3. **`[Proxy]` 段在发布产物中为空**（`Profile/Loon.lcf:66-72` 仅注释）。这是"凭据永不进仓"的有意设计，但后果是：`MainNodes`（`NameRegex ^(?!.*geonode).*$`，对**全部**节点取反 geonode）在全新使用者那里匹配 **0 个节点**，于是 `Proxy`/`Fallback`/`Apple`/`Streaming`/`AI`/`Developer`/`Gaming`/`Social`/`Final` 九个组全部空成员。**开箱唯一可用节点是约 60 个 `geonode-*` 免费代理，而它们恰恰被 `MainNodes` 排除、只被 `OpenCode` 组引用。** 建议在 `[General]` 之前加 3 行显式说明「首次使用必须自带订阅，否则仅 OpenCode 组可用」——这是可用性缺陷，不是安全缺陷，但会直接决定新用户的第一次体验。
4. **文档层单点**：`AGENTS.md` 12 444 字节承载了全部门禁语义、已知问题与"勿重试清单"。它是这个仓库最有价值的资产，也是最大的单点——`template/loon.tpl:400` 那类漂移（NEW-04）说明**文档与实测之间没有自动校验**。建议给关键数字（Global 条目数、[Rule] 483 行、MitM 银行数、audit 计数）加一个 `tools/doc-claims-check.mjs`，从产物反算并断言文档里的数字。

### 3.3 潜在安全漏洞 —— B（无 P0，1 项 P1）

**优点（本轮实测确认）**
- **script-path 溯源 100% 收敛**：`Plugin/` + `Kelee/` 共 **157 条** `script-path`，**全部**指向 `https://ws.wenn.in`，**零**第三方直连。这是供应链上最难做到的一步，已做到。
- `cdn-verify.yml` 每日对 CDN 内容做 sha256 比对（含 Pages 兜底 parity），`mirror-scripts.yml` 门禁 4 对 `.plugin` 内 script-path 做域白名单。
- 银行 MitM 排除清单有三重断言（规模下限 40 / 20 家点名 / 正负无重叠），且实测 **47 条**、`skip-server-cert-verify = false`。
- `surgio-build.yml:40-48` 有 `password|uuid|bob|encryption` 的凭据断言（`-i` + 允许等号旁空格），阻断订阅凭据进公开产物。
- `Mirror/MANIFEST.json` ↔ 磁盘 40 条完全一致；`.workbuddy-ai/` 已被 `.gitignore:163` 排除，未泄漏。

**问题**
1. **NEW-03（P1）**：Qidian 引擎把完整 `cmfuToken` 送进锁屏通知。这是本仓库**唯一的凭据暴露路径**，且是"记录而不修"。601 793 字节的加密+混淆 blob 持有全部 `$httpClient` 与 `$persistentStore` 权限——等价于信任一个不公开源码的第三方。哈希门禁只能证明"与上游发布一致"，不能证明上游可信（AGENTS.md 自己也这么说，并据此移除了 Sub-Store 解析器——**同一论证适用于 Qidian，但目前只对 Sub-Store 执行了**）。
2. **NEW-09（P3）**：`*ziben.com`、`*gaoqingdianshi.com`（`Plugin/startup-adblock-pro.plugin:572`）—— 前导 `*` **无点号**，会匹配 `evilziben.com`、`maliciousziben.com`；配套规则同样宽松（`Plugin/startup-adblock-pro.plugin:351` 的 `^https?:\/\/.*ziben\.com\/api\/.*\/adverts`）。`*.flyert.*` / `*mangaapi.manhuaren.*` 是"内部标签通配"，可匹配 `a.flyert.任意域`。影响有限（仅 reject-200，且攻击者无法从"被 MitM 的自己的域"获利），但这是**上游不可信输入未经规范化直接进入解密面**，且生成器 `tools/build-startup-plugin.mjs:100` 原样透传（`validHost()` 对含 `*` 的输入一律放行）。
3. **免费代理直推 main**：`proxy-sync.yml` 无 PR 审核，每日把免费代理写入 `Profile/geonode.loon.txt` 并直推。AGENTS.md 的理由是"免费代理无投毒面"。**这个判断需要限定**：`OpenCode` 组走这些节点时，节点运营者可观察目标域与流量模式（TLS 端到端加密保护内容，但 SNI/时序暴露）。设计上可接受，但"无投毒面"的措辞过强，建议改为"内容面不可投毒（HTTPS），元数据面暴露"。
4. **`cdn-verify` 是事后检测**：CDN 是全部可执行代码（157 条 script-path + 全部 `.plugin`）的唯一来源。若 CDN 被篡改，检测窗口最长 24 小时，且 Loon 不支持 SRI。这是结构性风险，缓解手段已用尽（每日哈希 + 双通道 parity），建议在 `doc/infrastructure.md` 里把它明确写成"接受的风险 + 最坏影响面"。

### 3.4 性能瓶颈与优化空间 —— B+

**实测数据**
- 构建 16 ms；`Scripts/` 合计 728 K（其中 `Qidian.js` 601 K）；`Mirror/` 4.6 M（`goodbyeads-qx.list` 3.9 M）。
- 配置产物 `Profile/Loon.lcf` 43 K；`[Rule]` 483 行（与 AGENTS.md 声明一致）。
- lint 15.3 s 墙钟 / 1.42 s user —— 瓶颈是 Node 启动与 IO，非 CPU。

**问题**
1. **NEW-04 的性能含义（P2）**：模板与 CHANGELOG 声称 `China → Global` 排序能让"34,579 条 SUFFIX 提前终止、免于扫描广告/隐私/反劫持约 4.2 万条"。实测 `loon-Global.list` 是 6 115 字节 / 209 行 / **0 条 DOMAIN-SUFFIX**（36 KEYWORD + 46 USER-AGENT + 112 IP-CIDR + 4 IP-CIDR6）。**排序的性能理由不成立**。客户端每次请求仍要线性扫描 Advertising(967) + Privacy + Hijacking 列表。
2. **规则规模实测**：Advertising 967 条（488 IP-CIDR + 278 DOMAIN-KEYWORD + 188 SUFFIX + 14 URL-REGEX + 10 DOMAIN）、China 74、Privacy 20、Hijacking 6 734 B。**`DOMAIN-KEYWORD` 占 Advertising 的 29%**——KEYWORD 规则必须逐请求做子串匹配，是规则求值中最贵的一类。若真要优化，应优先把高频 KEYWORD 收敛为 SUFFIX。
3. **Qidian.js 601 K 每次 cron 与 getlogininfo 抓包都 eval**（`ENGINE-MANIFEST.json:22`）。这是设备侧最重的单点开销，且混淆层（base64→RC4→utf8→字符串表）在每次执行时都要解一遍。若该脚本非必需，卸载它同时消除性能与安全两项成本——**这是本报告里性价比最高的一条建议**。
4. **`npm run lint` 的边际价值低**（NEW-12）：15 s 墙钟换来的是对压缩产物的检查，且 7 条规则被全局关闭（`eslint.config.mjs:84-97`）。

### 3.5 依赖项版本与兼容性风险 —— B

**实测**
- `npm audit`：**42**（2 low / 7 moderate / 32 high / 1 critical）。按路径分组：`node_modules/npm/node_modules/**` **32** 项；`@oclif/plugin-plugins` 1 项；surgio 自身依赖树 9 项（`decode-uri-component` / `got` / `latest-version` / `npm` / `package-json` / `qs` / `query-string` / `surgio` / `update-notifier`）。
- **AGENTS.md 的分组描述准确**：`js-yaml` 确已不在清单内（已修复），"全部属构建期工具链、不进分发产物"的判断成立（3 个 devDependencies、无运行时依赖）。
- **线上 Dependabot 告警：0**。`js-yaml` 两条 high 已关闭。

**问题**
1. **NEW-02（P1）**：见第 2 节。`ignore` 块自相矛盾且是红 run 的来源（最近 60 个 run 中 2 条）。
2. **`1 critical`（tar）无补丁可用**：`fixAvailable=false`，且全部易感副本 bundled 在 `node_modules/npm/node_modules/**`。属构建期已知风险，判断正确。
3. **AGENTS.md 的一处计数偏差（P4）**：文中称"11 个包不在 `node_modules/npm/` 路径下"，实测为 **10** 项（`@oclif/plugin-plugins` + 9 项 surgio 树，其中 `npm`/`surgio` 是聚合节点）。数字本身不影响结论，但既然该段落的教训是"复核方法勿凭记忆"，建议顺手对齐。
4. **本地 `node_modules` 与 lock 可能漂移**（AGENTS.md 已记录：eslint 10.9.0 vs lock 10.9.1）。本轮实测本地 `eslint` 为 **10.10.0**，`package.json` 亦为 `10.10.0`，与 PR #40 合并后的状态一致——**当前无漂移**，但该风险点是结构性的（`npm run lint` 可能跑在非 CI 版本上），建议在 `lint` 脚本里加 `npm ci` 提示或直接让 CI 成为唯一权威。

### 3.6 错误处理与边界条件健壮性 —— C+（本仓库最短板，与上一轮结论一致）

**优点**：上一轮已系统性修复了最严重的一类——`src/Zhihu.ts` 的 4 条挂死路径（`dispatch()` + 顶层 `try/catch` + `isObj` 收敛标量）、`src/Bilibili.ts:57-86` 的 `finished` 幂等收尾、`test/harness.js` 的 `scriptError` 记录 + `assert.doneCalled()`。这套基建是对的。

**问题**
1. **NEW-07（P2）**：`src/health-notify.ts:20` —— `req.then(...).catch(() => doNotify(...)).then(() => $done())`，**没有终结 `.catch`**。`doNotify`（`src/lib/notify.ts:58-61`）第一行就是同步的 `$notification.post(...)`；该调用抛错 → 返回的 Promise 直接 rejected → `.then($done)` 跳过 → **`$done` 永不执行，请求挂死**，同时产生 unhandled rejection。`src/traffic-notify.ts:4-18` 同型：`catch` 块内**再次**调用 `doNotify`，第二次抛错会逃出 try/catch，末尾 `Promise.resolve(push).then(() => $done())` 同样不执行。两个脚本都没有 `$notification` 抛错的用例。
2. **NEW-08（P2）**：`src/Ximalaya.ts:29,37` 无守卫的 `e.realLink.indexOf("open")`。异常被外层 `catch` 吞掉后走 `$done({})` → **整条响应原样放行，净化完全失效**，且没有任何日志能区分"没广告"与"净化崩了"。第 37 行的守卫是 `header.length <= 1` 却索引 `header[0]`，`length === 0` 时同样抛错。
3. **静默降级面**：`src/Kugou.ts`、`src/Youku.ts`、`src/Kuwo.ts`、`src/Feishu.ts`、`src/Tieba.ts`、`src/Reddit.ts`、`src/LinkedIn.ts`、`src/Twitter.ts` 的 `catch (e) { $done(); }` 一律无日志。对净化脚本这是合理取舍（宁可放行不可挂死），但**"净化失败"与"无广告"在所有脚本里都不可区分**，线上排查只能靠抓包。建议统一：catch 里至少 `console.log` 一次（Loon 调试日志），并让 `DEBUG` 开关控制。
4. **`mirror-scripts.yml` 的门禁失败不失败**（NEW-11）：`FAIL` 只写入 `GITHUB_ENV` 与 step summary（`:683-687`、`:735-745`），job 保持绿。配合 NEW-01（PR 上 CI 不跑），审核者对"本轮有 5 个文件被门禁拦截"**没有任何自动信号**。

---

## 4. 与既有审计的关系（本报告的全部增量）

| 编号 | 类型 | 是否见于 `doc/audit-2026-09-11.md` / `module-audit-2026-09-11.md` |
|---|---|---|
| NEW-01 镜像 PR CI 永不执行 | 门禁失效 | ✗ 新（PR #41 提到但未并入本仓库文档） |
| NEW-02 `dependabot.yml` 裸 ignore | 配置自相矛盾 | ✗ 新（上一轮只修了 js-yaml 那一条） |
| NEW-03 Qidian token 进锁屏通知 | 凭据暴露 | ~ 仅存在于 `ENGINE-MANIFEST.json`，未进审计报告 |
| NEW-04 Global 34,579 条声明为假 | 文档漂移 | ✗ 新 |
| NEW-05 `google` → `googleads` 遮蔽 | 规则正确性 | ✗ 新 |
| NEW-06 LinkedIn/Twitter 前缀正则 | 同类残留 | ✗ 新（同类已修 3 处，这 2 处漏网） |
| NEW-07 health/traffic-notify `$done` 缺口 | 健壮性 | ✗ 新 |
| NEW-08 Ximalaya `realLink` 无守卫 | 健壮性 | ✗ 新 |
| NEW-09 MitM 面 1343 / 边界不安全通配 | 安全面 | ✗ 新（数量与具体通配均首次量化） |
| NEW-10 3 个工具零接线 | 流程 | ✗ 新 |
| NEW-11 门禁失败不红 | 流程 | ✗ 新 |
| NEW-12 `src/` 不受静态检查 | 代码质量 | ~ AGENTS.md 提过无类型检查，未提"lint 只覆盖产物" |
| NEW-13 死参数 / 死目录 | 卫生 | ✗ 新 |

---

## 5. 已核实为良好（避免重复报告）

- 全部 9 个本地门禁绿；156/156 测试；build 16 ms 无漂移。
- `artifact-idempotency`（产物可再生成性）已落地并有效——这是本仓库最强的一条架构保证。
- script-path **157/157 全部走自建 CDN**，零第三方直连。
- `Mirror/MANIFEST.json` ↔ 磁盘一致（40/40）；PR #39 head 的 53 条清单 blob 哈希 **0 异常**（EOL 归一化修复有效，实测复现）。
- `npm audit` 的 42 项分组与 AGENTS.md 描述一致；`js-yaml` 确已修复；线上告警 0。
- 银行 MitM 三重断言（实测 47 条排除、20 家点名齐全、正负无重叠）。
- `[Rule]` 483 行与 AGENTS.md 声明一致；`GEOIP, CN, DIRECT` 紧邻 `FINAL` 收尾正确。
- `.workbuddy-ai/` 未泄漏；`surgio-build` 有凭据断言；`resource-parser`（Sub-Store 1.27 MB 解析器）已移除。
- `workflow-bash-check` 覆盖 41 个 run 块，且**明确标注了自身的盲区**（不校验内嵌 node/python）——这种"声明边界"的做法值得保留。

---

## 6. 结论

上一轮审计（同日）把**行为级缺陷**（脚本挂死、广告字段误伤、门禁假绿）清理得相当彻底，
测试基建也从 108 例扩到 156 例并新增了 `doneCalled` 这类**契约级断言**。
本轮独立复核**未能推翻任何一条既有结论**，`npm audit`、`[Rule]` 行数、镜像清单一致性
等关键数字全部与文档吻合——这在同类仓库里很少见。

本轮的增量集中在**上一轮的盲区**：

1. **门禁的"运行侧"**。上一轮修的是门禁**逻辑**（体积下限、银行断言、TSV 反注入），
   但没人验证这些门禁**是否真的在跑**。NEW-01 说明镜像 PR 的 CI 从未执行过——
   `all_versions_ignored` 那类红 run 之所以被看见，只是因为 Dependabot 的 run 属于
   仓库自身事件流；而镜像 PR 的 run 停在 `action_required`，**连红都不会红**。
   同理 NEW-10（3 个工具零接线）、NEW-11（门禁失败不红）。
   **建议把"门禁活性"本身作为一类断言**：每个 workflow 至少要有一个 run 在近 7 天内
   到达 `success` 且 `jobs > 0`，否则开 issue。

2. **同一根因的第四次出现**。广告字段误伤在 `ad.ts` / `Feishu` / `AlipayMini` 修了三次，
   `LinkedIn`/`Twitter` 仍在（NEW-06）。这说明**逐点修复没有配套的反向扫描**。
   一行正则扫描就能封堵，见 3.1 的建议 4。

3. **文档与实测的漂移**。`34,579 SUFFIX` 与实测 `0` 的差距（NEW-04）不是笔误——
   它推翻了规则排序的性能理由。AGENTS.md 的价值恰恰在于"勿凭记忆、必须复核"，
   那么**文档里的关键数字也应当被自动复核**。

优先级：**先 NEW-01（合并 #41 + 配 token）**，因为它决定了其余所有镜像侧门禁
是否具有实际意义；**再 NEW-02**（一处 12 行改动，永久消除一类红 run）；
**NEW-03 需要产品决策**（是否保留 Qidian 引擎），建议按"卸载即同时消除性能与安全成本"
的框架来评估。

---

## 附录 A：复现命令

```bash
# 基线门禁（全部应绿）
npm run build && git diff --stat Scripts/ && npm test && npm run lint
npm run check:sync && npm run check:orphan && npm run check:plugin \
  && npm run check:contract && npm run check:workflows

# NEW-01：镜像 PR 的 CI 是否在跑
gh pr checks 39
gh run list --limit 30 --json name,conclusion,event,headBranch \
  | jq -r '.[] | select(.headBranch=="mirror/sync")'

# NEW-02：裸 ignore 条目 + 可修复性
grep -n 'dependency-name' .github/dependabot.yml
npm run audit:ci --silent -- --json > /tmp/audit.json
node -e 'const a=require("/tmp/audit.json");for(const n of ["tar","sigstore","minimatch",
"brace-expansion","glob","ip","got","@tootallnate/once","cross-spawn","diff",
"decode-uri-component"]){const v=a.vulnerabilities[n];if(v)console.log(n,v.severity,
"fixAvailable="+v.fixAvailable)}'

# NEW-04：Global 列表的真实规模
curl -fsSL -o /tmp/up-global.list \
  https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Global/Global.list
wc -c -l /tmp/up-global.list Mirror/rules/loon-Global.list
grep -v '^#' Mirror/rules/loon-Global.list | awk -F, '{print $1}' | sort | uniq -c

# NEW-05：Global 的 KEYWORD 对 REJECT 列表的遮蔽
# （脚本见本报告 §3.1 的说明；核心是 36 个 Global KEYWORD × Advertising/Privacy/Hijacking 全量子串匹配）

# NEW-09：有效 MitM 解密面
node -e '
const fs=require("fs");const set=new Set();
const add=l=>{const m=l.match(/^hostname\s*=\s*(.*)$/);if(!m)return;
for(const it of m[1].replace(/^%APPEND%\s*,?\s*/,"").split(",")){const h=it.trim();
if(!h||h.startsWith("-")||h.startsWith("%"))continue;set.add(h.toLowerCase())}};
const lcf=fs.readFileSync("Profile/Loon.lcf","utf8");
for(const l of lcf.split("\n"))add(l);
for(const m of lcf.matchAll(/ws\.wenn\.in\/main\/(Plugin|Kelee|Mirror)\/([^,\s]+)/g)){
  const p=m[1]+"/"+m[2];
  if(fs.existsSync(p)&&p.endsWith(".plugin"))for(const l of fs.readFileSync(p,"utf8").split("\n"))add(l);
}
console.log("正包含 hostname:",set.size,"通配:",[...set].filter(h=>h.includes("*")).length);'

# NEW-10：零接线工具 + 其可报出的漂移
for t in tools/*.mjs; do b=$(basename $t); \
  echo "$b -> $(grep -rl "$b" .github/ package.json test/ 2>/dev/null | tr '\n' ' ')"; done
node tools/mirror-drift-check.mjs

# NEW-13：死参数
grep -n 'customParams' template/loon.tpl surgio.conf.js
```

## 附录 B：本轮未做（明确的边界）

- **未做动态抓包验证**。所有结论来自静态分析 + 仓库自带门禁 + GitHub API。
  `src/Umetrip.ts` 的 protobuf 改写、`src/Luckin.ts` 的内联 AES-128-ECB 实现的
  **密码学正确性**只做了代码阅读（SBOX/RCON/invMixColumns 常量与结构均正确），
  未与真实报文做交叉验证——`test/cases/luckin-umetrip.test.js` 覆盖了行为但不覆盖
  与上游实现的逐字节等价。
- **未反混淆 `Scripts/Qidian.js`**。NEW-03 的结论引自 `ENGINE-MANIFEST.json` 的
  `known_risks` 自述（该文件称"已反混淆验证"），本报告未独立复核。
- **未评估 iOS 客户端侧的实际表现**（规则命中率、耗电、内存）。
