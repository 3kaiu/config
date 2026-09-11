#!/usr/bin/env node
/**
 * src/ 反模式扫描 (2026-09-11 深度审计 NEW-12)
 *
 * 背景: `src/*.ts` 是**唯一可编辑面**, 但这一层此前没有任何静态检查 ——
 *   · esbuild 只转译不校验 (字段拼错/接口不符在 build 期不报错)
 *   · 仓库刻意不引入 typescript (仅 3 个 devDependencies)
 *   · eslint 只覆盖压缩后的 `Scripts/**`, 且 src/*.ts 含真实 TS 语法
 *     (interface / type / 类型标注), 用默认 parser 无法解析
 * 代价实测: "前缀正则"这一类缺陷在 src/ 里**反复出现 4 次** —— Kugou/Youku/AlipayMini
 * 的子串匹配、Feishu 的 `\b` 词首边界、LinkedIn/Twitter 的未锚定前缀 alternation
 * (`/^(?:ad|sponsor|promot|recommend)/i` 把 `address`/`adaptive` 整项删掉)。每次都要靠
 * 人工审计发现, 说明缺一条**反向扫描**门禁。
 *
 * 本扫描把其中**可机械判定**的形态固化 (零依赖):
 *   ✗ `/^(?:ad|sponsor|promot)/`        起点锚定 + 交替组即整个模式 = 前缀匹配
 *   ✗ `/\b(ad|promot|sponsor|banner)/`  同上 (`\b` 是**词首**边界, 不是词尾)
 *   ✓ `/^(?:ad|ads|advert\w*)$/`        有 `$` 收尾 → 精确匹配
 *   ✓ 组后接后缀或量词 (如 `\w*`) → 不是裸前缀
 *
 * 注: 本注释块自身不得出现 `星号 + 斜杠` 序列 (会提前终止注释) —— 写正则示例时留意。
 *
 * 注释内的示例**不计入** (行注释 / 块注释 / 字符串) —— 修复说明里必然引用旧写法。
 *
 * 已知边界 (刻意不判, 避免误报):
 *   · `key.includes("ad")` 这类子串匹配无法与"确实想子串匹配"区分 — 需语义, 不做
 *   · 组后接量词的写法不判 — 极罕见且与"前缀+更多"难区分
 *
 * 用法: node tools/src-antipattern-check.mjs [--quiet]   (退出码 0 = 通过)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * 去掉注释 (行注释 / 块注释) 与字符串字面量内容, 保留换行以维持行号。
 * 修复说明里必然引用旧正则写法, 不剥离会把"文档"判成"缺陷"。
 * 手写状态机 (25 行) 优于正则: 需要正确处理字符串内的 `//` 与转义。
 */
export function stripCommentsAndStrings(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let state = "code";
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (state === "code") {
      if (c === "/" && c2 === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && c2 === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (c === "'" || c === '"' || c === "`") { state = c === "'" ? "sq" : c === '"' ? "dq" : "tpl"; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += "\n"; } else out += " ";
      i++; continue;
    }
    if (state === "block") {
      if (c === "*" && c2 === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " ";
      i++; continue;
    }
    // 字符串态: 内容一律抹为空格 (正则字面量不会出现在字符串里), 但保留引号与换行
    if (c === "\\") { out += "  "; i += 2; continue; }
    if ((state === "sq" && c === "'") || (state === "dq" && c === '"') || (state === "tpl" && c === "`")) {
      state = "code"; out += c; i++; continue;
    }
    out += c === "\n" ? "\n" : " ";
    i++; continue;
  }
  return out;
}

// 起点锚定 + 交替组即整个模式 (组后紧跟 `/` 或量词) → 裸前缀匹配
// 交替组要求**至少两个分支** (`(?:\|[^()|]+)+`); 单分支不是 alternation, 不属本类缺陷
// 组标记 `(?:` 用 `(?:\?:)?` 写成"可选" —— 写成 `\?:?` 会要求字面量 `?`, 从而漏掉 `(ad|b)` 形态
const BARE_PREFIX_RE = /\/(?:\^|\\b)\((?:\?:)?[^()|]+(?:\|[^()|]+)+\)(?:[+*?]|\{\d+,\d*\})?\//g;

/**
 * 找出"裸前缀 alternation"形态的正则字面量。
 * 返回 [{ line, col, literal }] (1-based 行列)。
 */
export function findBareAlternation(src) {
  const code = stripCommentsAndStrings(src);
  const hits = [];
  for (const m of code.matchAll(BARE_PREFIX_RE)) {
    const idx = m.index ?? 0;
    const before = code.slice(0, idx);
    const line = before.split("\n").length;
    const col = idx - before.lastIndexOf("\n");
    hits.push({ line, col, literal: m[0] });
  }
  return hits;
}

/**
 * 扫描一个目录下的全部 .ts (递归), 返回违规清单。
 * `base` 决定清单里 `file` 的显示基准 (默认仓库根, 即输出 `src/lib/x.ts`)。
 * 必须显式传入而不是写死 ROOT —— 否则把本工具指向仓库外的目录时
 * `path.relative(ROOT, p)` 会向上逃逸出 `../../..`, 既不可读也失去定位意义。
 */
export function scanDir(dir, base = ROOT) {
  const out = [];
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".ts")) {
        for (const h of findBareAlternation(fs.readFileSync(p, "utf8"))) {
          out.push({ file: path.relative(base, p).split(path.sep).join("/"), ...h });
        }
      }
    }
  };
  walk(dir);
  return out;
}

export function run(root = ROOT, { quiet = false } = {}) {
  const srcDir = path.join(root, "src");
  const hits = scanDir(srcDir, root);
  if (hits.length === 0) {
    console.log("✅ src/ 反模式扫描通过: 无裸前缀 alternation (前缀正则会误伤 address/adaptive 类字段)");
    return 0;
  }
  console.log(`✗ src/ 反模式扫描: ${hits.length} 处裸前缀 alternation (会匹配非预期字段):`);
  if (!quiet) {
    for (const h of hits) console.log(`  ${h.file}:${h.line}:${h.col}  ${h.literal}`);
    console.log("  修法: 改为精确匹配 (加 $ 收尾) 或分词匹配 (见 src/lib/ad.ts 的 hasKeySegment)");
  }
  return 1;
}

const isEntryPoint = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) process.exit(run(ROOT, { quiet: process.argv.includes("--quiet") }));
