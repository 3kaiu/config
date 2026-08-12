# Changelog

All notable changes to the 3kaiu/config Loon & Quantumult X configuration project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [v8.8] — 2026-08-12

### Changed (全面审计 — 构建链修复 + 纯 JS 净化脚本测试补全)

- **构建链修复**: `npm install` 补齐缺失的 esbuild (node_modules 不完整导致 `npm run build` 长期不可用); build 重新可用, 产物与源码经测试验证功能等价 (仅 esbuild 版本格式差异)
- **测试补全**: 新增 `test/cases/plain-js-purify.test.js` — 10 个无 TS 源码的手写净化脚本 (Meituan/Douyin/Kuaishou/Youku/Fanqie/Feishu/Dianping/WPS/Kugou/Kuwo) 首次获得回归测试 (13 用例), 覆盖核心净化 + $response 守卫 + 正常内容保留; 测试 55 → 68
- **已知风险记录**: Kuwo 脚本将 `data` 对象整体清空 (`obj[k] = {}`) — 若 `rich.kuwo.cn` 的 data 含正常字段可能过度清理, 需实测确认 (未擅改脚本)

### Notes

- 全面审计确认无新缺口: src 脚本全部被插件引用 (零死代码); Scripts 产物与 src 时间戳差异仅为 git checkout 噪声; 测试覆盖完整 (文件名聚合但逐个覆盖)
- 遗留: 83 个未提交改动 (自 v8.5 起各轮迭代) — 建议尽快 git commit 建立基线, 否则无法 bisect 定位回归
- 纯 JS 净化脚本 (10 个) 未 TS 化 — 已知黑盒面, 本轮以测试补齐回归保护, TS 迁移列为后续项

---

## [v8.7] — 2026-08-12

### Changed (模板↔产物双源漂移根治 — Architect 决策)

- **根因定位**: surgio 生成依赖 `provider/` 目录 (仓库从未提交) → CI 的 surgio-build 从未成功 → Profile/ 实为手动维护, 模板与产物长期分叉
- **新增 `tools/tpl-sync-check.mjs`** (双向一致性):
  - 正向: 模板 (含 snippet include) 静态行必须完整存在于产物
  - 反向: 产物静态段独有行报残留 (排除模板变量渲染值)
  - Loon/QX 双端; 挂 CI (config-validate.yml step 5c) + npm `check:sync`
- **新增 `provider/` 目录** (.gitkeep) — surgio 生成的硬性前置, 恢复生成链路
- **消除既有漂移 (逐项仲裁取优)**:
  - 产物补: STUN 通话白名单 5 条 (whatsapp/l.google/mozilla/twilio/zoom) + 误杀白名单 17 条 (umengcloud/kepler/suning/amap/pstatp/byteimg) + Kelee 4 插件行 — 模板有产物缺 (功能缺失)
  - 模板补: `hijack-dns *:53 → *:0` (产物新)、httpdns 6 条 0.0.0.0 映射 (产物有模板缺)
  - Gaming 组补 `Fallback` (模板新)
  - 产物删: `DOMAIN-SUFFIX xboxlive.com Gaming` 死规则 (被 KEYWORD DIRECT 遮蔽)
- **隐私安全面 (报告②) 复核**: stun 白名单先于泛拒绝 ✓; firebaseinstallations 保留 (FCM 依赖) ✓; PS/Nintendo/Xbox 不误杀 ✓ — 零改动

### Notes

- 网络性能 (报告①): tolerance=50 / interval=300 / Fallback 双节点容灾已是基准值, 不动作
- npm scripts 新增: `check:sync` / `check:orphan`
- eslint 范围已含 tools/ (上轮); 本轮新增工具均通过

---

## [v8.6] — 2026-08-12

### Changed (网络底层能力审计 — MitM 最小范围)

- **googlevideo 收窄**: MitM hostname 中 `*.googlevideo.com` 正包含 → `-*.googlevideo.com` 全排除 (Loon+QX 模板同步) — 视频流无任何 rewrite/script 规则消费, 解密纯属 CPU 开销; youtubei/www.youtube.com 净化不受影响 (规则层 DIRECT 放行不变)
- **didi-pro v8.2**: 优惠券兜底规则 `^https?:` (全 URL 匹配, 会作用于其它插件域并掩盖孤儿判定) → 收窄为 `^https?:\/\/[^\/]*(didiglobal\.com|didi\.cn)`
- **bilibili-pro v8.2**: 移除 `i0.hdslb.com` (视频 CDN, 无任何规则消费 → 纯解密无收益)
- **新增 MitM 孤儿域校验器** `tools/mitm-orphan-check.mjs` + CI 挂载 (config-validate.yml step 5b):
  - 判定: 方法 A (样本 URL 正则匹配) + 方法 B (注册根域对齐, 支持 com.cn 等二级 TLD)
  - 本地模式严格阻断 (本地插件 + 主配置), 全量模式报告式 (镜像上游整包为上游既有设计)
  - 豁免白名单: Qidian 黑盒 (\d 数字通配无法静态解析) / startup-adblock 通配 (ad.* splash.* flash.*) / iRingo bundle (gspe35-ssl.ls.apple.cn, *.smoot.apple.cn)
  - 负面验证: 注入假孤儿域 → 退出码 1 正确阻断; 注入 `a-zzz.com` (真实广告域后缀) 不再误判
