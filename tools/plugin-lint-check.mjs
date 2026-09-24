#!/usr/bin/env node
/**
 * 插件语法门禁: 校验 Plugin/ 与 Kelee/ 全部 .plugin 的段结构、规则类型、Rewrite 动作。
 * 合法但易误报的写法已豁免: 捕获组重定向 (^...)(...) 302 $1、request if 条件式、
 * 301/302/307 重定向动作。
 *
 * 用法: node tools/plugin-lint-check.mjs [--quiet]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VALID_SEG = new Set(["Rule", "Rewrite", "MitM", "Script", "Argument", "Host", "General"]);
const ACTION_OK =
  /reject|reject-dict|reject-array|reject-img|reject-video|reject-200|reject-403|reject-drop|reject-empty|response-body|mock-response-body|redirect|header-|script-path|request-body|url-remove|exception|direct|proxy|302|307|301|\d{3}|enable=\{/i;
// 可疑的 Rewrite 第二 token — 官方动作表无此 token:
//   `http-response <regex> url reject-200` / `list reject-200` —
//   [Script] 行必须带 script-path=，[Rewrite] 动作位无 url/list。
//   `splash-reject` / `screen-reject` 同理。
//   大写 REJECT 在裸 `reject` 动作外另计 (Loon 动作大小写敏感存疑, 统一小写)。
// 先报告不判红: 真机确认逐条语义后, 批量搬 [Rewrite] 段标准形。
const SUSPICIOUS_ACTION =
  /\^[^ ]+ +(url|list) +(reject(-dict|-array|-img|-video|-200|-drop)?|302|307)\b|\^[^ ]+ +(splash-reject|screen-reject)\b/;
const RULE_PREFIX =
  /^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|URL-REGEX|IP-CIDR|IP-CIDR6|AND|DEST-PORT|SOURCE-IP|PROTOCOL|USER-AGENT|NETWORK|GEOIP|IN-PORT|NO-\w)/;

const quiet = process.argv.includes("--quiet");

/**
 * 单插件文本检查 — 纯函数 (无 I/O、无全局态), 供 CLI 与 test/cases/plugin-lint-check.test.js 复用。
 * @returns {{ errs: string[], reports: string[] }} errs 判红; reports 仅报告 (不判红)
 */
