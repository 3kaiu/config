#!/usr/bin/env node
/**
 * 模板↔产物漂移检测 + customParams 双向契约
 *
 * 断言 1 (2026-09-11 深度审计 NEW-13): surgio.conf.js 的 `customParams` 与 template/** 双向配对
 *   - 声明了但模板从未 `{{ customParams.<键> }}` 引用 = **死参数** (改它不生效)
 *   - 模板引用了但未声明 = 渲染为空 (更隐蔽: 不报错, 只是值消失)
 *   为什么必须机械把关: 该文件已连续出现两次同型缺陷 —— `surge_node_policy_path` (2026-09-11 早些时候
 *   删除) 与 `dns_primary`/`dns_fallback` (NEW-13)。后者尤其危险: 取值恰好是
 *   `template/loon.tpl:11` 硬编码 DNS 列表的首尾两台, 形成**双源** —— 改 customParams 看似生效、
 *   实则模板里的硬编码才是真值。人工审计抓了两次, 说明该靠门禁而不是靠眼睛。
 *
 * 断言 2: template/loon.tpl (含 snippet include) 的静态内容必须完整出现在 Profile/Loon.lcf 中。
 *   防止"改模板忘生成 / 手改产物与模板分叉"。
 *
 * 语义:
 *   - [Proxy] 段 (Surgio 注入节点) 为动态段, 跳过
 *   - 其余全部行 (含 [Proxy Group]/[Rule]/[Rewrite]/[MitM]/[General] 静态行) 逐一比对
 *   - {% include "./snippet/x.tpl" %} 指令内联展开后比对
 *
 * 用法: node tools/tpl-sync-check.mjs
 * 退出码: 0 = 无漂移; 1 = 存在漂移
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const TPL = path.join(ROOT, "template", "loon.tpl");
const OUT = path.join(ROOT, "Profile", "Loon.lcf");
const SNIPPET_DIR = path.join(ROOT, "template", "snippet");
const CONF = path.join(ROOT, "surgio.conf.js");

/**
 * 取出 surgio.conf.js 中 customParams 块声明的键。
 * 注释行一律跳过 —— 记录"某参数已移除"的注释不得被判成声明
 * (否则删掉死参数后门禁反而变红, 逼人删掉说明注释)。
 */
export function declaredParams(confText) {
  const m = confText.match(/customParams\s*:\s*\{([\s\S]*?)\n\s*\}/);
  if (!m) return [];
  const keys = [];
  for (const raw of m[1].split("\n")) {
    const t = raw.trim();
    if (!t || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    const km = t.match(/^([A-Za-z_$][\w$]*)\s*:/);
    if (km) keys.push(km[1]);
  }
  return keys;
}

/** 取出全部模板文本中被 `{{ customParams.<键> }}` 引用的键 */
export function referencedParams(tplTexts) {
  const used = new Set();
  for (const txt of tplTexts) {
    for (const m of txt.matchAll(/\{\{\s*customParams\.([A-Za-z_$][\w$]*)\s*\}\}/g)) used.add(m[1]);
  }
  return used;
}

/** 递归读取 template/**\/*.tpl 的文本 (snippet 里的引用同样算消费) */
export function readAllTemplates(dir = path.join(ROOT, "template")) {
  const out = [];
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".tpl")) out.push(fs.readFileSync(p, "utf8"));
    }
  };
  walk(dir);
  return out;
}

/** 双向契约: 返回 { declared, used, dead, missing } */
export function paramContract(confText, tplTexts) {
  const declared = declaredParams(confText);
  const used = referencedParams(tplTexts);
  return {
    declared,
    used,
    dead: declared.filter((k) => !used.has(k)),
    missing: [...used].filter((k) => !declared.includes(k)),
  };
}

function expandSnippet(line) {
  const m = line.match(/{%\s*include\s+"([^"]+)"\s*%}/);
  if (!m) return null;
  const f = path.join(SNIPPET_DIR, path.basename(m[1]));
  if (!fs.existsSync(f)) return [""];
  return fs.readFileSync(f, "utf8").split("\n");
}

function readStaticLines(tplPath) {
  const lines = fs.readFileSync(tplPath, "utf8").split("\n");
  const out = [];
  let inProxy = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\[Proxy\]$/.test(line)) { inProxy = true; continue; }
    if (inProxy && /^\[[A-Za-z]/.test(line)) inProxy = false;
    if (inProxy) {
      // [Proxy] 主体由 surgio 动态注入, 但注释行是模板静态内容, 纳入比对
      if (line.startsWith("#") && !out.includes(line)) out.push(line);
      continue;
    }
    if (!line || line.startsWith("#") || line.includes("{{")) continue;
    const incl = expandSnippet(line);
    if (incl) { for (const l of incl) { const t = l.trim(); if (t && !t.startsWith("#") && !t.includes("{{")) out.push(t); } continue; }
    out.push(line);
  }
  return out;
}

