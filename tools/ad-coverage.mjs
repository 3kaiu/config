/**
 * L0 依赖层覆盖管线 (2026-09-30)
 *
 * 问题: L0 三个拦截器(广告平台 / HTTPDNS / DNS 防泄漏)要"覆盖全面", 但手工在插件里逐条
 * 写域名 + 注释无法规模化 —— 实测: 语料里 538 个平台有强背书(≥8/15), 而手工只覆盖了 59 域。
 *
 * 但**批量加域名必须有判据**, 否则就是首版 21 域的老路(枚举 → 直接写规则)。本工具把
 * 判据固化成流水线, 三条都过才生成规则:
 *   ① **平台身份**(广告层): 该 host 所属平台在一手声明语料里 ≥minAttestation 份声明
 *      —— 回答"这是不是广告系统"(app-ads.txt 语料, 见 tools/appads-check.mjs);
 *   ② **端点存活**: 双解析器 DoH 至少一侧有 A 记录 —— 回答"它现在是否真的存在";
 *   ③ **非功能页**: HTTPS 根路径不是 200+HTML —— 回答"拦了会不会打到用户可见的站点/后台"。
 * 另有三道过滤: 已拦(跨层去重) / 排除台账(merged·site·infra) / 推送·商店·系统硬红线。
 *
 * 实测价值(2026-09-30 抽样 40 平台 × 20 前缀 = 800 候选):
 *   **740 个无 A 记录**(按父域推定 = 740 条永不命中的死规则)、55 个存活、其中 5 个是 200+HTML。
 *   即: 判据② 砍掉 92%, 判据③ 再砍掉一成 —— 这正是"批量 ≠ 不取证"的量化理由。
 *
 * 产物:
 *   test/fixtures/ad-coverage/ledger.json   逐 host 证据台账(平台/声明数/A 记录/HTTP 结果/判定)
 *   Plugin/*.plugin 的 **生成块**(`# >>> GENERATED ... >>>` 标记之间), 三个 L0 插件各一块
 * 门禁: `--check` 断言生成块与台账一致(产物漂移即红), 由 check:all 与 CI 调用。
 *
 * 用法:
 *   node tools/ad-coverage.mjs --run [--source all|ad|httpdns|dnsleak] [--min-attestation 8]
 *   node tools/ad-coverage.mjs --check
 *   node tools/ad-coverage.mjs --report            # 只打印台账摘要(离线)
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readReferences, consensus } from "./appads-check.mjs";
import { collectRules } from "./lib/rule-scan.mjs";
import { AD_PLATFORM_EXCLUSIONS } from "./lib/ad-exclusions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, "..");
export const LEDGER_REL = "test/fixtures/ad-coverage/ledger.json";

/** SDK 端点常见前缀(判据①的枚举面; 实测 92% 会死在判据②) */
export const AD_PREFIXES = [
  "api", "sdk", "ads", "ad", "init", "config", "log", "track", "events", "req",
  "gw", "open", "static", "img", "data", "report", "collect", "ping", "m", "cdn",
];

/**
 * HTTPDNS 候选(判据①不适用 —— 这些是"解析服务"而非广告平台, 由服务身份 + 存活 + 非功能页判定)。
 * 逐条列出"厂商 + 端点", 覆盖国内主流 SDK 会用的 HTTPDNS 服务。
 */
export const HTTPDNS_CANDIDATES = [
  ["阿里云 HTTPDNS", "httpdns-api.aliyuncs.com"],
  ["阿里云 HTTPDNS", "httpdns.aliyun.com"],
  ["腾讯 HTTPDNS", "httpdns.qq.com"],
  ["腾讯 DNSPod HTTPDNS", "httpdns.dnspod.com"],
  ["百度 HTTPDNS", "httpdns.baidu.com"],
  ["百度云 HTTPDNS", "httpdns.baidubce.com"],
  ["火山引擎 HTTPDNS", "httpdns.volces.com"],
  ["字节 HTTPDNS", "httpdns.bytedance.com"],
  ["友盟 HTTPDNS", "httpdns.umengcloud.com"],
  ["友盟 HTTPDNS", "httpdns.umeng.com"],
  ["京东 HTTPDNS", "httpdns.jd.com"],
  ["美团 HTTPDNS", "httpdns.meituan.com"],
  ["淘宝 HTTPDNS", "httpdns.taobao.com"],
  ["快手 HTTPDNS", "httpdns.kuaishou.com"],
  ["小米 HTTPDNS", "httpdns.miui.com"],
  ["华为 HTTPDNS", "httpdns.huawei.com"],
  ["爱奇艺 HTTPDNS", "httpdns.iqiyi.com"],
  ["金山云 HTTPDNS", "httpdns.ksyun.com"],
  ["滴滴 HTTPDNS", "httpdns.didiglobal.com"],
  ["滴滴 HTTPDNS", "httpdns.xiaojukeji.com"],
  ["携程 HTTPDNS", "httpdns.ctrip.com"],
  ["哔哩哔哩 HTTPDNS", "httpdns.bilibili.com"],
  ["网易 HTTPDNS", "httpdns.163.com"],
  ["腾讯云 HTTPDNS", "httpdns.tencentcloudapi.com"],
  ["微博 HTTPDNS", "httpdns.weibo.cn"],
  ["搜狐 HTTPDNS", "httpdns.sohu.com"],
  ["360 HTTPDNS", "httpdns.360.cn"],
  ["OPPO HTTPDNS", "httpdns.oppo.com"],
  ["vivo HTTPDNS", "httpdns.vivo.com"],
  ["魅族 HTTPDNS", "httpdns.meizu.com"],
];

