# 单 App 接入标准（Loon 插件 / 脚本）

> 逐个 App 接入时照此执行。每一步都给出**判据**与**取证方法**，不允许"看名字猜"。
> 依据：`https://nsloon.app/docs/`（Loon 3.5.1 官方文档，本文末列出引用页）。
> 已有落地样例见 `Plugin/qidian.plugin`。

---

## 0. 前置：先决定这个 App 属于哪个模块

对照 [`MODULE-MANIFEST.json`](MODULE-MANIFEST.json)：

| 模块 | 职责 | 介入层 |
|---|---|---|
| M2 广告治理 | 拦广告 | L2 + L4 + L5 |
| M7 功能增强 | VIP/画质/签到/去水印/领券 | L4 + L5 |
| M3 隐私 | 追踪/统计 SDK 与 DNS 泄漏 | L2 |
| M4 银行支付 | 免解密 + 免广告 | L2 + L6 |

**一个插件只允许一个主责模块**（门禁强制）。跨模块的次要职责用 `also_members` 挂在**次要责任方**。

判断顺序：先问「它拦的是什么」→ 再问「它改的是什么」。拦广告的规则即使带 `enable` 开关也归 M2。

---

## 1. 取证（**不可跳过**）

没有 HAR 就不写规则。本仓已犯过的错：京东 `du.jd.com`/`c-nfa.jd.com` 凭「广告域」命名加 REJECT，实为**店铺域**（302 → `error2.aspx?from=shopdomain`），误拦直接破店铺页；`jzt.jd.com` 是对外 Jenkins CI。

| 取证项 | 方法 | 判据 |
|---|---|---|
| 接口清单 | 抓包导出 HAR，筛出该 App 的请求 | 每个候选接口记录：URL、method、响应 Content-Type、响应体形状（JSON/图片/视频/空） |
| 域名角色 | 每个域标注：业务 / 广告 / 统计上报 / 推送 | **推送域必须保留**（拦了断推送） |
| 功能依赖 | 对每个"想拦"的域问：拦了 App 哪项功能坏掉？ | 答不出 → 不拦 |
| 广告与业务同响应？ | 看响应体里广告字段与业务字段是否共存 | 共存 → **不能整条 reject**，须字段级净化或字段重命名 |

**产出**：一张表（域 / 路径 / 角色 / 响应形状 / 处置方式 / 取证来源）。这张表进 `test/cases/<app>.test.js` 作台账。

---

## 2. 选处置方式（对应 L2/L4/L5）

| 处置 | 层 | 语法 | 适用前提 |
|---|---|---|---|
| DNS 整域拒 | L2 | `[Rule] DOMAIN(-SUFFIX), x, REJECT` | 广告域与业务域**不同 host** |
| 整条 reject | L4 | `[Rewrite] ^url reject-dict` 等 | **纯**广告接口，丢整个响应可接受 |
| 字段删除 | L4 | `response-body-json-del Data.X` | 广告字段与业务同响应 |
| 字段重命名 | L4 | `response-body-replace-regex` | 同上，且客户端认 key，改名即消失 |
| 字段级净化 | L5 | `[Script] http-response` | 广告内嵌在业务数据里，需 JS 逻辑 |
| 域名专属拦截 | L2 | `AND,((USER-AGENT,AppUA*),(DOMAIN-KEYWORD,x)),REJECT` | 该域被多个 App 共用 |

**反模式（会破功能）**：
- 整条 reject 一个「既下发业务数据又下发广告」的接口 → 白屏。京东 `functionId=start` 是样板。
- 拦推送域 → 断推送（`config.jpush.cn` / `api.getui.com` 须保留）。
- 用 `DOMAIN-KEYWORD` 拦共享域 → 误伤其他 App。官方点名该类型耗时随数量线性增长。

---

## 3. 解密面（`[MitM]`）——最小化

**每个正条目都必须有规则消费它**，否则是证书暴露面。

```
[每个 host 都要能回答: 哪条 [Rewrite] 或 [Script] 规则消费了我?]
```

通配 host（`p1.*.example.com`）会让 `mitm-coverage` 门禁判为 generic 而恒报孤儿 → **必须显式列举**。

**与主配置交叉检查**（关键，起点插件就踩了这坑）：

> 本地配置优先级 **>** 插件。主配置 `domain-reject-mode = DNS` 时，域名在 DNS 阶段即被拒，**到不了解密层**。
> 所以：主配置已全链 REJECT 的域，插件里为它写 `[Script]`/`[Rewrite]` 是**空转**。
> 这类 host 不应进 `[MitM]`。

---

## 4. 语法版本对齐

| 能力 | 最低版本 |
|---|---|
| 旧 Script 语法（`http-response ^x script-path=…`） | 仍受支持 |
| 旧 Rewrite 语法（`^x action`，空格分隔，`\x20` 转义） | 仍受支持 |
| **新** Rewrite 语法（`<phase> if <cond> then <action>`） | 3.5.1 (978) |
| **新** Script 语法（`request if <cond> then script(…) with …`） | 3.5.1 (983) |
| 逻辑规则 `AND`/`OR`/`NOT`、`PROTOCOL`、`SRC-PORT` | 3.1.7 |
| `hijack-dns` | 3.2.5 (789) |
| `geoip-url` / `ipasn-url` | 3.2.3 (754) |
| `domain-reject-mode` / `dns-reject-mode` / `udp-fallback-mode` | 3.2.0 (702) |
| `hijack-dns` 之外：插件 `#!type = parser` | 3.5.0 (969) |