export function lintText(txt, { dir = "Plugin", file = "x.plugin" } = {}) {
  const errs = [];
  const reports = [];
  const lines = txt.split("\n");
  let seg = null;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const sm = t.match(/^\[([A-Za-z ]+)\]$/);
    if (sm) {
      seg = sm[1];
      if (!VALID_SEG.has(sm[1])) errs.push(`[段错] ${dir}/${file}:${i + 1} [${sm[1]}]`);
      continue;
    }
    if (!seg || !t || t.startsWith("#") || t.startsWith("!")) continue;
    if (seg === "Rewrite") {
      if (t.startsWith("(") && /\)\s+(302|307|301)/.test(t)) continue; // 捕获组重定向
      const ok = /^(\^|http-request |http-response |request |response |script )/.test(t) || t.startsWith("(");
      if (!ok) {
        errs.push(`[Rewrite格式] ${dir}/${file}:${i + 1} → ${t.slice(0, 60)}`);
      } else if (/^(\^|http-)/.test(t) && !ACTION_OK.test(t)) {
        errs.push(`[Rewrite动作] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
      }
      if (SUSPICIOUS_ACTION.test(t)) reports.push(`[Rewrite动作可疑] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
      // 裸 reject 分拣 — 2026-09-19 官方文档对齐 (docs/Policy/ + docs/Rewrite/):
      // 裸 `reject` = 直接断开连接; 有 UI 等待的接口会转圈/重试, 应改 reject-dict/200。
      // 确认无重试的纯埋点在行尾加 `# no-retry` 豁免。
      // 报告级 (不判红): 存量逐条需真机确认, 先报告清单; 新出现的行由本报告 + 用例兜底。
      if (/(^|\s)reject([, ]|$)/.test(t) && !/#\s*no-retry/.test(t)) {
        reports.push(`[裸reject待确认] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
      }
    }
    // [Script]/[Rewrite] 跨段复核 — 2026-09-19 官方文档对齐 (docs/Script/ + docs/Rewrite/):
    // Loon 3.5.1 新语法下 `[Script]` 段的 `http-response <regex> reject-dict` 是合法形态
    // (脚本触发器位复用 Rewrite 动作, 无 script-path 即纯拒绝)。旧认知"必须带 script-path"
    // 已证伪 — 全仓大量行皆此形态, Kelee 上游同构。故本检查只抓真正的段外行:
    // 非 cron / 非 http-request / 非 http-response / 非 generic (手动触发) 出现在 [Script] 段。
    // (generic 见 docs/Script/: "在 App 中手动触发" — 如 Plugin/diagnostics.plugin。)
    if (seg === "Script" && !/^(http-request|http-response|cron|generic)\b/.test(t)) {
      errs.push(`[Script段外行] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
    }
    // enable={X}&{Y} 大括号配对(导入损坏形态: enable={X&{Y}})
    if (/enable=\{[^}&\s]*&\{[^}]*\}\}/.test(t)) {
      errs.push(`[enable括号] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
    }
    // [Argument] 参数名以数字开头 — 解析器兼容性风险 (MOD-07)
    if (seg === "Argument" && /^\d/.test(t)) {
      errs.push(`[Argument数字开头] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
    }
    // [MitM] hostname 行内混入字面量 hostname=(多行拼接污染)
    if (seg === "MitM" && /(^|\s)%APPEND%\s*hostname=|,\s*hostname=/.test(t)) {
      errs.push(`[MitM拼接] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
    }
    if (seg === "Rule") {
      if (!RULE_PREFIX.test(t)) {
        errs.push(`[Rule错] ${dir}/${file}:${i + 1} → ${t.slice(0, 60)}`);
      }
      // REJECT 动作分级 — 2026-09-19 官方文档对齐 (docs/Policy/: REJECT=404空体,
      // REJECT-DROP=直接丢弃无响应, App 会立即重试, 请求风暴时慎用):
      // 本仓 [Rule]/插件 [Rule] 段不得用 DROP (上报域用 REJECT 同样不展示且不制造重试)。
      if (/,\s*REJECT-DROP\b/.test(t)) {
        errs.push(`[DROP禁用于Rule] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
      }
      // KEYWORD 门控 — 2026-09-19 官方文档对齐 (docs/Rule/sub_rule: KEYWORD 随数量涨耗时):
      // 裸 DOMAIN-KEYWORD 必须被 AND(SUFFIX,…)/AND(USER-AGENT,…) 锚定 (bilibili-pro:81 /
      // qidian:71-73 双样板); ai.plugin 的 `{AI_Policy}` 占位策略行豁免 (分流非拦截)。
      // Kelee/ 上游外壳豁免 — 上游不可改, 本地门禁只约束 Plugin/ 自维护插件。
      if (dir === "Plugin" && /^DOMAIN-KEYWORD,/.test(t) && !/, *\{[A-Za-z0-9_]+\}\s*$/.test(t)) {
        errs.push(`[KEYWORD裸奔] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
      }
    }
  }
  return { errs, reports };
}

/** 扫描 Plugin/ 与 Kelee/ 全部外壳。@returns {{ errs, reports, files }} */
export function scanAll(dirs = ["Plugin", "Kelee"]) {
  const errs = [];
  const reports = [];
  let files = 0;
  for (const dir of dirs) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith(".plugin"))) {
      files++;
      const r = lintText(fs.readFileSync(path.join(ROOT, dir, f), "utf8"), { dir, file: f });
      errs.push(...r.errs);
      reports.push(...r.reports);
    }
  }
  return { errs, reports, files };
}

export function main() {
  const { errs, reports, files } = scanAll();
  if (!quiet) for (const r of reports) console.log(r);
  if (errs.length) {
    for (const e of errs) console.log(e);
    console.log(`✗ 插件语法门禁失败: ${errs.length} 个问题 (扫描 ${files} 个插件)`);
    process.exit(1);
  }
  console.log(`✅ 插件语法门禁通过: ${files} 个插件段结构与规则语法正常`);
}

/** 入口守卫: 顶层仅在被直接执行时跑 main (测试可安全 import) */
function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
if (isMain()) main();
