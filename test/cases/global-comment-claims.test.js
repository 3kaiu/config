/**
 * NEW-04 复发守卫 (2026-09-20): template/loon.tpl 的 Global 注释数字 ↔ Mirror 实测
 *
 * 背景 (doc/audit-2026-09-11-deepdive.md NEW-04): 注释曾宣称 "34,579 条 SUFFIX",
 * 数字来自镜像文件自带的 # DOMAIN-SUFFIX: 头 (描述 blackmatrix7 完整规则集),
 * 而 Loon 正文是 209 行/198 条的小列表。NEW-04 已把注释改为实测数字, 但**没有任何
 * 门禁守住它** —— 上游再变, 数字静默漂移, 阅读者再次把头声明当计数用。
 *
 * 断言三件事:
 *   1. 模板注释的 "198 条" == 镜像正文非注释非空行数
 *   2. 正文实际构成 (KEYWORD 36 / CIDR+CIDR6 116 / USER-AGENT 46) 与注释逐类相符
 *   3. 头声明的 DOMAIN/DOMAIN-KEYWORD/DOMAIN-SUFFIX 计数是"完整集"语义,
 *      与正文不符 → 模板必须明确写出"不可当计数用", 否则判红 (防止未来有人
 *      把头声明数字重新抄进文档而免责说明又删了)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const TPL = path.join(REPO, "template", "loon.tpl");
const LIST = path.join(REPO, "Mirror", "rules", "loon-Global.list");

function parseComment() {
  const lines = fs.readFileSync(TPL, "utf8").split("\n");
  // Global 注释块: 主行起, 连续取 "#" 续行, 至 "⚠️ 更正" 行前止 ——
  // 数字可能被排版拆到主行 + 续行 (实测: "36" 在主行, "46/112/4" 在续行)。
  const idx = lines.findIndex((l) => /Global 再次/.test(l) && /条/.test(l));
  const block = [];
  for (let i = idx; i < lines.length && lines[i].startsWith("#") && !/⚠️/.test(lines[i]); i++) {
    block.push(lines[i]);
  }
  // 逐行剥掉 "#   " 前缀再拼接: 否则数字与类型名之间隔着 "#", `\d+\s+TYPE` 永远匹配不上。
  const main = block.map((l) => l.replace(/^#\s*/, "")).join(" ");
  const disclaimer = lines.find((l) => /不可当计数用/.test(l));
  return { main, disclaimer };
}

function parseList() {
  const raw = fs.readFileSync(LIST, "utf8").split("\n");
  const body = raw.filter((l) => l.trim() && !l.startsWith("#"));
  const counts = {};
  for (const line of body) {
    const type = line.split(",")[0].trim();
    counts[type] = (counts[type] || 0) + 1;
  }
  const header = {};
  for (const line of raw.filter((l) => l.startsWith("# "))) {
    const m = line.match(/^# ([A-Z0-9-]+): (\d+)$/);
    if (m) header[m[1]] = Number(m[2]);
  }
  return { total: body.length, counts, header };
}

exports.tests = {
  "NEW-04: 模板 Global 注释的条数 == 镜像正文实测 (上游变更即红)": async (a) => {
    const { main } = parseComment();
    a.ok(main, "模板中应存在 Global 注释主行");
    const list = parseList();
    const claimed = Number((main.match(/(\d+)\s*条/) || [])[1]);
    a.equal(claimed, list.total, `注释条数 ${claimed} 应等于正文实测 ${list.total}`);
  },
  "NEW-04: 注释逐类构成与镜像正文相符 (KEYWORD/CIDR/USER-AGENT)": async (a) => {
    const { main } = parseComment();
    a.ok(main, "模板中应存在 Global 注释块");
    const list = parseList();
    const types = Object.keys(list.counts);
    a.ok(types.length > 0, "镜像正文应至少有一种规则类型");
    for (const type of types) {
      a.ok(
        new RegExp(`\\b${list.counts[type]}\\s+${type}\\b`).test(main),
        `注释应含实测构成 ${list.counts[type]} ${type}`
      );
    }
    // 否定声明: 正文缺失的类型注释应显式写 0 (当前: 0 条 DOMAIN-SUFFIX)
    if (!list.counts["DOMAIN-SUFFIX"]) {
      a.ok(/0\s*条\s*DOMAIN-SUFFIX/.test(main), "正文无 DOMAIN-SUFFIX, 注释应显式声明 0 条");
    }
  },
  "NEW-04: 头声明与正文不符时, 免责说明必须仍在 (防数字再被当计数用)": async (a) => {
    const { disclaimer } = parseComment();
    const list = parseList();
    const headerTotal =
      (list.header["DOMAIN"] || 0) + (list.header["DOMAIN-KEYWORD"] || 0) + (list.header["DOMAIN-SUFFIX"] || 0);
    if (headerTotal === list.total) {
      a.ok(true, "头声明与正文一致 (上游若同步瘦身, 此断言自然放行)");
      return;
    }
    a.ok(
      disclaimer && /不可当计数用/.test(disclaimer),
      `头声明合计 ${headerTotal} ≠ 正文 ${list.total}, 模板必须保留"不可当计数用"免责行`
    );
  },
};
