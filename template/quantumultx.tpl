# ═══════════════════════════════════════════════════════════
#  Quantumult X 配置 (QX.conf) — v7.8 (Surgio 生成)
#  核心: 自动延迟检测 · 高质量多引擎去广告 · Apple原生增强 · 全球社交/流媒体分流 · 银行 MitM 冲突根治
# ═══════════════════════════════════════════════════════════

[general]
resource_parser_url=https://raw.githubusercontent.com/KOP-XIAO/QuantumultX/master/Scripts/resource-parser.js
network_check_url=http://cp.cloudflare.com/generate_204
server_check_url=http://cp.cloudflare.com/generate_204
server_check_timeout=5000
geo_location_checker=http://ip-api.com/json/?lang=zh-CN, https://raw.githubusercontent.com/KOP-XIAO/QuantumultX/master/Scripts/IP_API.js
fallback_udp_policy=direct
icmp_auto_reply = true
excluded_routes = 192.168.0.0/16, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 224.0.0.0/4, 255.255.255.255/32
dns_exclusion_list = *.local, *.lan, *.home.arpa, *.srv.nintendo.net, *.stun.playstation.net, *.xboxlive.com, *.msftconnecttest.com, *.msftncsi.com, *.battlenet.com.cn, *.cmpassport.com, *.jegotrip.com.cn, *.icitymobile.mobi, id6.me, *.boc.cn, *.abchina.com, *.ccb.com, *.psbc.com, *.cmbchina.com, *.icbc.com.cn, *.bankofchina.com, *.spdb.com.cn, *.cib.com.cn, *.cebbank.com, *.unionpay.com, *.pingan.com.cn, *.pingan.com, *.bankcomm.com, *.citicbank.com, *.hxb.com.cn, *.cgbchina.com.cn

