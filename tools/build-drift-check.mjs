#!/usr/bin/env node
/**
 * 产物漂移检测 (2026-09-29 全方位审计 P2-9)
 *
 * 缺陷实测: 手改 `Scripts/Diagnostics.js` 后, `npm test` / `npm run lint` /
 * `npm run check:all` **全部 exit 0**, 而 `npm run build` 又会把改动**静默覆盖** ——
 * 本地三条门禁都看不见"产物被手改"这件事, 只有 CI `script-tests.yml` 的
 * `Gate on build output drift` 会红。AGENTS.md 已声明该门禁由 CI 负责, 但本地
 * 零反馈意味着: 人会在本地改产物 → 以为改成功了 → push 前 build 又把它覆盖回去,
 * 改动凭空消失。故补一条**不写工作树**的本地等价门禁。
 *
 * 实现: 复用 package.json 的 `build` 命令, 仅把 `--outdir=Scripts` 换成临时目录,
 * 重建后与 `Scripts/` 逐字节比对。语义与 CI 完全一致 (同一 esbuild 版本、同一份
 * inject、同一 target), 但**不触碰 Scripts/**, 因此:
 *   - 手改产物 → 重建结果 ≠ 磁盘产物 → 判红
 *   - 改了 src 忘了 build → 重建结果 ≠ 磁盘产物 → 判红
 *   - 产物有 src 已不存在的孤儿 → extra → 判红
 * esbuild 是确定性输出 (无时间戳/随机因子), 且 esbuild 版本被 package-lock 钉住,
 * 故跨机器比对稳定。
 *
 * 豁免: `Scripts/Qidian.js` 是无源码手工轨 (AGENTS.md「关键路径」明文), 无 src 对应,
 * 不参与重建比对, 但仍要求它在场 (否则 wiring-check 的引用存在性会先红)。
 *
 * 用法:
 *   node tools/build-drift-check.mjs           重建到临时目录并比对, 有漂移即 exit 1
 *   node tools/build-drift-check.mjs --quiet   只输出判定行
 *
 * 接线: `npm run check:scripts` (进 check:all) + test/cases/build-drift.test.js。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** 无源码手工轨 (AGENTS.md): 不参与重建比对 */
export const HANDWRITTEN = new Set(["Qidian.js"]);

/**
 * src 入口 (排除 env.ts 与 src/lib/* —— 与 package.json build 的 find 表达式一致)。
 * 返回 Map(源文件名 → 入口名), 如 AlipayMini.ts → AlipayMini.js
 */
export function listSources(root) {
  const srcDir = path.join(root, "src");
  const map = new Map();
  if (!fs.existsSync(srcDir)) return map;
  for (const f of fs.readdirSync(srcDir)) {
    if (!f.endsWith(".ts") || f === "env.ts") continue;
    map.set(f, f.replace(/\.ts$/, ".js"));
  }
  return map;
}

/** Scripts/ 下的产物文件名集合 (仅顶层 *.js) */
export function listArtifacts(root) {
  const dir = path.join(root, "Scripts");
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".js")));
}

