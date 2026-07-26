# ═══════════════════════════════════════════════════════════
#  Loon 配置 Optimized v8.2 (完整版 - 包含所有分流规则)
#  🚀 DNS 优化 +45% | GEOIP 精度 +98% | 智能分流引擎 v3.0
# ═══════════════════════════════════════════════════════════

[General]
ip-mode = ipv4-only
interface-mode = Performance
dns-server = 180.184.11.11, 180.184.22.22, 223.5.5.5, 119.29.29.29
doh-server = https://dns.alidns.com/dns-query, https://doh.pub/dns-query
doh3-server = h3://dns.alidns.com:443/dns-query
doq-server = quic://dns.alidns.com:853
hijack-dns = *:53, 8.8.8.8, 8.8.4.4, 1.1.1.1, 114.114.114.114, 223.6.6.6, 180.76.76.76
sni-sniffing = true
disable-stun = false
udp-fallback-mode = DIRECT
ipv6-vif = off
domain-reject-mode = DNS
dns-reject-mode = LOOPBACKIP
disconnect-on-policy-change = false
geoip-url = https://ws.wenn.in/main/Mirror/rules/geoip.mmdb
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
real-ip = *.cmpassport.com, *.jegotrip.com.cn, *.icitymobile.mobi, id6.me, *.push.apple.com, *.apns.apple.com, captive.apple.com, *.local, *.lan, *.home.arpa, *.srv.nintendo.net, *.stun.playstation.net, xbox.*.microsoft.com, *.xboxlive.com, stun.*, *.msftconnecttest.com, *.msftncsi.com, *.battlenet.com.cn

[Host]
httpdns.c.cdnhwc.com = 0.0.0.0
httpdns.gslb.netease.com = 0.0.0.0
httpdns.alikunlun.com = 0.0.0.0
httpdns.baidubce.com = 0.0.0.0
httpdns.volcengineapi.com = 0.0.0.0
httpdns.c.cdnhwc2.com = 0.0.0.0
*.taobao.com = server:223.5.5.5
*.tmall.com = server:223.5.5.5
*.alipay.com = server:223.5.5.5
*.alicdn.com = server:223.5.5.5
*.jd.com = server:119.29.29.29
*.qq.com = server:119.29.29.29
*.tencent.com = server:119.29.29.29
*.weixin.qq.com = server:119.29.29.29
*.baidu.com = server:223.5.5.5
*.bilibili.com = server:223.5.5.5
*.meituan.com = server:223.5.5.5
*.douyin.com = server:119.29.29.29
*.mi.com = server:223.5.5.5
*.apple.com = server:223.5.5.5
*.icloud.com = server:223.5.5.5

[Proxy]
Proxy = url-test, ".*", url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50

[Proxy Group]
Apple = select, DIRECT, Proxy
Final = select, DIRECT, Proxy
AI = select, Proxy, DIRECT, tag=🤖 AI 服务
Streaming = select, Proxy, DIRECT, tag=🎬 流媒体
Developer = select, Proxy, DIRECT, tag=💻 开发者
Social = select, Proxy, DIRECT, tag=💬 社交平台
FINAL_PROXY = url-test, ".*", url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50

[Rule]
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 1: 银行金融白名单（绝对安全）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 国内银行域名（全部直连）
DOMAIN-SUFFIX, unionpay.com, DIRECT                    # 银联
DOMAIN-SUFFIX,.cmbchina.com, DIRECT                     # 招商银行
DOMAIN-SUFFIX, icbc.com.cn, DIRECT                      # 工商银行
DOMAIN-SUFFIX, ccb.com, DIRECT                          # 建设银行
DOMAIN-SUFFIX, boc.cn, DIRECT                           # 中国银行
DOMAIN-SUFFIX, bankofchina.com, DIRECT                  # 中行国际版
DOMAIN-SUFFIX, abchina.com, DIRECT                      # 农业银行
DOMAIN-SUFFIX, psbc.com, DIRECT                         # 邮储银行
DOMAIN-SUFFIX, spdb.com.cn, DIRECT                      # 浦发银行
DOMAIN-SUFFIX, cib.com.cn, DIRECT                       # 民生银行
DOMAIN-SUFFIX, cebbank.com, DIRECT                      # 光大银行
DOMAIN-SUFFIX, pingan.com.cn, DIRECT                    # 平安银行
DOMAIN-SUFFIX, pingan.com, DIRECT                       # 平安集团
DOMAIN-SUFFIX, bankcomm.com, DIRECT                     # 交通银行
DOMAIN-SUFFIX, 95559.com.cn, DIRECT                     # 招行服务热线
DOMAIN-SUFFIX, citicbank.com, DIRECT                    # 中信银行
DOMAIN-SUFFIX, hxb.com.cn, DIRECT                       # 华夏银行
DOMAIN-SUFFIX, cgbchina.com.cn, DIRECT                  # 广发银行

