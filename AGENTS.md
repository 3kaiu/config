# AGENTS.md

Loon 单入口配置仓库：`Profile/Loon.lcf` 由 `template/` + `surgio.conf.js` 生成；`Scripts/` 除 `Qidian.js` 外均为 `src/*.ts` 的 esbuild 产物。

**资源组织以 [`MODULE-MANIFEST.json`](MODULE-MANIFEST.json) 为单一真源**（人类可读投影见 [`MODULES.md`](MODULES.md)），按 **Loon 介入层 L0–L6** 而非官方文档域归类为 **M1–M7** 七个模块。改动任何插件/脚本/snippet 前先查归属。

## 命令

- `npm run build`：注入 `src/env.ts` 与 `src/lib/*.ts`，把 `src/*.ts` 压缩到 `Scripts/`。改源码后必须执行。
- `npm test`：117 个行为级用例，引用全部 1 个 Scripts 产物（`Qidian.js` 手工轨）；随后执行规则顺序与接线检查。关键文档数字由 `tools/doc-claims-check.mjs` 对照实测。
- `npm run lint`：ESLint flat config，检查 `Scripts/`、`test/`、`tools/`。
- `npm run generate`：Surgio 3.19 从纯静态模板生成 `Profile/Loon.lcf`。该命令会创建空 `dist/`，`.gitignore` 中对应规则必须保留。
- `npm run check:all`：串行执行 sync、rewrite、src、orphan、plugin、contract、workflows、scripts、index 门禁；不包含 build、test、lint、generate。`scripts` 把 build 命令重定向到**临时目录**重建后与 `Scripts/` 逐字节比对 —— 补的是本地盲区：手改产物或改了 src 没 build 时，其余门禁会全绿。
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
| `Plugin/*.plugin` | Loon 插件外壳（**仅 `qidian.plugin`**） | `[Script]`/`[Rewrite]`/`[MitM]` 与参数必须配套 |
| `template/loon.tpl` | Loon 模板 | 修改后 regenerate + `check:sync`；`Proxy` 必须直接聚合外部订阅策略组"东京" |
| `template/snippet/*.tpl` | 分流规则片段 | 归 M1（5 个）或 M4（1 个） |
| `MODULE-MANIFEST.json` | 资源归类真源 | 改插件/脚本必须同步，否则 `module-manifest` 门禁判红 |
| `APP-INDEX.json` | App→归属反查 | **由 `tools/app-index.mjs` 从插件本体抽取，勿手改**；`check:index` 判红即漂移 |
| `tools/app-index.mjs` | 索引生成器 + `--check` 门禁 | App 名只认 manifest 声明，不从开关 tag 猜 |
| `provider/empty.js` | Surgio 零节点适配器 | 不读取订阅、不保存凭据 |
| Loon 外部订阅 | 用户在客户端导入，策略组名固定为"东京" | 节点与凭据不进仓库 |
| `Profile/Loon.lcf` | 唯一发布入口 | 生成物，不手改 |
| `tools/*.mjs` | 已接线门禁 | 每个工具必须被 workflow、npm check 或测试调用 |
| `test/cases/*.test.js` | 行为与静态回归 | 响应脚本必须断言 `$done` |
| `test/lib/mitm-hosts.mjs` | MitM 解密面 host 提取 | 非用例文件，勿删 |

## 广告面治理纪律

以下纪律的具体资源随插件下线已不存在，但**判据本身仍适用** —— 新增任何广告拦截都按此办理：

