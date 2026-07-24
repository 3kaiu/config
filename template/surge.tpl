# ═══════════════════════════════════════════════════════════
#  Surge 配置 (Surge.conf) — v7.8 (Surgio 生成)
#  第三端冗余配置: 对冲 Loon/QX 单生态风险
#  引擎支持: iOS Surge 5+
#
#  v1 覆盖范围 (与 Loon/QX 等价):
#    ✅ 全部路由规则 (银行去广告/分流组/STUN/HTTPDNS/Apple/微信)
#    ✅ 5 组策略: Proxy/Apple/Final/Streaming/AI/Developer/Social
#    ✅ 远程规则集 (blackmatrix7 RULE-SET ×6)
#    ✅ URL 净化: HTTPDNS 拦截/JD/知乎/YouTube/快捷搜索
#    ✅ 脚本净化: YouTube(Mirror)/知乎/智慧房东/贴吧
#    ✅ 定时任务: 节点健康检测/流量统计通知 (cron)
#  v1 暂未覆盖 (后续以 sgmodule 形式补齐):
#    ❌ 起点全能助手 (Qidian.js 的 Env 缺 Surge 通知分支, 直接运行会崩溃)
#    ❌ B站/网易云/微博/闲鱼/汽水/淘票票/高德/QQ音乐/Reddit 深度净化
#    ❌ Apple 增强 (iRingo) / Kelee 功能增强 / Sub-Store GUI
#  ⚠️ Surge 的 MITM hostname 不支持 `-` 负向排除语法:
#     本配置仅列入需要解密的域名, 银行/支付域天然不在列表中 (等价于 Loon/QX 的排除)
# ═══════════════════════════════════════════════════════════

[General]
loglevel = notify
compatibility-mode = 1
ipv6 = false
dns-server = 180.184.11.11, 180.184.22.22, 119.29.29.29, 223.5.5.5
doh-server = {{ customParams.doh_primary }}, {{ customParams.doh_fallback }}
encrypted-dns-server = {{ customParams.doq_server }}
hijack-dns = *:53, 8.8.8.8, 8.8.4.4, 1.1.1.1, 114.114.114.114
show-error-page-for-reject = true
skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, 169.254.0.0/16, localhost, *.local, *.lan
bypass-tun = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 255.255.255.255/32
internet-test-url = http://cp.cloudflare.com/generate_204
proxy-test-url = http://cp.cloudflare.com/generate_204
test-timeout = 10
geoip-maxmind-url = https://raw.githubusercontent.com/Loyalsoldier/geoip/release/Country.mmdb
always-real-ip = *.push.apple.com, *.apns.apple.com, captive.apple.com, *.local, *.lan, *.cmpassport.com, *.jegotrip.com.cn, *.icitymobile.mobi, id6.me, *.srv.nintendo.net, *.stun.playstation.net, xbox.*.microsoft.com, *.xboxlive.com, *.msftconnecttest.com, *.msftncsi.com, *.battlenet.com.cn

[Replica]
hide-apple-request = false

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
*.icloud.com = server:223.5.5.5
*.icloud.com.cn = server:223.5.5.5
httpdns.c.cdnhwc.com = 0.0.0.0
httpdns.gslb.netease.com = 0.0.0.0
httpdns.alikunlun.com = 0.0.0.0
httpdns.baidubce.com = 0.0.0.0
httpdns.volcengineapi.com = 0.0.0.0
httpdns.c.cdnhwc2.com = 0.0.0.0
mtalk.google.com = 108.177.125.188

[Proxy]
# Surgio 自动生成节点: npx surgio generate
# 通过 SURGIO_SUBSCRIPTION_URL (机场订阅) 传入; 或配置 surge_node_policy_path 走 policy-path

[Proxy Group]
{% if customParams.surge_node_policy_path %}Proxy = url-test, policy-path={{ customParams.surge_node_policy_path }}, url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50{% else %}# ⚠️ 未配置节点源: 在 surgio.conf.js 设置 surge_node_policy_path (Sub-Store 集合的 Surge policy-path URL), 或导入后在 Surge GUI 手动添加节点
Proxy = select, DIRECT{% endif %}
Apple = select, DIRECT, Proxy
Final = select, DIRECT, Proxy
Streaming = select, Proxy, DIRECT
AI = select, Proxy, DIRECT
Developer = select, Proxy, DIRECT
Social = select, Proxy, DIRECT

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

# STUN 阻断
DOMAIN-KEYWORD, stun.playstation, DIRECT
DOMAIN-KEYWORD, stun.nintendo, DIRECT
DOMAIN-SUFFIX, xboxlive.com, DIRECT
DOMAIN-KEYWORD, stun, REJECT
DEST-PORT, 3478, REJECT

# 局域网
IP-CIDR, 192.168.0.0/16, DIRECT, no-resolve
IP-CIDR, 10.0.0.0/8, DIRECT, no-resolve
IP-CIDR, 172.16.0.0/12, DIRECT, no-resolve
IP-CIDR, 127.0.0.0/8, DIRECT, no-resolve

