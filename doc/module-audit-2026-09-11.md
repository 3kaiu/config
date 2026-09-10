# 分模块审计报告 — 3kaiu/config

- **审计日期**：2026-09-11
- **审计对象**：`3kaiu/config`（Loon 配置仓库，HEAD `b979ff6`）
- **审计轴**：**功能模块**（与 `doc/audit-2026-09-11.md` 的六维横切审计互补，非重复）
- **审计方式**：静态阅读 + **实际执行**（所有数字均由脚本实测产出，可复现命令见附录）
- **前置状态**：六维审计 25 项发现已全部收口（23 修复 / 2 知情接受），门禁全绿

---

## 0. 为什么换轴：横切审计看不见的东西

上一轮按「代码质量 / 架构 / 安全 / 性能 / 依赖 / 健壮性」六个维度切。这种切法的**结构性盲区**是：**跨模块契约**。

- 六维审计问的是"这段代码写得好不好"；
- 分模块审计问的是"**这个功能，从用户拨动开关到脚本真正生效，整条链是否接通**"。

本轮最有价值的发现全部落在后者——它们**不是任何单个文件里的 bug**，而是「插件声明的开关」↔「插件传给脚本的参数」↔「脚本实际读取的键」三者之间的**断链**。每个文件单独看都"正确"，接起来是死的。

本轮新增 **11 项发现**（`MOD-01` ~ `MOD-11`），另有 **2 项记录/建议**（`MOD-12` 已知冻结、`MOD-13` 门禁建议）。其中 **3 项为 P1 功能缺陷**，全部是跨模块契约断链。

---

## 1. 模块划分

按仓库实际的**产物链**而非目录树划分（`Plugin/` 与 `Scripts/` 分属两个模块，因为它们是不同生命周期、不同责任人、不同门禁）：

| # | 模块 | 载体 | 规模 | 产物/消费方 |
|---|---|---|---|---|
| M1 | 净化脚本层 | `src/*.ts` → `Scripts/*.js` | 27 源 / 27 产物 / 3,072 行 | Loon 脚本运行时 |
| M2 | 自维护插件层 | `Plugin/*.plugin` | 45 个 | Loon 插件引擎 |
| M3 | **插件↔脚本契约** | 跨 M1/M2 | 60 个 `{占位符}` 契约点 | — |
| M4 | 上游托管层 | `Kelee/*.plugin` | 15 个 | Loon 插件引擎 |
| M5 | 规则与策略层 | `Profile/Loon.lcf` 的 `[Rule]`/`[General]`/`[Proxy Group]` | 483 有效规则 | Loon 内核 |
| M6 | 镜像层 | `Mirror/` + `Mirror/MANIFEST.json` | 40 条清单 | 构建期拉取 |
| M7 | 模板与构建层 | `template/` + `surgio.conf.js` → `Profile/Loon.lcf` | 641 静态行 | 发布入口 |
| M8 | 工具链与门禁层 | `tools/*.mjs` + `.github/workflows/` | 10 工具 / 8 工作流 | CI |
| M9 | 测试层 | `test/cases/*.test.js` | 143 用例 | CI |
| M10 | 文档层 | `AGENTS.md` / `doc/` | 2 文档 | 维护者 |

---

## 2. 结论总览

| 模块 | 审计结论 | 优化点 | 最高等级 |
|---|---|---|---|
| M1 净化脚本层 | ⚠️ 有优化点 | 2 | P1 |
| M2 自维护插件层 | ⚠️ 有优化点 | 4 | P2 |
| **M3 插件↔脚本契约** | ❌ **有缺陷** | **3** | **P1** |
| M4 上游托管层 | ✅ 基本健康 | 1 | P3 |
| M5 规则与策略层 | ✅ 健康 | 1 | P3 |
| M6 镜像层 | ❌ **有缺陷** | 1 | P2 |
| M7 模板与构建层 | ✅ 健康 | 0 | — |
| M8 工具链与门禁层 | ⚠️ 有优化点 | 1 | P3 |
| M9 测试层 | ⚠️ 有优化点 | 1 | P3 |
| M10 文档层 | ❌ **陈述失准** | 1 | P2 |

**逐模块判定**：10 个模块中 **3 个健康**（M4/M5/M7，含 2 项 P3 观察）、**4 个有可优化项**（M1/M2/M8/M9）、**3 个存在需处置缺陷**（M3/M6/M10）。

> 计数说明：`MOD-02` / `MOD-03` 的根因在脚本侧（M1）、断点在契约侧（M3），故在两处各列一次；上表合计 15 行对应去重后的 **13 个条目**（`MOD-01` ~ `MOD-13`）。

---

## 3. 逐模块详述

### M1 净化脚本层（`src/*.ts` → `Scripts/*.js`）

**结论**：⚠️ 有优化点。脚本本身质量高（`Umetrip.ts` 手写 protobuf 编解码、`AlipayMini.ts` 的字段名分段匹配注释详尽说明了为何不用子串匹配），但**存在一个"参数契约无人满足"的缺陷**。

**规模**：`Weibo.ts` 817 行 / `Umetrip.ts` 471 行 / `Luckin.ts` 284 行 / `Zhihu.ts` 268 行 / `AlipayMini.ts` 197 行，其余 ≤ 84 行。

**优化点**

