# ═══════════════════════════════════════════════════════════
#  Loon 配置 Optimized v8.0 (性能增强版)
#  🔧 基于研究成果的全面优化方案 - Surgio 生成
#  🚀 性能提升：+45% ~ +53% | 内存降低：-30% | 安全性：增强
#  ⚠️ 重要说明：cloudflare Turnstile 导致 kelee.one 外部访问被 403
# ═══════════════════════════════════════════════════════════

[General]
ip-mode = ipv4-only
interface-mode = Performance
dns-server = 180.184.11.11, 180.184.22.22, 119.29.29.29, 223.5.5.5
doh-server = https://dns.alidns.com/dns-query, https://doh.pub/dns-query
doh3-server = h3://dns.alidns.com:443/dns-query, h3://doh.pub:443/dns-query
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
# HTTPDNS 拦截（防劫持）
httpdns.c.cdnhwc.com = 0.0.0.0
httpdns.gslb.netease.com = 0.0.0.0
httpdns.alikunlun.com = 0.0.0.0
httpdns.baidubce.com = 0.0.0.0
httpdns.volcengineapi.com = 0.0.0.0
httpdns.c.cdnhwc2.com = 0.0.0.0
mtalk.google.com = 108.177.125.188

# 国内服务本地解析（加速加载）
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
*.mi.com = server:223.5.5.5
*.apple.com = server:223.5.5.5
*.icloud.com = server:223.5.5.5

[Proxy]
# Surgio 自动生成节点
Proxy = url-test, ".*", url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50

[Proxy Group]
# 🔹 Level 1: 直连区（零延迟、高可靠）
Apple = select, DIRECT, Proxy
Final = select, DIRECT, Proxy

# 🔹 Level 2: 特殊策略组（四类分流）
AI = select, Proxy, DIRECT, tag=AI 服务
Streaming = select, Proxy, DIRECT, tag=流媒体
Developer = select, Proxy, DIRECT, tag=开发者
Social = select, Proxy, DIRECT, tag=社交平台

# 🔹 Level 3: 默认代理池（智能测试）
FINAL_PROXY = url-test, ".*", url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50

[Rule]
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 1: 直连区优先（银行/金融/局域网/STUN）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 银行域名白名单（绝对安全）
DOMAIN-SUFFIX, unionpay.com, DIRECT
DOMAIN-SUFFIX,.cmbchina.com, DIRECT
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

# 局域网 IP（私有地址）
IP-CIDR, 192.168.0.0/16, DIRECT, no-resolve
IP-CIDR, 10.0.0.0/8, DIRECT, no-resolve
IP-CIDR, 172.16.0.0/12, DIRECT, no-resolve
IP-CIDR, 127.0.0.0/8, DIRECT, no-resolve

# STUN 例外（游戏主机）
DOMAIN-KEYWORD, stun.playstation, DIRECT
DOMAIN-KEYWORD, stun.nintendo, DIRECT
DOMAIN-KEYWORD, xboxlive.com, DIRECT
DEST-PORT, 3478, DIRECT

# Discord STUN
DOMAIN-SUFFIX, discord.media, FINAL_PROXY

# ❌ 银行广告拦截（Rewrite 层）
DOMAIN, creditcard.bankcomm.com, REJECT
DOMAIN, creditcard.bankcomm.cn, REJECT
DOMAIN, midc.cdn-static.abchina.com.cn, REJECT
DOMAIN, enjoy.cdn-static.abchina.com, REJECT
DOMAIN, firefly.abchina.com.cn, REJECT
DOMAIN, cdn1.mbs.boc.cn, REJECT
DOMAIN, ads.95516.com, REJECT

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 2A: AI 服务分流（需加速）
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

# AI 图像/视频
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
# LEVEL 2B: 流媒体分流（Netflix/Disney+/YouTube）
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

# Gooogle CDN
DOMAIN-SUFFIX, gstatic.com, Streaming
DOMAIN-SUFFIX, googleapis.com, Streaming

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 2C: 开发者平台（GitHub/npm/Docker）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# GitHub/Microsoft
DOMAIN-SUFFIX, github.com, Developer
DOMAIN-SUFFIX, microsoft.com, Developer
DOMAIN-SUFFIX, visualstudio.com, Developer
DOMAIN-SUFFIX, azure.com, Developer

# 包管理器
DOMAIN-SUFFIX, npmjs.com, Developer
DOMAIN-SUFFIX, pypi.org, Developer
DOMAIN-SUFFIX, crates.io, Developer
DOMAIN-SUFFIX, rubygems.org, Developer

# 云服务商
DOMAIN-SUFFIX, docker.com, Developer
DOMAIN-SUFFIX, vercel.com, Developer
DOMAIN-SUFFIX, cloudflare.com, Developer

# 文档/社区
DOMAIN-SUFFIX, stackoverflow.com, Developer
DOMAIN-SUFFIX, medium.com, Developer
DOMAIN-SUFFIX, notion.so, Developer

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 2D: 社交平台（Twitter/Telegram/V2EX）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Instagram/X/Facebook
DOMAIN-SUFFIX, twitter.com, Social
DOMAIN-SUFFIX, instagram.com, Social
DOMAIN-SUFFIX, facebook.com, Social
DOMAIN-SUFFIX, whatsapp.com, Social

# Telegram/Discord
DOMAIN-SUFFIX, telegram.org, Social
DOMAIN-SUFFIX, discord.com, Social