# HTTPDNS 拦截
DOMAIN-KEYWORD, httpdns, REJECT

# Apple
DOMAIN, news-edge.apple.com, Proxy
DOMAIN-SUFFIX, apple.com, Apple
DOMAIN-SUFFIX, icloud.com, Apple
DOMAIN-SUFFIX, icloud.com.cn, Apple

# 微信
DOMAIN-SUFFIX, wechat.com, DIRECT
DOMAIN-SUFFIX, qpic.cn, DIRECT
DOMAIN-SUFFIX, weixin.qq.com, DIRECT
DOMAIN-SUFFIX, wx.qq.com, DIRECT

{% include "./snippet/ai-services.tpl" %}
{% include "./snippet/streaming.tpl" %}
{% include "./snippet/social.tpl" %}
{% include "./snippet/developer.tpl" %}

# Google 分析与广告 — 必须在 Google 通配域名之前 (Surge 按书写顺序匹配)
DOMAIN-SUFFIX, googleadservices.com, REJECT
DOMAIN-SUFFIX, doubleclick.net, REJECT
DOMAIN-SUFFIX, googlesyndication.com, REJECT
DOMAIN-SUFFIX, google-analytics.com, REJECT
DOMAIN-SUFFIX, googletagmanager.com, REJECT
DOMAIN-SUFFIX, googletagservices.com, REJECT
DOMAIN-SUFFIX, adservice.google.com, REJECT
# Firebase
DOMAIN-SUFFIX, firebaseinstallations.googleapis.com, REJECT
# 常见分析 SDK
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

# Google 通配域名 (流媒体依赖) — 在 AI/分析 reject 之后
DOMAIN-SUFFIX, gstatic.com, Streaming
DOMAIN-SUFFIX, googleapis.com, Streaming
DOMAIN-SUFFIX, google.com, Streaming
DOMAIN-SUFFIX, google.co.jp, Streaming

# Google 全家桶
DOMAIN-SUFFIX, googleusercontent.com, Proxy
DOMAIN-SUFFIX, ggpht.com, Proxy
DOMAIN-SUFFIX, withgoogle.com, Proxy
DOMAIN, g.co, Proxy

# 淘宝
DOMAIN, heic.alicdn.com, REJECT
DOMAIN-SUFFIX, h-adashx.ut.taobao.com, REJECT

# 追踪
DOMAIN-KEYWORD, qreport, REJECT
DOMAIN, aegis.cdn-go.cn, REJECT

# 远程规则集 (blackmatrix7, Surge 格式)
RULE-SET, https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Advertising/Advertising.list, REJECT
RULE-SET, https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Privacy/Privacy.list, REJECT
RULE-SET, https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Hijacking/Hijacking.list, REJECT
RULE-SET, https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Epic/Epic.list, Proxy
RULE-SET, https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/China/China.list, DIRECT
RULE-SET, https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Global/Global.list, Proxy

GEOIP, CN, DIRECT
FINAL, Final, dns-failed

[URL Rewrite]
# HTTPDNS 拦截
^https?:\/\/119\.29\.29\.29\/d - reject-200
^https?:\/\/203\.107\.1\.1\/d - reject-200
^https?:\/\/223\.5\.5\.5\/d - reject-200
^https?:\/\/1\.12\.12\.12\/d - reject-200
^https?:\/\/120\.53\.53\.53\/d - reject-200

# JD 推荐位广告
^https?:\/\/api\.m\.jd\.com\/client\.action\?functionId=(searchBoxWord|stationPullService|uniformRecommend[06]) - reject-dict

# 知乎
^https:\/\/api\.zhihu\.com\/commercial_api\/(answer\/banners|banners|launch) - reject-dict
^https:\/\/api\.zhihu\.com\/content-distribution-core - reject-dict
^https:\/\/api\.zhihu\.com\/moments\/drama - reject-dict
^https:\/\/api\.zhihu\.com\/root\/window - reject-dict
^https:\/\/api\.zhihu\.com\/bazaar\/float_window - reject-dict
^https:\/\/api\.zhihu\.com\/market\/popovers_v2 - reject-dict
^https:\/\/api\.zhihu\.com\/me\/guides - reject-dict
^https:\/\/api\.zhihu\.com\/unlimited\/go\/my_card - reject
^https:\/\/api\.zhihu\.com\/search\/preset_words - reject-dict
^https:\/\/www\.zhihu\.com\/search\/related_queries - reject-dict
^https:\/\/api\.zhihu\.com\/ab\/api - reject-dict
# 知乎外链直达 (保留原协议, 不降级 http)
^https:\/\/link\.zhihu\.com\/\?target=(https?)?(%3A|:)?(\/\/|%2F%2F)?(.*?)(&source.*)?$ - 302 https://$4

