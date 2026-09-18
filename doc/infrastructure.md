# 分发基础设施台账

> 本仓库的全部客户端配置/脚本经由自建 CDN 分发，本页记录信任根、容灾与轮换流程。
> 建立于 2026-07-24 全面审计（长期演进 #13）。

## 1. 分发通道

| 通道 | 地址 | 状态 | 说明 |
|------|------|------|------|
| 主 CDN | `https://ws.wenn.in/main/<仓库路径>` | 生产 | 仓库 main 分支的 CDN 化代理；内容控制权 = 仓库写权限 |
| 备分发 | `https://3kaiu.github.io/config/<仓库路径>` | 冻结(可访问但陈旧) | GitHub Pages 站点在服务 2026-08-29 前的旧内容；`pages-deploy.yml` 已删除, 仓库内无工作流可触发新部署 — 见第 5 节 |
| 源头 | `github.com/3kaiu/config` main 分支 | 生产 | 唯一事实来源 |

路径映射为恒等映射：`ws.wenn.in/main/Scripts/Qidian.js` ↔ 仓库 `Scripts/Qidian.js` ↔ Pages `/config/Scripts/Qidian.js`。

> ⚠️ 三者的**新鲜度不等**：仓库/CDN 每日刷新, Pages 自 2026-08-29 起冻结。
> 使用前必须比对 sha256, 不要假设 Pages 与仓库一致。

## 2. 域名台账（wenn.in）

| 项 | 值 |
|----|----|
| 注册商 | Hosting Concepts B.V. dba Openprovider（whois 实测 2026-09-04） |
| 到期日 | 2033-08-14（余约 7 年）+ clientTransferProhibited 锁定中 |
| 自动续费 | 未知（whois 不可见，需登录 Openprovider 确认开启） |
| 注册邮箱 | 隐私保护不可见（确保可收回，需自查） |
| CDN 实现 | 未知（待确认：Cloudflare/Workers/Nginx 回源等） |
| TLS 证书 | 未知（待确认自动续期/到期日） |

> ⚠️ 域名过期被抢注 = 全量 script-path 可被第三方投毒（15 个插件 + 3 份 Profile 同时受影响）。
> 建议：开启自动续费 + 注册商到期邮件 + 日历提醒（到期前 30 天）。

## 3. 完整性保障

- `mirror-scripts.yml`：每日 03:00 从上游抓取约 60 项（MANIFEST 40 条目 + startup 插件等非清单产物；2026-09 实测单次成功 54+），经四重门禁（`*.js` 语法 / 体积下限 = 绝对 200B **+ 相对上次原始抓取 50%** / 非 HTML / `.plugin` script-path 域白名单）后写入 `Mirror/`，**走 PR 人工审核**合并（不再直推 main）。插件外壳远程引用已收敛到 `ws.wenn.in/main/Mirror/`（插件内部 bundle 引用仍直连上游，见 3b）。
- `Mirror/MANIFEST.json`：全部镜像文件的 source_url + sha256 + `upstream_bytes`（原始抓取体积，供体积门禁做相对比较）清单，上游变更在 PR diff 中高亮。
- `cdn-verify.yml`：每日 02:34 拉取 CDN 全量分发文件与仓库做 sha256 比对，不一致开 Issue（标签 `cdn-verify`），可选 Bark 告警（Secret `BARK_PUSH`）；同时做 GitHub Pages 链路（3kaiu.github.io/config）可达性抽查（非阻断，且 Pages 内容已冻结 — 见第 5 节）。**接受的风险**：日检 = 最长 **~24h 检测窗口** — CDN 被篡改后最多 24h 内客户端仍在拉被篡改内容（缓解：篡改者需先持有 Cloudflare/回源控制权；MitM 域暴露的凭据轮换清单见第 5 节）。若需缩短，可在 cdn-verify 加 `schedule` 多时刻 cron（成本：Actions 分钟数线性增加），当前未启用。
- `upstream-health.yml`：上游源可达性探活（状态码级），探测列表镜像部分派生自 `Mirror/MANIFEST.json`。
- `Scripts/ENGINE-MANIFEST.json`：Qidian 内嵌引擎哈希清单，`config-validate.yml` step 8 强制校验。

