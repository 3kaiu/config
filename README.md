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

## Loon 配置 (v3.8)

### 去广告架构 (双层互补)

```
Rewite 层 (可莉): Remove_ads_by_keli + QiDian_remove_ads + YouTube_remove_ads
                    ↓ json-replace / json-del / reject-dict
Script 层 (自维护): qidian.plugin (GDT视频替换 + finishWatch重放 + cron签到)
                    ↓ http-response / http-request
```

### 插件 (20 个)

| 层级 | 插件 | 默认 |
|------|------|:---:|
| 内核 | Block_HTTPDNS / BlockAdvertisers / Prevent_DNS_Leaks | ✅ |
| 基础 | SafeRedirect / 开屏去广告 | ✅ |
| 可莉去广告 | Remove_ads_by_keli / QiDian / YouTube | ✅ |
| 工具 | Sub-Store / QuickSearch | ✅ |
| 自维护 | 起点全能助手 / YouTube增强 / 智慧房东 | ✅ |
| Apple | iRingo 地图/定位/天气 ×4 | 🔘 |
| 媒体 | DualSubs 双语字幕 | 🔘 |

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
