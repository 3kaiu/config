---
kind: external_dependency
name: NSRingo iRingo Apple 增强套件
slug: nsringo-iringo
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
source_files:
    - QX/apple/WeatherKit.conf
    - QX/apple/Maps.conf
    - Mirror/nsringo/GeoServices-v4.6.1-request.bundle.js
---

### 项目定位
Apple 原生应用的增强套件，解锁中国大陆受限功能。

### 增强范围
- WeatherKit: 空气质量数据、降水预报、天气地图
- Maps: 卫星地图、周边探索、国际版导航
- Apple News: 解锁新闻应用
- Siri: 国际版功能与搜索建议
- TestFlight: 区域解锁、多账户切换

### 技术实现
- 需要 MitM 解密特定 Apple 域名
- QX 端使用本地转换的 .conf 文件（非官方 .yaml）
- bundle.js 文件镜像到 Mirror/nsringo/ 目录

### 安全考虑
- 仅针对具体子域进行 MitM，不影响银行安全
- 在 QX 中通过负向排除后显式声明覆盖
- 版本固定的 bundle.js 避免供应链攻击