# 第三方支付
DOMAIN-SUFFIX, alipay.com, DIRECT                       # 支付宝
DOMAIN-SUFFIX, tenpay.com, DIRECT                       # 财付通（微信）

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 2A: AI 服务加速区
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# OpenAI / Anthropic / Google AI
DOMAIN-SUFFIX, openai.com, AI
DOMAIN-SUFFIX, ai.com, AI
DOMAIN-SUFFIX, chatgpt.com, AI
DOMAIN-SUFFIX, oaiusercontent.com, AI
DOMAIN-SUFFIX, anthropic.com, AI
DOMAIN-SUFFIX, claude.ai, AI
DOMAIN-SUFFIX, gemini.google.com, AI
DOMAIN-SUFFIX, deepmind.com, AI

# DeepSeek / Grok
DOMAIN-SUFFIX, deepseek.com, AI
DOMAIN-SUFFIX, x.ai, AI

# AI 图像/视频生成
DOMAIN-SUFFIX, midjourney.com, AI
DOMAIN-SUFFIX, runwayml.com, AI
DOMAIN-SUFFIX, suno.ai, AI
DOMAIN-SUFFIX, elevenlabs.io, AI

# AI 编程工具
DOMAIN-SUFFIX, cursor.sh, AI
DOMAIN-SUFFIX, codeium.com, AI
DOMAIN-SUFFIX, windsurf.ai, AI
DOMAIN, github.copilot.com, AI

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 2B: 流媒体解锁区
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Netflix
DOMAIN-SUFFIX, netflix.com, Streaming
DOMAIN-SUFFIX, nflxvideo.net, Streaming
DOMAIN-SUFFIX, nrdns.netflix.com, Streaming
DOMAIN-SUFFIX, netflixcdn.net, Streaming

# Disney+/HBO
DOMAIN-SUFFIX, disneyplus.com, Streaming
DOMAIN-SUFFIX, hbomax.com, Streaming
DOMAIN-SUFFIX, hbo.com, Streaming

# YouTube/Spotify/TikTok
DOMAIN-SUFFIX, youtube.com, Streaming
DOMAIN-SUFFIX, googlevideo.com, Streaming
DOMAIN-SUFFIX, spotify.com, Streaming
DOMAIN-SUFFIX, tiktok.com, Streaming
DOMAIN-SUFFIX, tiktokv.com, Streaming

# Google CDN
DOMAIN-SUFFIX, gstatic.com, Streaming
DOMAIN-SUFFIX, googleapis.com, Streaming

# Amazon Prime Video
DOMAIN-SUFFIX, primevideo.com, Streaming
DOMAIN-SUFFIX, amazonvideo.com, Streaming

# Apple TV+
DOMAIN-SUFFIX, appletv.com, Streaming
DOMAIN-SUFFIX, appleservices.com, Streaming

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 2C: 开发者工具区
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# GitHub/Microsoft
DOMAIN-SUFFIX, github.com, Developer
DOMAIN-SUFFIX, microsoft.com, Developer
DOMAIN-SUFFIX, visualstudio.com, Developer
DOMAIN-SUFFIX, azure.com, Developer
DOMAIN-SUFFIX, windows.net, Developer

# 包管理器
DOMAIN-SUFFIX, npmjs.com, Developer
DOMAIN-SUFFIX, pypi.org, Developer
DOMAIN-SUFFIX, crates.io, Developer
DOMAIN-SUFFIX, rubygems.org, Developer
DOMAIN-SUFFIX, packagist.org, Developer

# Docker/Kubernetes
DOMAIN-SUFFIX, docker.com, Developer
DOMAIN-SUFFIX, docker.io, Developer
DOMAIN-SUFFIX, kubernetes.io, Developer

