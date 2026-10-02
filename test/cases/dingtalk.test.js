"use strict";
/**
 * 钉钉 DingTalk 接入台账门禁 — test/cases/dingtalk.test.js
 *
 * 背景: 这是本仓**第一个「去广告只落在 L2、且落在主配置而非插件」的接入**。它的失效方式
 * 与其它单 App 插件都不同, 而且更隐蔽:
 *   ① **"没写规则"的错**: 钉钉自营广告已商业化(开屏 + 打卡/签到/审批/工作日志/直播回放),
 *      而官方关闭入口是**付费的钉钉365会员** ⇒ 网络层是唯一不花钱的路径。什么都不做 =
 *      用户拿不到任何效果, 而这条信息只存在于本文件与 APP-ONBOARDING 附十里, 规则里看不出来。
 *   ② **放错层的错**: 这两个域的 A 记录**全部落在境内**(ipinfo 实测 CN Shanghai/Guangdong/Chongqing),
 *      而主配置有 `GEOIP,CN,DIRECT`; 插件 [Rule] 优先级低于本地 [Rule] ⇒ 放进 ad-block.plugin
 *      极可能被本地 GEOIP 直连截胡, 变成永不命中的死规则(本段纪律 ① 的直接推论)。
 *   ③ **被"平台家族"误导**: `adashx.ut.*` 是**跨 App 阿里 UT 广告交换家族**(实测 alibaba/cainiao/
 *      taobao/amap/1688 全部存活), `adash-emas` 挂在阿里云广告公司主体下 ⇒ 它们不是钉钉私有域,
 *      拦它们对其他阿里 App 同样生效。把它们写成"钉钉去广告"会掩盖这个跨 App 影响。
 *   ④ **误以为有 L4 可做**: 钉钉开放平台**不存在任何广告 API**(13 个命名空间逐一探针全部
 *      errcode=22 不合法 ApiName), 客户端主链路是 DTIM 私有二进制协议 ⇒ 结构上无 [Rewrite] 可写。
 *      若有人日后"看着像漏了"去补 L4, 写出来的必然是永不触发的规则。
 *
 * 本文件把这四条固化成断言。台账与 template/loon.tpl 的规则注释互为正本。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const TPL = path.join(ROOT, "template", "loon.tpl");
const ONBOARD = path.join(ROOT, "APP-ONBOARDING.md");

const tpl = fs.readFileSync(TPL, "utf8");
const onboarding = fs.readFileSync(ONBOARD, "utf8");
const plugins = fs
  .readdirSync(path.join(ROOT, "Plugin"))
  .filter((f) => f.endsWith(".plugin"))
  .map((f) => ({ file: f, text: fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8") }));

/** 主配置 [Rule] 段的 REJECT 域 */
const tplDomains = new Set();
for (const m of tpl.matchAll(/^\s*(?:DOMAIN|DOMAIN-SUFFIX),\s*([\w.-]+\.[a-z]{2,}),\s*REJECT/gim)) {
  tplDomains.add(m[1].toLowerCase());
}

/** 插件里出现的所有 DOMAIN / DOMAIN-SUFFIX 值 */
const pluginDomains = new Set();
for (const p of plugins) {
  for (const m of p.text.matchAll(/^\s*(?:DOMAIN|DOMAIN-SUFFIX),\s*([\w.*-]+\.[a-z]{2,}),/gim)) {
    pluginDomains.add(m[1].toLowerCase());
  }
}

/**
 * 处置台账 —— 与主配置注释逐条对应。
 *   origin  该条是本轮补的, 还是本仓既有的(前置轮次已落地)
 *   probe   端点层判据的关键词, 必须在主配置注释里真的写出来(防"规则在、依据不在")
 */
