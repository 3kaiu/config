# 单 App 接入标准（Loon 插件 / 脚本）

> 逐个 App 接入时照此执行。每一步都给出**判据**与**取证方法**，不允许"看名字猜"。
> 依据：`https://nsloon.app/docs/`（Loon 3.5.1 官方文档，本文末列出引用页）。
> 已有落地样例见 `Plugin/qidian.plugin`。

---

## 0. 分发与验真（用户侧第一步）

配置的唯一入口是 `Profile/Loon.lcf`（由 `template/` + `surgio.conf.js` 生成，**勿手改**）：

| 用途 | 地址 |
|---|---|
| 导入（客户端订阅） | `https://ws.wenn.in/main/Profile/Loon.lcf

> 一键导入（官方 Scheme，注意**无斜杠**）：`loon://import?sub=` + URL 编码后的上面那个地址。` |
| 同源镜像（自建 CDN 不可用时） | `https://raw.githubusercontent.com/3kaiu/config/main/Profile/Loon.lcf` |
| **完整性校验和** | `Profile/Loon.lcf.sha256`（仓库内，`sha256sum -c` 兼容格式） |

**验真**（下载后、导入前，仓库根目录执行）：

```bash
shasum -a 256 -c Profile/Loon.lcf.sha256     # macOS / Linux(shasum)
sha256sum -c Profile/Loon.lcf.sha256         # Linux
```

**为什么可信**：旁文件由 `tools/profile-hash.mjs` 生成，`npm run check:all` 与 CI 的
`Profile checksum integrity` 步骤守住"产物变则旁文件必须同步变"；自建 CDN 上的那份还有
`upstream-health.yml` 每日按**同路径 sha256** 与仓库比对（不只是探状态码）。插件与脚本同理
（同一条内容哈希通道），所以"我导入的这份是否就是仓库里那份"是可验证的，不需要信任中间环节。

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

**为什么是「一个集合插件、内部按平台分节」，而不是带开关的大插件**：官方《插件》明确策略位只有 `DIRECT`/`REJECT 系列`/`PROXY`，插件参数只作用于 `Script`(`enable={}`) 与 `Rewrite`(`${}`) —— **普通 `[Rule]` 行挂不了条件**。在一个纯 REJECT 插件里声明 N 个 switch 会得到 N 个**死参数**，误导用户以为能开关。

**2026-09-30 用户决策（全局整合第一步）**：原 7 个按平台拆分的 ad-* 插件合并为 1 个 `Plugin/ad-block.plugin`（7 平台 **59 域并集，逐条不变**）—— 合并前实测 **ad×ad = ad×probe = ad×主配置 = 0 重叠**，即「重复」不在域而在结构（7 份分发 / 7 条 `[Plugin]` 登记 / 7 次 CDN 探活 / 7 个 manifest 成员）。⚠️ **代价**：平台级开关收敛为**单插件开关**（集合化与"逐平台启停"不可兼得）；需要单平台开关时按平台拆回即可。

| 插件 | 范围 | 域数 | 明确排除（拦了会破功能） |
|---|---|---|---|
| `ad-block.plugin` | **7 平台集合** | **59** | 见下逐平台列（原 7 文件证据注释全量保留在插件内） |

| 平台（集合插件内分节） | 域数 | 明确排除（拦了会破功能） |
|---|---|---|
| 穿山甲/字节 | 17 | aweme 内容流 / video-cn 视频CDN / temai 电商 / tnc3 内容 / bytescm 通用CDN / gecko-pangle 落地页 |
| 广点通/腾讯广告 | 8 | `e.qq.com` 父域（企微/公众号）/ trace·btrace·imgcache（全站埋点非广告专有） |
| 快手联盟 | 7 | `kuaishou.com` 主域（短视频本体）/`e.kuaishou.com` 主域级电商 |
| 百度联盟 | 2 | `union.baidu.com` 主站（含落地页） |
| Google/AdMob | 1 | `doubleclick.net`/`googlesyndication.com` 主配置已有 SUFFIX 覆盖，不重复 |
| 国际聚合 | 3 | Sigmob/TradPlus/AnyThink 已部分被主配置 SUFFIX 覆盖，只留未覆盖的 |
| 国际聚合/变现平台 | 21 | 见插件内 ad-intl-mediation 溯源段（unity3d 引擎本体 / mopub 已并入 AppLovin / streamkey.tv 站点内容等） |

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
| `probe-block` ① 友盟+ | 统计/崩溃 | 15 | `config./user./msg.` 与 jpush/getui 推送 |
| `probe-block` ② 厂商自有遥测 | 小米/vivo/OPPO/魅族 | 11 | 商店(`ad.apk.vivo`)、推送(`xmpush`)、系统设置(`bss·de·dvb·jellyfish`) |
| `probe-block` ③ 前端监控/埋点 | GrowingIO/神策/网易易盾 RUM | 7 | — |
| `probe-block` ④ Bugly | 腾讯崩溃上报 | 2 | jpush 推送 |
| `probe-block` ⑤ ARMS | 阿里云前端 RUM | 1 | `arms.console.aliyun.com`（开发者自用控制台）、`oss`（可能承载内容） |
| `probe-block` ⑥ Firebase/Segment | Crashlytics 增量 | 1 | `firebaseinstallations`（FCM 推送，主配置已保留） |

**开发者视角的三档代价**（决定拦不拦）：① 纯统计埋点 —— 拦了无功能损失，**最安全**；② 崩溃/APM —— 拦了不破功能，但**丢失调试可见性**（排障变难），由插件可关停来平衡；③ 推送/归因 —— 推送**绝对不拦**（断推送是真功能损失），归因只影响安装统计。

**三个探针实证纠正了我写错的判断**（都靠 DoH 拦下）：
- `arms.console.aliyun.com` 我原以为该拦 → 探针 302 + 语义确认那是**开发者自己的控制台**，不是 App 遥测出口，改成不拦。
- `oa-panther.data.aliyun.com` / `log.aliyuncs.com` 我按印象写进 ARMS → 实测 CF 解析 0 条**已死域**，删除。ARMS 只保留唯一存活的 `arms-retcode.aliyuncs.com`（CF=25 / HTTPS=405）。
- 「不凭印象写域名」被提为硬要求：197 个候选逐条双解析器核验后才入库。

**新增红线门禁**（2 例）：
- **绝不拦推送通道**：`jpush.cn`/`jpush.io`/`getui.com`/`getui.net`/`gepush.com`/厂商 `xmpush·api-push·upush·config.umeng` 任一被拦即判红 —— 断推送是功能损失不是少条统计。
- **不拦商店/系统更新域**：`ad.apk.vivo`/`apps.oppomobile`/`pandora.xiaomi` 系被拦即判红 —— 拦了 App 无法更新，属灾难级误伤。

## 附六：国际广告聚合/变现平台（2026-09-29 建，2026-09-30 基准换层 + 溯源更正）

**基准换了一层，而且换对了**：不再靠社区规则，也不靠"某一份 App 的 `app-ads.txt`"，而是取 **多份第三方发行商公开清单** 的一手声明语料（现 15 份：Rovio / King / Zynga / Playtika / Voodoo / Tripledot / Huuuge / Rollic / Peak / Gram / Kwalee / Miniclip / Lion / TapNation / Azur，共 **7908 条声明、979 个唯一 ad system 域**）。**证据类别**比任何社区清单硬：**发行方自己声明哪些 ad system 获授权卖它的库存**。

**首版叙述已被证伪（2026-09-30 溯源，证据可复跑）**：原写"基准 = 广告主 App 的 AdMob `appads.txt`"以及更早的"变现平台自报来源域，证据强度高于任何第三方清单"——**不成立**，两条独立证据：

1. **类别不符**：IAB `app-ads.txt` 声明的是 ad system **根域**（`applovin.com`），而本仓首版 21 条规则**全是端点主机**（`d.applovin.com` / `ww251.smartadserver.com` / `init.startappservice.com` / `cdn1.smartadserver.com` …）。在 44 份真实清单的 **200005 行**声明里，这 21 条出现 **0 次** —— 清单**给不出**这些域名，所以"基准取自 app-ads.txt"在类别上就不可能。
2. **说不出出处**：全文与 git 历史里没有任何 URL、文件名或快照；而本仓**自己的**历史镜像里就有其中一条 —— `git show 4d4b8f7:Mirror/rules/goodbyeads-qx.list`（115076 行，sha256 `fe6a469a…`）含 `d.applovin.com`；该镜像在 `57e7a6e` 被移除、域集在 `b31188f`（提交名"21 域"）重生。社区清单覆盖率实测 9/21（HaGeZi 5 / anti-AD 8 / GOODBYEADS 1），剩下 12 条 `api.`/`ads.`/`init.` 主机在任何清单里都查不到 ⇒ 真实来源是**候选子域枚举 + DoH 探针**（与"24 子域实测已死"的记录一致），不是任何一份清单。

⇒ **结论**：这些规则**没有** app-ads.txt 级的一手背书，只有**端点级**证据。据此定下**两把钥匙**（写进 `AGENTS.md`）：**平台层**（该不该拦）= 被拦平台在一手声明语料里出现过；**端点层**（拦哪个子域）= DoH + HTTPS 逐 host 实测。**缺一即类别误标** —— "端点活着"不能代替"平台有声明"。

