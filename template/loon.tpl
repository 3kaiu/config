# ═══════════════════════════════════════════════════════════
#  Loon 配置 (Loon.lcf) — v7.8 (Surgio 生成)
#  核心: 自动健康检测 · 高质量多引擎去广告 · Apple原生增强 · 全球社交/流媒体分流 · 银行 MitM 冲突根治
#  引擎支持: iOS Loon 3.3.9+
# ═══════════════════════════════════════════════════════════

[General]
ip-mode = ipv4-only
interface-mode = Performance
dns-server = 180.184.11.11, 180.184.22.22, 119.29.29.29, 223.5.5.5
doh-server = {{ customParams.doh_primary }}, {{ customParams.doh_fallback }}
doh3-server = {{ customParams.doh3_primary }}, {{ customParams.doh3_fallback }}
doq-server = {{ customParams.doq_server }}
hijack-dns = *:53, 8.8.8.8, 8.8.4.4, 1.1.1.1, 114.114.114.114, 223.6.6.6, 180.76.76.76
sni-sniffing = true
disable-stun = false
udp-fallback-mode = DIRECT
ipv6-vif = off
domain-reject-mode = DNS
dns-reject-mode = LOOPBACKIP
disconnect-on-policy-change = false
geoip-url = https://raw.githubusercontent.com/Loyalsoldier/geoip/release/Country.mmdb
ipasn-url = https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-ASN.mmdb
resource-parser = https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store-parser.loon.min.js
allow-wifi-access = false
wifi-access-http-port = 7222
wifi-access-socks5-port = 6225
test-timeout = 10
internet-test-url = http://cp.cloudflare.com/generate_204
proxy-test-url = http://cp.cloudflare.com/generate_204
skip-proxy = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 255.255.255.255/32, localhost, *.local, *.lan, *.home.arpa
bypass-tun = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 255.255.255.255/32
real-ip = *.cmpassport.com, *.jegotrip.com.cn, *.icitymobile.mobi, id6.me, *.boc.cn, *.abchina.com, *.ccb.com, *.psbc.com, *.cmbchina.com, *.icbc.com.cn, *.bankofchina.com, *.spdb.com.cn, *.cib.com.cn, *.cebbank.com, *.unionpay.com, *.pingan.com.cn, *.pingan.com, *.bankcomm.com, *.citicbank.com, *.hxb.com.cn, *.cgbchina.com.cn, *.local, *.lan, *.home.arpa, *.srv.nintendo.net, *.stun.playstation.net, xbox.*.microsoft.com, *.xboxlive.com, stun.*, *.msftconnecttest.com, *.msftncsi.com, *.battlenet.com.cn

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
mtalk.google.com = 108.177.125.188

[Proxy]
# Surgio 自动生成节点: npx surgio generate
# 通过 SURGIO_SUBSCRIPTION_URL (机场订阅) 或 Secrets (HY2_HOST 等) 传入

[Proxy Group]
Proxy = url-test, ".*", url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50
Apple = select, DIRECT, Proxy
Final = select, DIRECT, Proxy

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

# Google 全家桶
DOMAIN-SUFFIX, googleusercontent.com, Proxy
DOMAIN-SUFFIX, ggpht.com, Proxy
DOMAIN-SUFFIX, withgoogle.com, Proxy
DOMAIN, g.co, Proxy

# GDT 广告 SDK 白名单
DOMAIN, mi.gdt.qq.com, DIRECT
DOMAIN, ii.gdt.qq.com, DIRECT
DOMAIN, c.gdt.qq.com, DIRECT
DOMAIN-SUFFIX, pangolin-sdk-toutiao.com, DIRECT
DOMAIN-SUFFIX, pangle.io, DIRECT

# 淘宝
DOMAIN, heic.alicdn.com, REJECT
DOMAIN-SUFFIX, h-adashx.ut.taobao.com, REJECT

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

GEOIP, CN, DIRECT
FINAL, Final

[Remote Rule]
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Advertising/Advertising.list, policy=REJECT, tag=🚫 广告域名, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Privacy/Privacy.list, policy=REJECT, tag=🔒 隐私保护, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Hijacking/Hijacking.list, policy=REJECT, tag=🛡️ 反劫持, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Epic/Epic.list, policy=Proxy, tag=🎮 Epic Games, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/China/China.list, policy=DIRECT, tag=🇨🇳 国内域名, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Global/Global.list, policy=Proxy, tag=🌍 国际域名, enabled=true

