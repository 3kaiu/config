---
kind: external_dependency
name: Surgio 配置模板引擎
slug: surgio
category: external_dependency
category_hints:
    - sdk_real_api
scope:
    - '**'
source_files:
    - package.json
    - surgio.conf.js
    - provider/tokyo.js
---

### 项目定位
Surgio 是本项目核心的配置模板引擎，用于从单一源码生成 Loon (.lcf)、Quantumult X (.conf) 和 Surge (.conf) 三端配置文件。

### 集成方式
- 通过 `surgio.conf.js` 定义 artifacts、remoteSnippets、customFilters、customParams
- 节点管理通过环境变量 `SURGIO_SUBSCRIPTION_URL` 注入，支持 shadowsocks 订阅格式
- 构建命令：`npm run generate` (surgio generate)

### 关键特性
- 模板系统支持 include、if/endif 等指令
- 远程片段引用 blackmatrix7 和 ddgksf2013 的规则库
- 自定义过滤器支持按协议分类节点（hysteriaFilter、vlessFilter）
- DNS 参数集中管理（DoH/DoQ/DoH3）

### 使用约束
- 仅作为构建工具，运行时不依赖
- 节点列表由外部订阅管理，非 Surgio 直接维护