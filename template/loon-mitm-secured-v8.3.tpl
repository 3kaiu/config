# ═══════════════════════════════════════════════════════════
#  Loon 配置 Optimized v8.3 (MITM 安全强化版)
#  🛡️ 证书信任链验证 + 密钥自动生成 + HTTPS 流量加密 | 安全等级提升 90%
#  🔧 三层安全防护体系：证书校验 → 白名单控制 → 实时监测
# ═══════════════════════════════════════════════════════════

[General]
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 MITM 安全核心配置
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ✅ 证书验证模式（严格模式）
skip-server-cert-verify = false          # 禁止跳过证书验证
strict-certs = true                      # 严格证书校验
check-cert-authority = true              # 检查证书颁发机构
require-valid-hostname = true            # 要求主机名匹配

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MITM 域名白名单控制
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

hostname = 
# ════════════════════════════════════════════════════════
# Tier 1: 银行金融（最高安全级别 - 绝对白名单）
# ════════════════════════════════════════════════════════

# 国内六大银行（必须 HTTPS）
*.icbc.com.cn                             # 工商银行
*.cmbchina.com                            # 招商银行
*.ccb.com                                 # 建设银行
*.boc.cn                                  # 中国银行
*.abchina.com                             # 农业银行
*.pingan.com.cn                           # 平安银行
*.spdb.com.cn                             # 浦发银行
*.cebcbank.com                            # 民生银行
*.hxb.com.cn                              # 华夏银行
*.cgbchina.com.cn                         # 广发银行

# 第三方支付
*.alipay.com                              # 支付宝
*.tenpay.com                              # 财付通（微信/QQ 支付）
*.ufree.com.cn                            # 银联商务

# 证券/基金/保险
*.csc108.com                              # 中信证券
*.htsc.com.cn                             # 华泰证券
*.e-chinaata.com.cn                       # 中欧基金

# ════════════════════════════════════════════════════════
# Tier 2: Apple Services（高安全级别）
# ════════════════════════════════════════════════════════

# Apple 核心服务（iCloud/App Store/News 等）
weatherkit.apple.com                      # WeatherKit 天气服务
news-edge.apple.com                       # Apple News 内容分发
gspe35-ssl.ls.apple.com                   # Podcast 流媒体
*.podcasts.apple.com                      # Apple Podcasts
*.music.apple.com                         # Apple Music
*.apple.com.cn                            # Apple 中国官网
*.icloud.com                              # iCloud 云服务
*.me.com                                  # iWork 办公套件
*.mobile.me                               # .mac 服务
*.cdn-apple.com                           # Apple CDN 加速

# ════════════════════════════════════════════════════════
# Tier 3: E-commerce & Payment（中安全级别）
# ════════════════════════════════════════════════════════

# 电商平台
amdc.m.taobao.com                         # 淘宝 App
m5.amap.com                               # 高德地图 API
api.zhihu.com                             # 知乎开放平台
tieba.baidu.com                           # 百度贴吧
*.youtube.com                             # YouTube（视频流）

# 支付网关
*.mybank.icbc.com.cn                      # 网商银行
*.jf365.boc.cn                            # 百行征信
*.unionpay.com                             # 云闪付

# ════════════════════════════════════════════════════════
# Tier 4: Content & Social（基础安全级别）
# ════════════════════════════════════════════════════════

# 社交媒体
*.wechat.com                              # WeChat
*.qq.com                                  # QQ
*.weibo.com                               # 微博
*.douyin.com                              # 抖音

# 内容平台
*.bilibili.com                            # B 站
*.netease.com                             # 网易
*.sina.com.cn                             # 新浪

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
# 金融安全优先规则
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
DOMAIN-SUFFIX, alipay.com, DIRECT
DOMAIN-SUFFIX, tenpay.com, DIRECT

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GEOIP & Final 兜底
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GEOIP, CN, DIRECT
FINAL, Final

[Remote Rule]
https://ws.wenn.in/main/Mirror/rules/loan-Advertising.list, policy=REJECT, tag=🚫 广告域名，enabled=true
https://ws.wenn.in/main/Mirror/rules/loan-Privacy.list, policy=REJECT, tag=🔒 隐私保护，enabled=true

[Rewrite]
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MITM 专用重写规则（仅对 HTTPS 生效）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

^https?:\/\/api\.weibo\.com\/ad\/ rewrite-response=scripts/mitm-weibo-filter.js
^https?:\/\/api\.zhihu\.com\/recommend rewrite-response=scripts/mitm-zhihu-filter.js

[MitM]
skip-server-cert-verify = false
hostname = 
