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

## Loon 配置架构 (v2.3)

### 规则分层

```
本地 Rule (Apple/微信直连 + 广告 SDK 白名单)
    ↓
可莉 REMOTE RULE × 6 (REGION + LAN + Telegram + Netflix + TikTok + AI)
    ↓
Blackmatrix7 REMOTE RULE × 3 (广告 + 隐私 + 国内外域名)
    ↓
可莉 PLUGIN × 7 (Block_HTTPDNS → BlockAdvertisers → Prevent_DNS_Leaks → Node_detection → BoxJs → Script-Hub → QuickSearch)
    ↓
Blackmatrix7 PLUGIN × 2 (SafeRedirect 安全重定向 + Startup 开屏去广告)
    ↓
自维护 PLUGIN × 2 (起点 + YouTube)
    ↓
FINAL → 兜底策略组
```

### 完整覆盖率 (9 层全部就位)

| 层 | 内容 |
|---|------|
| **节点** | 8 地区 Remote Filter 自动分组 + url-test tolerance=100 |
| **规则 (Remote Rule)** | KeLi ×6 (IP级 + Telegram/Netflix/TikTok/AI) + Blackmatrix7 ×3 |
| **插件 (Plugin)** | KeLi ×7 + Blackmatrix7 ×2 + 自维护 ×2 + Sub-Store + Gallery + 节点看板 = **14 个** |
| **脚本 (Script)** | JD cron 签到 + Qidian.js (5 bug已修复) + YouTube 脚本拦截 |
| **复写 (Rewrite)** | SafeRedirect.plugin — 60 条 HTTP→HTTPS 安全重定向 + 追踪参数清除 |
| **DNS** | DoH×3 + DoH3×2 + hijack-dns 11 IP + Host 映射 12 大厂 |
| **MITM** | Apple/起点/YouTube/GDT/穿山甲 + 插件 %APPEND% 追加 |
| **数据持久化** | BoxJs.lpx + Sub-Store.lpx |
| **其他 (General)** | 22 项参数 (sni-sniffing, disable-stun, disconnect-on-policy-change...) |

### 可莉生态集成

| 资源 | 类型 | 功能 |
|------|------|------|
| `REGION_SPLITTER.lsr` | Remote Rule | 国内 IP 自动分流到直连 |
| `LAN_SPLITTER.lsr` | Remote Rule | 局域网 IP 自动分流 |
| `Telegram.lsr` | Remote Rule | Telegram 精准分流 |
| `Netflix.lsr` | Remote Rule | Netflix 精准分流 |
| `TikTok.lsr` | Remote Rule | TikTok 精准分流 |
| `AI.lsr` | Remote Rule | ChatGPT/Gemini/Claude AI 分流 |
| `Block_HTTPDNS.lpx` | Plugin (pin) | 屏蔽 App 私建 HTTPDNS |
| `BlockAdvertisers.lpx` | Plugin (pin) | 动态广告拦截增强 |
| `Prevent_DNS_Leaks.lpx` | Plugin | 防止 DNS 泄露 |
| `Node_detection_tool.lpx` | Plugin | 节点实时检测 |
| `BoxJs.lpx` | Plugin | 脚本数据持久化引擎 |
| `Script-Hub.lpx` | Plugin | 签到/比价/解锁脚本中心 |
| `QuickSearch.lpx` | Plugin | Spotlight/Safari 快捷搜索 |
| `geodata.kelee.one` | GEOIP/ASN | 可莉 CDN 加速数据库 |
| `Remote Filter` | 节点分组 | 按地区自动分类节点 |

### 新增 Rewrite 层 (v2.3)

| 资源 | 类型 | 功能 |
|------|------|------|
| `SafeRedirect.plugin` | Plugin (Rewrite) | 60 条 HTTP→HTTPS 安全重定向 + 去除追踪参数 |
| `startup.lnplugin` | Plugin (Script) | 京东/B站/爱奇艺/美团/嘀嗒/多点 等 10+ App 开屏去广告 |

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