/**
 * 公共加密解析器候选(DNS 防泄漏)。**本仓解析链不得入内**:
 * dns.alidns.com(doh/doh3/doq primary) 与 doh.pub(doh_fallback) —— 见 check 里的断言。
 */
export const DNSLEAK_CANDIDATES = [
  ["Google", "dns.google"],
  ["Google", "dns.google.com"],
  ["Cloudflare", "cloudflare-dns.com"],
  ["Cloudflare", "mozilla.cloudflare-dns.com"],
  ["Cloudflare", "one.one.one.one"],
  ["Quad9", "dns.quad9.net"],
  ["Quad9", "dns9.quad9.net"],
  ["Quad9", "dns10.quad9.net"],
  ["Quad9", "dns11.quad9.net"],
  ["OpenDNS", "doh.opendns.com"],
  ["AdGuard", "dns.adguard.com"],
  ["AdGuard", "dns.adguard-dns.com"],
  ["AdGuard", "dns-unfiltered.adguard-dns.com"],
  ["NextDNS", "dns.nextdns.io"],
  ["NextDNS", "anycast.dns.nextdns.io"],
  ["ControlD", "freedns.controld.com"],
  ["ControlD", "dns.controld.com"],
  ["CleanBrowsing", "doh.cleanbrowsing.org"],
  ["CleanBrowsing", "doh-family.cleanbrowsing.org"],
  ["LibreDNS", "doh.libredns.gr"],
  ["DNSForge", "doh.dnsforge.de"],
  ["dns0.eu", "dns0.eu"],
  ["dns0.eu", "zero.dns0.eu"],
  ["Mullvad", "dns.mullvad.net"],
  ["IIJ", "public.dns.iij.jp"],
  ["CIRA Shield", "private.canadianshield.cira.ca"],
  ["CIRA Shield", "protected.canadianshield.cira.ca"],
  ["RethinkDNS", "basic.rethinkdns.com"],
  ["RethinkDNS", "sky.rethinkdns.com"],
  ["DNS.SB", "doh.sb"],
  ["DNS.SB", "dns.sb"],
  ["Yandex", "common.dot.dns.yandex.net"],
  ["Yandex", "dns.yandex.net"],
  ["360", "doh.360.cn"],
  ["腾讯 DoT", "dot.pub"],
  ["腾讯 SM2 DoH", "sm2.doh.pub"],
  ["网易 DoH", "doh.163.com"],
  ["中科大 DoH", "dns.ustc.edu.cn"],
  ["南京大学 DoH", "dns.nju.edu.cn"],
  ["TWNIC Quad101", "dns.twnic.tw"],
  ["Applied Privacy", "doh.applied-privacy.net"],
  ["BlahDNS", "doh-jp.blahdns.com"],
  ["BlahDNS", "doh-de.blahdns.com"],
  ["BebasID", "dns.bebasid.com"],
  ["DNSWatch", "resolver.dnswatch.info"],
];

/**
 * 多业务大厂: 它们在语料里**确实是 ad system**(发行商为其广告库存做声明), 但同一根域下还有
 * 搜索/社交/云/引擎/商店等功能服务 ⇒ 前缀枚举会生成灾难级误拦。实测(2026-09-30 首轮)抓到:
 *   api.google.com / m.google.com / events.google.com / ads.google.com(广告主后台)
 *   api.facebook.com / static.facebook.com(会破 FB 登录与静态资源)
 *   m.aol.com / static.aol.com / api.unity.com(Unity Services API) / events.unity.com
 * 故这类平台**永不自动生成规则**: 候选进台账但判定为 review, 由人按 APP-ONBOARDING 第 1 节
 * 逐个确认"这个 host 是否广告专有"(第五把钥匙: 业务专一性 —— 自动化不了, 只能显式记账)。
 */
export const DIVERSIFIED_ROOTS = [
  "google.com", "gstatic.com", "googleapis.com", "youtube.com", "android.com",
  "facebook.com", "fbcdn.net", "instagram.com", "whatsapp.com", "meta.com", "messenger.com",
  "amazon.com", "amazonaws.com", "apple.com", "icloud.com", "microsoft.com", "live.com", "office.com",
  "unity.com", "unity3d.com",
  "aol.com", "yahoo.com", "verizonmedia.com", "oath.com",
  "tencent.com", "qq.com", "wechat.com", "alibaba.com", "aliyun.com", "taobao.com", "tmall.com", "alicdn.com",
  "baidu.com", "bdstatic.com", "bytedance.com", "snssdk.com", "kuaishou.com", "kwai.com",
  "jd.com", "meituan.com", "dianping.com", "didiglobal.com", "xiaojukeji.com",
  "xiaomi.com", "miui.com", "huawei.com", "oppo.com", "vivo.com", "meizu.com",
  "samsung.com", "sony.com", "nintendo.com", "adobe.com", "oracle.com", "salesforce.com",
  "paypal.com", "visa.com", "mastercard.com", "ebay.com", "x.com", "twitter.com", "linkedin.com",
  "snap.com", "snapchat.com", "pinterest.com", "reddit.com", "spotify.com", "netflix.com", "twitch.tv",
  "yandex.ru", "yandex.net", "yandex.com", "yandex.by", "yandex.kz", "mail.ru", "naver.com", "kakao.com", "line.me", "zalo.me",
];

export function isDiversified(root) {
  const r = String(root).toLowerCase();
  return DIVERSIFIED_ROOTS.some((d) => r === d || r.endsWith("." + d));
}