**新语法换来什么**（决定是否值得迁移）：

| 能力 | 新语法写法 | 旧语法做不到 |
|---|---|---|
| 条件组合 | `${response.status} == 200 && ${url} ~= /x/` | 只能靠一条大正则 |
| JSON 操作 | `response.json.delete(["a.b","c.d"])` 批量数组 | 一次只能一个 key |
| jq 表达式 | `response.json.jq("del(.data.ads)")` | 无 |
| 正则命名捕获 | `as item` → `${item.1}` | `$1` 只能在 Action 内 |
| 插件参数 | `${enabled}` 直接进条件 | 只能进 `argument` |
| 空格 | 不需 `\x20` | 需转义 |
| 配置校验 | 加载时检查类型/数量/捕获组 | 静默失败 |

**迁移判据**：不按条数卡，按**是否吃新语法红利**判断——出现下列任一即值得迁：① 同一条要改多个 JSON key（批量数组）；② 条件要组合插件参数（`${sw} == true && ${url} ~= …`）；③ 条件依赖 `${response.status}` / Header；④ 靠一条巨型正则硬凑多个接口。纯「单接口 + 单动作」的老规则不值得动。

### 4.0 迁移前必读：四个会把规则**改坏**的坑

2026-09-29 迁移起点 13 条 Rewrite 时全部踩到，且其中三个**能被现有门禁全绿放过**（门禁当时看不懂新语法）：

| 坑 | 错误写法 | 正确写法 | 依据 |
|---|---|---|---|
| **批量数组是平行数组**，不是扁平单数组 | `json.replace(["k1",v1,"k2",v2])` | `json.replace(["k1","k2"],[v1,v2])` | 《批量数组参数》规则 2：各参数数组等长、按下标配对；规则 1 禁止单值与数组混用。扁平单数组会被**加载期拒绝** |
| **JSON 值不含数组/对象** | `json.replace("Data.Items", [])` | `json.jq(".Data.Items = []")` | 《JSON》段：值只支持 String/Number/Boolean/null/变量。置空数组只能用 `jq` |
| **正则必须原样搬运** | 把 `\/` 还原成 `/` | `\/` 保持转义 | 正则字面量里 `/` 必须转义，还原会让正则**提前终止**。只剥行首 `^`，不动内部转义 |
| **`enable={X}` 逐条都要翻译** | 只给部分规则加条件 | 每条都写 `${X} == true && …` | 漏一条 = 该条开关**永久打开**。`switch` 参数在条件中按 Boolean 比较 |

另两条硬约束：

- **新旧语法可混用**：官方《新旧语法》明确「旧语法仍然兼容，可以与新语法混用」，解析后进入同一执行序列、**按配置顺序**处理，不因新旧改变优先级。⇒ 可以只迁 `[Rewrite]` 而把 `[Script]` 留在旧语法。
- **`[Script]` 迁移要额外取证**：旧语法 `argument=[{A},{B}]` 是**数组**语义，新语法对象参数让 `$argument` 变成 **Object**。插件脚本若无源码（手工轨），**无法确认它读的是数组还是对象** ⇒ 这种情况下不迁 `[Script]`，只迁 `[Rewrite]`。

### 4.1 同 URL 上 Script 与 Body Rewrite **互斥**（迁移/加规则时必查）

官方《Script 新语法 · Rewrite 与 Script》：「Response Body Rewrite 命中时，Response Script 不执行」。

⇒ 同一个 URL 上同时挂 `[Script]` 与响应体改写 Rewrite 时，**Rewrite 命中即吃掉 Script**。加规则前先查是否与既有 Rewrite 撞 URL；撞了要么把 Regex 拆成互斥路径，要么接受「Script 只在未命中 Rewrite 的那条分支上存活」。起点插件的 `getconf` 就是这个形态（见附二待验证项）。

### 4.2 迁移后的自检（缺一即假绿）

迁移后**必须**确认解析器看得见新规则，否则所有基于规则的检查会整段跳过：

- `mitm-coverage` / `mitm-orphan` / `rewrite-redundancy` 三个解析器都要认识新形态。
- 两个检查里存在 `if (!rules.length) continue` 逃逸口：**门禁越是解析不了，报得越干净**。已加对账用例（`[Rewrite]` 实质行数 == 解析出规则数）把失明变判红。
- 逐条对账：路径特征、开关条件覆盖数、动作类型集合三项都与迁移前一致。

---

## 5. 参数契约

`[Argument]` 声明的每个参数**必须有规则消费**，否则是「拨了没反应」的假开关（`app-index` 门禁的 `fake_granularity` 判红）。

