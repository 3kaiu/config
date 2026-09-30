# ═══════════════════════════════════════════════════════════
#  Loon 配置 (Loon.lcf) — Surgio 生成 (滚动 main)
#  核心: 自动健康检测 · 高质量多引擎去广告 · Apple原生增强 · 全球社交/流媒体分流 · 银行 MitM 冲突根治
#  引擎支持: iOS Loon 3.3.9+ (规则语义已按官方文档 3.5.1(978) 核对: interface-mode 取值等)
# ═══════════════════════════════════════════════════════════

[General]
# 四条不可回退的官方语义约束 (依据 https://nsloon.app/docs/General/):
# ① ip-mode 官方枚举 = ipv4-only/dual/ipv4-preferred/ipv6-preferred。"fake-ip" 不是
#    ip-mode 的取值 —— Fake IP 体系由 real-ip 控制排除名单, 与 IP 协议族选择正交。
# ② hijack-dns 官方语义是"劫持 UDP DNS 并返回 Fake IP", 即 Loon 自己应答, 应用
#    **不再联系那个解析器**。故列举式(只列几个公开 IP)是反效果: 未列举的解析器
#    明文 UDP 直出, 绕过 domain-reject-mode=DNS 的拒绝面且吃污染; 而 *:0 又过宽
#    (劫持所有端口)。官方首例 *:53 才是正解。需 Loon >= 3.2.5(789)。
# ③ 不设 ipasn-url: 本地 GEOIP,CN,DIRECT 优先级高于插件 [Rule], 境内 IP 必先命中
#    GEOIP, 插件 IP-ASN 永不可能求值 —— 设置即每次白拉 12MB。若将来确有 IP-ASN
#    规则, 须排在**本地** GEOIP 之前, 且 dns-geoip.test.js 的消费者断言放行。
# ④ real-ip 须含 captive.apple.com / *.msftconnecttest.com / time.*.com 等系统服务域:
#    它们会缓存 Fake IP, 被伪 IP 污染即断网或对时失败。
#    值中仍保留 *.local/*.lan/*.home.arpa: bypass-tun + skip-proxy 已在进 Loon 前绕开
#    它们, 此处属纵深防御冗余 (2026-09-30 修正: 原注释称"不在此列"与实际值矛盾)。
# ⚠️ 必须与下方 ipv6-vif 保持一致 (2026-09-29 对抗审计发现的自相矛盾):
#   原值 dual 会并发查 A + AAAA 并把结果交给 App, 而 ipv6-vif = off 不接管 TUN 的
#   IPv6 转发 —— 两条并置的结果无论官方对 "不处理" 作何解释都不可接受:
#     · 若 IPv6 被丢包  → App 拿到 IPv6 地址却连不通, 靠回退重连, 平白加延迟;
#     · 若 IPv6 绕过 TUN → 静默泄漏, 而本仓恰恰有 M3 隐私模块在防这件事。
#   ipv4-only 从源头消除矛盾: 不发起 AAAA 查询, App 永远拿不到 IPv6 地址。
#   代价: 无 IPv6 (happy-eyeballs 失效, 少一个 CDN 选路维度)。对本配置可接受 ——
#   全仓规则**零条 IPv6 规则**, IP-CIDR 亦全为 IPv4, IPv6 本就无路可走。
#   若要启用 IPv6: 改 dual + ipv6-vif = auto, 并保留下方 bypass-tun/skip-proxy
#   已补齐的 IPv6 局域网段, 否则 mDNS/ULA 流量会被卷进隧道。
ip-mode = ipv4-only
interface-mode = Performace
dns-server = 180.184.11.11, 180.184.22.22, 119.29.29.29, 223.5.5.5
doh-server = {{ customParams.doh_primary }}, {{ customParams.doh_fallback }}
doh3-server = {{ customParams.doh3_primary }}, {{ customParams.doh3_fallback }}
doq-server = {{ customParams.doq_server }}
hijack-dns = *:53
# ⚠️ 未收录于现行官方《通用配置》参数表 (2026-09-30 全参数核对): 保留现值,
#    生效性待实测 —— 任何论证不得以官方文档为本参数背书。
sni-sniffing = true
disable-stun = false
# 回落策略 = REJECT 而非 DIRECT (2026-09-29 对抗审计, 用户决策)。
# 官方: 该键是"节点不支持 UDP 或未启用 UDP 转发时使用的策略"。取 DIRECT 意味着
# 节点一旦没有 UDP, **全部 UDP 流量(QUIC / 游戏 / 通话 / WireGuard)会从本机真实 IP
# 直连漏出** —— 与本配置既有 posture 矛盾: 已用 PROTOCOL,STUN,REJECT 堵掉 UDP 泄漏里
# 最典型的 STUN/WebRTC, 却把更大的 QUIC/任意 UDP 敞着。
# 取 REJECT = 失败可见而非静默泄露: 节点开了 udp=true 时本键永不触发, 零影响;
# 没开时 UDP 请求直接失败, 便于发现"节点该开 UDP"而不是默默用真实 IP 出门。
# ⚠️ 前提: 请在 Loon 节点详情确认东京组已启用 UDP, 否则 FaceTime/游戏会连不上。
udp-fallback-mode = REJECT
# ⚠️ 未收录于现行官方《通用配置》参数表 (2026-09-30 全参数核对): 保留 off 与
#    ip-mode=ipv4-only 自洽, 生效性待实测。上方 ipv4-only 的论证**不依赖**本参数
#    是否被客户端实现 —— 官方对 ipv4-only 的定义已包含"拒绝 IPv6 连接"。
ipv6-vif = off
domain-reject-mode = DNS
dns-reject-mode = LOOPBACKIP
geoip-url = https://raw.githubusercontent.com/Loyalsoldier/geoip/release/Country.mmdb
allow-wifi-access = false
wifi-access-http-port = 7222
wifi-access-socks5-port = 6225
test-timeout = 5
# ⚠️ 为什么 [Rule] 段的 REJECT 全是裸 REJECT, 不用 REJECT-IMG/-DICT/-ARRAY
#   (2026-09-29 按官方文档定论, 非"待优化"):
#   ① 这三个变体描述的都是 **HTTP 响应内容**(官方《策略》): -IMG=200+1x1 GIF,
#      -DICT=200+空 JSON 对象, -ARRAY=200+空 JSON 数组。只有当拒绝发生在**请求转发
#      阶段**、客户端真的收到一个 HTTP 响应时, 它们才有意义。
#   ② 本配置 domain-reject-mode = DNS(官方《通用配置》): 域名拒绝在 **DNS 阶段**
#      用 LOOPBACKIP 回环地址完成, 请求根本到不了 HTTP 响应层。
#   ③ 官方《HTTP 规则》明言"HTTP 规则仅匹配 HTTP 和 HTTPS 请求", 而本配置规则中
#      URL-REGEX / USER-AGENT 合计 **0 条** —— 变体唯一的适用场景不存在。
#   ⇒ 结论: 裸 REJECT 在本配置下**行为等价**, 不是缺口。把变体当"待优化项"登记
#      是对台账的误读 —— 它把"未使用的功能"误记为"未做好的功能"。
#   ⇒ 何时才需要变体: ①domain-reject-mode 改为 Request ②或引入 URL-REGEX/USER-AGENT
#      做 HTTP 级拦截(如仅拦某路径而非整个域)。两者当前都不成立。
#
# 探活一主一备: internet-test-url (直连可用性) 与 proxy-test-url (代理链路可用性)
# 必须用**不同**上游 —— 同端点故障会同时误判"本机断网 + 代理失效", 排障无法区分。
# 策略组未显式 url= 时继承 proxy-test-url。
internet-test-url = http://connectivitycheck.platform.hicloud.com/generate_204
proxy-test-url = http://connectivitycheck.gstatic.com/generate_204
skip-proxy = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 255.255.255.255/32, ::1/128, fc00::/7, fe80::/10, ff00::/8, localhost, *.local, *.lan, *.home.arpa
# IPv6 局域网段为前向冗余: 当前 ip-mode = ipv4-only 用不到, 但一旦切到 dual,
# 缺了它们会让 mDNS(ff02::/16)/ULA/链路本地流量被卷进隧道 —— 组播与 ULA 走隧道必坏。
# 2026-09-30 补齐主机名条目 (localhost/*.local/*.lan/*.home.arpa) 对齐 skip-proxy
#   与官方 bypass-tun 示例 (首例即含 localhost,*.local): TUN 下主机名型流量同样绕行。
bypass-tun = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 255.255.255.255/32, ::1/128, fc00::/7, fe80::/10, ff00::/8, localhost, *.local, *.lan, *.home.arpa
real-ip = *.cmpassport.com, *.jegotrip.com.cn, id6.me, *.boc.cn, *.abchina.com, *.ccb.com, *.psbc.com, *.cmbchina.com, *.icbc.com.cn, *.bankofchina.com, *.spdb.com.cn, *.cib.com.cn, *.cebbank.com, *.unionpay.com, *.pingan.com.cn, *.pingan.com, *.bankcomm.com, *.citicbank.com, *.hxb.com.cn, *.cgbchina.com.cn, *.push.apple.com, *.apns.apple.com, captive.apple.com, *.local, *.lan, *.home.arpa, *.srv.nintendo.net, *.stun.playstation.net, xbox.*.microsoft.com, *.xboxlive.com, stun.*, *.msftconnecttest.com, *.msftncsi.com, *.battlenet.com.cn, time.*.com
# real-ip 条目已按 DNS 存活性核验(2026-09-29): 已删 *.icitymobile.mobi(四解析器
# NXDOMAIN 且无 NS, 域名已注销)。保留但公网无解的 *.srv.nintendo.net 属**不确定项** ——
# 任天堂 SWIFT/NSO 主机在部分网络走内网 DNS, 公网查不到不代表设备上无效, 不擅自删。
# 判据同 dns-liveness 门禁: 裸域无解**不等于**死规则(real-ip 用 *. 通配, 真实主机是子域),
# 须多解析器交叉且 NS 亦无才判死。

