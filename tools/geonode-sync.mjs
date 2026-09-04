#!/usr/bin/env node
/**
 * Geonode 免费代理同步 — tools/geonode-sync.mjs
 *
 * 每日由 .github/workflows/proxy-sync.yml 运行:
 *   1. 拉取 proxylist.geonode.com 免费代理 JSON (按响应时间升序, 默认前 500)
 *   2. 过滤: 仅 Loon 原生支持的协议 (http/https/socks5)、非透明代理、非 CN、IPv4
 *   3. 探测: 候选节点并发 CONNECT 到 PROBE_URL, 仅保留返回 200 且耗时 ≤ 阈值的节点
 *   4. 排序: 按耗时升序截断到上限, 转换为 Loon 官方节点文本订阅, 写入 Profile/geonode.loon.txt
 *
 * 为何要探测 (2026-08 实测): 120 个候选节点中仅 ~7% 能真实连通, http 协议全部失败
 * (不支持 CONNECT 隧道, Loon 代理 https 站点必然不可用), socks5 可用率最高。
 * 未过滤的订阅会把大量死节点灌进 OpenCode 组, 用户每次选路都踩雷。
 *
 * 门禁 (任一失败 → exit 1, workflow 保留旧文件不推送):
 *   - HTTP 非 2xx / HTML 错误页 / JSON 解析失败 / data 缺失
 *   - 探测后节点 < 3 (上游整体失活, 写入只会覆盖一份更好的旧清单)
 *   - 生成行格式自检不过
 *
 * 环境变量 (可选):
 *   GEONODE_API_URL      上游 API URL (默认按响应时间升序取 500)
 *   GEONODE_MAX_NODES    输出节点数上限 (默认 60, 探测后按耗时升序取)
 *   GEONODE_EXCLUDE      排除国家, 逗号分隔 (默认 CN)
 *   GEONODE_PROBE_URL    探测目标 (默认 https://opencode.ai/ — 该订阅唯一服务的站点)
 *   GEONODE_PROBE_TIMEOUT 单节点探测超时秒数 (默认 8)
 *   GEONODE_PROBE_CONCURRENCY 探测并发数 (默认 15)
 *   GEONODE_PROBE_MAX_TIME 节点耗时上限秒数, 超过则丢弃 (默认 6)
 *   GEONODE_PROBE_MAX_CANDIDATES 探测候选上限 (默认 250, 避免探测耗时过长)
 *   GEONODE_PROBE_RETRIES   每个节点失败后的重试次数 (默认 1, 缓解目标站限流导致的假阴性)
 *   GEONODE_NO_PROBE=1   跳过探测, 直接按上游顺序写入 (应急用, 会写出死节点)
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "Profile", "geonode.loon.txt");

const API_URL =
  process.env.GEONODE_API_URL ||
  "https://proxylist.geonode.com/api/proxy-list?page=1&limit=500&sort_by=responseTime&sort_type=asc";
const MAX_NODES = parseInt(process.env.GEONODE_MAX_NODES || "60", 10);
const EXCLUDE_COUNTRY = new Set(
  (process.env.GEONODE_EXCLUDE || "CN").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
);

const PROBE_URL = process.env.GEONODE_PROBE_URL || "https://opencode.ai/";
const PROBE_TIMEOUT = Math.max(2, parseInt(process.env.GEONODE_PROBE_TIMEOUT || "8", 10));
const PROBE_CONCURRENCY = Math.max(1, parseInt(process.env.GEONODE_PROBE_CONCURRENCY || "15", 10));
const PROBE_MAX_TIME = parseFloat(process.env.GEONODE_PROBE_MAX_TIME || "6");
const PROBE_MAX_CANDIDATES = parseInt(process.env.GEONODE_PROBE_MAX_CANDIDATES || "250", 10);
const PROBE_RETRIES = Math.max(0, parseInt(process.env.GEONODE_PROBE_RETRIES || "1", 10));
const MIN_NODES = 3;

/** 视为"节点可用"的响应码: 2xx 成功 + 3xx 重定向 (证明 CONNECT/转发链路完整)。
 *  4xx/5xx 排除 — 部分免费代理对未知目标直接回 403, 并非真可用。 */
export const OK_STATUS = new Set([
  ...Array.from({ length: 100 }, (_, i) => 200 + i),
  301, 302, 307, 308,
]);

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
    lines.push({ proto, cc, ip, port: parseInt(port, 10) });
  }
  return lines;
}

export function nodeLine(n) {
  return `geonode-${n.proto}-${n.cc}-${n.ip}-${n.port} = ${n.proto},${n.ip},${n.port}`;
}

export function toLoonLines(nodes) {
  return nodes.slice(0, MAX_NODES).map(nodeLine);
}

