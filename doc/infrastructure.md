# 分发基础设施

> 本页记录当前 Loon 发布链路、信任边界与故障处理。Git 历史和 `CHANGELOG.md` 负责追溯，不再保留已结案的独立审计快照。

## 1. 发布通道

| 通道 | 地址 | 状态 | 说明 |
|---|---|---|---|
| 事实源 | `https://github.com/3kaiu/config` `main` | 生产 | 唯一可编辑来源 |
| 主 CDN | `https://ws.wenn.in/main/<仓库路径>` | 生产 | 路径与仓库恒等映射，内容控制权等于仓库写权限 |

Profile、脚本、插件、远程规则和大部分镜像 bundle 均通过主 CDN 分发。`cdn-verify.yml` 每日校验 CDN 内容与仓库 sha256；不一致或连续拉取失败会开 Issue，并可用 `BARK_PUSH` 告警。

已退役 GitHub Pages，不再作为备用通道或 parity 检查对象。

## 2. 域名台账

| 项 | 值 |
|---|---|
| 注册商 | Hosting Concepts B.V. dba Openprovider（whois 实测 2026-09-04） |
| 到期日 | 2033-08-14 + clientTransferProhibited 锁定 |
| 自动续费 | 未知，需登录注册商确认 |
| 注册邮箱 | 隐私保护不可见 |
| CDN 实现 | 需由域名维护者确认 |
| TLS 证书 | 需确认签发机构与自动续期 |

域名过期会导致脚本、插件和规则路径被第三方接管。变更前应确认自动续费、注册商到期邮件与至少 30 天提醒。

## 3. 完整性保障

- `mirror-scripts.yml`：每日抓取可信上游，执行体积、语法、错误页与 `script-path` 域白名单门禁，生成 PR；失败时保留旧版。
- `Mirror/MANIFEST.json`：记录每个镜像的来源、磁盘 sha256、字节数与原始抓取体积。文本镜像在补丁后统一为 LF，再计算哈希。
- `mirror-drift-check --strict`：比对 workflow 声明与 MANIFEST，阻止来源漂移或“从未抓到”静默进入主分支。
- `cdn-verify.yml`：每日校验主 CDN 与仓库内容哈希。
- `upstream-health.yml`：对 MANIFEST 镜像、GeoIP/ASN 和少量直连依赖做状态码探活。
- `Scripts/ENGINE-MANIFEST.json`：固定 Qidian 内嵌引擎来源与哈希，由 config validation 强制校验。

## 4. 已知外部依赖

- GeoIP/ASN：Loyalsoldier 与 P3TERX 仍由 Loon 直接下载；篡改主要影响路由判断，不执行代码。
- iKeLee：`kelee.one` 自 2026-08-25 起全局 403。当前本地 Kelee 插件均走自建 CDN；仅 `transport-purify` 的可选 `data-path` 仍指向该站，upstream-health 保留封锁哨兵。
- NSRingo：插件与 bundle 已镜像并改写到自建 CDN，按已批准策略跟随 `latest`，由 MANIFEST、PR 人审和 `check:drift` 约束。
- DualSubs、Auraflare、Biliverse：部分内部 bundle 仍直连上游，由 `upstream-health.yml` 探测；新增依赖必须先镜像或明确评审。
- Release tag 未签名，只是版本快照；可验证的构建出处以 `script-tests.yml` attestation 为准。

## 5. DNS 隐私

命中域名类规则的代理流量由代理远端解析，不产生本地 DNS 查询。本地 DoH/DoQ 解析只发生在 GEOIP 求值、Final/DIRECT 路径和国内直连流量。`hijack-dns` 仅拦截明确支持的明文 DNS 路径，不做 `*:0` 全量劫持。

## 6. 故障处理

### CDN 内容被篡改

1. 立即停用配置或断网，避免被篡改脚本在 MitM 上下文执行。
2. 核查 CDN 回源、DNS 与域名账户安全。
3. 从 GitHub `main` 恢复正确内容。
4. 轮换已暴露凭据，包括账号 token、Cookie、BDUSS、MUSIC_U 与 Qidian token。
5. `cdn-verify` 恢复全绿后再重新启用。

### CDN 不可用

1. 暂停镜像合并和配置发布，避免扩大影响。
2. 修复域名、证书与 CDN 回源；仓库没有等价备用分发通道。
3. 必要时使用 Loon 已导出的本地配置维持运行，但其中远程插件仍依赖主 CDN。
4. 恢复后手动触发 `upstream-health.yml` 与 `cdn-verify.yml`。

## 7. 变更检查

- [ ] `npm test`、lint、`npm run check:all` 全绿
- [ ] 模板变化后 regenerate 且 `Profile/Loon.lcf` 幂等
- [ ] 镜像变化后 MANIFEST 哈希、字节数与行尾一致
- [ ] 手动触发 `cdn-verify.yml` 与必要的 `upstream-health.yml`
- [ ] 避开 02:00–03:10 的镜像、健康检查和 CDN 校验窗口
