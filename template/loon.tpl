# ═══════════════════════════════════════════════════════════
#  Loon 配置 (Loon.lcf) — Surgio 生成 (滚动 main)
#  核心: 自动健康检测 · 高质量多引擎去广告 · Apple原生增强 · 全球社交/流媒体分流 · 银行 MitM 冲突根治
#  引擎支持: iOS Loon 3.3.9+ (规则语义已按官方文档 3.5.1(978) 核对: interface-mode 取值等)
# ═══════════════════════════════════════════════════════════

[General]
# 2026-09-20 审计整改 (官方 docs/General 实抓):
# ① ip-mode = dual (官方枚举 ipv4-only/dual/ipv4-preferred/ipv6-preferred;
#    旧值 "fake-ip" 非官方取值 — Fake IP 体系由 real-ip 控制排除, 与 IP 协议族选择正交)
# ② fake-ip-filter / disconnect-on-policy-change 删除: 两键名在官方文档全站
#    (General/DNS/hostmap/Scheme)、example.conf、主流社区配置中均不存在, 系
#    Clash(fake-ip-filter)/Surge(disconnect-on-policy-change) 键混入; Loon 对应
#    机制是 real-ip (已含 captive.apple.com/msftconnecttest 同族条目) 与 UI 开关
# ③ hijack-dns 收窄: 旧 "*:0" 全劫持 + 6 个公开 DNS, 与 "上游全走加密 DoH/DoH3"
#    矛盾 — 被劫持的系统查询经 Loon 转发后回落**明文 UDP DNS** (官方 DNS 页: 加密
#    优先但回落为普通 DNS), 全劫持反而把本可本地解析的查询都送进代理解析链。
#    收窄为仅劫持 4 个明确公开 DNS (Google/Cloudflare/114), 223.5.5.5/119.29.29.29
#    因是 dns-server 成员 (加密失败回落明文自用) 不再自劫持
# ④ 旧 fake-ip-filter 的功能面已映射到 real-ip: captive.apple.com/msftconnecttest/
#    msftncsi 原已在 real-ip; *.lan/*.local 族由 bypass-tun+skip-proxy 覆盖 (不进
#    Loon DNS, 无需 real-ip); 唯一遗漏项 time.*.com (NTP 系统服务, Fake IP 会破坏
#    对时) 本轮补入 real-ip 尾部
ip-mode = dual
interface-mode = Performace
dns-server = 180.184.11.11, 180.184.22.22, 119.29.29.29, 223.5.5.5
doh-server = {{ customParams.doh_primary }}, {{ customParams.doh_fallback }}
doh3-server = {{ customParams.doh3_primary }}, {{ customParams.doh3_fallback }}
doq-server = {{ customParams.doq_server }}
hijack-dns = 8.8.8.8, 8.8.4.4, 1.1.1.1, 114.114.114.114
sni-sniffing = true
disable-stun = false
udp-fallback-mode = DIRECT
ipv6-vif = off
domain-reject-mode = DNS
dns-reject-mode = LOOPBACKIP
geoip-url = https://raw.githubusercontent.com/Loyalsoldier/geoip/release/Country.mmdb
# 2026-09-29 对抗审计: 原 GeoLite2-ASN.mmdb 拉取已删, 改为不引用 ipasn-url。
#   依据: 全仓 IP-ASN 规则的唯一消费者是 didi-pro 的 3 条上报拦截, 而那 3 条是**死规则** ——
#   本地 [Rule] 的 GEOIP,CN,DIRECT (第 485 条) 优先级高于插件 [Rule], 境内 IP 的 TCP 连接
#   必然先命中 GEOIP, 插件 IP-ASN 永不可能求值。保留即每次白拉 12MB。
#   若将来确有 IP-ASN 规则, 须满足两条前提并有测试断言:
#     ① 该规则位于**本地** [Rule] 且排在 GEOIP 之前 (插件位置无法超越本地 GEOIP);
#     ② test/cases/dns-geoip.test.js 的「ipasn-url 有活跃消费者」断言放行。
#   geoip-url (Country.mmdb, 7.7MB) 保留 —— GEOIP,CN,DIRECT 依赖它。
# resource-parser: 已移除 (2026-09-11 供应链审计)
#   原值指向 Sub-Store 的 1.27MB 解析器 bundle (上游 releases/latest 浮动)。
#   移除理由: 该 bundle 在订阅解析上下文中执行, 可见全部节点凭据; 哈希门禁只能证明
#   "与上游发布一致", 无法证明上游可信 — 与移除 Sub-Store 插件同一信任前提, 故一并移除。
#   影响: Loon 回退内置解析器 (原生 ss/ssr/vm 等链接格式与 Clash 配置均可解析)。
#   如需恢复 Clash YAML 等扩展格式: 自行指定 resource-parser, 并锁定具体版本而非 latest。
allow-wifi-access = false
wifi-access-http-port = 7222
wifi-access-socks5-port = 6225
test-timeout = 5
# 探活一主一备 (2026-09-19 官方文档对齐): internet-test-url (直连可用性) 与 proxy-test-url
# (代理链路可用性) 用**不同**上游 —— 同端点时该端点故障会同时误判"本机断网 + 代理失效",
# 排障时无法区分; 分端点后任一故障只影响一条链路。策略组未显式 url= 时继承 proxy-test-url。
internet-test-url = http://cp.cloudflare.com/generate_204
proxy-test-url = http://connectivitycheck.gstatic.com/generate_204
skip-proxy = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 255.255.255.255/32, localhost, *.local, *.lan, *.home.arpa
bypass-tun = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 255.255.255.255/32
real-ip = *.cmpassport.com, *.jegotrip.com.cn, *.icitymobile.mobi, id6.me, *.boc.cn, *.abchina.com, *.ccb.com, *.psbc.com, *.cmbchina.com, *.icbc.com.cn, *.bankofchina.com, *.spdb.com.cn, *.cib.com.cn, *.cebbank.com, *.unionpay.com, *.pingan.com.cn, *.pingan.com, *.bankcomm.com, *.citicbank.com, *.hxb.com.cn, *.cgbchina.com.cn, *.push.apple.com, *.apns.apple.com, captive.apple.com, *.local, *.lan, *.home.arpa, *.srv.nintendo.net, *.stun.playstation.net, xbox.*.microsoft.com, *.xboxlive.com, stun.*, *.msftconnecttest.com, *.msftncsi.com, *.battlenet.com.cn, time.*.com

