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
| 自维护 | 起点全能助手 v4.4 / 起点高阶任务 / YouTube增强 / 智慧房东 / **AI分流** | 深度定制 |
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

## 起点高阶自动化任务 (可选)

本项目集成了 ONZ3V (Yuheng0101) 开发的高阶起点签到与任务脚本。相较于默认的静默签到，高阶任务支持自动做激励碎片、广告币、每周日章节卡自动兑换及大咖荐书任务。

**抓取 Cookie 步骤**：
1. 双端在配置中将 **起点自动签到(高阶任务)** 模块/重写引用开启。
2. 确保已开启 MitM 并解密 `h5.if.qidian.com`。
3. 打开起点 App -> **我的** -> **福利中心**，抓取成功将弹出通知。
4. 获取成功后，建议关闭/注释重写以减少系统网络开销。

**双端开关说明**：
- **Loon**：直接在插件管理中打开 `qidian_tasks.plugin`，在参数配置中勾选所需任务（如激励任务、每日抽奖、大咖荐书等）。
- **Quantumult X**：脚本通过 BoxJs 提供功能开关，您可以在 BoxJs 界面中直接配置 `QDREADER_ADV_JOB_ENABLE` 等参数。

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
  qidian_tasks.plugin      # 起点自动签到高阶任务 (新增)
  youtube.plugin           # YouTube 增强
  zhihuifangdong.plugin    # 智慧房东广告屏蔽
  ai.plugin                # AI 服务分流 (新增)
QX/
  qidian.conf              # 起点去广告模块 (QX)
  qidian_tasks.conf        # 起点高阶任务模块 (QX, 新增)
  bank.conf                # 银行去广告模块 (QX)
  zhihuifangdong.conf      # 智慧房东去广告模块 (QX)
Kelee/
  *.plugin                 # 本地缓存的可莉插件镜像 (修复)
Scripts/
  Qidian.js                # 起点脚本 v4.3
  Zhihuifangdong.js        # 智慧房东脚本
Templates/
  Script_Template.js       # 脚本模板
```