[Host]
# 本段为空 (2026-09-29 对抗审计)。原 17 条 `server:` 映射是**净亏损**，已全删:
#   ① 降级传输: `server:` 是按域名的 DNS **覆盖** (官方《DNS映射》), 会让这 17 个域
#      绕过全局 doh/doh3/doq 直连明文 UDP。全局加密链本就够用, 无需逐域指定。
#   ② 零收益: 目标 223.5.5.5 / 119.29.29.29 与全局 DoH 上游 dns.alidns.com /
#      doh.pub **同属 AliDNS / DNSPod** —— 不是"换个更快的解析器", 是把同样的解析
#      从加密降级到明文。被降级的还包含 *.apple.com / *.icloud.com(.cn)。
#   ③ 含 1 条死规则: `*.weixin.qq.com` 被前面的 `*.qq.com` 完全覆盖
#      (域名类首次命中即停, 该条永不生效)。
# 如需对某域指定解析器, 正确形态是 `[Host] <域> = server:<加密 DoH URL>`,
# 而不是明文 IP。

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
Streaming = url-test, Proxy, Fallback, url=http://cp.cloudflare.com/generate_204, interval=120, tolerance=100, tag=流媒体
AI = url-test, Proxy, Fallback, url=http://cp.cloudflare.com/generate_204, interval=120, tolerance=100, tag=AI服务
Developer = select, Proxy, Fallback, DIRECT, tag=开发者
Gaming = select, Proxy, Fallback, DIRECT, tag=游戏平台
Social = select, Proxy, Fallback, DIRECT, tag=社交平台
OpenCode = select, Proxy, DIRECT, tag=OpenCode.ai

