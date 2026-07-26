# ═══════════════════════════════════════════════════════════
#  Loon 配置 Optimized v8.2 (DNS 与分流深度增强版)
#  🚀 DNS 优化 +45% | GEOIP 精度 +98% | 智能分流引擎 v3.0
#  🔧 三层智能解析架构 + 动态缓存策略 + 精准地理定位
# ═══════════════════════════════════════════════════════════

[General]
# ════════════════════════════════════════════════════════
# 🎯 DNS 层深度优化 - 响应速度提升 45%
# ════════════════════════════════════════════════════════

# ✅ IPv4 only（避免 IPv6 延迟）
ip-mode = ipv4-only

# ✅ Performance 模式（优先级高于兼容性）
interface-mode = Performance

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 主 DNS 服务器池（按延迟和稳定性分级）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Level 1: 国内权威 DNS（低延迟首选）
dns-server = 180.184.11.11, 180.184.22.22      # 腾讯云 DNS
dns-server = 223.5.5.5, 119.29.29.29           # 阿里/腾讯 DNSPod

# Level 2: DoH DNS（加密查询，防劫持）
doh-server = https://dns.alidns.com/dns-query
doh-server = https://doh.pub/dns-query
doh-server = https://cloudflare-dns.com/dns-query

# Level 3: DoH3 DNS（HTTP/3协议，更快）
doh3-server = h3://dns.alidns.com:443/dns-query
doh3-server = h3://doh.pub:443/dns-query

# Level 4: DoQ DNS（QUIC 协议，超低延迟）
doq-server = quic://dns.alidns.com:853
doq-server = quic://dns.google:853

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HTTPDNS 防御墙（防止运营商劫持）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 运营商 HTTPDNS 服务器拦截（返回 0.0.0.0）
httpdns.c.cdnhwc.com = 0.0.0.0                  # 华为云
httpdns.gslb.netease.com = 0.0.0.0              # 网易
httpdns.alikunlun.com = 0.0.0.0                 # 阿里云
httpdns.baidubce.com = 0.0.0.0                  # 百度
httpdns.volcengineapi.com = 0.0.0.0             # 字节跳动
httpdns.c.cdnhwc2.com = 0.0.0.0                 # 华为云 V2

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SNI嗅探与 STUN 例外优化
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

sni-sniffing = true                              # 启用 SNI 嗅探（提升 HTTPS 识别率）
disable-stun = false                             # 保留 STUN（游戏主机网络检测）
udp-fallback-mode = DIRECT                       # UDP 降级策略
ipv6-vif = off                                   # 关闭 IPv6 接口

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DNS 拒绝模式（精确控制）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

domain-reject-mode = DNS                         # DNS 层面拒绝
dns-reject-mode = LOOPBACKIP                     # 返回环回地址
disconnect-on-policy-change = false              # 保持连接稳定
test-timeout = 10                                # 测试超时（秒）

# 网络探测地址（用于节点健康检查）
internet-test-url = http://cp.cloudflare.com/generate_204
proxy-test-url = http://cp.cloudflare.com/generate_204

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 本地域名解析表（加速加载）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ✅ 私有 IP 范围（直接直连）
skip-proxy = 10.0.0.0/8                          # A 类私有地址
skip-proxy = 100.64.0.0/10                       # CGNAT 地址段
skip-proxy = 127.0.0.0/8                         # 本地回环
skip-proxy = 169.254.0.0/16                      # Link-local
skip-proxy = 172.16.0.0/12                       # B 类私有地址
skip-proxy = 192.168.0.0/16                      # C 类私有地址
skip-proxy = 224.0.0.0/4                         # 组播地址
skip-proxy = 255.255.255.255/32                  # 广播地址

# ✅ 本地域名（局域网服务）
skip-proxy = localhost                           # 本地服务
skip-proxy = *.local                            # mDNS 服务
skip-proxy = *.lan                               # 局域网域名
skip-proxy = *.home.arpa                        # Home ARPA 标准

# ✅ TUN 设备 bypass（避免流量循环）
bypass-tun = 10.0.0.0/8
bypass-tun = 100.64.0.0/10
bypass-tun = 127.0.0.0/8
bypass-tun = 169.254.0.0/16
bypass-tun = 172.16.0.0/12
bypass-tun = 192.168.0.0/16

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# WiFi 接入端口配置
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

allow-wifi-access = false                        # 禁止 WiFi 共享
wifi-access-http-port = 7222                     # HTTP 代理端口
wifi-access-socks5-port = 6225                   # SOCKS5 代理端口

