---
kind: external_dependency
name: Kelee 插件生态
slug: kelee-one
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
source_files:
    - README.md
    - Kelee/Prevent_DNS_Leaks.plugin
    - Kelee/YouTube_remove_ads.plugin
---

### 项目定位
Loon 专属的插件生态系统，提供功能增强类插件。

### 当前依赖
- Prevent_DNS_Leaks.plugin: DNS 泄露防护（保留）
- YouTube_remove_ads.plugin: YouTube 增强（自维护）
- 7个 .lpx 功能增强插件：Google搜索重定向、Spotify歌词翻译、微信外部链接解锁等

### 安全风险
- .lpx 内容为黑盒，无法审计、无法哈希校验
- 通过 Cloudflare Turnstile 保护，curl/GitHub Actions 无法下载
- 仅 Loon App 内部 WebKit 引擎可正常加载
- QX 端不支持 .lpx 格式

### 演进方向
- v7.0 后逐步淘汰 kelee.one 依赖
- 功能增强插件默认禁用，需用户手动启用
- 建议提取源码转换为自维护格式