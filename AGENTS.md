# AGENTS.md

Loon 配置仓库:单入口 `Profile/Loon.lcf`,由 `surgio` 从 `template/` + `surgio.conf.js` 构建;`Scripts/` 全部为 `src/*.ts` 的 esbuild 产物。

## 命令

- `npm run build` — esbuild 注入 `src/env.ts` + `src/lib/*.ts` 编译 `src/*.ts` 到 `Scripts/`(minify)。改 src 后必须 build
- `npm test` — 143 个行为级用例(含 `tools/` 单测),引用全部 27 个 Scripts 产物
- `npm run lint` — eslint(flat config)
- `npm run generate` — surgio 构建 `Profile/Loon.lcf`(surgio 3.19,内联 providers,无 patch)
- `npm run check:sync` — tpl-sync-check 正反向比对 template ↔ Loon.lcf
- `npm run check:orphan` — mitm-orphan-check 本地模式(孤儿 hostname = 无收益的解密面扩张)
- `npm run check:plugin` — plugin-lint-check 段结构与规则语法
- `npm run check:workflows` — workflow-bash-check 校验全部 `.github/workflows/*.yml` 的 run 块 bash 语法。**只校验 bash 语法**,run 块内嵌的 node/python 代码错误与逻辑错误不在其范围
- `npm run audit:ci` — `npm audit` 固定走 `registry.npmjs.org`(默认镜像未实现 `/-/npm/v1/security/*`,本地直接不可用);结果解读见「架构已知问题」

## 关键路径

| 路径 | 角色 | 规则 |
|---|---|---|
| `src/*.ts` | 唯一源码(JS 语法,esbuild 直编) | 可改;git rm 过的 tsconfig/loon.d.ts 是死配置 |
| `src/lib/*.ts` | 共享模块(`net`/`ad`/`notify`),**不作为入口打包** | 经 esbuild `--inject` 注入,导出名在脚本中直接当全局用(同 `Env`);build 的 `find` 已 `! -path 'src/lib/*'` 排除,勿加回 |
| `src/env.ts` | `Env` 注入源(兼容层 + fetch/notify 封装) | 同上;`src/lib/notify.ts` 是其通知能力的**子集**(无 PushPlus),合并属行为变更需单独决策 |
| `Scripts/` | build 产物 + `Qidian.js`(手工轨,无源码,rc4 加密) | 不手改;Qidian.js 改动须同步 `Scripts/ENGINE-MANIFEST.json` 哈希 |
| `Plugin/*.plugin` | 净化器插件外壳(仓库静态资产,script-path 直连 CDN 的 Scripts/) | 改后须核对 triger 与 script-path;`startup-adblock-pro.plugin` 由 `tools/build-startup-plugin.mjs` 从 `Mirror/rules/ddgksf-StartUpAds.conf` 生成(手写补充块在 BEGIN/END 3kaiu 标记内,勿改生成块) |
| `Kelee/*.plugin` | keele 上游插件外壳(15 个:12306/guiderank/smzdm/umetrip/YouTube + Google/Telegram/QuickSearch 等),上游在 kelee.one | 与 Plugin/ 同规则,config-validate 覆盖 |
| `Mirror/` | 上游镜像:auraflare/biliuniverse/dualsubs/iringo/rules/scripts + 独立 js + ddgksf-StartUpAds.conf(开屏数据源) | mirror-scripts 每日重写 `Mirror/MANIFEST.json`(dict: $comment/generated_at/files);每条含 `source_url`/`sha256`/`bytes`/`fetched_at` + `upstream_bytes`(原始抓取体积,**不含**本地 sed 补丁增量 — 供体积门禁做相对比较,勿当"文件大小"用);手改镜像文件须同步重算该条 sha256/bytes(否则 config-validate 8b 红);镜像**文本**文件由工作流在哈希前统一归一化为 LF —— 行尾不一致同样会让 8b 红(见「门禁」mirror-scripts ③) |
| `template/loon.tpl` / `surgio.conf.js` | Loon 配置构建输入 | 改模板后须 regenerate + check:sync;**client 侧远程引用一律走自建 CDN,勿直连 S3/其他带外副本** |
| `Profile/Loon.lcf` | 发布入口唯一文件 | 不动;生成物(手改会被 artifact-idempotency job 判红) |
| `Profile/geonode.loon.txt` | proxy-sync 生成物 (Loon [Remote Proxy] Geonode 订阅源, 幂等;节点经连通性探测) | 不动;生成物 |
| `tools/*.mjs` | tpl-sync / 验证脚本 | 改动后跑 check:sync;`geonode-sync.mjs` 有入口守卫,可安全被测试 import(勿在顶层无条件调 `main()`) |
| `test/cases/*.test.js` | 143 用例 | 新增/改脚本须补用例;响应类脚本用 `a.doneCalled(state)` 断言 `$done` 被调用;`.mjs` 工具用动态 `import()` 引入(勿用 `require(esm)`,会无谓抬高 engines 下限) |

## 门禁(全部在 `.github/workflows/`,push 前本地自测)

