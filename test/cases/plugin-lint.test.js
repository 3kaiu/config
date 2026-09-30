/**
 * plugin-lint-check 的行为用例 (2026-09-30 新增)
 *
 * 工具的头部注释一直写着"供 CLI 与 test/cases/plugin-lint-check.test.js 复用", 但那个文件
 * **从未存在** —— 该门禁此前只有 CLI 一条路(check:plugin), 没有行为级回归。本文件补上这条腿,
 * 优先覆盖 2026-09-30 新加的**元数据**检查:
 *
 *   · 官方《插件》页的 10 个 `#!` 字段之外的字段判红 —— 实测 `jd.plugin`/`qidian.plugin` 用了
 *     社区习惯的 `#!version`(官方表未收录), 而当时**没有任何检查能发现**(AGENTS.md 那句
 *     "插件元数据只用官方 `#!` 集合"是纸面纪律)。
 *   · `#!name` 不得嵌会漂移的数量 —— 实测 `ad-block.plugin` 的 `#!name` 写着"7 平台 59 域"时,
 *     文件里已经是 967 条规则(生成式覆盖 + 社区复核收录后没人回头改名字)。
 *
 * 判据来源: https://nsloon.app/docs/Plugin/ (2026-09-30 逐字核对)。
 */
"use strict";

let mod = null;
const load = async () => (mod ??= await import("../../tools/plugin-lint-check.mjs"));

/** 最小合法插件: 一段 [Rule] + 一条精确域 REJECT */
const wrap = (meta) => `${meta}\n[Rule]\nDOMAIN, a.example.com, REJECT\n`;
const metaErrs = (r) => r.errs.filter((e) => e.includes("[元数据]"));

exports.tests = {
  "元数据: 官方 10 个 #! 字段全过, 表外字段一律判红": async (a) => {
    const { lintText } = await load();
    const official = [
      "name",
      "desc",
      "author",
      "homepage",
      "icon",
      "system",
      "system_version",
      "loon_version",
      "tag",
      "type",
    ];
    const r1 = lintText(wrap(official.map((k) => `#!${k} = x`).join("\n")));
    a.equal(metaErrs(r1).length, 0, `官方字段不该判红: ${metaErrs(r1).join(" | ")}`);

    // 这些是社区插件(kelee / fmz200)在用的表外字段 —— 本仓一律不采纳
    for (const bad of ["version", "arguments-desc", "date", "openUrl", "raw-url", "tg-channel"]) {
      const r = lintText(wrap(`#!name = x\n#!${bad} = 1`));
      a.ok(
        metaErrs(r).some((e) => e.includes(bad)),
        `#!${bad} 不在官方表内, 必须判红 —— 否则"只用官方集合"没有强制力`
      );
    }
  },

  "元数据: #!name 不得嵌会漂移的数量 (域/条/平台/通道)": async (a) => {
    const { lintText } = await load();
    for (const bad of [
      "广告平台拦截器（L0·7 平台 59 域）",
      "上报与埋点拦截器（M3·6 通道 37 域）",
      "拦截器（967 条）",
    ]) {
      const r = lintText(wrap(`#!name = ${bad}`));
      a.ok(metaErrs(r).some((e) => e.includes("name")), `#!name 含数量应判红: ${bad}`);
    }
    // 层级标记(L0/M3)与型号类数字不是"数量", 不得误伤
    for (const good of ["DNS 防泄漏拦截器（L0 依赖层）", "上报与埋点拦截器（M3）"]) {
      const r = lintText(wrap(`#!name = ${good}`));
      a.equal(metaErrs(r).length, 0, `层级标记不该判红: ${good} → ${metaErrs(r).join(" | ")}`);
    }
  },

  "段名: 官方 7 段之外判红 (含 [Plugin] 这类主配置段)": async (a) => {
    const { lintText } = await load();
    // 官方《插件》页给出的段集合: Argument / General / Rule / Rewrite / Host / Script / MitM
    for (const seg of ["Argument", "General", "Rule", "Rewrite", "Host", "Script", "MitM"]) {
      const r = lintText(`#!name = x\n[${seg}]\n`);
      a.ok(!r.errs.some((e) => e.includes("[段错]")), `官方段不该判红: [${seg}]`);
    }
    // [Plugin] 是主配置段(插件里没有这个段) —— 写进插件说明作者把两层搞混了
    for (const bad of ["Plugin", "Proxy", "Filter"]) {
      const r = lintText(`#!name = x\n[${bad}]\n`);
      a.ok(r.errs.some((e) => e.includes("[段错]")), `[${bad}] 不是插件段, 必须判红`);
    }
  },
};
