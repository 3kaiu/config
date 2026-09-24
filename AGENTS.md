# AGENTS.md

Loon 单入口配置仓库：`Profile/Loon.lcf` 由 `template/` + `surgio.conf.js` 生成；`Scripts/` 除 `Qidian.js` 外均为 `src/*.ts` 的 esbuild 产物。

## 命令

- `npm run build`：注入 `src/env.ts` 与 `src/lib/*.ts`，把 `src/*.ts` 压缩到 `Scripts/`。改源码后必须执行。
- `npm test`：268 个行为级用例，引用全部 28 个 Scripts 产物；随后执行规则顺序与接线检查。关键文档数字由 `tools/doc-claims-check.mjs` 对照实测。
- `npm run lint`：ESLint flat config，检查 `Scripts/`、`test/`、`tools/`。
- `npm run generate`：Surgio 3.19 生成 `Profile/Loon.lcf`。该命令会创建空 `dist/`，`.gitignore` 中对应规则必须保留。
- `npm run check:all`：串行执行 sync、shadow、rewrite、drift、src、orphan、plugin、contract、workflows 门禁；不包含 build、test、lint、generate。
- `npm run audit:ci`：固定使用 `registry.npmjs.org` 获取审计数据。

## 关键路径

| 路径 | 角色 | 规则 |
|---|---|---|
| `src/*.ts` | 唯一脚本源码 | 可改；改后必须 build 并补行为测试 |
| `src/lib/*.ts` | esbuild 注入模块 | 不作为入口产物；导出名在消费者中按全局标识符使用 |
| `src/env.ts` | `Env` 兼容与宿主封装 | 同样只经 `--inject` 注入 |
| `Scripts/*.js` | CDN 运行时脚本 | 除 `Qidian.js` 外不手改；CI 检查 build 漂移 |
| `Scripts/Qidian.js` | 无源码手工轨 | 引擎 marker 内变更须同步 `ENGINE-MANIFEST.json`；marker 外包装层改动仍需行为测试 |
| `Plugin/*.plugin` | Loon 插件外壳 | `[Script]`、`[Rewrite]`、`[MitM]` 与参数必须配套；startup 插件由生成器维护 |
| `Kelee/*.plugin` | 本地 Loon 外壳 (6 个:12306/guiderank/smzdm/umetrip/YouTube + Google) | 全部经模板 CDN 引用；修改后跑插件与参数门禁 |
| `Mirror/` | 上游镜像与远程规则/插件/bundle | workflow 每日更新；手工修改文本镜像必须同步 MANIFEST 哈希和字节数 |
| `template/loon.tpl` | Loon 模板 | 修改后 regenerate + `check:sync`；`surgio.conf.js` 的 `customParams` 必须与模板双向配对 |
| `Profile/Loon.lcf` | 唯一发布入口 | 生成物，不手改；artifact-idempotency 会重生成并判红 |
| `tools/*.mjs` | 已接线生成器/门禁 | 每个工具必须被 workflow、npm check 脚本或测试调用；未接线工具应删除 |
| `test/cases/*.test.js` | 行为与静态回归测试 | 响应脚本必须断言 `$done`；ESM 工具用动态 `import()` |

## 生成与镜像纪律

- `Plugin/startup-adblock-pro.plugin` 的手写区由 `BEGIN/END 3kaiu` marker 界定；自动生成区勿改。`SCRIPT_LEDGER` 必须登记每条上游 script，未登记项测试判红。
- `EXTRA_REJECTS` 的 Rewrite 规则与对应 MitM hostname 必须同生。startup 插件的 `[MitM]` hostname 不允许整行误删。
- Mirror 文本在计算哈希前统一为 LF。`Mirror/MANIFEST.json` 的 `upstream_bytes` 是原始抓取体积，不是补丁后文件大小。
- 现有 NSRingo、DualSubs、Auraflare、Biliverse 等镜像允许按已批准策略跟随 `latest`；新增上游默认锁具体版本。`check:drift --strict` 防止 workflow 声明与实际镜像静默分叉。
- `goodbyeads-qx.list` 与 `ddgksf-StartUpAds.conf` 虽来自 QX 格式上游，但当前被 Loon 远程规则或生成器消费，不能按文件名删除。

## CI 门禁

- `script-tests.yml`：lint、build、Scripts 漂移、268 用例、构建出处 attestation。
- `config-validate.yml`：MitM、插件结构、参数契约、源码反模式、workflow bash、模板同步、Qidian 哈希、规则遮蔽/冗余、镜像漂移、接线与银行域名断言；独立 job 重生成 Loon 配置验证幂等。
- `mirror-scripts.yml`：镜像抓取与投毒/体积门禁、startup 生成、PR；独立 verify job 在 `MIRROR_TOKEN` 缺失导致 PR run 停在 `action_required` 时提供兜底验证。
- `surgio-build.yml`：模板、provider 或构建配置变化后自动生成 PR。
- `cdn-verify.yml`：对 `ws.wenn.in` 与仓库文件做 sha256 校验。
- `upstream-health.yml`：MANIFEST 派生镜像与直连依赖探活。
- `dependency-audit.yml`：报告构建期依赖风险；`release.yml`：tag 版本快照。

## 约束与已知边界

- 不提交 secret。可选 secret 为 `BARK_PUSH`；`MIRROR_TOKEN` 用于让镜像 PR 正常触发 PR checks，缺失时 verify job 兜底。
- 发布面是公开 GitHub 与 `ws.wenn.in` CDN；GitHub Pages 已退役，不是备用通道。
- QX 运行时配置已移除；历史 CHANGELOG 和必要的 QX 格式上游转换输入保留。
- [Rule] 485 行；52 个插件 = Plugin/ 46 + Kelee/ 6。
- 依赖仅 3 个 devDependencies（esbuild、eslint、surgio），无运行时依赖；`engines.node >= 22`。
- 仓库不引入 `tsc`：esbuild 只转译，不检查类型。修改 `src/` 必须用行为测试兜底；若未来增加 `tsc --noEmit`，使用独立非阻断 job。
- `Scripts/Qidian.js` 的内嵌加密引擎无法静态审计，只能做来源、marker 与哈希治理。
- `npm audit` 告警属于构建期工具链；禁止 `audit fix --force`，复核路径与修复范围后再处理。
- `interface-mode = Performace` 是 Loon 模板中的官方原样拼写，勿自行纠正。
- push 前必须确保 `npm test`、lint 与相关门禁全绿；任何红项先修复再推送。
