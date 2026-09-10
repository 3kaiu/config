#!/usr/bin/env node
/**
 * 插件参数契约门禁 (2026-09-11 分模块审计 MOD-13)
 *
 * 本门禁针对六维审计与分模块审计共同发现的盲区:
 *   - [Argument] 声明 ↔ {占位符} 使用 之间没有任何校验
 *   - 导致: cron 占位符未声明(MOD-01)、debug 分支永不可达(MOD-02)、
 *     参数传了没人接(MOD-03)、46 个惰性 UI(MOD-05)、arguments-desc 漂移(MOD-06)
 *
 * 断言 (当前实现 #1/#2, #3 为观察级):
 *   1. 插件内使用的每个 {PLACEHOLDER} 必须在 [Argument] 有同名声明
 *      (排除: 纯数字正则量词 \d{4} / [A-Z]{2} / JS 模板字面量 ${url} / ${item.1})
 *   2. [Argument] 内声明的每个 switch 必须在插件某处被引用 (enable={X} 或 {X})
 *      (排除: select 类型 — 如 AI_Policy 作为策略位替换是正确用法)
 *   3. (TODO) 脚本若读取 $argument, 则调用它的 script-path 行必须传 argument=
 *
 * 用法: node tools/argument-contract-check.mjs [--quiet]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIRS = ["Plugin", "Kelee"];
const quiet = process.argv.includes("--quiet");

function analyze(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let seg = null;
  const declared = new Map();   // key -> { type, line }
  const used = new Map();       // key -> [line numbers]
  const metaMentions = new Map();

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^#!/.test(t)) {
      for (const m of t.matchAll(/\{([A-Za-z0-9_]+)\}/g)) metaMentions.set(m[1], i + 1);
      continue;
    }
    const sm = t.match(/^\[([A-Za-z ]+)\]$/);
    if (sm) { seg = sm[1]; continue; }
    if (!seg || !t || t.startsWith("#")) continue;

    if (seg === "Argument") {
      const km = t.match(/^([A-Za-z0-9_]+)\s*=/);
      if (km) {
        const type = t.match(/^[^=]+=\s*(\w+)/)?.[1] || "unknown";
        declared.set(km[1], { type, ln: i + 1 });
      }
      continue;
    }
    for (const m of t.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
      const k = m[1];
      // 排除纯数字 token (正则量词: \d{4}, [A-Z]{2}, (…){3})
      if (/^\d+$/.test(k)) continue;
      // 排除 ${…} JS 模板字面量 (Kelee/TelegramRedirect 的 request if … then redirect)
      const idx = m.index;
      if (idx > 0 && lines[i][idx - 1] === "$") continue;
      if (!used.has(k)) used.set(k, []);
      used.get(k).push(i + 1);
    }
  }
  return { declared, used, metaMentions };
}

let errs = 0;
let files = 0;

for (const d of DIRS) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".plugin"))) {
    files++;
    const rel = `${d}/${f}`;
    const { declared, used, metaMentions } = analyze(path.join(dir, f));

    // 断言 1: 使用的占位符必须有声明
    for (const [k, lns] of used) {
      if (declared.has(k)) continue;
      errs++;
      if (!quiet) console.log(`[未声明占位符] ${rel}:${lns[0]}  {${k}}`);
    }

    // 断言 2: switch 声明必须被引用 (select 排除 — 策略位替换是正确用法)
    for (const [k, info] of declared) {
      if (info.type !== "switch") continue;
      if (used.has(k)) continue;
      errs++;
      if (!quiet) console.log(`[死开关] ${rel}:${info.ln}  ${k}`);
    }
  }
}

if (errs) {
  console.log(`✗ 参数契约门禁失败: ${errs} 个问题 (扫描 ${files} 个插件)`);
  process.exit(1);
}
console.log(`✅ 参数契约门禁通过: ${files} 个插件的声明与占位符全部配对`);
