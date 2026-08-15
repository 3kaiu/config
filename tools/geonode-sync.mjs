#!/usr/bin/env node
/**
 * Geonode 免费代理同步 — tools/geonode-sync.mjs
 *
 * 每日由 .github/workflows/geonode-sync.yml 运行:
 *   1. 拉取 proxylist.geonode.com 免费代理 JSON (按响应时间升序, 默认前 500)
 *   2. 过滤: 仅 Loon 原生支持的协议 (http/https/socks5)、非透明代理、非 CN、IPv4
 *   3. 转换为 Loon 官方节点文本订阅, 写入 Profile/geonode.loon.txt
 *
 * 门禁 (任一失败 → exit 1, workflow 保留旧文件不推送):
 *   - HTTP 非 2xx / HTML 错误页 / JSON 解析失败 / data 缺失
 *   - 过滤后节点 < 10 / 生成行格式自检不过
 *
 * 环境变量 (可选):
 *   GEONODE_API_URL      上游 API URL (默认按响应时间升序取 500)
 *   GEONODE_MAX_NODES    输出节点数上限 (默认 120)
 *   GEONODE_EXCLUDE      排除国家, 逗号分隔 (默认 CN)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "Profile", "geonode.loon.txt");

const API_URL =
  process.env.GEONODE_API_URL ||
  "https://proxylist.geonode.com/api/proxy-list?page=1&limit=500&sort_by=responseTime&sort_type=asc";
const MAX_NODES = parseInt(process.env.GEONODE_MAX_NODES || "120", 10);
const EXCLUDE_COUNTRY = new Set(
  (process.env.GEONODE_EXCLUDE || "CN").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
);

// Loon 原生支持的节点协议优先级 (geonode protocols 数组取首个可映射项)
const PROTO_PRIORITY = ["http", "https", "socks5"];
const NODE_LINE_RE = /^[\w.-]+ = (http|https|socks5),\d{1,3}(\.\d{1,3}){3},\d{2,5}$/;

export function toNodeLines(entries) {
  const seen = new Set();
  const lines = [];
  for (const e of entries || []) {
    if (typeof e !== "object" || e === null) continue;
    if (e.anonymityLevel === "transparent") continue;
    const cc = String(e.country || "XX").toUpperCase();
    if (EXCLUDE_COUNTRY.has(cc)) continue;
    const ip = String(e.ip || "");
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) continue;
    const port = String(e.port || "");
    if (!/^\d{2,5}$/.test(port)) continue;
    const key = `${ip}:${port}`;
    if (seen.has(key)) continue;
    const proto = (Array.isArray(e.protocols) ? e.protocols : []).find((p) => PROTO_PRIORITY.includes(p));
    if (!proto) continue;
    seen.add(key);
    lines.push(`geonode-${proto}-${cc}-${ip}-${port} = ${proto},${ip},${port}`);
    if (lines.length >= MAX_NODES) break;
  }
  return lines;
}

async function main() {
  const res = await fetch(API_URL, {
    headers: { "User-Agent": "3kaiu-config/geonode-sync" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`上游 HTTP ${res.status}`);
  const text = await res.text();
  if (/<!doctype|<html/i.test(text.slice(0, 200))) throw new Error("上游返回 HTML 错误页");
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e.message}`);
  }
  if (!Array.isArray(json.data)) throw new Error("响应缺少 data 数组");

  const lines = toNodeLines(json.data);
  if (lines.length < 10) throw new Error(`过滤后仅 ${lines.length} 个节点 (<10), 保留旧文件`);
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
    "# Geonode 免费代理订阅 — 由 tools/geonode-sync.mjs 生成, 勿手改",
    "# 上游: proxylist.geonode.com (每日 03:40 UTC 由 geonode-sync workflow 刷新)",
    `# 生成时间: ${new Date().toISOString()}`,
    `# 节点数: ${lines.length} (协议 http/https/socks5, 非透明, 非 CN)`,
    "",
    ...lines,
    "",
  ].join("\n");

  fs.writeFileSync(OUT, content);
  console.log(`✅ 已写入 ${path.relative(ROOT, OUT)} (${lines.length} 节点)`);
}

main().catch((e) => {
  console.error(`❌ geonode-sync 失败: ${e.message}`);
  process.exit(1);
});