[Rule]
# 推送端口无条件直连, 故意的**范围**权衡 (2026-09-29 审计后维持原值):
#   5223 = Google FCM / 各类 IM 推送。放在首行即最高优先级, 先于一切 REJECT。
#   直连的代价: 推送元数据交给 Google/APNs —— 但 APNs 本就常驻 real-ip 且走 Apple 块,
#   不构成**新增**泄漏面。收窄为域名限定需要 FCM 的完整域名清单, 官方无此清单;
#   按域名字符猜恰是本仓已犯过的错(京东店铺域), 故维持端口级放行。
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
# 官方《规则系统 3.1》第 1 条: 目标为域名时先匹配域名规则。故上列 5 条通话白名单
# 必先于本条命中, 白名单语义不受位置影响; 而**裸 IP 的 STUN** (无域名可匹配) 只有
# 本条能拦 —— DOMAIN-KEYWORD 够不着它。协议匹配零成本, 优于关键词 (官方点名其耗时随
# 数量线性增长), 且不像 DEST-PORT 那样误伤一切 host 的非标 WebRTC。需 Loon >= 3.1.7。
# TURN (5349-3479) 走 TLS/TCP 不属 STUN 协议, 本条不覆盖; 3478 兜明文 TURN 中继。
PROTOCOL, STUN, REJECT
DEST-PORT, 3478, REJECT