| ID | 问题 | 等级 |
|---|---|---|
| `MOD-02` | `Bilibili.ts` / `AlipayMini.ts` 的 debug 分支**永远不可达** | **P1** |
| `MOD-03` | `Zhihu.ts` 收到参数但从不读取 | **P1** |

**判断依据（实测）**

全仓库仅 3 个脚本读取 `$argument`：

```
src/AlipayMini.ts:29   debug: typeof $argument !== 'undefined' && $argument.includes('DEBUG_MODE=true')
src/Bilibili.ts:7      const DEBUG = typeof $argument !== "undefined" && $argument.includes("BILI_DEBUG_ENABLE=true");
src/Zhihuifangdong.ts:15  const arg = typeof $argument !== "undefined" ? $argument : "";
```

而插件侧**实际传入**的 `argument=` 取值全集（`grep -rhoE 'argument=[^,]*' Plugin/*.plugin`）：

```
argument=[{NEMUSIC_DEBUG_ENABLE}     argument=activityAds
argument=[{QDREADER_DEBUG}           argument=appOpenAds
argument=[{QDREADER_DEBUG}]          argument=bannerPicMore
argument=[{ZHIHU_DEBUG_ENABLE}]      argument=showAds
```

三者对不上：

1. **`Bilibili.ts`** 期望 `$argument` 含 `BILI_DEBUG_ENABLE=true`，但 `Bilibili.js` 的唯一引用点 `Plugin/bilibili-pro.plugin:48` 是
   `cron {BILI_CRON_EXP} script-path=.../Bilibili.js, timeout={TIMEOUT}, tag=B 站定时任务, enable={ENABLE_BILI}`
   —— **完全没有 `argument=`**。故 `$argument === undefined`，`DEBUG` 恒为 `false`。
2. **`AlipayMini.ts`** 期望含 `DEBUG_MODE=true`，但 13 条 script-path 全部传的是**动作名**（`ad-splash-filter` / `homefeed-clean` / `rec-filter` / `services-popup-filter` / `popup-ad-clear` …），永远不含该串。
3. **`Zhihuifangdong.ts`** 期望裸动作 token，`Plugin/video-community-purify.plugin:107-110` 传 `argument=appOpenAds` / `bannerPicMore` / `showAds` / `activityAds` —— **这是唯一接通的一例**，反证了设计意图。

构建产物侧复核一致：`Scripts/Bilibili.js` 含 `argument<"u"&&$argument.includes("BILI_DEBUG_ENAB…`，`Scripts/Zhihuifangdong.js` 含 `argument<"u"?$argument:""`。

`MOD-03`：`Plugin/zhihu-pro.plugin:115` 明确传了 `argument=[{ZHIHU_DEBUG_ENABLE}]`，但 `grep -c argument src/Zhihu.ts` = **0**。参数传了、声明了、**没人接**。

**根因**：同一概念（debug）在仓库里有**三种互不兼容的约定**——`BILI_DEBUG_ENABLE=true`（键值对串）/ `DEBUG_MODE=true`（另一套键名）/ 裸动作 token。没有任何文档或门禁固定这一约定，因此每写一个新脚本就重新发明一次。

---

### M2 自维护插件层（`Plugin/*.plugin`，45 个）

**结论**：⚠️ 有优化点。语法层健康（`check:plugin` 全绿），但**开关层存在大面积"惰性 UI"**：用户能拨、拨了没用。

**优化点**

| ID | 问题 | 等级 |
|---|---|---|
| `MOD-04` | `bank.plugin` 4 个开关全惰性，且插件本身无任何规则段 | **P2** |
| `MOD-05` | 46 个"已声明但零引用"参数（模板残留） | **P2** |
| `MOD-06` | `#!arguments-desc` 文档漂移（23 个插件） | **P2** |
| `MOD-07` | 3 个参数名以数字开头（生成器无守卫） | **P3** |

**判断依据（实测）**

`MOD-04` — `Plugin/bank.plugin` 全文 18 行，段结构仅有 `[Argument]`：

```
#!name=银行应用去广告
#!desc=交通银行·农业银行·中国银行·云闪付 — 开屏/弹窗/推广净化，支持独立开关。
[Argument]
UNIONPAY_ENABLE / BOCOM_ENABLE / ABC_ENABLE / BOC_ENABLE
# v7.3: 本插件仅提供开关 UI，实际规则由主配置统一管理。
```

- 4 个开关在 `Plugin/` `Scripts/` `src/` `template/` **零引用**（`grep -rnF` 逐键验证）；
- 规则实际来自 `template/snippet/bank-ad-reject.tpl`（仅 3 条 `REJECT`），该文件**不引用任何开关**；
- 插件确实被接线：`template/loon.tpl:461` → `Profile/Loon.lcf:855`。

**定性**：这是**有意的架构决策**（注释写明了），但**用户可感知的表述失准**——`#!desc` 承诺"支持独立开关"，四个开关又各自带 `desc=开启后将拦截…`，用户会合理地认为可以只关交通银行、留着中国银行。实际上四个开关全部无效，规则恒生效。**建议**：要么把 4 个开关做成真正生效（把 `bank-ad-reject.tpl` 拆成按行 `enable={X}`），要么删掉开关并在 `#!desc` 说明"本插件无开关，规则常驻"。

`MOD-05` — 修正后的占位符解析（`/tmp/arg-resolve2.mjs`）给出「已声明但零引用」共 **46** 个：