```
CAPTURE_ENABLE = switch,true,tag=…      ← 声明
response … enable={CAPTURE_ENABLE}        ← 消费
```

| 控件 | 语法 | 注意 |
|---|---|---|
| 开关 | `switch,true,tag=…` | 只能 `enable={X}`，不能进条件表达式之外的地方 |
| 下拉 | `select,"A","B",tag=…` | 首项为默认；`type=number` 才能当数字用 |
| 文本 | `input,"default",tag=…` | 同上 |
| Cron | `input,"11 2 * * *"` | 可直接写 `cron {CRONEXP}` |

**插件脚本对象参数**（新语法才有）：`script("x.js", {${a}, ${b}})` → 脚本内 `$argument` 是 Object。旧语法用 `argument=[{a},{b}]` 传字符串。

---

## 6. 跨层矛盾自查（**最易漏**）

插件的每条规则都要问：**它在主配置的语境下真的生效吗？**

```
官方《规则系统 3.1 匹配优先级》:
  1. 目标为域名时, 先匹配域名规则
  2. 域名规则未命中时, 再解析 DNS 并匹配 IP 规则
  3. 其他规则按配置顺序
  4. 来源优先级: 本地配置 > 插件 > 订阅
  5. 全部未命中 → FINAL
```

| 症状 | 根因 | 处置 |
|---|---|---|
| 插件 `[Rule]` 写了 DIRECT，主配置同域是 REJECT | 来源优先级 4：本地 > 插件 | 注释登记矛盾，**不要静默删**；让用户决定改哪边 |
| 插件 `[Script]` 引用某 host，但主配置 REJECT 了它 | `domain-reject-mode = DNS`，域在 DNS 阶段被拒 | 从 `[MitM]` 移除该 host |
| 规则被同文件更早的规则罩住 | 域名类首次命中即停 | 精确实例在前，后缀在后 |
| 裸 `REJECT` 感觉"不生效" | DNS 阶段返回回环 IP，请求到不了 HTTP 层 | 这是**正常**的，见第 7 节 |

---

## 7. REJECT 变体：先确认**需不需要**

官方策略层共 5 种：`REJECT`(404 空体) / `REJECT-IMG`(200 + 1×1 GIF) / `REJECT-DICT`(200 + `{}`) / `REJECT-ARRAY`(200 + `[]`) / `REJECT-DROP`(丢包)。

**三个描述 HTTP 响应内容的变体（`-IMG`/`-DICT`/`-ARRAY`）只在这两个条件同时成立时才有意义**：

1. 拒绝发生在**请求转发阶段**（即 `domain-reject-mode = Request`，或用 `URL-REGEX`/`USER-AGENT` 做 HTTP 级拦截）；
2. 客户端**真的收到**一个 HTTP 响应。

若 `domain-reject-mode = DNS`（本仓库当前值）且没有 `URL-REGEX`/`USER-AGENT` 规则 → **裸 `REJECT` 行为等价**，不要为了"用全变体"而改。

`REJECT-DROP` 慎用：官方明示"部分应用会在连接失败后立即重试"。

---

## 8. 收尾门禁（全部已接线，改完必跑）

| 命令 | 守住什么 |
|---|---|
| `npm test` | 行为回归 + 规则顺序 + 接线 + 文档数字反算 |
| `npm run check:all` | 9 项：模板同步 / Rewrite 冗余 / 源码反模式 / 解密面孤儿 / 插件语法 / 参数契约 / workflow bash / 产物漂移 / App 索引 |
| `npm run lint` | ESLint |
| `node tools/app-index.mjs` | 重新生成 `APP-INDEX.json`（由插件本体抽取，勿手改） |

新增资源后同步：`MODULE-MANIFEST.json`（归类）、`test/cases/<app>.test.js`（台账 + 行为断言）。

---

## 9. 官方文档引用页

| 主题 | URL |
|---|---|
| 插件 | `https://nsloon.app/docs/Plugin/` |
| Script 旧语法 | `https://nsloon.app/docs/Script/` |
| Script 新语法 | `https://nsloon.app/docs/Script/script_v2` |
| Script API | `https://nsloon.app/docs/Script/script_api` |
| Rewrite 旧语法 | `https://nsloon.app/docs/Rewrite/` |
| Rewrite 新语法 | `https://nsloon.app/docs/Rewrite/rewrite_v2` |
| 规则系统 | `https://nsloon.app/docs/Rule/` |
| 策略 / 策略组 | `https://nsloon.app/docs/Policy/` · `/Policy/policygroup` |
| 通用配置 | `https://nsloon.app/docs/General/` |
| DNS / DNS 映射 | `https://nsloon.app/docs/DNS/` · `/DNS/hostmap` |
| MitM | `https://nsloon.app/docs/Mitm/` |
| 订阅规则性能 | `https://nsloon.app/docs/Rule/sub_rule` |

---

## 附：起点插件的实际审计结论（作为对照样例）

按上述标准审计 `Plugin/qidian.plugin`，得到 3 条发现：