- script-tests:build 后 git diff Scripts/ 漂移门禁 → 本地必须先 build 再提交
- config-validate:净化器断言 + mitm-orphan + ENGINE-MANIFEST 哈希 + workflow bash 语法(step 5c-bis) + 银行 MitM **三重断言**(规模下限 / 20 家关键银行点名在场 / 正负向无重叠 — 2026-09-11 前为永不失败的 print);另有独立 job `artifact-idempotency` 重跑 `surgio generate` 并断言 `Profile/Loon.lcf` 零漂移(手改产物即红)
- mirror-scripts:镜像 fetch/结构/投毒门禁 + MANIFEST 重写,失败 keep_old;体积门禁 = 绝对 200B **+ 相对上次原始抓取 50%**(`upstream_bytes` 为基准,自校准到每个文件量级 — 单一绝对阈值对 588B~3.9MB 的列表无意义);MANIFEST sha256 在**补丁后 + 行尾归一化后**从磁盘重算;旧清单条目不在本轮覆盖时孤儿保留(防清单漏项静默删仓库文件);StartUpAds.conf 镜像后由 `tools/build-startup-plugin.mjs` 重新生成 startup 插件(随镜像 PR 一并审核);DualSubs 补丁把上游 `releases/latest` 浮动 script-path 锁到具体版本,补丁后仍有浮动引用即判红。**盲区**:"Open or update mirror PR" 步骤是 bash **运行期**行为,`check:workflows` 只做语法校验抓不到 — 2026-09-11 连修两处:①`printf` 格式串里的裸 `50%)`(报 `%): invalid format character` → exit 1),该 bug 让分支照常 force-push 但 PR 标题/正文永远更新不到,静默持续多日,表现仅为"镜像 PR 标题日期停在创建日";**printf 的格式串里字面量 `%` 必须写 `%%`**。②`git rebase` 在 `Mirror/iringo/iRingo.News.plugin` 上以 `local changes would be overwritten` 中止 —— 根因是该文件**在 main 上的 blob 是 CRLF**,违反 `.gitattributes` 的 `* text=auto eol=lf`,而镜像步骤写回的工作区副本同样是 CRLF,git 便认定有本地修改。**已修复**(见 ③ 的行尾归一化)。**已逐一实测无效,勿重试**:`git checkout --` / `checkout-index -f -a` / `stash push+pop`(还会静默丢改动) / `--autostash` / `-c merge.renormalize=true` / 手工 strip CR。该 bug 仅在 **origin/main 于本 run 期间前移**时触发(2026-09-11 因推送撞上镜像 run 才暴露),平时 schedule(03:00 UTC)早于 proxy-sync(03:40 UTC)故不显形。**此场景下 `git status` 不可信**:同一仓库不同 clone 表现不同(实测本地报 clean / 全新 clone 报 ` M `),而 `git checkout <ref>` 会直接拒 —— 判定行尾问题请用 `git cat-file blob <ref>:<path> | grep -c $'\r'`。③**MANIFEST 哈希漂移(同源第三张面孔)**:清单是**从磁盘原始字节**哈希的,而 `git add` 按 `.gitattributes` 把 CRLF 归一化为 LF 再写入 blob → 上游本就是 CRLF 的 `iRingo.News.plugin` 被记成 `2349B/92d0dc9c…`,committed blob 实为 `2317B/1065a500…`(`2349-2317 = 32` = CRLF 行数),CI checkout 后重算必然漂移(8b 报 `53 条里 1 条异常`,run 34527842350)。**修复** = 哈希前把镜像文本文件统一为 LF(`行尾归一化` 块;扩展名白名单须与 `.gitattributes` 的 text 声明一致,同时保证二进制镜像不被误改),使 disk == index == blob。三张面孔(blob 违反 .gitattributes / rebase 中止 / 清单漂移)同源,一次归一化全消。**注意** `upstream_bytes` 语义不变(仍是本地 sed 补丁前的原始抓取体积,供体积门禁做相对比较);归一化只影响 `bytes`/`sha256`
- upstream-health:探测列表 = MANIFEST 派生镜像 + 硬编码上游(含 kelee.one LPX、NSRingo 已钉死版本),失败开 issue;结果 JSON 经 TSV→stdin 单次转换(勿把探活字段插值回 node 源码)。**注意**: workflow 声明 `latest` 不等于 MANIFEST 实际跟进 — `keep_old` 会在 fetch 失败时静默保留旧版, 需额外比对 workflow 声明 URL 与 MANIFEST `source_url` 才能发现漂移(见 2026-09-11 分模块审计 MOD-09)
- proxy-sync:每日 03:40 UTC 拉取免费代理源 → 转换写入 Profile/geonode.loon.txt (Loon [Remote Proxy] Geonode 订阅, 仅 OpenCode 组引用), 有变更直推 main(非 PR 制 — 数据刷新, 免费代理无投毒面);源失败保留旧文件
- cdn-verify:CDN 与仓库哈希比对 + Pages 兜底 parity(Pages 未启用时跳过)
- surgio-build:仅在 surgio.conf.js/template/**/package.json 变更时构建并 auto-PR