[Host]
*.taobao.com = server:223.5.5.5
*.tmall.com = server:223.5.5.5
*.alipay.com = server:223.5.5.5
*.alicdn.com = server:223.5.5.5
*.qq.com = server:119.29.29.29
*.tencent.com = server:119.29.29.29
*.weixin.qq.com = server:119.29.29.29
*.jd.com = server:119.29.29.29
*.baidu.com = server:223.5.5.5
*.bilibili.com = server:223.5.5.5
*.meituan.com = server:223.5.5.5
*.douyin.com = server:119.29.29.29
*.163.com = server:119.29.29.29
*.mi.com = server:223.5.5.5
*.apple.com = server:223.5.5.5
*.icloud.com = server:223.5.5.5
*.icloud.com.cn = server:223.5.5.5
httpdns.c.cdnhwc.com = 0.0.0.0
httpdns.gslb.netease.com = 0.0.0.0
httpdns.alikunlun.com = 0.0.0.0
httpdns.baidubce.com = 0.0.0.0
httpdns.volcengineapi.com = 0.0.0.0
httpdns.c.cdnhwc2.com = 0.0.0.0

[Proxy]
# 节点由 Loon 外部订阅提供；订阅策略组名固定为“东京”，不写入公开仓库。

[Proxy Group]
# Proxy 直接聚合 Loon 外部订阅策略组“东京”；订阅更新后自动纳入 url-test。
Proxy = url-test, 东京, url=http://cp.cloudflare.com/generate_204, interval=120, tolerance=100
# Fallback 与 Proxy 同节点集(东京)、不同决策语义: url-test 追最低延迟(可能频繁切换),
#   fallback 取列表中**第一个**可用节点(健康则黏住不抖)。两者并列才是 AGENTS 说的"双节点容灾"。
#   成员必须写东京而非 Proxy: url-test 组嵌进 fallback 会多一层测速间接, 且代理了 fallback 的黏性语义。
#   超时参数按 Loon 文档为 max-timeout(毫秒), 旧写的 timeout=5 是非文档参数, 若被按毫秒解析则 5ms 会判全组不可用。
Fallback = fallback, 东京, url=http://cp.cloudflare.com/generate_204, interval=180, max-timeout=5000
Apple = select, DIRECT, Proxy
Final = select, Proxy, Fallback, DIRECT
Streaming = url-test, Proxy, Fallback, DIRECT, url=http://cp.cloudflare.com/generate_204, interval=120, tolerance=100, tag=流媒体
AI = url-test, Proxy, Fallback, DIRECT, url=http://cp.cloudflare.com/generate_204, interval=120, tolerance=100, tag=AI服务
Developer = select, Proxy, Fallback, DIRECT, tag=开发者
Gaming = select, Proxy, Fallback, DIRECT, tag=游戏平台
Social = select, Proxy, Fallback, DIRECT, tag=社交平台
OpenCode = select, Proxy, DIRECT, tag=OpenCode.ai

[Rule]
DEST-PORT, 5223, DIRECT

{% include "./snippet/bank-ad-reject.tpl" %}

DOMAIN-SUFFIX, unionpay.com, DIRECT
DOMAIN-SUFFIX, cmbchina.com, DIRECT
DOMAIN-SUFFIX, icbc.com.cn, DIRECT
DOMAIN-SUFFIX, ccb.com, DIRECT
DOMAIN-SUFFIX, boc.cn, DIRECT
DOMAIN-SUFFIX, bankofchina.com, DIRECT
DOMAIN-SUFFIX, abchina.com, DIRECT
DOMAIN-SUFFIX, psbc.com, DIRECT
DOMAIN-SUFFIX, spdb.com.cn, DIRECT
DOMAIN-SUFFIX, cib.com.cn, DIRECT
DOMAIN-SUFFIX, cebbank.com, DIRECT
DOMAIN-SUFFIX, pingan.com.cn, DIRECT
DOMAIN-SUFFIX, pingan.com, DIRECT
DOMAIN-SUFFIX, bankcomm.com, DIRECT
DOMAIN-SUFFIX, 95559.com.cn, DIRECT
DOMAIN-SUFFIX, citicbank.com, DIRECT
DOMAIN-SUFFIX, hxb.com.cn, DIRECT
DOMAIN-SUFFIX, cgbchina.com.cn, DIRECT

