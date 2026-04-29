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

## 架构概览 (v5.0)

```
┌─────────────────────────────────────────────────────────────┐
│  五路策略分流                                                 │
│  Proxy (Auto) │ Streaming │ AI │ Apple │ Final              │
├─────────────────────────────────────────────────────────────┤
│  去广告 (双层互补)                                            │
│  Rewrite 层: Remove_ads_by_keli + 开屏去广告                 │
│  Script 层:  qidian.plugin v4.4 (抓包驱动深度净化)           │
├─────────────────────────────────────────────────────────────┤
│  DNS 加速                                                    │
│  DoH (doh.pub + alidns) + DoQ (alidns:853 + adguard:853)   │
├─────────────────────────────────────────────────────────────┤
│  应用增强                                                    │
│  iRingo (Apple 地图/定位/天气) + DualSubs (双语字幕)         │
│  YouTube 去广告 + 智慧房东去广告                              │
└─────────────────────────────────────────────────────────────┘
```

## 策略组说明

| 策略组 | 用途 | 默认 |
|--------|------|------|
| **Proxy** | 通用国际流量 | Auto (延迟最低) |
| **Streaming** | YouTube/Netflix/Disney+/Spotify | Auto |
| **AI** | ChatGPT/Claude/Gemini/Perplexity/Copilot | 美国节点 |
| **Apple** | Apple 服务 | DIRECT |
| **Final** | 未匹配流量 | Proxy |

## 插件列表

| 层级 | 插件 | 说明 |
|------|------|------|
| 内核 | Block_HTTPDNS / BlockAdvertisers / Prevent_DNS_Leaks | 网络安全基础 |
| 基础 | SafeRedirect / Remove_ads_by_keli / 开屏去广告 | 通用去广告 |
| 可莉 | QiDian_remove_ads / YouTube_remove_ads | 应用级精准拦截 |
| 工具 | Sub-Store / QuickSearch | 订阅管理/快捷搜索 |
| 自维护 | 起点全能助手 v4.4 / YouTube增强 / 智慧房东 / **AI分流** | 深度定制 |
| Apple | iRingo 地图/定位/天气 ×4 | Apple 服务增强 |
| 媒体 | DualSubs 双语字幕 | 流媒体增强 |

## 起点全能助手功能

- GDT/穿山甲视频 1s 替换 + finishWatch 自动重放 (9x激励/3x福利)
- getconf 全量广告覆写 + 悬浮广告字段删除
- 福利中心精简 (保留激励任务/视频奖励/积分兑换/抽奖)
- 发现页白名单过滤 (仅保留 ip专区/专栏/书单/点点圈)
- 每日阅读积分满值显示
- 29 个追踪域 REJECT
- cron 9:00 AM 静默签到

## DNS 加速

- `DoH` — doh.pub + dns.alidns.com (国内 Zero-RTT)
- `DoQ` — quic://dns.alidns.com:853 + quic://dns.adguard-dns.com:853 (Loon 独有)
- `prefer-doh3` — QX 启用 HTTP/3 DoH
- 国内域名指定国内 DNS，避免污染

## 注意事项

- 必须开启并信任 MITM 证书
- 订阅链接为占位符，需自行填入
- 可莉 `.lsr` / `.lpx` 通过 `kelee.one` CDN 分发，仅 Loon 客户端可拉取
- AI 策略组建议选择美国/日本节点（部分 AI 服务有地区限制）

## 目录

```
Profile/
  Loon.lcf                 # Loon 主配置 v5.0
  QX.conf                  # Quantumult X 主配置 v15
Plugin/
  qidian.plugin            # 起点全能助手 Pro v4.4
  youtube.plugin           # YouTube 增强
  zhihuifangdong.plugin    # 智慧房东广告屏蔽
  ai.plugin                # AI 服务分流 (新增)
Scripts/
  Qidian.js                # 起点脚本 v4.3
  Zhihuifangdong.js        # 智慧房东脚本
Templates/
  Script_Template.js       # 脚本模板
```
