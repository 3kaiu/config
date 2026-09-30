/**
 * 广告平台 + 探针上报插件 (ad-*.plugin / probe-*.plugin) 结构回归 (2026-09-29 新增)
 *
 * 锁死三条属性, 每条都对应一次真实风险:
 *   ① **零 [MitM]** — 广告平台是纯 L2 域名 REJECT。本仓 domain-reject-mode = DNS,
 *      拒绝在 DNS 阶段用回环地址完成, 请求到不了解密层。若给这些插件加了 [MitM],
 *      等于为"拦广告"白白多背一份 CA 证书信任 —— 是净损失。
 *   ② **纯 REJECT 不得有例外白名单** — 广告域不存在"功能子域"豁免的可能; 一旦
 *      出现 DIRECT/Proxy, 说明有人凭域名字义判断错了 (du.jd.com 教训)。
 *   ③ **不得含 [Argument]** — 官方《插件》策略位仅 DIRECT/REJECT/PROXY, 插件参数
 *      只作用于 Script(enable={}) 与 Rewrite(${}); 普通 [Rule] 行挂不了条件 ⇒
 *      声明即死参数, 会误导用户以为能按开关。
 *
 * 2026-09-30 平台集合化: 原 7 个按平台拆分的 ad-* 合并为 1 个 `ad-block.plugin`
 * (59 域并集, 域级零重叠 —— 分散的是结构不是内容)。故本文件的插件数下限从 12 改为 7
 * (1 广告集合 + 6 探针通道); ⚠️ 代价是平台级开关收敛为单插件开关 —— 纯 [Rule] 挂不了
 * 条件参数, 集合化与"逐平台启停"不可兼得, 需单平台开关时按平台拆回。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let shapes = null;
const loadShapes = async () => (shapes ??= await import("../../tools/lib/dns-rule-shapes.mjs"));
// 覆盖三类纯 L2 插件: ad-* (广告平台) / probe-* (探针上报) / dns-* (DNS 收编, 2026-09-30 架构分层)
// dns-* 多一种允许形状: AND 锚定的关键词兜底(见下方"一律 REJECT"用例的类别分支)。
const PLUGINS = fs
  .readdirSync(path.join(ROOT, "Plugin"))
  .filter((f) => /^(ad|probe|dns)-.*\.plugin$/.test(f))
  .sort();

/** 取插件的某一段 (行首锚定, 不用 indexOf —— 会命中注释里提到的段名) */
const section = (txt, name) => {
  const lines = txt.split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim() === `[${name}]`);
  if (i < 0) return [];
  const out = [];
  for (let k = i + 1; k < lines.length; k++) {
    if (/^\[[A-Za-z ]+\]\s*$/.test(lines[k])) break;
    out.push(lines[k]);
  }
  return out;
};

const rulesOf = (txt) => section(txt, "Rule").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

