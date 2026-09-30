/**
 * 密钥/凭据扫描门禁 (2026-09-30)
 *
 * 缺口: 本仓原有唯一相关检查是 `surgio-build.yml` 里针对 `Profile/Loon.lcf` 的 4 个键名
 * (`password|uuid|bob|encryption =`) —— 它只覆盖**生成产物**里的订阅凭据, 覆盖不到
 * `src/`、`tools/`、`test/`、文档与 workflow 里的 API token / 私钥 / 带凭据的 URL。
 * 而本仓的发布面是**公开 GitHub + 自建 CDN**: 一旦提交, 凭据等于立即公开, 且 GitHub
 * 的历史与 fork 都删不干净。这类事故是"提交前 3 秒能拦、提交后无法挽回"的形状,
 * 值得一个判红门禁。
 *
 * 设计取舍(误报会让人绕过门禁, 所以宁少勿滥):
 *   · 只匹配**已知形状**的真实密钥前缀(ghp_/AKIA/xox/sk-/AIza/JWT/私钥块…), 不做
 *     "高熵字符串"泛化 —— 本仓文档里满是 sha256 与域名, 泛化必然误报;
 *   · 占位符与引用不算命中: `${...}` / `${{ ... }}` / `secrets.X` / `xxx` / `<...>`;
 *   · 只扫 **git 跟踪的文件**(`git ls-files`)—— 未跟踪的本地草稿不进仓, 不打扰;
 *   · 二进制按扩展名与 NUL 字节跳过;
 *   · **本文件自身跳过**: 扫描器必然内嵌这些模式字符串, 扫自己只会自噬。
 *     跳过名单写死并在用例里断言"只有它一个", 防止后人扩大豁免面。
 *
 * 用法: `node tools/secret-scan.mjs [--quiet]` —— 命中即打印 file:line:pattern 并退出 1。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, "..");

/** 唯一豁免: 本文件(内嵌模式字符串, 扫自己必自噬) */
export const SELF_SKIP = ["tools/secret-scan.mjs"];

const BIN_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".tgz",
  ".woff", ".woff2", ".ttf", ".otf", ".mmdb", ".mp4", ".mov", ".wasm",
]);

/** 占位符/引用形态 —— 命中里含这些一律不算密钥 */
const PLACEHOLDER = /\$\{\{|\$\{|secrets\.|process\.env|env\.|xxx+|<[^>]+>|REDACTED|EXAMPLE|示例|占位/i;

export const PATTERNS = [
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: "github-pat-fine", re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g },
  { name: "aws-access-key-id", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "aws-secret-access-key", re: /aws_secret_access_key\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})/gi },
  { name: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "openai-style-key", re: /\bsk-(ant-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: "private-key-block", re: /-----BEGIN [A-Z ]{0,24}PRIVATE KEY-----/g },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  // 订阅/机场链接里的凭据参数(公开仓入库即泄露订阅)
  { name: "url-credential-param", re: /[?&](token|key|uuid|password|passwd|secret|access_key)=([A-Za-z0-9%._-]{16,})/gi },
  { name: "basic-auth-url", re: /https?:\/\/[^\s/@:]{2,}:[^\s/@]{8,}@/g },
  // Loon 订阅凭据键(与 surgio-build 的产物检查同语义, 但覆盖全部跟踪文件)
  { name: "loon-credential-key", re: /^\s*(password|uuid|bob|encryption)\s*=\s*(\S.*)$/gim },
];

/** 扫一段文本 → 命中列表(纯函数, 供用例离线驱动) */
export function scanText(text, file = "(memory)") {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (const { name, re } of PATTERNS) {
    const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    for (const m of text.matchAll(rx)) {
      const value = m[2] ?? m[1] ?? m[0];
      if (PLACEHOLDER.test(value) || PLACEHOLDER.test(m[0])) continue;
      // 命中行号: 计算 m.index 之前的分隔符数
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      hits.push({ file, line, pattern: name, excerpt: (lines[line - 1] || "").trim().slice(0, 120) });
    }
  }
  return hits;
}

/**
 * 扫描面 = 已跟踪文件 ∪ 未跟踪但**未被 .gitignore 忽略**的文件。
 * 为什么必须含未跟踪: 门禁的价值在"提交前 3 秒拦住"; 只看 `git ls-files`(已跟踪)时,
 * 刚写好、正要 `git add` 的那个文件恰好不在扫描面里 —— 正是最需要拦的时刻。
 * `--exclude-standard` 保证 .gitignore 的产物(dist/、node_modules/、mmdb)不进扫描面。
 */
function scannableFiles(root) {
  const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  return [...new Set(out.split("\0").filter(Boolean))];
}

/** 扫整个仓库(仅跟踪文件) → { hits, scanned, skipped } */
export function scanRepo(root = ROOT) {
  const hits = [];
  let scanned = 0;
  const skipped = [];
  for (const rel of scannableFiles(root)) {
    if (SELF_SKIP.includes(rel)) {
      skipped.push(rel);
      continue;
    }
    if (BIN_EXT.has(path.extname(rel).toLowerCase())) {
      skipped.push(rel);
      continue;
    }
    const abs = path.join(root, rel);
    let buf;
    try {
      buf = fs.readFileSync(abs);
    } catch {
      continue;
    }
    if (buf.includes(0)) {
      skipped.push(rel);
      continue;
    }
    scanned++;
    hits.push(...scanText(buf.toString("utf8"), rel));
  }
  return { hits, scanned, skipped };
}

function isMain() {
  const arg = process.argv[1] && path.resolve(process.argv[1]);
  return arg === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const quiet = process.argv.includes("--quiet");
  const { hits, scanned, skipped } = scanRepo();
  if (hits.length) {
    console.log(`❌ 密钥扫描: ${hits.length} 处疑似凭据 (扫了 ${scanned} 个文件 = 已跟踪 ∪ 未跟踪未忽略)`);
    for (const h of hits) console.log(`   ${h.file}:${h.line} [${h.pattern}] ${h.excerpt}`);
    console.log("   处置: 立即从工作区与 git 历史移除并轮换该凭据 —— 提交即公开, 删除历史不足以挽回。");
    process.exit(1);
  }
  if (!quiet) {
    console.log(`✅ 密钥扫描通过: ${scanned} 个文件零命中(含未跟踪未忽略) (跳过 ${skipped.length} 个二进制/豁免文件)`);
  }
}