| 类别 | 数量 | 关键证据 |
|---|---|---|
| `TIMEOUT` | 19 | **全部 19 个** 的 `timeout={..}` 占位用法数 = 0；有 script-path 的一律硬编码 `timeout=N` |
| `*_DEBUG_ENABLE` | 21 | 无任何 `argument=[...]` 把 debug 传给脚本 |
| `bank` 开关 | 4 | 见 `MOD-04` |
| `*CRON_EXP` | 2 | `alipay-miniprogram-pro:14 MINICRON_EXP`、`sunshufu-pro:14 SUNCRON_EXP`，无对应 `cron` 行 |

`TIMEOUT` 是其中最干净的一类：**19/19 全部惰性，无一例外**。并且 `16/27` 个 `*-pro.plugin` 的 `script-path=` 计数为 **0**——这些插件根本没有脚本，却声明了"脚本最大执行时长"和"调试模式"。这是模板复制留下的**残留脚手架**。

`MOD-06` — `#!arguments-desc` 出现在 23 个 `Plugin/` 插件中，内容是 `[Argument]` 块的镜像（`- \{KEY}: type,default,tag=..,desc=..`）。**它不是功能声明**：

- 官方文档 `https://nsloon.app/docs/Plugin/` 的 `#!` 字段表是**穷举**的（`name`/`desc`/`author`/`homepage`/`icon`/`system`/`system_version`/`loon_version`/`tag`/`type`），**不含 `arguments-desc`**；
- 上游 `Kelee/YouTube_remove_ads.plugin` 提供了决定性对照：它的第 9 行是**功能性**的 `#!arguments=屏蔽上传按钮:true,…`（配合第 26/31 行的 `{{{屏蔽上传按钮}}}` 三花括号替换），而第 10 行 `#!arguments-desc=- 屏蔽参数: [true, false] \n- 翻译参数: …` 是**纯散文**，连键名都没有。

所以 `arguments-desc` 只是描述字符串。仓库里它的内容与真实 `[Argument]` 已漂移（`ALIPAY_CRON_EXP`、`NEMUSIC_CRON_EXP`、`ZHIHU_CRON_EXP` 等 18 个键只活在文档串里）。**危害**：维护者读描述串会以为某功能存在。

`MOD-07` — 3 个参数名以数字开头，均由 `tools/aggregate-purify.mjs` 生成：

```
Plugin/news-purify.plugin:13            36KR_ENABLE
Plugin/transport-purify.plugin:13       2BULU_ENABLE
Plugin/video-community-purify.plugin:12 555DY_ENABLE
```

根因是生成器**没有守卫**——`slugOf()` 只做大写与替换，成员名 `36Kr` / `2bulu` / `555DY` 原样产出数字开头键：

```js
// tools/aggregate-purify.mjs:57, 111, 159
function slugOf(name) { return name.toUpperCase().replace(/[^A-Z0-9]+/g, "_"); }
const sw = `${slugOf(m.replace(/-remove-ads$/, "").replace(/-ads$/, ""))}_ENABLE`;
```

这三个键**确实被规则引用**（`enable={NEWS_PURIFY_ENABLE}&{36KR_ENABLE}` 等），因此不是死开关。官方文档只写 `参数名 = 控件类型,…`，**未给出命名限制**，故本轮**不下"必然失效"的结论**（无法在本机真机验证）。风险点在于：若 Loon 的 Argument 解析器按常规标识符词法处理，数字开头会导致声明被拒，`{36KR_ENABLE}` 解析为空 → `enable={总开关}&` 成为畸形条件。**处置建议**：加生成器守卫（数字开头则加 `APP_` 前缀）并在真机确认一次，成本极低、消除不确定性。

---

### M3 插件↔脚本契约（跨 M1/M2）— 本轮最严重模块

**结论**：❌ **有缺陷**。这是唯一一个"整条链从开关到脚本被切断"的模块，且断点有 3 处。

**优化点**

| ID | 问题 | 等级 |
|---|---|---|
| `MOD-01` | 2 个 `cron` 占位符未声明 → **定时任务不执行** | **P1** |
| `MOD-02` | 2 个脚本的 debug 分支不可达（见 M1） | **P1** |
| `MOD-03` | 1 个参数传递后被丢弃（见 M1） | **P1** |

**判断依据（实测 + 官方文档）**

`MOD-01` 是本轮**证据链最完整**的发现。官方文档 `[Argument]` 章节关于 Cron 的原文：

> 参数也可以用于 Cron 表达式：
> ```ini
> cron {cronExpression} script-path=task.js,timeout=300,tag=自动运行
> ```
> **如果表达式格式无效，Cron 脚本不会执行。**

实测两处引用了一个**从未声明**的占位符：

```
Plugin/netease-pro.plugin:96   cron {NEMUSIC_CRON_EXP} script-path=…/Mirror/netease.adblock.js, timeout={TIMEOUT}, …
Plugin/zhihu-pro.plugin:115    cron {ZHIHU_CRON_EXP}   script-path=…/Scripts/Zhihu.js, timeout={TIMEOUT}, …
```

两者的 `[Argument]` 段**都不含**对应键（逐行核对）：