1. **B7 层间矛盾注释由绝对结论改为逐条实证** —— 注释原称 4 条 `DIRECT` 白名单「永不生效」。逐条核对：

   | # | 插件规则 | 主配置覆盖 | 实际 |
   |---|---|---|---|
   | ① | `DOMAIN, ii.gdt.qq.com, DIRECT` | `DOMAIN` REJECT | **不生效** |
   | ② | `DOMAIN, adsmind.gdtimg.com, DIRECT` | `DOMAIN` REJECT | **不生效** |
   | ③ | `DOMAIN-SUFFIX, pangolin-sdk-toutiao.com, DIRECT` | `DOMAIN-SUFFIX` REJECT | **不生效** |
   | ④ | `DOMAIN-SUFFIX, pangolin-sdk-toutiao1.com, DIRECT` | 仅 `DOMAIN, api-access.pangolin-sdk-toutiao1.com` 精确 REJECT | **部分生效** |

   第 ④ 条是关键：主配置只有 `api-access.` 那一个子域被精确 REJECT，**裸域与 `log-api.`/`gromore.` 等其他子域未被覆盖**。且 `.com1` 是独立域，不被 `DOMAIN-SUFFIX, pangolin-sdk-toutiao.com` 罩住（`zijieapi.com` 段相同但域段多一个 `1`）。故准确说法是「部分生效」而非「完全生效」。

2. **7 个解密面 host 无消费（已于 2026-09-29 收窄，非 8）** —— `ii.gdt.qq.com` / `adsmind.gdtimg.com` / `adsmind.ugdtimg.com` / `pgdt.gtimg.cn` / `api-access.pangolin-sdk-toutiao.com` / `api-access.pangolin-sdk-toutiao1.com` / `ywab.reader.qq.com` 在主配置被 `REJECT`，而 `domain-reject-mode = DNS` 下域在 DNS 阶段即被拒，插件 `[Script]` 对它们的消费是空转。

   **处置**：插件 `[MitM]` 9 → 2、模板 `[MitM]` 7 → 2，只留 `h5.if.qidian.com` / `magev6.if.qidian.com`（这两个是起点 App 真实接口）。连带删除 4 条只服务这 7 个域的 `[Script]`（`ii.gdt` / 穿山甲 ×2 / `adsmind`+`pgdt` 视频）—— 域到不了解密层，脚本永不触发。**注意计数纠错**：口头一直是"8 条"，实际是 7 个 host。

   **既有 `mitm-coverage` 门禁判不出这类** —— 它只检查「插件 `[MitM]` ∪ 主配置正条目是否被某条规则引用」，不判「该域是否早已被 REJECT 拦在 DNS 阶段之前」。已补进 `plugin-lint-check`（见下）。

3. **语法门槛落后（已于 2026-09-29 迁移）** —— 原 `#!loon_version = 3.2.4(787)`、17 条 Rewrite 全用旧语法，现已迁到 **3.5.1(978)** 新语法、13 条。`[Script]` 6 条**有意保留旧语法**（理由见 4.1 与遗留待验证项）。

## 附二：全网对标（起点 × app2smile/rules，2026-09-29）