**平台层取证现状（`node tools/appads-check.mjs`，离线可复跑）**：14 个被拦平台 —— 13 个有一手声明（`adcolony`/`vungle`/`inmobi`/`chartboost`/`fyber`/`mintegral`/`smartadserver`/`applovin`/`startapp` 均 15/15；`ogury`/`adview` 14/15；`tapjoy` 10/15；`unity3d` 8/15），**1 个 0 声明**：`admost.com`（标 `declaration_gap`，每次运行都列出来，属**待裁决**：keep 还是撤，不由门禁自动决定）。另有 **807 个平台缺口**（有一手声明、本仓未拦也未登记排除）只报告 —— 平台有声明 ≠ 端点存在。

**端点→平台归属不能靠后缀猜**（`tools/lib/ad-platform-map.mjs` 台账）：`init.startappservice.com` 的平台是 `startapp.com`（品牌同、域不同）；`bid.adview.cn` 的平台是 **`adview.com`**（语料里 14/15 声明的是 `.com`，`.cn` 是对外站点）—— 两条都是后缀回退抓不到的跨域别名，必须显式记账，否则平台层门禁要么误红、要么空转。

**只拦子域，不拦平台主域**（逐条有理由，不是保守）：
| 主域 | 处置 | 理由 |
|---|---|---|
| `unity3d.com` | 只拦广告子域 | Unity **引擎本体**，整域拦直接破 Unity 游戏运行与资源加载；仅拦已取证的广告端点 `config.unityads.unity3d.com`（`ad-block.plugin`） |
| `mopub.com` | ❌ 排除 | 已并入 AppLovin（探针 302 → `applovin.com/max`），拦了是重复 |
| `supersonicads.com` | ⚠️ **未决**（已撤出排除台账） | 原写"实测已死域（CF 解析 0 条）"**不成立**：2026-09-30 复核发现只探了 apex —— apex 确无 A，但 `init.`/`outcome.` **各 4 条 A 且非泛解析**（随机子域 NXDOMAIN），仅 TCP 80/443 不可达；且它在 44 份语料里 **0 声明**（`AGENTS.md` 的两条反向教训之一） |
| `streamkey.tv` | ❌ 排除 | 直播广告主站且有正常站点内容，非 SDK 出口 |
| `applovin.com` / `startapp.com` | 只拦 SDK 子域 | 含开发者后台与站点（已拦的 StartApp 出口在 `startappservice.com`/`startappexchange.com`，**归 `startapp.com` 平台**，该平台 15/15 有声明） |

**上表已固化门禁**：台账（域 + 语义 + 理由 + 取证）在 `tools/lib/ad-exclusions.mjs`，`test/cases/ad-exclusions.test.js` 断言「整域排除的域不得有任何规则命中（含子域）」「只拦子域的平台裸域不得被拦」，并带扫描面地板。注意 `unity3d.com` 由上表首版字面上的「❌ 排除」改为「只拦广告子域」—— 首版与原意（反对**整域**拦）和实际配置（拦的是 `config.unityads.` 广告端点）互相矛盾，按实际意图统一。

**基准可复跑化（2026-09-30 收口）**：`tools/appads-check.mjs` + `test/fixtures/appads/SOURCE.json` 把基准钉成**多源一手声明语料**（`kind=first-party-attestation`，`pinned=true`，`threshold_files=3`）：派生域集入库（`reference/*.json`，692K，含 URL + sha256 + bytes，原始文件最大 669KB 不入库）⇒ 平台层判定**离线可复跑**；`--check` 另做**语料 sha256 漂移检测**（上游清单变了 ⇒ 证据基础变了，判红并要求复核后 `--fetch`）。首版叙述与证伪过程留在 `SOURCE.json.baseline.provenance_audit` 里（`kept_but_relabelled`：规则保留，但标签从"一手清单推导"改为"端点评分 + 平台层待补"）。

已排除的替代源（附实测依据，免得后人重试一遍）：

| 替代源 | 实测 | 为什么不能当基准 |
|---|---|---|
| **某一份 App 的 `app-ads.txt` 当唯一基准** | 首版就是这么写的，实测**说不出是哪一份**；且 6 份公开清单各自都声明了同一批 16 个平台 | ① 单文件不可复核就等于没有基准；② 平台集合非唯一 ⇒ 规则不依赖任何单份文件，多源语料才既硬又稳 |
| 广告平台 `sellers.json`（看着最像"平台自报来源域"） | `vungle.com/sellers.json` → 200，2399 条 seller **全部** `seller_type=PUBLISHER`，`domain` 是接入方站点（`microsoftcasualgames.com`/`tripledotstudios.com`…），列表里**没有** `vungle.com` 自身 | 它的语义是「谁获授权卖我的库存」，不是「平台自己用哪些来源域」。拿它当平台来源域属于**误标来源**——正是本仓明令禁止的形状（凭看起来像就写） |
| 各平台自己站点上的 `app-ads.txt` | `chartboost.com/app-ads.txt` → 301；`mintegral`/`ogury`/`tapjoy` → 301/302；`admost.com` → 200 但非清单内容 | 同 `ads.txt` 语义：声明哪些 ad system 获授权卖**该站点自己的**库存，与 SDK 出口域无关 |
| 第三方聚合清单 / 社区规则 | HaGeZi 5 / anti-AD 8 / GOODBYEADS 1 覆盖首版 21 条中的 9 条 | 证据强度低于一手声明 —— 而且它正是首版域集的**真实**来源，作为基准等于回到原点 |

⇒ **本仓的基准是"发行方一手声明语料 + 端点探针"的组合，不需要向任何人再要一份文件**；若将来有**自己 App** 的 `app-ads.txt`，可以当**可选叠加层**（`--file`）做四桶比对（`covered`/`excluded`/`gap`/`undeclared`），那是"该不该拦这一条"，与平台层判据互不替代。

**参考清单层与基准同源（`--refs`，2026-09-30）**：同一批 15 份公开清单既做基准（平台层），也做**发现**输入 —— 它回答"业界在声明哪些 ad system"（979 个唯一域，807 个 gap 候选），命令 `node tools/appads-check.mjs --refs`。

发现结果与**逐 host 取证**（2026-09-30 DoH + HTTPS，泛解析对照）：

| 候选 / 信号 | 语料共识 | host 层实测 | 判定 |
|---|---|---|---|
| `unity.com` | **15/15** 声明 | 所有广告子域（`config.unityads.unity.com`/`unityads.unity.com`/`ads.unity.com`/`gateway.unityads.unity.com`）**NXDOMAIN**；apex 是公司站。同品牌 `unity3d.com` 8/15 声明且端点活 | ❌ **高共识被证伪**：声明域迁移了，服务端点没迁（我们拦的 `config.unityads.unity3d.com` 仍活，CNAME → `ads-config.`）⇒ **不加规则** |
| `ironsrc.com` | **15/15**（DIRECT 13） | apex 1A；`api.ironsrc.com` CNAME → `api.ironsrc.com.edgesuite.net`（Akamai）2A；`init.ironsrc.com` NXDOMAIN | ⚠️ 候选（真出口疑在 `supersonicads` 家族） |
| `init.` / `outcome.supersonicads.com` | **0/15** | 各 4A、非泛解析；TCP 80/443 不可达 | ⚠️ 未决（原判"已死"已撤回；平台层 0 声明有正面证据） |
| `aps.amazon.com` | 14/15（DIRECT 12） | 302 活；亚马逊真实广告域 `amazon-adsystem.com` 3A 活、`aax-us-east.amazon-adsystem.com` 4A 活 | ⚠️ 候选（强） |
| `smaato.com` / `hyprmx.com` / `openx.com` / `vrtcal.com` / `lkqd.net` / `advertising.com` / `target.my.com` | 3–15/15 | A 记录活 | ⚠️ 候选（待端点取证） |
| `ironsource.mobi` | — | **泛解析**：随机子域也解析，`init.ironsource.mobi` 的 1A + HTTPS 200 是假信号 | ❌ 不作依据 |

**两条反向教训**（都是本仓自己犯的过度断言，已写进 `AGENTS.md`）：
1. **apex 无 A ≠ 域已死** —— 原 `supersonicads.com` 台账条目就是这么错的；
2. **A 记录存在 ≠ 端点存在** —— 泛解析域会给每个子域发 A 记录，必须先探一个随机子域对照。

**本轮没有新增任何规则**：807 个 gap 里绝大多数是交易所/reseller 长尾，而"语料里有声明"**不等于**"该拦"。候选要变成规则，仍需 ① 平台层有一手声明（或有台账理由），② 逐 host DoH + HTTPS 取证，③ 只拦精确子域不拦主域。

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

另有一条**判红**门禁（上表两项只报告，与此不同）：`test/cases/ad-exclusions.test.js` + `tools/lib/ad-exclusions.mjs` 守住附六的排除决策 —— 「整域排除的域不得有任何规则命中（含子域）」「只拦子域的平台裸域不得被拦」，外加扫描面地板（主配置与插件都必须真的扫到）。理由：排除决策的失效方式是**后人顺手补一条规则**，没有任何运行时症状，只有断言能抓。