- **广告面台账**：逐条登记处置方式（`rejected` 整条拒 / `rewritten` 字段重命名 / `purged` 字段级净化 / `domained` DNS 整域）与状态（`covered`/`inert`/`uncertain`/`rejected`），并断言「已覆盖面全部有规则落地」「**已否决面必须不存在对应规则**（防上游误伤回流）」「台账自洽」。
- **整条 reject 只用于纯广告接口**：京东 `functionId=start` 同时下发启动配置与开屏图，整条 `reject-200` 会致白屏 —— 必须改为响应体改写。**一个接口既下发业务数据又下发广告，就不能整条拒**。
- **字段重命名法**：`response-body-replace-regex` 把广告字段的 key 改名成客户端认不出的名字。响应结构与 code 校验全保留，比 reject 抗异常分支。用例禁止外溢到主 App 通道。
- **域名 REJECT 必须先取证**：京东 `du.jd.com`/`c-nfa.jd.com` 探针实证是**店铺域**（302 → `error2.aspx?from=shopdomain`），误拦直接破店铺页；`jzt.jd.com` 是对外 Jenkins CI。凭域名字义加 REJECT 是本仓已犯过的错 —— 新增前须 DoH + HTTPS 探针。
- **策略层 REJECT 变体缺口**：`[Rule]` 策略层 122 条全是裸 `REJECT`（官方共 5 种变体，`-IMG`/`-DICT`/`-ARRAY`/`-DROP` 均 0），全部退化为 404，部分 App 会因非预期状态码重试。**注意**：`REJECT-VIDEO`/`REJECT-NO-DROP` 不存在于官方《策略》文档，「REJECT 被自动升级为 REJECT-DROP」亦无出处 —— 变体分派须按上游响应形状取证，**不得按域名字符猜**（这是 P3 暂缓的原因：根路径探测拿不到 POST 型 API 的响应形状，须真机 HAR）。
- **App 归属反查**：回答"某 App 的广告归谁管"用 `APP-INDEX.json`。**App 名不得从开关 tag 猜** —— tag 写法不统一（`是否开启X净化`/`X净化`/`开屏广告`/`总开关` 四类），启发式会把同一 App 记成两个名字；可靠的自描述是**开关 KEY**（`LUCKINCOFFEE_ENABLE`→瑞幸咖啡）。只能定位到插件级的归属必须标 `rules_basis=plugin-total`，不许假装精确。
- 清理冗余解密面由两条门禁守住：`mitm-orphan`（每个正包含 MitM 域须有规则消费）+ `mitm-coverage`（每条 Rewrite 规则须有解密面）。通配 host 会被判为 generic 而恒被报孤儿，须显式列举。

## CI 门禁

- `script-tests.yml`：lint、build、Scripts 漂移、117 用例、构建出处 attestation。
- `config-validate.yml`：MitM、插件结构、参数契约、源码反模式、workflow bash、模板同步、Qidian 哈希、规则冗余、模块清单、接线与银行域名断言；独立 job 重生成 Loon 配置验证幂等。
- `surgio-build.yml`：模板/构建配置变化后自动生成 PR；发布前检查无凭据且 `[Proxy]` 无静态节点。
- `upstream-health.yml`：客户端直连的 GeoIP mmdb + 自建 CDN（Plugin/Scripts）可用性。探活目标由 `upstream-coverage` 门禁双向锁死（漏探活与探死资源都判红）。
- `dependency-audit.yml` / `release.yml`：构建期依赖风险 / tag 版本快照。
- `codeql.yml`：advanced setup，扫描面由 `.github/codeql/codeql-config.yml` 的 `paths` 白名单限定为 `src/`/`tools/`/`.github/workflows/`。workflow 自身的 `on.push.paths` 只是**触发器**、不限定分析范围。advanced 与 default setup 互斥。

## 约束与已知边界

- 不提交 secret。机场订阅由用户在 Loon 外部导入，仓库不保存 provider、节点或订阅 URL。
- 发布面是公开 GitHub 与 `ws.wenn.in` CDN；GitHub Pages 已退役。
- **单插件基线的已知代价**（均为用户决策，非缺陷；详见 git 历史）：
  - **App 内部结构化广告位无法清理**：去广告只剩主配置 122 条已取证 REJECT + bank-ad-reject snippet + 起点插件的字段级净化。46 个 CDN 插件下线前实测全 200 存活（2130 条规则 / 994 个解密 host）。
  - **长尾广告域不再被 REJECT，一律走 `Final`**：原 12 万条通用广告域名表 + 7 个镜像规则列表已移除。
  - 失去镜像供应链门禁（sha256 + 投毒/体积 + 漂移/孤儿）。
  - 失去 `check:shadow`（远程列表顺序遮蔽检测）—— 无远程列表后该失效面本身已不存在。
- [Rule] 483 行；1 个插件 = 全部在 `Plugin/`（仅 `qidian.plugin`）。
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
