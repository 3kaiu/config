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
// 可疑的 Rewrite 第二 token — 2026-09-19 官方文档对齐 (docs/Rewrite/ 旧语法动作表无此 token):
//   `http-response <regex> url reject-200` / `list reject-200` —
//   [Script] 行必须带 script-path= (docs/Script/), [Rewrite] 动作位无 url/list。
//   归一化工具 rewrite-migrate 把它们当"历史遗留无效别名"处理, 佐证长期未生效。
//   `splash-reject` / `screen-reject` 同理 (动作表无此动作)。
//   大写 REJECT 在裸 `reject` 动作外另计 (Loon 动作大小写敏感存疑, 统一小写)。
// 先报告不判红: 真机确认逐条语义后, 批量搬 [Rewrite] 段标准形。
const SUSPICIOUS_ACTION =
  /\^[^ ]+ +(url|list) +(reject(-dict|-array|-img|-video|-200|-drop)?|302|307)\b|\^[^ ]+ +(splash-reject|screen-reject)\b/;
const RULE_PREFIX =
  /^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|URL-REGEX|IP-CIDR|IP-CIDR6|AND|DEST-PORT|SOURCE-IP|PROTOCOL|USER-AGENT|NETWORK|GEOIP|IN-PORT|NO-\w)/;

const quiet = process.argv.includes("--quiet");
let errs = 0;
let files = 0;

function check(dir) {
  const list = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".plugin"));
  for (const f of list) {
    files++;
    const txt = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
    const lines = txt.split("\n");
    let seg = null;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      const sm = t.match(/^\[([A-Za-z ]+)\]$/);
      if (sm) {
        seg = sm[1];
        if (!VALID_SEG.has(sm[1])) {
          errs++;
          if (!quiet) console.log(`[段错] ${dir}/${f}:${i + 1} [${sm[1]}]`);
        }
        continue;
      }
      if (!seg || !t || t.startsWith("#") || t.startsWith("!")) continue;
      if (seg === "Rewrite") {
        if (t.startsWith("(") && /\)\s+(302|307|301)/.test(t)) continue; // 捕获组重定向
        const ok = /^(\^|http-request |http-response |request |response |script )/.test(t) || t.startsWith("(");
        if (!ok) {
          errs++;
          if (!quiet) console.log(`[Rewrite格式] ${dir}/${f}:${i + 1} → ${t.slice(0, 60)}`);
        } else if (/^(\^|http-)/.test(t) && !ACTION_OK.test(t)) {
          errs++;
          if (!quiet) console.log(`[Rewrite动作] ${dir}/${f}:${i + 1} → ${t.slice(0, 80)}`);
        }
        if (SUSPICIOUS_ACTION.test(t)) {
          console.log(`[Rewrite动作可疑] ${dir}/${f}:${i + 1} → ${t.slice(0, 80)}`);
        }
      }
      // [Script]/[Rewrite] 跨段复核 — 2026-09-19 官方文档对齐 (docs/Script/ + docs/Rewrite/):
      // Loon 3.5.1 新语法下 `[Script]` 段的 `http-response <regex> reject-dict` 是合法形态
      // (脚本触发器位复用 Rewrite 动作, 无 script-path 即纯拒绝)。旧认知"必须带 script-path"
      // 已证伪 — 全仓 397 行皆此形态, Kelee 上游同构。故本检查只抓真正的段外行:
      // 非 cron / 非 http-request / 非 http-response / 非空行注释出现在 [Script] 段。
      if (seg === "Script" && !/^(http-request|http-response|cron)\b/.test(t)) {
        errs++;
        if (!quiet) console.log(`[Script段外行] ${dir}/${f}:${i + 1} → ${t.slice(0, 80)}`);
      }
      // enable={X}&{Y} 大括号配对(导入损坏形态: enable={X&{Y}})
      if (/enable=\{[^}&\s]*&\{[^}]*\}\}/.test(t)) {
        errs++;
        if (!quiet) console.log(`[enable括号] ${dir}/${f}:${i + 1} → ${t.slice(0, 80)}`);
      }
      // [Argument] 参数名以数字开头 — 解析器兼容性风险 (MOD-07)
      if (seg === "Argument" && /^\d/.test(t)) {
        errs++;
        if (!quiet) console.log(`[Argument数字开头] ${dir}/${f}:${i + 1} → ${t.slice(0, 80)}`);
      }
      // [MitM] hostname 行内混入字面量 hostname=(多行拼接污染)
      if (seg === "MitM" && /(^|\s)%APPEND%\s*hostname=|,\s*hostname=/.test(t)) {
        errs++;
        if (!quiet) console.log(`[MitM拼接] ${dir}/${f}:${i + 1} → ${t.slice(0, 80)}`);
      }
      if (seg === "Rule") {
        if (!RULE_PREFIX.test(t)) {
          errs++;
          if (!quiet) console.log(`[Rule错] ${dir}/${f}:${i + 1} → ${t.slice(0, 60)}`);
        }
        // KEYWORD 门控 — 2026-09-19 官方文档对齐 (docs/Rule/sub_rule: KEYWORD 随数量涨耗时):
        // 裸 DOMAIN-KEYWORD 必须被 AND(SUFFIX,…)/AND(USER-AGENT,…) 锚定 (bilibili-pro:81 /
        // qidian:71-73 双样板); ai.plugin 的 `{AI_Policy}` 占位策略行豁免 (分流非拦截)。
        // Kelee/ 上游外壳豁免 — 上游不可改, 本地门禁只约束 Plugin/ 自维护插件。
        if (dir === "Plugin" && /^DOMAIN-KEYWORD,/.test(t) && !/, *\{[A-Za-z0-9_]+\}\s*$/.test(t)) {
          errs++;
          if (!quiet) console.log(`[KEYWORD裸奔] ${dir}/${f}:${i + 1} → ${t.slice(0, 80)}`);
        }
      }
    }
  }
}

check("Plugin");
check("Kelee");
if (errs) {
  console.log(`✗ 插件语法门禁失败: ${errs} 个问题 (扫描 ${files} 个插件)`);
  process.exit(1);
}
console.log(`✅ 插件语法门禁通过: ${files} 个插件段结构与规则语法正常`);