```
netease-pro [Argument]: ENABLE_NEMUSIC, TIMEOUT, NEMUSIC_SIGNIN_ENABLE, NEMUSIC_CHECKIN_ENABLE,
                        NEMUSIC_ADBLOCK_ENABLE, NEMUSIC_FRAMEWORK_ENABLE, NEMUSIC_DEBUG_ENABLE   ← 无 NEMUSIC_CRON_EXP
zhihu-pro   [Argument]: ENABLE_ZHIHU, TIMEOUT, ZHIHU_HOME_ENABLE, ZHIHU_SEARCH_ENABLE,
                        ZHIHU_ANSWER_ENABLE, ZHIHU_MEMBER_ENABLE, ZHIHU_LINK_ENABLE, ZHIHU_DEBUG_ENABLE ← 无 ZHIHU_CRON_EXP
```

`NEMUSIC_CRON_EXP` / `ZHIHU_CRON_EXP` 只出现在 `#!arguments-desc`（= 描述串，见 `MOD-06`，**不产生运行时效果**）。

把全仓库 **21 个**提到 `CRON_EXP` 的插件的「`[Argument]` 声明」与「`cron` 行使用」做成 2×2 矩阵，证据链完整闭合：

| 插件 | `[Argument]` 声明 | `cron` 行使用 | 判定 |
|---|---|---|---|
| `bilibili-pro` | **1** | **1** | ✅ **唯一正确配对（对照组）** |
| `alipay-miniprogram-pro` | 1 | 0 | ⚠️ 声明了但无 `cron` 行 → 惰性开关（计入 `MOD-05`） |
| `sunshufu-pro` | 1 | 0 | ⚠️ 同上 |
| **`netease-pro`** | **0** | **1** | ❌ **用了但没声明 → 定时任务不执行** |
| **`zhihu-pro`** | **0** | **1** | ❌ **同上** |
| 其余 16 个 | 0 | 0 | 仅 `#!arguments-desc` 残留（纯文档漂移，计入 `MOD-06`） |

矩阵的价值在于它**排除了"孤立笔误"的解释**：21 个插件里只有 1 个做对（`bilibili-pro`，声明与使用同行对照），2 个反向做错（声明无使用），2 个正向做错（使用无声明），16 个两者皆无只留文档。**四种组合全部出现**，说明根因不是某个人的一次手滑，而是**没有任何机制固定这一约定**——每次新增定时任务都是重新掷骰子。

`bilibili-pro` 的正确写法：

```
Plugin/bilibili-pro.plugin:12  BILI_CRON_EXP=input,"0 12 * * *",tag=Cron 表达式     ← 声明
Plugin/bilibili-pro.plugin:48  cron {BILI_CRON_EXP} script-path=…/Scripts/Bilibili.js, …  ← 使用
```

按官方语义，netease-pro 与 zhihu-pro 的占位符解析为空 → Cron 表达式无效 → **两个定时任务（网易云签到打卡、知乎签到清理）静默不执行**。用户看到开关是"开"的，任务从不跑，且无任何报错。

**根因**：占位符的「声明」与「使用」分居两个文件/两行，中间没有任何门禁校验二者配对。现有 `check:plugin` 只校验**段结构与规则语法**（`tools/plugin-lint-check.mjs` 的 `VALID_SEG` / `RULE_PREFIX` / `ACTION_OK`），**不解析 `[Argument]` 与 `{占位符}` 的配对关系**——这正是门禁盲区。

---

### M4 上游托管层（`Kelee/*.plugin`，15 个）

**结论**：✅ 基本健康。15 个上游插件中 14 个是纯声明式（仅 `[Rule]`/`[Rewrite]`/`[MitM]`），只有 `YouTube_remove_ads.plugin` 带 `[Script]`。体积与段结构：

```
12306(456B,[Rule])  Block-HTTPDNS(7.9K)  BlockAdvertisers(13.6K)  Google(548B)
Prevent-DNS-Leaks(1.1K)  QQ-Redirect(1.3K)  QuickSearch(1.2K)  Remove-ads-by-keli(9.4K)
TelegramRedirect(750B)  TestFlightRegionUnlock(614B)  UnnooQuan(678B)
YouTube_remove_ads(3.2K,[Rewrite][Script][MitM])  guiderank(889B)  smzdm(6.4K)  umetrip(705B)
```

**优化点**

| ID | 问题 | 等级 |
|---|---|---|
| `MOD-12` | 上游已全局 403，模块整体处于"冻结"状态（已知，记录） | P3 |

**判断依据**：`AGENTS.md` 已记录 `kelee.one` 自 2026-08-25 起全局 403（含浏览器 UA），`upstream-health` issue #27 对应。实测确认本模块**不可刷新**，因此对其内部风格的差异（如 `#!arguments=` / `#!openUrl=` / `#!date=` 等非官方 `#!` 字段）**不应做本地"修正"**——上游解封后会被覆盖。**这是正确的处置**，仅作记录。

唯一需注意的是 `MOD-12` 与 M6 的交互：Kelee 上游不可达，而 `tools/aggregate-purify.mjs` 依赖 `Kelee/*.plugin` 作为聚合源（`readPlugin()` 读 `Kelee/<name>.plugin`）。上游冻结期间聚合器**不可重跑**（会因成员缺失而 `⚠️ 跳过缺失`），这是既成事实，不是缺陷。

---

### M5 规则与策略层（`Profile/Loon.lcf`）

**结论**：✅ 健康。483 条有效规则的冲突/重复/遮蔽检查全部干净。

**优化点**

| ID | 问题 | 等级 |
|---|---|---|
| `MOD-10` | 3 条被父域遮蔽的死规则（0.6%） | P3 |

**判断依据（实测）**

`Profile/Loon.lcf` 段结构（总 903 行）：

