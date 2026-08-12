#!/usr/bin/env node
/**
 * MitM 孤儿域校验 — 每个正包含 MitM hostname 必须被至少一条 rewrite/script 规则消费。
 * 无规则消费 = 纯解密无收益, 扩大证书暴露面 (最小范围原则)。
 *
 * 判定: 方法 A (样本 URL 正则匹配) 或 方法 B (根域对齐) 任一命中即非孤儿。
 * 注意: 规则消费可能藏在 bundle 脚本 (iRingo/DualSubs/BiliUniverse) 或黑盒引擎 (Qidian),
 *       孤儿列表需人工复核后再收窄。
 *
 * 用法:
 *   node tools/mitm-orphan-check.mjs          全量 (含镜像上游, 报告式)
 *   node tools/mitm-orphan-check.mjs --local  仅本地 Plugin/Kelee/主配置 (CI 严格模式)
 * 退出码: 0 = 无孤儿; 1 = 存在孤儿
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MAIN_CFG = path.join(ROOT, "Profile/Loon.lcf");
const LOCAL_ONLY = process.argv.includes("--local");

// 豁免: 已被 bundle 脚本/黑盒引擎消费, 但校验器无法静态解析的 hostname (须人工维护)
const EXEMPT = new Set([
  "api-access.pangolin-sdk-toutiao1.com", // Qidian 黑盒引擎 (规则用 \d 数字通配, 校验器占位缺陷)
  "splash.*", // startup-adblock 通配 hostname (覆盖任意 App 开屏域, 规则拦具体接口)
  "ad.*",
  "flash.*",
  "gspe35-ssl.ls.apple.cn", // iRingo 消费 (bundle)
  "*.smoot.apple.cn", // iRingo.Search 消费 (bundle)
]);

function walk(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(plugin|conf)$/.test(ent.name)) acc.push(p);
  }
}

function readFiles() {
  const files = [];
  if (LOCAL_ONLY) {
    for (const d of ["Plugin", "Kelee"]) walk(path.join(ROOT, d), files);
  } else {
    for (const d of ["Plugin", "Kelee", "Mirror"]) walk(path.join(ROOT, d), files);
  }
  if (fs.existsSync(MAIN_CFG)) files.push(MAIN_CFG);
  // QX 专用端 (qx-*.conf / qx-* 子目录) 不参与 Loon MitM 语义
  return files.filter((f) => {
    const base = path.basename(f);
    return !base.startsWith("qx-");
  });
}

function fullFiles() {
  const files = [];
  for (const d of ["Plugin", "Kelee", "Mirror"]) walk(path.join(ROOT, d), files);
  if (fs.existsSync(MAIN_CFG)) files.push(MAIN_CFG);
  return files.filter((f) => !path.basename(f).startsWith("qx-"));
}

function collectHostnames(files) {
  const map = new Map();
  for (const f of files) {
    const txt = fs.readFileSync(f, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^hostname\s*=\s*(.*)$/);
      if (!m) continue;
      const body = m[1].replace(/^%APPEND%\s*,?\s*/, "").trim();
      for (const item of body.split(",")) {
        const h = item.trim();
        if (!h || h.startsWith("-") || h.startsWith("%")) continue;
        if (!map.has(h)) map.set(h, new Set());
        map.get(h).add(f);
      }
    }
  }
  return map;
}

function collectPatterns(files) {
  const patterns = [];
  for (const f of files) {
    const txt = fs.readFileSync(f, "utf8");
    for (const line of txt.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || t.startsWith("!") || t.startsWith(";")) continue;
      const m = t.match(/^(?:http-request|http-response|request|response|script)\s+(\^[^ ,]+)/);
      if (m) { patterns.push(m[1]); continue; }
      const m2 = t.match(/^(url\s+)?(\^[^ ,]+)/);
      if (m2 && (t.startsWith("^") || t.startsWith("url ^"))) patterns.push(m2[2]);
    }
  }
  return patterns;
}

function sampleUrl(base) {
  return [
    `https://${base}/`,
    `https://${base}/x`,
    `https://${base}/?q=1`,
    `http://${base}/x/y?z=2`,
    `https://${base}`,
  ];
}

