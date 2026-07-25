---
kind: external_dependency
name: ddgksf2013 app2smile 脚本库
slug: ddgksf2013-app2smile
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
source_files:
    - README.md
    - Plugin/bilibili.plugin
    - Plugin/wechat.plugin
---

### 项目定位
活跃的 App 净化脚本集合，为各个主流应用提供去广告和功能增强。

### 集成方式
- v7.0 后完全本地化到 Plugin/ 目录
- 通过自维护的 .plugin 文件引用
- 部分脚本镜像到 Mirror/ 目录

### 覆盖范围
- Loon 端：bilibili、wechat、netease、goofish、qishui、taopiaopiao、amap、jd、qqmusic、reddit、tieba、zhihu 等
- QX 端：独立 conf 文件，每日更新
- 京东、知乎等无官方 conf 的应用有自维护版本

### 维护状态
- 上游活跃维护，每日更新
- 本仓库已完全消除对 ajune0527/vpn_tool 的依赖
- 所有引用迁移到自建 CDN