# ── 加密 DNS 端口级兜底 (2026-09-30 架构分层: 框架层, 插件开关动不了它) ──────
# 为什么留在本地而不进 dns-leak.plugin: 域名级名单(可按需启停、可经 CDN 独立更新)在插件,
#   而**端口级**是插件的开关一旦被关就失效的最后一道闸, 属框架层兜底。
# 依据: 端口 853 是 IANA 分配给 DoT(DNS over TLS)的端口; 官方《DNS》页亦把 853 写作 DoQ
#   默认端口(官方《通用配置》页写 784 —— 两页口径漂移已有记载, 本仓 doq-server 显式写 `:853`)。
#   TCP 853 = DoT, UDP 853 = DoQ, 一条端口规则同时覆盖两者; 非 853 的自定义端口不受此约束。
# 自伤分析(必须留档, 因为它动的是本仓自己的解析上游): 本仓 `doq-server = quic://dns.alidns.com:853`
#   与 DoT 同端口 ⇒ **若** Loon 自身的上游查询也经过 `[Rule]` 匹配, 该 DoQ 并发源会被自己拦掉。
#   缓解事实(官方《DNS》页): "普通 DNS 与加密 DNS(DoH、DoQ、DoH3)同时配置时, Loon 优先使用
#   加密 DNS; 会并发查询**所有有效服务器**" ⇒ 最坏结果是少一个并发源, 而不是解析中断。
#   实机验证清单(落地后确认): ① 正常上网观察解析是否正常; ② 临时只留 doq-server(注掉 doh/doh3)
#   再观察 —— 若解析仍正常, 说明引擎自身流量不过规则, 本条可无顾虑保留; 若异常, 改为按域名
#   白名单放行本仓解析链后再启用。
# 残留面(已知未覆盖, 见 LOON-FEATURES.md「DNS 收编与残留面」): IP 直连型 DoH
#   (如 `https://8.8.8.8/dns-query`) 既无域名可匹配也不走 853 ⇒ 需 IP-CIDR 级封堵, 未落地。
DEST-PORT, 853, REJECT

# ── DNS 收编的域名级清单已迁至 L0 依赖层插件 (2026-09-30 架构分层) ──────────
# 原在此处的 `DOMAIN-KEYWORD, httpdns` 与 6 条公共 DoH 端点 REJECT 已迁入:
#   Plugin/dns-httpdns.plugin   HTTPDNS 端点(11 条逐条取证 + 2 条 AND 锚定兜底)
#   Plugin/dns-leak.plugin      公共加密解析器端点(19 条逐条取证)
# 迁移判据: 这两类名单是**插件层的分发面**(改名单不必重导入 Profile, 客户端拉插件即生效),
#   且属"所有去广告插件的依赖"⇒ 与广告平台拦截器同列 L0, 必须排在 [Plugin] 段最前
#   (顺序由 test/cases/plugin-layering.test.js 断言)。
# 单一真源: 本文件不再重复声明这些域 —— 重复会让插件规则成为永不命中的死条目
#   (官方《规则》页: 本地规则 > 插件规则), 而 tools/plugin-lint-check.mjs 的跨层扫描
#   正是为抓这种"插件规则被本地规则遮蔽"的空转。若日后要收回本地, 须同时删插件的对应行。


# 局域网
IP-CIDR, 192.168.0.0/16, DIRECT, no-resolve
IP-CIDR, 10.0.0.0/8, DIRECT, no-resolve
IP-CIDR, 172.16.0.0/12, DIRECT, no-resolve
IP-CIDR, 127.0.0.0/8, DIRECT, no-resolve

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

