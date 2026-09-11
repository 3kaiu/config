/**
 * tools/src-antipattern-check.mjs 行为回归 (2026-09-11 深度审计 NEW-12)
 *
 * 背景: `src/*.ts` 是唯一可编辑面, 却不受任何静态检查 (esbuild 只转译 / 无 typescript /
 * eslint 只覆盖压缩产物)。"前缀正则"这一类缺陷在 src/ 里反复出现 4 次, 每次靠人工审计发现。
 * 本工具是该类缺陷的**反向扫描门禁**, 故其"判得准"比"判得多"重要 ——
 * 漏判会让缺陷回流, 误判会让开发者把门禁关掉。
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");

let mod = null;
const load = async () => (mod ??= await import("../../tools/src-antipattern-check.mjs"));

exports.tests = {
  // ── 判定准确性 ──
  "src-antipattern: 裸前缀 alternation 被判出 (两种起点锚定)": async (a) => {
    const m = await load();
    // 这两个字符串就是 NEW-06 修复前的真实写法
    const bad = [
      "/^(?:ad|sponsor|promot|recommend)/i",
      "/\\b(ad|promot|sponsor|banner)/i",
      "/^(?:ad|ads|advert\\w*)/",
      "/^(?:ad|sponsor)+/",
    ];
    for (const s of bad) {
      const hits = m.findBareAlternation(s);
      a.ok(hits.length > 0, `${s} 应被判出`);
      a.equal(hits[0].line, 1, `${s} 行号`);
    }
  },

  "src-antipattern: 已锚定 / 非 alternation / 组后有约束 的写法不误判": async (a) => {
    const m = await load();
    const good = [
      "/^(?:ad|ads|advert\\w*|promot\\w*|sponsor\\w*|banner\\w*|recommend\\w*)$/", // 修复后的 Feishu 写法
      "/^(?:ad|sponsor)\\w*/", // 组后有后缀
      "/^(?:https?|ftp):\\/\\//", // 协议检测
      "/^(?:ad)/", // 单分支不是 alternation
      "/ad|sponsor/", // 无起点锚定
      "/^(ad|sponsor)$/", // 捕获组 + $ 收尾
    ];
    for (const s of good) a.equal(m.findBareAlternation(s).length, 0, `${s} 不应判出`);
  },

  "src-antipattern: 注释与字符串内的示例不计入 (修复说明必然引用旧写法)": async (a) => {
    const m = await load();
    const cases = [
      "// 旧写法 /^(?:ad|sponsor)/i 已修复",
      "/* 说明: /^(?:ad|sponsor)/i */",
      'const s = "/^(?:ad|sponsor)/";',
      "const t = `x /^(?:ad|sponsor)/ y`;",
      "/**\n * 旧: /^(?:ad|sponsor)/i\n */\nconst x = 1;",
    ];
    for (const s of cases) a.equal(m.findBareAlternation(s).length, 0, `${JSON.stringify(s)} 不应判出`);
    // 反向: 注释剥离后仍要能看见真实代码
    const mixed = "/* /^(?:a|b)/ */\nconst re = /^(?:ad|sponsor)/i;";
    a.equal(m.findBareAlternation(mixed).length, 1, "注释外的真实写法应被判出");
    a.equal(m.findBareAlternation(mixed)[0].line, 2, "行号应指向代码行");
  },

  "src-antipattern: stripCommentsAndStrings 保留换行 (行号不漂移)": async (a) => {
    const m = await load();
    const src = "a\n// comment\nb\n/* multi\nline */\nc";
    const out = m.stripCommentsAndStrings(src);
    a.equal(out.split("\n").length, src.split("\n").length, "行数应一致");
    a.equal(out.includes("comment"), false, "行注释内容应被抹除");
    a.equal(out.includes("multi"), false, "块注释内容应被抹除");
  },

  // ── 真实仓库 ──
  "src-antipattern: 真实 src/ 零违规 (NEW-06 修复后应为空)": async (a) => {
    const m = await load();
    const hits = m.scanDir(path.join(ROOT, "src"));
    a.equal(hits, [], "src/ 不得存在裸前缀 alternation");
  },

  "src-antipattern: run(ROOT) === 0 (可作门禁)": async (a) => {
    const m = await load();
    a.equal(m.run(ROOT, { quiet: true }), 0, "仓库应通过");
  },

  "src-antipattern: 植入违规后 run() 判红 (门禁真的会拦)": async (a) => {
    const m = await load();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "srcap-"));
    fs.mkdirSync(path.join(tmp, "src", "lib"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src", "lib", "bad.ts"), "export function f(k){ return /^(?:ad|sponsor)/i.test(k); }\n");
    // 显式传 base: 指向仓库外目录时, 路径须相对该目录而不是相对本仓库 (否则会向上逃逸)
    const hits = m.scanDir(path.join(tmp, "src"), tmp);
    a.equal(hits.length, 1, "应判出 1 处");
    a.equal(hits[0].file, "src/lib/bad.ts", "文件路径应为扫描根相对路径");
    a.equal(m.run(tmp, { quiet: true }), 1, "run 应返回 1");
    fs.rmSync(tmp, { recursive: true, force: true });
  },

  "src-antipattern: run() 在仓库外根上不产生逃逸路径": async (a) => {
    const m = await load();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "srcap-"));
    fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src", "bad.ts"), "export const r = /^(?:ad|promo)/;\n");
    const hits = m.scanDir(path.join(tmp, "src"), tmp);
    a.equal(hits.length, 1, "应判出 1 处");
    a.equal(hits[0].file.includes(".."), false, `路径不得含 "..": ${hits[0].file}`);
    a.equal(hits[0].file, "src/bad.ts", "应为扫描根相对路径");
    fs.rmSync(tmp, { recursive: true, force: true });
  },

  // ── 入口守卫 ──
  "src-antipattern: import 不触发 main (入口守卫生效)": async (a) => {
    const out = execFileSync(
      process.execPath,
      ["-e", 'import("./tools/src-antipattern-check.mjs").then(() => console.log("IMPORT_OK"));'],
      { cwd: ROOT, encoding: "utf8", timeout: 20000 }
    );
    a.equal(out.trim(), "IMPORT_OK", "import 应只输出 IMPORT_OK");
  },
};