**基准类门禁**（附六）：`tools/appads-check.mjs` + `test/cases/appads-check.test.js` —— **平台层取证门禁**（被拦平台须有一手声明，或经 `tools/lib/ad-platform-map.mjs` 台账记账且**每次运行都列出**；0 声明且无归属即判红）、语料 sha256 漂移检测（`--check`）、IAB 解析与四桶比对（`--file`）；发现层另有 `--refs`（共识 + 反向核对）与 `--fetch`（重抓派生域集，原始文件不入库）。它刻意**不**静默转绿：基准未钉死与"无一手声明的保留项"两种缺口都会打印在每次运行里，CI 里未钉死还会打 `::warning` 注解。溯源结论（首版叙述如何被证伪）留在 `SOURCE.json.baseline.provenance_audit`，由用例守住不许回流。

## 附七：汽水音乐（抖音音乐版，2026-09-30）

第 3 个做**接口级净化**的 App（前两个：起点、京东）。与二者最大的不同：**没有任何一手响应体样本** —— 字段名全部来自第三方去广告配置里的 jq/path 表达式。故本附的写法是"**字段名 = 证据，语义 = 推断**"，逐条按来源份数分档，单来源一律不落地。

### 1. App 身份（一手）

| 项 | 值 | 来源 |
|---|---|---|
| iOS bundle id | **`com.soda.music`** v21.0.0（2026-09-20 发布） | iTunes Lookup `id=1605585211`（中国区；美区 `resultCount=0` 未上架） |
| 安卓包名 | **`com.luna.music`**（19.7.0 / 19.8.0 抓包与开放库一致） | CSDN 抓包文 / music-lib / Lyricify |
| seller | Beijing Douyin Technology Co., Ltd. | 同上 |

⚠️ `com.luna.music` **不是** iOS bundle id —— 两者混写会让后续取证张冠李戴（本仓 2026-09-30 修正过一次）。

### 2. 接口面（一手探针，可复跑）

**luna 接口有 4 个等价接入点**：`api.qishui.com`、`api3.qishui.com`、`api5-lq.qishui.com`、`beta-luna.douyin.com` —— 四者 `GET /luna/me?` 返回**同一结构**的 200 JSON（183 B）。`api2/luna/ad/ads/monitor/push/static .qishui.com` 全部 NXDOMAIN（未注册子域，不是"域已死"）。

**取证陷阱（本轮最容易踩的一个）**：`/luna/card`、`/luna/feed/song-tab`、`/luna/more-panel`、`/luna/search-block`、`/luna/media_ads`、`/luna/commerce/v2/commerce_info` 的**裸 GET 全是 404**，**POST（或带 query）才 200**。只看 GET 会把真实端点当成死路由。同理会看错 `/luna/ads/`：裸路径与 `/luna/ads/list` 是 404，而 `/luna/ads/config` 是 200 ⇒ 它是**前缀路由**，上游写 `\/luna\/ads\/` 前缀匹配是对的。

| 路由 | 探针 | 处置 |
|---|---|---|
| `/luna/me?` | GET 200 JSON | 字段级净化 |
| `/luna/me/recently-played-media?` | GET 200 | 字段级净化 |
| `/luna/activities?` | GET 200 | 字段级净化 |
| `/luna/card?` · `/luna/search-block` · `/luna/feed/song-tab?` · `/luna/more-panel?` · `/luna/media_ads` | POST 200 | 净化 / 一条整条转空 |
| `/luna/commerce/upsells?`（GET）· `upsells_config?` · `v2/commerce_info?`（POST） | 200 | 整条转空 |
| `/luna/treasure/entrance/config?` · `/luna/listen-video/reminder?` · `/luna/hashtag/recommend` | 200 | 前两条整条转空；第三条停发现项 |
| `/luna/ads/config` | POST 200（裸路径 404） | 前缀整条转空 |
| `webcast-open.douyin.com/webcast/openapi/feed/?` | 400（缺参=路由通） | 整条转空 |
| `/luna/splash` | 3 host × GET/POST 全 **404** | **不落地**（且仅单来源） |
| `/location/info` | GET 404 / POST 307 | **不落地**（属 M3 隐私面） |

### 3. 处置分层与来源分档

**整条 `reject_dict(200)`（8 条）= 纯广告/纯推广端点**，每条 ≥2 份上游一致：`/luna/ads/`(前缀) · `/luna/media_ads` · `/luna/commerce/{upsells,upsells_config,v2/commerce_info}` · `/luna/treasure/entrance/config` · `/luna/listen-video/reminder` · `webcast-open…/feed/`。

**字段级 `delete`/`jq`（7 条）= 业务+广告同响应**（纪律：「一个接口既下发业务数据又下发广告，就不能整条拒」，京东 `functionId=start` 白屏是前车之鉴）：

| 接口 | 字段 / 表达式 | 来源份数 |
|---|---|---|
| `/luna/me?` | `del reward_ad_banner` | 3（kelee · ddgksf2013 · BOB） |
| `/luna/activities?` | `del activity_map` | 3（ddgksf2013 · jnlaoshu · lihx） |
| `/luna/search-block` | `del search_chart_block` | 2（ddgksf2013 · lihx） |
| `/luna/card?` | `del preview_guide` + `del(.card_items[] \| select(has("priority_display")))` | 4（kelee · QingRex · BOB · jnlaoshu） |
| `/luna/feed/song-tab?` | `del(.items[] \| select(.type=="video_track_mix"))` | 4（kelee · QingRex · BOB · ddgksf2013） |
| `/luna/more-panel?` | `.blocks \|= map(select(.type != "related_video"))` | 4（kelee · QingRex · BOB · fmz200） |
| `/luna/me/recently-played-media?` | `.media \|= map(select(.type != "video"))` | 2（edcjason · kelee JS） |

**两条口径差异（记录，非照抄）**：
- `/luna/feed/song-tab` 上游 ddgksf2013 用**白名单**（`items |= map(select(.type=="track"))`），本仓用**黑名单**（只删 `video_track_mix`）—— 白名单会把未来新增的**正常** type 一起清掉，属过度断言。
- `/luna/card` 上游有"删元素"与"把 `priority_display`/`is_show` 置 false"两种写法，本仓取前者（3 源 vs 1 源）。
- `recently-played-media` 上游因"响应体太大"改走第三方 JS 脚本，本仓仍用 jq：少一份第三方运行时依赖，且 jq 不生效时响应原样透传。

**L2 域名（3 域 + 2 条 AND）**：`dm.bytedance.com` / `dm.pstatp.com` / `dm.toutiao.com`（fmz200 逐条列出 + 主配置 385 行注释已定性「dm./pglstatp 广告域不放行」）· `AND((DOMAIN-KEYWORD,-ad-sign),(DOMAIN-SUFFIX,byteimg.com))` · `AND((DOMAIN-KEYWORD,tnc),(DOMAIN-SUFFIX,zijieapi.com))`。

**自带 HTTPDNS 收编为什么不用上游的响应改写**：kelee/QingRex/BOB/egern 都是改写 `/get_domains/` 响应（`opaque_data_enabled`/`ttnet_http_dns_enabled`/`ttnet_quic_enabled`/`ttnet_tt_http_dns` 置 0 + 过滤 `ttnet_dispatch_actions`）。那需要 MitM `tnc*-*.zijieapi.com` —— **通配 host 会被 mitm-orphan 判 generic 而恒报孤儿**，且把整个 `zijieapi.com` 拉进解密面。域名级收编效果等价（自带解析拿不到调度 ⇒ 回落系统 DNS），零证书成本。实测 `tnc3-bjlgy.zijieapi.com/get_domains/v5/?` 返回 200 且**动态下发** `tnc0-*` ⇒ 穷举必然过时；上游 `tnc\d-(bjlgy|ali[a-z]{2})\d?` 亦被证伪（`tnc3-bjlgy1`/`tnc1-alibj1` NXDOMAIN）。

### 4. 明确不落地（发现项，防后人"看着像漏了"补进来）

| 面 | 依据缺口 | 处置 |
|---|---|---|
| `/luna/splash`（"精准开屏"） | **单来源**（仅 edcjason），且 3 host × GET/POST **全 404**；无任何来源给出其响应字段名 | 停在发现项：先拿到真实端点再谈 |
| `/luna/hashtag/recommend`（TAGS 推荐） | 端点实测 200，但仅 ddgksf2013 一份按 `reject-200`，无语义证据说明它"纯推广"，也无字段证据 | 停在发现项（纪律：不得整条拒业务接口） |
| `/location/info` | ddgksf2013/lihx 按 reject-200，但语义是**位置隐私**＝ M3 | 交 M3，不塞进 M2 插件 |
| `mon.zijieapi.com` / `mssdk.volces.com` / `lf3-short.ibytedapm.com` | A 存活（后两者 HTTPS 因本机解析器过滤名单不可测；`lf3-short` 实测 403 JSON = APM 端点） | 属 M3 上报拦截 → `probe-block` 通道扩展 |
| `analytics.bytescm.com` / `ad.snssdk.com` / `ads.snssdk.com` / `gromore.snssdk.com` / `tosv.byted.org` / `static.i18n-pglstatp.com` / `be-pack.pglstatp-toutiao.com` / `ttcdn-tos.pstatp.com` / `s3a.pstatp.com` 等 | 上游（fmz200 等）有规则，但四解析器实测 **NXDOMAIN 或不可测**，或语义与内容 CDN 混同（`s3a.pstatp.com`） | 全部不落地 —— **不照搬上游的域清单**，尤其"最像广告"的 `ad./ads./gromore.snssdk.com` 实测根本不存在 |