作为「该拿上游做什么」的标准样例 —— 对标对象：[`app2smile/rules/plugin/qidian.plugin`](https://github.com/app2smile/rules)。该插件 12 行 + 147 行 JS，覆盖 7 个处置点。

| 上游处置点 | 上游动作 | 本仓 |
|---|---|---|
| `getsplashscreen` | `Data.List=null`、`EnableGDT=0` | ✅ 已覆盖 |
| `deeplink/geturl` | `Data.ActionUrl=''` | ✅ 已覆盖 |
| `adv/getadvlistbatch?positions=iOS_tab` | `Data.iOS_tab=[]` | ✅ 已覆盖（本仓整包 Script 净化，更宽） |
| `dailyrecommend` | `Data.Items=[]` | ✅ 已覆盖 |
| `bookshelf/getHoverAdv` | `Data.ItemList=[]` | ✅ 已覆盖 |
| `getconf` | `ActivityPopup=null`、`WolfEye=0`、`TeenShowFreq='0'`、`ActivityIcon` 清零 | ✅ 已覆盖 |
| `getconf` | `EnableSearchUser='1'`（功能增强） | ❌ 缺 → **本轮已补** |

**本仓覆盖面远超上游**：另有 15 个上游未拦的处置点（`getTopOperation` / `playstrip` / `mainPageDialog` / `reportDialog` / `bookshelfbtn` / `freshmanGuidePopup` / `showChapterEndModule` / `readpage` / `getclassicbookinfo` / `batchget` / `getdot` / `pullOperationPush` / `pullSocialPush` / `iosad` / `popgetdialog`）。

### 对标抓出的真问题：3 处**过度拦截**

上游对以下三处**均未拦**，且上游的 `EnableSearchUser` 意图明确是**增强搜索** —— 而本仓恰好打断了搜索：

| 接口 | 本仓动作 | 后果 |
|---|---|---|
| `booksearch/hotWords` | `reject-dict` 整包 | 搜索联想全没 —— 与上游增强搜索的意图**直接冲突** |
| `user/getaccountpage` | `json-del Data.BenefitButtonList` | 「我的」页福利/会员入口消失 |
| `message/getpushedmessagelist` | `reject-dict` 整包 | 站内消息看不到 |

**判定依据不是"上游没拦所以该放行"**，而是：官方《Script v2》明确「Response Body Rewrite 命中时，Response Script 不执行」——这三处的最终行为完全由 `[Rewrite]` 决定，与脚本无关，不可兼得。且三者都是**功能**而非广告。上游对 `getconf` 的处理方式是「只删广告字段、不动功能字段」（`ActivityPopup` 删而 `EnableSearchUser` 改），这正是本仓应对齐的处置粒度。

经用户决策，**三处已恢复**（`[Rewrite]` 规则删除 + `[Script]` 大正则分支移除），保留其余 15 个去广告处置。

### 遗留待验证项

`getconf` 三处赋值（`WolfEye=0` / `TeenShowFreq=0` / `EnableSearchUser=1`）本仓写**裸值 Number**，上游脚本写**字符串** `"1"`/`"0"`。官方《Rewrite 新语法》允许 String 与 Number，语法上都合法，但若 App 端按 `=== "1"` 严格比较字符串则 Number 不生效。三条长期在工作 ⇒ 或 App 端容忍 Number，或该字段本就是 Number。**未经真机验证不改类型**，已在插件内登记。

`getconf` 上 `[Script]` 与响应体改写 Rewrite **并存**：官方《Script 新语法》「Response Body Rewrite 命中时，Response Script 不执行」，而两条 Rewrite 的 Regex 只覆盖 `magev6`、Script 覆盖 `h5|magev6`。⇒ 该 Script 目前**只在未命中 Rewrite 的 h5 侧存活**，magev6 侧被抑制。这解释了"改了 Script 却看不出变化"的一类现象；是否真要保留双通道，待真机确认后再动，不静默删。

**决策 2（对抗研判后定为不动）—— `getconf` 的 Script/Rewrite 互斥**：`getconf` 上两条 Rewrite 的 Regex 只覆盖 `magev6`、Script 覆盖 `h5|magev6`，按「Response Body Rewrite 命中时 Response Script 不执行」，该 Script 目前**只在 h5 侧存活**。收窄成 h5-only 收益仅是"清晰"，代价是**若抑制模型判断有误就打断 Cookie 捕获** —— 收益对称、代价不对称，故不改，只登记现状。待真机确认哪一侧出 Cookie 后再定。

**决策 3（定为不改类型）—— `WolfEye` / `TeenShowFreq` / `EnableSearchUser` 保持裸值 Number**：这三个值是**已上线存量**，本次迁移只做语法等价、值 token 原样保留（`0/0/1`）。照上游 `"1"` 风格改类型属猜测，AGENTS.md 明令未经真机不改类型，故保留。

`[Script]` 段**有意不迁**新语法（2026-09-29 定）：官方映射 `argument={A,B}` → `script(path, {${A}, ${B}})` 会把 `$argument` 从数组/字符串变成 **Object**；`Scripts/Qidian.js` 是 608KB 手工轨、无源码，无法确认它读的是哪种结构。官方同时明确「新旧语法可混用、进入同一执行序列并按配置顺序处理」，故只迁 `[Rewrite]`、`#!loon_version` 提到 3.5.1(978) 即可覆盖本次红利。⇒ 前提是脚本无源码时，**不迁 `[Script]`**。

---

## 附三：京东 App 的研判结论 —— 作为「何时该停手」的对照样例（2026-09-29）

京东是本仓的**反面教材来源**（`du.jd.com`/`c-nfa.jd.com` 凭「广告域」命名加 REJECT，实为店铺域；`functionId=start` 整条 reject 致白屏）。本轮按本标准对抗研判后，结论是**维持现状、不加广告治理**：

**现状**：京东只有 5 条功能域 `DIRECT`（`kepler` / `keplerapi` / `mapi.m` / `policy` + 友盟 `msg.umengcloud`），**无 MitM、无脚本、无字段改写、无任何 jd REJECT**。

**⚠️ 本节结论已于同日修正**：初判"无治理是正确基线"**不完整**——它漏了"全网已有成熟公开实现"这一取证路径。补搜上游后结论改为：**京东去广告有成熟实现可落地，但必须字段级**（详见下）。

**为什么不凭空加治理**（仍成立的纪律）：
- 广告治理的前提是「先有解密面 + HAR 取证接口结构」。京东当前**没有任何解密面**，凭空加 `REJECT` 就是本仓已犯过的 `du.jd.com` 错。
- 凭域名字义判断「这域像广告」不可取证。`jzt.jd.com` 看着像广告实为对外 Jenkins CI；`du.jd.com` 看着像短链实为店铺域。**每次新增京东 REJECT 都必须先 DoH 双解析器 + HTTPS 探针**。

**本轮做的取证**（DoH Cloudflare + DNS.google 双解析器 + HTTPS 探针，复核历史结论仍成立）：
- 4 个功能域全部存活：`kepler.jd.com` 302 / `keplerapi.jd.com` 302 / `mapi.m.jd.com` 403 / `policy.jd.com` 404（403/404 = 服务端在，非死域）。
- 历史教训复核：`du.jd.com`、`c-nfa.jd.com` 仍 302 → `www.jd.com/error2.aspx?from=shopdomain`（**店铺域结论至今有效，勿加 REJECT**）；`jzt.jd.com` 301（对外 CI，仍非广告）。

**唯一改动**：5 条 DIRECT 的注释——原注释称「修正远端广告列表过粗 KEYWORD 的功能性误杀」，但本仓已移除 12 万条广告域名表 + 7 个镜像列表、长尾广告域一律走 `Final`，**「防误杀」成因已消失**。它们现在的角色是**主动声明走直连的功能域锚点**，不是被动防误杀。保留（不与任何 REJECT 冲突、不产生解密面、风险极低，且是将来 jd REJECT 重引入时的第一道防线），只把注释改成反映新成因。

### 附三·补：全网已有成熟实现（推翻"要 HAR 才能做"的默认假设）

初判时我以"缺 HAR ⇒ 无法取证"为由建议停手，**这是错的**——HAR 只是取证手段之一，上游仓库已含可直接交叉验证的接口与字段。三源交叉验证：

| 接口 | fmz200/wool_scripts | zqzess | 研判 |
|---|---|---|---|
| `api.m.jd.com?functionId=start` | `obj.images=[]` 字段级 | `reject-array` **整条拒** | 前者✅ / 后者❌ 白屏 |
| `?functionId=welcomeHome` | `floorList` filter 删 6 类推广层 | — | ✅ 字段级 |
| `?functionId=lite_advertising` | 字段重命名 `jdLiteAdvertisingVO→fmz200` | — | ✅ 抗异常分支 |
| `?functionId=myOrderInfo` | `floors` filter | — | ✅ 字段级 |
| `?functionId=deliverLayer` / `orderTrackBusiness` | 删 `bannerInfo` + 过滤运费八折 | — | ✅ 字段级 |
| `?functionId=getTabHomeInfo` | 删 `iconInfo` / `roofTop` | — | ✅ 字段级 |

**这条交叉验证同时实证了本仓的 `functionId=start` 白屏教训**：zqzess 用 `reject-array` 整条拒该接口，正是 AGENTS.md 记的"既下发业务数据又下发广告不能整条拒"；fmz200 用 `obj.images=[]` 才是正解。**两个独立上游在同一接口上分叉，且分叉方向与本仓教训完全一致——这是比单方文档更强的证据。**

**修正后的落地方案**（不再是"停手"）：以 `fmz200/wool_scripts/Scripts/jingdong/jingdong.js` 为准建京东插件，解密面只需 `api.m.jd.com`。三条纪律必须遵守：① 一律字段级 `delete`/`filter`，不整条 reject；② 走 `src/*.ts` + esbuild 构建（`Scripts/Qidian.js` 那种手工轨不可复制）；③ 每个 `functionId` 独立取证，不因同域批量照搬。

### 附三·补二：起点三源研判补齐 3 个广告面 + 经典广告平台覆盖（2026-09-29）

**起点**（app2smile × fmz200 × zqzess 交叉）本仓此前缺失、本次补齐：`deeplink/geturl`（冷启动强制跳精选页，`ActionUrl=''`）、`adv/getadvlistbatch?positions=iOS_tab`（发现页活动 tab）、`bookshelf/getHoverAdv`（书架悬浮广告，`ItemList=[]`）。三源处置口径一致，**全部字段改值无一条整条 reject**；探针 4 接口均返 `Result:-3 设备信息错误`（路由通、缺设备头）⇒ 端点真实存在。

**本次三个"没有照抄上游"的判断**（都比照抄更值）：
1. **不加 `mage.if.qidian.com` 解密面** —— 探针 200 存活、但 fmz200 走 `Atom.axd` 旧路径而 app2smile（更新）只用 `magev6`。两源分歧时取**更新且更保守**的一方；解密面是 CA 信任资产，不为"能拦到"而扩大。
2. **撤销照搬的 `qidian.qpic.cn` reject-img** —— 主配置已有 `DOMAIN-SUFFIX, qpic.cn, DIRECT`（图片 CDN，归在微信白名单组），request 阶段拦截发生在路由之后 ⇒ 规则本就抓不到；且 qpic 是书封面图床，改 REJECT 会伤正常素材。**上游的单域动作不能脱离本仓分层照搬** —— 同一域在本仓可能已承担别的职责，跨层矛盾优先于上游一致性。
3. **不臆造字段名** —— 合并 `v1/adv/` 宽规则时曾顺手写 `Data.adList`/`Data.ads`，无 HAR 无上游依据，属猜测，已撤。宁可少清一个字段，不留猜出来的名字。

**经典广告平台**（候选 24 缺口域 → 实加 7 条）：探针后**明确排除 7 个平台主域**（`kuaishou`/`snssdk`/`e.qq`/`gdt.qq`/`union.baidu`/`miui`/`ads.union.jd`）—— 整域拦会破 App 功能，只拦已取证的广告子域；另 7 个已死域（CF 解析 0 条）不占资源不拦。只加 3 条纯广告联盟 SDK（`tradplusad`/`anythinktech`/`gromore`）+ 4 条广告 API（`ad.qq`/`cpro`/`pos`/`cpu-openapi`）。全部走 DNS 阶段 REJECT，**零证书成本**。

## 附四：广告平台去广告插件（2026-09-29，全网平台研判）

**设计前提**（决定了整套形态）：本仓 `domain-reject-mode = DNS` ⇒ 域名拒绝在 DNS 阶段用回环地址完成，请求到不了 HTTP 响应层。⇒ 广告平台拦截**一律 L2 纯 `[Rule] REJECT`、无 `[MitM]`、零 CA 证书成本**。官方《策略》的 REJECT-IMG/DICT/ARRAY 等变体描述的都是 HTTP 响应内容，在 DNS 拒绝场景下**不适用**。

**为什么拆成 6 个独立插件、而不是一个带开关的大插件**：官方《插件》明确策略位只有 `DIRECT`/`REJECT 系列`/`PROXY`，插件参数只作用于 `Script`(`enable={}`) 与 `Rewrite`(`${}`) —— **普通 `[Rule]` 行挂不了条件**。在一个纯 REJECT 插件里声明 6 个 switch 会得到 6 个**死参数**，误导用户以为能开关。拆成独立插件、**启停插件即按平台开关**，是 Loon 原生且无死参数的做法。

| 插件 | 平台 | 域数 | 明确排除（拦了会破功能） |
|---|---|---|---|
| `ad-pangolin.plugin` | 穿山甲/字节 | 17 | aweme 内容流 / video-cn 视频CDN / temai 电商 / tnc3 内容 / bytescm 通用CDN / gecko-pangle 落地页 |
| `ad-gdt.plugin` | 广点通/腾讯广告 | 8 | `e.qq.com` 父域（企微/公众号）/ trace·btrace·imgcache（全站埋点非广告专有） |
| `ad-kuaishou.plugin` | 快手联盟 | 7 | `kuaishou.com` 主域（短视频本体）/`e.kuaishou.com` 主域级电商 |
| `ad-baidu.plugin` | 百度联盟 | 2 | `union.baidu.com` 主站（含落地页） |
| `ad-google.plugin` | Google/AdMob | 1 | `doubleclick.net`/`googlesyndication.com` 主配置已有 SUFFIX 覆盖，不重复 |
| `ad-intl.plugin` | 国际聚合 | 3 | Sigmob/TradPlus/AnyThink 已部分被主配置 SUFFIX 覆盖，只留未覆盖的 |

**筛选漏斗**（101 候选 → 38 实装，每一步都有门禁或探针支撑）：
1. 从两份上游规则提取广告平台域 → 101 个活域候选
2. DoH(Cloudflare + DNS.google) 探针 → 剔除 15 个已死域（解析 0 条，不占资源）
3. 跨层核对 → 剔除 17 个主配置已覆盖的域
4. 语义排除内容本体域 → 上表的"明确排除"列
5. `plugin-tpl-shadow` 门禁**当场抓到 10 条子域被主配置 SUFFIX 遮蔽**（`doubleclick.net` / `googlesyndication.com` 等）—— 我的初始"已覆盖"检测只比对精确 `DOMAIN`，**漏判 SUFFIX 覆盖**，是门禁替我补上的。

**新增门禁**（`test/cases/ad-platform-plugins.test.js`，6 例）锁死三条属性：① 零 `[MitM]`（拦广告不得产生证书成本）；② 全部规则裸 `DOMAIN REJECT`、无 `DIRECT`/`Proxy` 例外（广告域出现例外即说明有人凭域名字义误判）；③ **不得声明 `[Argument]`**（纯 `[Rule]` 插件挂不了条件，声明即死参数）。

## 附五：探针与隐私上报拦截（M3 隐私，2026-09-29）

从**产品开发者视角**反推：App 出厂时会埋哪些上报通道、每个通道拦了会破什么。据此建 6 个独立插件（38 域），全部 L2 域名 REJECT、零证书成本。

| 插件 | 通道 | 域数 | 明确不拦（拦了=真损失） |
|---|---|---|---|
| `probe-umeng` | 友盟+ 统计/崩溃 | 15 | `config./user./msg.` 与 jpush/getui 推送 |
| `probe-oem` | 小米/vivo/OPPO/魅族 自有遥测 | 12 | 商店(`ad.apk.vivo`)、推送(`xmpush`)、系统设置(`bss·de·dvb·jellyfish`) |
| `probe-webtrack` | GrowingIO/神策/网易易盾 RUM | 7 | — |
| `probe-bugly` | 腾讯 Bugly 崩溃 | 2 | jpush 推送 |
| `probe-arms` | 阿里云 ARMS 前端 RUM | 1 | `arms.console.aliyun.com`（开发者自用控制台）、`oss`（可能承载内容） |
| `probe-firebase` | Crashlytics/Segment 增量 | 1 | `firebaseinstallations`（FCM 推送，主配置已保留） |

**开发者视角的三档代价**（决定拦不拦）：① 纯统计埋点 —— 拦了无功能损失，**最安全**；② 崩溃/APM —— 拦了不破功能，但**丢失调试可见性**（排障变难），由插件可关停来平衡；③ 推送/归因 —— 推送**绝对不拦**（断推送是真功能损失），归因只影响安装统计。

**三个探针实证纠正了我写错的判断**（都靠 DoH 拦下）：
- `arms.console.aliyun.com` 我原以为该拦 → 探针 302 + 语义确认那是**开发者自己的控制台**，不是 App 遥测出口，改成不拦。
- `oa-panther.data.aliyun.com` / `log.aliyuncs.com` 我按印象写进 ARMS → 实测 CF 解析 0 条**已死域**，删除。ARMS 只保留唯一存活的 `arms-retcode.aliyuncs.com`（CF=25 / HTTPS=405）。
- 「不凭印象写域名」被提为硬要求：197 个候选逐条双解析器核验后才入库。

**新增红线门禁**（2 例）：
- **绝不拦推送通道**：`jpush.cn`/`jpush.io`/`getui.com`/`getui.net`/`gepush.com`/厂商 `xmpush·api-push·upush·config.umeng` 任一被拦即判红 —— 断推送是功能损失不是少条统计。
- **不拦商店/系统更新域**：`ad.apk.vivo`/`apps.oppomobile`/`pandora.xiaomi` 系被拦即判红 —— 拦了 App 无法更新，属灾难级误伤。

## 附六：国际广告聚合/变现平台（2026-09-29）

**基准来源换了一层**：不再只靠社区规则，而是取广告主 App 的 **AdMob `appads.txt`** —— 由变现平台**自报**的来源域（`applovin` / `vungle` / `chartboost` / `fyber` / `ironsrc` / `mintegral` / `mopub` / `tapjoy` / `unity3d` / `ogury` / `streamkey.tv` …）。这比任何第三方清单都硬：平台自己声明自己是谁。

**只拦子域，不拦平台主域**（逐条有理由，不是保守）：
| 主域 | 处置 | 理由 |
|---|---|---|
| `unity3d.com` | ❌ 排除 | Unity **引擎本体**，整域拦直接破 Unity 游戏运行与资源加载 |
| `mopub.com` | ❌ 排除 | 已并入 AppLovin（探针 302 → `applovin.com/max`），拦了是重复 |
| `supersonicads.com` | ❌ 排除 | 实测已死域（CF 解析 0 条），不占资源 |
| `streamkey.tv` | ❌ 排除 | 直播广告主站且有正常站点内容，非 SDK 出口 |
| `applovin.com` / `startapp.com` | 只拦 SDK 子域 | 含开发者后台与站点 |

**探针省下 24 条无效规则**：对每个候选子域单独跑 DoH，`sdk.applovin.com` / `init.ironsrc.com` / `mcs.mintegral.com` / `sdk.mbridge.cc` / `api.adcolony.com` / `ads.advangelists.com` 等实测**解析 0 条**。写进配置就是 24 条永不生效的规则 —— 平台子域变更频繁，死子域比预期多。⇒ **子域级拦截必须逐条探针，不能按父域推定**。

**判据沉淀**：给广告平台做去广告时，先问"这层拦截需不需要解密面"——L2 域名 REJECT 一律不需要，**加了 `[MitM]` 就是净损失**。
**HAR 缺失**不等于**停手理由**——先搜上游/issue/已构建插件，三源交叉验证强度往往高于单份 HAR。
**功能域白名单的成因会随配置演进而失效**，注释必须随成因更新，否则后人会误判它是空转或误删。**「无治理」在缺少解密面与 HAR 时是正确基线，不是缺口。**

---

## 本标准已固化的门禁

`APP-ONBOARDING.md` 中可机械判定的部分已落成 `tools/plugin-lint-check.mjs` 的报告项（只报告不判红，因为这类冲突常源于用户的**主动权衡**）：

| 报告项 | 抓什么 | 本次抓出 |
|---|---|---|
| `[跨层空转]` | 插件 `[Rule]` 的 `DIRECT` 被主配置 `REJECT` 覆盖（本地 > 插件） | 3 条（①②③） |
| `[解密面无消费]` | 插件 `[MitM]` 正条目被主配置 `REJECT` 覆盖（DNS 阶段即被拒，到不了解密层） | 7 条（**已全部收窄**，现各剩 2 个正 host） |

**修复过程中发现门禁自身的一个缺口**（值得记，属"看起来有门禁其实没有"）：段定位用了 `txt.indexOf("[MitM]")`，会命中 `[Script]` 段注释里**提到的** `[MitM]` 字样（本插件就有一处："…无法被 MitM 解密面门禁静态识别"），导致取到错误的段、`hostname` 正则不匹配、**检查静默失效**。已改为行首锚定 `^\[MitM\]\s*$`。修好后立刻多报出 5 条。

**这 3 条中前两条是本次审计新发现的，第 3 条是既有事实。**
