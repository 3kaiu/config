# 3kaiu/config

Loon & Quantumult X 代理配置 — 高质量多引擎去广告 · Apple 原生增强 · 全球社交/流媒体/AI 分流

## 快速开始

| 平台 | 导入链接 |
|------|----------|
| **Loon** | `https://ws.wenn.in/main/Profile/Loon.lcf` |
| **Quantumult X** | `https://ws.wenn.in/main/Profile/QX.conf` |

备用分发：`https://3kaiu.github.io/config/Profile/Loon.lcf`（GitHub Pages，需在 Settings → Pages 启用）

## 目录结构

```
├── Profile/          # 生成的主配置（Loon.lcf + QX.conf）
├── template/         # Surgio 模板 + 规则 snippet（双端同步）
├── Plugin/           # 39 个自维护 Loon 插件
├── Mirror/           # 上游资源镜像（门禁校验 + 哈希清单）
│   ├── iringo/       #   NSRingo Loon 插件
│   ├── nsringo/      #   NSRingo bundle.js
│   └── rules/        #   规则列表 + rewrite 模块
├── src/              # TypeScript 源文件
├── Scripts/          # 编译后 JS 脚本
├── Kelee/            # 第三方插件缓存
├── QX/apple/         # QX Apple 增强模块
├── test/             # 测试用例（vm 沙箱模拟运行时）
└── doc/              # 文档（分发台账、迁移评估等）
```

## 核心功能

- **去广告**：blackmatrix7 AllInOne + ddgksf2013 规则 + 39 个 App 专清插件
- **Apple 增强**：WeatherKit · Maps · News · Siri · TestFlight（基于 NSRingo）
- **分流策略**：Streaming / AI / Developer / Social 独立策略组
- **安全分发**：每日镜像 + SHA256 校验 + 门禁拦截 + CDN 内容验证
- **CI/CD**：配置验证（10 项检查）+ 上游健康探活 + 脚本测试

## 文档

- [分发基础设施台账](doc/infrastructure.md) — CDN 架构、容灾流程、DNS 隐私说明
- [CHANGELOG](CHANGELOG.md) — 版本历史

## 上游来源

[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) · [ddgksf2013](https://github.com/ddgksf2013) · [app2smile](https://github.com/app2smile) · [NSRingo](https://github.com/NSRingo) · [KOP-XIAO](https://github.com/KOP-XIAO) · [Maasea](https://github.com/Maasea)