const LANDED = [
  {
    domain: "adashx.ut.dingtalk.com",
    origin: "new",
    probe: "SSL_ERROR_SYSCALL",
    note: "UT 广告交换主域; TCP 可连但 TLS 被服务端重置 ⇒ 本机不可测, 靠同族 h- 侧已拦截 + 跨 App 家族佐证",
  },
  {
    domain: "adash-emas.cn-hangzhou.aliyuncs.com",
    origin: "new",
    probe: "aserver/2.0.0",
    note: "阿里云 EMAS 广告服务; 403 + 9 路径 404 ⇒ 端点型",
  },
  {
    domain: "h-adashx.ut.dingtalk.com",
    origin: "existing",
    probe: "",
    note: "2026-08 HAR 审计轮已落地, 本轮只做对账不重复加",
  },
];

/** 平台层一手声明中, 钉钉自列的广告 SDK(其域必须已被覆盖) */
const DECLARED_AD_SDK = { sdk: "beizi", domain: "beizi.biz" };

/** 明确**不写规则**的候选 —— 必须不存在对应规则(防后人"看着像漏了"补进来) */
const RULED_OUT = [
  { needle: "uniad", why: "前缀枚举无存活端点(ad-api.uniad.dcloud.net.cn 等全 NX)" },
  { needle: "hmsads", why: "HUAWEI Ads 子域全 NX, ads.huawei.com 是 301 平台站" },
  { needle: "mmachina", why: "MMA 中国广告监测 SDK, 根域是 200 HTML 协会官网, 非端点" },
  { needle: "masdk", why: "MSA 移动安全联盟走本地接口不发网络请求" },
  { needle: "talkingdata", why: "端点存活但 HTTPS 不可测, 且属统计面(M3)非广告面(M2)" },
  { needle: "task.tanx", why: "端点存活但钉钉隐私政策未声明 Tanx, 平台层无一手依据" },
];

