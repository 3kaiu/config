#!/usr/bin/env node
/**
 * 镜像漂移检测 (2026-09-11 分模块审计 MOD-09)
 *
 * 问题: mirror-scripts.yml 声明 `releases/latest/download/…`, 但 keep_old 会在 fetch
 * 失败时静默保留旧版 → MANIFEST 记录的是固定旧版本, 与声明不再一致。
 * 本工具比对 "workflow 声明的 mirror() URL" 与 "MANIFEST 实际记录的 source_url",
 * 输出漂移清单 — 供维护者决定是修复上游 URL、还是接受受管陈旧。
 *
 * 用法: node tools/mirror-drift-check.mjs [--quiet]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WF = path.join(ROOT, ".github/workflows/mirror-scripts.yml");
const MANIFEST = path.join(ROOT, "Mirror/MANIFEST.json");
const quiet = process.argv.includes("--quiet");

// 1. 解析 workflow 中的 mirror() 调用
const wfTxt = fs.readFileSync(WF, "utf8");
const declared = new Map(); // dest -> url
for (const m of wfTxt.matchAll(/mirror\s+"([^"]+)"\s+\\?\s*\n\s+"([^"]+)"/g)) {
  declared.set(m[2], m[1]);
}

// 2. 读取 MANIFEST
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const recorded = new Map(); // dest -> source_url
for (const [k, v] of Object.entries(manifest.files || {})) {
  if (v.source_url) recorded.set(k, v.source_url);
}

let drift = 0, missing = 0, orphan = 0;

// A) 声明 URL ≠ 记录 URL → 漂移 (keep_old 残留)
for (const [dest, url] of declared) {
  const actual = recorded.get(dest);
  if (!actual) { missing++; continue; }
  if (url !== actual) {
    drift++;
    if (!quiet) {
      console.log(`[URL漂移] ${dest}`);
      console.log(`  声明: ${url}`);
      console.log(`  记录: ${actual}`);
    }
  }
}

// B) 清单有但 workflow 不再声明 → 孤儿保留
for (const dest of recorded.keys()) {
  if (!declared.has(dest)) {
    orphan++;
    if (!quiet) console.log(`[孤儿保留] ${dest} (workflow 不再声明)`);
  }
}

// C) 从未抓到的 (声明有但清单无) — 单独列出
if (!quiet && missing) {
  console.log(`\n[从未抓到] ${missing} 条 (声明存在但清单无记录, 可能永久失败或尚未首次运行):`);
  for (const [dest, url] of declared) {
    if (!recorded.has(dest)) console.log(`  ${dest} → ${url}`);
  }
}

const total = declared.size;
const clean = total - drift - missing;

if (!quiet) {
  console.log(`\n══ 镜像漂移摘要 ══`);
  console.log(`  workflow 声明: ${total} 条`);
  console.log(`  MANIFEST 记录: ${recorded.size} 条`);
  console.log(`  一致:          ${clean} 条`);
  console.log(`  URL 漂移:      ${drift} 条 (keep_old 保留旧版)`);
  console.log(`  从未抓到:      ${missing} 条`);
  console.log(`  孤儿保留:      ${orphan} 条`);
}

// 漂移和孤儿都是可观察问题, 但不一定需要立即修复;
// 从未抓到则可能是永久失败, 需要关注。
if (missing) {
  console.log(`✗ 镜像漂移检测: ${missing} 条从未成功抓取 (需检查上游 URL 是否有效)`);
  process.exit(1);
}
if (drift) {
  console.log(`⚠️ 镜像漂移检测: ${drift} 条 URL 漂移 (keep_old 静默保留旧版)`);
  // 不退出 1 — 漂移是已知行为, 作为观察项而非门禁失败
  process.exit(0);
}
console.log(`✅ 镜像漂移检测通过: ${total} 条声明全部与 MANIFEST 一致`);