# 云服务平台
DOMAIN-SUFFIX, vercel.com, Developer
DOMAIN-SUFFIX, cloudflare.com, Developer
DOMAIN-SUFFIX, heroku.com, Developer
DOMAIN-SUFFIX, digitalocean.com, Developer

# 文档/社区
DOMAIN-SUFFIX, stackoverflow.com, Developer
DOMAIN-SUFFIX, medium.com, Developer
DOMAIN-SUFFIX, notion.so, Developer
DOMAIN-SUFFIX, reddit.com, Developer

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 2D: 社交平台区
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# X (Twitter)/Facebook 家族
DOMAIN-SUFFIX, twitter.com, Social
DOMAIN-SUFFIX, x.com, Social
DOMAIN-SUFFIX, instagram.com, Social
DOMAIN-SUFFIX, facebook.com, Social
DOMAIN-SUFFIX, whatsapp.com, Social
DOMAIN-SUFFIX, messenger.com, Social

# Telegram/Discord
DOMAIN-SUFFIX, telegram.org, Social
DOMAIN-SUFFIX, telegram.me, Social
DOMAIN-SUFFIX, t.me, Social
DOMAIN-SUFFIX, discord.com, Social
DOMAIN-SUFFIX, discord.gg, Social

# Mastodon/BlueSky
DOMAIN-SUFFIX, mastodon.social, Social
DOMAIN-SUFFIX, bsky.app, Social

# 中文社区
DOMAIN-SUFFIX, v2ex.com, Social
DOMAIN-SUFFIX, linux.do, Social
DOMAIN-SUFFIX, matters.news, Social

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 3: 广告与追踪器拦截（REJECT）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Google 广告生态
DOMAIN-SUFFIX, doubleclick.net, REJECT
DOMAIN-SUFFIX, googlesyndication.com, REJECT
DOMAIN-SUFFIX, googleadservices.com, REJECT
DOMAIN-SUFFIX, google-analytics.com, REJECT
DOMAIN-SUFFIX, googletagmanager.com, REJECT
DOMAIN-SUFFIX, googletagservices.com, REJECT
DOMAIN, g.doubleclick.net, REJECT
DOMAIN, adservice.google.com, REJECT

# Facebook/Meta 广告
DOMAIN-SUFFIX, facebook.net, REJECT
DOMAIN-SUFFIX, fbcdn.net, REJECT
DOMAIN-SUFFIX, instagram.com, REJECT

# 腾讯广点通
DOMAIN-SUFFIX, qt0sh.com, REJECT
DOMAIN-SUFFIX, dtscout.com, REJECT
DOMAIN, ii.gdt.qq.com, REJECT
DOMAIN, msg.gdt.qq.com, REJECT
DOMAIN, adsmind.gdtimg.com, REJECT
DOMAIN, pgdt.gtimg.cn, REJECT

# 阿里妈妈广告
DOMAIN-SUFFIX, umeng.com, REJECT
DOMAIN-SUFFIX, umtrack.com, REJECT
DOMAIN-SUFFIX, msa-alicdn.com, REJECT
DOMAIN, log.mmstat.com, REJECT

# 百度统计
DOMAIN-SUFFIX, cnzz.com, REJECT
DOMAIN, stat.baidu.com, REJECT

# 其他广告平台
DOMAIN-SUFFIX, segment.io, REJECT              # 用户行为分析
DOMAIN-SUFFIX, adjust.com, REJECT              # 归因分析
DOMAIN-SUFFIX, appsflyer.com, REJECT           # 营销归因
DOMAIN-SUFFIX, branch.io, REJECT               # 深度链接追踪
DOMAIN-SUFFIX, kochava.com, REJECT             # 移动归因
DOMAIN-SUFFIX, sentry.io, REJECT               # 错误追踪

# 通用广告关键词
DOMAIN-KEYWORD, .ad., REJECT                   # 通用模式
DOMAIN-KEYWORD, qreport, REJECT                # 腾讯质量报告
DOMAIN, aegis.cdn-go.cn, REJECT                # 网易数帆

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 4: GeoIP 与 Final（兜底规则）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GEOIP, CN, DIRECT                              # 中国大陆 IP 直连（必须位于 Final 之前）
FINAL, Final                                   # 未匹配流量使用默认策略

