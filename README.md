# Quantumult X & Loon 配置库

## 平台

| 平台 | 主配置 | 生态 |
|------|--------|------|
| Loon | `Loon.lcf` | 可莉 + Blackmatrix7 + 自维护 |
| Quantumult X | `QX.conf` | 可莉 + Blackmatrix7 + 自维护 |

## 快速导入

### Loon

```
https://raw.githubusercontent.com/3kaiu/config/main/Profile/Loon.lcf
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

## Loon 配置架构 (v3.2)

### 三路极简分流

```
🇨🇳 国内 → DIRECT  (REGION_SPLITTER IP级 + China.list 域名级)
🌍 国外 → Proxy   (Global.list 域名级, 其余走兜底 Proxy)
🚫 广告 → REJECT  (Advertising.list + BlockAdvertisers 插件 + 起点/智慧房东脚本)
```

### 插件 (仅 9 个)

| 来源 | 插件 | 作用 |
|------|------|------|
| 可莉 | Block_HTTPDNS | 屏蔽 HTTPDNS |
| 可莉 | BlockAdvertisers | 动态广告拦截 |
| 可莉 | Prevent_DNS_Leaks | DNS 泄露防护 |
| BM7 | SafeRedirect | 60 条安全重定向 |
| BM7 | startup.lnplugin | 10+ App 开屏去广告 |
| 社区 | Sub-Store | 订阅管理器 |
| 自维护 | qidian.plugin | 起点全能助手 v3.0 |
| 自维护 | youtube.plugin | YouTube 去广告 |
| 自维护 | zhihuifangdong.plugin | 智慧房东广告屏蔽 |

### DNS 泄露防御 (三层)

1. **hijack-dns** — 劫持所有知名 DNS IP（Google/Cloudflare/国内），强制走 FakeIP
2. **Prevent_DNS_Leaks.lpx** — 可莉插件级 DNS 泄露防护
3. **Block_HTTPDNS.lpx** — 阻止 App 绕过 DNS 使用 HTTPDNS

### YouTube 增强

- 代理分流到 Proxy 策略组
- 脚本级广告拦截（app2smile — 首页瀑布流 + 播放页推荐广告）
- MITM 解密 youtubei.googleapis.com
- `binary-body-mode=true` 支持 Protobuf 响应解析更多可莉插件请访问 [hub.kelee.one](https://hub.kelee.one) 或参考 [luestr/ProxyResource](https://github.com/luestr/ProxyResource)

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
  Loon.lcf          # Loon 主配置
  QX.conf            # Quantumult X 主配置
Plugin/
  qidian.plugin      # 起点全能助手
  youtube.plugin     # YouTube 增强
Scripts/
  Qidian.js          # 起点全能助手脚本
Rewrite/             # QX 可订阅重写片段
Templates/           # 脚本模板
```