[Plugin]
https://ws.wenn.in/main/Kelee/Prevent_DNS_Leaks.plugin, policy=Proxy, enabled=true
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rewrite/Loon/AllInOne/AllInOne.plugin, enabled=true, tag=通用广告域名层
https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rewrite/Loon/AdvertisingScript/AdvertisingScript.plugin, enabled=true, tag=广告脚本增强
https://raw.githubusercontent.com/ajune0527/vpn_tool/master/Tool/Loon/Plugin/Sub-Store.plugin, enabled=true
https://raw.githubusercontent.com/ajune0527/vpn_tool/master/Tool/Loon/Plugin/QuickSearch.plugin, enabled=true
https://ws.wenn.in/main/Plugin/wechat.plugin, enabled=true, tag=微信&小程序&公众号去广告
https://ws.wenn.in/main/Plugin/bilibili.plugin, enabled=true, tag=B站去广告
https://ws.wenn.in/main/Plugin/bilicomics.plugin, enabled=true, tag=B站漫画去广告
https://ws.wenn.in/main/Plugin/netease.plugin, enabled=true, tag=网易云音乐净化
https://ws.wenn.in/main/Plugin/goofish.plugin, enabled=true, tag=闲鱼去广告
https://ws.wenn.in/main/Plugin/qishui.plugin, enabled=true, tag=汽水音乐净化
https://ws.wenn.in/main/Plugin/taopiaopiao.plugin, enabled=true, tag=淘票票净化
https://ws.wenn.in/main/Plugin/amap.plugin, enabled=true, tag=高德地图去广告
https://ws.wenn.in/main/Plugin/jd.plugin, enabled=true, tag=京东去广告
https://ws.wenn.in/main/Plugin/qqmusic.plugin, enabled=true, tag=QQ音乐去广告
https://ws.wenn.in/main/Plugin/reddit.plugin, enabled=true, tag=Reddit去广告
https://ws.wenn.in/main/Plugin/tieba.plugin, enabled=true, tag=贴吧去广告
https://ws.wenn.in/main/Plugin/zhihu.plugin, enabled=true, tag=知乎去广告
https://ws.wenn.in/main/Plugin/qidian.plugin, enabled=true, tag=起点全能助手 Pro
https://ws.wenn.in/main/Plugin/bank.plugin, enabled=true, tag=银行及云闪付去广告
https://ws.wenn.in/main/Plugin/life.plugin, enabled=true, tag=生活出行去广告
https://ws.wenn.in/main/Plugin/ai.plugin, enabled=true, tag=AI 服务分流
https://ws.wenn.in/main/Plugin/zhihuifangdong.plugin, enabled=true, tag=智慧房东去广告
https://ws.wenn.in/main/Kelee/YouTube_remove_ads.plugin, enabled=true, tag=YouTube去广告
https://github.com/NSRingo/WeatherKit/releases/latest/download/iRingo.WeatherKit.plugin, enabled=true, tag=🍎天气增强
https://github.com/NSRingo/Maps/releases/latest/download/iRingo.Maps.plugin, enabled=true, tag=🍎地图增强
https://github.com/NSRingo/News/releases/latest/download/iRingo.News.plugin, enabled=true, tag=🍎News解锁
https://github.com/NSRingo/Siri/releases/latest/download/iRingo.Siri.plugin, enabled=true, tag=🍎Siri增强
https://github.com/NSRingo/Siri/releases/latest/download/iRingo.Search.plugin, enabled=true, tag=🍎搜索建议增强
https://github.com/NSRingo/TestFlight/releases/latest/download/iRingo.TestFlight.plugin, enabled=true, tag=🍎TestFlight增强

[Rewrite]
^https?:\/\/119\.29\.29\.29\/d reject-200
^https?:\/\/203\.107\.1\.1\/d reject-200
^https?:\/\/223\.5\.5\.5\/d reject-200
^https?:\/\/1\.12\.12\.12\/d reject-200
^https?:\/\/120\.53\.53\.53\/d reject-200

[MitM]
skip-server-cert-verify = false
hostname = -*.apple.com, -*.icloud.com, -*.icloud.com.cn, -*.95516.com, -*.cup.com.cn, -*.95516.com.cn, -*.unionpay.com, -*.icbc.com.cn, -*.mybank.icbc.com.cn, -*.icbc.com, -*.ccb.com, -*.ccb.cn, -*.boc.cn, -*.bankofchina.com, -*.jf365.boc.cn, -*.abchina.com, -*.abchina.com.cn, -*.cdn-static.abchina.com.cn, -*.cdn-static.abchina.com, -*.bankcomm.com, -*.bankcomm.cn, -*.creditcard.bankcomm.com, -*.creditcard.bankcomm.cn, -*.cmbchina.com, -*.cmbimg.com, -*.psbc.com, -*.spdb.com.cn, -*.spdbccc.com.cn, -*.citicbank.com, -*.citibank.com, -*.ecitic.com, -*.pingan.com.cn, -*.pingan.com, -*.hcz-member.pingan.com.cn, -*.iobs.pingan.com.cn, -*.stock.pingan.com, -*.cmbc.com.cn, -*.cib.com.cn, -*.cebbank.com, -*.ebchinabank.com, -*.hxb.com.cn, -*.cgbchina.com.cn, -*.95508.com, -*.static.95508.com, -*.bankofbeijing.com.cn, -*.bosc.cn, -*.js96008.com, -*.tenpay.com, -*.qianbao.qq.com, weatherkit.apple.com, configuration.ls.apple.com, gspe35-ssl.ls.apple.com, gspe35-ssl.ls.apple.cn, news-edge.apple.com, news-todayconfig-edge.apple.com, news-events.apple.com, news-sports-events.apple.com, news-client.apple.com, news-client-search.apple.com, guzzoni.smoot.apple.com, api2.smoot.apple.com, *.smoot.apple.com, *.smoot.apple.cn, testflight.apple.com, boxjs.com, h5.if.qidian.com, magev6.if.qidian.com, ii.gdt.qq.com, adsmind.gdtimg.com, adsmind.ugdtimg.com, pgdt.gtimg.cn, api-access.pangolin-sdk-toutiao.com, api-access.pangolin-sdk-toutiao1.com, api.zhihuifangdong.net, netflow-mtop.cainiao.com, nbcps-mtop.cainiao.com, cn-acs.m.cainiao.com, e2e-mtop.cainiao.com, longquan-mtop.cainiao.com, -redirector*.googlevideo.com, *.googlevideo.com, *.youtube.com, youtubei.googleapis.com, m5.amap.com, m5-zb.amap.com, amdc.m.taobao.com, api.m.jd.com, api.zhihu.com, www.zhihu.com, appcloud2.zhihu.com, link.zhihu.com, zhuanlan.zhihu.com, m-cloud.zhihu.com, tiebac.baidu.com, tieba.baidu.com, tiebaapi.baidu.com, gql.reddit.com, gql-fed.reddit.com
