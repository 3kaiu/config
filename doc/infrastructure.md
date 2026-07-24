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

- `cdn-verify.yml`：每日 02:34 拉取 CDN 全量分发文件与仓库做 sha256 比对，不一致开 Issue（标签 `cdn-verify`），可选 Bark 告警（Secret `BARK_PUSH`）。
- `upstream-health.yml`：上游源可达性探活（状态码级）。
- `Scripts/ENGINE-MANIFEST.json`：Qidian 内嵌引擎哈希清单，`config-validate.yml` step 9 强制校验。
- 已知局限：cdn-verify 只覆盖"CDN vs 仓库"，不覆盖"仓库写入本身是否被投毒"——后者靠 mirror 改 PR 制 + 分支保护（规划中，见审计 P0 项）。

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
