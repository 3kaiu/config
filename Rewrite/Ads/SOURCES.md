# Ads Sources

这份目录记录自维护去广告配置的参考来源与选型原则。

## 参考来源

- 可莉 Loon 资源库  
  https://github.com/luestr/ProxyResource
- 墨鱼脚本与重写仓库  
  https://github.com/ddgksf2013/ddgksf2013
- blackmatrix7 iOS Rule Script  
  https://github.com/blackmatrix7/ios_rule_script

## 当前策略

- 基础盘只保留低冲突、高通用的去广告能力。
- 起点奖励视频链路优先级高于综合广告 SDK 拦截。
- 专项去广告按 App 拆分，避免重新回到“大而全全开”。
- 上游仓库用于选材和更新参考，不直接决定基础盘的默认行为。

## 当前采用的能力

- `AllInOne` 的起点兼容裁剪版  
  用于基础盘综合去广告，但剔除会误伤 `gdt / pangolin` 的规则。
- `FakeiOSAds`  
  用于常见开屏广告处理。
- `YouTubeAds`  
  单独保留，避免被综合规则更新节奏影响。
- `Weibo / WeChat / Applet / BaiduSearch / Zhihu / Ximalaya`  
  作为专项增强候选，按稳定性拆进 `QX-Optional-Ads.conf` 或 `Profile/Ads/*.conf`。

## 内收状态

- `Profile/Ads/Weibo.conf`：已改为本仓库维护版
- `Profile/Ads/Zhihu.conf`：仍引用上游
- `Profile/Ads/Baidu.conf`：仍引用上游
- `Profile/Ads/Ximalaya.conf`：仍引用上游
- `Profile/Ads/Web.conf`：仍引用上游
- `Profile/Ads/Applet.conf`：仍引用上游，但仅作为特定小程序的定向选项

## 为什么参考可莉

可莉生态的价值主要在“覆盖面”和“选题”：

- 哪些 App 值得单独拆插件
- 哪些广告类型需要单独处理
- 哪些模块不应该默认混进基础盘

这份仓库只参考这些经验，不直接采用 Loon 插件格式。

## 已做的筛除

- `WeChat.conf`：上游已标记“已失效”，不再纳入通用广告配置。
- `Applet.conf`：只针对一组特定小程序，改为单独文件，不再混入通用广告增强。