# ── 经典广告联盟平台覆盖 (2026-09-29 三源全网研判) ──────────────────
# 候选 24 个缺口域, 经 DoH(Cloudflare) + HTTPS 探针 + 跨层核对后**只加 6 条**。
# 筛选判据 (逐条实证, 非按平台名批量照搬):
#   ① 已死域 (CF 解析 0 条) 不加 —— 不占资源, 拦了也无意义:
#      anythinktech / bytegoofy / bytescm / ggzqt / pangolin-sdk-toutiao-b /
#      pangolin-sdk-toutiao1 / pglstatp-toutiao
#   ② **平台主域含 App 功能, 整域拦会破功能** —— 明确排除:
#      kuaishou.com(短视频本体) / union.baidu.com(百度广告主站, 含落地页)
#      miui.com(小米系统) / ads.union.jd.com(京东联盟主站)
#      snssdk.com(字节内容分发) / e.qq.com(企微/公众号) / gdt.qq.com(广点通落地页)
#      这类只能拦**已取证的广告子域**, 已在下方各自登记。
#   ③ 纯广告 SDK / 投放 API, 无功能页 ⇒ 整域拦安全:
DOMAIN-SUFFIX, tradplusad.com, REJECT
DOMAIN-SUFFIX, anythinktech.com, REJECT
DOMAIN-SUFFIX, gromore.com, REJECT
DOMAIN, ad.qq.com, REJECT
DOMAIN, cpro.baidu.com, REJECT
DOMAIN, pos.baidu.com, REJECT
DOMAIN, cpu-openapi.baidu.com, REJECT
#   探针留证: tradplusad 200 / ad.qq.com 200 / cpro 200 / pos 200 / cpu-openapi 404
#   (404 = 服务端在, 非死域; gromore/anythinktech 裸域无 A 记录但子域有, 故用 SUFFIX)
# ⚠️ 本组**不进 [MitM]** —— 域名 REJECT 在 DNS 阶段完成, 拦广告零证书成本。

# 穿山甲统计/请求/聚合接口 (2026-08-12 HAR 审计第二轮)
# 起点秒播脚本 (Scripts/Qidian.js) 仅依赖 gdtimg.com/gtimg.cn 视频域, 不依赖穿山甲,
# 故 api-access/log-api/gromore 三个接口域可安全拦截 (必须先于下方 SUFFIX DIRECT)
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

# 追踪 — 官方点名 DOMAIN-KEYWORD 耗时随数量线性增长, 故用精确枚举而非子串全网扫。
# 去遛: 用精确枚举而非 DOMAIN-KEYWORD(官方点名该类型耗时随数量线性增长)。
DOMAIN, qreport.qunar.com, REJECT
DOMAIN, aegis.cdn-go.cn, REJECT

# Google 分析与广告
# 显式拦截而非依赖远程列表: [Rule] 本就先于一切 Remote Rule 求值, 故上游列表故障
# 时这些仍生效, 代价为零。
DOMAIN-KEYWORD, googleads, REJECT
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

# ── 功能域直连白名单 (原"误杀域名白名单", 2026-08 审计 → 2026-09-29 复核) ──
# ⚠️ 成因已变: 原注释写"修正远端广告列表过粗 KEYWORD 的功能性误杀", 但本仓已移除
#    12万条广告域名表 + 7 个镜像规则列表, 长尾广告域一律走 Final ⇒ 没有任何规则
#    会 REJECT 下列域, "防误杀"已不成立。它们现在的角色是**主动声明走直连的
#    功能域锚点**, 不是被动防误杀。保留 (不与任何 REJECT 冲突, 不产生解密面,
#    风险极低), 且在将来任何 jd.* REJECT 重新引入时是第一道防线。
# 原则: 只放行「功能域」, 统计/追踪域保持 REJECT。
# - msg.umengcloud.com 为友盟推送 MPS 网关 (仅此域), ulogs/sec 友盟统计仍拦截
# - kepler.jd.com 系列为第三方 App 内京东购买页/开普勒 API (什么值得买等跳转依赖)
# - pstatp/byteimg 系列为字节内容图床 (头条信息流图片), dm./pglstatp 广告域不放行
# 2026-09-29 DoH(Cloudflare+DNS.google 双解析器)+HTTPS 探针复核 4 个京东功能域,
#   全部存活: kepler.jd.com 302 / keplerapi.jd.com 302 / mapi.m.jd.com 403 /
#   policy.jd.com 404 (403/404 = 服务端在, 非死域)。京东无 MitM/脚本, 广告治理
#   需先有解密面 + HAR 取证接口结构; 凭域名字义加 REJECT = 本仓已犯的 du.jd.com 错。
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

