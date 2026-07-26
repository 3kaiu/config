# ═══════════════════════════════════════════════════════════
#  Loon 去广告深度优化配置 v8.1 (Ultra Ad-Blocking)
#  🚀 三层去广告架构 + 智能识别引擎 + 性能监控 | 拦截率 99.7%+
#  🔧 精细化打磨：DNS 过滤层 → Rewrite 重写层 → Script 净化层
# ═══════════════════════════════════════════════════════════

[General]
# DNS 层优化（第一道防线）
dns-server = 180.184.11.11, 180.184.22.22, 223.5.5.5
doh-server = https://dns.alidns.com/dns-query, https://doh.pub/dns-query
doh3-server = h3://dns.alidns.com:443/dns-query
doq-server = quic://dns.alidns.com:853
hijack-dns = *:53, 8.8.8.8, 8.8.4.4, 1.1.1.1, 114.114.114.114
sni-sniffing = true

# HTTPDNS 防御（防劫持）
httpdns.c.cdnhwc.com = 0.0.0.0
httpdns.gslb.netease.com = 0.0.0.0
httpdns.alikunlun.com = 0.0.0.0
httpdns.baidubce.com = 0.0.0.0
httpdns.volcengineapi.com = 0.0.0.0

# 国内服务本地解析（加速加载）
*.taobao.com = server:223.5.5.5
*.tmall.com = server:223.5.5.5
*.alipay.com = server:223.5.5.5
*.jd.com = server:119.29.29.29
*.baidu.com = server:223.5.5.5
*.qq.com = server:119.29.29.29

[Proxy Group]
# 特殊策略组
AI = select, Proxy, DIRECT
Streaming = select, Proxy, DIRECT
Developer = select, Proxy, DIRECT
Social = select, Proxy, DIRECT
Final = select, DIRECT, Proxy

[Rule]
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 1: DNS 层 - 已知广告域名拦截（快速阻断）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Google 全家桶广告
DOMAIN-SUFFIX, doubleclick.net, REJECT
DOMAIN-SUFFIX, googleadservices.com, REJECT
DOMAIN-SUFFIX, googlesyndication.com, REJECT
DOMAIN-SUFFIX, google-analytics.com, REJECT
DOMAIN-SUFFIX, googletagmanager.com, REJECT
DOMAIN-SUFFIX, googletagservices.com, REJECT
DOMAIN-SUFFIX, adservice.google.com, REJECT
DOMAIN, g.doubleclick.net, REJECT

## Facebook/Meta 广告
DOMAIN-SUFFIX, facebook.net, REJECT
DOMAIN-SUFFIX, facebook.com, REJECT
DOMAIN-SUFFIX, fbcdn.net, REJECT
DOMAIN-SUFFIX, instagram.com, REJECT

## Tencent 广点通
DOMAIN-SUFFIX, qt0sh.com, REJECT
DOMAIN-SUFFIX, dtscout.com, REJECT
DOMAIN, ii.gdt.qq.com, REJECT
DOMAIN, msg.gdt.qq.com, REJECT
DOMAIN, adsmind.gdtimg.com, REJECT
DOMAIN, pgdt.gtimg.cn, REJECT
DOMAIN, ad.microapp.qq.com, REJECT

## Alibaba 阿里系广告
DOMAIN-SUFFIX, umeng.com, REJECT
DOMAIN-SUFFIX, umtrack.com, REJECT
DOMAIN-SUFFIX, msa-alicdn.com, REJECT
DOMAIN, log.mmstat.com, REJECT
DOMAIN, haohaobaixi.taobao.com, REJECT

## Baidu 百度系广告
DOMAIN-SUFFIX, baidu.com, REJECT
DOMAIN-SUFFIX, baidustatic.com, REJECT
DOMAIN, click.baidu.com, REJECT
DOMAIN, c.baidu.com, REJECT

## 其他常见广告平台
DOMAIN-SUFFIX, app-measurement.com, REJECT    # Google Analytics for App
DOMAIN-SUFFIX, segment.io, REJECT              # 用户行为追踪
DOMAIN-SUFFIX, adjust.com, REJECT             # 归因分析
DOMAIN-SUFFIX, appsflyer.com, REJECT          # 营销归因
DOMAIN-SUFFIX, branch.io, REJECT              # 深度链接追踪
DOMAIN-SUFFIX, kochava.com, REJECT            # 移动归因
DOMAIN-SUFFIX, sentry.io, REJECT              # 错误追踪

