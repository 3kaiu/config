---
kind: configuration_system
name: Surgio 多客户端配置生成系统
category: configuration_system
scope:
    - '**'
source_files:
    - surgio.conf.js
    - package.json
    - provider/tokyo.js
    - template/loon.tpl
    - template/quantumultx.tpl
    - template/surge.tpl
    - .github/workflows/surgio-build.yml
---

本仓库使用 Surgio（v3.17.0）作为统一的配置生成引擎，将一套 Jinja2 模板与节点 Provider 转换为 Loon、Quantumult X、Surge 三个 iOS 代理客户端的完整配置文件。配置系统的核心由以下层次构成：

1. **配置入口与构建定义**：`surgio.conf.js` 通过 `defineSurgioConfig` 声明 artifacts（输出产物）、remoteSnippets（远程规则片段）、proxyTestUrl/proxyTestInterval（节点探测）、customFilters（按协议名过滤节点）和 customParams（DNS/DoH/DoQ/DoH3 等模板变量）。`package.json` 暴露 `generate` / `preview` 脚本，依赖仅 surgio 与 eslint。

2. **模板体系**：`template/` 下为三端主模板（`loon.tpl`、`quantumultx.tpl`、`surge.tpl`），均使用 Jinja2 语法（`{{ customParams.* }}`、`{% include ... %}`、`{% if ... %}`）注入变量与复用 snippet；`template/snippet/` 提供 AI 服务、银行广告拦截、开发者工具、社交、流媒体等可插拔规则片段，每类同时提供 `.tpl`（Loon/Surge）与 `.qx`（Quantumult X）两个版本以适配各客户端语法差异。

3. **节点 Provider**：`provider/tokyo.js` 从环境变量 `SURGIO_SUBSCRIPTION_URL` 读取订阅地址，返回 shadowsocks_subscription 类型；若未设置则回退为空 nodeList，使 Surge 模板中的 `surge_node_policy_path` 成为可选路径。

4. **输出约定**：所有 artifacts 统一输出到 `Profile/` 目录，文件名分别为 `Loon.lcf`、`QX.conf`、`Surge.conf`，由 CI 工作流（`surgio-build.yml`）自动执行 `npx surgio generate` 生成。

5. **远程规则与镜像**：`surgio.conf.js` 中 `remoteSnippets` 指向 blackmatrix7 的 Advertising/Hijacking/Privacy 列表；实际运行时通过 `Mirror/` 目录托管的经哈希校验的静态副本（`ws.wenn.in/main/Mirror/rules/*`）加载，确保上游依赖可溯源。

6. **环境变量与密钥**：节点源通过 `SURGIO_SUBSCRIPTION_URL` 传入；GitHub Actions Secrets 中可注入 HY2_HOST 等节点参数；`customParams.surge_node_policy_path` 留空时 Surge 配置降级为 `select DIRECT` 并提示手动导入。

7. **验证与测试**：CI 包含 `config-validate.yml`（配置校验）、`script-tests.js`（基于 Node vm 沙箱对 Scripts 目录下净化脚本进行回归测试），保证模板变更不会破坏客户端兼容性。

约束与约定：
- 模板必须保持三端语义等价（Loon/QX/Surge），新增规则需同步更新 `.tpl` 与 `.qx` 对应片段。
- DNS/DoH/DoQ 相关变量统一通过 `customParams` 注入，禁止在模板中硬编码 IP。
- 节点管理优先走外部订阅（Sub-Store），Surgio 仅负责模板渲染与规则组装。
- 所有远程规则与脚本资源必须经 Mirror 镜像并提供 MANIFEST 清单，禁止直接引用上游原始 URL。