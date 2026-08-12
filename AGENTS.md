# AGENTS.md

Loon 配置仓库:单入口 `Profile/Loon.lcf`,由 `surgio` 从 `template/` + `surgio.conf.js` 构建;`Scripts/` 全部为 `src/*.ts` 的 esbuild 产物。

## 命令

- `npm run build` — esbuild 注入 `src/env.ts` 编译 `src/*.ts` 到 `Scripts/`(minify)。改 src 后必须 build
- `npm test` — 72 个行为级用例,引用全部 22 个 Scripts 产物
- `npm run lint` — eslint(flat config)
- `npm run generate` — surgio 构建 `Profile/Loon.lcf`(surgio 3.18,内联 providers,无 patch)
- `npm run check:sync` — tpl-sync-check 正反向比对 template ↔ Loon.lcf

## 关键路径

| 路径 | 角色 | 规则 |
|---|---|---|
| `src/*.ts` | 唯一源码(JS 语法,esbuild 直编) | 可改;git rm 过的 tsconfig/loon.d.ts 是死配置 |
| `Scripts/` | build 产物 + `lib/notify.js` + `Qidian.js`(手工轨 602KB,无源,rc4) | 不手改;Qidian.js 改动须同步 `Scripts/ENGINE-MANIFEST.json` 哈希 |
| `Plugin/*.plugin` | 净化器插件外壳(仓库静态资产,script-path 直连 CDN 的 Scripts/) | 改后须核对 triger 与 script-path |
| `Kelee/*.plugin` | keele 上游插件外壳(12306/guiderank/smzdm/umetrip/YouTube),上游在 kelee.one | 与 Plugin/ 同规则,config-validate 覆盖 |
| `Mirror/` | 上游镜像:auraflare/biliuniverse/dualsubs/iringo/rules/scripts + 独立 js | mirror-scripts 每日重写 `Mirror/MANIFEST.json`(dict: $comment/generated_at/files) |
| `template/loon.tpl` / `surgio.conf.js` | Loon 配置构建输入 | 改模板后须 regenerate + check:sync |
| `Profile/Loon.lcf` | 发布入口唯一文件 | 不动;生成物 |
| `tools/*.mjs` | tpl-sync / 验证脚本 | 改动后跑 check:sync |
| `test/cases/*.test.js` | 72 用例 | 新增/改脚本须补用例 |

## 门禁(全部在 `.github/workflows/`,push 前本地自测)

- script-tests:build 后 git diff Scripts/ 漂移门禁 → 本地必须先 build 再提交
- config-validate:净化器断言 + mitm-orphan + ENGINE-MANIFEST 哈希
- mirror-scripts:镜像 fetch/结构/投毒门禁 + MANIFEST 重写,失败 keep_old
- upstream-health:探测列表 = MANIFEST 派生镜像 + 硬编码上游(含 kelee.one LPX、NSRingo latest),失败开 issue
- cdn-verify:CDN 与仓库哈希比对 + Pages 兜底 parity(Pages 未启用时跳过)
- surgio-build:仅在 surgio.conf.js/template/**/package.json 变更时构建并 auto-PR

## 约束

- 不提交 Secrets;workflow secrets 仅 BARK_PUSH(可选)
- 发布面 = 公开 GitHub + ws.wenn.in CDN(Cloudflare,max-age=3600)+ GitHub Pages(未启用)
- QX 已彻底移除,任何涉及 QX 的改动/引用皆为回归
- 依赖仅 4 个(esbuild/eslint/surgio/无 typescript);升级须过 build+72 测试

## 架构已知问题(勿重改)

- `Scripts/Qidian.js` 无源码(上游 qidian 引擎,密文打包)
- [Rule] 456 行 0 冗余(已证);GEOIP 顺序已修;AdBlock 域 28 个硬拦截已覆盖规则