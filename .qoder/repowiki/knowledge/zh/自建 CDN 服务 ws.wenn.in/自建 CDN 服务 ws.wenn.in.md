---
kind: external_dependency
name: 自建 CDN 服务 ws.wenn.in
slug: ws-wenn-in
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
source_files:
    - README.md
    - Plugin/qidian.plugin
    - .github/workflows/cdn-verify.yml
---

### 服务定位
自建的内容分发网络，用于托管所有插件脚本、配置文件和镜像资源。

### 主要用途
- 插件脚本分发：所有 Plugin/*.plugin 的 script-path 引用
- 配置文件分发：Profile/Loon.lcf 和 Profile/QX.conf 的导入链接
- 镜像文件托管：Mirror/ 目录下的外部脚本缓存
- 备用分发：当主 CDN 故障时切换到 GitHub Pages

### 安全设计
- 所有引用使用 HTTPS 协议
- 通过 CI/CD 自动同步和更新
- 与仓库内容保持严格一致
- 支持回退到 GitHub Pages 备用地址

### 依赖关系
- 所有 Plugin/Scripts/Mirror 目录的资源都通过此 CDN 分发
- README 中的快速导入链接指向此服务