function readGeneratedStaticLines(outPath) {
  // 反向: 产物 [Rule]/[Rewrite]/[MitM] 等静态段中, 不属于模板 (含 snippet) 的独有行
  const tplLines = readStaticLines(TPL);
  const tplSet = new Set(tplLines);
  const lines = fs.readFileSync(outPath, "utf8").split("\n");
  const inDynamic = new Set(["[Proxy]", "[Proxy Group - Settings]"]);
  const sections = new Set(["[Rule]", "[Rewrite]", "[MitM]", "[General]", "[Host]", "[Plugin]", "[Proxy Group]"]);
  // 模板变量渲染产物值 ({{ customParams.* }} → 实际值), 非漂移
  const RENDERED = /^doh(3)?-server = |^doq-server = /;
  let current = null;
  const extra = [];
  for (const raw of lines) {
    const t = raw.trim();
    const sec = t.match(/^\[([^\]]+)\]$/);
    if (sec) {
      current = sec[1];
      continue;
    }
    if (current === "Proxy") {
      // [Proxy] 主体是 surgio 动态注入 (节点行), 但注释行属于模板静态内容,
      // 残留/修改会漂移 — 参与反向比对
      if (t.startsWith("#")) {
        if (!tplSet.has(t)) extra.push(t);
      }
      continue;
    }
    if (!t || t.startsWith("#") || t.includes("{{")) continue;
    if (!sections.has(`[${current}]`)) continue;
    if (RENDERED.test(t)) continue;
    if (!tplSet.has(t)) extra.push(t);
  }
  return extra;
}

function main() {
  // ── 断言 1: customParams 双向契约 (先跑 — 它只依赖构建输入, 与产物无关) ──
  // 变量名带 Params 后缀: 下方漂移比对里已有同名 `missing` (静态行集合), 同函数作用域会重复声明。
  const {
    declared,
    dead: deadParams,
    missing: undeclaredParams,
  } = paramContract(fs.readFileSync(CONF, "utf8"), readAllTemplates());
  if (deadParams.length > 0 || undeclaredParams.length > 0) {
    if (deadParams.length > 0) {
      console.log(`✗ surgio.conf.js 的 customParams 有 ${deadParams.length} 个死参数 (模板从未引用, 改它不生效):`);
      for (const k of deadParams) console.log(`  - ${k}`);
    }
    if (undeclaredParams.length > 0) {
      console.log(`✗ 模板引用了 ${undeclaredParams.length} 个未声明的 customParams 键 (会被渲染成空值):`);
      for (const k of undeclaredParams) console.log(`  - ${k}`);
    }
    console.log("  修法: 死参数删除 (顺带保留一行 `// (已移除) <键>` 说明); 模板引用的键须在 surgio.conf.js 声明。");
    return 1;
  }

  const tplLines = readStaticLines(TPL);
  const outText = fs.readFileSync(OUT, "utf8");

  // 精确行集合比对 (旧 includes 子串匹配会被 LCF 注释行蒙混)
  const outSet = new Set(outText.split("\n").map((l) => l.trim()));
  const missing = [];
  for (const line of tplLines) {
    if (!line) continue;
    if (!outSet.has(line)) missing.push(line);
  }

  if (missing.length > 0) {
    console.log(`✗ 模板 ${path.basename(TPL)} 有 ${missing.length} 条静态行未出现在 ${path.basename(OUT)} (漂移):`);
    for (const l of missing) console.log(`  - ${l.slice(0, 120)}`);
    console.log("  提示: 修改模板后需 npm run generate (或 surgio generate) 重新生成产物, 勿手改 Profile/。");
    return 1;
  }

  const extra = readGeneratedStaticLines(OUT);
  if (extra.length > 0) {
    console.log(`✗ 产物 ${path.basename(OUT)} 有 ${extra.length} 条静态行不在模板中 (手改产物/生成器漂移):`);
    for (const l of extra.slice(0, 20)) console.log(`  + ${l.slice(0, 100)}`);
    if (extra.length > 20) console.log(`  ... 其余 ${extra.length - 20} 条`);
    console.log("  提示: 产物行必须先进入模板 (或 snippet), 再 npm run generate。");
    return 1;
  }

  console.log(
    `✅ 模板↔产物一致性检查通过: ${tplLines.length} 条静态行全部存在于 ${path.basename(OUT)}; ` +
      `customParams ${declared.length} 个键双向配对`
  );
  return 0;
}

const isEntryPoint = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) process.exit(main());