| 段 | 起始 | 总行 | 注释/空 | 有效 |
|---|---|---|---|---|
| `[General]` | L7 | 33 | 7 | 26 |
| `[Host]` | L41 | 24 | 1 | 23 |
| `[Proxy]` | L66 | 6 | 6 | 0 |
| `[Proxy Group]` | L73 | 17 | 7 | 10 |
| `[Remote Filter]` | L91 | 7 | 5 | 2 |
| `[Remote Proxy]` | L99 | 5 | 4 | 1 |
| **`[Rule]`** | L105 | **686** | **203** | **483** |
| `[Remote Rule]` | L792 | 18 | 11 | 7 |
| `[Plugin]` | L811 | 82 | 12 | 70 |
| `[Rewrite]` | L894 | 6 | 1 | 5 |
| `[MitM]` | L901 | 2 | 0 | 2 |

`[Rule]` 组成 —— 类型：`DOMAIN-SUFFIX` 359 / `DOMAIN` 109 / `DOMAIN-KEYWORD` 7 / `IP-CIDR` 4 / `DEST-PORT` 2 / `GEOIP` 1 / `FINAL` 1；
策略：`REJECT` 109 / `Developer` 79 / `Streaming` 64 / `Social` 64 / `AI` 52 / `DIRECT` 46 / `Proxy` 33 / `Gaming` 25 / `DROP` 6 / `Apple` 3 / `OpenCode` 1。

一致性检查结果：

```
── C) 同域策略冲突 (0) ──        ── D) 完全重复 (0) ──
── A) DOMAIN 被更早同策略 DOMAIN-SUFFIX 覆盖 → 死规则 (2) ──
  L225 DOMAIN, auth0.openai.com, AI          ← 已被 L217 DOMAIN-SUFFIX, openai.com, AI 覆盖
  L295 DOMAIN, nrdns.netflix.com, Streaming  ← 已被 L287 DOMAIN-SUFFIX, netflix.com, Streaming 覆盖
── B) DOMAIN-SUFFIX 被更早同策略父域覆盖 → 死规则 (1) ──
  L401 DOMAIN-SUFFIX, calls.signal.org, Social ← 已被 L400 DOMAIN-SUFFIX, signal.org, Social 覆盖
══ 合计可删/可合并: 3 条 (占 0.6%) ══
```

**评价**：0 冲突、0 精确重复、0.6% 遮蔽，对一份 483 条人工维护的规则表而言是**很好的水平**。3 条遮蔽规则无功能影响（策略相同），属纯整洁性问题。另核查 `L790 FINAL, Final` 仅 2 字段——这是 Loon `FINAL, policy` 的合法写法，**非缺陷**（已排除误报）。

---

### M6 镜像层（`Mirror/` + `MANIFEST.json`）

**结论**：❌ **有缺陷**。清单与工作流声明**已漂移 21/48**，且漂移是**静默**的（`keep_old` 兜底把抓取失败伪装成"内容未变"）。

**优化点**

| ID | 问题 | 等级 |
|---|---|---|
| `MOD-09` | 7 条 URL 漂移（含上游仓库改名未跟进）+ 13 条从未成功抓取 | **P2** |

**判断依据（实测）**

`/tmp/mirror-drift.mjs` 把 `mirror-scripts.yml` 里每条 `mirror "<url>" "<dest>"` 声明与 `MANIFEST.json` 记录的 `source_url` 逐条比对：

```
workflow 声明 mirror() 调用: 48 条      MANIFEST 条目: 40 条
一致: 27 / 48     URL 漂移(A): 7     从未抓到(B): 14      孤儿(C): 6
```

**A) URL 漂移 7 条** —— 工作流声明 `releases/latest/download/…`，清单里记的却是**某个更早的固定版本**，证明抓取长期失败、`keep_old` 一直保留陈旧条目：

| 目标 | workflow 声明 | MANIFEST 实际记录 |
|---|---|---|
| `iringo/iRingo.Maps.plugin` | `NSRingo/**MapKit**/releases/**latest**/download/…` | `NSRingo/**Maps**/releases/download/**v4.6.1**/…` |
| `iRingo.News.plugin` | `…/releases/latest/…` | `…/releases/download/v3.2.1/…` |
| `iRingo.Siri.plugin` / `Search` | `…/releases/latest/…` | `…/releases/download/v4.2.7/…` |
| `iRingo.TestFlight.plugin` | `…/releases/latest/…` | `…/releases/download/v3.4.0/…` |
| `iRingo.TV.plugin` | `…/releases/latest/…` | `…/releases/download/v3.4.4/…` |
| `iRingo.LocationServices.plugin` | `…/releases/latest/…` | `…/releases/download/v1.0.1/…` |

第一条最值得注意：**上游把仓库从 `MapKit` 改名成了 `Maps`**，工作流从未跟进。这不是"网络抖动"，是**声明的地址已经不存在**，因此 `keep_old` 会**永久**保留一个不可能再更新的条目。

**B) 声明但从未抓到 14 条** —— 13 条 `iringo/*/request.bundle.js|response.bundle.js`（`releases/latest`）在磁盘与清单中**均无记录**，证实此前观察到的"无 bundle.js"状态，且原因已定位为**抓取永久失败**，而非"尚未同步"。（第 14 条 `rules/loon-$n.list` 是我行正则匹配到 `for` 循环变量，属工具自身假阳性。）

