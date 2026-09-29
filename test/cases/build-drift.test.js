/**
 * tools/build-drift-check.mjs 行为回归 (2026-09-29 全方位审计 P2-9)
 *
 * 背景 (变异实测的原缺陷): 手改 `Scripts/*.js` 后 `npm test` / `npm run lint` /
 * `npm run check:all` **全部 exit 0**, 而 `npm run build` 又静默覆盖改动 ——
 * 本地三条门禁对"产物被手改"零反馈, 只有 CI 的 build-drift gate 会红。
 * 本门禁用"重建到临时目录再比对"复刻 CI 语义, 且不写工作树。
 *
 * 接线: 本文件被 npm test 执行 → 满足 wiring-check 的 tools↔test 判据。
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

let mod = null;
const load = async () => (mod ??= await import("../../tools/build-drift-check.mjs"));

/** 造一个最小 root: src/ + Scripts/ (不跑 esbuild, 重建结果由夹具目录扮演) */
function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bd-root-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "Scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "lib"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "A.ts"), "export const a = 1;\n");
  fs.writeFileSync(path.join(root, "src", "env.ts"), "// inject shim\n");
  fs.writeFileSync(path.join(root, "src", "lib", "ad.ts"), "export const ad = 1;\n");
  fs.writeFileSync(path.join(root, "Scripts", "A.js"), "const a=1;\n");
  fs.writeFileSync(path.join(root, "Scripts", "Qidian.js"), "// 手工轨\n");
  return root;
}

/** 扮演 esbuild 重建结果的目录 */
function makeRebuilt(body = "const a=1;\n") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bd-rebuilt-"));
  fs.writeFileSync(path.join(dir, "A.js"), body);
  return dir;
}

const rm = (p) => fs.rmSync(p, { recursive: true, force: true });

exports.tests = {
  "build-drift: 真实仓库产物与 src 重建结果一致 → exit 0": async (a) => {
    const m = await load();
    a.equal(m.run(ROOT, { quiet: true }), 0, "干净仓库应通过 (改了 src 忘 build 或手改产物都会红)");
  },

  "build-drift: listSources 排除 env.ts 与 src/lib/* (与 build 的 find 表达式对齐)": async (a) => {
    const m = await load();
    const root = makeRoot();
    const src = m.listSources(root);
    a.equal([...src.keys()], ["A.ts"], "只应有入口 A.ts");
    a.equal(src.get("A.ts"), "A.js", "映射到 A.js");
    rm(root);
  },

  "build-drift: 产物与重建结果一致 → 三类差异全空": async (a) => {
    const m = await load();
    const root = makeRoot();
    const rebuilt = makeRebuilt("const a=1;\n");
    const r = m.compare(root, rebuilt);
    a.equal(r.mismatch, [], "无内容漂移");
    a.equal(r.missing, [], "无缺产物");
    a.equal(r.extra, [], "无孤儿产物");
    rm(root);
    rm(rebuilt);
  },

  "build-drift: 手改产物 (内容不同) → mismatch 判红": async (a) => {
    const m = await load();
    const root = makeRoot();
    const rebuilt = makeRebuilt("const a=1;\n");
    // 模拟手改: 磁盘产物 ≠ 重建结果
    fs.writeFileSync(path.join(root, "Scripts", "A.js"), "const a=1; /* 手改 */\n");
    const r = m.compare(root, rebuilt);
    a.equal(r.mismatch.map((x) => x.name), ["A.js"], "A.js 应报内容漂移");
    a.equal(r.extra, [], "孤儿列表不应误报");
    rm(root);
    rm(rebuilt);
  },

  "build-drift: 改了 src 忘 build (磁盘缺产物) → missing 判红": async (a) => {
    const m = await load();
    const root = makeRoot();
    const rebuilt = makeRebuilt();
    fs.rmSync(path.join(root, "Scripts", "A.js"));
    const r = m.compare(root, rebuilt);
    a.equal(r.missing.map((x) => x.name), ["A.js"], "缺产物应报 missing");
    rm(root);
    rm(rebuilt);
  },

  "build-drift: src 已删但产物残留 → extra 判红": async (a) => {
    const m = await load();
    const root = makeRoot();
    const rebuilt = makeRebuilt();
    fs.writeFileSync(path.join(root, "src", "B.ts"), "export const b = 1;\n");
    fs.writeFileSync(path.join(root, "Scripts", "B.js"), "const b=1;\n");
    fs.rmSync(path.join(root, "src", "B.ts")); // src 撤了, 产物没删
    const r = m.compare(root, rebuilt);
    a.equal(r.extra.map((x) => x.name), ["B.js"], "B.js 应报孤儿产物");
    rm(root);
    rm(rebuilt);
  },

  "build-drift: Qidian.js 手工轨豁免 — 无 src 也不算孤儿": async (a) => {
    const m = await load();
    const root = makeRoot();
    const rebuilt = makeRebuilt();
    const r = m.compare(root, rebuilt);
    a.equal(
      r.extra.some((x) => x.name === "Qidian.js"),
      false,
      "Qidian.js 是 AGENTS 明文的无源码手工轨, 不得判为孤儿"
    );
    a.equal(m.HANDWRITTEN.has("Qidian.js"), true, "HANDWRITTEN 登记 Qidian.js");
    rm(root);
    rm(rebuilt);
  },

  "build-drift: 手工轨内部变更不被比对覆盖 (不参与 mismatch)": async (a) => {
    const m = await load();
    const root = makeRoot();
    const rebuilt = makeRebuilt("const a=1;\n");
    // 手工轨改了内容 — 因无 src 入口, compare 不比对它
    fs.writeFileSync(path.join(root, "Scripts", "Qidian.js"), "// 手工轨改了\n");
    const r = m.compare(root, rebuilt);
    a.equal(r.mismatch.some((x) => x.name === "Qidian.js"), false, "手工轨不参与内容比对");
    a.equal(r.extra.some((x) => x.name === "Qidian.js"), false, "手工轨不判孤儿");
    rm(root);
    rm(rebuilt);
  },

  "build-drift: rebuild 拒绝缺 --outdir=Scripts 的 build 脚本": async (a) => {
    const m = await load();
    const root = makeRoot();
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { build: "esbuild src/*.ts" } }));
    let threw = false;
    try {
      m.rebuild(root);
    } catch (e) {
      threw = true;
      a.ok(String(e.message).includes("--outdir=Scripts"), `应提示无法重定向, 实际: ${e.message}`);
    }
    a.equal(threw, true, "缺标记必须抛错 (静默退回会变成永远比对空目录)");
    rm(root);
  },
};