# Discord STUN
DOMAIN-SUFFIX, discord.media, Proxy
DOMAIN-SUFFIX, discordapp.com, Proxy
DOMAIN-SUFFIX, discordapp.net, Proxy

# STUN 通话白名单 (须在泛 stun 拒绝之前 — 2026-08 审计修复)
# 泛 stun REJECT 会先于 social/streaming 命中, 阻断 WhatsApp 通话/Google Meet/浏览器 WebRTC/Zoom
DOMAIN-SUFFIX, stun.whatsapp.net, Social
DOMAIN, stun.l.google.com, Streaming
DOMAIN, stun.services.mozilla.com, Proxy
DOMAIN-SUFFIX, stun.twilio.com, Proxy
DOMAIN, stun.zoom.us, Proxy

# STUN 阻断 (最后兜底: 仅拦截未白名单的 STUN 泄漏)
DOMAIN-KEYWORD, stun.playstation, DIRECT
DOMAIN-KEYWORD, stun.nintendo, DIRECT
DOMAIN-KEYWORD, xboxlive.com, DIRECT
DOMAIN-KEYWORD, stun, REJECT
DEST-PORT, 3478, REJECT
# 放弃项 (2026-09-21 评估, 无真机实测不加): DEST-PORT 19302 (Google) / 5349-3479
# (TURN) — UDP 裸 IP 本就绕过域名规则, 非标端口确有泄漏面; 但端口块影响一切 host
# (第三方 WebRTC 用非标 STUN 即断流), 白名单是域名级保不住它们, 须真机确认后加。

# 局域网
IP-CIDR, 192.168.0.0/16, DIRECT, no-resolve
IP-CIDR, 10.0.0.0/8, DIRECT, no-resolve
IP-CIDR, 172.16.0.0/12, DIRECT, no-resolve
IP-CIDR, 127.0.0.0/8, DIRECT, no-resolve

# HTTPDNS 拦截
DOMAIN-KEYWORD, httpdns, REJECT

# DNS/隐私泄漏检测 (需走代理远端解析)
DOMAIN-SUFFIX, dnsleaktest.com, Proxy
DOMAIN-SUFFIX, dnsleak.com, Proxy
DOMAIN-SUFFIX, expressvpn.com, Proxy
DOMAIN-SUFFIX, nordvpn.com, Proxy
DOMAIN-SUFFIX, surfshark.com, Proxy
DOMAIN-SUFFIX, ipleak.net, Proxy
DOMAIN-SUFFIX, perfect-privacy.com, Proxy
DOMAIN-SUFFIX, browserleaks.com, Proxy
DOMAIN-SUFFIX, browserleaks.org, Proxy
DOMAIN-SUFFIX, vpnunlimited.com, Proxy
DOMAIN-SUFFIX, whoer.net, Proxy
DOMAIN-SUFFIX, whrq.net, Proxy
DOMAIN-SUFFIX, astrill.com, Proxy
DOMAIN-SUFFIX, astrill.org, Proxy
DOMAIN-SUFFIX, dnsleak.asn247.net, Proxy
DOMAIN-SUFFIX, surfsharkdns.com, Proxy
DOMAIN-SUFFIX, pixelscan.net, Proxy
DOMAIN-SUFFIX, ipapi.co, Proxy
DOMAIN, ipv4.ping0.cc, Proxy
DOMAIN, ipv6.ping0.cc, Proxy
DOMAIN, ip-scan.adspower.net, Proxy

# Apple
# 注: Apple News 解锁需要美区节点 — news-edge 走 Proxy url-test, 若自动选到非美节点可手动切 Proxy 组节点
#
# 顺序纪律: 下面两条 apple.com 显式例外**必须**排在 DOMAIN-SUFFIX,apple.com 之前。
#   域名类规则按配置顺序首次命中即停, 后缀规则会罩住所有子域; 例外若写在其后永远不生效。
#   (由 test/cases/rule-shadow.test.js 守住)
DOMAIN, news-edge.apple.com, Proxy
DOMAIN, tv.apple.com, Streaming
DOMAIN-SUFFIX, apple.com, Apple
DOMAIN-SUFFIX, icloud.com, Apple
DOMAIN-SUFFIX, icloud.com.cn, Apple

# 微信
DOMAIN-SUFFIX, wechat.com, DIRECT
DOMAIN-SUFFIX, qpic.cn, DIRECT
DOMAIN-SUFFIX, weixin.qq.com, DIRECT
DOMAIN-SUFFIX, wx.qq.com, DIRECT

# OpenCode.ai
DOMAIN-SUFFIX, opencode.ai, OpenCode

{% include "./snippet/ai-services.tpl" %}
{% include "./snippet/streaming.tpl" %}
{% include "./snippet/social.tpl" %}
{% include "./snippet/developer.tpl" %}
{% include "./snippet/gaming.tpl" %}