- **eslint 范围扩展**: `tools/**/*.mjs` 纳入 lint (配置 node globals), package.json lint script 加 `tools/`

### Notes

- 全量模式仍报告上游 AllInOne/AdvertisingScript 的 ~160 个"白名单宽、规则窄"孤儿域 — 上游整包插件既有设计, 非本地治理范围, 维护镜像即可
- DNS / GeoIP / ASN / IP 数据库层审计结论: 保持现状 (详见网络审计报告, 无需改动)

---

## [v8.5] — 2026-08-12

### Changed (Rewrite & Script 四层资产专项审计 — 透明化/收敛化)

- **jd-pro v7.9**: 4 条 `http-response` 脚本行 → 内联 `response-body-json-jq '.data = {}'` (与 JD.ts 行为等价, 去掉脚本运行时依赖); 移除**虚设 cron** (脚本无签到/领券/抽奖逻辑, 且 `{JD_CRON_EXP}` 未在 Argument 定义) 与 5 个死参数 (TIMEOUT/SIGNIN/LOTTERY/DEBUG/CRON_EXP)
- **tieba-pro v7.9**: 移除虚设 cron 与 3 个虚设开关 (`TIEBA_HOME/POST/SEARCH_ENABLE` 无任何规则引用, 开关无效); JSON/Proto 净化脚本保留 (递归删除逻辑, jq 不可等价)
- **死代码清理**: 删除 `src/JD.ts`、`src/Amap.ts`、`Scripts/JD.js` (jq 化后无引用); 测试 57 → 55 (移除 JD 用例)
- **传递依赖收敛 (消除 gist/raw 单点)**: `loon-AllInOne.plugin` (22 条) + `loon-AdvertisingScript.plugin` (26 条) 的 `script-path` (startup.js / zheye.min.js) 全部重写指向 `ws.wenn.in/main/Mirror/scripts/`; 2 个脚本纳入每日镜像 (三重门禁 + PR 审核), 补丁固化进 `mirror-scripts.yml` (上游更新后强制重写, 自愈); MANIFEST 92 条目; 残留外部引用仅 2 处 `#!icon` (非功能性)
- **注意**: 已安装的 Loon 端 AllInOne/AdvertisingScript 插件需重装才切换内嵌 script-path

### Notes

- 策略组主体 (`Proxy` url-test + `Fallback` 容灾 + 7 语义组) 经审计无需改动
- 本地规则全量核查: 零重复、零遮蔽、无死规则 (脚本比对)
- Privacy 列表 9 个泛 KEYWORD (`analytics.` 等) 误杀面已由本地规则覆盖主要场景, 维持现状
- **v8.3 回退修复**: `revertConverter.mjs` 的 jq 映射漏输出 action 名, 导致 amap 3 条 `response-body-json-jq` 行缺失动作词 (无效行); 已修复转换器并补齐 3 行, 全量 rewrite 行合法性校验通过

### Changed (分流架构优化: 最低延迟 / 最高命中 / 最低误杀)

- **远端列表顺序重排** (Loon + QX 双端对齐): `China → Global → Advertising → Privacy → Hijacking → Epic` — 国际主流域 (Global 34,579 SUFFIX) 直接命中提前终止, 免于扫描广告/隐私/反劫持三列表 (约 4.2 万条规则); 已核实 Global 与广告/隐私/国内域交集为空, 广告拦截不受影响
- **CI 纯净度检查**: `mirror-scripts.yml` 镜像后校验 Global 列表不含广告/隐私/国内域特征 — 上游若混入污染立即拦截, 保住远端顺序前提 (自愈)
- **移除 `mtalk.google.com` 硬编码 IP** (Loon [Host] / QX [dns]): 国内无 GMS 推送场景, 且 Google IP 池会变, 硬编码迟早失效

### Added

- **README「节点与区域选择」**: 说明地区敏感服务 (流媒体/AI/游戏) 的手动切节点路径 + 可选区域 url-test 组模板 (机场订阅按地区拆分时启用)

### Notes

- 策略组主体 (`Proxy` url-test + `Fallback` 容灾 + 7 语义组) 经审计无需改动
- 本地规则全量核查: 零重复、零遮蔽、无死规则 (脚本比对)
- Privacy 列表 9 个泛 KEYWORD (`analytics.` 等) 误杀面已由本地规则覆盖主要场景, 维持现状
- **v8.3 回退修复**: `revertConverter.mjs` 的 jq 映射漏输出 action 名, 导致 amap 3 条 `response-body-json-jq` 行缺失动作词 (无效行); 已修复转换器并补齐 3 行, 全量 rewrite 行合法性校验通过

---

## [v8.3] — 2026-08-11

### Changed (Rewrite 新语法全量回退, 兼容 Loon 3.5.0)

