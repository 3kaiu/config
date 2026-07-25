---
kind: build_system
name: Surgio 多客户端配置生成与 CI/CD 构建系统
category: build_system
scope:
    - '**'
source_files:
    - surgio.conf.js
    - provider/tokyo.js
    - package.json
    - .github/workflows/surgio-build.yml
    - .github/workflows/mirror-scripts.yml
    - .github/workflows/config-validate.yml
    - template/loon.tpl
    - template/quantumultx.tpl
    - template/surge.tpl
---

## 1. 构建系统与工具链
- **核心引擎**: 基于 [Surgio](https://github.com/SleepyFox/surgio) (v3.17.0) 的模板引擎，统一为 Loon、Quantumult X、Surge 三个 iOS 代理客户端生成完整配置文件。
- **运行环境**: Node.js 20（GitHub Actions），通过 `npm install --production` 安装依赖后执行 `surgio generate`。
- **脚本命令**: `package.json` 暴露 `generate`（生成配置）、`preview`（本地预览）、`test`（Node vm 沙箱测试）、`lint`（ESLint）四个入口。

## 2. 关键文件与职责
- `surgio.conf.js`: Surgio 主配置，声明三个 artifact（Loon.lcf / QX.conf / Surge.conf），定义远程片段（blackmatrix7 规则）、自定义过滤器（hysteria/vless）、DNS/DoH/DoQ 参数及节点测试 URL。
- `provider/tokyo.js`: 节点 Provider，优先读取环境变量 `SURGIO_SUBSCRIPTION_URL` 作为 Shadowsocks 订阅源，否则返回空节点列表（由外部 Sub-Store 注入）。
- `template/*.tpl` + `template/snippet/*.tpl`: Jinja2 模板，按客户端语法拆分通用片段（AI/流媒体/社交/开发者/银行广告拦截），实现双端域名一致性。
- `Profile/*.conf`: Surgio 生成的最终配置文件输出目录。
- `.github/workflows/*.yml`: 完整的 CI/CD 流水线，涵盖配置生成、上游镜像、校验、测试、部署等。

## 3. 架构与流程
### 3.1 配置生成流程
```
push/main → surgio-build.yml → npm install → npx surgio generate → git diff → 自动提交 Profile/
```
- 触发条件: 修改 `surgio.conf.js`、`template/**`、`provider/**`、`package.json`。
- 产物: `Profile/Loon.lcf`、`Profile/QX.conf`（Surge.conf 注释说明 v1 覆盖范围有限）。
- 自动回推: 若 diff 非空，以 `chore: auto-update Surgio generated configs` 提交并推送。

### 3.2 上游资源镜像流程
```
cron 03:00 UTC → mirror-scripts.yml → curl 抓取 → 门禁检查 → MANIFEST.json → PR 审核
```
- 门禁三件套: 体积≥200B、非 HTML、JS 文件过 `node --check` 语法检查。
- 失败策略: 未通过门禁的文件保留旧版 sha256，不阻断整体流程。
- 审核机制: 变更推送到 `mirror/<date>` 分支并创建 PR，人工核对 MANIFEST.json 中 source_url 与 sha256 后合并。
- 覆盖范围: 脚本（netease.adblock/amdc/applet/bilibili/youtube）、解析器（KOP-XIAO/Sub-Store）、规则（blackmatrix7/ddgksf2013/app2smile）、NSRingo bundle.js（版本固定 release 资产）。

### 3.3 配置校验流水线
`config-validate.yml` 包含 10 项检查:
1. Plugin 元信息 (`#!name`/`#!version`/`#!desc`) 强制要求
2. script-path URL 可达性扫描
3. Loon vs QX 规则覆盖率交叉核对
4. 银行域名 MitM 冲突检测
5. MitM hostname 双端 diff
6. HTTPDNS rewrite 对齐检查
7. Snippet 域名内容级 diff（逐域名对比）
8. Qidian 内嵌引擎完整性（ENGINE-MANIFEST.json 哈希校验）
9. 主配置版本号一致性（Loon.lcf vs QX.conf）
10. QX 规则顺序防遮蔽（googleapis.com 通配不得截胡 AI/reject 规则）

### 3.4 其他工作流
- `script-tests.yml`: 基于 Node vm 沙箱对 Scripts/*.js 进行运行时回归测试。
- `cdn-verify.yml` / `upstream-health.yml`: CDN 健康检查与上游依赖可用性监控。
- `pages-deploy.yml`: GitHub Pages 备用发布。
- `sync-kelee.yml`: Kelee 第三方插件每日同步覆写。

## 4. 约定与约束
- **模板驱动**: 所有客户端配置必须通过 Surgio 模板生成，禁止直接编辑 `Profile/*.conf`。
- **Snippet 一致性**: `template/snippet/*.tpl` 与 `*.qx` 必须保持域名集合完全一致，CI 会逐域名 diff 校验。
- **上游可溯源**: 所有 Mirror/* 文件必须在 `MANIFEST.json` 中记录 `source_url` + `sha256` + `fetched_at`，变更需经 PR 审核。
- **版本同步**: `package.json` 的 `version` 字段与 `Profile/Loon.lcf`、`Profile/QX.conf` 中的 `vX.Y` 标记必须一致。
- **安全门禁**: 镜像脚本必须通过体积/HTML/语法三重门禁，失败则保留旧版，不污染仓库。
- **节点管理解耦**: 节点由外部 Sub-Store 订阅注入，Surgio 仅负责模板渲染，避免硬编码敏感凭据。
- **DNS 零泄漏**: 通过 `domain-reject-mode=DNS` + `dns-reject-mode=LOOPBACKIP` + GEOIP CN DIRECT 实现国内流量本地解析、海外流量远端解析的语义隔离。