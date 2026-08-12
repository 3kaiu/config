#!/usr/bin/env node
/**
 * 模板↔产物漂移检测 — template/loon.tpl (含 snippet include) 的静态内容
 * 必须完整出现在 Profile/Loon.lcf 中。防止"改模板忘生成 / 手改产物与模板分叉"。
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
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const TPL = path.join(ROOT, "template", "loon.tpl");
const OUT = path.join(ROOT, "Profile", "Loon.lcf");
const SNIPPET_DIR = path.join(ROOT, "template", "snippet");

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
  const tplLines = readStaticLines(TPL);
  const outText = fs.readFileSync(OUT, "utf8");

  const missing = [];
  for (const line of tplLines) {
    if (!line) continue;
    if (!outText.includes(line)) missing.push(line);
  }

  if (missing.length > 0) {
    console.log(`✗ 模板 ${path.basename(TPL)} 有 ${missing.length} 条静态行未出现在 ${path.basename(OUT)} (漂移):`);
    for (const l of missing) console.log(`  - ${l.slice(0, 120)}`);
    console.log("  提示: 修改模板后需 npm run generate (或 surgio generate) 重新生成产物, 勿手改 Profile/。");
    return 1;
  }

  const extra = readGeneratedStaticLines(OUT);
  if (extra.length > 0) {
    console.log(`⚠ 产物 ${path.basename(OUT)} 有 ${extra.length} 条静态行不在模板中 (可能为本地维护或残留):`);
    for (const l of extra.slice(0, 20)) console.log(`  + ${l.slice(0, 100)}`);
    if (extra.length > 20) console.log(`  ... 其余 ${extra.length - 20} 条`);
  }

  console.log(`✅ 模板↔产物一致性检查通过: ${tplLines.length} 条静态行全部存在于 ${path.basename(OUT)}`);
  return 0;
}

process.exit(main());
