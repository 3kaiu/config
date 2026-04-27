# Quantumult X 配置库

这个仓库只做一件事：给 Quantumult X 提供一套更稳、更轻的主配置，以及少量自维护脚本。

## 选择建议

| 需求 | 导入项 |
| --- | --- |
| 日常稳定使用 | `QX.conf` |
| Apple 系统增强 | `QX.conf` + `QX-Optional-Apple.conf` |
| 单 App 广告残留 | `QX.conf` + `QX-Optional-Ads.conf` |
| B 站区域 / 双语字幕 | `QX.conf` + `QX-Optional-Media.conf` |
| WARP / 链路接管 | `QX.conf` + `QX-Optional-Network.conf` |

## 默认策略

- 主配置优先性能和稳定性，不再默认叠加过多重写模块。
- 去广告分两层：`filter` 先拦主机级请求，`rewrite` 再处理必须改写的响应。
- 系统级增强、区域解锁、WARP 这类高介入功能默认按需开启，不放进基础盘。
- `MITM` 只覆盖基础盘默认启用功能，避免无关域名长期解密。

## 快速使用

主配置：

```text
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX.conf
```

可选增强：

```text
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX-Optional-Apple.conf
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX-Optional-Ads.conf
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX-Optional-Media.conf
https://raw.githubusercontent.com/3kaiu/config/main/Profile/QX-Optional-Network.conf
```

起点模块：

```text
https://raw.githubusercontent.com/3kaiu/config/main/Rewrite/qidian.snippet
```

启用脚本相关功能前，先在 Quantumult X 中开启并信任 `MITM`。

## 当前保留的重点能力

- 基础分流与测速
- 常规去广告
- 起点自动化与页面净化
- 按需开启的 Apple / Bilibili / WARP 扩展

## 配置分级

- `QX.conf`：基础盘，默认长期使用
- `QX-Optional-Apple.conf`：Apple 系统级增强
- `QX-Optional-Ads.conf`：专项去广告增强
- `QX-Optional-Media.conf`：媒体区域与字幕增强
- `QX-Optional-Network.conf`：链路级接管

## 导入建议

- 先导入 `QX.conf`
- 再根据需要单独添加一个或多个 Optional 文件
- 不建议一次性把全部 Optional 文件一起叠加
- 优先按“单一目标”增加模块，不要把 Optional 当成新的基础盘

## 不建议直接引入的内容

- Loon 插件原格式
- 多套大而全去广告模块同时全开
- 未区分主功能和可选功能的懒人全家桶

原因很简单：这套仓库以 QX 为主，优先控制匹配成本、MITM 范围和规则冲突。

## 目录

- `Profile/`：主配置
- `Rewrite/`：QX 可订阅重写片段
- `Scripts/`：脚本
- `Templates/`：脚本模板