# Google 全家桶
DOMAIN-SUFFIX, googleusercontent.com, Proxy
DOMAIN-SUFFIX, ggpht.com, Proxy
DOMAIN-SUFFIX, withgoogle.com, Proxy
DOMAIN, g.co, Proxy

# 穿山甲统计/请求/聚合接口 (2026-08-12 HAR 审计第二轮)
# 起点秒播脚本 (Scripts/Qidian.js) 仅依赖 gdtimg.com/gtimg.cn 视频域, 不依赖穿山甲,
# 故 api-access/log-api/gromore 三个接口域可安全拦截 (必须先于下方 SUFFIX DIRECT)
DOMAIN, REJECT
DOMAIN, api-access.pangolin-sdk-toutiao.com, REJECT
DOMAIN, api-access.pangolin-sdk-toutiao1.com, REJECT
DOMAIN, log-api.pangolin-sdk-toutiao.com, REJECT
DOMAIN, gromore.pangolin-sdk-toutiao.com, REJECT

# ⚠️ 广点通/穿山甲全链拦截 (2026-08-12 用户决策): 原白名单是起点秒播脚本
# (Scripts/Qidian.js 视频替换) 的依赖, 但 adsmind.ugdtimg.com 素材同时是智慧房东
# 开屏广告直投链路 (310_HAR: GDTMobSDK 206 穿透)。用户要求开屏广告彻底消失,
# 接受起点秒播失效 — 请求/渲染/素材全链 REJECT, 秒播 [Script] 匹配不到即停用
DOMAIN, mi.gdt.qq.com, REJECT
DOMAIN, ii.gdt.qq.com, REJECT
DOMAIN, c.gdt.qq.com, REJECT
DOMAIN, adsmind.gdtimg.com, REJECT
DOMAIN, adsmind.ugdtimg.com, REJECT
DOMAIN, pgdt.gtimg.cn, REJECT
DOMAIN-SUFFIX, pangolin-sdk-toutiao.com, REJECT
DOMAIN-SUFFIX, pangle.io, REJECT

# 淘宝
DOMAIN, heic.alicdn.com, REJECT
DOMAIN-SUFFIX, h-adashx.ut.taobao.com, REJECT

# QQ音乐 DNS REJECT
DOMAIN, adstats.tencentmusic.com, REJECT
DOMAIN, ad.tencentmusic.com, REJECT
DOMAIN, adcdn.tencentmusic.com, REJECT
DOMAIN, adcdn6.tencentmusic.com, REJECT
DOMAIN, adexpo.tencentmusic.com, REJECT
DOMAIN, adclick.tencentmusic.com, REJECT
DOMAIN, otheve.beacon.qq.com, REJECT
DOMAIN, mazu.m.qq.com, REJECT
DOMAIN, monitor.music.qq.com, REJECT
DOMAIN, stat.y.qq.com, REJECT
DOMAIN, tmead.y.qq.com, REJECT
DOMAIN, oth.str.mdt.qq.com, REJECT
DOMAIN, h.trace.qq.com, REJECT
DOMAIN, sdk.e.qq.com, REJECT
DOMAIN, sdkreport.e.qq.com, REJECT
DOMAIN, p.l.qq.com, REJECT
DOMAIN, us.l.qq.com, REJECT
DOMAIN-SUFFIX, imtmp.net, REJECT

# 追踪 (2026-09-19 官方文档对齐: KEYWORD 随数量涨耗时, 改精确枚举;
# qreport 实测仅 qreport.qunar.com + qreport.cn 系, 不再用子串全网扫)
DOMAIN, qreport.qunar.com, REJECT
DOMAIN-SUFFIX, qreport.cn, REJECT
DOMAIN, aegis.cdn-go.cn, REJECT

# Google 分析与广告
# 本地精确 REJECT: 不依赖 [Remote Rule] 的列表加载 (CDN/上游故障时仍生效), 也兜住
# `DOMAIN-KEYWORD,googleads` 这类宽匹配。2026-09-18 重排后 Global 已排在三个 REJECT
# 列表之后, 旧的"Global 的 google 关键词抢先 googleads"遮蔽不复存在 (NEW-05 时代的
# 本地兜底成因已失效); 保留这些条目作为 [Rule] 段显式拦截 + 上游不可用时的兜底,
# 代价为零 ([Rule] 本就先于一切远程列表求值)。
DOMAIN-KEYWORD, googleads, REJECT
DOMAIN-SUFFIX, googleadservices.com, REJECT
DOMAIN-SUFFIX, doubleclick.net, REJECT
DOMAIN-SUFFIX, googlesyndication.com, REJECT
DOMAIN-SUFFIX, google-analytics.com, REJECT
DOMAIN-SUFFIX, googletagmanager.com, REJECT
DOMAIN-SUFFIX, googletagservices.com, REJECT
DOMAIN-SUFFIX, adservice.google.com, REJECT
# 常见分析 SDK
# 注: firebaseinstallations.googleapis.com 不再 REJECT — 它是 FCM 推送
# token 注册/刷新的前置接口, 拒绝会导致部分 App 收不到推送 (2026-07 审计修复)
DOMAIN-SUFFIX, app-measurement.com, REJECT
DOMAIN-SUFFIX, analytics.google.com, REJECT
DOMAIN-SUFFIX, crashlytics.googleapis.com, REJECT
DOMAIN-SUFFIX, segment.io, REJECT
DOMAIN-SUFFIX, amplitude.com, REJECT
DOMAIN-SUFFIX, mixpanel.com, REJECT
DOMAIN-SUFFIX, branch.io, REJECT
DOMAIN-SUFFIX, adjust.com, REJECT
DOMAIN-SUFFIX, appsflyer.com, REJECT
DOMAIN-SUFFIX, kochava.com, REJECT
DOMAIN-SUFFIX, sentry.io, REJECT