### 5. 已知残留风险（诚实记录，未解决）

1. **iOS 端可能证书固定**：有第三方逆向文记录安卓 `libsscronet.so` 存在证书固定（修补 `VerifyCert` 才能抓包）。若 iOS 同样固定，则本插件 `[Rewrite]` 段**全部静默失效**（症状：日志命中但 App 无变化）。故纯广告端点同时放在 **L2 域名层**（不依赖解密）。离线无法证伪，需要真机验证 —— 这是本附最大的未闭合项。
2. **字段语义是推断**：`reward_ad_banner` / `activity_map` / `search_chart_block` / `preview_guide` / `priority_display` / `video_track_mix` / `related_video` 均无一手 JSON 样本；字段名有 URL 可复跑，语义靠上游注释。若某字段被客户端用于非广告用途，症状是功能缺失而非报错。
3. **域名层的跨 App 影响**：`AND(tnc, zijieapi.com)` 与 `dm.*` 是字节系共用面，装了本插件对**其他字节 App**同样生效（主配置本就 REJECT 了 `tnc3-alisc1`）。这是插件级取舍，不是缺陷，但需知情。

### 6. 复跑命令

```bash
curl -sS -m12 'https://api.qishui.com/luna/me?'                      # 200 JSON（业务接口, 不可整条拒）
curl -sS -m12 -X POST -H 'Content-Type: application/json' -d '{}' \
     'https://api5-lq.qishui.com/luna/card'                          # 200（GET 是 404 —— 取证陷阱）
curl -sS -m12 -X POST -d '{}' 'https://api5-lq.qishui.com/luna/ads/config'   # 200 ⇒ /luna/ads/ 是前缀路由
curl -sS -m12 'https://tnc3-bjlgy.zijieapi.com/get_domains/v5/?'      # 200 且动态下发 tnc0-*
curl -sS -m12 'https://tnc3-bjlgy.zijieapi.com/get_domains/v5/'       # 同上（无 ? 时 404）
```

**门禁**：`test/cases/soda.test.js` 把本附的 15 条台账、4 条红线（业务接口不得整条拒 / 单来源不得落地 / 每条必须带开关 / 解密面无通配且全被消费）与 App 身份固化 —— 台账与插件注释互为正本，改一处不改另一处即判红。
**顺带修掉的门禁盲区**：`tools/argument-contract-check.mjs` 原先把**所有** `${…}` 当 JS 模板字面量排除，而新语法里 `${KEY}` 才是开关的唯一引用形式 —— 纯新语法插件会被判"死开关"（把正确写法判红）。判据已收敛为"仅新语法行（`request|response if …`）里的 `${KEY}` 算引用，且排除内置变量 `${url}`/`${request.*}`/`${response.*}` 与捕获槽 `${item.1}`"。

---

## 附八：智慧房东（施王物联，2026-09-30）

本 App 的取证结构与本仓其它单 App 插件**都不同**，因此它的产出形态也不同：
**没有一条社区上游规则可抄**（它是 B 端 SaaS，不是内容 App），广告面证据全部来自
① App 自家的一手声明 + ② 运营后台前端 + ③ 端点探针。

### 1. App 身份与入口

| 项 | 值 | 取证 |
|---|---|---|
| 安卓包名 | `com.zhihuifangdong.wisdom` v6.5.9（2026-09-16） | 应用宝 appdetail 页 `YYBAppInfo` |
| iOS | `id1529842057` | 官网 `/pages/download` 的 App Store 链接 |
| 运营主体 | 浙江施王物联科技有限公司 | 官网页脚 + 备案号 |
| 官网 | `www.zhihuifangdong.net` | — |
| SaaS 后台 | `landlord.` / `guandian.` / `board.`（三个 Vue SPA） | crt.sh + 逐个探针 |
| 开放平台 | `openapi.`（Apifox 托管文档：电表/水表/门锁接口） | 同上 |
| 隐私政策 | `aixin-down-file.oss-cn-beijing.aliyuncs.com/zhfd_privacy.html`（2026-04-14 生效） | 应用宝详情页外链 |

**官网本身没有广告域可拦**：它是**建站宝盒（71360）托管的企业站**，第三方只有
七鱼客服 widget（`ykf-webchat.7moor.com`）、百度收录推送（`zz.bdstatic.com/linksubmit/push.js`）、
高德地图 —— 三者都是站点功能而非广告面，拦了只会破站（客服不可用 / 地图空白）。
`img03./sitecdn./cmsimg01.71360.com` 是站点自身的图片与静态资源，拦了整站白屏。
⇒ **真正的广告面在 App 及其 SaaS 后台**，这也是本轮的去广告对象。

### 2. 平台层证据：隐私政策的一手声明（本仓目前最硬的一类）

隐私政策第十一节「第三方SDK说明」由 **App 自己**列出 **41 个第三方 SDK**，其中 **22 个**
声明用途含"广告投放 / 归因 / 监测 / 反作弊"。

**为什么它比 `app-ads.txt` 语料更硬**（两种证据的语义不同，不是同一把尺子）：

| | app-ads.txt 语料 | App 隐私政策声明 |
|---|---|---|
| 谁说的 | 第三方发行商（Rovio/King/Zynga…） | **App 运营者自己** |
| 说的是什么 | "这些 ad system 获授权卖**我的**库存" | "**我**集成了这些 SDK，用途是广告投放" |
| 与本仓的关系 | 西方发行生态，**结构性不覆盖**国内 SDK | 直接覆盖国内全部主流广告 SDK |

22 个广告 SDK：优量汇 `com.qq.e` · MMA 中国广告监测 · 图灵盾 · 穿山甲 `openadsdk` ·
快手 `kwad` · SigMob `windad` · 倍孜 `beizi.ad` · GroMore · 百度联盟 · Tanx（阿里妈妈） ·
趣盟 `com.dcloudym` · 章鱼 `com.octopus.ad` · 京媒 · 优推 `com.alliance.ssp.ad` · uni-ad ·
推啊 `engine.tuifish.com` · 百度百青藤 · HUAWEI Ads · 泛连 `com.fl.saas.s2s` ·
火山引擎 `com.bytedance.volc` · 七巧板 `yaq.pro.getVresult` · MSA 移动安全联盟（广告归因/反作弊）。

### 3. 端点层：这 22 个平台的域**已被 L0 覆盖 21/22**

逐条比对现有 `ad-block.plugin` + 主配置的域集后，**只有一个缺口**：

| 平台 | 端点 | 探针（Cloudflare + DNS.google 双解析器 + 泛解析对照） | 处置 |
|---|---|---|---|
| **趣盟 / DCloud** | `api.qttunion.com` | 10 条 A（152.136.165.32 / 49.233.244.218 / 211.159.174.153…），随机子域 NXDOMAIN ⇒ **非泛解析**；HTTPS 根路径及 9 个路径均 `404 text/plain` ⇒ 服务端在、端点型 | ✅ 加进 `ad-block.plugin`（L0）+ 登记 `OUT_OF_CORPUS_ROOTS` |
| uni-ad | `uniad.dcloud.net.cn` | 2 A 非泛解析，但 HTTPS `200 text/html` = **平台官网/文档站** | ❌ 不加（判据④） |
| HUAWEI Ads | `ads.huawei.com` | A 存活但 HTTPS `301 text/html` = 平台站；`hmsads./adx./ads-api.` 全 NX | ❌ 不加 |
| MMA | `mmachina.cn` | 1 A，HTTPS `200 text/html` = 协会官网 | ❌ 不加 |
| MSA（OAID） | `oaid.masdk.cn` | 双解析器全 NX（该 SDK 走本地接口不发网络请求） | ❌ 不加 |
| TalkingData | `api.talkingdata.com` | 2 A 存活，但 HTTPS **不可测**；且用途是"数据分析与统计" ⇒ M3 隐私面不是广告面 | 只登记 |

**其余 15 个平台**（优量汇 6 域 / 穿山甲 / 快手 / SigMob / 倍孜 / GroMore / 百度联盟+百青藤 9 域 /
Tanx 13 域 / 章鱼 2 域 / 京媒 4 域 / 优推 / 推啊 4 域 / 泛连 2 域 / 火山引擎 / 七巧板·图灵盾 18 域）
**已由 L0 覆盖**，本轮不重复登记 —— 这正是"单一真源"纪律的收益：单 App 接入不重造轮子。

### 4. 自营活动位（`Plugin/zhifu-fangdong.plugin` 的处置对象）

这是本 App **真正的"广告"** —— 平台自己卖/推的运营活动位，落在 App 首页。

取证链（全部一手，无 HAR）：

1. **运营后台**（`landlord.`）路由 `/standard/Advertisement/*` 是「活动设置」CRUD：
   `activityListMore` / `addMore` / `changeMore` / `upMore` / `down` / `deleteMore` /
   `topMoveMore` / `details`。
