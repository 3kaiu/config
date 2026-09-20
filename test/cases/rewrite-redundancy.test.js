/**
 * rewrite-redundancy-check 用例 (2026-09-20 精简优化新增门禁)。
 * 覆盖: AllInOne `regex - action` 解析、Loon enable 尾参解析、
 * 同文件前缀遮蔽判死 ($ 锚/动作差异不误报)、跨文件精确重复、仓库现状通过门禁。
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

    "findShadowed 动作不同不遮蔽 (reject vs reject-200 语义不同)": async (a) => {
      const { findShadowed } = await import(TOOL);
      const rules = [
        { regex: "^https?:\\/\\/a\\.com\\/ads", action: "reject", rest: "" },
        { regex: "^https?:\\/\\/a\\.com\\/ads\\/v\\d\\/preload", action: "reject-200", rest: "" },
      ];
      a.equal(findShadowed(rules).length, 0, "action 不同, 不成立遮蔽");
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