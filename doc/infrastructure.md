# 分发基础设施台账

> 本仓库的全部客户端配置/脚本经由自建 CDN 分发，本页记录信任根、容灾与轮换流程。
> 建立于 2026-07-24 全面审计（长期演进 #13）。

## 1. 分发通道

| 通道 | 地址 | 状态 | 说明 |
|------|------|------|------|
| 主 CDN | `https://ws.wenn.in/main/<仓库路径>` | 生产 | 仓库 main 分支的 CDN 化代理；内容控制权 = 仓库写权限 |
| 备分发 | `https://3kaiu.github.io/config/<仓库路径>` | 待启用 | GitHub Pages，由 `pages-deploy.yml` 自动发布；需在仓库 Settings → Pages → Source 选 "GitHub Actions" 后生效 |
| 源头 | `github.com/3kaiu/config` main 分支 | 生产 | 唯一事实来源 |

路径映射为恒等映射：`ws.wenn.in/main/Scripts/Qidian.js` ↔ 仓库 `Scripts/Qidian.js` ↔ Pages `/config/Scripts/Qidian.js`。

## 2. 域名台账（wenn.in）

| 项 | 值 |
|----|----|
| 注册商 | TODO: 填写（如 Cloudflare / Namecheap） |
| 到期日 | TODO: 填写 |
| 自动续费 | TODO: 是/否 |
| 注册邮箱 | TODO: 填写（确保可收回） |
| CDN 实现 | TODO: 填写（Cloudflare Pages/Workers/Nginx 回源等） |
| TLS 证书 | TODO: 自动续期/到期日 |

> ⚠️ 域名过期被抢注 = 全量 script-path 可被第三方投毒（15 个插件 + 3 份 Profile + 5 个 QX 模块同时受影响）。
> 建议：开启自动续费 + 注册商到期邮件 + 日历提醒（到期前 30 天）。

## 3. 完整性保障

- `mirror-scripts.yml`：每日 03:00 从上游拉取 **59 个资源**（脚本 7 + 解析器 6 + 双端规则列表 12 + QX rewrite 模块 18 + Loon rewrite 插件 2 + NSRingo bundle 8 + NSRingo Loon 插件 6），经三重门禁（`*.js` 语法 / 体积≥200B / 非 HTML）后写入 `Mirror/`，**走 PR 人工审核**合并（不再直推 main）。Profile 全部远程引用已收敛到 `ws.wenn.in/main/Mirror/`。
- `Mirror/MANIFEST.json`：全部镜像文件的 source_url + sha256 清单，上游变更在 PR diff 中高亮。
- `cdn-verify.yml`：每日 02:34 拉取 CDN 全量分发文件与仓库做 sha256 比对，不一致开 Issue（标签 `cdn-verify`），可选 Bark 告警（Secret `BARK_PUSH`）。
- `upstream-health.yml`：上游源可达性探活（状态码级）。
- `Scripts/ENGINE-MANIFEST.json`：Qidian 内嵌引擎哈希清单，`config-validate.yml` step 9 强制校验。

## 3b. 残留风险（知情项）

1. **blackmatrix7 Loon rewrite 插件的传递性引用**：`Mirror/rules/loon-AllInOne.plugin` 与 `loon-AdvertisingScript.plugin` 内部的 `script-path` 仍指向 blackmatrix7 的 raw 地址——镜像只消除了插件文件本身的单点，其内嵌脚本仍从上游直取。完全收敛需要同时镜像内嵌 JS 并重写引用，列为后续项。
2. **kelee.one 7 个 `.lpx`**：Cloudflare Turnstile 阻挡自动抓取，无法镜像/校验，Loon 端直接从该站加载。介意者在 Loon 内停用对应插件。
3. **GeoIP/ASN 库**（Loyalsoldier / P3TERX）：客户端直连上游，被篡改只会导致路由误判（非代码执行），风险低，暂不镜像。
4. **NSRingo 版本升级流程**：Loon 插件与 QX bundle 均已钉死版本（WeatherKit v3.1.0 / Maps·GeoServices v4.6.1 / News v3.2.1 / Siri v4.2.7 / TestFlight v3.4.0）。上游发新版时：改 `mirror-scripts.yml` 中的版本号 + `template/loon.tpl` 引用，跑一次 mirror 工作流。`upstream-health.yml` 会探测已钉死 URL 的可用性，但**不会**提示有新版本（受管陈旧）。

## 4. 应急切换（ws.wenn.in 不可用/被劫持）

**被劫持（内容被篡改，cdn-verify 告警）**：
1. 立即在 Loon/QX 中停用本配置或断网，防止恶意脚本继续在 MitM 上下文执行；
2. 改 CDN 回源/DNS 恢复内容，或启用备用域名；
3. 轮换所有"已对 MitM 暴露"的凭据：京东 pt_key、淘系 token、百度 BDUSS、网易 MUSIC_U、起点 cmfuToken 等；
4. 排查 CDN 配置与域名账户安全，复盘后再恢复。

**不可用（域名/CDN 故障）**：
1. 启用 GitHub Pages 备分发（确认 Settings → Pages 已启用，`pages-deploy.yml` 绿灯）；
2. 批量替换已导出配置中的 URL（Loon 示例，导出配置文本后执行）：
   ```sh
   sed -i '' 's#https://ws.wenn.in/main/#https://3kaiu.github.io/config/#g' 导出的配置.conf
   ```
   QX 同理；或直接用 Pages 地址重新导入 Profile：
   `https://3kaiu.github.io/config/Profile/Loon.lcf`（QX.conf / Surge.conf 同理）。
3. 注意：Loon 已安装插件内嵌的 script-path 不会自动切换，需重装插件（插件 URL 同样替换前缀即可）。

## 5. 变更 checklist（动 CDN/域名前过一遍）

- [ ] `cdn-verify.yml` 手动触发一次全绿
- [ ] 变更窗口避开 02:00-03:10（mirror/kelee/health/cdn-verify 定时任务集中段）
- [ ] 变更后手动触发 `cdn-verify.yml` 复核
- [ ] 如更换域名：同步更新 README 导入链接、本文件、并在仓库保留旧域名 301 至少一个月