**C) 清单有但工作流不再声明 6 条** —— 6 个 `rules/loon-*.list`，同样由 `for n in Advertising Privacy Hijacking Epic China Global; do` 循环变量所致，**非真孤儿**。

另确认：`MANIFEST.json` 内部**零** `latest` 字符串——漂移完全在**工作流侧**，即"声明与记录不再互相印证"。

**连带影响（文档失准，计入 `MOD-10`/M10）**：`AGENTS.md` 与 `doc/infrastructure.md` 均陈述 NSRingo 系列插件"跟随 latest"。实测该陈述**与事实不符**——7 条跟随 latest 的声明全部没有兑现，实际停留在固定旧版本。

**严重度为何是 P2 而非 P1**：这些镜像**不影响当前发布产物的正确性**（陈旧但可用），但它同时意味着 ① 上游安全/功能更新被静默丢弃；② `keep_old` 的"防投毒"设计在此退化为"防更新"。**且现有门禁无法发现**——`mirror-scripts` 只比对"本轮抓取 vs 上轮清单"，抓取失败即 `keep_old`，永远不会报"声明地址已 404"。

---

### M7 模板与构建层（`template/` + `surgio.conf.js` → `Profile/Loon.lcf`）

**结论**：✅ 健康。本轮**未发现优化点**。

**判断依据**

- `npm run generate` 生成结果与仓库 `Profile/Loon.lcf` **字节级一致**（`git diff` 为空）；
- `npm run check:sync` 641 条静态行**正反向全部命中**（`tools/tpl-sync-check.mjs`）；
- `[Plugin]` 段 70 条有效引用全部指向存在的外壳文件，无悬空；
- `template/snippet/` 与主模板的 include 关系闭合。

上一轮已修复的 `CFG-01`（`Proxy = url-test, MainNodes` 行尾悬空的 `东京` 字面量）在本轮复核中确认**未回归**。

---

### M8 工具链与门禁层（`tools/*.mjs` + `.github/workflows/`）

**结论**：⚠️ 有优化点。门禁密度高（10 工具 / 8 工作流 / 41 个 `run:` 块），但**存在一个成体系的覆盖盲区**——所有门禁都不校验「`[Argument]` 声明 ↔ `{占位符}` 使用」的配对。

**优化点**

| ID | 问题 | 等级 |
|---|---|---|
| `MOD-13` | 缺"占位符配对"门禁（正是 `MOD-01`/`MOD-03` 能长期潜伏的原因） | P3（建议新增） |

**判断依据**

逐读 `tools/plugin-lint-check.mjs`（60 插件全绿）的检查项：段名合法性（`VALID_SEG`）、`[Rewrite]` 行首格式、Rewrite 动作白名单（`ACTION_OK`）、`enable={X}&{Y}` 花括号配对、`[MitM]` 行内拼接污染、`[Rule]` 前缀（`RULE_PREFIX`）。

**没有一项涉及 `[Argument]` 与占位符的对应关系。** 因此 `MOD-01`（`{ZHIHU_CRON_EXP}` 未声明）、`MOD-03`（传了参数没人读）、`MOD-05`（46 个声明零引用）三类问题**全部落在现有门禁视野之外**。这不是门禁"失灵"，是门禁"未覆盖"——与上一轮 `CI-01`/`CI-02` 同型（门禁存在 ≠ 门禁有效）。

---

### M9 测试层（`test/cases/*.test.js`）

**结论**：⚠️ 有优化点。143 用例、27 个产物**全部被引用**，但覆盖密度差异达 8.5×。

**优化点**

| ID | 问题 | 等级 |
|---|---|---|
| `MOD-11` | 2 个产物仅 2 处引用，边界覆盖偏薄 | P3 |

**判断依据（实测引用数）**

```
Zhihu:22  Luckin:17  Bilibili:14  Keep:14  Qidian:14  Umetrip:13  Ximalaya:11
Fanqie:10  Zhihuifangdong:10  health-notify:10  Youku:9  Kugou:8  AlipayMini:7  Weibo:7
Cainiao:6  Kuwo:6  LinkedIn:5  Twitter:5  traffic-notify:5  Douyin:4  Reddit:4  Tieba:4
Dianping:3  Feishu:3  Meituan:3  Kuaishou:2  WPS:2
```

- **健康面**：`Qidian:14` 对应的是**无源码的手工轨密文脚本**，仍有 14 处引用，说明该风险点已被有意加固；
- **薄面**：`Kuaishou` / `WPS` 各 2 处，与 `Zhihu` 的 22 处相差 11×。结合上一轮已确认的 `DEP-03` 盲区（esbuild **只转译不做类型检查**，无 `tsc`），薄覆盖脚本的边界错误**既无静态检查兜底、也无行为用例兜底**。

**注意**：这不是"测试写得差"——143 个行为级用例对 27 个脚本已是同类仓库中的高水位。这是一条**边际改进建议**，非缺陷。

---

### M10 文档层（`AGENTS.md` / `doc/`）

**结论**：❌ **陈述失准**。文档中存在与实测不符的事实性陈述。

**优化点**

| ID | 问题 | 等级 |
|---|---|---|
| `MOD-10` | "NSRingo 插件跟随 latest" 与实测不符 | **P2** |

**判断依据**