- **Rewrite 新语法 → 旧语法逆向迁移**: v8.0 迁移的 `request if`/`response if` 新语法行全量回退为旧语法, 适配已上线的 Loon 3.5.0 — 13 个插件共 147 行 (`^url reject-200` / `reject-dict` / `^url 302 $N` / `response-body-json-jq`), `Profile/Loon.lcf` 5 条 HTTPDNS reject 同步回退; 保留 v8.0 的 91 条无效规则修复与 bilibili/weibo/xhs 捕获组修复
- **新增逆向转换工具** `tools/rewrite-migrate/revertConverter.mjs`: 与 `rewriteConverter.mjs` (旧→新) 互逆, `node tools/rewrite-migrate/index.mjs --revert` 一键回退; 待 Loon 3.5.1 (978) 发布后可用默认模式一键恢复
- **51 个插件 `#!loon_version = 3.5.1(978)` → `3.2.4(787)`** (Loon 3.5.0 可解析的最小特性版本头, 覆盖 jq/正则捕获等全部在用特性)
- **`loon.tpl`**: `hijack-dns = *:0` → `*:53` (v8.0 引入的全端口劫持为 3.5.1 特性, 3.5.0 回退为端口 53, 防 DNS 泄漏)
- **测试修复**: 移除 `purify-scripts.test.js` 中对已删除 `Scripts/Amap.js` 的 3 个死用例 (amap 净化已由 `response-body-json-jq` 兜底, 57/57 通过)
- **CI**: `config-validate.yml` HTTPDNS 双端对齐检查的 Loon 侧统计改为旧语法字面匹配 (`\/d reject-200`)

### Notes

- amap 保留 v7.9 起的 jq 兜底方案 (3 条 `response-body-json-jq` 替代原 13 条净化脚本), 未回滚为脚本方案
- Mirror/ 目录为上游镜像, 保持原样; `Kelee/` 4 个自维护插件已是 3.2.4(787) 旧语法, 不受影响

---

## [v8.2] — 2026-08-11

### Fixed (规则审计 2026-08: 最低延迟 / 最高命中 / 最低误杀)

- **STUN 通话误杀根治** (`loon.tpl`)：泛 `DOMAIN-KEYWORD,stun,REJECT` 曾先于社交/流媒体规则命中，阻断 WhatsApp 通话 / Google Meet / 浏览器 WebRTC / Zoom。现于泛拒绝之前加入白名单：`stun.whatsapp.net→Social`、`stun.l.google.com→Streaming`、`stun.services.mozilla.com→Proxy`、`stun.twilio.com→Proxy`、`stun.zoom.us→Proxy`；泛 stun REJECT + DEST-PORT 3478 REJECT 保留为防泄漏兜底
- **远端广告列表误杀白名单** (`loon.tpl` 新增 16 条本地规则，先于远端 REJECT 列表求值)：`msg.umengcloud.com`（友盟推送 MPS 网关，仅此域放行）、`kepler.jd.com`/`keplerapi.jd.com`/`mapi.m.jd.com`/`policy.jd.com`（京东购买页/开普勒 API）、`suning.com`（苏宁，覆盖 m.suning.com）、`apiinit.amap.com`（高德初始化）、`wixsite.com→Proxy`（Wix 建站）、pstatp/byteimg 内容图床 8 域（p3/s1/s2/s3/a3.pstatp.com、a3.bytecdn.cn、p3-pack/p6-pack.byteimg.com）；统计/广告域（ulogs.umeng.com、dm.pstatp.com 等）保持 REJECT
- **`kelee.one` 插件拼写修正**：上游 blackmatrix7 AllInOne 的 `m\.meitun\.com` → `m\.meituan\.com`（Loon/QX 双端，rewrite 行 + MITM hostname 行）；补丁固化进 `mirror-scripts.yml`（每日镜像后强制修正，上游修复后自动 no-op 自愈）

### Changed

- **远端规则重排** (`loon.tpl`)：`loon-China.list` 提前至第一位 — 国内流量直接命中 DIRECT，不再扫描广告/隐私/反劫持三个 REJECT 列表
- **`loon.tpl` 冗余清理**：移除 [Host] 段 6 条 httpdns 静态条目（与 `DOMAIN-KEYWORD,httpdns,REJECT` 重复）
- **`gaming.tpl`**：移除被主配置 `DOMAIN-KEYWORD,xboxlive.com,DIRECT`（主机直连设计）遮蔽的死规则 `DOMAIN-SUFFIX,xboxlive.com,Gaming`
- **`loon.tpl`**：Gaming 组补充 Fallback；Apple News 规则注明需美区节点（url-test 可能选到非美节点）
- **`umetrip-remove-ads.plugin`**：移除 `msg.umengcloud.com` REJECT（设备级拒绝会误伤所有依赖友盟推送的 App，含航旅纵横自身），保留其余 9 个 SDK 跟踪域名

### Notes

- 本地规则(含插件)在 Loon 中先于远端规则求值，白名单得以覆盖远端列表的粗粒度 KEYWORD；远端镜像每日同步，若上游加回更粗的 KEYWORD 需复检本白名单
- `Profile/Loon.lcf` 由 surgio-build CI（真实订阅）自动重新生成

