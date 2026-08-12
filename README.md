# 3kaiu/config

Loon 代理配置 — 高质量多引擎去广告 · Apple 原生增强 · 全球社交/流媒体/AI 分流

## 快速开始

| 平台 | 导入链接 |
|------|----------|
| **Loon** | `https://ws.wenn.in/main/Profile/Loon.lcf` |

备用分发：`https://3kaiu.github.io/config/Profile/Loon.lcf`（GitHub Pages，需在 Settings → Pages 启用）

## 目录结构

```
├── Profile/          # 生成的主配置（Loon.lcf）
├── template/         # Surgio 模板 + 规则 snippet
├── Plugin/           # 39 个自维护 Loon 插件
├── Mirror/           # 上游资源镜像（门禁校验 + 哈希清单）
│   ├── iringo/       #   NSRingo Loon 插件
│   ├── nsringo/      #   NSRingo bundle.js
│   └── rules/        #   规则列表 + rewrite 插件
├── src/              # TypeScript 源文件
├── Scripts/          # 编译后 JS 脚本
├── Kelee/            # 第三方插件缓存
├── test/             # 测试用例（vm 沙箱模拟运行时）
└── doc/              # 文档（分发台账、迁移评估等）
```

## 核心功能

- **去广告**：blackmatrix7 AllInOne + ddgksf2013 规则 + 39 个 App 专清插件
- **Apple 增强**：WeatherKit · Maps · News · Siri · TestFlight（基于 NSRingo）
- **分流策略**：Streaming / AI / Developer / Social 独立策略组
- **安全分发**：每日镜像 + SHA256 校验 + 门禁拦截 + CDN 内容验证
- **CI/CD**：配置验证（10 项检查）+ 上游健康探活 + 脚本测试

## 节点与区域选择

- **自动选点**：`Proxy` 组为 url-test 自动选择最低延迟节点（300s 检测，50ms 容差），默认所有流量共用该节点
- **地区敏感服务**：流媒体（Netflix/Disney+ 等地区解锁）、AI（ChatGPT/Claude 等地区可用性）、游戏加速对出口地区敏感——自动选出的节点可能不满足。此时将 `Streaming` / `AI` / `Gaming` 组手动切换到对应地区节点即可（Loon App 内点击策略组选择）
- **零代理姿态**：`Final` 组切 `DIRECT` 即全局直连（长尾域名本地解析 + 直连）
- **区域分组模板**（可选）：若机场订阅按地区拆分多个 URL，可在 `surgio.conf.js` 增加 provider 并在 `loon.tpl` [Proxy Group] 启用区域 url-test 组：

  ```ini
  # 按节点名正则分组（如 "香港|HK|Hong Kong"），URL 用 proxy-test-url
  HK = url-test, "香港|HK|Hong Kong", url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50
  JP = url-test, "日本|JP|Japan", url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50
  US = url-test, "美国|US|America", url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50
  # 随后把 Streaming / AI / Gaming 组的可选项改为 "select, HK, JP, US, Proxy, Fallback, DIRECT"
  ```

## 文档

- [分发基础设施台账](doc/infrastructure.md) — CDN 架构、容灾流程、DNS 隐私说明
- [CHANGELOG](CHANGELOG.md) — 版本历史

## 上游来源

[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) · [ddgksf2013](https://github.com/ddgksf2013) · [app2smile](https://github.com/app2smile) · [NSRingo](https://github.com/NSRingo) · [KOP-XIAO](https://github.com/KOP-XIAO) · [Maasea](https://github.com/Maasea)