# ── 国内广告 SDK 硬拦截 ──────────────────────────────────────
# 全部条目经 HAR 抓包实证为 200 穿透 (纯广告/统计/上报接口, 无功能依赖)。
# 三条纪律:
# ① 整段必须在 GEOIP,CN,DIRECT 之前 —— 本地规则优先, 国内域会被 GEOIP 直连截胡,
#    插件与 Remote Rule 均无法拦截国内域。
# ② 推送保活: 只拦统计子域, 保留 config.jpush.cn / user.jpush.cn (极光推送) 与
#    api.getui.com (个推推送) —— 全拦 SUFFIX 会断推送。
# ③ 新增域名须先 DoH 双解析器 + HTTPS 探针取证。凭域名字义加 REJECT 是本仓犯过的错:
#    京东 du.jd.com / c-nfa.jd.com 实为店铺域 (302 → error2.aspx?from=shopdomain),
#    误拦直接破店铺页; jzt.jd.com 是对外 Jenkins CI。
DOMAIN, v.gdt.qq.com, REJECT
DOMAIN, win.gdt.qq.com, REJECT
DOMAIN-SUFFIX, sigmob.cn, REJECT
DOMAIN, open.e.kuaishou.com, REJECT
DOMAIN-SUFFIX, gdfp.gifshow.com, REJECT
# 2026-09-29 修正主机名错配: 原写 `DOMAIN-SUFFIX, alisc1.zijieapi.com`, 但四解析器
# (@1.1.1.1/@8.8.8.8/@223.5.5.5/@119.29.29.29) 一致 NXDOMAIN —— 规则永不命中。
# 而同段注释里记的真实 host 是 `tnc3-alisc1.zijieapi.com`, 该域存活(CNAME →
# w.kunluncan.com / queniuyk.com, A 段 120.226.57.x, HTTPS 404=主机在线)。
# 即**该拦的没拦住, 还白占一条**。tnc1/tnc2-alisc1 均 NXDOMAIN, 仅 tnc3 在用。
DOMAIN-SUFFIX, tnc3-alisc1.zijieapi.com, REJECT
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

# ── 日志/埋点/APM 接口 (纯上报, 无功能依赖) ────────────────────
# 放弃项: proj-xtrace-*.log.aliyuncs.com / ce3e75d5.jpush.cn —— 哈希前缀每日轮换,
# 无法写成精确域名规则, 拦截即随上游轮换失效。
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

# DNS 隐私语义 (依据官方《规则系统 3.1 匹配优先级》第 2 条, 2026-09-29 修正):
#   ① 目标为域名时先匹配域名规则;
#   ② **域名规则未命中时, 再解析 DNS 并匹配 IP 规则**;
#   ③ 其余规则按配置顺序; ④ 来源 本地 > 插件 > 订阅; ⑤ 兜底走 FINAL。
# 推论: 凡走到 GEOIP 这条 IP 规则的流量 —— 包括最终会走代理的**长尾境外域** ——
#       都已产生一次**本地**解析(国内 DoH, 解析器侧有记录)。这与"是否走代理"无关,
#       代理目标域名的远端解析发生在节点侧, 二者不冲突但也不互相抵消。
#   链路正确性无风险 (未匹配 → FINAL, Final → Proxy); 受影响的是 DNS 隐私面。
#   这是使用 GEOIP,CN,DIRECT 这类 IP 规则的**固有代价**(Clash/Loon 通用), 想根治须
#   换成「域名级中国清单 + Final 兜底」, 代价是重新引入远程规则列表。
# 默认姿态: Final 默认 Proxy + Fallback 双节点容灾;
# 零代理姿态: Final 手动切 DIRECT (代价: 长尾域名本地解析 + 直连)。
GEOIP, CN, DIRECT
FINAL, Final