exports.tests = {
  "dingtalk: 处置台账逐条在主配置 [Rule] 落地 (含既有条目的对账)": async (a) => {
    for (const row of LANDED) {
      a.ok(
        tplDomains.has(row.domain),
        `台账里的 ${row.domain} 在主配置 [Rule] 无对应规则 (文档与规则脱节)`
      );
    }
    // 反向: 主配置里带 dingtalk 字样的域必须全部在台账里, 否则台账漏登记 = 后人会重查一遍
    const dtInTpl = [...tplDomains].filter((d) => d.includes("dingtalk"));
    for (const d of dtInTpl) {
      a.ok(
        LANDED.some((r) => r.domain === d),
        `主配置存在未登记台账的钉钉域 ${d} —— 补进 test/cases/dingtalk.test.js 的 LANDED`
      );
    }
  },

  "dingtalk: 每条新规则的端点层取证依据必须写在配置注释里 (不许只有规则没有依据)": async (a) => {
    for (const row of LANDED.filter((r) => r.origin === "new" && r.probe)) {
      a.ok(tpl.includes(row.probe), `主配置注释缺少 ${row.domain} 的端点探针结论关键词 "${row.probe}"`);
    }
    // 非泛解析对照是本仓 L2 纪律的必备项(泛解析域的 1A 是假信号, 见 AGENTS.md 两条反向教训)
    a.ok(/非泛解析/.test(tpl), "主配置注释未记录泛解析对照结论(随机子域探测) —— L2 取证的必备判据");
  },

  "dingtalk: 平台层一手声明的广告 SDK 其域必须已被覆盖": async (a) => {
    // 钉钉官方 SDK 清单 26 项里只有 BeiZi(倍孜)= 开屏广告; 其域若丢了, 开屏广告就回来
    a.ok(
      [...tplDomains].some((d) => d === DECLARED_AD_SDK.domain || d.endsWith("." + DECLARED_AD_SDK.domain)),
      `钉钉声明的 ${DECLARED_AD_SDK.sdk} SDK 域 ${DECLARED_AD_SDK.domain} 未被任何规则覆盖 —— 开屏广告会回来`
    );
    // 且必须能追溯到"官方自列 26 个 SDK"这个一手结论, 而不是凭印象
    a.ok(/26 个第三方 SDK/.test(tpl), "主配置注释未记录'官方自列 26 个 SDK'这一平台层一手结论的数量锚");
    a.ok(/BeiZi/.test(tpl) || /倍孜/.test(tpl), "主配置注释未点名 SDK 清单里唯一的广告 SDK(BieiZi/倍孜)");
  },

  "dingtalk: 这两个域**不得**放进插件 [Rule] (跨层纪律: 本地 GEOIP 会截胡境内域)": async (a) => {
    // 主配置「国内广告 SDK 硬拦截」段纪律①: 插件 [Rule] 优先级低于本地 [Rule],
    // 而 GEOIP,CN,DIRECT 是本地 IP 类兜底。这两个域的 A 记录实测全在境内。
    for (const p of plugins) {
      for (const d of LANDED.map((r) => r.domain)) {
        a.ok(
          !p.text.includes(d),
          `${p.file} 含 ${d} —— 该域 A 记录全部落在境内, 放插件会被本地 GEOIP,CN,DIRECT 截胡(死规则)`
        );
      }
    }
    // 且纪律① 本身必须在配置里留着, 后人才知道为什么这两个域在主配置
    a.ok(/插件与 Remote Rule 均无法拦截国内域/.test(tpl), "主配置纪律①(插件拦不了境内域)被删了 —— 会有人把域搬进插件");
    a.ok(/GEOIP, CN, DIRECT/.test(tpl), "主配置缺 GEOIP,CN,DIRECT 锚点");
  },

  "dingtalk: 跨 App 影响必须留档 (不是钉钉私有域)": async (a) => {
    // adashx.ut.* 是跨 App 阿里 UT 广告交换家族; 拦它对淘宝/菜鸟/高德等同样生效。
    // 写成"钉钉去广告"会掩盖这个影响 → 必须留档。
    a.ok(
      /跨 App|跨App/.test(tpl) && /ut\.dingtalk/.test(tpl),
      "主配置注释未记录'这是跨 App 广告平台域而非钉钉私有域'—— 用户会误以为只影响钉钉"
    );
    a.ok(
      /ut\.(alibaba|cainiao|taobao|amap|1688)/.test(tpl) || /跨 App/.test(onboarding),
      "跨 App 家族的实测证据(alibaba/cainiao/taobao/amap/1688 存活)未留档 —— 平台归属无据"
    );
  },

  "dingtalk: 不写规则的候选必须有理由留档 (防后人重查/补规则)": async (a) => {
    for (const r of RULED_OUT) {
      a.ok(
        !pluginDomains.has(r.needle) && ![...tplDomains].some((d) => d.includes(r.needle)),
        `${r.needle} 已被写成规则 —— ${r.why}; 要落地须先自行取证并更新本台账`
      );
    }
    // 否决清单本身必须留在 APP-ONBOARDING 里(否则后人查不到为什么不加)
    for (const r of RULED_OUT) {
      const key = r.needle.replace(/\..*/, "");
      a.ok(onboarding.includes(key), `已否决候选 ${r.needle} 未在 APP-ONBOARDING 留档`);
    }
  },

  "dingtalk: 「无 L4」这个结论必须留证 (否则后人会去补永不触发的 Rewrite)": async (a) => {
    // 开放平台 13 个广告命名空间全部 errcode=22; 客户端主链路是 DTIM 私有二进制协议。
    // 若有人日后补 L4, 写出来的必然永不触发 —— 所以结论与证据都要在库里。
    a.ok(/errcode=22|不合法ApiName|不合法 ApiName/.test(onboarding), "附十未记录开放平台枚举 oracle 的判据(errcode 22 = 无此 API)");
    a.ok(/DTIM/.test(onboarding), "附十未记录客户端主链路是 DTIM 私有二进制协议 —— 这是 L4 不可达的结构性原因");
    a.ok(/adashx\.ut\.(alibaba|cainiao|taobao|amap|1688)/.test(onboarding), "附十未记录跨 App 家族实测(证明不是钉钉私有域)");
    // 且主配置里确实没有为钉钉建 [Rewrite]/[MitM] 的东西(钉钉不是本仓插件)
    a.ok(!plugins.some((p) => p.file.includes("dingtalk")), "不应存在钉钉单 App 插件 —— 本 App 去广告全部落在 L2");
  },
};
