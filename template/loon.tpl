# ═══════════════════════════════════════════════════════════
#  Loon 配置 (Loon.lcf) — Surgio 生成 (滚动 main, 版本见 CHANGELOG)
#  核心: 自动健康检测 · 高质量多引擎去广告 · Apple原生增强 · 全球社交/流媒体分流 · 银行 MitM 冲突根治
#  引擎支持: iOS Loon 3.3.9+
# ═══════════════════════════════════════════════════════════

[General]
ip-mode = fake-ip
fake-ip-filter = *.lan, *.local, *.home.arpa, time.*.com, *.msftconnecttest.com, *.msftncsi.com, localhost, captive.apple.com
interface-mode = Performance
dns-server = 180.184.11.11, 180.184.22.22, 119.29.29.29, 223.5.5.5
doh-server = {{ customParams.doh_primary }}, {{ customParams.doh_fallback }}
doh3-server = {{ customParams.doh3_primary }}, {{ customParams.doh3_fallback }}
doq-server = {{ customParams.doq_server }}
hijack-dns = *:0, 8.8.8.8, 8.8.4.4, 1.1.1.1, 114.114.114.114, 223.6.6.6, 180.76.76.76
sni-sniffing = true
disable-stun = false
udp-fallback-mode = DIRECT
ipv6-vif = off
domain-reject-mode = DNS
dns-reject-mode = LOOPBACKIP
disconnect-on-policy-change = false
geoip-url = https://raw.githubusercontent.com/Loyalsoldier/geoip/release/Country.mmdb
ipasn-url = https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-ASN.mmdb
resource-parser = https://ws.wenn.in/main/Mirror/rules/loon-sub-store-parser.js
allow-wifi-access = false
wifi-access-http-port = 7222
wifi-access-socks5-port = 6225
test-timeout = 10
internet-test-url = http://cp.cloudflare.com/generate_204
proxy-test-url = http://cp.cloudflare.com/generate_204
skip-proxy = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 255.255.255.255/32, localhost, *.local, *.lan, *.home.arpa
bypass-tun = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 255.255.255.255/32
real-ip = *.cmpassport.com, *.jegotrip.com.cn, *.icitymobile.mobi, id6.me, *.boc.cn, *.abchina.com, *.ccb.com, *.psbc.com, *.cmbchina.com, *.icbc.com.cn, *.bankofchina.com, *.spdb.com.cn, *.cib.com.cn, *.cebbank.com, *.unionpay.com, *.pingan.com.cn, *.pingan.com, *.bankcomm.com, *.citicbank.com, *.hxb.com.cn, *.cgbchina.com.cn, *.push.apple.com, *.apns.apple.com, captive.apple.com, *.local, *.lan, *.home.arpa, *.srv.nintendo.net, *.stun.playstation.net, xbox.*.microsoft.com, *.xboxlive.com, stun.*, *.msftconnecttest.com, *.msftncsi.com, *.battlenet.com.cn

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
# Surgio 自动生成节点: npx surgio generate
# 通过 SURGIO_SUBSCRIPTION_URL (机场订阅) 传入; 为空时 Provider 为空节点
# (凭据永不进仓: surgio-build 有 Loon.lcf 凭据断言, 仓库零 Secrets)
# 容灾: Proxy url-test 组 (MainNodes 过滤) 自动纳管新节点 — 订阅中加入第二节点即双节点容灾
# 隔离: geonode-* 免费代理被 MainNodes 排除, 仅 OpenCode 组引用 (见 [Remote Filter]/[Remote Proxy])

[Proxy Group]
Proxy = url-test, MainNodes, 东京, url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50
Fallback = fallback, MainNodes, url=http://cp.cloudflare.com/generate_204, interval=600, timeout=10
Apple = select, DIRECT, Proxy
Final = select, Proxy, Fallback, DIRECT
Streaming = select, VLESS, Proxy, Fallback, DIRECT, tag=流媒体
AI = select, VLESS, Proxy, Fallback, DIRECT, tag=AI服务
Developer = select, Proxy, Fallback, DIRECT, tag=开发者
Gaming = select, Proxy, Fallback, DIRECT, tag=游戏平台
Social = select, Proxy, Fallback, DIRECT, tag=社交平台
OpenCode = select, Proxy, DIRECT, Geonode, tag=OpenCode.ai