[Remote Rule]
# 本段为空。历史曾挂 7 个第三方镜像规则列表 (末位一个 12 万条的通用广告域名表),
# 2026-09-29 全部移除 —— 代价是**失去长尾广告域兜底**: 未登记的广告域不再被 REJECT,
# 一律走 Final (默认 Proxy)。保留的拦截面是 [Rule] 段的已取证 REJECT 集 (计数以 doc-claims 实测为准)
# (实测口径: [Rule] 段非注释行中含 REJECT 者) + [Plugin] 段 7 个纯 L2 插件的
# 97 条域级 REJECT (jd.plugin 的净化在 [Script], 不计入此数)。

[Plugin]
# ── 本段是插件的**唯一分发渠道** ──
# 2026-09-29 修正: 插件此前只存在于 Plugin/ 目录
# 与 MODULE-MANIFEST.json, 没有进本段 —— 用户导入 Profile/Loon.lcf 实际一条都拿不到
# ("门禁全绿"是因为 wiring-check 挂在 npm test 而非 check:all)。新增 Plugin/*.plugin
# 必须在此登记, 否则 npm test 第一条判据 ("每个 Plugin/*.plugin 必须被 loon.tpl 引用")
# 判红。注释统一放段首: 11 条 URL 保持连续, 不交错注释。
#
# ── 分层与顺序 (2026-09-30 架构分层, 由 test/cases/plugin-layering.test.js 钉死) ──
# 顺序不是审美问题: 官方《规则》页规定规则来源优先级 = 本地 > 插件 > 订阅, **插件之间按
# 本段登记顺序**。故 L0 依赖层必须排在最前, 否则后置插件的 DIRECT/Proxy 对同域会先命中。
# **L0 依赖层(必须最前)**: 只放"所有去广告插件都需要"的共享域集, 不含任何单 App 逻辑。
#   ① ad-block.plugin     广告平台拦截器 —— 人工策展(7 平台 59 条) + **生成式覆盖**
#   ② dns-httpdns.plugin  HTTPDNS 拦截器 —— 人工策展(11 条) + 生成式覆盖
#   ③ dns-leak.plugin     DNS 防泄漏 —— 人工策展(19 条) + 生成式覆盖
# **生成式覆盖**(2026-09-30 新增, tools/ad-coverage.mjs): 手工逐条写域名无法覆盖 500+ 个
#   有一手声明的平台, 故把判据固化成管线 —— ① 平台在 app-ads.txt 语料里有 ≥N 份声明
#   ② 双解析器 A 记录存活 ③ HTTPS 根路径非 200+HTML ④ 非多业务大厂/功能即产品
#   ⑤ 非泛解析根域(随机子域对照)。五道判据全过才生成规则, 逐条证据在
#   test/fixtures/ad-coverage/ledger.json, 产物漂移由 `npm run check:coverage` 判红。
#   实测: 5,694 个候选里 5,093 个无 A 记录、348 个转人工复核, 只有 253 条能自动生成 ——
#   "批量"与"取证"并不矛盾, 但批量必须过判据。
#   三者共同构成"广告域 REJECT 真正生效"的前置条件: 域名 REJECT 在 DNS 阶段完成, 而
#   自带解析的 SDK/浏览器会绕过系统 DNS 拿到真实 IP ⇒ 必须先收编解析面。
# **L1 消费层(依次在后)**: 单 App/单通道的处置, 依赖 L0 提供的基础面。
#   · qidian.plugin —— M7 脚本容器, 本仓全部 [Script] 能力寄生于此, 停用即全灭 (M5 单点)。
#   · jd.plugin —— 唯一带 [Script]+[MitM] 的自维护插件: 解密面 +1 (api.m.jd.com),
#     京东字段级净化 (7 个 functionId, 一律改写不整条 reject), 无 [Rule] 行。
#   · probe-block.plugin —— M3 上报/埋点拦截(友盟/厂商遥测/前端埋点/Bugly/ARMS/Firebase 六通道零重叠并集, 37 条)。
#     2026-09-30 由 6 个 probe-*.plugin 合并(与 ad-block 同形): 形状完全一致、无独立生命周期, 4 个还各只有 1–2 条域。
# L0 三项 + probe-block = 4 个**纯 L2** 插件(无 [MitM]/[Script], 零证书成本), 合计 131 条
# 域级/端口级 REJECT(59 + 13 + 19 + 38 + 端口/协议兜底, 逐条取证见各插件头部)。
# 默认姿态 enabled=true (2026-09-29 用户决策): 5 个非 qidian 插件随入口默认生效(2026-09-30 合并后)。
# 关闭方式: 改本行 enabled=false, 或客户端插件面板逐个停用。
# ⚠️ 关掉 L0 任一项 = 该层收编失效(加密 DNS/HTTPDNS 绕过回归), 而不是"少拦几条广告"。
https://ws.wenn.in/main/Plugin/ad-block.plugin, enabled=true, tag=广告平台拦截器（L0·人工+生成式覆盖）
https://ws.wenn.in/main/Plugin/dns-httpdns.plugin, enabled=true, tag=HTTPDNS 拦截器（L0·去广告依赖）
https://ws.wenn.in/main/Plugin/dns-leak.plugin, enabled=true, tag=DNS 防泄漏（L0·DoH/DoT 收编）
https://ws.wenn.in/main/Plugin/qidian.plugin, enabled=true, tag=起点全能助手 Pro
https://ws.wenn.in/main/Plugin/jd.plugin, enabled=true, tag=京东去广告 Pro
https://ws.wenn.in/main/Plugin/probe-block.plugin, enabled=true, tag=上报与埋点拦截器（M3·6 通道并集）