## 3b. 残留风险（知情项）

1. **kelee.one 7 个 `.lpx`**：Cloudflare Turnstile 阻挡自动抓取，无法镜像/校验，Loon 端直接从该站加载。介意者在 Loon 内停用对应插件。
2. **插件内部 bundle 引用直连上游（部分）**：**NSRingo 已收敛**（2026-09-18 镜像 PR #42：插件内
   `script-path` 已由 workflow sed 补丁重写为 `ws.wenn.in/main/Mirror/iringo/`，bundle.js 13 项亦已镜像跟随 latest）。
   **仍直连上游**（2026-09-18 实测）：DualSubs（钉 v1.7.5/v1.5.11/v0.5.7）、Auraflare（Cloudflare 面板三件套指 raw.githubusercontent main 分支；DNS 钉 v2.6.3）、BiliUniverse（钉 v0.6.x）。
   上游清理旧 release 或改分支名会导致对应功能失效；`upstream-health.yml` 持续探测这些 URL 兜底。
3. **GeoIP/ASN 库**（Loyalsoldier / P3TERX）：客户端直连上游，被篡改只会导致路由误判（非代码执行），风险低，暂不镜像。
4. **NSRingo 版本策略（2026-09-18 复核更新 —— MOD-09 已由镜像 PR #42 修复）**：
   - **实测状态（2026-09-18）**：MANIFEST 中全部 iRingo 插件（含 WeatherKit —— 上游 latest 现以
     `.lpx` 资产发布，workflow 已跟进抓取）与 13 个 bundle.js 的 `source_url` 均为
     `releases/latest/download/…` 且 `fetched_at` 均有当日成功记录 —— 声明与实际一致，**漂移已清零**。
     `Maps` 仓库改名已跟进（workflow 与 MANIFEST 均为 `NSRingo/Maps/…`）。
   - 防回归机制：`mirror-drift-check --strict`（`npm run check:drift`）比对 workflow 声明的
     `mirror()` URL 与 MANIFEST `source_url`，未登记的漂移/从未抓取即判红（CI step 9c）——
     "声明 latest 但 keep_old 停在旧版"从此**不再静默**。`upstream-health.yml` 只探 URL 200，
     仍探不出这类漂移，仅作兜底。
   - 上游发新版时：无需人工改版本号（latest 自愈）；DualSubs/Auraflare/BiliUniverse 仍需人工跟进钉死版本。
5. **Release tag 未签名 —— 不构成供应链信任锚**（2026-09-11 审计 SEC-04）：`release.yml` 用 `gh release create --generate-notes` 发布，**无 tag 签名校验**（仓库零签名 tag 历史，属有意取舍；`--verify-tag` 已于 2026-09-04 移除，因首发必红）。因此 **Release 页面只应视为"内部快照分发"，不能当作可验证产物**。
   - 真正的信任锚是 `script-tests.yml` 为 `Scripts/*.js` 生成的 **attestation**（可用 `gh attestation verify` 校验构建出处）。两者不要混为一谈 —— 需要"可验证"时用 attestation，不要用 Release tag。

## 4. DNS 隐私（泄漏面精确说明）

解析语义：**命中域名类规则（DOMAIN-SUFFIX 等）的代理流量不做本地 DNS 查询**——域名直接发给代理服务器远端解析，解析器侧无记录。本地解析（走国内 DoH：阿里/腾讯/字节，ISP 不可见但解析器侧有记录）只发生在三处：

| 泄漏面 | 触发条件 | 现状缓解 |
|--------|----------|----------|
| GEOIP 求值 | 域名未命中任何域名规则，需解析出 IP 再匹配 `GEOIP, CN` | blackmatrix7 Global/China 列表覆盖主流域名，走到 GEOIP 的只剩长尾 |
| Final 兜底 | 未匹配任何规则 + Final 组为 DIRECT（当前默认） | Final 为 select 组，可手动切 Proxy |
| 直连流量 | 国内域名的 DIRECT 连接 | 用国内解析器本就正确（低延迟/无污染） |