---

## [v8.1] — 2026-08-11

### Added

- **App 清单驱动的缺口插件落实（4 个，iKeLee 转写）**：基于用户装机清单筛选，新增 4 个自托管净化插件至 `Kelee/`，其中 jq/规则类均为旧语法（`response-body-json-jq`/`reject-dict`），`#!loon_version = 3.2.4(787)`，兼容已上线的 Loon 3.5.0；因 3.5.1 (978) 尚未发布，未使用 3.5.1 新语法：
  - **什么值得买去广告** (`Kelee/smzdm-remove-ads.plugin`) — iKeLee 2025-11-27 版转写，27 条 `response.json.jq` + 6 条 `response.body.mock` + 广告域名 REJECT，开屏/信息流/横幅/搜索/文章/红包弹窗全流程净化，无外部脚本依赖
  - **盖得排行去广告** (`Kelee/guiderank-remove-ads.plugin`) — 11 条 jq 移除首页横幅/倒计时/团购/保险推广 + 8 条推广接口 mock，无外部脚本依赖
  - **航旅纵横去广告（轻量版）** (`Kelee/umetrip-remove-ads.plugin`) — 开屏广告域名 REJECT（startup/discardrp.umetrip.com），首页信息流净化因上游脚本在 kelee.one 无法镜像而省略
  - **12306去广告（轻量版）** (`Kelee/12306-remove-ads.plugin`) — ad.12306.cn 域名 REJECT 零 MitM 方案（原版依赖 kelee.one 外部脚本）

### Changed

- **loon.tpl**：新增 4 个插件引用（enabled=true），归入 `# — 🧹 iKeLee 转写新增 (2026-08) —` 分组
- **sync-kelee.yml**：注明 4 个转写插件为自维护，不参与上游同步

### Notes

- 兼容性: 4 个新插件改为旧语法转写并经 `jq` 实跑验证，`#!loon_version = 3.2.4(787)`（可莉原插件同款声明），Loon 3.5.0 可直接加载；仓库其他插件仍为 3.5.1 (978) 新语法，需等待 3.5.1 正式发布
- 测试: `wiring-check` 全绿；`npm test` 57/60 通过（3 失败为 Amap.js 构建产物缺失的环境性问题，与本次改动无关）
- 未引入: 12306/航旅纵横完整版依赖的 kelee.one 外部 JS 无法镜像（Cloudflare 防护），保持纯域名/纯 jq 零外部依赖方案

---

## [v8.0] — 2026-08-10

### Added

- **插件元信息全量补齐**：51 个插件统一添加 `#!system = iOS,iPadOS,macOS` 与 `#!loon_version = 3.5.1(978)`，明确声明 iOS/Mac 双端支持与最低版本要求。
- **Rewrite 新语法迁移**：插件 144 行 + 主配置 5 行 [Rewrite] 从旧语法迁移至 Loon 3.5.1 (978)+ 新语法（`request if ${url} ~= /.../ && ${参数} == true then action`），旧语法官方仅作输入兼容、不再扩展。

### Changed

- **hijack-dns 增强**：`*:53` → `*:0`，劫持所有目标端口的 DNS 查询（文档建议值）。
- **历史无效规则修复**：91 行 `url/list reject-200` 非标准 action（Loon 无此语法，长期未生效）规范化为 `reject-200`；bilibili-pro 2 行 302 替换值参数顺序纠正（app 行 `$5` 后误拼原 `$6`、passport 行 `$4` 重复引用导致跳转 URL 尾部参数重复拼接）、weibo/xiaohongshu 2 行 URL 正则补捕获组（`$4` 悬空导致重定向从未生效）。
- **Amap 脚本净化 → JSON Action（试点）**：13 条 http-response 脚本替换为 3 条 `response.json.jq(".data = {}")`（行为与 Amap.js 逐字节等价），插件 v7.8 → v7.9。

### Fixed

- **上游工具审计（LoonManual / Loon0x00.github.io）**：发现并修复官方 Rewrite 转换器 3 个缺陷 —— ① 不支持插件 `enable={ARG}&{ARG2}` 后缀（转换后参数丢失）；② 正则字面量对连续 `//` 只转义一半；③ iOS Safari 剪贴板 fallback 静默失败（`textarea.select()` 只选中部分文本且不校验 `execCommand` 返回值）。另补 `-webkit-mask-image` / `-webkit-backdrop-filter` 前缀兼容旧 iOS。

---

## [v7.8.1] — 2026-07-23

### Added

