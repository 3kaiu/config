#!/usr/bin/env node
// 构建 src/*.ts → Scripts/*.js。
// 2026-09-29: 抽出为脚本而非内联 shell —— 精简后 src/ 可能为空 (只剩 src/lib/ 与 env.ts),
// 此时 esbuild 收到 0 个输入会连 --inject 一起报 "Invalid transform flag",
// 使 build-drift 门禁在"无源码可漂移"时反而判红。空输入集应视为干净通过。
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const OUT = process.env.BUILD_OUTDIR || join(ROOT, "Scripts");

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let sources;
try {
  sources = walk(SRC).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(`${join("src", "env.ts")}`) && !f.includes(`${join("src", "lib")}/`)
  );
} catch {
  sources = [];
}

if (sources.length === 0) {
  console.log("ℹ️  src/ 无可构建的脚本源码 (仅 env.ts / lib/ 或目录不存在) — 跳过构建");
  process.exit(0);
}

const args = [
  ...sources,
  "--inject:src/env.ts",
  "--inject:src/lib/net.ts",
  "--inject:src/lib/ad.ts",
  "--inject:src/lib/notify.ts",
  "--inject:src/lib/argument.ts",
  `--outdir=${OUT}`,
  "--minify",
  "--target=es2020",
];
console.log(`▶ esbuild ${sources.length} 个入口 → ${OUT}`);
// 用本仓 node_modules/.bin 下的 esbuild, 避免依赖调用方的 PATH
const ESBUILD = join(ROOT, "node_modules", ".bin", "esbuild");
execFileSync(existsSync(ESBUILD) ? ESBUILD : "esbuild", args, { cwd: ROOT, stdio: "inherit" });