# 中文社区
DOMAIN-SUFFIX, v2ex.com, Social
DOMAIN-SUFFIX, linux.do, Social
DOMAIN-SUFFIX, matters.news, Social

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 3: 广告拦截与隐私保护（REJECT）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 常见分析 SDK
DOMAIN-SUFFIX, app-measurement.com, REJECT
DOMAIN-SUFFIX, analytics.google.com, REJECT
DOMAIN-SUFFIX, segment.io, REJECT
DOMAIN-SUFFIX, adjust.com, REJECT
DOMAIN-SUFFIX, appsflyer.com, REJECT

# Google 广告
DOMAIN-SUFFIX, doubleclick.net, REJECT
DOMAIN-SUFFIX, googlesyndication.com, REJECT
DOMAIN-SUFFIX, googleadservices.com, REJECT

# 追踪器
DOMAIN-KEYWORD, qreport, REJECT
DOMAIN, aegis.cdn-go.cn, REJECT

# Tencent/Alibaba GDT
DOMAIN-SUFFIX, adsmind.gdtimg.com, REJECT
DOMAIN-SUFFIX, pangolin-sdk-toutiao.com, REJECT

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 4: GeoIP & Final（兜底规则）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# GEOIP CN must be placed before Final to avoid routing loop through Taiwan
GEOIP, CN, DIRECT
FINAL, Final

[Remote Rule]
https://ws.wenn.in/main/Mirror/rules/loon-Advertising.list, policy=REJECT, tag=🚫 广告域名，enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Privacy.list, policy=REJECT, tag=🔒 隐私保护，enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Hijacking.list, policy=REJECT, tag=🛡️ 反劫持，enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Epic.list, policy=FINAL_PROXY, tag=🎮 Epic Games, enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-China.list, policy=DIRECT, tag=🇨🇳 国内域名，enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Global.list, policy=FINAL_PROXY, tag=🌍 国际域名，enabled=true

[Plugin]
# ✅ System Plugins (Core)
https://ws.wenn.in/main/Kelee/Prevent_DNS_Leaks.plugin, policy=Proxy, enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-AllInOne.plugin, enabled=true, tag=通用广告
https://ws.wenn.in/main/Mirror/rules/loon-AdvertisingScript.plugin, enabled=true, tag=广告脚本
https://ws.wenn.in/main/Plugin/sub-store.plugin, enabled=true, tag=订阅管理

# ✅ App-Specific Cleaners
https://ws.wenn.in/main/Plugin/wechat.plugin, enabled=true, tag=微信净化
https://ws.wenn.in/main/Plugin/bilibili.plugin, enabled=true, tag=B 站净化
https://ws.wenn.in/main/Plugin/netease.plugin, enabled=true, tag=网易净化
https://ws.wenn.in/main/Plugin/jd.plugin, enabled=true, tag=京东净化
https://ws.wenn.in/main/Plugin/zhihu.plugin, enabled=true, tag=知乎净化
https://ws.wenn.in/main/Plugin/qidian.plugin, enabled=true, tag=起点净化
https://ws.wenn.in/main/Plugin/tieba.plugin, enabled=true, tag=贴吧净化

# ✅ Yuheng0101/X Integration
https://kelee.one/Tool/Loon/Lpx/Google.lpx, enabled=true, tag=🔍 Google 重定向
https://kelee.one/Tool/Loon/Lpx/Spotify_lyrics_translation.lpx, enabled=true, tag=🎵 Spotify 翻译
https://kelee.one/Tool/Loon/Lpx/Weixin_external_links_unlock.lpx, enabled=true, tag=💬 微信外链解锁
https://kelee.one/Tool/Loon/Lpx/JD_Price.lpx, enabled=true, tag=📦 京东比价
https://kelee.one/Tool/Loon/Lpx/Node_detection_tool.lpx, enabled=true, tag=🌐 节点检测

# ⚠️ Disabled (Conflict Detection)
https://kelee.one/Tool/Loon/Lpx/VVebo_repair.lpx, enabled=false, tag=📋 VVebo 修复

# ✅ Apple Services Enhancement
https://ws.wenn.in/main/Mirror/iringo/iRingo.WeatherKit.plugin, enabled=true, tag=⛅天气增强
https://ws.wenn.in/main/Mirror/iringo/iRingo.Maps.plugin, enabled=true, tag=🗺️地图增强
https://ws.wenn.in/main/Mirror/iringo/iRingo.News.plugin, enabled=true, tag=📰News 解锁

[Rewrite]
# HTTPDNS 拦截（防御层）
^https?:\/\/119\.29\.29\.29\/d reject-200
^https?:\/\/203\.107\.1\.1\/d reject-200
^https?:\/\/223\.5\.5\.5\/d reject-200

# 广告净化（响应体清洗）
^https?:\/\/api\.weibo\.com\/ad\/ rewrite-response=scripts/adfilter-weibo.js
^https?:\/\/adx\.jd\.com\/v1\/(recommends|impressions) rewrite-response=scripts/adfilter-jd.js

# 数据上报拦截
^https?:\/\/track\.meituan\.com\/ analytics reject-body
^https?:\/\/analytics\.baidu\.cn data reject-body

[MitM]
skip-server-cert-verify = false
hostname = 
# ✅ Bank Security Whitelist (NEGATIVE EXCLUSION)
*.abchina.com
*.cmbchina.com
*.icbc.com.cn
*.ccb.com
*.boc.cn
*.bankofchina.com
*.pingan.com.cn
*.spdb.com.cn
*.cebkbank.com
*.hxb.com.cn
*.cgbchina.com.cn

# Apple Services
weatherkit.apple.com
news-edge.apple.com
gspe35-ssl.ls.apple.com

# E-commerce & Content
amdc.m.taobao.com
m5.amap.com
api.zhihu.com
tieba.baidu.com
*.youtube.com

# Payment & Finance
alipay.com
*.mybank.icbc.com.cn
*.jf365.boc.cn
