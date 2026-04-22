# 📚 Rewrite Scripts & Configs

这是一个专门用于存放 Quantumult X / Surge / Loon 等代理软件的自定义重写脚本与配置片段的通用仓库。

## 📁 目录结构说明

- **`/Scripts`**
  存放所有具体的 JavaScript 脚本逻辑（例如：UI 净化、API 修改、自动签到重放等）。
  
- **`/Rewrite`**
  存放代理软件可直接订阅的配置文件片段（Snippet）。这些文件内部通过远程链接引用 `/Scripts` 目录下的具体脚本，并配置了所需的重写规则（Rewrite）及主机名（MITM）。

## 🚀 现有模块

### 1. 起点全能助手
- **功能**: 激励视频自动重放、底部导航栏精简、账户页面去广告净化。
- **订阅链接**: `https://raw.githubusercontent.com/3kaiu/config/main/Rewrite/qidian.snippet`
- **使用方法**: 在 QX 的 `[rewrite_remote]` 中添加上述订阅链接即可，脚本和 MITM 将自动生效。

---
*Generated with AI.*