[Remote Filter]
# 主节点池: 排除 geonode-* 免费代理 (免费代理稳定性差, 防 url-test 自动选路到不可用节点)
MainNodes = NameRegex, FilterKey = "^(?!.*geonode).*$"
VLESS = NameRegex, FilterKey = "(?i)^(?=.*vless)(?!.*geonode).*$"
#   含 geonode 负向前瞻 (2026-08-29 审计修复): 与 MainNodes 同一隔离基线。此前 "(?i)vless"
#   无排除, 一旦 geonode 订阅出现 vless 协议免费节点, Streaming/AI 组会把免费代理当首选
#   — 正是 MainNodes 正则要防的静默选路。(?i) 使两个条件均大小写不敏感。

[Remote Proxy]
# Geonode 免费代理订阅 — 每日由 proxy-sync workflow 从 proxylist.geonode.com 拉取,
# 候选节点先经连通性探测 (仅写入可用节点, 见 tools/geonode-sync.mjs)
# (Profile/geonode.loon.txt, Loon 官方节点文本格式, 无需解析器)
Geonode = https://ws.wenn.in/main/Profile/geonode.loon.txt,enabled=true

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
DOMAIN, news-edge.apple.com, Proxy
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
# 起点秒播脚本 (src/Qidian.ts) 仅依赖 gdtimg.com/gtimg.cn 视频域, 不依赖穿山甲,
# 故 api-access/log-api/gromore 三个接口域可安全拦截 (必须先于下方 SUFFIX DIRECT)
DOMAIN, api-access.pangolin-sdk-toutiao.com, REJECT
DOMAIN, api-access.pangolin-sdk-toutiao1.com, REJECT
DOMAIN, log-api.pangolin-sdk-toutiao.com, REJECT
DOMAIN, gromore.pangolin-sdk-toutiao.com, REJECT

# ⚠️ 广点通/穿山甲全链拦截 (2026-08-12 用户决策): 原白名单是起点秒播脚本
# (src/Qidian.ts 视频替换) 的依赖, 但 adsmind.ugdtimg.com 素材同时是智慧房东
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
DOMAIN, adcdn6.tencentmusic.com, DROP
DOMAIN, adexpo.tencentmusic.com, DROP
DOMAIN, adclick.tencentmusic.com, DROP
DOMAIN, otheve.beacon.qq.com, DROP
DOMAIN, mazu.m.qq.com, DROP
DOMAIN, monitor.music.qq.com, DROP
DOMAIN, stat.y.qq.com, REJECT
DOMAIN, tmead.y.qq.com, REJECT
DOMAIN, oth.str.mdt.qq.com, REJECT
DOMAIN, h.trace.qq.com, REJECT
DOMAIN, sdk.e.qq.com, REJECT
DOMAIN, sdkreport.e.qq.com, REJECT
DOMAIN, p.l.qq.com, REJECT
DOMAIN, us.l.qq.com, REJECT
DOMAIN-SUFFIX, imtmp.net, REJECT

# 追踪
DOMAIN-KEYWORD, qreport, REJECT
DOMAIN, aegis.cdn-go.cn, REJECT

# Google 分析与广告
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
# 排序 (2026-08): China 提前 — 国内流量先命中 DIRECT, 不必扫描广告/隐私/反劫持列表
# Global 次位 — 国际主流域 (34,579 SUFFIX) 直接命中 Proxy 提前终止, 避免扫描广告/隐私/反劫持三列表 (2026-08 审计)
#   前提: Global 列表与广告/隐私/国内域交集为空 (CI 纯净度检查兜底); 广告域仍由 Advertising REJECT 拦截
https://ws.wenn.in/main/Mirror/rules/loon-China.list, policy=DIRECT, tag=🇨🇳 国内域名, enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Global.list, policy=Proxy, tag=🌍 国际域名, enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Advertising.list, policy=REJECT, tag=🚫 广告域名, enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Privacy.list, policy=REJECT, tag=🔒 隐私保护, enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Hijacking.list, policy=REJECT, tag=🛡️ 反劫持, enabled=true
https://3kaiu-mirror-1787937996.s3-ap-northeast-1.amazonaws.com/rules/goodbyeads-qx.list, tag=GOODBYEADS, policy=REJECT, enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Epic.list, policy=Proxy, tag=🎮 Epic Games, enabled=true

