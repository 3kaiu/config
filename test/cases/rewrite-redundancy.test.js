/**
 * rewrite-redundancy-check 用例 (2026-09-20 精简优化新增门禁)。
 * 覆盖: AllInOne `regex - action` 解析、Loon enable 尾参解析、
 * 同文件前缀遮蔽判死 (action 不参与 — 匹配先于派发; enable 不同不遮蔽)、
 * 跨文件精确重复、仓库现状通过门禁。
 */
"use strict";

const path = require("path");
const { pathToFileURL } = require("url");

const TOOL = pathToFileURL(path.join(__dirname, "..", "..", "tools", "rewrite-redundancy-check.mjs")).href;

exports.tests = {
    "parseRuleLine Loon 格式 (regex action enable=...)": async (a) => {
      const { parseRuleLine } = await import(TOOL);
      const r = parseRuleLine("^https?:\\/\\/api\\.gotokeep\\.com\\/search\\/v\\d\\/hotword reject-200 enable={ENABLE_X}");
      a.equal(r.regex, "^https?:\\/\\/api\\.gotokeep\\.com\\/search\\/v\\d\\/hotword", "regex 还原");
      a.equal(r.action, "reject-200", "action 还原");
      a.equal(r.rest, "enable={ENABLE_X}", "enable 尾参还原");
    },

    "parseRuleLine AllInOne 格式 (regex - action)": async (a) => {
      const { parseRuleLine } = await import(TOOL);
      const r = parseRuleLine("^https:\\/\\/api\\.gotokeep\\.com\\/ads - reject");
      a.equal(r.regex, "^https:\\/\\/api\\.gotokeep\\.com\\/ads", "regex 还原");
      a.equal(r.action, "reject", "action 还原 (跳过 `-` 分隔符)");
      a.equal(r.rest, "", "无尾参");
    },

    // 2026-09-29: qidian [Rewrite] 迁到 Loon 3.5.1(978) 新语法后, 三个解析器
    // (rewrite-redundancy / mitm-coverage / mitm-orphan) 全都只认旧形态 → 匹配 0 条,
    // 门禁"全绿"实为空转假绿。本例把新形态钉进解析器契约, 防再次失明。
    "parseRuleLine Loon 3.5.1 新语法 (response if … then …)": async (a) => {
      const { parseRuleLine } = await import(TOOL);
      // 用普通字符串而非模板字面量: 模板里的 `\/` 会被当作 `/` 吞掉反斜杠, 测的就不是配置了。
      const r = parseRuleLine(
        "response if ${CAPTURE_ENABLE} == true && ${url} ~= /^https:\\/\\/a\\.com\\/api$/ then reject_dict(200)"
      );
      a.ok(r !== null, "新语法行必须能解析出规则 (否则门禁对该段空转)");
      a.equal(r.regex, "^https:\\/\\/a\\.com\\/api$", "regex 从 ${url} ~= /…/ 抽出, 转义原样保留");
      a.equal(r.action, "reject_dict(200)", "action 从 then 之后抽出");
      a.equal(r.rest, "${CAPTURE_ENABLE} == true &&", "条件串进 rest (遮蔽判定要求条件逐字一致)");
    },

    "parseRuleLine 新语法条件不同时不遮蔽": async (a) => {
      const { parseRuleLine, findShadowed } = await import(TOOL);
      const mk = (sw) =>
        parseRuleLine(
          "response if ${" + sw + "} == true && ${url} ~= /^https:\\/\\/a\\.com\\/ads/ then reject_dict(200)"
        );
      const rules = [mk("EN"), mk("DIS")];
      a.ok(rules[0] !== null && rules[1] !== null, "两条新语法规则都应解析成功");
      a.equal(findShadowed(rules).length, 0, "开关不同的同前缀规则不互相遮蔽");
    },

    "parseRuleLine 新旧语法混用都被识别": async (a) => {
      const { parseRuleLine } = await import(TOOL);
      a.ok(parseRuleLine("^https:\\/\\/a\\.com\\/x reject-dict enable={EN}") !== null, "旧形态");
      a.ok(parseRuleLine("response if ${url} ~= /\\/a\\/ then reject_dict(200)") !== null, "新形态");
      a.equal(parseRuleLine("# 注释行"), null, "注释不算规则");
      a.equal(parseRuleLine("h5.if.qidian.com"), null, "[MitM] 裸 hostname 不算规则");
    },

    "findShadowed 同 action+enable 严格前缀遮蔽判死": async (a) => {
      const { findShadowed } = await import(TOOL);
      const rules = [
        { regex: "^https?:\\/\\/a\\.com\\/ads", action: "reject-200", rest: "enable={E}" },
        { regex: "^https?:\\/\\/a\\.com\\/ads\\/v\\d\\/preload", action: "reject-200", rest: "enable={E}" },
      ];
      const s = findShadowed(rules);
      a.equal(s.length, 1, "子条被前缀罩住判死");
      a.equal(s[0].shadowedBy.regex, "^https?:\\/\\/a\\.com\\/ads", "遮蔽方是前缀规则");
    },

    "findShadowed action 不同仍判死 (匹配先于 action 派发, reject 罩住 reject-200)": async (a) => {
      const { findShadowed } = await import(TOOL);
      const rules = [
        { regex: "^https?:\\/\\/a\\.com\\/ads", action: "reject", rest: "" },
        { regex: "^https?:\\/\\/a\\.com\\/ads\\/v\\d\\/preload", action: "reject-200", rest: "" },
      ];
      const s = findShadowed(rules);
      a.equal(s.length, 1, "前缀先命中文档化语义: action 不同仍让子条不可达");
      a.equal(s[0].action, "reject-200", "被遮蔽条保留自己的 action 供追踪");
    },

    "findShadowed enable 不同不遮蔽 (前缀规则可被开关关闭, 先命中前提不成立)": async (a) => {
      const { findShadowed } = await import(TOOL);
      const rules = [
        { regex: "^https?:\\/\\/a\\.com\\/ads", action: "reject", rest: "enable={A}" },
        { regex: "^https?:\\/\\/a\\.com\\/ads\\/v\\d\\/preload", action: "reject", rest: "enable={B}" },
      ];
      a.equal(findShadowed(rules).length, 0, "enable 不同, 不成立遮蔽");
    },

    "findShadowed 锚定串不充当前缀 ($ 出现在中间)": async (a) => {
      const { findShadowed } = await import(TOOL);
      const rules = [
        { regex: "^https?:\\/\\/a\\.com\\/ads$", action: "reject-200", rest: "enable={E}" },
        { regex: "^https?:\\/\\/a\\.com\\/ads\\/v\\d\\/preload", action: "reject-200", rest: "enable={E}" },
      ];
      a.equal(findShadowed(rules).length, 0, "$ 锚定的 A 不是 B 的字符串前缀");
    },

    "findExactDuplicates 跨文件精确重复": async (a) => {
      const { findExactDuplicates } = await import(TOOL);
      const dups = findExactDuplicates([
        ["p1.plugin", [{ regex: "^a", action: "reject", rest: "x", line: 1 }]],
        ["p2.plugin", [{ regex: "^a", action: "reject", rest: "x", line: 9 }]],
      ]);
      a.equal(dups.length, 1, "两文件同条规则判重复");
      a.equal(dups[0].occurrences.length, 2, "两处出现");
    },

    "仓库现状通过门禁 (全部冗余已登记/已清理)": async (a) => {
      const { analyze } = await import(TOOL);
      a.equal(analyze(), 0, "分析函数返回 0 (无未登记冗余)");
    },
};