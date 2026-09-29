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

## 本标准已固化的门禁

`APP-ONBOARDING.md` 中可机械判定的部分已落成 `tools/plugin-lint-check.mjs` 的报告项（只报告不判红，因为这类冲突常源于用户的**主动权衡**）：

| 报告项 | 抓什么 | 本次抓出 |
|---|---|---|
| `[跨层空转]` | 插件 `[Rule]` 的 `DIRECT` 被主配置 `REJECT` 覆盖（本地 > 插件） | 3 条（①②③） |
| `[解密面无消费]` | 插件 `[MitM]` 正条目被主配置 `REJECT` 覆盖（DNS 阶段即被拒，到不了解密层） | 7 条（**已全部收窄**，现各剩 2 个正 host） |

**修复过程中发现门禁自身的一个缺口**（值得记，属"看起来有门禁其实没有"）：段定位用了 `txt.indexOf("[MitM]")`，会命中 `[Script]` 段注释里**提到的** `[MitM]` 字样（本插件就有一处："…无法被 MitM 解密面门禁静态识别"），导致取到错误的段、`hostname` 正则不匹配、**检查静默失效**。已改为行首锚定 `^\[MitM\]\s*$`。修好后立刻多报出 5 条。

**这 3 条中前两条是本次审计新发现的，第 3 条是既有事实。**