[Plugin]
# 注: DNS leak 规则已直接内置在 [Rule] 段, 不再需要独立插件
https://ws.wenn.in/main/Mirror/rules/loon-AllInOne.plugin, enabled=true, tag=通用广告域名层
https://ws.wenn.in/main/Mirror/rules/loon-AdvertisingScript.plugin, enabled=true, tag=广告脚本增强
https://ws.wenn.in/main/Plugin/sub-store.plugin, enabled=true, tag=Sub-Store 订阅管理
https://ws.wenn.in/main/Plugin/quicksearch.plugin, enabled=true, tag=快捷搜索
https://ws.wenn.in/main/Plugin/notify.plugin, enabled=true, tag=🔔 定时通知
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
https://ws.wenn.in/main/Kelee/YouTube_remove_ads.plugin, enabled=true, tag=YouTube去广告
# — 🧹 iKeLee 转写新增 (2026-08) —
https://ws.wenn.in/main/Kelee/smzdm-remove-ads.plugin, enabled=true, tag=什么值得买去广告
https://ws.wenn.in/main/Kelee/guiderank-remove-ads.plugin, enabled=true, tag=盖得排行去广告
https://ws.wenn.in/main/Kelee/umetrip-remove-ads.plugin, enabled=true, tag=航旅纵横去广告(轻量)
https://ws.wenn.in/main/Kelee/12306-remove-ads.plugin, enabled=true, tag=12306去广告(轻量)
https://ws.wenn.in/main/Mirror/iringo/iRingo.WeatherKit.plugin, enabled=true, tag=🍎天气增强
https://ws.wenn.in/main/Mirror/iringo/iRingo.Maps.plugin, enabled=true, tag=🍎地图增强
https://ws.wenn.in/main/Mirror/iringo/iRingo.News.plugin, enabled=true, tag=🍎News解锁
https://ws.wenn.in/main/Mirror/iringo/iRingo.Siri.plugin, enabled=true, tag=🍎Siri增强
https://ws.wenn.in/main/Mirror/iringo/iRingo.Search.plugin, enabled=true, tag=🍎搜索建议增强
https://ws.wenn.in/main/Mirror/iringo/iRingo.TestFlight.plugin, enabled=true, tag=🍎TestFlight增强
https://ws.wenn.in/main/Mirror/iringo/iRingo.TV.plugin, enabled=true, tag=🍎TV增强
https://ws.wenn.in/main/Mirror/iringo/iRingo.LocationService.plugin, enabled=true, tag=🍎定位服务增强
# — 🍿️ DualSubs 双语字幕增强 —
https://ws.wenn.in/main/Mirror/dualsubs/DualSubs.Universal.plugin, enabled=true, tag=🍿️ DualSubs: 流媒体双语字幕
https://ws.wenn.in/main/Mirror/dualsubs/DualSubs.YouTube.plugin, enabled=true, tag=🍿️ DualSubs: YouTube 双语字幕
https://ws.wenn.in/main/Mirror/dualsubs/DualSubs.Netflix.plugin, enabled=true, tag=🍿️ DualSubs: Netflix 双语字幕
# — ☁️ Auraflare Cloudflare 增强 —
https://ws.wenn.in/main/Mirror/auraflare/Cloudflare.1.1.1.1.plugin, enabled=true, tag=☁️ 1.1.1.1 WARP 面板
https://ws.wenn.in/main/Mirror/auraflare/Cloudflare.DNS.plugin, enabled=true, tag=☁️ Cloudflare DNS 管理
# — 📺 BiliUniverse B站增强 —
https://ws.wenn.in/main/Mirror/biliuniverse/BiliBili.Enhanced.plugin, enabled=true, tag=📺 B站增强模式
https://ws.wenn.in/main/Mirror/biliuniverse/BiliBili.Global.plugin, enabled=true, tag=📺 B站全球模式
https://ws.wenn.in/main/Mirror/biliuniverse/BiliBili.ADBlock.plugin, enabled=true, tag=📺 B站去广告
https://ws.wenn.in/main/Mirror/biliuniverse/BiliBili.Redirect.plugin, enabled=true, tag=📺 B站CDN重定向
# — 功能增强插件 (本地替代 kelee.one LPX, 2026-08-25 起 kelee.one 全局 403) —
# Google 重定向: 本地 Kelee/Google.plugin 替代原 kelee.one/Google.lpx
https://ws.wenn.in/main/Kelee/Google.plugin, enabled=true, tag=🔍 Google搜索重定向
# Spotify 歌词翻译 / 微信外链解锁 / 京东比价 / 节点检测 / 链路检测: 无本地替代, 已移除
# 参见 AGENTS.md 架构已知问题: kelee.one 全局 403 (issue #27)

