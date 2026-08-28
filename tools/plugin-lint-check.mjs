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
  /reject|reject-dict|reject-img|reject-200|reject-403|reject-drop|reject-empty|response-body|mock-response-body|redirect|header-|script-path|request-body|url-remove|exception|direct|proxy|302|307|301|\d{3}|enable=\{/i;
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
      }
      // enable={X}&{Y} 大括号配对(导入损坏形态: enable={X&{Y}})
      if (/enable=\{[^}&\s]*&\{[^}]*\}\}/.test(t)) {
        errs++;
        if (!quiet) console.log(`[enable括号] ${dir}/${f}:${i + 1} → ${t.slice(0, 80)}`);
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
