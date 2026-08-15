#!/usr/bin/env node
/**
 * GitHub 开放代理同步 — tools/edu-proxy-sync.mjs
 *
 * 每日由 .github/workflows/proxy-sync.yml 运行:
 *   1. 拉取 GitHub 社区免费代理列表 (ip:port 明文, 自动维护)
 *   2. 过滤: 仅 Loon 原生支持的协议 (http/socks5)、ip:port 格式合法、去重
 *   3. 转换为 Loon 官方节点文本订阅, 写入 Profile/edu-proxy.loon.txt
 *
 * 主源: iplocate/free-proxy-list (每 30 分钟更新, Verified);
 * 主源: hproxy-com/free-proxy-list (all.json 结构化: protocols/uptime, 按可用率排序);
 * 备用: TheSpeedX/PROXY-List + roosterkid/openproxylist。
 * 说明: 这些列表是公网开放代理聚合 (README 的 "Educational purpose" 仅为
 * 免责声明), 非大学 .edu 网段; 免费代理可用性与安全性无保证, 仅作手动
 * 选择兜底, 不进入主容灾池 (MainNodes 已排除 edu-* 节点)。
 *
 * 门禁 (全部源失败 / 合并后节点 < 10 / 行格式自检不过 → exit 1, workflow 保留旧文件):
 *   - 单个源失败不阻断 (跳过该源, 需至少一个源成功)
 *
 * 环境变量 (可选):
 *   EDU_MAX_NODES     输出节点数上限 (默认 120)
 *   EDU_SOURCES       源列表 JSON: [{"url": "...", "proto": "http"|"socks5"}]
 *                     或 {"url": "...", "json": true} 结构化源 (元素含 ip/port/protocols)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "Profile", "edu-proxy.loon.txt");

const MAX_NODES = parseInt(process.env.EDU_MAX_NODES || "120", 10);
const DEFAULT_SOURCES = [
  {
    url: "https://raw.githubusercontent.com/hproxy-com/free-proxy-list/main/all.json",
    json: true,
    sort: (a, b) => (b.uptime_pct || 0) - (a.uptime_pct || 0),
  },
  { url: "https://raw.githubusercontent.com/iplocate/free-proxy-list/main/protocols/http.txt", proto: "http" },
  { url: "https://raw.githubusercontent.com/iplocate/free-proxy-list/main/protocols/socks5.txt", proto: "socks5" },
  { url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt", proto: "http" },
  { url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt", proto: "socks5" },
  { url: "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt", proto: "http" },
];
const SOURCES = process.env.EDU_SOURCES ? JSON.parse(process.env.EDU_SOURCES) : DEFAULT_SOURCES;

const ENTRY_RE = /^(\d{1,3}(\.\d{1,3}){3}):(\d{2,5})$/;
const NODE_LINE_RE = /^[\w.-]+ = (http|socks5),\d{1,3}(\.\d{1,3}){3},\d{2,5}$/;

export function toNodeLines(entries) {
  const seen = new Set();
  const lines = [];
  for (const e of entries) {
    const ip = String(e.ip || "");
    const port = String(e.port || "");
    if (seen.has(`${ip}:${port}`)) continue;
    seen.add(`${ip}:${port}`);
    lines.push(`edu-${e.proto}-${ip}-${port} = ${e.proto},${ip},${port}`);
    if (lines.length >= MAX_NODES) break;
  }
  return lines;
}

async function fetchSource(src) {
  const res = await fetch(src.url, {
    headers: { "User-Agent": "3kaiu-config/edu-proxy-sync" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (/<!doctype|<html/i.test(text.slice(0, 200))) throw new Error("HTML 错误页");
  const entries = [];
  if (src.json) {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      throw new Error("JSON 解析失败");
    }
    if (!Array.isArray(obj)) throw new Error("JSON 非数组");
    const items = src.sort ? [...obj].sort(src.sort) : obj;
    for (const e of items) {
      const p = Array.isArray(e?.protocols) ? e.protocols : [];
      const proto = p.includes("socks5") ? "socks5" : p.some((x) => x === "http" || x === "https") ? "http" : null;
      if (!proto || !ENTRY_RE.test(`${e.ip}:${e.port}`)) continue;
      entries.push({ ip: String(e.ip), port: String(e.port), proto });
    }
  } else {
    for (const line of text.split("\n")) {
      const m = line.trim().match(ENTRY_RE);
      if (!m) continue;
      entries.push({ ip: m[1], port: m[3], proto: src.proto });
    }
  }
  if (entries.length < 10) throw new Error(`仅解析出 ${entries.length} 条`);
  console.log(`✅ ${src.json ? "json" : src.proto} ${src.url} → ${entries.length} 条`);
  return entries;
}

async function main() {
  const results = [];
  let ok = 0;
  for (const s of SOURCES) {
    try {
      results.push(...(await fetchSource(s)));
      ok++;
    } catch (e) {
      console.warn(`⚠️ 源失败 (${s.url}): ${e.message}`);
    }
  }
  if (ok === 0) throw new Error("全部源拉取失败");
  if (results.length < 10) throw new Error(`合并后仅 ${results.length} 条 (<10)`);

  const lines = toNodeLines(results);
  if (lines.length < 10) throw new Error(`过滤后仅 ${lines.length} 节点 (<10)`);
  for (const l of lines) {
    if (!NODE_LINE_RE.test(l)) throw new Error(`生成行格式异常: ${l}`);
  }

  // 幂等: 节点集无变化则不重写 (头部含生成时间, 避免每日无意义提交)
  const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  const existingNodes = existing.split("\n").filter((l) => NODE_LINE_RE.test(l));
  if (existingNodes.join("\n") === lines.join("\n")) {
    console.log(`ℹ️ 节点集无变化, 跳过写入 (${path.relative(ROOT, OUT)})`);
    return;
  }

  const content = [
    "# GitHub 开放代理订阅 — 由 tools/edu-proxy-sync.mjs 生成, 勿手改",
    "# 上游: iplocate/free-proxy-list (主) + hproxy-com (json) + TheSpeedX + roosterkid",
    `# 生成时间: ${new Date().toISOString()}`,
    `# 节点数: ${lines.length} (协议 http/socks5)`,
    "",
    ...lines,
    "",
  ].join("\n");

  fs.writeFileSync(OUT, content);
  console.log(`✅ 已写入 ${path.relative(ROOT, OUT)} (${lines.length} 节点)`);
}

main().catch((e) => {
  console.error(`❌ edu-proxy-sync 失败: ${e.message}`);
  process.exit(1);
});