# Google 通配域名 (流媒体依赖) — ⚠️ 必须在 Analytics/Ad REJECT 之后, 避免截胡 crashlytics.googleapis.com / adservice.google.com / analytics.google.com (2026-07 审计修复)
DOMAIN-SUFFIX, gstatic.com, Streaming
DOMAIN-SUFFIX, googleapis.com, Streaming
DOMAIN-SUFFIX, google.com, Streaming
DOMAIN-SUFFIX, google.co.jp, Streaming

# ── 误杀域名白名单 (2026-08 审计) ────────────────────────────────
# 修正远端广告列表过粗 KEYWORD 的功能性误杀; 本地规则先于远端列表求值。
# 原则: 只放行「功能域」, 统计/追踪域保持 REJECT。
# - msg.umengcloud.com 为友盟推送 MPS 网关 (仅此域), ulogs/sec 友盟统计仍拦截
# - kepler.jd.com 系列为第三方 App 内京东购买页/开普勒 API (什么值得买等跳转依赖)
# - pstatp/byteimg 系列为字节内容图床 (头条信息流图片), dm./pglstatp 广告域不放行
DOMAIN, msg.umengcloud.com, DIRECT
DOMAIN, kepler.jd.com, DIRECT
DOMAIN, keplerapi.jd.com, DIRECT
DOMAIN, mapi.m.jd.com, DIRECT
DOMAIN, policy.jd.com, DIRECT
DOMAIN-SUFFIX, suning.com, DIRECT
DOMAIN, apiinit.amap.com, DIRECT
DOMAIN-SUFFIX, wixsite.com, Proxy
DOMAIN, p3.pstatp.com, DIRECT
DOMAIN, s1.pstatp.com, DIRECT
DOMAIN, s2.pstatp.com, DIRECT
DOMAIN, s3.pstatp.com, DIRECT
DOMAIN, a3.pstatp.com, DIRECT
DOMAIN, a3.bytecdn.cn, DIRECT
DOMAIN, p3-pack.byteimg.com, DIRECT
DOMAIN, p6-pack.byteimg.com, DIRECT

# ── 国内广告 SDK 硬拦截 (2026-08-12 HAR 审计) ─────────────────────
# 来源: 2026-08-12 抓包 (4602 条) — 以下 SDK 域名全部 200 穿透:
#   beizi.biz (贝兹广告: 什么值得买/西塞网等), stats.jpush.cn (极光统计: WPS/QQ阅读/米家),
#   mmstat.com (阿里 arms), ugdtimg.com (优量汇视频素材), 1rtb.net / 66mobi.com (移动广告),
#   cloooud.com / hubcloud.com.cn (广告聚合), sdk-open-phone.getui.com (个推统计),
#   snssdk-eu/-us.ninebot.com (九号出行字节日志), toblog.ctobsnssdk.com (字节日志),
#   sentry-monitor-new.zdmimg.com (smzdm 自建崩溃监控), path.book.qq.com (QQ阅读埋点),
#   ataru/fockrt/connect.yuewen.com + upushv6.qidian.com (阅文/起点追踪)
# ⚠️ 必须在 GEOIP,CN,DIRECT 之前: 本地规则优先, 国内域会被 GEOIP 直连截胡,
# 插件 [Rule] 与 Remote Rule 均无法拦截国内域 (已验证 ataru/qreport 穿透)
# ⚠️ 推送保活: 仅拦统计子域, 保留 config.jpush.cn / user.jpush.cn (极光推送) 与
# api.getui.com (个推推送) — 全拦 SUFFIX 会断推送
# ⚠️ GDT/穿山甲已全链 REJECT (见白名单区, 2026-08-12): 起点秒播视频替换
# 依赖的域已随"开屏广告必除"决策一并拦截 — 秒播脚本 [Script] 匹配不到即停用,
# 此处 SUFFIX 兜底覆盖 pgdt.ugdtimg.com 等素材子域; 统计/接口域已前置 REJECT
# ⚠️ 广告 SDK 下发/上报接口拦截 (2026-08-12 310_HAR 审计): 智慧房东开屏广告残留
# = 第三方 SDK 直投 (广点通素材/快手联盟/穿山甲/Sigmob)。广点通请求/素材域已全链
# REJECT (见白名单区); 此处拦截快手联盟 (gdfp.gifshow.com 下发 + open.e.kuaishou.com
# 配置/广告请求), 穿山甲请求接口 (tnc3-alisc1.zijieapi.com), Sigmob (sigmob.cn 全家),
# 优量汇展示上报 (v.gdt.qq.com / win.gdt.qq.com)
DOMAIN, v.gdt.qq.com, REJECT
DOMAIN, win.gdt.qq.com, REJECT
DOMAIN-SUFFIX, sigmob.cn, REJECT
DOMAIN, open.e.kuaishou.com, REJECT
DOMAIN-SUFFIX, gdfp.gifshow.com, REJECT
DOMAIN-SUFFIX, alisc1.zijieapi.com, REJECT
DOMAIN-SUFFIX, beizi.biz, REJECT
DOMAIN-SUFFIX, stats.jpush.cn, REJECT
DOMAIN-SUFFIX, gd-stats.jpush.cn, REJECT
DOMAIN-SUFFIX, mmstat.com, REJECT
DOMAIN-SUFFIX, ugdtimg.com, REJECT
DOMAIN-SUFFIX, 1rtb.net, REJECT
DOMAIN-SUFFIX, 66mobi.com, REJECT
DOMAIN-SUFFIX, cloooud.com, REJECT
DOMAIN-SUFFIX, hubcloud.com.cn, REJECT
DOMAIN, sdk-open-phone.getui.com, REJECT
DOMAIN, snssdk-eu.ninebot.com, REJECT
DOMAIN, snssdk-us.ninebot.com, REJECT
DOMAIN, toblog.ctobsnssdk.com, REJECT
DOMAIN, sentry-monitor-new.zdmimg.com, REJECT
DOMAIN, path.book.qq.com, REJECT
DOMAIN, ataru.qidian.com, REJECT
DOMAIN, fockrt.yuewen.com, REJECT
DOMAIN, connect.yuewen.com, REJECT
DOMAIN, upushv6.qidian.com, REJECT