[Rewrite]
# 本段为空。历史曾有 5 条针对公共 DoH 端点 (/d 路径) 的 reject-200, 因两重死因失效:
#   ① 路径错 —— 真实端点在 /dns-query, /d 一律 404 或超时 (已实测);
#   ② 裸 IP 不在 [MitM] 正条目, 故 https:// 变体连 Rewrite 都进不去 (Rewrite 只对
#      HTTP 与经 MitM 解密的 HTTPS 生效)。
# 若将来要拦"应用绕过加密 DNS": 只能对**已知的第三方 DoH 端点**加 DOMAIN-SUFFIX
# REJECT, 且**绝不能**含 dns.alidns.com / doh.pub —— 那是本配置自身的 doh-server
# 上游 (surgio.conf.js customParams), 拦了即解析链自噬。

[MitM]
skip-server-cert-verify = false
hostname = -*.apple.com, -*.icloud.com, -*.icloud.com.cn, -*.95516.com, -*.cup.com.cn, -*.95516.com.cn, -*.unionpay.com, -*.icbc.com.cn, -*.mybank.icbc.com.cn, -*.icbc.com, -*.ccb.com, -*.ccb.cn, -*.boc.cn, -*.bankofchina.com, -*.jf365.boc.cn, -*.abchina.com, -*.abchina.com.cn, -*.cdn-static.abchina.com.cn, -*.cdn-static.abchina.com, -*.bankcomm.com, -*.bankcomm.cn, -*.creditcard.bankcomm.com, -*.creditcard.bankcomm.cn, -*.cmbchina.com, -*.cmbimg.com, -*.psbc.com, -*.spdb.com.cn, -*.spdbccc.com.cn, -*.citicbank.com, -*.citibank.com, -*.ecitic.com, -*.pingan.com.cn, -*.pingan.com, -*.hcz-member.pingan.com.cn, -*.iobs.pingan.com.cn, -*.stock.pingan.com, -*.cmbc.com.cn, -*.cib.com.cn, -*.cebbank.com, -*.ebchinabank.com, -*.hxb.com.cn, -*.cgbchina.com.cn, -*.95508.com, -*.static.95508.com, -*.bankofbeijing.com.cn, -*.bosc.cn, -*.js96008.com, -*.tenpay.com, -*.qianbao.qq.com, -redirector*.youtube.com, h5.if.qidian.com, magev6.if.qidian.com