/**
 * 探测单个节点: 通过该节点 CONNECT 到 PROBE_URL, 返回 { code, time } 或 null。
 * https 代理先按 HTTP 代理探测, 失败再以 TLS CONNECT (curl --proxy-insecure) 重试 —
 * 部分免费代理只在 CONNECT 时做 TLS 握手, 明文 CONNECT 会被拒。
 * 用 spawn curl 而非 node fetch: Node 原生 fetch 不支持 socks5 代理, 而 socks5 是
 * 实测唯一高可用协议 (http 代理 100% 不支持 CONNECT, 写入订阅必死)。
 */
export async function probeNode(node, target, timeoutSec, retries) {
  const tryProxy = (url, extra) =>
    new Promise((resolve) => {
      const p = spawn(
        "curl",
        ["-sS", "-m", String(timeoutSec), "-x", url, ...extra, "-A", "Mozilla/5.0",
          "-o", "/dev/null", "-w", "%{http_code} %{time_total}", target],
        { stdio: ["ignore", "pipe", "ignore"] }
      );
      let out = "";
      let settled = false;
      const settle = (v) => { if (!settled) { settled = true; resolve(v); } };
      p.stdout.on("data", (d) => { out += d; });
      p.on("error", () => settle(null));
      p.on("close", () => {
        const m = out.match(/^(\d{3})\s+([\d.]+)/);
        settle(m ? { code: Number(m[1]), time: Number(m[2]) } : null);
      });
    });

  const base = node.proto === "socks5" ? `socks5h://${node.ip}:${node.port}` : `http://${node.ip}:${node.port}`;
  // https 代理先按 HTTP 代理探测, 失败再以 TLS CONNECT (curl --proxy-insecure) 重试 —
  // 部分免费代理只在 CONNECT 时做 TLS 握手, 明文 CONNECT 会被拒。
  const attempts = [
    () => tryProxy(base, []),
    node.proto === "https" ? () => tryProxy(`https://${node.ip}:${node.port}`, ["--proxy-insecure"]) : null,
  ].filter(Boolean);

  const tryAll = () =>
    attempts[0]().then(async (r) => {
      if (r) return r;
      for (let i = 1; i < attempts.length; i++) {
        const r2 = await attempts[i]();
        if (r2) return r2;
      }
      return null;
    });

  // 重试: 免费代理抖动剧烈, 单次探测易出假阴性; 取最快的一次结果
  let best = null;
  for (let i = 0; i <= (retries || 0); i++) {
    const r = await tryAll();
    if (r && (!best || r.time < best.time)) best = r;
    if (best && r && OK_STATUS.has(best.code)) return best;
  }
  return best;
}

/** 并发探测一批节点, 按耗时升序返回通过者。 */
export async function probeNodes(nodes, target, opts) {
  const { timeoutSec, concurrency, maxTime, retries } = opts;
  const items = nodes.slice(0, PROBE_MAX_CANDIDATES);
  const results = [];
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const n = items[i++];
      const r = await probeNode(n, target, timeoutSec, retries);
      if (r && OK_STATUS.has(r.code) && r.time <= maxTime) results.push({ ...n, time: r.time });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) || 1 }, worker));
  results.sort((a, b) => a.time - b.time);
  return results;
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

  const candidates = toNodeLines(json.data);
  if (!candidates.length) throw new Error("过滤后无候选节点, 保留旧文件");

  let nodes;
  if (process.env.GEONODE_NO_PROBE === "1") {
    console.log("⚠️ 已跳过探测 (GEONODE_NO_PROBE=1), 按上游顺序写入 — 含未验证的死节点");
    nodes = candidates;
  } else {
    console.log(`🔍 探测 ${Math.min(candidates.length, PROBE_MAX_CANDIDATES)} 个候选 → ${PROBE_URL}`);
    nodes = await probeNodes(candidates, PROBE_URL, {
      timeoutSec: PROBE_TIMEOUT,
      concurrency: PROBE_CONCURRENCY,
      maxTime: PROBE_MAX_TIME,
      retries: PROBE_RETRIES,
    });
    console.log(`   通过 ${nodes.length} / ${candidates.length} (${(nodes.length / candidates.length * 100).toFixed(1)}%)`);
  }

  if (nodes.length < MIN_NODES) {
    throw new Error(`探测后仅 ${nodes.length} 个可用节点 (<${MIN_NODES}), 上游整体失活, 保留旧文件`);
  }

  const lines = toLoonLines(nodes);
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
    "# 上游: proxylist.geonode.com (每日 03:40 UTC 由 proxy-sync workflow 刷新)",
    `# 生成时间: ${new Date().toISOString()}`,
    `# 节点数: ${lines.length} (连通性已验证: ${PROBE_URL}, 耗时 ≤${PROBE_MAX_TIME}s)`,
    "",
    ...lines,
    "",
  ].join("\n");

  fs.writeFileSync(OUT, content);
  console.log(`✅ 已写入 ${path.relative(ROOT, OUT)} (${lines.length} 节点, 探测可用率 ${nodes.length}/${candidates.length})`);
}

main().catch((e) => {
  console.error(`❌ geonode-sync 失败: ${e.message}`);
  process.exit(1);
});