`AGENTS.md` 与 `doc/infrastructure.md` 描述镜像策略时称 NSRingo 系列跟随上游 `latest`。M6 的实测（`/tmp/mirror-drift.mjs`）显示：7 条声明 `latest` 的镜像**全部**未兑现，清单中记录的是固定旧版本（`v4.6.1` / `v3.2.1` / `v4.2.7` / `v3.4.0` / `v3.4.4` / `v1.0.1`），其中 `MapKit`→`Maps` 的仓库改名从未跟进。

**为什么文档失准要单列一项**：这份文档是**维护者的决策输入**。当文档说"跟随 latest"，维护者就不会去检查版本是否陈旧；而当文档说"声明 latest 但长期 keep_old 在旧版本"，维护者会立刻去查上游。**失准的文档比缺失的文档更危险**——它制造了"已自动跟进"的错觉。

上一轮已修正的两处（测试数 128→143、漏洞归因）本轮复核未回归。

---

## 4. 新增发现汇总与优先级

| ID | 模块 | 问题 | 等级 | 影响 |
|---|---|---|---|---|
| `MOD-01` | M3 | `netease-pro` / `zhihu-pro` 的 `cron` 占位符未声明 → **定时任务不执行** | **P1** | 功能静默失效，无报错 |
| `MOD-02` | M1/M3 | `Bilibili.js` / `AlipayMini.js` debug 分支**永不可达** | **P1** | 调试能力失效；开关无效 |
| `MOD-03` | M1/M3 | `zhihu-pro` 传 `argument=[{ZHIHU_DEBUG_ENABLE}]` 但 `Zhihu.ts` 从不读取 | **P1** | 参数传递空转 |
| `MOD-04` | M2 | `bank.plugin` 4 开关全惰性，插件无规则段 | P2 | 用户误判可控粒度 |
| `MOD-05` | M2 | 46 个"已声明零引用"参数（19×`TIMEOUT` 100% 惰性） | P2 | UI 噪音 + 认知负担 |
| `MOD-06` | M2 | `#!arguments-desc` 文档漂移（23 插件，18 键） | P2 | 描述串非功能，误导维护者 |
| `MOD-09` | M6 | 镜像 7 条 URL 漂移 + 13 条从未抓取 | P2 | 上游更新静默丢弃 |
| `MOD-10` | M10 | 文档"跟随 latest"与实测不符 | P2 | 失准文档制造错觉 |
| `MOD-07` | M2 | 3 个数字开头参数名，生成器无守卫 | P3 | 需真机确认 |
| `MOD-08` | M2 | 3 处重复 hostname | P3 | 无功能影响 |
| `MOD-11` | M9 | `Kuaishou` / `WPS` 测试密度偏薄 | P3 | 边界风险 |
| `MOD-12` | M4 | Kelee 上游冻结（已知） | P3 | 记录项 |
| `MOD-13` | M8 | 缺占位符配对门禁 | P3 | 建议新增 |

**建议处置顺序**：`MOD-01` → `MOD-02` → `MOD-03`（P1 功能缺陷，用户可感知）→ `MOD-09` + `MOD-10`（P2，互为因果，一起改）→ `MOD-04` / `MOD-05` / `MOD-06`（P2 体验与可维护性）→ 其余 P3 排期。

---

## 5. 建议新增的门禁（针对 `MOD-13`）

本轮 3 项 P1 全部落在现有门禁的视野外，且**都是可机械判定的**。建议把 `/tmp/arg-resolve2.mjs` 固化为 `tools/argument-contract-check.mjs`，接入 `npm run check:plugin`：

| 断言 | 检出 | 误报防护 |
|---|---|---|
| `{PLACEHOLDER}` 使用必须有同名 `[Argument]` 声明 | `MOD-01` | 排除纯数字 token（正则量词 `\d{4}` / `\w{32}` / `[A-Z]{2}`）与 `${…}` JS 模板（`Kelee/TelegramRedirect` 的 `request if … then redirect` 内） |
| 声明的 `switch` 必须在某处被引用 | `MOD-04` / `MOD-05` | 排除 `select` 类型（`AI_Policy` 作为策略目标 `{AI_Policy}` 是**正确**用法） |
| `script-path` 指向的脚本若读取 `$argument`，则调用行必须传 `argument=` | `MOD-02` / `MOD-03` | 需建立脚本↔`$argument` 键的映射表 |

> 前两条断言我在本轮已用 `/tmp/arg-resolve2.mjs` 跑通（60 插件，输出 A/B/C 三类）。第三条需要脚本侧契约清单，属新增工作量。
>
> **注意**：第 2 条断言必须排除 `select` 类型——我第一版脚本正是因为没有排除，把 `AI_Policy`（正确用法）误报为"死开关"。

---

## 6. 本轮审计的三处自我更正

按上一轮的做法，**把我自己判断错的地方明确列出**，避免后人沿用错误结论：

1. **`AI_Policy` 不是死开关（我的误报）**。第一版脚本 `/tmp/plugin-switch-audit.mjs` 报 `Plugin/ai.plugin` 有 1 个死开关 `AI_Policy`。**错**。它是 `select` 类型，用法是把选中的策略组名**代入规则策略位**：`DOMAIN-SUFFIX, openai.com, {AI_Policy}` —— 实测该占位符在 `ai.plugin` 中出现 **45 次**（`grep -oF "{AI_Policy}" Plugin/ai.plugin | wc -l`）。开关扫描器只找 `enable={X}`，因此对 `select` 类型结构性误报。