**默认姿态**（当前）：便利性优先——GEOIP 兜底 + Final 默认 DIRECT，保证未收录的国内小站直连可用。
**零泄漏姿态**（按需）：删除 `geoip, cn, direct` 规则 + Final 组切到 Proxy——所有长尾域名走代理远端解析，代价是未收录的国内站点绕路代理（变慢或不可用）。
**本地解析加密**：本地解析全部走 DoH/DoQ（`prefer-doh3`），ISP 与中间人不可见查询内容；`hijack-dns` 防 App 明文 DNS 绕过。
**解析器选择说明**：未采用 1.1.1.1/Quad9 等隐私解析器作为默认——大陆网络下不可达/高延迟，会导致国内直连流量解析失败；国内 DoH 的记录风险仅覆盖上述三处长尾，代理流量不在其列。

## 5. 应急切换（ws.wenn.in 不可用/被劫持）

**被劫持（内容被篡改，cdn-verify 告警）**：
1. 立即在 Loon 中停用本配置或断网，防止恶意脚本继续在 MitM 上下文执行；
2. 改 CDN 回源/DNS 恢复内容，或启用备用域名；
3. 轮换所有"已对 MitM 暴露"的凭据：京东 pt_key、淘系 token、百度 BDUSS、网易 MUSIC_U、起点 cmfuToken 等；
4. 排查 CDN 配置与域名账户安全，复盘后再恢复。

**不可用（域名/CDN 故障）**：

> ⚠️ **2026-08-29 审计纠正**：本节原写"启用 Pages 备分发（pages-deploy.yml 绿灯）"，
> 但 `pages-deploy.yml` 已删除。Pages 站点本身仍在服务（实测 200），却是**冻结的旧内容**：
> 2026-08-29 前后仓库无任何工作流可触发新部署, 实测 `3kaiu.github.io/config/Profile/Loon.lcf`
> 的 sha256 与仓库当前产物不同。切成 Pages 得到的是陈旧配置 —— 功能降级但不算投毒,
> 属于"可接受的应急"而非"等价通道"。

1. **先评估陈旧度**，决定是否值得切：
   ```sh
   curl -s https://3kaiu.github.io/config/Profile/Loon.lcf | shasum -a 256
   ```
   与仓库当前 `Profile/Loon.lcf` 比对。若差异可接受（仅是新增插件/规则），可继续；
   若冻结版本过旧导致关键插件 script-path 已变更，**优先修 CDN 而不是切 Pages**。
2. 批量替换已导出配置中的 URL（Loon 示例，导出配置文本后执行）：
   ```sh
   sed -i '' 's#https://ws.wenn.in/main/#https://3kaiu.github.io/config/#g' 导出的配置.conf
   ```
   或直接用 Pages 地址重新导入 Profile：
   `https://3kaiu.github.io/config/Profile/Loon.lcf`。
3. 注意：Loon 已安装插件内嵌的 script-path 不会自动切换，需重装插件（插件 URL 同样替换前缀即可）。
4. **恢复 Pages 为可用兜底**（后续 TODO）：重新引入一个极简 `pages-deploy.yml`
   （build_type=workflow, 推 main 时上传仓库根目录到 Pages），使 Pages 重新跟随 main。
   在未完成前，Pages 只能当"降级兜底"用, 不能当"等价通道"宣传。

## 6. 变更 checklist（动 CDN/域名前过一遍）

- [ ] `cdn-verify.yml` 手动触发一次全绿
- [ ] 变更窗口避开 02:00-03:10（mirror/health/cdn-verify 定时任务集中段）
- [ ] 变更后手动触发 `cdn-verify.yml` 复核
- [ ] 如更换域名：同步更新本文件、并保留旧域名 301 至少一个月（客户端导入链接在 surgio 输出物中, 由 tpl 管理）