[Rewrite]
^https?:\/\/119\.29\.29\.29\/d reject-200
^https?:\/\/203\.107\.1\.1\/d reject-200
^https?:\/\/223\.5\.5\.5\/d reject-200
^https?:\/\/1\.12\.12\.12\/d reject-200
^https?:\/\/120\.53\.53\.53\/d reject-200

[MitM]
skip-server-cert-verify = false
hostname = -*.apple.com, -*.icloud.com, -*.icloud.com.cn, -*.95516.com, -*.cup.com.cn, -*.95516.com.cn, -*.unionpay.com, -*.icbc.com.cn, -*.mybank.icbc.com.cn, -*.icbc.com, -*.ccb.com, -*.ccb.cn, -*.boc.cn, -*.bankofchina.com, -*.jf365.boc.cn, -*.abchina.com, -*.abchina.com.cn, -*.cdn-static.abchina.com.cn, -*.cdn-static.abchina.com, -*.bankcomm.com, -*.bankcomm.cn, -*.creditcard.bankcomm.com, -*.creditcard.bankcomm.cn, -*.cmbchina.com, -*.cmbimg.com, -*.psbc.com, -*.spdb.com.cn, -*.spdbccc.com.cn, -*.citicbank.com, -*.citibank.com, -*.ecitic.com, -*.pingan.com.cn, -*.pingan.com, -*.hcz-member.pingan.com.cn, -*.iobs.pingan.com.cn, -*.stock.pingan.com, -*.cmbc.com.cn, -*.cib.com.cn, -*.cebbank.com, -*.ebchinabank.com, -*.hxb.com.cn, -*.cgbchina.com.cn, -*.95508.com, -*.static.95508.com, -*.bankofbeijing.com.cn, -*.bosc.cn, -*.js96008.com, -*.tenpay.com, -*.qianbao.qq.com, weatherkit.apple.com, configuration.ls.apple.com, gspe35-ssl.ls.apple.com, gspe35-ssl.ls.apple.cn, gspe1-ssl.ls.apple.com, news-edge.apple.com, news-todayconfig-edge.apple.com, news-events.apple.com, news-sports-events.apple.com, news-client.apple.com, news-client-search.apple.com, guzzoni.smoot.apple.com, api2.smoot.apple.com, *.smoot.apple.com, *.smoot.apple.cn, testflight.apple.com, uts-api.itunes.apple.com, umc-tempo-api.apple.com, play-cdn.itunes.apple.com, play-edge-cdn.itunes.apple.com, h5.if.qidian.com, magev6.if.qidian.com, ii.gdt.qq.com, adsmind.gdtimg.com, adsmind.ugdtimg.com, pgdt.gtimg.cn, api-access.pangolin-sdk-toutiao.com, api-access.pangolin-sdk-toutiao1.com, api.zhihuifangdong.net, netflow-mtop.cainiao.com, nbcps-mtop.cainiao.com, cn-acs.m.cainiao.com, e2e-mtop.cainiao.com, longquan-mtop.cainiao.com, -*.googlevideo.com, *.youtube.com, youtubei.googleapis.com, m5.amap.com, m5-zb.amap.com, amdc.m.taobao.com, dispatcher.is.autonavi.com, api.m.jd.com, api.zhihu.com, www.zhihu.com, appcloud2.zhihu.com, link.zhihu.com, zhuanlan.zhihu.com, m-cloud.zhihu.com, tiebac.baidu.com, tieba.baidu.com, tiebaapi.baidu.com, gql.reddit.com, gql-fed.reddit.com, duckduckgo.com, *.oca.nflxvideo.net