2. **实体字段**（读 `chunk-47120da8` 列表页与 `chunk-d436595e` 表单页的前端代码得到）：
   `picType`（只有 `BANNER` 首页轮播 与 `POP_UP_BOX` 弹窗两种）、`title`、`coverPic`、
   `pushPic`、`url`、`adcDelivery`（开启跳转）、`advRedio`（每次/每天一次/仅一次）、
   `bounces`、`goTop`（置顶）、`clickSize`（活动点击量）、`communityIds`（定向小区）、
   `gmtStart`~`gmtEnd`（有效期）、`status`（UP/DOWN/SAVE）、`userType: RENTER`。
   **没有一个业务字段** ⇒ 该实体是**纯广告**，不是"业务+广告同响应"。
3. **App 端读取口** = `GET /core/app/activity/bannerPic`（后台前端里函数名 `getSwiper`），
   **点击上报口** = `POST /core/app/activity/clickAdd`。
4. **端点探针**：`bannerPic` 无 token 返 `401 {"code":"TOKEN_EMPTY","success":false}`
   ⇒ 路由通、端点真实存在（对照组：去掉前缀的 `/activity/bannerPic` 返 Spring Boot 404，
   证明这条路径前缀是敏感的，401 不是"路径写错了"）。

处置：**一条** `reject_dict(200)` 同时清掉轮播与弹窗（同一接口，由 `picType` 区分两种形态）。

**为什么不写字段级**：响应外层数组字段名未取证（探针拿不到 token，无 HAR），而官方
《Rewrite 新语法》规定 JSON 值只支持 String/Number/Boolean/null/变量、**不含数组**
（传 `[]` 会被加载期拒绝）⇒ 写 `.data = []` 里的 `.data` 就是臆造字段名。
按本标准第 1 节的纪律，宁可少清一个字段，不留猜出来的名字。

### 5. 明确**不处置**的面（台账已进 `test/cases/zhifu-fangdong.test.js`，防后人顺手补）

| 面 | 不处置理由 |
|---|---|
| `POST /core/app/activity/clickAdd` | 写操作（点击上报），响应无广告内容；拦它是断上报不是去广告 |
| `/core/web/activity/*` | **后台运营侧** CRUD，拦了破运营后台 |
| `/standard/OnlinePromotion/*`（线上推广 / 智租推广） | 租户**自费的房源推广功能**，属业务不是广告 |
| `/core/web/promotionRecord/*` | 同上，推广记录台账 |
| 官网第三方（七鱼 / 百度推送 / 高德） | 站点功能非广告，拦了破站 |

### 6. 遗留待验证项

**`reject_dict(200)` 会丢掉响应封套里的 `code/success`**。本仓无真机，后果只能登记：
若 App 端对缺失 `success` 的处理是"弹错误提示"而非"静默不展示"，症状是**首页偶发 toast**。
届时正确处置是**改字段级**（拿到 HAR 后按真实字段名 jq 置空），**不是**回退成放行。
同 `soda.plugin` 的 luna 纯广告接口是同一形态、同一未验证前提。

### 7. 复跑命令

```bash
# 平台层一手声明(广告 SDK 清单, 第十一节)
curl -sS -m15 'https://aixin-down-file.oss-cn-beijing.aliyuncs.com/zhfd_privacy.html' | \
  grep -oE '[0-9]+、使用SDK名称：[^<]*' | head -45

# 端点探针: 401 = 路由通(端点存在); 对照组去掉前缀应得 404
curl -sS -m12 'https://api.zhihuifangdong.net/core/app/activity/bannerPic'      # 401 TOKEN_EMPTY
curl -sS -m12 'https://api.zhihuifangdong.net/activity/bannerPic'              # 404 Spring Boot

# 趣盟端点(双解析器 + 泛解析对照)
curl -sS -m10 -H 'accept: application/dns-json' \
  'https://cloudflare-dns.com/dns-query?name=api.qttunion.com&type=A' | head -c 400
curl -sS -m10 'https://dns.google/resolve?name=zznp-x9k2.api.qttunion.com&type=A'  # Status 3 = 非泛解析
curl -sS -m12 -o /dev/null -w '%{http_code} %{content_type}\n' 'https://api.qttunion.com/'
```

**门禁**：`test/cases/zhifu-fangdong.test.js`（8 例）把处置台账、5 条不处置面、
证据留档（41/22 数字、`picType` 判据、`TOKEN_EMPTY` 探针、隐私政策 URL）、
L0 分工（插件内 `[Rule]` 必须为空、趣盟必须在 ad-block + 排除台账）、
开关覆盖、解密面最小化、未验证风险留档、`[Plugin]` 段登记固化。

**顺带补掉的一处门禁盲区**：`OUT_OF_CORPUS_ROOTS`（平台层门禁的**结构性豁免**清单）
此前只有文字纪律「死豁免判红」，`test/cases/appads-check.test.js` 里**没有对应断言** ——
即"看起来有门禁其实没有"。本轮新增豁免条目时一并补上：① 排除项必须是平台根域而非端点主机；
② 每条必须仍被至少一条 `ad-*` 规则命中（删了规则却不删豁免 ⇒ 门禁对该根域永久静默）；
③ 未登记域仍走判红路径。两种破坏形态（改成端点主机 / 指向不存在的根域）已实测能判红。

---

## 附九：微信（WeChat，2026-09-30）

第 5 个做接口级净化的 App（起点、京东、汽水音乐、智慧房东之后）。**前四者的难点是"字段名/端点在哪"，微信的难点是"根本没有 HTTP 面"** —— 故本附的主体是**负结果取证**：把"为什么只有 3 条规则"写成可复跑的结论，避免后人把"不可达"误判成"没写完"而反复劳动，或按域名字义补出一堆死规则。

### 1. App 身份（一手）

| 项 | 值 | 来源 |
|---|---|---|
| iOS bundle id | **`com.tencent.xin`** v8.0.79（2026-09-29 发布，min iOS 15.0，967 MB） | iTunes Lookup `id=414478124`（中国区） |
| 安卓包名 | **`com.tencent.mm`** | 通行事实（与 iOS 包名**不同名**，混写会张冠李戴） |
| seller | Tencent Technology (Shenzhen) Company Limited | 同上 |

⚠️ `weixin` / `wechat` 是品牌词与主配置里 `DIRECT` 白名单的**根域**，不是包名。

### 2. 覆盖天花板：三条硬结论（主题是"无面可打"）

**① 朋友圈 / 视频号 / 开屏 / 激励视频广告走 MMTLS 私有协议 —— HTTP 层不可达。**
与之一一对应的连接面主机 `long` / `short` / `szlong` / `szshort` / `szminorshort` / `szextshort` / `hklong` / `hkshort.weixin.qq.com` 全部**有 A 记录（2–10 条）**，但 443 一律 `curl(35) SSL_ERROR_SYSCALL`（无法完成 TLS）⇒【推断】即 MMTLS 承载层。Rewrite/Script 只见 HTTP(S)，**结构性碰不到**。
旁证有三：① 全网 11 个规则仓 / 41 条微信相关规则里，命中这些面的 **HTTP 层规则 0 条**；② 现成方案只有 UI 层（Xposed `Johnny520/wcx` 的 `RemoveMomentsAds.kt`、GKD 规则 `分段广告-朋友圈广告`）；③ 上游自述 —— `ddgksf2013/Rewrite` 的 `WeChat.conf` 文件头逐字：「微信公众号去广告**[已失效][不包含公众号信息流AD、朋友圈AD]**[推荐开启青少年模式可去除朋友圈AD]」。

**② "朋友圈广告"字面候选域整族已未注册。**
`wxsnsad.qq.com` · `wxsnsad.weixin.qq.com` · `wxsnsdy.qq.com` · `wxsnsdythumb.qq.com` · `wxsns.weixin.qq.com` · `ads.weixin.qq.com` · `finder.weixin.qq.com` · `finds.weixin.qq.com` · `szvip./szfav.weixin.qq.com` · `t.l.qq.com` · `wxad.qq.com` · `wxs.qq.com` · `mmsns.qlogo.cn` 在 **Cloudflare / Google / AliDNS / doh.pub（腾讯自家）/ AdGuard-Unfiltered 五路一致 `Status=3, 0 A`**，而所属根域（`qq.com` / `weixin.qq.com` / `qlogo.cn`）**SOA 活跃** ⇒ 「子域未注册」≠「域已死」，但对拦截而言**没有可拦的名字**。
泛解析对照：9 个根域（qq.com / weixin.qq.com / gtimg.com / gtimg.cn / qpic.cn / qlogo.cn / servicewechat.com / wxaurl.cn / tc.qq.com）的随机 6 位子域四路全 `st3/0A` ⇒ **本批不存在泛解析区**；唯二例外 `adsview.qq.com` / `gtimg.cn` 返回**权威 `0.0.0.1`**（腾讯自建黑洞，写 REJECT 亦为死规则）。

**③ 名字里带 ad 的活域全是"广告主侧后台/官网"，不是 App 内广告下发端点。**

| 主机 | 实测 | 真实角色 | 拦它的后果 |
|---|---|---|---|
| `ad.weixin.qq.com` | 200 `text/html` 17 KB | **微信广告官网 SPA**（任意路径回同一 index；与 `mp.weixin.qq.com` 共享 `mpv6.weixin.qq.com → sh.mp.weixin.qq.com` CNAME 链） | 官网 404，App 内广告**毫发无伤** |
| `ad.qq.com` | 200 HTML 4.7 KB | 腾讯营销投放管理平台 | 广告主后台不可达 |
| `e.qq.com` | 200 HTML 2.6 KB | 腾讯广告营销平台 | 营销站不可达 |
| `ads.weixin.qq.com`（复数） | **NXDOMAIN ×5** | 未注册 | 死规则 |

