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
 *      声明即死参数, 会误导用户以为能按开关。拆成独立插件 + 启停才是原生做法。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
// 覆盖两类纯 L2 插件: ad-* (广告平台) 与 probe-* (探针/隐私上报)
const PLUGINS = fs
  .readdirSync(path.join(ROOT, "Plugin"))
  .filter((f) => /^(ad|probe)-.*\.plugin$/.test(f))
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
    a.ok(PLUGINS.length >= 12, `应至少 12 个纯 L2 插件(6 广告平台 + 6 探针通道), 实际 ${PLUGINS.length}: ${PLUGINS.join(", ")}`);
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
    for (const f of PLUGINS) {
      const txt = fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8");
      for (const r of rulesOf(txt)) {
        a.ok(
          /^DOMAIN,\s*[^,]+,\s*REJECT$/.test(r),
          `Plugin/${f} 的规则 "${r}" 不是裸 DOMAIN REJECT —— 广告域出现 DIRECT/Proxy 说明有人凭域名字义误判 (du.jd.com 教训)`
        );
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
      for (const r of rs) {
        const dom = /^DOMAIN,\s*([^,]+),\s*REJECT$/.exec(r)[1];
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
      const dom = /^DOMAIN,\s*([^,]+),\s*REJECT$/.exec(d)[1];
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
      const dom = /^DOMAIN,\s*([^,]+),\s*REJECT$/.exec(d)[1];
      a.ok(!STORE.includes(dom), `Plugin/${f} 拦了商店/系统域 ${dom} —— 会影响 App 分发与更新`);
    }
  }
};
