/**
 * 广告平台「排除台账」(2026-09-29, 2026-09-30 修订)
 *
 * 性质: **决策数据 + 判据**, 不放 test/ —— 因为门禁 (tools/appads-check.mjs) 与用例
 * (test/cases/ad-exclusions.test.js) 都要用它, 而 tools/ 不应反向依赖 test/。
 * 技术原语 (规则扫描/域匹配) 在同目录 `rule-scan.mjs`。
 *
 * 存在理由: AGENTS.md 的广告面治理纪律要求「**已否决面必须不存在对应规则**(防上游误伤回流)」,
 * 但此前只写在文档里, 没有任何东西守住它。排除决策一旦被后续改动"顺手补一条规则",
 * 误伤就回来了 —— 本仓已犯过「凭域名字义加 REJECT」的错。
 *
 * 两种语义 (决策本身在 APP-ONBOARDING.md 附六, 这里只做机器可判的转写, 不重新解释):
 *   whole —— 该域**及其所有子域**都不得有任何规则   reason_kind ∈ {merged, site}
 *   apex  —— 只禁止拦**裸域**(含被 SUFFIX 罩住裸域)  reason_kind = infra
 *
 * ⚠️ reason_kind 是**闭集**, 且**不含「死域」** —— 这是 2026-09-30 实测买来的教训:
 *   本台账曾有一条 supersonicads.com = "已死域(Cloudflare 解析 0 条), 规则永不命中"。
 *   复核发现我只探了 **apex**: apex 确无 A, 但 `init.supersonicads.com` /
 *   `outcome.supersonicads.com` **各 4 条 A 且均非泛解析**(随机子域 NXDOMAIN)。
 *   即「apex 无 A」被写成了「域已死」—— 一条**无法证伪的过度断言**。该条已移出本台账,
 *   转"未决候选"记在 APP-ONBOARDING.md 附六。教训有两条, 都进纪律:
 *     ① apex 无 A ≠ 域已死; ② A 记录存在 ≠ 端点存在(ironsource.mobi 是泛解析,
 *        其 init. 子域 NET 200 是假信号)。故排除理由只允许"结构性"的两类, 不允许存活断言。
 *
 * ⚠️ unity3d.com 登记为 apex 而非 whole, 这是**按证据的对抗判断结果**(2026-09-29 实测):
 *   ① 插件拦的是 `config.unityads.unity3d.com`, 其 CNAME 链为
 *      `config-tp.unityads.unity3d.com` → `ads-config.unityads.unity3d.com` —— 名字里
 *      直接写着 ads-config, 是 Unity Ads SDK 的配置端点, 不是引擎资源;
 *   ② Unity 引擎自己的端点 `config.unity3d.com`(A 记录在, HTTPS 405)与
 *      `cdp.cloud.unity3d.com`(HTTPS 200)是**另外的 host 且都活着**, 不受这条规则影响;
 *   ③ 故"整域拦会破引擎"成立(⇒ 不得整域拦), 但"连广告端点也不该拦"不成立(⇒ 保留该条)。
 *   ④ 2026-09-30 补充: 参考清单里 7/7 发行商声明的 ad system 域已迁到 **unity.com**,
 *      但 unity.com 下所有广告子域实测 NXDOMAIN ⇒ **高共识在 host 层被证伪**, 不新增规则。
 *   附六原表把 unity3d.com 与 mopub/streamkey 并列标 "❌ 排除" 是措辞不精确,
 *   已按上述证据改写为「只拦广告子域」, 避免文档与配置互相矛盾。
 */

export { ROOT } from "./rule-scan.mjs";

/** 排除理由闭集。**故意不含"死域/解析 0 条"** —— 那类断言需要逐子域枚举才能成立 */
export const REASON_KINDS = {
  merged: "已并入他方 → 再拦是重复(域本身仍属同一家)",
  site: "主站有正常业务内容 → 拦了破站点",
  infra: "含引擎/开发者后台等基础设施 → 只拦精确的广告子域",
};

/** mode → 允许的 reason_kind (闭集校验用) */
export const ALLOWED_KINDS = { whole: ["merged", "site"], apex: ["infra"] };

/** 排除台账。evidence 必须指向可核对来源 (本仓不接受"我记得") */
export const AD_PLATFORM_EXCLUSIONS = [
  {
    domain: "mopub.com",
    mode: "whole",
    reason_kind: "merged",
    reason: "已并入 AppLovin(探针 302 → applovin.com/max), 再拦是重复",
    evidence: "APP-ONBOARDING.md 附六 / Plugin/ad-block.plugin:185",
  },
  {
    domain: "streamkey.tv",
    mode: "whole",
    reason_kind: "site",
    reason: "直播广告主站且有正常站点内容, 非 SDK 出口",
    evidence: "APP-ONBOARDING.md 附六 / Plugin/ad-block.plugin:189",
  },
  {
    domain: "unity3d.com",
    mode: "apex",
    reason_kind: "infra",
    reason: "Unity 引擎本体, 整域拦会破 Unity 游戏运行与资源加载; 仅允许已取证的广告端点子域",
    evidence:
      "APP-ONBOARDING.md 附六 / Plugin/ad-block.plugin:181 / 实测 CNAME ads-config.unityads.unity3d.com",
  },
  {
    domain: "applovin.com",
    mode: "apex",
    reason_kind: "infra",
    reason: "含开发者后台与站点; 仅拦已取证 SDK 子域(d./ads./api.)",
    evidence: "APP-ONBOARDING.md 附六 / Plugin/ad-block.plugin:190",
  },
  {
    domain: "startapp.com",
    mode: "apex",
    reason_kind: "infra",
    reason: "含开发者后台与站点; 已拦的 StartApp 出口在 startappservice.com / startappexchange.com",
    evidence: "APP-ONBOARDING.md 附六 / Plugin/ad-block.plugin:190",
  },
];

/** 台账快查: 域 → 条目 (未登记返回 null) */
export function exclusionOf(domain) {
  const d = String(domain).toLowerCase();
  return AD_PLATFORM_EXCLUSIONS.find((e) => e.domain === d) || null;
}