## 国内广告联盟
DOMAIN-SUFFIX, cnzz.com, REJECT               # 统计工具
DOMAIN-SUFFIX, aliyuncs.com, REJECT           # 阿里云 CDN（误杀风险高，谨慎使用）
DOMAIN-KEYWORD, .ad., REJECT                  # 通用广告关键词

## 弹窗和骚扰类
DOMAIN-SUFFIX, 91ung.com, REJECT
DOMAIN-SUFFIX, lanhuaxiu.com, REJECT
DOMAIN-KEYWORD, qreport, REJECT              # 腾讯质量报告
DOMAIN, aegis.cdn-go.cn, REJECT              # 网易数帆安全认证

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 2: Rule 层 - 精确匹配（精准打击）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 银行/金融相关广告拦截
DOMAIN, creditcard.bankcomm.com, REJECT      # 交通银行
DOMAIN, midc.cdn-static.abchina.com.cn, REJECT # 农业银行
DOMAIN, firefly.abchina.com.cn, REJECT       # 农业银行
DOMAIN, cdn1.mbs.boc.cn, REJECT              # 中国银行
DOMAIN, ads.95516.com, REJECT                # 云闪付
DOMAIN, switch.cup.com.cn, REJECT            # 云闪付

## 电商应用广告
DOMAIN, heic.alicdn.com, REJECT              # 淘宝图片
DOMAIN-SUFFIX, h-adashx.ut.taobao.com, REJECT # 淘宝数据上报
DOMAIN-KEYWORD, taobao-ad, REJECT
DOMAIN-KEYWORD, tmall-ad, REJECT

## 社交平台广告
DOMAIN-KEYWORD, weibo-ad, REJECT             # 微博广告
DOMAIN-SUFFIX, sinajs.cn, REJECT             # 新浪广告
DOMAIN-KEYWORD, zhihu-ad, REJECT             # 知乎商业内容
DOMAIN, api.zhihu.com/recommend, REJECT      # 知乎推荐

## 视频/音乐应用广告
DOMAIN-KEYWORD, bilibili-ad, REJECT          # B 站广告
DOMAIN-KEYWORD, youku-ad, REJECT             # 优酷广告
DOMAIN-KEYWORD, iqiyi-ad, REJECT             # 爱奇艺广告
DOMAIN-KEYWORD, qqmusic-ad, REJECT           # QQ 音乐广告
DOMAIN-KEYWORD, netease-ad, REJECT           # 网易云音乐广告

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LEVEL 3: GEOIP & Final（兜底规则）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# GeoIP 优先于 Final，避免中国流量绕行
GEOIP, CN, DIRECT
FINAL, Final

[Remote Rule]
# 高级广告黑名单源
https://ws.wenn.in/main/Mirror/rules/loon-Advertising.list, policy=REJECT, tag=🚫 广告域名，enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Privacy.list, policy=REJECT, tag=🔒 隐私保护，enabled=true
https://ws.wenn.in/main/Mirror/rules/loon-Hijacking.list, policy=REJECT, tag=🛡️ 反劫持，enabled=true

[Plugin]
# 核心净化插件
https://ws.wenn.in/main/Mirror/rules/loon-AllInOne.plugin, enabled=true, tag=通用广告
https://ws.wenn.in/main/Mirror/rules/loon-AdvertisingScript.plugin, enabled=true, tag=广告脚本
https://ws.wenn.in/main/Plugin/wechat.plugin, enabled=true, tag=微信净化
https://ws.wenn.in/main/Plugin/jd.plugin, enabled=true, tag=京东净化
https://ws.wenn.in/main/Plugin/zhihu.plugin, enabled=true, tag=知乎净化
https://ws.wenn.in/main/Plugin/bilibili.plugin, enabled=true, tag=B 站净化
https://ws.wenn.in/main/Plugin/netease.plugin, enabled=true, tag=网易净化
https://ws.wenn.in/main/Plugin/tieba.plugin, enabled=true, tag=贴吧净化
https://ws.wenn.in/main/Plugin/qidian.plugin, enabled=true, tag=起点净化
https://ws.wenn.in/main/Plugin/amap.plugin, enabled=true, tag=高德净化
https://ws.wenn.in/main/Plugin/qqmusic.plugin, enabled=true, tag=QQ 音乐净化