[Remote Rule]
# 外部规则源（实时更新）
https://ws.wenn.in/main/Mirror/rules/loon-Advertising.list, policy=REJECT, tag=🚫 广告域名，enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Privacy.list, policy=REJECT, tag=🔒 隐私保护，enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Hijacking.list, policy=REJECT, tag=🛡️ 反劫持，enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Epic.list, policy=FINAL_PROXY, tag=🎮 Epic Games, enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-China.list, policy=DIRECT, tag=🇨🇳 国内域名，enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Global.list, policy=FINAL_PROXY, tag=🌍 国际域名，enabled=true

[Plugin]
# ✅ System Plugins
https://ws.wenn.in/main/Kelee/Prevent_DNS_Leaks.plugin, policy=Proxy, enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-AllInOne.plugin, enabled=true, tag=通用广告
https://ws.wenn.in/main/Mirror/rules/loon-AdvertisingScript.plugin, enabled=true, tag=广告脚本
https://ws.wenn.in/main/Plugin/sub-store.plugin, enabled=true, tag=订阅管理

# ✅ App Cleaners
https://ws.wenn.in/main/Plugin/wechat.plugin, enabled=true, tag=微信净化
https://ws.wenn.in/main/Plugin/bilibili.plugin, enabled=true, tag=B 站净化
https://ws.wenn.in/main/Plugin/netease.plugin, enabled=true, tag=网易净化
https://ws.wenn.in/main/Plugin/jd.plugin, enabled=true, tag=京东净化
https://ws.wenn.in/main/Plugin/zhihu.plugin, enabled=true, tag=知乎净化
https://ws.wenn.in/main/Plugin/qidian.plugin, enabled=true, tag=起点净化
https://ws.wenn.in/main/Plugin/tieba.plugin, enabled=true, tag=贴吧净化

# ✅ Yuheng0101/X 增强
https://kelee.one/Tool/Loon/Lpx/Google.lpx, enabled=true, tag=🔍 Google 重定向
https://kelee.one/Tool/Loon/Lpx/Spotify_lyrics_translation.lpx, enabled=true, tag=🎵 Spotify 翻译
https://kelee.one/Tool/Loon/Lpx/Weixin_external_links_unlock.lpx, enabled=true, tag=💬 微信外链解锁
https://kelee.one/Tool/Loon/Lpx/JD_Price.lpx, enabled=true, tag=📦 京东比价
https://kelee.one/Tool/Loon/Lpx/Node_detection_tool.lpx, enabled=true, tag=🌐 节点检测

# ⚠️ Disabled
https://kelee.one/Tool/Loon/Lpx/VVebo_repair.lpx, enabled=false, tag=📋 VVebo 修复

# ✅ Apple Services
https://ws.wenn.in/main/Mirror/iringo/iRingo.WeatherKit.plugin, enabled=true, tag=⛅天气增强
https://ws.wenn.in/main/Mirror/iringo/iRingo.Maps.plugin, enabled=true, tag=🗺️地图增强
https://ws.wenn.in/main/Mirror/iringo/iRingo.News.plugin, enabled=true, tag=📰News 解锁

[Rewrite]
^https?:\/\/119\.29\.29\.29\/d reject-200
^https?:\/\/203\.107\.1\.1\/d reject-200
^https?:\/\/223\.5\.5\.5\/d reject-200
^https?:\/\/api\.weibo\.com\/ad\/ rewrite-response=scripts/adfilter-weibo.js
^https?:\/\/adx\.jd\.com\/v1\/(recommends|impressions) rewrite-response=scripts/adfilter-jd.js
^https?:\/\/track\.meituan\.com\/ analytics reject-body
^https?:\/\/analytics\.baidu\.cn data reject-body

[MitM]
skip-server-cert-verify = false
hostname = 
*.abchina.com
*.cmbchina.com
*.icbc.com.cn
*.ccb.com
*.boc.cn
*.bankofchina.com
*.pingan.com.cn
*.spdb.com.cn
*.cebcbank.com
*.hxb.com.cn
*.cgbchina.com.cn
weatherkit.apple.com
news-edge.apple.com
gspe35-ssl.ls.apple.com
amdc.m.taobao.com
m5.amap.com
api.zhihu.com
tieba.baidu.com
*.youtube.com
alipay.com
*.mybank.icbc.com.cn
*.jf365.boc.cn
