/**
 * 广告平台插件 (ad-*.plugin) 结构回归 (2026-09-29 新增)
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
const PLUGINS = fs
  .readdirSync(path.join(ROOT, "Plugin"))
  .filter((f) => /^ad-.*\.plugin$/.test(f))
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
  "ad-*.plugin: 至少覆盖 6 个广告平台": async (a) => {
    a.ok(PLUGINS.length >= 6, `应至少 6 个广告平台独立插件, 实际 ${PLUGINS.length}: ${PLUGINS.join(", ")}`);
    for (const must of ["穿山甲", "广点通", "快手", "百度", "Google"]) {
      a.ok(
        PLUGINS.some((f) => fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8").includes(must)),
        `缺少 ${must} 平台插件`
      );
    }
  },

  "ad-*.plugin: 零 [MitM] (拦广告不得产生证书成本)": async (a) => {
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

  "ad-*.plugin: 零 [Script]/[Rewrite] (纯 L2 域名拦截)": async (a) => {
    for (const f of PLUGINS) {
      const txt = fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8");
      for (const seg of ["Script", "Rewrite"]) {
        const body = section(txt, seg).filter((l) => l.trim() && !l.trim().startsWith("#"));
        a.equal(body.length, 0, `Plugin/${f} 不应有 [${seg}] 正条目 —— 广告平台只做 L2 域名 REJECT`);
      }
    }
  },

  "ad-*.plugin: 全部 [Rule] 一律 REJECT, 无 DIRECT/Proxy 例外": async (a) => {
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

  "ad-*.plugin: 不得声明 [Argument] ([Rule] 挂不了条件, 声明即死参数)": async (a) => {
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

  "ad-*.plugin: 每个平台都有可核验的域, 且不含已死域形态": async (a) => {
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