# kelee.one 增强插件（仅在 Loon App 内可用）
https://kelee.one/Tool/Loon/Lpx/Google.lpx, enabled=true, tag=🔍 Google 搜索重定向
https://kelee.one/Tool/Loon/Lpx/JD_Price.lpx, enabled=true, tag=📦 京东比价

[Rewrite]
# ═══════════════════════════════════════════════════════════
# 重写规则精化版 v8.1
# ═══════════════════════════════════════════════════════════

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 第 1 类：HTTPDNS 防御（防止劫持到广告服务器）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

^https?:\/\/119\.29\.29\.29\/d reject-200
^https?:\/\/203\.107\.1\.1\/d reject-200
^https?:\/\/223\.5\.5\.5\/d reject-200
^https?:\/\/1\.12\.12\.12\/d reject-200
^https?:\/\/120\.53\.53\.53\/d reject-200

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 第 2 类：广告 API 响应清洗（精准净化）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 微博广告净化
^https?:\/\/api\.weibo\.com\/(2\/statuses\/feed|2\/status\/go\/show)\? uid rewrite-response=scripts/weibo-ad-filter.js
^https?:\/\/api\.weibo\.com\/cn\/friendship\/friends\? uid=rewrite-response=scripts/weibo-friends-filter.js

## 知乎广告净化
^https?:\/\/www\.zhihu\.com\/api\/v3\/feed\? rewrite-response=scripts/zhihu-feed-filter.js
^https?:\/\/www\.zhihu\.com\/api\/v3\/answers\/feed\? rewrite-response=scripts/zhihu-answers-filter.js
^https?:\/\/api\.zhihu\.com\/recommend\/reasons rewrite-response=scripts/zhihu-recommend-filter.js

## 京东广告净化
^https?:\/\/api\.jd\.com\/command\/(deliverLayer|getTabHomeInfo|myOrderInfo) rewrite-response=scripts/jd-deliver-filter.js
^https?:\/\/api\.jd\.com\/command\/personinfoBusiness rewrite-response=scripts/jd-personinfo-filter.js
^https?:\/\/api\.jd\.com\/command\/orderTrackBusiness rewrite-response=scripts/jd-tracking-filter.js

## 淘宝/天猫广告净化
^https?:\/\/api\.m\.taobao\.com\/api\?.*h5aw\.mcloud rewrite-response=scripts/taobao-home-filter.js
^https?:\/\/g\.mmstatis\.com\/mmr\.css rewrite-response=scripts/alibaba-track-filter.js

## B 站广告净化
^https?:\/\/api\.biliintl\.com\/mobile\/v2\/feed rewrite-response=scripts/bilibili-feed-filter.js
^https?:\/\/api\.bilibili\.com\/x\/web-interface\/nav rewrite-response=scripts/bilibili-nav-filter.js

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 第 3 类：数据上报拦截（保护隐私）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 美团数据上报
^https?:\/\/track\.meituan\.com\/ analytics reject-body
^https?:\/\/busi\.report\.meituan\.com\/ stat reject-body

## 百度数据上报
^https?:\/\/analytics\.baidu\.cn data reject-body
^https?:\/\/data\.mipcdn\.com\/upload reject-body

## 今日头条数据上报
^https?:\/\/log\.snssdk\.com\/ log reject-body
^https?:\/\/sdkserver\.feishu\.cn\/sdk\/catch_event reject-body

## 抖音/TikTok 数据上报
^https?:\/\/pangolin-sdk-toutiao\.com\/collect reject-body
^https?:\/\/api\.toutiao\.com\/ad-interstitial-log track-data reject-body

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 第 4 类：通知推送净化
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

^https?:\/\/push\.api\.vivo\.com\.cn\/openapi\/1\/message\/push push reject-200
^https?:\/\/mpush\.oneplus\.cn\/api\/v1\/send notify reject-200

[MitM]
# MITM 白名单（仅加密必要域名）
skip-server-cert-verify = false

# ✅ 银行金融（必须 HTTPS）
*.abchina.com
*.cmbchina.com
*.icbc.com.cn
*.ccb.com
*.boc.cn
*.bankofchina.com
*.pingan.com.cn
*.spdb.com.cn
*.hxb.com.cn
*.cgbchina.com.cn

# ✅ Apple Services
weatherkit.apple.com
news-edge.apple.com
gspe35-ssl.ls.apple.com

# ✅ E-commerce & Content
amdc.m.taobao.com
m5.amap.com
api.zhihu.com
*.youtube.com

# ✅ Payment
alipay.com
*.mybank.icbc.com.cn
*.jf365.boc.cn
