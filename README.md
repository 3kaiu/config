# Quantumult X & Loon 配置库

这个仓库提供 Quantumult X 和 Loon 的主配置，以及少量自维护脚本和插件。

## 平台选择

| 平台 | 主配置 | 说明 |
| --- | --- | --- |
| Quantumult X | `QX.conf` | 基础分流、去广告、起点增强 |
| Loon | `Loon.conf` | 极速代理、DNS 加速、深度去广告、应用增强 |

## 快速导入

### Loon

```
https://raw.githubusercontent.com/3kaiu/config/main/Profile/Loon.conf
```

插件：
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

## Loon 配置特性

### 代理极速
- `ip-mode=dual` — 并发 A+AAAA DNS 查询
- `interface-mode=Performace` — WiFi + 蜂窝双路聚合
- `hijack-dns=*:53` — 拦截 App 私建 DNS，强制 FakeIP
- `tolerance=100` — url-test 防抖，避免节点 ping 抖动频繁切换
- DoH/DoH3 三路并发 DNS

### 去广告
- `domain-reject-mode=DNS` — DNS 阶段零延迟阻断
- Blackmatrix7 五大规则库 + YouTube 分流
- 起点插件 — 深度净化 + 广告 SDK 拦截 + 追踪屏蔽

### 应用增强
- 起点全能助手 — 自动重放、每日签到、页面净化
- YouTube — 代理分流 + MITM 解密
- 京东每日签到
- Sub-Store 订阅管理器
- Loon 插件画廊

### MITM 覆盖
Apple / 起点 / 广告 GDT&穿山甲 SDK / YouTube

## 起点插件技术细节

`Plugin/qidian.plugin` + `Scripts/Qidian.js` 实现：

| 功能 | 实现方式 |
| --- | --- |
| GDT/穿山甲广告拦截 | http-response 脚本修改 video_duration → 1 |
| 视频广告自动重放 | http-request 拦截 finishWatch 并发多包提交 |
| 页面模块净化 | CleanRules 按 JSON 路径删除广告模块 |
| 客户端配置覆写 | 篡改 getconf 响应关闭 Pangle/埋点/开屏广告 |
| 追踪 SDK 屏蔽 | REJECT 规则阻断 QQ/火山/极光/埋点域名 |
| 每日签到 | cron + 窃取 Token 静默完成 |

## Quantumult X 选择建议

| 需求 | 导入项 |
| --- | --- |
| 日常稳定使用 | `QX.conf` |
| Apple 系统增强 | `QX.conf` + `QX-Optional-Apple.conf` |
| 单 App 广告残留 | `QX.conf` + `QX-Optional-Ads.conf` |
| 只给某个 App 去广告 | `QX.conf` + `Profile/Ads/*.conf` |
| B 站区域 / 双语字幕 | `QX.conf` + `QX-Optional-Media.conf` |
| WARP / 链路接管 | `QX.conf` + `QX-Optional-Network.conf` |

## 去广告维护方式

- 基础盘使用自维护的精选去广告组合
- Loon 端依赖 Blackmatrix7 规则库 + 自维护脚本
- QX 专项去广告入口在 `QX-Optional-Ads.conf`，聚合本仓库内单 App 配置
- 选材参考可莉插件生态、墨鱼、blackmatrix7 规则仓库
- 参考来源记录在 `Rewrite/Ads/SOURCES.md`

## 已知注意事项

- 起点兼容：基础去广告规则需剔除 `gdt / pangolin` 冲突项，否则奖励视频脚本拿不到原始响应体
- Loon 必须开启并信任 MITM 才能启用脚本和插件
- Loon 配置中的订阅链接为占位符，需自行填入

## 目录

```
Profile/
  Loon.conf          # Loon 主配置
  QX.conf            # Quantumult X 主配置
Plugin/
  qidian.plugin      # 起点全能助手 (Loon)
  youtube.plugin     # YouTube 增强 (Loon)
Scripts/
  Qidian.js          # 起点全能助手脚本
Rewrite/             # QX 可订阅重写片段
Templates/           # 脚本模板
```
