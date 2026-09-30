/**
 * 端点域 → 平台归属台账 (2026-09-30)
 *
 * 为什么需要它: app-ads.txt 声明的是 **ad system 根域**(`startapp.com`), 而规则写的是
 * **端点主机**(`init.startappservice.com`)。两把钥匙里的第一把(平台有一手声明)必须先把
 * 端点归到平台, 而归属**不能靠后缀猜** —— 实测就有两个后缀回退抓不到的真别名:
 *   `startappservice.com` / `startappexchange.com`  → `startapp.com`  (品牌同, 域不同)
 *   `adview.cn`                                     → `adview.com`   (同品牌跨国 TLD; 语料 14/15 声明的是 .com)
 * 反过来, 后缀相同也不等于同平台(`applovin.com` 与 `applovin.net` 是两家)。故归属是
 * **显式台账**, 每条必须有理由, 且理由里不许出现"看起来像"。
 *
 * kind 闭集(不许新增取值 —— 与 ad-exclusions.mjs 同一纪律):
 *   endpoint-of   端点域属于另一个平台根域(别名/子品牌/跨国站点) —— 必须写 platform
 *   self          该域本身就是平台根域 —— 声明情况由语料实测决定(可能是 0, 见 declaration_gap)
 *   out-of-corpus 语料结构性不覆盖(国内交易所等) —— 必须写为什么, 且不许当作"已取证"
 *
 * declaration_gap=true 的含义: 语料对该平台 **0 声明**。平台层门禁不会因此判红(它在台账里
 * 有明确理由), 但每次运行都会把它单独列出来 —— 保留这类规则只有端点侧证据, 是否继续保留
 * 属待裁决项, 不许静默通过。
 */
export const REASON_KINDS = { endpointOf: "endpoint-of", self: "self", outOfCorpus: "out-of-corpus" };
export const ALLOWED_KINDS = new Set(Object.values(REASON_KINDS));

export const AD_PLATFORM_MAP = [
  {
    domain: "startappservice.com",
    kind: "endpoint-of",
    platform: "startapp.com",
    reason: "StartApp SDK 端点主机(与 SDK 同一品牌, 但根域不同 —— 后缀回退抓不到)",
    evidence:
      "平台根域 startapp.com 在一手声明语料里 15/15; 端点 2026-09-30 双解析器: init. 1 A(138.2.84.229 / 129.150.35.183, HTTPS 自签证书)、req. 1 A(404)、images. 2 A(Fastly, 301)",
    declaration_gap: false,
  },
  {
    domain: "startappexchange.com",
    kind: "endpoint-of",
    platform: "startapp.com",
    reason: "StartApp 的 exchange 端点主机(同品牌别名)",
    evidence: "平台根域 startapp.com 一手声明 15/15; init.startappexchange.com 2026-09-30 双解析器 1 A(129.150.35.183), HTTPS 404",
    declaration_gap: false,
  },
  {
    domain: "adview.cn",
    kind: "endpoint-of",
    platform: "adview.com",
    reason: "AdView 国内站(.cn)与 ad system 根域(.com)是同一品牌的两套域名",
    evidence:
      "语料里 adview.com 被 14/15 份一手声明; adview.cn 本身 0 声明(它是对外投放站, 不是 ad system 域); bid.adview.cn 2026-09-30 双解析器 1 A(101.251.208.247), HTTPS 404",
    declaration_gap: false,
  },
  {
    domain: "admost.com",
    kind: "self",
    platform: "admost.com",
    reason:
      "土耳其移动广告聚合/变现平台本体域。保留规则目前**只有端点侧证据**, 没有任何一手声明背书 —— 按两把钥匙判据属待裁决项, 不由本门禁自动放行也不自动删除",
    evidence:
      "app-ads.txt 一手声明: 入库语料 0/15, 全网抽查 0/44; 端点 api.admost.com 2026-09-30 双解析器 NOERROR 2 A(172.66.165.199 / 104.20.16.69, Cloudflare 前挡), HTTPS 403",
    declaration_gap: true,
  },
];

/** 端点域 → 台账条目: 取**最长**匹配后缀, 这样 api.admost.com 归 admost.com 而不是 com */
export function attributionOf(domain) {
  const d = String(domain).toLowerCase();
  let best = null;
  for (const e of AD_PLATFORM_MAP) {
    if (d === e.domain || d.endsWith("." + e.domain)) {
      if (!best || e.domain.length > best.domain.length) best = e;
    }
  }
  return best;
}

/**
 * 平台层门禁的**结构性豁免**清单 (2026-09-30 平台集合化时新增)。
 *
 * 为什么需要它: 平台层门禁 (tools/appads-check.mjs) 原先按**文件路径**限定范围
 * `Plugin/ad-intl*` —— 7 个 ad-* 插件按平台拆分时, 这条路径恰好等价于"只看国际平台"。
 * 2026-09-30 用户决策把 7 个平台插件合并为一个 `Plugin/ad-block.plugin` 集合 (59 域),
 * 路径不再能区分国际/国内: 若不显式排除, 国内 SDK 与 Google 族会因"西方发行商清单
 * 结构性不覆盖"被全部判红 (假红, 而假红会掩盖真红)。
 *
 * 排除判据是**结构性**的, 不是"没查到": 语料是西方发行商公开的 app-ads.txt, 国内 SDK
 * (字节/腾讯/快手/百度) 与 Google 的 SDK 出口域不在同一发行生态 —— 这正是本工具头注
 * 早已写明的理由, 本清单把那段注释变成可执行、可被门禁打印的断言。
 *
 * 纪律:
 *   ① 每条必须是**平台根域**(不是端点主机), 且必须写明平台与结构性理由;
 *   ② 门禁每次运行都把它**打印出来**(不静默豁免);
 *   ③ **死豁免判红** —— 清单里的根域若不再被任何规则命中, test/cases/appads-check.test.js 判红。
 */
export const OUT_OF_CORPUS_ROOTS = [
  { root: "snssdk.com", platform: "穿山甲/字节", reason: "国内 SDK 埋点与素材出口(字节生态), 西方发行商清单结构性不覆盖" },
  { root: "pangolin-sdk-toutiao-b.com", platform: "穿山甲/字节", reason: "Pangolin B 侧 SDK 出口, 同上" },
  { root: "pglstatp-toutiao.com", platform: "穿山甲/字节", reason: "穿山甲素材包分发域, 同上" },
  { root: "qq.com", platform: "广点通/腾讯广告", reason: "腾讯生态根域下的广告子域, 语料不覆盖腾讯自有生态" },
  { root: "ksapisrv.com", platform: "快手联盟", reason: "快手自有 API 域, 语料不覆盖" },
  { root: "kuaishou.cn", platform: "快手联盟", reason: "快手域族 .cn 侧, 同上" },
  { root: "bcebos.com", platform: "百度联盟", reason: "百度对象存储上的广告配置域, 语料不覆盖" },
  { root: "guannin.com", platform: "百度联盟", reason: "百度联盟静态域, 语料不覆盖" },
  { root: "17admob.com", platform: "Google/AdMob", reason: "Google 族 SDK 出口 —— 语料里 Google 以 google.com 出现, 与 SDK 出口域不同源(工具头注已写明)" },
];

/** 域是否落在结构性豁免清单内 (返回命中条目或 null) */
export function outOfCorpusOf(domain) {
  const d = String(domain).toLowerCase();
  return OUT_OF_CORPUS_ROOTS.find((e) => d === e.root || d.endsWith("." + e.root)) || null;
}

export { ROOT } from "./ad-exclusions.mjs";