## 约束

- 不提交 Secrets;workflow secrets 仅 BARK_PUSH(可选)
- 发布面 = 公开 GitHub + ws.wenn.in CDN(Cloudflare,max-age=3600);GitHub Pages 未启用(2026-08 起无 pages-deploy 工作流,不可作为应急兜底通道)
- QX 已彻底移除,任何涉及 QX 的改动/引用皆为回归
- 依赖仅 3 个 devDependencies(esbuild/eslint/surgio),无运行时依赖,无 typescript;升级须过 build+143 测试;`engines.node >= 22`(CI 与本地一致)

## 架构已知问题(勿重改)

- `Scripts/Qidian.js` 无源码(上游 qidian 引擎,密文打包)
- [Rule] 483 行(2026-08-29 实测,主 [Rule] 段非注释行);GEOIP 顺序已修;AdBlock 域硬拦截已覆盖规则
- `npm audit` 告警(2026-09-11 实测 **42** 个:2 low / 7 moderate / 32 high / 1 critical)为**构建期已知风险,勿 force 修**。按路径归类:`node_modules/npm/node_modules/**` 32 项 + surgio 自身依赖树(`@oclif/plugin-plugins`/`npm`/`got`/`qs`/`query-string`/`update-notifier`→`latest-version`→`package-json`/`decode-uri-component`)。共同点:全部属**构建期工具链**,仅本地/CI 执行 `surgio generate`/`eslint` 时存在,**不进任何分发产物**。修复路径按子树不同 — surgio 侧待上游跟进 oclif v5(npm@11)前无解;`audit fix --force` 会破坏 semver
  - 复核方法(勿凭记忆):`npm run audit:ci --silent -- --json > /tmp/audit.json`,再按 `vulnerabilities[*].nodes` 的路径前缀分组统计。**注意** 2026-09-11 前的文档写"全部来自 surgio→内嵌 npm@9",该表述**不准确**(漏掉了 eslint 子树,且 11 个包不在 `node_modules/npm/` 路径下)
  - **`js-yaml` 已于 2026-09-11 移出此清单,勿再当无解项**:它曾被笼统归入"eslint 子树随升级自然消解",但补丁版一直落在现有 semver 范围内 — `@oclif/core@2.16.0` 要求 `^3.14.1`(装 3.15.2)、`@eslint/eslintrc` 要求 `^4.3.0`(装 4.3.2),一次 `npm update js-yaml` 即可,无需等 surgio/oclif v5。教训:归入"无解"前必须先核对 `required range` 与 `first_patched_version` 是否真的不可满足
  - **Dependabot 的 `ignore` 对 security update 同样生效**(2026-09-11 实证):`.github/dependabot.yml` 里裸 `dependency-name` 不写 `versions` 会被解释成 `>= 0`,后果是告警永远关不掉,且每次安全更新任务都以 `all_versions_ignored` + exit 1 收场 —— 反而成为 Actions 刷红源(run 34522468638 / 34523818286)。**加 ignore 必须写 `versions` 限定范围**。另注意这与"告警仍生成、由人工以 `tolerable_risk` 批量 dismiss"的那批包(tar/sigstore/minimatch/glob/ip/got 等 11 个)是两条不同路径,勿混为一谈
  - 本地 `node_modules` 可能与 `package-lock.json` 漂移(实测 eslint 装的是 10.9.0 而 lock 为 10.9.1)。这不影响 CI(`npm ci` 按 lock 装),但会让本地 lint 跑在与 CI 不同的补丁版本上 — 结论有疑时先 `npm ci`
  - 改 `package-lock.json` 时勿直接跑 `npm update` 收工:本地 npm 版本会顺带重写大量无关条目(实测 `dev` 标志被从 `node_modules/npm/node_modules/**` 的 `inBundle` 条目上批量抹掉,254 行噪音)。只改目标包时手工编辑对应条目,或 `npm update` 后 `git checkout` 回退再手改,保持 diff 最小
- kelee.one 全局 403 (2026-08-25 起,含浏览器 UA):upstream-health issue #27 对应;Kelee/*.plugin 外壳与 loon.tpl LPX 直连引用在解封前不可用,属上游封锁非本仓库可修
- **无类型检查(有意取舍,盲区已知 — DEP-03)**:esbuild **仅转译不校验类型**,`src/*.ts` 里的字段名拼写错误、接口不符都不会在 build 期报错(`CODE-03` 的 `(mainConfig as any).removeUnfollowTopic` 即此盲区产物)。`src/env.ts` 的 `EnvInstance` 接口实际未被任何脚本用于约束。
  - 决策:不引入 `tsc` 到构建链(会破坏 ~14ms 构建与"仅 3 个 devDependencies"原则),**接受该盲区并在此显式记录**
  - 因此改 `src/` 时**必须补行为级用例**(`test/cases/`)来兜底 —— 类型错误不会被构建拦下,只能靠测试暴露
  - 若将来要收口:加一个**独立的** `tsc --noEmit` 非阻断 job(devDependencies 增至 4),不要塞进 build