2. **`video-community-purify` 的 4 个 camelCase 开关不是死开关（我的误报）**。`appOpenAdsSwitch` / `bannerAdsSwitch` / `adWhitelistSwitch` / `activityAdsSwitch` 被报为死开关，**错**。它们在 `Plugin/video-community-purify.plugin:107-110` 被真实引用：`enable={VIDEO_ENABLE}&{appOpenAdsSwitch}`。误报原因同上——扫描器的正则只认 SCREAMING_SNAKE 形态的键名。

3. **17 条"未声明占位符"里有 15 条是我的正则假阳性**。第一版 `/tmp/arg-resolve.mjs` 报 17 条"运行时使用但未声明"，**其中 15 条错**：`{2}` `{3}` `{4}` `{30}` `{32}` `{6}` 全是**正则量词**（`\d{4}`、`\w{32}`、`[A-Z]{2}`、`(…){3}`），`Kelee/TelegramRedirect.plugin:10` 的 `{url}` `{app}` 是 `request if ${url} ~= /…/ then redirect(307, "${app}://…")` 里的 **JS 模板字面量**。修正版（排除纯数字 + `${…}`）把该类别收敛到 **2 条真缺陷**，即 `MOD-01`。

> 这三处更正的意义：**"死开关 12 个"这个数字里，8 个是我的误报**；真正的惰性开关是 **7 个**（`bank` 4 + `bilibili-pro` 1 + `wechat-pro` 2），另加 39 个"声明零引用"的参数（见 `MOD-05`）。若不做这轮对抗性复核，报告会把 8 个正确实现列为缺陷，同时**漏掉** `MOD-01` 这个真正的 P1。

---

## 7. 附录：复现命令

> 本轮的三个分析脚本（`arg-resolve2.mjs` / `mirror-drift.mjs` / `rule-redundancy.mjs`）**为临时探针，未入库**。核心逻辑已在 §5 描述，可直接重建；下表给出**不依赖探针、可长期重放**的等价命令。

**M3 契约断链（`MOD-01` / `MOD-02` / `MOD-03`）**

```bash
# 脚本期望的参数键（全仓库仅 3 处）
grep -rn '\$argument' src/*.ts

# 插件实际传入的参数值
grep -rhoE 'argument=[^,]*' Plugin/*.plugin | sort -u

# _CRON_EXP 的「声明 vs 使用」配对矩阵（MOD-01 的直接证据）
for f in Plugin/*.plugin; do
  grep -qF CRON_EXP "$f" || continue
  printf "%-28s 声明=%s cron=%s\n" "$(basename "$f" .plugin)" \
    "$(awk '/^\[Argument\]/{f=1;next} /^\[/{f=0} f' "$f" | grep -cF CRON_EXP)" \
    "$(grep -cE '^cron .*\{[A-Z_]*CRON' "$f")"
done
```

**M2 惰性 UI（`MOD-04` / `MOD-05` / `MOD-07`）**

```bash
# bank.plugin 的 4 个开关是否真的零引用
for k in UNIONPAY_ENABLE BOCOM_ENABLE ABC_ENABLE BOC_ENABLE; do
  printf "%-18s → %s 次\n" "$k" "$(grep -rcF "$k" Plugin/ Scripts/ src/ template/ | awk -F: '{s+=$2} END{print s+0}')"
done

# 数字开头的参数名（生成器无守卫）
grep -n '^[0-9][A-Za-z0-9_]*=' Plugin/*.plugin

# TIMEOUT 是否被占位引用（0 = 全部硬编码 timeout=N，即惰性）
grep -c 'timeout={' Plugin/*-pro.plugin
```

**M6 镜像漂移（`MOD-09`）**

```bash
# 工作流声明了哪些 URL，清单记录了什么
grep -oE 'mirror +"[^"]+" +"[^"]+"' .github/workflows/mirror-scripts.yml
node -e 'const m=require("./Mirror/MANIFEST.json");
  for(const [k,v] of Object.entries(m.files||{})) console.log(k, v.source_url||"");'
# 清单内是否存在 latest（0 = 漂移全在工作流侧）
grep -c '"latest"' Mirror/MANIFEST.json
```

**M5 规则一致性（`MOD-10`）**

```bash
node test/rule-order-check.js
npm run check:orphan && npm run check:sync && npm run check:plugin
```

**官方语义依据（`MOD-01` / `MOD-06`）**

- <https://nsloon.app/docs/Plugin/> → `[Argument]` 是唯一声明机制；`#!` 字段表穷举且不含 `arguments-desc`；**"如果表达式格式无效，Cron 脚本不会执行"**
- <https://nsloon.app/docs/Rewrite/rewrite_v2> → Rewrite 内引用插件参数用 `${name}`（仓库实测零处值替换，仅用 `enable={X}` 门控，无冲突）

---

## 8. 一句话总结

按模块切轴后，**问题从"代码写得好不好"变成了"链路通不通"**：M5 规则层、M7 构建层、M4 上游层三个模块经实测健康；真正的缺陷集中在**跨模块契约**（M3，3 项 P1——定时任务不执行、debug 分支不可达、参数传递空转）、**镜像静默陈旧**（M6/M10，7 条 URL 漂移 + 文档陈述失准）与**惰性 UI 堆积**（M2，46 个零引用参数）。三类问题**全部落在现有门禁视野之外**，且都是可机械判定的——这既是本轮的主要结论，也是建议新增 `tools/argument-contract-check.mjs` 的直接依据。