exports.tests = {
  "ad-*/probe-*.plugin: 广告平台与探针类别齐备": async (a) => {
    a.ok(
      PLUGINS.length >= 9,
      `应至少 9 个纯 L2 插件(1 广告平台拦截器 + 2 DNS 收编 + 6 探针通道), 实际 ${PLUGINS.length}: ${PLUGINS.join(", ")}`
    );
    for (const must of ["dns-httpdns.plugin", "dns-leak.plugin"]) {
      a.ok(PLUGINS.includes(must), `缺少 L0 依赖层插件 ${must}`);
    }
    for (const must of ["穿山甲", "广点通", "快手", "百度", "Google", "友盟", "Bugly", "ARMS"]) {
      a.ok(
        PLUGINS.some((f) => fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8").includes(must)),
        `缺少 ${must} 对应插件`
      );
    }
  },

  "ad-*/probe-*.plugin: 零 [MitM] (L2 拦截不得产生证书成本)": async (a) => {
    for (const f of PLUGINS) {
      const txt = fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8");
      const mitm = section(txt, "MitM").filter((l) => l.trim() && !l.trim().startsWith("#"));
      a.equal(
        mitm.length,
        0,
        `Plugin/${f} 的 [MitM] 有 ${mitm.length} 条正域名 —— 广告平台是 DNS 阶段拦截, 解密面只增加 CA 证书成本, 不得有 [MitM]`
      );
    }
  },

  "ad-*/probe-*.plugin: 零 [Script]/[Rewrite] (纯 L2 域名拦截)": async (a) => {
    for (const f of PLUGINS) {
      const txt = fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8");
      for (const seg of ["Script", "Rewrite"]) {
        const body = section(txt, seg).filter((l) => l.trim() && !l.trim().startsWith("#"));
        a.equal(body.length, 0, `Plugin/${f} 不应有 [${seg}] 正条目 —— 广告平台只做 L2 域名 REJECT`);
      }
    }
  },

  "ad-*/probe-*.plugin: 全部 [Rule] 一律 REJECT, 无 DIRECT/Proxy 例外": async (a) => {
    const { isAllowedDnsRule, isGatedDirectCarveOut } = await loadShapes();
    for (const f of PLUGINS) {
      const txt = fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8");
      const isDns = /^dns-/.test(f);
      // 生成块(覆盖管线产物)内允许 DOMAIN-SUFFIX: 每条都由台账的 apex 判据背书(apex 是端点型而非网站)
      const generated = new Set();
      {
        const re = /# >>> GENERATED:(\w+)[^\n]*\n([\s\S]*?)# <<< GENERATED:\1/g;
        let m;
        while ((m = re.exec(txt))) for (const line of m[2].split("\n")) generated.add(line.trim());
      }
      for (const r of rulesOf(txt)) {
        const okDomain = /^DOMAIN,\s*[^,]+,\s*REJECT$/.test(r);
        // dns-* 层的形状白名单收敛在 tools/lib/dns-rule-shapes.mjs(2026-09-30 吸纳 UA / 明文 IP 形态 /
        // 定向放行三类技法时新增); 其余类别仍必须精确 DOMAIN —— 广告域出现 DIRECT/Proxy 一律是误判。
        const okDnsShape = isDns && isAllowedDnsRule(r);
        // 生成块内的整域拦(SUFFIX)是覆盖管线按 apex 判据产出的, 台账逐条留档 —— 手写形态仍不允许
        const okGeneratedSuffix = generated.has(r) && /^DOMAIN-SUFFIX,\s*[\w.-]+,\s*REJECT$/.test(r);
        a.ok(
          okDomain || okDnsShape || okGeneratedSuffix,
          `Plugin/${f} 的规则 "${r}" 不是裸 DOMAIN REJECT${isDns ? "(或 dns-* 允许形状)" : ""} —— 出现 DIRECT/Proxy 说明有人凭域名字义误判 (du.jd.com 教训)`
        );
        // DIRECT 在 dns-* 层只允许"AND 门控的定向放行"(carve-out), 且必须写明理由
        if (/,\s*DIRECT$/.test(r)) {
          a.ok(isDns && isGatedDirectCarveOut(r), `Plugin/${f} 的 DIRECT 规则不在允许形状内: ${r}`);
        }
      }
    }
  },

  "ad-*/probe-*.plugin: 不得声明 [Argument] ([Rule] 挂不了条件, 声明即死参数)": async (a) => {
    for (const f of PLUGINS) {
      const txt = fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8");
      const arg = section(txt, "Argument").filter((l) => l.trim() && !l.trim().startsWith("#"));
      a.equal(
        arg.length,
        0,
        `Plugin/${f} 声明了 ${arg.length} 个参数, 但纯 [Rule] 插件无法挂条件 (官方《插件》策略位仅 DIRECT/REJECT/PROXY) ⇒ 死参数会误导用户。按平台开关应靠启停插件。`
      );
    }
  },

  "ad-*/probe-*.plugin: 每个插件都有可核验的域, 且无通配": async (a) => {
    for (const f of PLUGINS) {
      const txt = fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8");
      const rs = rulesOf(txt);
      a.ok(rs.length > 0, `Plugin/${f} 没有任何生效规则`);
      const exact = rs.filter((r) => /^DOMAIN,/.test(r));
      a.ok(exact.length > 0, `Plugin/${f} 没有任何**可核验**的精确 DOMAIN 规则(只有关键词兜底) —— 关键词无法逐条存活探针`);
      for (const r of rs) {
        const m = /^DOMAIN,\s*([^,]+),\s*REJECT$/.exec(r);
        if (!m) continue; // AND 锚定兜底行无单域可核验, 由上方 exact 地板与 plugin-lint-check 的锚定规则守
        const dom = m[1];
        a.ok(
          /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(dom),
          `Plugin/${f} 的域名 "${dom}" 形态异常 —— 应为具体域名 (用 DOMAIN 而非通配, 避免误伤同域功能)`
        );
        a.ok(!dom.includes("*"), `Plugin/${f} 含通配 ${dom} —— 广告平台拦截必须逐域列举`);
      }
    }
  },
};

/**
 * 推送通道是**硬红线**: 断推送 = 真功能损失(收不到消息通知), 不是"少一条统计"。
 * AGENTS.md 早已记「全拦 SUFFIX 会断推送」(个推/极光), 本组插件按类别拆域名正是为了
 * 避开它。此用例把红线钉死 —— 任何人想加推送域, 门禁立刻判红。
 */
const PUSH_DOMAINS = [
  "jpush.cn", "jpush.io", "getui.com", "getui.net", "gepush.com",
  "xmpush.xiaomi.com", "api-push.meizu.com", "upush.res.meizu.com",
  "message.meizu.com", "config.umeng.com", "msg.umeng.com",
];

exports.tests["ad-*/probe-*.plugin: 绝不拦推送通道 (断推送=真功能损失)"] = async (a) => {
  for (const f of PLUGINS) {
    const txt = fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8");
    for (const d of rulesOf(txt)) {
      const m = /^DOMAIN,\s*([^,]+),\s*REJECT$/.exec(d);
      if (!m) continue;
      const dom = m[1];
      for (const push of PUSH_DOMAINS) {
        a.ok(
          dom !== push && !dom.endsWith("." + push),
          `Plugin/${f} 拦了推送域 ${dom} (属 ${push}) —— 断推送是真功能损失, 不是少一条统计`
        );
      }
    }
  }
};

exports.tests["ad-*/probe-*.plugin: 探针插件不得拦应用商店与系统更新域"] = async (a) => {
  // 商店/更新域被拦 ⇒ App 无法更新/分发, 属灾难级误伤
  const STORE = ["ad.apk.vivo.com.cn", "apps.oppomobile.com", "bss.pandora.xiaomi.com",
                 "dvb.pandora.xiaomi.com", "de.pandora.xiaomi.com", "jellyfish.pandora.xiaomi.com"];
  for (const f of PLUGINS) {
    const txt = fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8");
    for (const d of rulesOf(txt)) {
      const m = /^DOMAIN,\s*([^,]+),\s*REJECT$/.exec(d);
      if (!m) continue;
      const dom = m[1];
      a.ok(!STORE.includes(dom), `Plugin/${f} 拦了商店/系统域 ${dom} —— 会影响 App 分发与更新`);
    }
  }
};