- **Kelee 功能增强插件引入（7 个）**：从 [hub.kelee.one](https://hub.kelee.one/) 引入 7 个 Loon 专属 `.lpx` 功能增强插件，远程引用 `https://kelee.one/Tool/Loon/Lpx/*.lpx`：
  - **Google搜索重定向** (`Google.lpx`) — 将 Google 搜索重定向至 .com 域名，避免区域跳转
  - **Spotify歌词翻译** (`Spotify_lyrics_translation.lpx`) — 外语歌词翻译为简体中文，双语翻译
  - **微信外部链接解锁** (`Weixin_external_links_unlock.lpx`) — 解锁微信外部链接访问限制，跳过中间界面
  - **京东比价** (`JD_Price.lpx`) — 商品详情页面查看比价（需安装慢慢买 App 捕获 Cookie）
  - **VVebo时间线修复** (`VVebo_repair.lpx`) — 修复失效的用户时间线（与微博去广告冲突，**默认禁用**）
  - **节点检测工具** (`Node_detection_tool.lpx`) — 地理位置/节点解锁/入口落地查询
  - **代理链路检测** (`NodeLinkCheck.lpx`) — 查看目标节点的代理走向
  - QX 端不支持 `.lpx` 格式，这些功能增强仅限 Loon 用户使用
- **小说/文学站路由补全（9 条）**：新增 69书吧（69shuba.com / 69shu.com / 69shu.cx）、sytc.cc、xbiquge.la、biquge.com、pianbai.com、23wx.com、wdhl.com 路由规则，走 Social 策略组——这些小说站在中国大陆需代理访问，原配置缺失会导致走 FINAL(direct) 无法打开。双端同步（social.tpl + social.qx + Loon.lcf + QX.conf）。

### Changed

- **README 更新**：社交平台分流覆盖补充中文社区和小说/文学站说明；新增 v7.8.1 Kelee 功能增强插件章节（含插件表格、注意事项）；新增 v7.8.1 概述段落。

---

## [v7.8] — 2026-07-22

### Added

- **流媒体路由补全**：新增 Netflix CDN（nflximg.net / nflximg.com / nflxext.com / netflixcdn.net / nrdns.netflix.com）、Spotify CDN（spotify.map.fastly.net）、TikTok CDN（tiktokcdn.com / tiktokv.com / muscdn.com）、HBO Max CDN（hbo.com / hbomaxcdn.com）、Disney+ CDN（disney.api.edge.bamgrid.com，DOMAIN 精确匹配）、Crunchyroll（crunchyroll.com / v.vrv.co）、Hulu、Paramount+、Peacock、NOW TV、Bilibili 国际版（bilibili.tv）、Apple TV+（tv.apple.com，DOMAIN 精确匹配）、Pandora、SoundCloud、Tidal、Deezer 的路由规则。
- **社交平台路由补全**：新增 WhatsApp、Signal、Line、Threads、Mastodon、VK、Tumblr、Bluesky 路由规则；补充 Reddit CDN（redditmedia.com / redd.it / reddesignimg.com）；Discord CDN 域名在主配置 Rule 中已有声明，snippet 中添加注释说明。**中文社区补全**：新增 V2EX、Linux.do、NodeSeek、HostLoc、1024、Matters、LIHKG、Dcard 路由规则——这些中文内容社区在中国大陆需代理访问，原配置缺失会导致走 FINAL(direct) 无法打开。
- **AI 服务路由补全**：将 `ai.plugin` 全部域名同步到 snippet。新增 OpenAI CDN（openaiapi-site.azureedge.net / openaicom-api…azurefd.net，auth0.openai.com 用 DOMAIN 精确匹配）、Google AI 补全（bard.google.com / makersuite.google.com / generativelanguage.googleapis.com / alkalimakersuite-pa.googleapis.com / deepmind.com）、AI 音视频（elevenlabs.com）、新兴 AI（mistral.ai / cohere.com / replicate.com / together.ai / fireworks.ai）、AI 编程工具补全（cursor.com / cursor-api.com / github.copilot.com 用 DOMAIN / copilot-proxy.githubusercontent.com / codeiumserver.com / windsurf.ai / supermaven.com）。
- **开发者平台路由补全**：新增 Google 开发者（developers.google.com / cloud.google.com / firebase.google.com 用 DOMAIN / firebaseio.com / firebase.googleapis.com）、Microsoft 开发者补全（visualstudio.com / azure.com / azure-devices.com / nuget.org / msdn.com）、包管理器（npmjs.com / npmjs.org / pypi.org / pythonhosted.org / crates.io / rubygems.org / packagist.org）、代码托管/CI（gitlab.com / bitbucket.org / circleci.com / travis-ci.org）、开发工具（atlassian.com / confluence.com / jira.com / hashicorp.com）、文档/知识库（dev.to / hashnode.com / digitalocean.com / herokuapp.com / vercel.com / netlify.com / netlify.app / cloudflare.com / workers.dev）、Stack Exchange 补充（stackexchange.com / serverfault.com / superuser.com）、Linux/开源（kernel.org / gnu.org / opensuse.org / fedoraproject.org / archlinux.org / debian.org / ubuntu.com）。
- **Google 全家桶代理域名**：新增 googleusercontent.com / ggpht.com / withgoogle.com 走 Proxy，g.co 用 DOMAIN 精确匹配走 Proxy。
- **Google 广告与分析 SDK REJECT 规则（20 条）**：googleadservices.com / doubleclick.net / googlesyndication.com / google-analytics.com / googletagmanager.com / googletagservices.com / adservice.google.com / firebaseinstallations.googleapis.com / app-measurement.com / analytics.google.com / crashlytics.googleapis.com / segment.io / amplitude.com / mixpanel.com / branch.io / adjust.com / appsflyer.com / kochava.com / sentry.io，双端同步。
- **QX MitM hostname 补充 9 个域名**：amdc.m.taobao.com、m5.amap.com、m5-zb.amap.com、m-cloud.zhihu.com、tiebac.baidu.com、tieba.baidu.com、tiebaapi.baidu.com、gql.reddit.com、gql-fed.reddit.com，修复 QX 端高德/贴吧/Reddit/知乎插件 MitM 解密不生效问题。
- **QX HTTPDNS Rewrite 补充 2 条**：1.12.12.12/d、120.53.53.53/d，与 Loon 端对齐（共 5 条）。
- **QX DNS 泄露检测域名补充 16 条**：expressvpn.com / nordvpn.com / surfshark.com / perfect-privacy.com / browserleaks.org / vpnunlimited.com / whrq.net / astrill.com / astrill.org / dnsleak.asn247.net / surfsharkdns.com / pixelscan.net / ipapi.co / ipv4.ping0.cc / ipv6.ping0.cc / ip-scan.adspower.net，与 Prevent_DNS_Leaks.plugin 对齐（共 21 条）。
- **CI 防护新增 3 项检查**：Step 5 MitM hostname 双端 diff 检查（warning）、Step 6 HTTPDNS Rewrite 对齐检查（warning）、Step 7 Snippet 双端对齐检查（fail）。CI 检查项从 5 项扩展到 8 项。
- **策略组拆分**：新增 Streaming / AI / Developer / Social 四个独立 select 策略组（Loon + QX 双端），snippet 中流媒体/AI/社交/开发者域名从硬编码 `Proxy` 改为各自策略组名。单节点场景下核心价值是：当某节点被 ChatGPT 封锁时可手动切换 AI 组而不影响流媒体。`ai.plugin` 的 `AI_Policy` 默认值从 `"Proxy"` 改为 `"AI"`。
- **定时通知脚本**：新增 `Scripts/health-notify.js`（每6小时通过 Cloudflare generate_204 检测节点连通性，失败时推送 Bark/Telegram 通知）和 `Scripts/traffic-notify.js`（每晚22点推送 Loon 运行状态/流量摘要心跳通知），配套 `Plugin/notify.plugin` 包含两个 cron 任务。
- **Sub-Store / QuickSearch 本地化**：从停更 2 年的 `ajune0527/vpn_tool` 仓库迁移到自维护的 `Plugin/sub-store.plugin` 和 `Plugin/quicksearch.plugin`，引用 URL 从 `raw.githubusercontent.com/ajune0527/...` 切换到 `ws.wenn.in/main/Plugin/...`，完全消除对 ajune0527 仓库的依赖。
- **NSRingo bundle.js 镜像**：发现 6 个 NSRingo 插件依赖 8 个版本固定的 `.bundle.js` 文件（如 `releases/download/v3.1.0/response.bundle.js`）。在 `mirror-scripts.yml` 中添加每日 mirror 逻辑到 `Mirror/nsringo/` 目录，在 `upstream-health.yml` 中添加 8 个 bundle.js URL 的健康检查。消除 NSRingo 清理旧 release 导致 404 的风险。
- **real-ip 补充 Apple 推送域名**：Loon `real-ip` 和 QX `dns_exclusion_list` 双端新增 `*.push.apple.com`、`*.apns.apple.com`、`captive.apple.com`，确保 Apple 推送服务和网络检测不被 Fake-IP 干扰。

### Fixed

- **README 脚本引用修复**：移除正文中不存在的 `Scripts/UnionPay.js` 引用，改为"云闪付净化通过 DNS 级 REJECT 实现，无独立脚本"。
- **README 目录树修复**：移除虚假的 `weibo.plugin`（实际不存在）；插件数从 "22个" 修正为 "21个"；移除重复列出的 `zhihu.plugin`；Loon 端描述移除 `weibo`；补充 `doc/`、`CHANGELOG.md`、`package.json`、`surgio.conf.js` 等缺失目录。
- **googleapis.com 路由冲突修复 (P1-1)**：streaming snippet 中的 Google 通配域名（gstatic.com / googleapis.com / google.com / google.co.jp）在 QX 顺序匹配中截胡了 developer snippet 的 `host, firebase.googleapis.com, Developer`。将 Google 通配域名移至 developer snippet include 之后，六端同步（streaming.qx/.tpl + quantumultx.tpl + QX.conf + loon.tpl + Loon.lcf）。
- **插件 MitM hostname %APPEND% 改造**：5 个插件（life / qidian / quicksearch / sub-store / zhihuifangdong）的 `hostname =` 改为 `hostname = %APPEND%`，避免覆盖主配置全局 hostname 列表导致银行域名负向排除失效。
- **JS 脚本 $response 守卫**：7 个 JS 脚本（Zhihuifangdong / Amap / JD / Cainiao / Zhihu / Reddit / Tieba）添加 `if (typeof $response === "undefined") { $done(); return; }` 守卫，防止 AllInOne 重写规则以非 response 模式触发时脚本崩溃。
- **QX 端 QQ 音乐 REJECT 补全**：补充 14 条 QQ 音乐 DNS REJECT 规则（adstats/ad/adcdn/adcdn6/adexpo/adclick.tencentmusic.com + otheve.beacon/mazu.m.qq/monitor.music.qq/stat.y/tmead.y.qq + oth.str.mdt/h.trace/sdk.e/p.l/us.l.qq + imtmp.net + qreport）。
- **QX 端 GDT DIRECT 补全**：补充 6 条 GDT 广告 SDK DIRECT 规则（mi.gdt/ii.gdt/c.gdt/adsmind.gdtimg/adsmind.ugdtimg/pgdt.gtimg）。
- **QX task_local 同步**：同步 Loon 端 3 个 cron 任务到 QX task_local（起点签到 / health-notify / traffic-notify）。
- **QX apple conf script-path 迁移**：5 个 QX apple conf 文件（Maps / News / Siri / TestFlight / WeatherKit）的 24 个 `script-path` 从 `github.com/NSRingo/.../releases/download/vX.Y.Z/*.bundle.js` 迁移到 `ws.wenn.in/main/Mirror/nsringo/*.bundle.js` 自建 CDN。
- **Loon × QX 语法兼容性审计**：全量交叉审计两端语法差异（规则关键字大小写、reject 变体支持、rewrite 语法格式、MitM 机制、Plugin 支持、Cron 机制、DNS 分流机制）。确认两端语法各自正确，无功能失效。
- **Loon 端 GDT 白名单补全**：补充 `adsmind.gdtimg.com`、`adsmind.ugdtimg.com`、`pgdt.gtimg.cn` 3 条 DIRECT 规则，与 QX 端 6 条对齐（原仅 3 条）。
- **QX 端 QuickSearch 补全**：QX 端补充 8 条 DuckDuckGo 302 重定向规则（Safari 快捷搜索），MitM hostname 添加 `duckduckgo.com`，与 Loon 端 `quicksearch.plugin` 功能对齐。
- **QX rewrite_local 风格统一**：2 条 Zhihu 规则从 `http-response ^pattern url script-response-body` 改为 `^pattern url script-response-body`（无阶段前缀），与段内其余 40 条规则风格一致。
- **snippet 注释修正**：`.qx` 文件标注 `QX 格式`，`.tpl` 文件标注 `Loon 格式`，移除误导性的"QX 通过 quantumultx filter 转换"措辞。

### Changed

- **版本号全面升级**：Loon.lcf / QX.conf → v7.8、全部 20 个 plugin `#!version=` → 7.8、`package.json` → 7.8.0、ai-services snippet 注释 → v7.8。

---

## [v7.7] — 2026-07-22

### Added

- **mirror-scripts.yml 工作流正式建立**：创建 `Mirror/` 目录，每日从 4 个上游源（ddgksf2013/app2smile/Maasea 等）mirror 7 个外部脚本（netease.adblock.js、amdc.js、applet.js、bilibili-json.js、bilibili-proto.js、youtube.request.js、youtube.response.js）到 `Mirror/`，通过 GitHub raw 提供自建 CDN，消除 gist/raw.githubusercontent 单点依赖。
- **上游健康检查扩展**：`upstream-health.yml` 从 4 个检查点扩展到 12 个，新增 ws.wenn.in CDN、ddgksf2013 gist、ddgksf2013/Scripts、5 个 NSRingo 仓库、ajune0527。
- **config-validate.yml CI 创建**：新增配置验证 CI，包含 5 项检查（Plugin 元信息完整性、script-path URL 可达性、Loon vs QX 双端交叉核对、银行域名 MitM 冲突检测、版本号一致性）。
- **QX.conf 补充微信 DIRECT 规则**：wechat.com / weixin.qq.com / wx.qq.com / qpic.cn。
- **QX.conf 补充 5 条缺失 Proxy 路由**：twittercdn / tdesktop / steamcdn-a.akamaihd.net / onedrive.live / wikimediafoundation.org。
- **银行域名负向排除交叉引用注释**：双端配置添加银行域名 MitM 排除的交叉引用注释。
- **新兴 AI 服务域名补充**：DeepSeek / xAI / Midjourney / Suno / ElevenLabs / Runway / Luma。

### Changed

- **全量 script-path 切换到自建 CDN**：18 个 plugin + QX.conf + YouTube plugin 的引用全部切换到 `ws.wenn.in/main/Mirror/`。Netease 插件 22 处 gist 依赖一次性消除。
- **版本号全面统一**：Loon.lcf → v7.7（原 v7.6）、QX.conf → v7.7（原 v17.0 typo）、全部 20 个 plugin → v7.7（原 v7.4/v7.6 混用）。
- **退化存根诚实标注**：`qishui.plugin` 和 `wechat.plugin` 的描述准确反映上游脚本已删除、改用纯 reject 规则的实际状态。

### Fixed

- **JS 脚本 Runtime Bug 修复**：6 个脚本（Amap / JD / Tieba / Reddit / Zhihu / Cainiao）的 catch 块 `$.done()` → `$done()`，消除 JSON 解析失败时的 ReferenceError。
- **PushPlus 安全修复**：`Qidian.js` 的推送端点 `http://` → `https://`。
- **死规则清理**：移除 QX.conf 中重复的 `tangram.e.qq.com`（line 431）；移除 Loon.lcf 中被 `DOMAIN-KEYWORD httpdns` 通杀覆盖的 2 条显式 httpdns 规则。

---

## [v7.5] — 2026-07-22

### Added

- **外部脚本 CDN Mirror**：新建 `mirror-scripts.yml` 工作流，每日从 ddgksf2013/app2smile/Maasea 等 4 个上游源 mirror 外部脚本到 `Mirror/` 目录，通过 GitHub raw 提供自建 CDN，消除上游删库/离线单点故障风险。

### Changed

- **全量 plugin 引用迁移**：7 个 plugin + QX.conf + YouTube plugin 的 `script-path` 全部从上游原始 URL 切换到自建 mirror URL。
- **19 个 plugin 统一添加 `#!version=7.4` 元信息**，便于版本追踪。

### Fixed

- **对抗审计加固**：全部 9 个 JS 脚本添加 `$response` 守卫（防 AllInOne MitM 误触）；双端 MitM 移除 `*.google.com` 防止 Gmail/Drive 被意外解密；冗余 MitM 域名清理；curl GitHub Actions 超时加固。

---

## [v7.0]

### Added

- **自维护 19 个 Loon 插件**：新建 `Plugin/` 目录，包含 19 个 App 覆盖插件（bilibili、bilicomics、weibo、wechat、netease、goofish、qishui、taopiaopiao、amap、jd、qqmusic、reddit、tieba、zhihu、qidian、bank、life、ai、zhihuifangdong），引用 ddgksf2013/app2smile 活跃上游脚本，替代停更的 ajune0527 体系。
- **QX 端独立 conf 覆盖**：WeiboAds、WeChat、NeteaseAds、AmapAds、TieBaAds、GoofishAds、SmzdmAds、BiliBiliComicsAds、QiShuiMusicAds、RedditAds、CainiaoAds、TaoPiaoPiaoAds、CaiYunAds、Applet 等独立 conf，每日更新。
- **通用去广告层**：引入 `blackmatrix7/AllInOne.plugin`（Loon + QX 双端统一），740+ MitM hostname + 698 reject 规则 + 21 response 脚本，每日更新。已修复 safebrowsing/jiguang/umeng 误杀风险。
- **广告脚本增强层**：引入 `blackmatrix7/AdvertisingScript.plugin`（Loon），含哲也知乎深度净化 + B站/京东/爱奇艺/美团开屏脚本。
- **开屏广告通杀层**：引入 `ddgksf2013/FakeiOSAds`（QX）拦截 iOS 系统/第三方 SDK 开屏广告。
- **追踪/埋点拦截层**：主配置内置 20+ 条腾讯/字节/阿里系追踪域名 REJECT。
- **HTTPDNS 多维拦截**：`DOMAIN-KEYWORD httpdns REJECT` + `[Host]` 静态映射 + `[Rewrite]` 三层防御。
- **Kelee 插件镜像复用保留**：仅保留 `Prevent_DNS_Leaks.plugin`（DNS 泄露防护）和自维护的 `YouTube_remove_ads.plugin`。

### Changed

- **ajune0527/vpn_tool 插件体系淘汰**：停更 2 年（最后一次更新 2024-07）的 22 个插件文件移至 `archive/ajune0527-legacy/`，全部替换为自维护的 19 个 `Plugin/*.plugin`。
- **GeoIP/ASN 数据库迁移**：改用 `Loyalsoldier/geoip`（Country.mmdb）+ `P3TERX/GeoLite.mmdb`（ASN），不再依赖 kelee.one。
- **`Remove_ads_by_keli.plugin` / `myblockads.plugin` 停用**：由 `blackmatrix7/AllInOne.plugin`（740+ hostname 每日更新）全面取代，更全面且无 safebrowsing 误杀风险。
- **同步工作流**：`sync-kelee.yml` 每日同步 Kelee 核心插件，`mirror-scripts.yml` 每日 mirror 外部脚本到 `Mirror/` 目录，`upstream-health.yml` 每日检查所有上游源可用性。

### Removed

- **ajune0527/vpn_tool 全部 22 个插件文件**：移至 `archive/ajune0527-legacy/` 存档。
- **`Remove_ads_by_keli.plugin`**：由 blackmatrix7/AllInOne.plugin 取代。
- **`myblockads.plugin`**：由 blackmatrix7/AllInOne.plugin 取代。
- **kelee.one GeoIP/ASN 依赖**：改用 Loyalsoldier/geoip + P3TERX/GeoLite.mmdb。