# YouTube (googlevideo 广告段)
(^https?:\/\/[\w-]+\.googlevideo\.com\/(?!dclk_video_ads).+?)&ctier=L(&.+?),ctier,(.+) - 302 $1$2$3
^https?:\/\/[\w-]+\.googlevideo\.com\/initplayback.+&oad - reject-200

# QuickSearch (Safari 快捷搜索, DuckDuckGo 重定向)
# ⚠️ 隐私提示: 兜底规则会把 DDG 搜索词转给 Google, 介意者删除最后一条
^https:\/\/duckduckgo\.com\/\?q=bd\+([^&]+).+ - 302 https://www.baidu.com/s?wd=$1
^https:\/\/duckduckgo\.com\/\?q=bdimg\+([^&]+).+ - 302 https://image.baidu.com/search/index?tn=baiduimage&word=$1
^https:\/\/duckduckgo\.com\/\?q=gimg\+([^&]+).+ - 302 https://www.google.com/search?&tbm=isch&q=$1
^https:\/\/duckduckgo\.com\/\?q=b\+([^&]+).+ - 302 https://www.bing.com/search?q=$1
^https:\/\/duckduckgo\.com\/\?q=wk\+([^&]+).+ - 302 https://zh.wikipedia.org/wiki/$1
^https:\/\/duckduckgo\.com\/\?q=qm\+([^&]+).+ - 302 https://www.qimai.cn/search/index/country/cn/search/$1
^https:\/\/duckduckgo\.com\/\?q=gh\+([^&]+).+ - 302 https://github.com/search?q=$1
^https:\/\/duckduckgo\.com\/\?q=([^&]+).+ - 302 https://www.google.com/search?q=$1

[Script]
# YouTube 去广告 (Maasea/sgmodule 移植, Surge 原生兼容)
YouTube请求 = type=http-request, pattern=^https?:\/\/[\w-]+\.googlevideo\.com\/initplayback.+&ack, script-path=https://ws.wenn.in/main/Mirror/youtube.request.js, requires-body=true, timeout=10
YouTube请求2 = type=http-request, pattern=^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/log_event, script-path=https://ws.wenn.in/main/Mirror/youtube.request.js, requires-body=true, timeout=10
YouTube响应 = type=http-response, pattern=^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(browse|next|player|search|reel\/reel_watch_sequence|guide|account\/get_setting|get_watch|log_event|config), script-path=https://ws.wenn.in/main/Mirror/youtube.response.js, requires-body=true, timeout=10

# 知乎净化
知乎净化 = type=http-response, pattern=^https:\/\/api\.zhihu\.com\/(commercial_api\/answer\/banners|commercial_api\/banners|content-distribution-core|moments\/drama|root\/window|prague\/related_suggestion|v5\.1\/topics\/answer\/relation|hot_recommendation|mcn\/v2\/linkcards|distribute\/rhea|answers\/questions\/related-readings|commercial_api\/mobile_banner|zhuanlan\/api\/articles|ab\/api|ad-style-service), script-path=https://ws.wenn.in/main/Scripts/Zhihu.js, requires-body=true, timeout=10
知乎搜索词 = type=http-response, pattern=^https:\/\/api\.zhihu\.com\/search\/preset_words, script-path=https://ws.wenn.in/main/Scripts/Zhihu.js, requires-body=true, timeout=10

# 智慧房东去广告 ($argument 缺失时按 URL 自动分流)
智慧房东开屏 = type=http-response, pattern=^https?:\/\/api\.zhihuifangdong\.net\/core\/app\/activity\/appOpenAds, script-path=https://ws.wenn.in/main/Scripts/Zhihuifangdong.js, requires-body=true, timeout=10
智慧房东Banner = type=http-response, pattern=^https?:\/\/api\.zhihuifangdong\.net\/core\/app\/activity\/bannerPicMore, script-path=https://ws.wenn.in/main/Scripts/Zhihuifangdong.js, requires-body=true, timeout=10

# 贴吧净化 (仅 JSON; Proto 需 protobuf 解码, 暂不支持)
贴吧净化 = type=http-response, pattern=^https?:\/\/(tiebac|tieba|tiebaapi)\.baidu\.com, script-path=https://ws.wenn.in/main/Scripts/Tieba.js, requires-body=true, timeout=10

# 定时任务
节点健康检测 = type=cron, cronexp="0 */6 * * *", script-path=https://ws.wenn.in/main/Scripts/health-notify.js, timeout=60, wake-system=true
流量统计通知 = type=cron, cronexp="0 22 * * *", script-path=https://ws.wenn.in/main/Scripts/traffic-notify.js, timeout=60, wake-system=true

[MITM]
skip-server-cert-verify = false
hostname = *.googlevideo.com, *.youtube.com, youtubei.googleapis.com, api.zhihu.com, www.zhihu.com, link.zhihu.com, api.zhihuifangdong.net, tiebac.baidu.com, tieba.baidu.com, tiebaapi.baidu.com, duckduckgo.com