同族还有两个"名字骗人"的样本：`wxapp.tc.qq.com`（16 A，看着像小程序，实为 CNAME `socwxsns.video.qq.com`、证书 `*.video.qq.com` = **SNS/视频 CDN**）；`res.wx.qq.com` 根路径 404 但 `/a/wx_fed/assets/res/*.ico` = **200 image/x-icon** ⇒ **根路径 404 ≠ 死主机**。

### 3. 唯一可达面：`mp.weixin.qq.com`（路由探针 + 3 条处置）

**探针判据（控制组是这张表成立的前提）**：对明知不存在的路径，服务端稳定 **404 + 0 字节 + 无 Content-Type** —— `/mp/zz-not-exist-q7x2m9`、`/mp/getappmsgadx`、`/zz-not-exist-q7x2m9`、`/cgi-bin/zz-not-exist-q7x2m9`，GET/POST 全部 404。故下表 **200 = 路由真实存在**。

| 路由 | 探针结果 | 处置 |
|---|---|---|
| `/mp/getappmsgad` | GET 200 `text/html` 2138 B（`<title>验证</title>` + `retkey:11`/`logicret:-3`）；POST 200 `application/json` 111 B `{"base_resp":{"ret":-3,"errmsg":"no session"}}` | **字段级净化**（文中/文末广告） |
| `/mp/getappmsgext?__biz=…` | **200 JSON 374 B**（无 `__biz` 时 45 B `ret:-2`） | **字段级净化**（业务+广告同体） |
| `/mp/cps_product_info?action=1` | 200（裸路径 404） | **整条转空**（纯推广端点） |
| `/mp/profile_ext` · `/mp/homepage` · `/s?__biz=` | 200 | 业务入口，**不处置** |
| `/mp/ad` · `/mp/report` | POST 200（同一 `no session` 封套）；GET 返回验证页 | **不落地**：路由存在但**角色无证据**（无上游提及、拿不到内容级响应） |
| `/mp/getadinfo` · `/mp/advertisement` · `/mp/getadvertisement` · `/mp/getad` · `/mp/adinfo` · `/mp/getads` · `/mp/getappmsgadinfo` · `/mp/getappmsgadlist` · `/mp/appmsg_ad` · `/mp/getadvert` · `/mp/getadsinfo` · `/mp/getappmsgad/get` · `/mp/getappmsginfo` · `/mp/getcomment` · `/mp/getappmsglikes` · `/mp/getappmsglist` · `/mp/waplogin` · `/mp/getrecommend` · `/mp/getflowcontrol` · `/mp/getweappad` · `/mp/getwxagamead` · `/mp/getgamead` | **404（GET 与 POST 都是）** | 写上去即**死规则** |

**处置 1｜`/mp/getappmsgad` → `response.json.jq(".advertisement_num = 0 | .advertisement_info = []")`**
- 上游两份**直接挂本路径**的脚本逐字一致：`NobyDa/Script` `QuantumultX/File/Wechat.js` 与 `chxm1023/Advertising` `wxgzhad.js` 都是 `advertisement_num = 0; advertisement_info = []; delete appid`。二者脚本体与字段集逐字相同 ⇒ **按"作者+字符串"去重只能算 1 份强证据**（本仓 §2 判据）。
- 因此叠加**本仓一手观测**：`advertisement_info` 是 2026-09 活响应里真实存在的字段名（见处置 2 的 374 B 样本），且**空数组就是服务端自己的"无广告"状态** ⇒ 置空而非删 key，客户端拿到的结构与无广告时完全一致。
- **不整条拒**的理由：保留 `base_resp` 封套与结构（AGENTS.md《字段重命名法》条：结构保留比整条拒抗异常分支）。上游确实有三源整条拒（QingRex `Map Local data="{}"` / zirawell `reject-dict` / AWAvenue `||mp.weixin.qq.com/mp/getappmsgad^`），但 AWAvenue 把该条放在 `Replenish` 补充列表并自述「开启后对订阅号拦截会相当激进」。
- **不 `delete appid`**：该字段名语义泛化，无证据说明它只服务广告；广告载荷已由 `advertisement_*` 覆盖。
- **未采纳的旧字段名**：`advertisement`（ddgksf2013 文件头自述**已失效**、奶思 2023 旧形态）—— 留作真机回归后的第一顺位补充。

**处置 2｜`/mp/getappmsgext` → `response.json.jq(".advertisement_info = []")`（一手样本）**

```
$ curl -sS 'https://mp.weixin.qq.com/mp/getappmsgext?__biz=MzA5&mid=1&idx=1&sn=abc'   # 200, 374 B
{"advertisement_info":[],"appmsg_album_videos":[],"base_resp":{"exportkey_token":"","ret":0},
 "effective_content_last_html_node":[],"feeds_click_trigger_list":[],"link_component_list":[],
 "more_read_list":[],"neg_feedback_groups":[],"neg_feedback_options":[],"related_tag_video":[],
 "reward_head_img_infos":[],"reward_head_imgs":[],"sec_control":{"ad_violation_middle_page":0}}
```

`advertisement_info` 与 `more_read_list` / `appmsg_album_videos` / `link_component_list` 等**业务字段同体** ⇒ **绝不允许整条拒**（京东 `functionId=start` 白屏教训）。`sec_control` 是风控/中间页开关，**不碰**。

**处置 3｜`/mp/cps_product_info?action` → `reject_dict(200)`**
上游三源一致：`fmz200(奶思)` `^https?://mp\.weixin\.qq\.com/mp/cps_product_info\?action reject-dict` · `QingRex` `Map Local data="{}" status-code=200 header=Content-Type:application/json`（等价物，独立作者）· `zirawell` 并进 reject-dict 组。一手探针确认 `?action=1` = 200 而裸路径 = 404 ⇒ **带 `action` 才是业务分支**（正则据此写 `\?action`）。它是"文章内插入的商品推广卡"下发口，不承载正文 ⇒ 纯推广端点判据成立。

**为什么这三条都必须在 MitM 下**：`[Rewrite]` 只对 HTTP 与**经 MitM 解密**的 HTTPS 生效。解密面刻意只列 `mp.weixin.qq.com` 一个具体 host（无通配）—— 同一后缀下还挂着 `channels`/`open`/`res`/`dns` 等业务与解析主机。

### 4. 明确不落地（发现项 / 已否决面，防上游误伤回流）

| 面 | 依据缺口 | 处置 |
|---|---|---|
| 小程序广告素材 CDN：`wxsnsdy.wxs.qq.com`(6A) · `wxsnsdythumb.wxs.qq.com`(6A) · `wxsnsdy.video.qq.com`(6A) · `wxsnsad.tc.qq.com`(2A) · `wxsnsdy.tc.qq.com`(7A) · `wxa.wxs.qq.com`(2A) · `wximg.wxs.qq.com`(1A) · `wxsmw.wxs.qq.com`(**15A**) | 上游多源按域 REJECT（可莉/kelee 三镜像 · Kuroba `NextIDSeeRules` · 045200 · 8680 · FuGfConfig）+ DoH 存活，**但角色证据只有域名与上游**：本机对该族 80 **与** 443 一律 `curl(7)`@2–3 ms（本地过滤名单即时拒绝），拿不到内容级证据；且可莉原文的 **`wxsmsdy.video.qq.com`（sm）实测 NXDOMAIN**，被 Moli-X / Repcz / fmz200 三个镜像复制传播 ⇒「多源一致」是**假象**（本仓最需防的失效模式） | 停在发现项。落地前置：① 内容级角色证据（真机抓包或可达网络）；② **只写精确子域**，不得写 `DOMAIN-SUFFIX, wxs.qq.com`（会连带拒掉存活的 `wxa.`/`wximg.`/`wxsmw.`） |
| `masonryfeed` · `relatedarticle` · `relatedsearchword` · `searchkeywordreport` · `geticon` · `getainfo` · `jsmonitor` | zirawell 整条拒 + QingRex 置 `{}`，但语义是**相关阅读/推荐/图标**（非纯广告），且无字段证据可删 | 不落地（整条拒会清掉非广告内容） |
| `dl.wechat.com/checkresupdate` | `blackmatrix7` / `BOBOLAOSHIV587` 把 `dl.wechat.com` 当微信本体业务域分流（`HOST,dl.wechat.com,WeChat`）；收益（去开屏）与代价均未验证 | 不落地 |
| `payapp.weixin.qq.com/mchopenapp/goldplan/adpage` | **上游自相矛盾**：zirawell 拒该路径，而 Kuroba `FuLingAllowList` 写 `@@||payapp.weixin.qq.com^` 白名单整域；且属支付面（M4） | 不落地 |
| `ad.weixin.qq.com` / `adn.` / `adtest.` / `adcdn.weixin.qq.com` | 实测是官网 SPA（§2 ③） | **已否决面**（零收益） |
| `mmgame.qpic.cn` · `mmsns.qpic.cn` · 任何 `qpic.cn` 系 | 与本仓 `DOMAIN-SUFFIX, qpic.cn, DIRECT` **跨层矛盾**；既有先例 `qidian.qpic.cn` 因"书封面图床"被撤销 | **已否决面** |
| `finder.weixin.qq.com` / `finds.weixin.qq.com` | 045200 的规则已过期（实测 NXDOMAIN） | 不落地 |
| `static.wxqcloud.qq.com.cn`(3A) | AWAvenue 自述逐字「部小程序依赖此域名加载 css, well, he's here now.」；实测 403 `application/xml` = 对象存储桶 | 不落地（上游自己承认会破小程序） |
| `dns.weixin.qq.com` / `aedns.weixin.qq.com` | 微信自带 DNS 下发口（见 §5） | 归 L0 `dns-httpdns.plugin`，**不在本插件** |