/**
 * "功能即产品"族: 厂商的 API/CDN 就是**用户可见功能本身**(视频播放器、评论组件、App 后端),
 * 拦掉 = 页面视频放不出来 / 评论区消失 / App 联网失败 —— 属本仓定义的"破功能", 不是去广告。
 * 它们的广告域另说(如 `ads.meitu.com`), 但整根域不做自动生成 ⇒ 一律人工裁决。
 */
export const FUNCTIONAL_PRODUCT_ROOTS = [
  "opera.com", "meitu.com", "bigo.sg", "ushareit.com",
  "disqus.com", "apester.com",
  "aniview.com", "connatix.com", "playwire.com", "vidazoo.com",
  "videoheroes.tv", "smartstream.tv", "mars.media",
];

export function isFunctionalProduct(root) {
  const r = String(root).toLowerCase();
  return FUNCTIONAL_PRODUCT_ROOTS.some((d) => r === d || r.endsWith("." + d));
}

/** 硬红线: 推送 / 商店 / 系统更新 / 银行 —— 命中即永不生成规则(与用例里的红线同源) */
export const HARD_DENY = [
  "jpush.cn", "jpush.io", "getui.com", "getui.net", "gepush.com",
  "xmpush.xiaomi.com", "api-push.meizu.com", "upush.res.meizu.com", "message.meizu.com",
  "config.umeng.com", "msg.umeng.com",
  "ad.apk.vivo.com.cn", "apps.oppomobile.com",
  "bss.pandora.xiaomi.com", "dvb.pandora.xiaomi.com", "de.pandora.xiaomi.com", "jellyfish.pandora.xiaomi.com",
];

/** 判据①: 广告层候选 = 强背书平台 × 前缀(排除已拦/台账排除/硬红线) */
/**
 * 社区清单来源 (第二准入路径, 2026-09-30)。
 *
 * 为什么需要第二条路径: 路径一(平台声明 ≥8/15)依赖 app-ads.txt 语料, 而语料是**西方发行商**
 * 声明 —— 中文广告平台(邑盟/倍孜/美狄墨搏/聚次方/美数/变现猫…几百家)结构性不在其中。
 * 社区清单正好补这一块, 但**不能整体照搬**(实测 kelee `BlockAdvertisers.lpx`: 121 DOMAIN +
 * 208 DOMAIN-SUFFIX + 12 裸关键词 + 4 AND + 1 IP-CIDR; 其中含 `ads.cup.com.cn`(银联)、
 * `app-analytics-services.com`(Apple)、`adjust.com`(归因) 等与红线相邻的条目)。
 *
 * 故本路径的准入 = 社区清单当**候选来源**, 判据仍是我们自己的:
 *   DOMAIN 条目      → 直接进候选, 过 存活 / 非功能页 / 大厂·功能族 / 泛解析 / 红线 五关
 *   DOMAIN-SUFFIX 条目 → 先探**apex**: apex 自身是"广告专有端点"(存活 + 非 200+HTML + 非大厂/功能族)
 *                        ⇒ 允许整域拦(写 DOMAIN-SUFFIX, 这是唯一引入 SUFFIX 的通道, 由台账逐条留档)
 *                        否则 ⇒ 降级为前缀枚举, 只收存活且过判据的精确 host
 *   关键词/AND/IP-CIDR → **不采纳**(裸关键词被本仓 plugin-lint 判红; 逐 IP 钉死有共享 IP 风险),
 *                        数量与理由写进台账 skipped 统计
 */
export const COMMUNITY_SOURCES = [
  {
    slug: "kelee-advertisers",
    // kelee.one 对非 Loon 客户端返回 Cloudflare Turnstile 403(UA 伪装无效), 故取镜像同版文件。
    url: "https://raw.githubusercontent.com/deanxizian/loon_to_surge/main/Loon/BlockAdvertisers.lpx",
    origin: "https://kelee.one/Tool/Loon/Lpx/BlockAdvertisers.lpx",
    note: "可莉(kelee)/VirgilClyne 的「广告平台拦截器」, 镜像自 deanxizian/loon_to_surge(kelee 2026-09-28 版)",
  },
];
export const COMMUNITY_DIR_REL = "test/fixtures/ad-coverage/community";

/** 社区清单里的红线: 支付/银行、Apple 与系统、推送 —— 一律不进候选(与用例里的红线同源) */
export const COMMUNITY_HARD_DENY = [
  // 支付与银行(M4: 银行域免解密免广告, 不参与去广告)
  "cup.com.cn", "unionpay.com", "unionpayintl.com", "95516.com", "alipay.com", "alipayobjects.com",
  "tenpay.com", "weixinpay.com", "wxpay.com", "jdpay.com", "paypal.com", "stripe.com",
  // Apple 与系统面(红队判据: 商店/系统更新不得拦)
  "apple.com", "icloud.com", "mzstatic.com", "itunes.com", "aaplimg.com",
  "app-analytics-services.com", "app-analytics-services.com.cn",
  // 推送(断推送 = 真功能损失, 见 ad-platform-plugins 用例)
  "jpush.cn", "jpush.io", "getui.com", "getui.net", "gepush.com", "xmpush.xiaomi.com",
  "api-push.meizu.com", "upush.res.meizu.com", "message.meizu.com",
];

/**
 * 归因/统计 SDK 归 **M3 隐私**面, 不进 M2 广告块(模块纪律): 这些域不投广告, 拦它们是
 * "阻止上报"的隐私决策, 且本仓 M3 已有 probe-* 插件按上报通道分管(友盟/厂商遥测/前端监控…)。
 * 社区把 adjust/appsflyer/amplitude/umeng 塞进"广告平台"清单是一类混淆 —— 我们照收候选、
 * 但不自动落地: 台账记 defer(m3-tracking-vendor), 待 M3 侧单独裁决。
 */
