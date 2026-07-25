---
kind: external_dependency
name: blackmatrix7 iOS 规则脚本库
slug: blackmatrix7-ios-rule-script
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
source_files:
    - surgio.conf.js
    - README.md
---

### 项目定位
社区维护的 iOS 网络工具规则脚本集合，提供去广告、隐私保护、分流规则等功能。

### 集成方式
- 通过 Surgio remoteSnippets 远程引用
- 主要模块：Advertising.list、Hijacking.list、Privacy.list
- 在 v7.0 后成为主要的去广告方案，替代原有的 kelee.one 插件体系

### 核心功能
- 740+ MitM hostname 声明
- 698条 reject 规则
- 21个 response 脚本
- 每日自动更新

### 安全考虑
- 已修复 safebrowsing/jiguang/umeng 误杀风险
- 与银行域名负向排除策略配合使用
- 定期审计规则变更