# ── 国内广告/追踪 SDK 硬拦截 · 第二轮 (2026-08-12 HAR 审计) ──────
# 来源: 同一 HAR 继续挖掘 — 纯日志/埋点/APM 接口, 无功能依赖 (均实测 200 穿透):
#   穿山甲 (api-access/log-api/gromore, 已前置), adkwai.com (快手广告: p66-ad/p4-lm),
#   支付宝日志网关 (datagw-edge/loggw-ex/mdap, 纯 logUpload), mobads.baidu.com (百度广告),
#   sensors.umetrip.com.cn (航旅纵横神策), rmonitor.qq.com, QQ阅读 (unitelogreport/ywab),
#   UT 埋点 (h-adashx.ut.dingtalk, adashbc.ut.taobao), djiservice.org (大疆),
#   analytics-api-01.smzdm.com, adwangmai/toponad/gameley (小广告网),
#   zhipin (logapi-ios/apm-ios), volces APM / bytedance mssdk, 点评/美团埋点, delicloud
# 放弃项: proj-xtrace-*.log.aliyuncs.com / ce3e75d5.jpush.cn (哈希前缀轮换, 无法精确)
DOMAIN-SUFFIX, adkwai.com, REJECT
DOMAIN, datagw-edge.alipay.com, REJECT
DOMAIN, loggw-ex.alipay.com, REJECT
DOMAIN, mdap.alipay.com, REJECT
DOMAIN, mobads.baidu.com, REJECT
DOMAIN, mobads-logs.baidu.com, REJECT
DOMAIN, sensors.umetrip.com.cn, REJECT
DOMAIN, rmonitor.qq.com, REJECT
DOMAIN, unitelogreport.reader.qq.com, REJECT
DOMAIN, ywab.reader.qq.com, REJECT
DOMAIN, h-adashx.ut.dingtalk.com, REJECT
DOMAIN, adashbc.ut.taobao.com, REJECT
DOMAIN, statistical-report.djiservice.org, REJECT
DOMAIN, analytics-api-01.smzdm.com, REJECT
DOMAIN, sdk.adx.adwangmai.com, REJECT
DOMAIN, mores.toponad.com, REJECT
DOMAIN, jp.ad.gameley.com, REJECT
DOMAIN, logapi-ios.zhipin.com, REJECT
DOMAIN, apm-ios.zhipin.com, REJECT
DOMAIN, apmplus.ap-southeast-1.volces.com, REJECT
DOMAIN, mssdk-bu.bytedance.com, REJECT
DOMAIN, catdot.dianping.com, REJECT
DOMAIN, data-sdk-uuid-log.d.meituan.net, REJECT
DOMAIN, qt-api.delicloud.com, REJECT

# DNS 隐私语义 (Loon): 命中域名类规则的代理流量由代理远端解析, 不产生本地 DNS 查询;
# 本地解析 (国内 DoH, 解析器侧有记录) 仅发生在: ①走到下面 GEOIP 规则的域名
# ②直连流量本身 (国内域, 合理)。
# 默认姿态: Final 默认 Proxy + Fallback 双节点容灾 — 长尾域名走代理远端解析;
# 零代理姿态: Final 手动切 DIRECT (代价: 长尾域名本地解析 + 直连)。
GEOIP, CN, DIRECT
FINAL, Final