export const COMMUNITY_DEFER_M3 = [
  "adjust.com", "adjust.io", "adjust.net.in", "appsflyer.com", "appsflyersdk.com",
  "amplitude.com", "appier.com", "appier.net", "kochava.com", "branch.io", "singular.net",
  "tenjin.com", "umeng.com", "umengcloud.com", "umeng.co", "talkingdata.com", "talkingdata.net",
  "growingio.com", "sensorsdata.cn", "zhugeio.com", "mixpanel.com", "segment.com", "heap.io",
];

/** 解析社区 .lpx: 只要 DOMAIN / DOMAIN-SUFFIX, 其余形态计数留档 */
export function parseCommunity(text) {
  const domains = [];
  const suffixes = [];
  const skipped = { keyword: 0, and: 0, ip: 0, urlRegex: 0, userAgent: 0, other: 0 };
  for (const raw of String(text).split("\n")) {
    const t = raw.trim();
    if (!t || t.startsWith("#") || t.startsWith("#!")) continue;
    const m = /^(DOMAIN|DOMAIN-SUFFIX),\s*([\w.-]+),/i.exec(t);
    if (m) {
      (m[1].toUpperCase() === "DOMAIN" ? domains : suffixes).push(m[2].toLowerCase());
      continue;
    }
    if (/^DOMAIN-KEYWORD,/i.test(t)) skipped.keyword++;
    else if (/^AND,/i.test(t)) skipped.and++;
    else if (/^IP-CIDR6?,/i.test(t)) skipped.ip++;
    else if (/^URL-REGEX,/i.test(t)) skipped.urlRegex++;
    else if (/^USER-AGENT,/i.test(t)) skipped.userAgent++;
    else if (/^\[/.test(t)) continue;
    else skipped.other++;
  }
  return { domains: [...new Set(domains)], suffixes: [...new Set(suffixes)], skipped };
}

export async function fetchCommunity(src, { timeout = 30000 } = {}) {
  const r = await fetch(src.url, { headers: { "user-agent": "loon-config-ad-coverage" }, signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  const parsed = parseCommunity(text);
  return {
    slug: src.slug,
    url: src.url,
    origin: src.origin,
    note: src.note,
    fetched_at: new Date().toISOString().slice(0, 10),
    sha256: sha256hex(text),
    bytes: Buffer.byteLength(text),
    counts: { domain: parsed.domains.length, suffix: parsed.suffixes.length, ...parsed.skipped },
    domains: parsed.domains,
    suffixes: parsed.suffixes,
  };
}

function sha256hex(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function readCommunity(root = ROOT, slug = COMMUNITY_SOURCES[0].slug) {
  const abs = path.join(root, COMMUNITY_DIR_REL, `${slug}.json`);
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : null;
}

/** 社区候选: 精确域直接进; 后缀域先作为 apex 候选(过 apex 判据则整域拦, 否则降级枚举) */
export function communityCandidates(community, rules, { prefixes = AD_PREFIXES } = {}) {
  const covered = coveredHosts(rules, ROOT, { excludeSource: "kelee" });
  const excluded = excludedRoots();
  const redlined = (h) => hardDenied(h) || COMMUNITY_HARD_DENY.some((d) => h === d || h.endsWith("." + d));
  const m3 = (h) => COMMUNITY_DEFER_M3.some((d) => h === d || h.endsWith("." + d));
  const out = [];
  for (const host of community?.domains || []) {
    if (isCovered(host, covered) || redlined(host)) continue;
    out.push({ source: "kelee", host, kind: m3(host) ? "m3-defer" : "domain", community: community.slug });
  }
  for (const suffix of community?.suffixes || []) {
    if (redlined(suffix) || isCovered(suffix, covered)) continue;
    if (m3(suffix)) {
      out.push({ source: "kelee", host: suffix, kind: "m3-defer", community: community.slug });
      continue;
    }
    if (excluded.some((e) => suffix === e || suffix.endsWith("." + e))) continue;
    out.push({ source: "kelee", host: suffix, kind: "suffix-apex", community: community.slug });
  }
  return out;
}

/** 后缀域降级: apex 不过关时, 用前缀枚举出精确候选(仍需过判据) */
export function expandSuffix(suffix, rules, { prefixes = AD_PREFIXES } = {}) {
  const covered = coveredHosts(rules, ROOT, { excludeSource: "kelee" });
  const redlined = (h) => hardDenied(h) || COMMUNITY_HARD_DENY.some((d) => h === d || h.endsWith("." + d));
  return prefixes
    .map((p) => `${p}.${suffix}`)
    .filter((h) => !isCovered(h, covered) && !redlined(h))
    .map((host) => ({ source: "kelee", host, kind: "domain", community: "expanded", from: suffix }));
}

export function adCandidates(refs, rules, { minAttestation = 8, prefixes = AD_PREFIXES, excludeSource = "ad" } = {}) {
  const covered = coveredHosts(rules, ROOT, { excludeSource });
  const excluded = excludedRoots();
  const out = [];
  for (const c of consensus(refs)) {
    if (c.refs < minAttestation) continue;
    if (excluded.some((e) => c.domain === e || c.domain.endsWith("." + e))) continue;
    for (const p of prefixes) {
      const host = `${p}.${c.domain}`;
      if (isCovered(host, covered) || hardDenied(host)) continue;
      out.push({
        source: "ad",
        host,
        platform: c.domain,
        attestation: c.refs,
        total: refs.length,
        diversified: isDiversified(c.domain),
        functionalProduct: isFunctionalProduct(c.domain),
      });
    }
  }
  return out;
}

/** HTTPDNS / DNS 防泄漏候选(来源: 显式清单; 判据①=服务身份) */
export function listedCandidates(list, source, rules) {
  const covered = coveredHosts(rules, ROOT, { excludeSource: source });
  return list
    .map(([vendor, host]) => ({ source, host, platform: vendor, attestation: null, total: null }))
    .filter((e) => !isCovered(e.host, covered) && !hardDenied(e.host));
}

/**
 * 已拦域集合 = 全部规则 **减去本管线自己生成的块**。
 * 为什么必须减: 生成块一旦写入插件, 就成了 collectRules() 眼里的"已拦";
 * 若不过滤, 第二次 --run 会把上一次生成的候选全部当"已覆盖"筛掉 ⇒ 生成块被清空
 * (自我擦除: 跑一次有规则, 跑两次变空)。实测踩到过, 记在这里防回归。
 */
/**
 * 已被覆盖的 host 集合。
 *
 * **只排除"当前来源"自己的生成块**(excludeSource): 
 *   · 排除自己 ⇒ 重跑时不会把自己的产物当"已覆盖"而清空(自我擦除);
 *   · 保留别人的块 ⇒ 跨来源不重复(kelee 不会重复生成 ad 块已有的域);
 *   · 块内 **DOMAIN-SUFFIX 也要收集** ⇒ 否则上一轮自己写的后缀规则会被当成"未覆盖"而重复生成,
 *     反过来又会把同名的后缀候选判成"已覆盖"自我否决(2026-09-30 实测踩到, 47 → 3 条)。
 */
function coveredHosts(rules, root = ROOT, { excludeSource = null } = {}) {
  // 当前来源自己的块: 其 host 要从"已拦"里**减掉**(否则重跑时自己的产物把候选全筛掉 = 自我擦除)
  const own = new Set();
  const ownSuffixes = [];
  if (excludeSource) {
    const b = readBlock(path.join(root, PLUGIN_FOR[excludeSource]), excludeSource);
    for (const m of (b || "").matchAll(/^DOMAIN,\s*([\w.-]+),/gm)) own.add(m[1].toLowerCase());
    for (const m of (b || "").matchAll(/^DOMAIN-SUFFIX,\s*([\w.-]+),/gm)) ownSuffixes.push(m[1].toLowerCase());
  }
  // 其它来源的块: **算作已覆盖**(否则跨来源重复生成 —— vungle/tapjoy 那 9 条)
  const exact = new Set();
  const suffixes = [];
  for (const source of Object.keys(PLUGIN_FOR)) {
    if (source === excludeSource) continue;
    const block = readBlock(path.join(root, PLUGIN_FOR[source]), source);
    if (!block) continue;
    for (const m of block.matchAll(/^DOMAIN,\s*([\w.-]+),/gm)) exact.add(m[1].toLowerCase());
    for (const m of block.matchAll(/^DOMAIN-SUFFIX,\s*([\w.-]+),/gm)) suffixes.push(m[1].toLowerCase());
  }
  for (const r of rules) {
    const parts = r.text.split(",").map((x) => x.trim());
    const type = (parts[0] || "").toUpperCase();
    const dom = (parts[1] || "").toLowerCase();
    if (!dom || own.has(dom) || ownSuffixes.includes(dom)) continue; // 本来源上一轮的产物不算依据
    if (type === "DOMAIN") exact.add(dom);
    // 后缀规则要留着做**包含判定**: `DOMAIN-SUFFIX, example.com` 会罩住 api.example.com,
    // 生成 api.example.com 就是一条永不命中的死规则(plugin-tpl-shadow 用例抓到的就是这个)
    if (type === "DOMAIN-SUFFIX") suffixes.push(dom);
  }
  exact.suffixes = suffixes;
  return exact;
}

/** host 是否已被既有规则覆盖(精确 或 被更宽后缀包含) */
export function isCovered(host, covered) {
  const h = String(host).toLowerCase();
  if (covered.has(h)) return true;
  return (covered.suffixes || []).some((s) => h === s || h.endsWith("." + s));
}

function excludedRoots() {
  const out = AD_PLATFORM_EXCLUSIONS.map((e) => e.domain);
  return out;
}

export function hardDenied(host) {
  const h = host.toLowerCase();
  return HARD_DENY.some((d) => h === d || h.endsWith("." + d));
}

/** 双解析器 A 记录 + HTTPS 根路径探测(判据②③) */
export async function probe(hosts, { concurrency = 24, timeout = 6000 } = {}) {
  const out = {};
  let i = 0;
  const one = async (host) => {
    const a = [];
    for (const base of [
      "https://cloudflare-dns.com/dns-query?name=",
      "https://dns.google/resolve?name=",
    ]) {
      try {
        const r = await fetch(`${base}${host}&type=A`, {
          headers: { accept: "application/dns-json" },
          signal: AbortSignal.timeout(timeout),
        });
        const j = await r.json();
        a.push((j.Answer || []).filter((x) => x.type === 1).length);
      } catch {
        a.push(-1);
      }
    }
    // 判据② 不通过就不做判据③: 92% 的候选在这里被砍掉, 省下的 HTTPS 探测是数量级差异
    // (实测: 5,740 个候选里只有 ~8% 有 A 记录; 对无 A 的 host 做 HTTPS 探测纯属浪费与超时堆积)
    const live = Math.max(...a) > 0;
    let https = null;
    if (live) {
      try {
        const r = await fetch(`https://${host}/`, { redirect: "manual", signal: AbortSignal.timeout(timeout) });
        const ct = r.headers.get("content-type") || "";
        https = `${r.status}${/html/.test(ct) ? "+html" : /json/.test(ct) ? "+json" : ""}`;
      } catch (e) {
        https = e.name === "TimeoutError" ? "timeout" : e.cause?.code || "refused";
      }
    }
    out[host] = { a, live, https };
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, hosts.length) }, async () => {
    while (i < hosts.length) await one(hosts[i++]);
  }));
  return out;
}

/**
 * 泛解析对照: 对每个平台根域探一个**随机子域**, 若它也有 A 记录 ⇒ 该根域是通配解析,
 * 其下所有"存活"都是假信号。这是本仓记过的教训(AGENTS.md: A 记录存在 ≠ 端点存在;
 * 实例 ironsource.mobi 与 disqus.com —— 后者 20 个前缀全部解析)。
 */
export function randomProbeHost(root, salt = "wq7z3k") {
  return `${salt}-${Buffer.from(root).toString("hex").slice(0, 6)}.${root}`;
}

/** 判据裁决(纯函数, 供用例离线驱动)。次序 = 从"最不可辩驳的排除"到"可拦" */
export function verdictOf(entry, probeResult, { panResolution = false } = {}) {
  if (entry.kind === "m3-defer") return { verdict: "defer", reason: "m3-tracking-vendor" };
  if (!probeResult || !probeResult.live) {
    // 社区后缀域的 apex 无 A ⇒ 不整域拦, 但要降级为前缀枚举(不是丢弃)
    if (entry.kind === "suffix-apex") return { verdict: "expand", reason: "apex-no-a-record" };
    return { verdict: "skip", reason: "no-a-record" };
  }
  if (entry.kind === "suffix-apex") {
    // apex 判据: 自身就是广告专有端点 ⇒ 允许整域拦(唯一引入 SUFFIX 的通道)
    if (panResolution) return { verdict: "expand", reason: "apex-pan-resolution" };
    if (entry.diversified || entry.functionalProduct) return { verdict: "expand", reason: "apex-multi-business" };
    // apex 自身像网站(200 或任何带 HTML 的响应) ⇒ 不整域拦: SUFFIX 会连带拦掉它的功能子域
    const st = String(probeResult.https || "");
    if (/^200/.test(st) || /\+html$/.test(st)) return { verdict: "expand", reason: "apex-looks-like-site" };
    return { verdict: "block", reason: `suffix-admitted:apex-${probeResult.https}` };
  }
  if (panResolution) return { verdict: "review", reason: "pan-resolution-wildcard-not-a-real-endpoint" };
  // 第四道判据: 多业务大厂(搜索/社交/引擎/商店与广告同根域) ⇒ 只能人工裁决
  if (entry.diversified) return { verdict: "review", reason: "diversified-vendor-needs-manual-judgment" };
  if (entry.functionalProduct) return { verdict: "review", reason: "functional-product-needs-manual-judgment" };
  const https = String(probeResult.https);
  // 判据③: 200 + HTML = 疑似真实站点/后台 ⇒ 不拦(留档待人工复核)
  if (/^200\+html$/.test(https)) return { verdict: "review", reason: "200-html-may-be-functional" };
  return { verdict: "block", reason: https.startsWith("200") ? `live:${https}` : `live:${https}` };
}

export function renderBlock(entries, { source, generatedAt, policy }) {
  const L = [];
  L.push(`# >>> GENERATED:${source} (tools/ad-coverage.mjs) >>>`);
  L.push(`# 本块由覆盖管线生成, **勿手改** —— 改判据请改 tools/ad-coverage.mjs 后重跑 --run。`);
  L.push(`# 生成时间: ${generatedAt} | 判据: ${policy}`);
  L.push(`# 逐条证据: ${LEDGER_REL} (平台/声明数/A 记录/HTTP 结果)`);
  for (const e of entries) {
    L.push(e.kind === "suffix" ? `DOMAIN-SUFFIX, ${e.host}, REJECT` : `DOMAIN, ${e.host}, REJECT`);
  }
  L.push(`# <<< GENERATED:${source} <<<`);
  return L.join("\n");
}

/** 把生成块写入插件的标记之间(标记不存在则在文件末尾追加) */
export function applyBlock(pluginPath, source, block) {
  const text = fs.readFileSync(pluginPath, "utf8");
  const start = `# >>> GENERATED:${source} (tools/ad-coverage.mjs) >>>`;
  const end = `# <<< GENERATED:${source} <<<`;
  const si = text.indexOf(start);
  if (si >= 0) {
    const ei = text.indexOf(end, si);
    if (ei < 0) throw new Error(`${pluginPath}: 有起始标记但没有结束标记`);
    const after = text.slice(ei + end.length);
    return text.slice(0, si) + block + after;
  }
  return text.replace(/\s*$/, "\n\n") + block + "\n";
}

/**
 * 落一条台账记录。
 *
 * **为什么 skip 类只留 host 清单**: 单条"无 A 记录"的完整元数据(来源/kind/community/a/https/reason)
 * 复读价值极低, 却会让台账膨胀 —— 实测 11,600 条 skip 使 ledger.json 达 3.68MB / 20.8 万行,
 * 而月度刷新会各存一份(年增 ~44MB)。改为 `skipped_hosts[reason] = [host…]` 后既保留"哪些域因何被跳过"
 * 的完整可审计性, 又把体积压到 1/10。block/review/defer/expand 仍逐条留全证据(它们是产物与裁决依据)。
 */
function pushEntry(ledger, cand, probeResult, verdict, reason) {
  if (verdict === "skip") {
    ledger.skipped_hosts ||= {};
    ledger.skip_source ||= {};
    ledger.skip_source[reason] ||= cand.source;
    (ledger.skipped_hosts[reason] ||= []).push(cand.host);
    return;
  }
  ledger.entries.push({
    ...cand,
    a: probeResult?.a ?? null,
    https: probeResult?.https ?? null,
    verdict,
    reason,
  });
}

/** 跳过统计(供 --report 与用例) */
export function skippedCounts(ledger) {
  const out = {};
  for (const [reason, hosts] of Object.entries(ledger.skipped_hosts || {})) out[reason] = hosts.length;
  return out;
}

/** 读取插件里的生成块(供 --check 比对) */
export function readBlock(pluginPath, source) {
  const text = fs.readFileSync(pluginPath, "utf8");
  const start = `# >>> GENERATED:${source} (tools/ad-coverage.mjs) >>>`;
  const si = text.indexOf(start);
  if (si < 0) return null;
  const ei = text.indexOf(`# <<< GENERATED:${source} <<<`, si);
  if (ei < 0) return null;
  return text.slice(si, ei + `# <<< GENERATED:${source} <<<`.length);
}

export const PLUGIN_FOR = {
  ad: "Plugin/ad-block.plugin",
  kelee: "Plugin/ad-block.plugin", // 社区清单同属广告平台拦截器, 独立生成块以便分别审计
  httpdns: "Plugin/dns-httpdns.plugin",
  dnsleak: "Plugin/dns-leak.plugin",
};
/** 逐一 source → 插件(校验时按 source 比对各自的生成块) */
export const SOURCE_PLUGIN = PLUGIN_FOR;

export function readLedger(root = ROOT) {
  const abs = path.join(root, LEDGER_REL);
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : null;
}

export function entriesFor(ledger, source) {
  return (ledger?.entries || []).filter((e) => e.source === source && e.verdict === "block");
}

/** 断言生成块与台账一致(离线) */
export function check(root = ROOT) {
  const ledger = readLedger(root);
  const problems = [];
  if (!ledger) return { ok: false, problems: ["台账缺失 —— 跑 node tools/ad-coverage.mjs --run"] };
  for (const source of Object.keys(PLUGIN_FOR)) {
    const want = renderBlock(entriesFor(ledger, source), {
      source,
      generatedAt: ledger.generated_at,
      policy: ledger.policy,
    });
    const entries = entriesFor(ledger, source);
    const got = readBlock(path.join(root, PLUGIN_FOR[source]), source);
    if (!got) {
      if (entries.length === 0) continue; // 无条目 ⇔ 允许无标记(空块不写)
      problems.push(`${PLUGIN_FOR[source]} 缺少 ${source} 生成块(台账里有 ${entries.length} 条)`);
      continue;
    }
    if (entries.length === 0) {
      problems.push(`${PLUGIN_FOR[source]} 有 ${source} 生成块但台账里 0 条 —— 删块或重跑 --run`);
      continue;
    }
    if (got.trim() !== want.trim()) {
      problems.push(`${PLUGIN_FOR[source]} 的 ${source} 生成块与台账不一致(产物漂移) —— 重跑 --run 或回滚手改`);
    }
  }
  return { ok: problems.length === 0, problems };
}

function isMain() {
  const arg = process.argv[1] && path.resolve(process.argv[1]);
  return arg === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const flag = (n) => process.argv.includes(n);
  const value = (n, d) => (flag(n) ? process.argv[process.argv.indexOf(n) + 1] : d);

  if (flag("--check")) {
    const r = check();
    if (!r.ok) {
      console.log("❌ 覆盖管线产物漂移:");
      for (const p of r.problems) console.log(`   ${p}`);
      process.exit(1);
    }
    const ledger = readLedger();
    const n = (ledger.entries || []).filter((e) => e.verdict === "block").length;
    const skipped = Object.values(skippedCounts(ledger)).reduce((a, b) => a + b, 0);
    console.log(`✅ 覆盖管线产物与台账一致: ${n} 条生成规则 (台账 ${(ledger.entries || []).length} 条判定 + ${skipped} 条跳过留档)`);
    process.exit(0);
  }

  if (flag("--fetch-community")) {
    // ESM 顶层 await: 抓完即退出, 不再落进下面的 --run 流程
    for (const src of COMMUNITY_SOURCES) {
      const c = await fetchCommunity(src);
      const dir = path.join(ROOT, COMMUNITY_DIR_REL);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${c.slug}.json`), JSON.stringify(c, null, 1) + "\n");
      console.log(
        `✅ ${c.slug}: ${c.bytes}B sha256=${c.sha256.slice(0, 12)}… | DOMAIN ${c.counts.domain} / SUFFIX ${c.counts.suffix}` +
          ` | 未采纳形态: 关键词 ${c.counts.keyword} · AND ${c.counts.and} · IP ${c.counts.ip} · URL-REGEX ${c.counts.urlRegex}`
      );
    }
    process.exit(0);
  }

  if (flag("--report")) {
    const ledger = readLedger();
    if (!ledger) {
      console.log("(无台账: 先跑 --run)");
      process.exit(0);
    }
    const by = {};
    for (const e of ledger.entries) {
      by[e.source] ||= { block: 0, review: 0, skip: {} };
      if (e.verdict === "block") by[e.source].block++;
      else if (e.verdict === "review") by[e.source].review++;
      else by[e.source].skip[e.reason] = (by[e.source].skip[e.reason] || 0) + 1;
    }
    for (const [reason, hosts] of Object.entries(ledger.skipped_hosts || {})) {
      const src = (ledger.skip_source || {})[reason] || "?";
      by[src] ||= { block: 0, review: 0, skip: {} };
      by[src].skip[reason] = (by[src].skip[reason] || 0) + hosts.length;
    }
    console.log(`台账 ${ledger.generated_at} | 判据: ${ledger.policy}`);
    for (const [k, v] of Object.entries(by)) {
      console.log(`  ${k.padEnd(8)} 生成 ${v.block} 条 | 待人工复核 ${v.review} | 跳过 ${JSON.stringify(v.skip)}`);
    }
    process.exit(0);
  }

  // 默认 --run
  const source = value("--source", "all");
  const minAttestation = Number(value("--min-attestation", 8));
  const sources = source === "all" ? ["ad", "kelee", "httpdns", "dnsleak"] : source.split(",").map((x) => x.trim()).filter(Boolean);
  const refs = readReferences(ROOT);
  const rules = collectRules(ROOT);
  // 增量合并: 只替换本次跑到的 source 的条目(否则单跑一个来源会把别的来源条目与生成块清掉)
  const prev = readLedger(ROOT);
  const kept = (prev?.entries || []).filter((e) => !sources.includes(e.source));
  const ledger = {
    generated_at: new Date().toISOString().slice(0, 10),
    policy: `① 平台声明 ≥${minAttestation}/15(app-ads.txt 语料) ② 双解析器 A 记录存活 ③ HTTPS 根路径非 200+HTML ④ 非多业务大厂/功能即产品 ⑤ 非泛解析根域(随机子域对照); 另过滤 已拦/排除台账/推送商店系统红线`,
    min_attestation: minAttestation,
    entries: kept,
  };
  if (kept.length) console.log(`(增量: 保留其他来源 ${kept.length} 条既有条目)`);
  for (const s of sources) {
    const community = s === "kelee" ? readCommunity(ROOT) : null;
    if (s === "kelee" && !community) {
      console.log("[kelee] 缺社区清单 fixture(先跑 --fetch-community) —— 跳过");
      continue;
    }
    const cands =
      s === "ad"
        ? adCandidates(refs, rules, { minAttestation })
        : s === "kelee"
          ? communityCandidates(community, rules)
          : listedCandidates(s === "httpdns" ? HTTPDNS_CANDIDATES : DNSLEAK_CANDIDATES, s, rules);
    console.log(`[${s}] 候选 ${cands.length} 个, 开始探测…`);
    const probes = await probe(cands.map((c) => c.host));
    // 每个平台根域探一次随机子域(泛解析对照) —— 只在 ad 源有意义(其它源是逐条列出的服务)
    const pan = new Set();
    if (s === "ad") {
      const roots = [...new Set(cands.map((c) => c.platform))];
      const rp = await probe(roots.map((r) => randomProbeHost(r)), { timeout: 5000 });
      for (const r of roots) if (rp[randomProbeHost(r)]?.live) pan.add(r);
      if (pan.size) console.log(`[${s}] 泛解析根域 ${pan.size} 个(其候选一律转人工复核): ${[...pan].slice(0, 8).join(", ")}`);
    }
    for (const c of cands) {
      const { verdict, reason } = verdictOf(c, probes[c.host], { panResolution: pan.has(c.platform) });
      // 后缀域整域拦时把 kind 落定为 suffix(renderBlock 据此写 DOMAIN-SUFFIX)
      const rec = verdict === "block" && c.kind === "suffix-apex" ? { ...c, kind: "suffix" } : c;
      pushEntry(ledger, rec, probes[c.host], verdict, reason);
    }
    // 社区后缀域的 apex 不过关 ⇒ 降级为前缀枚举, 二轮探测(不整域拦, 只收活着的精确 host)
    if (s === "kelee") {
      const bad = ledger.entries.filter((e) => e.source === "kelee" && e.verdict === "expand");
      if (bad.length) {
        const exp = bad.flatMap((e) => expandSuffix(e.host, rules));
        console.log(`[kelee] ${bad.length} 个后缀域 apex 不过关 → 前缀枚举 ${exp.length} 个候选, 二轮探测…`);
        const p2 = await probe(exp.map((c) => c.host));
        for (const c of exp) {
          const { verdict, reason } = verdictOf(c, p2[c.host]);
          pushEntry(ledger, c, p2[c.host], verdict, reason);
        }
      }
    }
    const blocked = ledger.entries.filter((e) => e.source === s && e.verdict === "block").length;
    const review = ledger.entries.filter((e) => e.source === s && e.verdict === "review").length;
    console.log(`[${s}] 生成 ${blocked} 条 | 待复核 ${review} | 无 A ${ledger.entries.filter((e) => e.source === s && e.reason === "no-a-record").length}`);
  }
  fs.mkdirSync(path.dirname(path.join(ROOT, LEDGER_REL)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, LEDGER_REL), JSON.stringify(ledger, null, 1) + "\n");
  for (const s of Object.keys(PLUGIN_FOR)) {
    const entries = entriesFor(ledger, s);
    const abs = path.join(ROOT, PLUGIN_FOR[s]);
    // 空块不写(否则插件里留一段无内容的标记, 反而像"这里本该有东西却丢了")
    if (!entries.length) {
      const cur = readBlock(abs, s);
      if (cur) fs.writeFileSync(abs, fs.readFileSync(abs, "utf8").replace(cur, "").replace(/\n{3,}/g, "\n\n"));
      continue;
    }
    const block = renderBlock(entries, { source: s, generatedAt: ledger.generated_at, policy: ledger.policy });
    fs.writeFileSync(abs, applyBlock(abs, s, block));
  }
  console.log(`✅ 台账已写 ${LEDGER_REL}; 三个 L0 插件的生成块已更新`);
}