/**
 * 域名骨架: 从规则正则中提取全部"域名形态"片段 (含分组交替的各个分支)。
 * "(adsmind\\.gdtimg\\.com|adsmind\\.ugdtimg\\.com|pgdt\\.gtimg\\.cn)" → ["adsmind.gdtimg.com","adsmind.ugdtimg.com","pgdt.gtimg.cn"]
 */
const DOMAIN_RE = /[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+/g;
const SUB_TLDS = new Set([
  "com.cn", "org.cn", "net.cn", "gov.cn", "edu.cn", "com.hk", "co.uk", "org.uk",
  "co.jp", "ne.jp", "com.tw", "co.kr", "com.au", "com.br", "com.mx", "co.in",
  "com.tr", "com.sg", "com.my", "com.vn", "com.ph", "co.id", "co.th",
]);

function rootOf(domain) {
  const p = domain.split(".");
  if (p.length >= 3 && SUB_TLDS.has(p.slice(-2).join("."))) return p.slice(-3).join(".");
  return p.slice(-2).join(".");
}

function skeletons(pattern) {
  let s = pattern
    .replace(/\\\./g, ".")
    .replace(/\\\//g, "/")
    .replace(/\\\?/g, "?")
    .replace(/\\\+/g, "+")
    .replace(/\\\*/g, "*")
    .replace(/\\-/g, "-")
    .replace(/\\d/g, "d");
  const out = new Set();
  const m = s.match(DOMAIN_RE);
  if (m) for (const d of m) out.add(d);
  return out;
}

function main() {
  const localFiles = readFiles(); // 本地模式: Plugin/Kelee+主配置; 全量: 含 Mirror
  const hostnames = collectHostnames(localFiles);
  // 规则消费池始终含 Mirror 上游 (bundle 插件的 script-path 也是消费方), 减少误报
  const patternFiles = LOCAL_ONLY
    ? localFiles.concat(fullFiles())
    : localFiles;
  const patterns = collectPatterns(patternFiles);

  const regexes = [];
  const rootSet = new Set();
  for (const p of patterns) {
    try { regexes.push(new RegExp(p, "i")); } catch { /* 忽略非法正则 */ }
    for (const sk of skeletons(p)) rootSet.add(rootOf(sk.toLowerCase()));
  }

  const orphans = [];
  let total = 0;
  for (const [host, sources] of hostnames) {
    if (EXEMPT.has(host)) { total++; continue; }
    total++;
    let consumed = false;
    // 方法 A: 样本 URL 正则匹配 (覆盖接口级规则的关键路径样本)
    const base = host.includes("*") ? host.replace(/\*/g, "sub") : host;
    const apiSamples = sampleUrl(base).concat([
      `https://${base}/api/`,
      `https://${base}/v1/`,
      `https://${base}/client.action`,
      `https://${base}/?functionId=`,
    ]);
    for (const r of regexes) {
      if (apiSamples.some((s) => r.test(s))) { consumed = true; break; }
    }
    // 方法 B: 域名骨架包含判定 — hostname 的任一副域名若出现在规则骨架中 (含规则骨架为 hostname 子域的情况), 视为被消费
    // 方法 B: 根域对齐 — hostname 与规则共享注册根域 (后 2 段, 或后 3 段对 com.cn 等二级 TLD), 视为被消费。
    // 覆盖 "hostname 写宽 (根域/通配)、规则拦具体子域接口" 的上游通用设计, 最小化误报。
    if (!consumed) {
      const hostRoot = rootOf(host.replace(/\*/g, "").toLowerCase());
      if (rootSet.has(hostRoot)) consumed = true;
    }
    if (!consumed) {
      orphans.push({ host, sources: [...sources] });
    }
  }

  if (orphans.length === 0) {
    console.log(`✅ MitM 孤儿域校验通过: ${total} 个正包含 hostname 全部有规则消费`);
    return 0;
  }
  console.log(`✗ ${orphans.length}/${total} 个 MitM hostname 无任何规则消费 (孤儿, 纯解密):`);
  console.log("  注: 规则消费可能藏于 bundle 脚本 (iRingo/DualSubs/BiliUniverse) 或黑盒引擎 (Qidian), 请人工复核后再收窄。");
  for (const o of orphans) {
    console.log(`  - ${o.host}  (来自: ${o.sources.join(", ")})`);
  }
  // 本地模式严格阻断; 全量模式 (含镜像上游整包) 仅报告
  return LOCAL_ONLY ? 1 : 0;
}

process.exit(main());