### 5. 跨层矛盾登记（本轮新发现，附新门禁方向）

`Plugin/dns-httpdns.plugin` 的 `DOMAIN, aedns.weixin.qq.com, REJECT` 与 `DOMAIN, dns.weixin.qq.com, REJECT` 被主配置 `template/loon.tpl` 的 `DOMAIN-SUFFIX, weixin.qq.com, DIRECT` 罩住 —— 官方《规则》「规则来源优先级：**本地规则 > 插件规则 > 订阅规则**」+ 域名类规则首次命中即停 ⇒ **这两条永不生效**。同组第三条 `dns.weixin.qq.com.cn` 不在 `weixin.qq.com` 后缀下，是唯一真生效的一条。
后果：微信自带 DNS 下发口实际未被收编 —— `dns.weixin.qq.com`（14 A）的 `/` 与 `/dns-query` 均 404（47 B 通用 404），但 `/cgi-bin/micromsg-bin/newgetdns` = **200 `text/xml` 2792 B（加密体）** ⇒ 它是**客户端专用 DNS 下发业务接口**，不是标准 DoH 解析器（`/dns-query` 探针判据在这台上不成立）。

**门禁补向**：`tools/plugin-lint-check.mjs` 原先只有「插件 `DIRECT` 被主配置 `REJECT` 覆盖」这一个方向，反方向（插件 `REJECT` 被主配置 `DIRECT` 覆盖）**没有任何检查** —— 微信白名单组就是这个方向的活样板。本轮补上，**只报告不判红**（与既有跨层条一致：冲突要显式化，不替用户选边）。
**若要真收编**：把两条例外写在主配置该 `DIRECT` **之前**（`apple.com` 顺序纪律样板，由 `test/cases/rule-shadow.test.js` 守）。本轮**未改路由** —— 拦微信自带 DNS 存在未验证的功能性权衡（微信是否优雅回落系统 DNS），按「跨层矛盾让用户决定改哪边」的纪律只登记、不擅自改。

### 6. 已知残留风险（诚实记录，未闭合）

1. **真机回归未做**：匿名请求拿不到带会话的响应体（`ret:-3 no session`）⇒ ① `advertisement_num`/`advertisement_info` 是否为 `getappmsgad` 的**顶层字段**，证据来自上游两份同源脚本 + `getappmsgext` 一手样本，**不是本端点的样本**；② 置空后客户端是否只是留白广告位。若真机发现无效：第一顺位补 `.advertisement = []`，第二顺位改 `reject_dict(200)`。
2. **证书固定**：若微信对 `mp.weixin.qq.com` 启用证书固定，本插件 `[Rewrite]` 全部静默失效（症状：Loon 日志命中但文章广告不变）。该主机是 WebView 承载的 H5 业务域，与原生 MMTLS 面不同，概率低但**无法离线证伪**。
3. **解密面代价**：`mp.weixin.qq.com` 承载**全部公众号文章流量** ⇒ 装本插件即把微信 H5 文章流量纳入解密面。这是本插件唯一的成本（换取的是仅 3 条规则的收益），用户可按需在客户端停用。
4. **字段元素结构未知**：一手样本里 `advertisement_info` 是**空数组**（服务端无广告时的状态），其元素结构无法观测 —— 本仓只做"置空"，不依赖元素结构，故不受影响；但这也意味着**无法从样本推断广告位的渲染条件**。

### 7. 复跑命令

```bash
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) MicroMessenger/8.0.49'

# 1) 「朋友圈广告」候选域五路 NXDOMAIN（含腾讯自家 doh.pub 与不过滤的 AdGuard）
for r in cloudflare-dns.com dns.google dns.alidns.com doh.pub; do
  curl -sS -m10 -H 'accept: application/dns-json' "https://$r/dns-query?name=wxsnsad.qq.com&type=A"; echo; done
curl -sS -m10 -H 'accept: application/dns-json' \
  'https://unfiltered.adguard-dns.com/resolve?name=wxsnsad.qq.com&type=A'

# 2) 控制组 + 路由存在性（顺序不能颠倒：先证控制组 404，再读 200）
curl -sS -m10 -o /dev/null -w 'control %{http_code}\n' -A "$UA" 'https://mp.weixin.qq.com/mp/zz-not-exist-q7x2m9'  # 404
curl -sS -m10 -o /dev/null -w 'getappmsgad %{http_code}\n' -A "$UA" 'https://mp.weixin.qq.com/mp/getappmsgad'     # 200
curl -sS -m10 -X POST -A "$UA" -H 'Content-Type: application/json' -d '{}' \
     'https://mp.weixin.qq.com/mp/getappmsgad'                                    # 200 JSON {"ret":-3,"errmsg":"no session"}

# 3) 一手字段样本（374 B，含 advertisement_info）
curl -sS -m10 -A "$UA" 'https://mp.weixin.qq.com/mp/getappmsgext?__biz=MzA5&mid=1&idx=1&sn=abc' | python3 -m json.tool

# 4) 名义陷阱 + 根 404 ≠ 死主机
curl -sS -m10 -o /dev/null -w 'ad.weixin %{http_code} %{content_type}\n' 'https://ad.weixin.qq.com/'
curl -sS -m10 -o /dev/null -w 'res.wx root %{http_code}\n' 'https://res.wx.qq.com/'
curl -sS -m10 -o /dev/null -w 'res.wx icon %{http_code}\n' 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico'

# 5) MMTLS 面（有 A 但 TLS 不通）+ 小程序素材族（本机过滤 ⇒ curl(7)，只能拿 DoH 存活）
curl -sS -m10 -o /dev/null -w 'long.weixin %{http_code} rc=%{exitcode}\n' 'https://long.weixin.qq.com/' 2>&1 | tail -1
curl -sS -m10 -H 'accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name=wxsnsdy.wxs.qq.com&type=A'

# 6) 微信自带 DNS 下发口 + 跨层矛盾（新门禁方向）
curl -sS -m10 -o /dev/null -w 'newgetdns %{http_code} %{content_type}\n' \
  'https://dns.weixin.qq.com/cgi-bin/micromsg-bin/newgetdns'
node tools/plugin-lint-check.mjs | grep 跨层空转
```

**门禁**：`test/cases/wechat.test.js`（6 例）把本附的 3 条台账、13 条不落地/已否决面、App 身份与覆盖天花板写进断言 —— 台账与插件注释互为正本，改一处不改另一处即判红。
**顺带补上的门禁盲区**：`tools/plugin-lint-check.mjs` 的跨层矛盾扫描原为**单向**（只查"插件 DIRECT 被主配置 REJECT 覆盖"）。微信白名单组暴露了反方向同样成立且**后果更隐蔽**（规则语法合法、门禁全绿、实际永不命中）⇒ 本轮补上「插件非 DIRECT 规则被主配置 DIRECT 覆盖」的扫描（`AND` 锚定行不适用，方法/后缀两形态按官方优先级判），首跑即抓出上述 2 条。

---

## 附十：钉钉 DingTalk（2026-09-30）

本 App 是本仓**第一个「去广告只落在 L2、没有 L4」的接入**，且取证过程推翻了两个先入为主的判断。

### 1. App 身份

| 项 | 值 | 取证 |
|---|---|---|
| iOS bundle | `com.laiwang.DingTalk` v9.0.2（2026-09-28 发布） | iTunes Lookup `id=930368978` / `bundleId` 查询 |
| 运营主体 | DingTalk Technology Co., Ltd. | iTunes Lookup `sellerName` |
| 安卓包名 | `com.alibaba.android.rimelight` | 沿用公开资料，**本轮未复核**（应用宝无该包页面） |

### 2. 平台层一手声明：官方自列 26 个第三方 SDK，**广告 SDK 只有 1 个**

《钉钉第三方SDK收集使用信息说明》（`terms.alicdn.com/legal-agreement/terms/suit_bu1_dingtalk/suit_bu1_dingtalk202010091407_23127.html`）
逐个列出 26 个 SDK（荣耀/华为/VIVO/OPPO/小米/魅族推送 · 支付宝 · 高德 · 优酷投屏 · 淘宝SDK/UT/开放平台 ·
阿里安全 · UC浏览 · 阿里体育 · 新浪/腾讯分享 · 阿里云号码认证 · WPS · 安恒密盾 · 金格手写签注 · 华为手写笔 ·
Google Chromium/FCM · Rokid RealityCraft · **BeiZi SDK**）。

**26 个里只有 `BeiZi SDK`（上海倍孜网络技术有限公司）用途写明「用于为用户推送开屏广告」。**
⇒ 平台层判据成立，且该 SDK 的域**本仓早已覆盖**（`DOMAIN-SUFFIX, beizi.biz, REJECT` 在主配置，
`beizi.info` / `beizi.online` 在 ad-block 生成块）。

