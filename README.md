# Quantumult X & Loon 配置库

## 平台

| 平台 | 主配置 | 生态 |
|------|--------|------|
| Loon | `Loon.conf` | 可莉 + Blackmatrix7 + 自维护 |
| Quantumult X | `QX.conf` | 可莉 + Blackmatrix7 + 自维护 |

## 快速导入

### Loon

```
https://raw.githubusercontent.com/3kaiu/config/main/Profile/Loon.conf
```

自维护插件：
```
https://raw.githubusercontent.com/3kaiu/config/main/Plugin/qidian.plugin   # 起点全能助手
https://raw.githubusercontent.com/3kaiu/config/main/Plugin/youtube.plugin  # YouTube 增强
```

### Quantumult X

```
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX.conf
```

可选增强：
```
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX-Optional-Apple.conf
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX-Optional-Ads.conf
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX-Optional-Media.conf
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX-Optional-Network.conf
```

## Loon 配置架构 (v2.1)

### 规则分层

```
本地规则 (Apple/微信直连 + 广告 SDK 白名单)
    ↓
可莉生态 REMOTE RULE (REGION_SPLITTER + LAN_SPLITTER — IP 级)
    ↓
Blackmatrix7 REMOTE RULE (域名级广告/隐私/国内外分流)
    ↓
可莉生态 PLUGIN (Block_HTTPDNS + BlockAdvertisers + Prevent_DNS_Leaks)
    ↓
自维护 PLUGIN (起点 + YouTube)
    ↓
FINAL → 兜底策略组
```

### 可莉生态集成

| 资源 | 类型 | 功能 |
|------|------|------|
| `REGION_SPLITTER.lsr` | Remote Rule | 国内 IP 自动分流到直连 |
| `LAN_SPLITTER.lsr` | Remote Rule | 局域网 IP 自动分流 |
| `Block_HTTPDNS.lpx` | Plugin | 屏蔽 App 私建 HTTPDNS |
| `BlockAdvertisers.lpx` | Plugin | 动态广告拦截增强 |
| `Prevent_DNS_Leaks.lpx` | Plugin | 防止 DNS 泄露 |
| `Node_detection_tool.lpx` | Plugin | 节点实时检测 |
| `geodata.kelee.one` | GEOIP/ASN | 可莉 CDN 加速数据库 |
| `Remote Filter` | 节点分组 | 按地区自动分类节点 |

更多可莉插件请访问 [hub.kelee.one](https://hub.kelee.one) 或参考 [luestr/ProxyResource](https://github.com/luestr/ProxyResource)

### 代理加速

- `ip-mode=dual` — 并发 A+AAAA DNS 查询
- `interface-mode=Performace` — WiFi + 蜂窝双路聚合
- `hijack-dns=*:53` — 拦截 App 私建 DNS，强制 FakeIP
- `sni-sniffing=true` — 无 MITM 也能识别 TLS 域名，提升规则匹配精度
- `disconnect-on-policy-change=false` — 切策略不触发重连，减少卡顿
- DoH/DoH3 三路并发 DNS

### 去广告

多层防御：

1. `domain-reject-mode=DNS` — DNS 阶段零延迟阻断
2. `Blackmatrix7` — Advertising + Privacy 规则库（域名级）
3. `BlockAdvertisers.lpx` — 可莉去广告插件（动态脚本级）
4. `Block_HTTPDNS.lpx` — 阻止 App 绕过 DNS 获取广告
5. 起点插件 — GDT/穿山甲 SDK 广告拦截 + 追踪 SDK 屏蔽

### 应用增强

- **起点全能助手** — 广告秒播、自动重放、每日签到、页面净化
- **YouTube 增强** — 代理分流 + MITM 解密
- **京东每日签到** — cron 自动签到
- **Sub-Store** — 订阅解析与节点管理
- **Loon 插件画廊** — 社区插件一键安装

## Quantumult X 配置

| 需求 | 导入 |
|------|------|
| 日常使用 | `QX.conf` |
| Apple 增强 | + `QX-Optional-Apple.conf` |
| 去广告增强 | + `QX-Optional-Ads.conf` |
| 单 App 广告 | + `Profile/Ads/*.conf` |
| B 站/媒体 | + `QX-Optional-Media.conf` |
| WARP | + `QX-Optional-Network.conf` |

## 注意事项

- 起点兼容：去广告规则需剔除 `gdt / pangolin` 冲突项
- Loon 必须开启并信任 MITM 才能启用脚本和插件
- 订阅链接为占位符，需自行填入
- 可莉 `.lsr` / `.lpx` 资源通过 `kelee.one` CDN 分发，仅供 Loon 客户端拉取

## 目录

```
Profile/
  Loon.conf          # Loon 主配置
  QX.conf            # Quantumult X 主配置
Plugin/
  qidian.plugin      # 起点全能助手
  youtube.plugin     # YouTube 增强
Scripts/
  Qidian.js          # 起点全能助手脚本
Rewrite/             # QX 可订阅重写片段
Templates/           # 脚本模板
```
