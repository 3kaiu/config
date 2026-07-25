---
kind: external_dependency
name: GitHub Actions 自动化工作流
slug: github-actions
category: external_dependency
category_hints:
    - framework_behavior
scope:
    - '**'
source_files:
    - .github/workflows/config-validate.yml
    - .github/workflows/mirror-scripts.yml
    - .github/workflows/upstream-health.yml
---

### 核心工作流
- config-validate.yml: 8项配置验证（插件元信息、URL可达性、双端对齐、银行域名冲突、版本号一致性、规则顺序防遮蔽等）
- mirror-scripts.yml: 每日镜像外部脚本到自建 CDN
- upstream-health.yml: 12个上游源健康检查
- cdn-verify.yml: CDN内容哈希校验
- pages-deploy.yml: GitHub Pages备用分发

### 验证机制
- Plugin 元信息完整性检查（#!name/#!version/#!desc）
- script-path URL 可达性验证
- Loon vs QX 双端配置交叉核对
- 银行域名 MitM 冲突检测
- HTTPDNS Rewrite 对齐检查
- Snippet 双端域名内容级 diff 检查
- Qidian 内嵌引擎完整性校验（SHA256）

### 触发条件
- push/PR 到 main 分支
- workflow_dispatch 手动触发
- 定时任务（每日执行）