[Remote Rule]
# 2026-09-29 精简: 本段原挂 7 个第三方镜像规则列表 (Advertising 972 / Privacy 24 /
#   Hijacking 231 / China 69 / Global 207 / Epic 16 / goodbyeads 120387 条), 现全部移除。
#   代价 (需知悉): 失去 12 万条通用广告域名兜底, 长尾广告域不再被 REJECT, 改走 Final。
#   保留的自建拦截面: 下方 [Rule] 段的国内外广告/追踪 SDK 硬拦截 + 46 个 Plugin +
#   29 个 Scripts 的逐 App 字段级净化。
#   ⚠️ 随之消失的语义: 原注释所记 "China 的 cn 后缀吞掉 941+606 条 REJECT" 一类遮蔽
#   不再存在 (无远程列表参与按序求值), 故 check:shadow 门禁一并删除。

[Plugin]
# 注: DNS leak 规则已直接内置在 [Rule] 段, 不再需要独立插件
https://ws.wenn.in/main/Plugin/quicksearch.plugin, enabled=true, tag=快捷搜索
https://ws.wenn.in/main/Plugin/notify.plugin, enabled=true, tag=🔔 定时通知
# 诊断助手: generic 手动触发 — 双链路探活 (代理/直连) + 判定, 零常驻流量影响
https://ws.wenn.in/main/Plugin/diagnostics.plugin, enabled=true, tag=🩺 诊断助手
https://ws.wenn.in/main/Plugin/privacy-shield.plugin, enabled=true, tag=🔒 隐私防护 (SDK 追踪全拦截)
https://ws.wenn.in/main/Plugin/wechat-pro.plugin, enabled=true, tag=微信去广告 Pro
https://ws.wenn.in/main/Plugin/bilibili-pro.plugin, enabled=true, tag=B站去广告 Pro
https://ws.wenn.in/main/Plugin/shopping-purify.plugin, enabled=true, tag=🛍 购物生活净化 Pro
https://ws.wenn.in/main/Plugin/video-community-purify.plugin, enabled=true, tag=🎬 视频社区净化
https://ws.wenn.in/main/Plugin/media-reading-purify.plugin, enabled=true, tag=🎵 影音阅读净化
https://ws.wenn.in/main/Plugin/transport-purify.plugin, enabled=true, tag=🚕 出行外卖净化
https://ws.wenn.in/main/Plugin/news-purify.plugin, enabled=true, tag=📰 资讯阅读净化
https://ws.wenn.in/main/Plugin/social-netdisk-purify.plugin, enabled=true, tag=⚙️ 社交网盘工具净化

https://ws.wenn.in/main/Plugin/bilicomics.plugin, enabled=true, tag=B站漫画去广告
https://ws.wenn.in/main/Plugin/netease-pro.plugin, enabled=true, tag=网易云音乐净化 Pro
https://ws.wenn.in/main/Plugin/qishui.plugin, enabled=true, tag=汽水音乐净化
https://ws.wenn.in/main/Plugin/taopiaopiao-pro.plugin, enabled=true, tag=淘票票净化 Pro
https://ws.wenn.in/main/Plugin/amap.plugin, enabled=true, tag=高德地图去广告
https://ws.wenn.in/main/Plugin/jd-pro.plugin, enabled=true, tag=京东去广告 Pro
https://ws.wenn.in/main/Plugin/qqmusic.plugin, enabled=true, tag=QQ音乐去广告
https://ws.wenn.in/main/Plugin/zhihu-pro.plugin, enabled=true, tag=知乎去广告 Pro
# — App Pro 深度净化 —
https://ws.wenn.in/main/Plugin/weibo-pro.plugin, enabled=true, tag=微博去广告 Pro
https://ws.wenn.in/main/Plugin/xiaohongshu-pro.plugin, enabled=true, tag=小红书净化 Pro
https://ws.wenn.in/main/Plugin/iqiyi-pro.plugin, enabled=true, tag=爱奇艺净化 Pro
https://ws.wenn.in/main/Plugin/tencent-video-pro.plugin, enabled=true, tag=腾讯视频净化 Pro
https://ws.wenn.in/main/Plugin/taobao-tmall-pro.plugin, enabled=true, tag=淘宝天猫净化 Pro
https://ws.wenn.in/main/Plugin/pinduoduo-pro.plugin, enabled=true, tag=拼多多净化 Pro
https://ws.wenn.in/main/Plugin/alipay-pro.plugin, enabled=true, tag=支付宝净化 Pro
https://ws.wenn.in/main/Plugin/alipay-miniprogram-pro.plugin, enabled=true, tag=支付宝小程序净化 Pro
https://ws.wenn.in/main/Plugin/sunshufu-pro.plugin, enabled=true, tag=云闪付净化 Pro
https://ws.wenn.in/main/Plugin/bdpan-pro.plugin, enabled=true, tag=百度网盘净化 Pro
https://ws.wenn.in/main/Plugin/didi-pro.plugin, enabled=true, tag=滴滴出行净化 Pro
https://ws.wenn.in/main/Plugin/dingtalk-pro.plugin, enabled=true, tag=钉钉净化 Pro
https://ws.wenn.in/main/Plugin/overseas-social-pro.plugin, enabled=true, tag=海外社交净化 Pro
https://ws.wenn.in/main/Plugin/streaming-overseas-pro.plugin, enabled=true, tag=海外流媒体增强 Pro
https://ws.wenn.in/main/Plugin/shopping-overseas-pro.plugin, enabled=true, tag=海外购物净化 Pro
https://ws.wenn.in/main/Plugin/apple-services-pro.plugin, enabled=true, tag=Apple 服务增强 Pro
https://ws.wenn.in/main/Plugin/safari-webview-pro.plugin, enabled=true, tag=浏览器净化 Pro
https://ws.wenn.in/main/Plugin/startup-adblock-pro.plugin, enabled=true, tag=开屏广告通杀 Pro
https://ws.wenn.in/main/Plugin/qidian.plugin, enabled=true, tag=起点全能助手 Pro
https://ws.wenn.in/main/Plugin/bank.plugin, enabled=true, tag=银行及云闪付去广告
https://ws.wenn.in/main/Plugin/ai.plugin, enabled=true, tag=AI 服务分流
https://ws.wenn.in/main/Plugin/wechat-read.plugin, enabled=true, tag=微信读书去广告
https://ws.wenn.in/main/Plugin/luckin-pro.plugin, enabled=true, tag=瑞幸咖啡去广告 Pro
https://ws.wenn.in/main/Plugin/umetrip-pro.plugin, enabled=true, tag=航旅纵横去广告 Pro
https://ws.wenn.in/main/Plugin/keep-pro.plugin, enabled=true, tag=Keep 去广告 Pro
https://ws.wenn.in/main/Plugin/ximalaya-pro.plugin, enabled=true, tag=喜马拉雅去广告 Pro
# — 功能增强插件 (本地替代 kelee.one LPX, 2026-08-25 起 kelee.one 全局 403) —
# Google 重定向: 本地 Kelee/Google.plugin 替代原 kelee.one/Google.lpx