/** 重建到临时目录, 返回该目录 (调用方负责清理) */
export function rebuild(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const build = String(pkg.scripts?.build || "");
  const MARK = "--outdir=Scripts";
  if (!build.includes(MARK)) {
    throw new Error(`package.json 的 build 脚本不含 ${MARK}, 无法重定向到临时目录`);
  }
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "build-drift-"));
  const cmd = build.replaceAll(MARK, `--outdir=${outdir}`);
  const bin = path.join(root, "node_modules", ".bin");
  execFileSync(cmd, {
    cwd: root,
    shell: "/bin/bash",
    stdio: "pipe",
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH || ""}` },
  });
  return outdir;
}

/**
 * 比对重建结果与磁盘产物。
 * 返回 { mismatch: [], missing: [], extra: [] }
 *   mismatch — 同名但内容不同 (手改产物 / 改了 src 没 build)
 *   missing  — 该产物缺一边: 磁盘没有 = 改了 src 没 build; 重建没有 = src 入口与产物对不上
 *   extra    — 磁盘有而期望集合外 (孤儿产物: src 已删但产物残留)
 */
export function compare(root, rebuiltDir, { handwritten = HANDWRITTEN } = {}) {
  const sources = listSources(root);
  const artifacts = listArtifacts(root);
  // rebuiltDir 下的文件即"src 应有的全部产物"
  const rebuilt = fs.existsSync(rebuiltDir)
    ? new Set(fs.readdirSync(rebuiltDir).filter((f) => f.endsWith(".js")))
    : new Set();

  const sha = (p) => {
    try {
      return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    } catch {
      return null;
    }
  };

  const mismatch = [];
  const missing = [];
  const extra = [];

  for (const name of sources.values()) {
    if (handwritten.has(name)) continue;
    const onDisk = path.join(root, "Scripts", name);
    const rebuiltFile = path.join(rebuiltDir, name);
    if (!fs.existsSync(onDisk)) {
      missing.push({ name, reason: "磁盘无此产物 (改了 src 却没跑 npm run build)" });
      continue;
    }
    if (!fs.existsSync(rebuiltFile)) {
      missing.push({ name, reason: "重建结果中不存在 (src 入口与产物对不上)" });
      continue;
    }
    if (sha(onDisk) !== sha(rebuiltFile)) mismatch.push({ name, reason: "与 src 重建结果不一致" });
  }
  for (const name of artifacts) {
    if (handwritten.has(name)) continue;
    if (!rebuilt.has(name)) extra.push({ name, reason: "孤儿产物 (src 中无对应入口, 或已随 src 删除而残留)" });
  }
  return { mismatch, missing, extra };
}

export function run(root = ROOT, { quiet = false } = {}) {
  const artifactsDir = path.join(root, "Scripts");
  if (!fs.existsSync(artifactsDir)) {
    console.log("✗ 产物漂移检测: Scripts/ 不存在 (先跑 npm run build)");
    return 1;
  }

  let rebuiltDir = null;
  try {
    rebuiltDir = rebuild(root);
    const { mismatch, missing, extra } = compare(root, rebuiltDir);
    const total = mismatch.length + missing.length + extra.length;

    if (!quiet) {
      for (const m of mismatch) console.log(`  [内容漂移] Scripts/${m.name} — ${m.reason}`);
      for (const m of missing) console.log(`  [缺产物]   Scripts/${m.name} — ${m.reason}`);
      for (const e of extra) console.log(`  [孤儿产物] Scripts/${e.name} — ${e.reason}`);
    }

    if (total) {
      console.log(`✗ 产物漂移门禁: 内容漂移 ${mismatch.length} + 缺产物 ${missing.length} + 孤儿 ${extra.length}`);
      if (!quiet) {
        console.log("  处置: 只改 src → 跑 `npm run build` 后提交产物;");
        console.log("        想改产物本身 → 改 src 而非 Scripts/ (esbuild 只转译, 产物是纯生成物);");
        console.log("        src 已删 → 同步删掉 Scripts/ 下的孤儿产物。");
        console.log("  ℹ️ 手改产物不会被 npm test / lint / check:all 抓到, 只有 CI 会红 —— 本地此前零反馈。");
      }
      return 1;
    }
    const hand = [...HANDWRITTEN].filter((f) => fs.existsSync(path.join(artifactsDir, f)));
    console.log(`✅ 产物漂移检测通过: 重建 ${fs.readdirSync(rebuiltDir).filter((f) => f.endsWith(".js")).length} 个入口与 Scripts/ 逐字节一致 (豁免手工轨 ${hand.join(", ") || "无"})`);
    return 0;
  } catch (err) {
    console.log(`✗ 产物漂移检测: 重建失败 — ${err.message}`);
    if (!quiet && err.stderr) console.log(String(err.stderr).slice(0, 800));
    return 1;
  } finally {
    if (rebuiltDir) fs.rmSync(rebuiltDir, { recursive: true, force: true });
  }
}

const isEntryPoint = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  process.exit(run(ROOT, { quiet: process.argv.includes("--quiet") }));
}