**这一条本身就说明"抄 SDK 清单"不够** —— 清单给出的是**已覆盖**的部分，真正缺的在下面。

### 3. 端点层：真正的缺口是两条**阿里广告域**，与钉钉 App 无绑定关系

上游社区（`afwfv/DD-AD` 私有规则，钉钉节 + 字节系节）给出 3 条钉钉相关域，逐条对账本仓：

| 域 | 本仓状态 | 探针（双解析器 + 泛解析对照） |
|---|---|---|
| `h-adashx.ut.dingtalk.com` | **已覆盖**（主配置，2026-08 HAR 审计轮引入） | 1 A（47.246.182.10），随机子域 clean |
| `adashx.ut.dingtalk.com` | ❌ 缺 → **本轮补** | 多条境内 CDN A 轮换（183.240.215.66 / 112.51.127.14 / 203.119.213.226 / 101.206.204.89），随机子域 NXDOMAIN ⇒ 非泛解析；TCP 80/443 可连但 **TLS 握手被服务端重置**（`SSL_ERROR_SYSCALL`）⇒ 本机不可测 |
| `adash-emas.cn-hangzhou.aliyuncs.com` | ❌ 缺 → **本轮补** | 6 条 A（8.132.237.135/161 · 47.116.84.225 · 106.15.83.128/130 · 139.196.135.6），随机子域 NXDOMAIN ⇒ 非泛解析；HTTPS 根 `403 aserver/2.0.0`、其余 9 路径 `404 text/html`（同 170B）⇒ **端点型**；证书 `CN=*.cn-hangzhou.aliyuncs.com`，AS37963 **Hangzhou Alibaba Advertising Co.,Ltd.**（ipinfo 实测） |

**为什么它们不构成"钉钉专属广告面"**（这一条决定了归属，也是本轮最容易被做错的地方）：
`adashx.ut.<app>` 是一个**跨 App 的阿里 UT 广告交换家族** —— 实测 `adashx.ut.alibaba.com` /
`adashx.ut.cainiao.com` / `adashx.ut.taobao.com` / `adashx.ut.amap.com` / `adashx.ut.1688.com`
**全部存活**。而 `adash-emas` 挂在**阿里云** `*.cn-hangzhou.aliyuncs.com` 下，归属是广告公司主体。
⇒ 它们是**阿里广告平台的基础设施**，不是钉钉私有域。拦它们对淘宝/菜鸟/高德等同样生效（跨 App 影响）。

### 4. 已否决的候选（不写规则，逐条给理由）

| 候选 | 否决理由 |
|---|---|
| uni-ad / HUAWEI Ads / MMA / MSA | 前缀枚举**无存活端点**（`ad-api.uniad.dcloud.net.cn` 等全 NX；`ads.huawei.com` 301 平台站、`hmsads.hicloud.com` 全 NX；`mmachina.cn` 200 HTML 协会官网） |
| TalkingData `api.talkingdata.com` | A 存活但 **HTTPS 不可测**，且用途是"数据分析与统计" ⇒ M3 隐私面非广告面，按模块纪律不塞进 M2 |
| Tanx 家族（`task./sdk-config./videoproxy.tanx.com` 等 6 条） | 端点存活（`task.tanx.com` 200 / `sdk-config` 302），但**钉钉隐私政策未声明 Tanx**、社区清单把它挂在别的小节 ⇒ 平台层无一手依据，不凭域名字义加 REJECT |
| 官网 / H5 面 | `www./h5./app.dingtalk.com` 与 `n.dingtalk.com` 全部**无任何广告域**（逐页扫第三方域，amap/aplus 属地图与统计非广告）；`n.dingtalk.com` 全部路径返同一 2857B HTML（catch-all SPA） |

### 5. 为什么**没有 L4**：开放平台逐路径枚举证明钉钉无广告 API

钉钉的 HTTP 面分两层，都探过了：

- **开放平台**（`oapi.dingtalk.com/topapi/v2/<ns>/<action>`）：网关对**未知 ApiName** 返
  `errcode=22 不合法ApiName`，对**存在但缺 token** 的返 `errcode=88 access_token is blank`
  —— 这是一个**可用的枚举 oracle**。据此逐一探测 `ad / advert / advertisement / splash / splashad /
  banner / promotion / promo / recommend / feed / marketing / ut / adconfig / adlist` 共 13 个命名空间：
  **全部 errcode=22**（对照 `user/get` 返 88 ⇒ oracle 本身有效）。⇒ 开放平台**不存在广告 API**。
- **App 数据面**：`app./biz./n./oapi.` 上的 `/ad /splash /getAd /adConfig /adlist …` 全部是
  catch-all 或 Spring Boot 404；`nc./conn./longconn./gw.dingtalk.com`（钉钉自有长连接）**四个全 NXDOMAIN**。
  结合阿里 IM 技术公开资料，钉钉客户端主链路是 **DTIM 私有二进制协议 + 加密长连接**，
  与微信 MMTLS 同类 ⇒ 即使有广告下发，它也**不在 HTTP 面上**，`[Rewrite]` 结构上不可达。

### 6. 关键业务事实：官方关闭广告是**付费**的

媒体报道（界面新闻 2024-11《钉钉向广告低头》、2025-04）一致：钉钉客服的答复先是"提供手机号为您反馈关闭广告"，
后改为"**开通钉钉365会员后支持关闭广告**"。广告位已扩散到**开屏 + 下班打卡 / 签到 / 加班审批 / 工作日志 / 直播回放**。

⇒ **网络层是唯一不花钱的处置路径**，这正是本轮补那两条域的现实意义；
但也意味着**不存在"App 内开关"可抄**（钉钉是 To B，SaaS 侧无个人版广告设置项）。

### 7. 为什么落**主配置**而不是 L0 插件（跨层判断，本轮的关键决策）

主配置「国内广告 SDK 硬拦截」段的纪律 ① 写明：**插件 `[Rule]` 优先级低于本地 `[Rule]`，国内域会被
`GEOIP,CN,DIRECT` 直连截胡**。本轮实测这两个域的 A 记录**全部落在境内**
（ipinfo：`CN Chongqing AS134420` / `CN Guangdong AS56040` / `CN Shanghai AS37963 Alibaba Advertising`）
⇒ 放插件有被本地 GEOIP 截胡的风险，**放主配置 `GEOIP,CN,DIRECT` 之前**才是有效拦截。

同一家族既有的 `h-adashx.ut.dingtalk.com` 与 `adashbc.ut.taobao.com` 也都在主配置同段，口径一致。

⚠️ **未解决的开放问题**（登记待裁决，不静默）：这两条域归 M2 广告治理、但**物理落在 M1 分流的主配置里**，
与"广告域单一真源在 ad-block.plugin"的集合化决策有张力。可能的处置：
① 维持主配置（当前，本轮选择 —— 有效性优先）② 把国内广告域整体移进一个专用 L0 插件并重排优先级
③ 两者都做但用门禁断言无重复。**在真机验证"插件能否拦境内域"之前不做结构性调整**。

### 8. 复跑命令

```bash
# 平台层一手声明: 26 个 SDK 里只有 BeiZi 是广告 SDK
curl -sS -m15 'https://terms.alicdn.com/legal-agreement/terms/suit_bu1_dingtalk/suit_bu1_dingtalk202010091407_23127.html' \
  | grep -oE '(BeiZi|倍孜)[^<]{0,80}' | head

# 端点层: 双解析器 + 泛解析对照
for d in adashx.ut.dingtalk.com adash-emas.cn-hangzhou.aliyuncs.com; do
  curl -sS -m10 "https://dns.google/resolve?name=$d&type=A" | head -c 300; echo
  curl -sS -m10 "https://dns.google/resolve?name=zznp-\$RANDOM.$d&type=A" | head -c 120; echo  # Status 3 = 非泛解析
done
curl -sS -m12 -o /dev/null -w '%{http_code} %{content_type}\n' 'https://adash-emas.cn-hangzhou.aliyuncs.com/'  # 403 aserver/2.0.0

# 跨 App 家族证明(它们不是钉钉私有域)
for a in dingtalk alibaba cainiao taobao amap 1688; do
  printf '%s ' "$a"; curl -sS -m8 "https://dns.google/resolve?name=adashx.ut.$a.com&type=A" \
    | python3 -c 'import sys,json;d=json.load(sys.stdin);print("ALIVE" if any(x["type"]==1 for x in d.get("Answer",[])) else "-")'
done

# L4 不存在的证明: 开放平台枚举 oracle (errcode 22 = 无此 API; 88 = 存在但缺 token)
for a in user/get ad/list splash/list banner/list recommend/list; do
  printf '%-18s ' "$a"; curl -sS -m10 "https://oapi.dingtalk.com/topapi/v2/$a" | head -c 60; echo
done
```

**门禁**：`test/cases/dingtalk.test.js` 把本附的处置台账（2 条补 + 1 条既有）、否决清单、
"插件 `[Rule]` 不得承载这两个域"（跨层纪律 ①）、以及**开放平台 oracle 探测必须在仓库里留下取样**
等属性固化 —— 台账与主配置注释互为正本，改一处不改另一处即判红。