[Rewrite]
^https?:\/\/119\.29\.29\.29\/d reject-200
^https?:\/\/203\.107\.1\.1\/d reject-200
^https?:\/\/223\.5\.5\.5\/d reject-200
^https?:\/\/1\.12\.12\.12\/d reject-200
^https?:\/\/120\.53\.53\.53\/d reject-200

[MitM]
skip-server-cert-verify = false
hostname = -*.apple.com, -*.icloud.com, -*.icloud.com.cn, -*.95516.com, -*.cup.com.cn, -*.95516.com.cn, -*.unionpay.com, -*.icbc.com.cn, -*.mybank.icbc.com.cn, -*.icbc.com, -*.ccb.com, -*.ccb.cn, -*.boc.cn, -*.bankofchina.com, -*.jf365.boc.cn, -*.abchina.com, -*.abchina.com.cn, -*.cdn-static.abchina.com.cn, -*.cdn-static.abchina.com, -*.bankcomm.com, -*.bankcomm.cn, -*.creditcard.bankcomm.com, -*.creditcard.bankcomm.cn, -*.cmbchina.com, -*.cmbimg.com, -*.psbc.com, -*.spdb.com.cn, -*.spdbccc.com.cn, -*.citicbank.com, -*.citibank.com, -*.ecitic.com, -*.pingan.com.cn, -*.pingan.com, -*.hcz-member.pingan.com.cn, -*.iobs.pingan.com.cn, -*.stock.pingan.com, -*.cmbc.com.cn, -*.cib.com.cn, -*.cebbank.com, -*.ebchinabank.com, -*.hxb.com.cn, -*.cgbchina.com.cn, -*.95508.com, -*.static.95508.com, -*.bankofbeijing.com.cn, -*.bosc.cn, -*.js96008.com, -*.tenpay.com, -*.qianbao.qq.com, weatherkit.apple.com, configuration.ls.apple.com, gspe35-ssl.ls.apple.com, gspe35-ssl.ls.apple.cn, gspe1-ssl.ls.apple.com, news-edge.apple.com, news-todayconfig-edge.apple.com, news-events.apple.com, news-sports-events.apple.com, news-client.apple.com, news-client-search.apple.com, guzzoni.smoot.apple.com, api2.smoot.apple.com, *.smoot.apple.com, *.smoot.apple.cn, testflight.apple.com, uts-api.itunes.apple.com, umc-tempo-api.apple.com, play-cdn.itunes.apple.com, play-edge-cdn.itunes.apple.com, h5.if.qidian.com, magev6.if.qidian.com, ii.gdt.qq.com, adsmind.gdtimg.com, adsmind.ugdtimg.com, pgdt.gtimg.cn, api-access.pangolin-sdk-toutiao1.com, api.zhihuifangdong.net, netflow-mtop.cainiao.com, nbcps-mtop.cainiao.com, cn-acs.m.cainiao.com, e2e-mtop.cainiao.com, longquan-mtop.cainiao.com, -redirector*.youtube.com, youtubei.googleapis.com, m5.amap.com, m5-zb.amap.com, amdc.m.taobao.com, api.m.jd.com, api.zhihu.com, www.zhihu.com, appcloud2.zhihu.com, link.zhihu.com, zhuanlan.zhihu.com, m-cloud.zhihu.com, tiebac.baidu.com, tieba.baidu.com, tiebaapi.baidu.com, gql.reddit.com, gql-fed.reddit.com, duckduckgo.com, *.oca.nflxvideo.net