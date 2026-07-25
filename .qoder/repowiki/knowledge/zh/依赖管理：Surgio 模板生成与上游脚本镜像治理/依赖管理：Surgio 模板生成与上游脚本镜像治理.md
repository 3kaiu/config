---
kind: dependency_management
name: 依赖管理：Surgio 模板生成与上游脚本镜像治理
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - surgio.conf.js
    - Mirror/MANIFEST.json
    - .github/workflows/mirror-scripts.yml
    - Scripts/ENGINE-MANIFEST.json
---

本仓库的依赖管理围绕两个层面展开：构建期 Node.js 依赖（Surgio 模板引擎）与运行时第三方代理脚本/规则/插件的镜像与完整性校验。两者通过 GitHub Actions 流水线与清单文件形成可追溯、可审计的闭环。