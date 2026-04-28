# 3kaiu/config — Loon & Quantumult X 配置库

## 快速导入

### Loon

```
https://raw.githubusercontent.com/3kaiu/config/main/Profile/Loon.lcf
```

### Quantumult X

```
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX.conf
```

## Loon 配置 (v3.7)

### 三路分流

```
🇨🇳 国内 → DIRECT   REGION_SPLITTER (IP级) + China.list (域名级) + Host DNS下沉
🌍 国外 → Proxy    Global.list (域名级) + FINAL 兜底
🚫 广告 → REJECT   Advertising.list + Privacy.list + BlockAdvertisers 插件
```

### 插件 (9 个)

| 来源 | 插件 | 作用 |
|------|------|------|
| 可莉 | Block_HTTPDNS | 屏蔽 HTTPDNS |
| 可莉 | BlockAdvertisers | 动态广告拦截 |
| 可莉 | Prevent_DNS_Leaks | DNS 泄露防护 |
| BM7 | SafeRedirect | 60 条安全重定向 |
| BM7 | startup.lnplugin | 10+ App 开屏去广告 |
| 社区 | Sub-Store | 订阅管理器 |
| 自维护 | qidian.plugin | 起点全能助手 Pro v3.6 |
| 自维护 | youtube.plugin | YouTube 去广告 |
| 自维护 | zhihuifangdong.plugin | 智慧房东广告屏蔽 |

### 起点插件 (v3.6)

| 功能 | 实现 |
|------|------|
| GDT 视频 1s 替换 | URL 替换 + MP4 下载拦截 双层方案 |
| 自动重放 | finishWatch × N 并发回放 |
| KeLi 全清 | 11 个 API 直接拒绝 + getconf 精确删 key |
| 营销模块 | BenefitButtonList 删除 (福利中心/活动中心/我的阅历) |
| 追踪域名 | 26 个 REJECT 规则 (腾讯/字节/阅文) |
| 每日签到 | cron 09:00 静默签到 |
| 页面净化 | 9 条 CleanRules 路径 |

### DNS 防御

1. `hijack-dns` — 劫持知名 DNS IP，强制 FakeIP
2. `Prevent_DNS_Leaks.lpx` — 可莉插件级防护
3. `Block_HTTPDNS.lpx` — 阻止 App HTTPDNS 绕过

### 代理加速

- `ip-mode=dual` — 并发 A+AAAA DNS
- `interface-mode=Performance` — WiFi + 蜂窝双路聚合
- `sni-sniffing=true` — 无 MITM TLS 识别
- `disconnect-on-policy-change=false` — 切换不断连
- DoH 三路并发 (Google DNS + Cloudflare + DNSPod)

## 注意事项

- 必须开启并信任 MITM
- 订阅链接为占位符，需自行填入
- 可莉 `.lsr` / `.lpx` 通过 `kelee.one` CDN 分发，仅 Loon 客户端可拉取

## 目录

```
Profile/
  Loon.lcf                 # Loon 主配置
  QX.conf                  # Quantumult X 主配置
Plugin/
  qidian.plugin            # 起点全能助手 Pro v3.6
  youtube.plugin           # YouTube 增强
  zhihuifangdong.plugin    # 智慧房东广告屏蔽
Scripts/
  Qidian.js                # 起点脚本
  Zhihuifangdong.js        # 智慧房东脚本
Assets/
  1s.mp4                   # 1 秒占位视频
```