[dns]
no-system
no-ipv6
prefer-doh3
circumvent-ipv4-answer=127.0.0.1, 0.0.0.0
circumvent-ipv6-answer=::
server=180.184.11.11
server=180.184.22.22
server=119.29.29.29
server=223.5.5.5
doh-server={{ customParams.doh_primary }}, {{ customParams.doh_fallback }}
doq-server={{ customParams.doq_server }}
address=/httpdns.c.cdnhwc.com/0.0.0.0
address=/httpdns.gslb.netease.com/0.0.0.0
address=/httpdns.alikunlun.com/0.0.0.0
address=/httpdns.baidubce.com/0.0.0.0
address=/httpdns.volcengineapi.com/0.0.0.0
address=/httpdns.c.cdnhwc2.com/0.0.0.0
server=/*.taobao.com/223.5.5.5
server=/*.jd.com/119.29.29.29
server=/*.qq.com/119.29.29.29
server=/*.weixin.qq.com/119.29.29.29
server=/*.apple.com/223.5.5.5
server=/*.icloud.com/223.5.5.5
address=/mtalk.google.com/108.177.125.188

[policy]
url-latency-benchmark=Proxy, server_regex=., check-interval=300, alive-checking=false, tolerance=50, img-url=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Proxy.png
static=Apple, direct, Proxy, img-url=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Apple.png
static=Final, direct, Proxy, img-url=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Final.png

[server_remote]
# Surgio 管理节点加载 — 通过 SURGIO_SUBSCRIPTION_URL 或 Secrets

[server_local]
# Surgio 自动生成节点 — 通过 SURGIO_SUBSCRIPTION_URL 或 Secrets

[filter_remote]
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Advertising/Advertising.list, tag=🚫 广告域名, force-policy=reject, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Privacy/Privacy.list, tag=🔒 隐私保护, force-policy=reject, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Hijacking/Hijacking.list, tag=🛡️ 反劫持, force-policy=reject, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Epic/Epic.list, tag=🎮 Epic Games, force-policy=Proxy, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/China/China.list, tag=🇨🇳 国内域名, force-policy=direct, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Global/Global.list, tag=🌍 国际域名, force-policy=Proxy, update-interval=86400, opt-parser=true, enabled=true

[filter_local]
dest-port, 5223, direct

{% include "./snippet/bank-ad-reject.qx" %}

host-suffix, unionpay.com, direct
host-suffix, cmbchina.com, direct
host-suffix, icbc.com.cn, direct
host-suffix, ccb.com, direct
host-suffix, boc.cn, direct
host-suffix, psbc.com, direct
host-suffix, spdb.com.cn, direct
host-suffix, cib.com.cn, direct
host-suffix, cebbank.com, direct
host-suffix, pingan.com.cn, direct
host-suffix, pingan.com, direct
host-suffix, bankcomm.com, direct
host-suffix, citicbank.com, direct
host-suffix, hxb.com.cn, direct
host-suffix, cgbchina.com.cn, direct
host-suffix, bankofchina.com, direct
host-suffix, abchina.com, direct
host-suffix, 95559.com.cn, direct

host-suffix, discord.media, Proxy
host-suffix, discordapp.com, Proxy
host-suffix, discordapp.net, Proxy

host-keyword, stun.playstation, direct
host-keyword, stun.nintendo, direct
host-keyword, xboxlive.com, direct
host-keyword, stun, reject
dest-port, 3478, reject

host-keyword, httpdns, reject

host-suffix, dnsleaktest.com, Proxy
host-suffix, dnsleak.com, Proxy
host-suffix, expressvpn.com, Proxy
host-suffix, nordvpn.com, Proxy
host-suffix, surfshark.com, Proxy
host-suffix, ipleak.net, Proxy
host-suffix, perfect-privacy.com, Proxy
host-suffix, browserleaks.com, Proxy
host-suffix, browserleaks.org, Proxy
host-suffix, vpnunlimited.com, Proxy
host-suffix, whoer.net, Proxy
host-suffix, whrq.net, Proxy
host-suffix, astrill.com, Proxy
host-suffix, astrill.org, Proxy
host-suffix, dnsleak.asn247.net, Proxy
host-suffix, surfsharkdns.com, Proxy
host-suffix, pixelscan.net, Proxy
host-suffix, ipapi.co, Proxy
host, ipv4.ping0.cc, Proxy
host, ipv6.ping0.cc, Proxy
host, ip-scan.adspower.net, Proxy

{% include "./snippet/streaming.qx" %}

{% include "./snippet/social.qx" %}

{% include "./snippet/developer.qx" %}

# Google 全家桶
host-suffix, googleusercontent.com, Proxy
host-suffix, ggpht.com, Proxy
host-suffix, withgoogle.com, Proxy
host, g.co, Proxy

host, news-edge.apple.com, Proxy
host-suffix, apple.com, Apple
host-suffix, icloud.com, Apple
host-suffix, icloud.com.cn, Apple

host-suffix, wechat.com, direct
host-suffix, weixin.qq.com, direct
host-suffix, wx.qq.com, direct
host-suffix, qpic.cn, direct

host, mi.gdt.qq.com, direct
host, ii.gdt.qq.com, direct
host, c.gdt.qq.com, direct
host, adsmind.gdtimg.com, direct
host-suffix, pangolin-sdk-toutiao.com, direct
host-suffix, pangle.io, direct

host, heic.alicdn.com, reject
host-suffix, h-adashx.ut.taobao.com, reject

# QQ音乐 DNS REJECT
host, adstats.tencentmusic.com, reject
host, ad.tencentmusic.com, reject
host, adcdn.tencentmusic.com, reject
host-suffix, imtmp.net, reject

{% include "./snippet/ai-services.qx" %}

host-keyword, qreport, reject
host, aegis.cdn-go.cn, reject

# Google 分析与广告
host-suffix, googleadservices.com, reject
host-suffix, doubleclick.net, reject
host-suffix, googlesyndication.com, reject
host-suffix, google-analytics.com, reject
host-suffix, googletagmanager.com, reject
host-suffix, googletagservices.com, reject
host-suffix, adservice.google.com, reject
# Firebase
host-suffix, firebaseinstallations.googleapis.com, reject
# 常见分析 SDK
host-suffix, app-measurement.com, reject
host-suffix, analytics.google.com, reject
host-suffix, crashlytics.googleapis.com, reject
host-suffix, segment.io, reject
host-suffix, amplitude.com, reject
host-suffix, mixpanel.com, reject
host-suffix, branch.io, reject
host-suffix, adjust.com, reject
host-suffix, appsflyer.com, reject
host-suffix, kochava.com, reject
host-suffix, sentry.io, reject

geoip, cn, direct
final, Final

[rewrite_remote]
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rewrite/QuantumultX/AllInOne/AllInOne.conf, tag=全能去广告(基础), update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/FakeiOSAds.conf, tag=开屏广告通杀, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/KeepAds.conf, tag=墨鱼 App去广告, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/WeiboAds.conf, tag=微博净化, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/WeChat.conf, tag=微信去广告, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/NeteaseAds.conf, tag=网易云音乐净化, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/AmapAds.conf, tag=高德地图去广告, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/TieBaAds.conf, tag=百度贴吧净化, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/GoofishAds.conf, tag=闲鱼去广告, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/SmzdmAds.conf, tag=什么值得买净化, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/BiliBiliComicsAds.conf, tag=Bilibili漫画净化, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/app2smile/rules/master/module/bilibili-qx.conf, tag=Bilibili去广告, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/QiShuiMusicAds.conf, tag=汽水音乐净化, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/RedditAds.conf, tag=Reddit去广告, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/CainiaoAds.conf, tag=菜鸟裹裹净化, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/TaoPiaoPiaoAds.conf, tag=淘票票净化, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/CaiYunAds.conf, tag=彩云天气净化, update-interval=86400, opt-parser=true, enabled=true
https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/Applet.conf, tag=微信小程序去广告, update-interval=86400, opt-parser=true, enabled=true
https://ws.wenn.in/main/QX/apple/WeatherKit.conf, tag=🍎天气增强, update-interval=86400, enabled=true
https://ws.wenn.in/main/QX/apple/Maps.conf, tag=🍎地图增强, update-interval=86400, enabled=true
https://ws.wenn.in/main/QX/apple/News.conf, tag=🍎News解锁, update-interval=86400, enabled=true
https://ws.wenn.in/main/QX/apple/Siri.conf, tag=🍎Siri增强, update-interval=86400, enabled=true
https://ws.wenn.in/main/QX/apple/TestFlight.conf, tag=🍎TestFlight增强, update-interval=86400, enabled=true

[rewrite_local]
^https?:\/\/119\.29\.29\.29\/d url reject-200
^https?:\/\/203\.107\.1\.1\/d url reject-200
^https?:\/\/223\.5\.5\.5\/d url reject-200
^https?:\/\/1\.12\.12\.12\/d url reject-200
^https?:\/\/120\.53\.53\.53\/d url reject-200

# Qidian Rewrite
^https?:\/\/ii\.gdt\.qq\.com\/gdt_inner_view url script-response-body https://ws.wenn.in/main/Scripts/Qidian.js
^https?:\/\/api-access\.pangolin-sdk-toutiao\d*\.com\/api\/ad\/union\/sdk\/get_ads url script-response-body https://ws.wenn.in/main/Scripts/Qidian.js
^https?:\/\/(adsmind\.gdtimg\.com|adsmind\.ugdtimg\.com|pgdt\.gtimg\.cn)\/.*\.mp4 url script-response-body https://ws.wenn.in/main/Scripts/Qidian.js
^https:\/\/(h5|magev6)\.if\.qidian\.com\/argus\/api\/v\d+\/video\/adv\/finishWatch url script-request-body https://ws.wenn.in/main/Scripts/Qidian.js
^https:\/\/magev6\.if\.qidian\.com\/argus\/api\/v\d+\/(client\/getconf|checkin\/checkin|checkin\/simpleinfo) url script-request-header https://ws.wenn.in/main/Scripts/Qidian.js
^https:\/\/(h5|magev6)\.if\.qidian\.com\/argus\/api\/v1\/client\/getconf url script-response-body https://ws.wenn.in/main/Scripts/Qidian.js
^https:\/\/(h5|magev6)\.if\.qidian\.com\/argus\/api\/(v\d+\/video\/adv\/mainPage(?!Dialog)|v\d+\/video\/adv\/mainPageDialog|v\d+\/video\/adv\/reportDialog|v\d+\/adv\/getadvlistbatch|v\d+\/deeplink\/geturl|v\d+\/dailyrecommend|v\d+\/checkin\/(lottery|checkinexchangepage)|v\d+\/user\/getsimplediscover|v\d+\/bookshelf\/(getHoverAdv|getTopOperation|getad)|v\d+\/client\/iosad|v\d+\/push\/getdialog|v\d+\/booksearch\/hotWords|v\d+\/maintain\/playstrip|v\d+\/young\/getconf|v\d+\/freshman\/(bookshelfbtn|freshmanGuidePopup)|v\d+\/message\/(getpushedmessagelist|pullOperationPush|pullSocialPush)|v\d+\/followsubscribe\/showChapterEndModule|v\d+\/user\/getaccountpage|v\d+\/client\/getsplashscreen|v\d+\/reddot\/getdot|v\d+\/popup\/batchget|v\d+\/ploy\/getactivitylist|v\d+\/interaction\/getclassicbookinfo|v\d+\/readtime\/readpage) url script-response-body https://ws.wenn.in/main/Scripts/Qidian.js
^https?:\/\/h5\.if\.qidian\.com\/argus\/api\/v1\/user\/getlogininfo url script-response-body https://ws.wenn.in/main/Scripts/Qidian.js

# Zhihuifangdong
^https?:\/\/api\.zhihuifangdong\.net\/core\/app\/activity\/appOpenAds url script-response-body https://ws.wenn.in/main/Scripts/Zhihuifangdong.js
^https?:\/\/api\.zhihuifangdong\.net\/core\/app\/activity\/bannerPicMore url script-response-body https://ws.wenn.in/main/Scripts/Zhihuifangdong.js

# YouTube
^https?:\/\/[\w-]+\.googlevideo\.com\/initplayback.+&ack url script-request-body https://ws.wenn.in/main/Mirror/youtube.request.js
^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/log_event url script-request-body https://ws.wenn.in/main/Mirror/youtube.request.js
^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(browse|next|player|search|reel\/reel_watch_sequence|guide|account\/get_setting|get_watch|log_event|config) url script-response-body https://ws.wenn.in/main/Mirror/youtube.response.js
(^https?:\/\/[\w-]+\.googlevideo\.com\/(?!dclk_video_ads).+?)&ctier=L(&.+?),ctier,(.+) url 302 $1$2$3
^https?:\/\/[\w-]+\.googlevideo\.com\/initplayback.+&oad url reject-200

# JD
^https?:\/\/api\.m\.jd\.com\/client\.action\?functionId=(searchBoxWord|stationPullService|uniformRecommend[06]) url reject-dict

# Zhihu
^https:\/\/api\.zhihu\.com\/commercial_api\/(answer\/banners|banners|launch) url reject-dict
^https:\/\/api\.zhihu\.com\/content-distribution-core url reject-dict
^https:\/\/api\.zhihu\.com\/moments\/drama url reject-dict
^https:\/\/api\.zhihu\.com\/root\/window url reject-dict
^https:\/\/api\.zhihu\.com\/bazaar\/float_window url reject-dict
^https:\/\/api\.zhihu\.com\/market\/popovers_v2 url reject-dict
^https:\/\/api\.zhihu\.com\/me\/guides url reject-dict
^https:\/\/api\.zhihu\.com\/unlimited\/go\/my_card url reject
^https:\/\/api\.zhihu\.com\/search\/preset_words url reject-dict
^https:\/\/www\.zhihu\.com\/search\/related_queries url reject-dict
^https:\/\/link\.zhihu\.com\/\?target=(https?)?(%3A|:)?(\/\/|%2F%2F)?(.*?)(&source.*)?$ url 302 http://$4
^https:\/\/api\.zhihu\.com\/ab\/api url reject-dict
http-response ^https:\/\/api\.zhihu\.com\/(commercial_api\/answer\/banners|commercial_api\/banners|content-distribution-core|moments\/drama|root\/window|prague\/related_suggestion|v5\.1\/topics\/answer\/relation|hot_recommendation|mcn\/v2\/linkcards|distribute\/rhea|answers\/questions\/related-readings|commercial_api\/mobile_banner|zhuanlan\/api\/articles|ab\/api|ad-style-service) url script-response-body https://ws.wenn.in/main/Scripts/Zhihu.js
http-response ^https:\/\/api\.zhihu\.com\/search\/preset_words url script-response-body https://ws.wenn.in/main/Scripts/Zhihu.js

[task_local]
0 9 * * * https://ws.wenn.in/main/Scripts/Qidian.js, tag=起点全自动签到, img-url=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Daily.png, enabled=true, argument=debug=false&QDREADER_ADV_JOB_ENABLE=true&QDREADER_EXTRA_ADV_JOB_ENABLE=true&QDREADER_LOTTERY_ENABLE=true&QDREADER_WEEKLY_EXCHANGE_ENABLE=true&QDREADER_CHAPTER_CARD_ENABLE=true&QDREADER_MESSAGE_BOX_ENABLE=true
event-interaction https://raw.githubusercontent.com/KOP-XIAO/QuantumultX/master/Scripts/geo_location.js, tag=查看IP信息, img-url=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Area.png, enabled=true
event-interaction https://raw.githubusercontent.com/KOP-XIAO/QuantumultX/master/Scripts/traffic-check.js, tag=策略流量查询, img-url=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Speedtest.png, enabled=true
event-interaction https://raw.githubusercontent.com/KOP-XIAO/QuantumultX/master/Scripts/streaming-ui-check.js, tag=流媒体解锁检测, img-url=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Streaming.png, enabled=true

[mitm]
skip_validating_cert=false
force_sni_domain_name=false
skip_dst_ip = 192.168.0.0/16, 10.0.0.0/8, 100.64.0.0/10, 169.254.0.0/16, 172.16.0.0/12, 127.0.0.1/32, 224.0.0.0/4
hostname = -*.apple.com, -*.icloud.com, -*.icloud.com.cn, -*.95516.com, -*.cup.com.cn, -*.95516.com.cn, -*.unionpay.com, -*.icbc.com.cn, -*.mybank.icbc.com.cn, -*.icbc.com, -*.ccb.com, -*.ccb.cn, -*.boc.cn, -*.bankofchina.com, -*.jf365.boc.cn, -*.abchina.com, -*.abchina.com.cn, -*.cdn-static.abchina.com.cn, -*.cdn-static.abchina.com, -*.bankcomm.com, -*.bankcomm.cn, -*.creditcard.bankcomm.com, -*.creditcard.bankcomm.cn, -*.cmbchina.com, -*.cmbimg.com, -*.psbc.com, -*.spdb.com.cn, -*.spdbccc.com.cn, -*.citicbank.com, -*.citibank.com, -*.ecitic.com, -*.pingan.com.cn, -*.pingan.com, -*.hcz-member.pingan.com.cn, -*.iobs.pingan.com.cn, -*.stock.pingan.com, -*.cmbc.com.cn, -*.cib.com.cn, -*.cebbank.com, -*.ebchinabank.com, -*.hxb.com.cn, -*.cgbchina.com.cn, -*.95508.com, -*.static.95508.com, -*.bankofbeijing.com.cn, -*.bosc.cn, -*.js96008.com, -*.tenpay.com, -*.qianbao.qq.com, weatherkit.apple.com, configuration.ls.apple.com, gspe35-ssl.ls.apple.com, gspe35-ssl.ls.apple.cn, news-edge.apple.com, news-todayconfig-edge.apple.com, news-events.apple.com, news-sports-events.apple.com, news-client.apple.com, news-client-search.apple.com, guzzoni.smoot.apple.com, api2.smoot.apple.com, *.smoot.apple.com, *.smoot.apple.cn, testflight.apple.com, boxjs.com, h5.if.qidian.com, magev6.if.qidian.com, ii.gdt.qq.com, adsmind.gdtimg.com, adsmind.ugdtimg.com, pgdt.gtimg.cn, api-access.pangolin-sdk-toutiao.com, api-access.pangolin-sdk-toutiao1.com, api.zhihuifangdong.net, netflow-mtop.cainiao.com, nbcps-mtop.cainiao.com, cn-acs.m.cainiao.com, e2e-mtop.cainiao.com, longquan-mtop.cainiao.com, -redirector*.googlevideo.com, *.googlevideo.com, *.youtube.com, youtubei.googleapis.com, api.m.jd.com, api.zhihu.com, www.zhihu.com, appcloud2.zhihu.com, link.zhihu.com, zhuanlan.zhihu.com, amdc.m.taobao.com, m5.amap.com, m5-zb.amap.com, m-cloud.zhihu.com, tiebac.baidu.com, tieba.baidu.com, tiebaapi.baidu.com, gql.reddit.com, gql-fed.reddit.com