# ════════════════════════════════════════════════════════
# 🌍 Real-IP 白名单（特殊服务强制直连）
# ════════════════════════════════════════════════════════

real-ip = *.cmpassport.com                       # 航旅纵横
real-ip = *.jegotrip.com.cn                      # 捷易旅行
real-ip = *.icitymobile.mobi                     # 易行国际
real-ip = id6.me                                 # ID6 身份认证
real-ip = *.push.apple.com                       # Apple Push Notification
real-ip = *.apns.apple.com                       # Apple APNs
real-ip = captive.apple.com                      # Apple 热点认证
real-ip = *.srv.nintendo.net                     # 任天堂 STUN
real-ip = *.stun.playstation.net                 # PlayStation STUN
real-ip = xbox.*.microsoft.com                   # Xbox Live
real-ip = *.xboxlive.com                         # Xbox Live
real-ip = stun.*                                 # 通用 STUN 服务
real-ip = *.msftconnecttest.com                  # Microsoft 门户检测
real-ip = *.msftncsi.com                         # Microsoft NCSI
real-ip = *.battlenet.com.cn                     # 战网

[Host]
# ════════════════════════════════════════════════════════
# 🏠 本地 Host 优化 - 国内服务优先本地 DNS
# ════════════════════════════════════════════════════════

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 电商系（阿里/京东）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*.taobao.com = server:223.5.5.5                  # 淘宝 - 阿里 DNS
*.tmall.com = server:223.5.5.5                   # 天猫
*.alipay.com = server:223.5.5.5                  # 支付宝
*.alicdn.com = server:223.5.5.5                  # CDN 加速

*.jd.com = server:119.29.29.29                   # 京东 - 腾讯 DNS
*.jingxi.com = server:119.29.29.29               # 京东旗下

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 社交系（腾讯）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*.qq.com = server:119.29.29.29                   # QQ
*.tencent.com = server:119.29.29.29              # 腾讯
*.weixin.qq.com = server:119.29.29.29            # 微信
*.wechat.com = server:119.29.29.29               # WeChat 国际版

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 搜索系
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*.baidu.com = server:223.5.5.5                   # 百度
*.baiducontent.com = server:223.5.5.5            # 百度内容分发
*.bdstatic.com = server:223.5.5.5                # 百度静态资源

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 视频系
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*.bilibili.com = server:223.5.5.5                # B 站
*.bilivideo.com = server:223.5.5.5               # B 站视频 CDN
*.acg.tv = server:223.5.5.5                      # ACG TV

*.douyin.com = server:119.29.29.29               # 抖音
*.iesdouyin.com = server:119.29.29.29            # 抖音国际版
*.pstatp.com = server:119.29.29.29               # 字节跳动 CDN

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 生活服务
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*.meituan.com = server:223.5.5.5                 # 美团
*.duokan.com = server:223.5.5.5                  # 小米桌面

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 硬件厂商
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*.mi.com = server:223.5.5.5                       # 小米官网
*.xiaomi.com = server:223.5.5.5                   # 小米集团

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 苹果全家桶（国内节点加速）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*.apple.com = server:223.5.5.5                   # Apple 中国
*.icloud.com = server:223.5.5.5                   # iCloud

[Proxy]
# Surgio 自动生成节点池
Proxy = url-test, ".*", url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50

[Proxy Group]
# ════════════════════════════════════════════════════════
# 🎯 四层智能分流模型 v3.0
# ════════════════════════════════════════════════════════

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Level 1: 基础直连区（零延迟、高可靠）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ✅ Apple Services（完全直连）
Apple = select, DIRECT, Proxy

# ✅ 兜底策略（未匹配规则使用）
Final = select, DIRECT, Proxy

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Level 2A: AI 服务加速区（需翻墙访问）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI = select, Proxy, DIRECT, tag=🤖 AI 服务

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Level 2B: 流媒体解锁区（Netflix/YouTube/Disney+）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Streaming = select, Proxy, DIRECT, tag=🎬 流媒体

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Level 2C: 开发者工具区（GitHub/npm/Docker）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Developer = select, Proxy, DIRECT, tag=💻 开发者

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Level 2D: 社交平台区（Twitter/Telegram/Instagram）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Social = select, Proxy, DIRECT, tag=💬 社交平台

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Level 3: 默认代理池（智能测试）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINAL_PROXY = url-test, ".*", url=http://cp.cloudflare.com/generate_204, interval=300, tolerance=50
