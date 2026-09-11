#!/usr/bin/env node
/**
 * 规则顺序遮蔽检查 (2026-09-11 深度审计 NEW-05 新增)
 *
 * 取代 mirror-scripts.yml 里原先那段**硬编码 20 个关键词的 grep**。旧门禁有两个
 * 独立缺陷: (1) 只查"Global 里有没有广告域", 方向反了 —— 真正会静默失效的是
 * 反方向; (2) 关键词表写死, 上游新增的遮蔽组合天然漏检。
 *
 * 背景: [Remote Rule] 的列表**按序线性求值, 先命中即终止**。Global 是 Proxy 列表
 * 且排在 Advertising / Privacy / Hijacking 三个 REJECT 列表**之前**, 而 Global 的
 * `DOMAIN-KEYWORD` 是宽匹配 —— 只要某个 REJECT 条目的模式里含 Global 的任一关键词,
 * 该条目就永远轮不到, 广告拦截静默失效 (实测唯一实例: google → googleads)。
 *
 * 两项检查:
 *   1. [硬门禁] 对每一对 (靠前的 Proxy 列表, 靠后的 REJECT 列表) 求实际集合交集。
 *      被遮蔽的 REJECT 条目必须能在 template/loon.tpl 的 [Rule] 段 (含 include 的
 *      snippet) 找到一条本地 REJECT 兜底, 否则判红。
 *   2. [告警] 对比镜像列表**文件头声明的计数**与正文实测计数。上游 blackmatrix7 的
 *      Loon 格式列表头描述的是其**完整规则集**, 与 Loon 文件正文并不一致
 *      (实测 Global: 头称 DOMAIN-SUFFIX 34743, 正文 0 条) —— 模板注释曾据此写下
 *      "34,579 SUFFIX" 的错误性能理由 (NEW-04)。该头**不可用作计数来源**。
 *      只告警不判红: 上游元数据不在本仓库控制范围, 判红会让每日镜像无谓刷红。
 *
 * 用法: node tools/rule-shadow-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TPL = path.join(ROOT, "template", "loon.tpl");

/** 取模板中某个 `[Section]` 段的正文行 (到下一个 `[` 段头为止) */
export function sectionLines(tplText, section) {
  const lines = tplText.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `[${section}]`);
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

/** 展开 `{% include "./snippet/x.tpl" %}` (仅一层, 本仓库 snippet 不嵌套) */
export function expandIncludes(lines, tplDir) {
  const out = [];
  for (const l of lines) {
    const m = l.match(/\{%\s*include\s+"([^"]+)"\s*%\}/);
    if (!m) { out.push(l); continue; }
    const p = path.resolve(tplDir, m[1]);
    if (fs.existsSync(p)) out.push(...fs.readFileSync(p, "utf8").split(/\r?\n/));
  }
  return out;
}

/** 解析本地规则行 → [{type, pattern, policy}] (跳过注释/空行/宏行) */
export function parseRuleLines(lines) {
  const rules = [];
  for (const raw of lines) {
    const s = raw.trim();
    if (!s || s.startsWith("#") || s.startsWith("{%")) continue;
    const m = s.match(/^([A-Z][A-Z0-9-]*)\s*,\s*([^,]+?)\s*(?:,\s*([A-Za-z-]+))?$/);
    if (!m) continue;
    rules.push({ type: m[1].toUpperCase(), pattern: m[2].trim(), policy: (m[3] || "").trim() });
  }
  return rules;
}

/** 解析 [Remote Rule] 的引用行 → [{name, url, policy, tag}] 保持文件顺序 */
export function parseRemoteRules(lines) {
  const out = [];
  for (const raw of lines) {
    const s = raw.trim();
    if (!s || s.startsWith("#")) continue;
    const url = (s.match(/https?:\/\/\S+?\.list/) || [])[0];
    if (!url) continue;
    const policy = (s.match(/policy\s*=\s*([^,\s]+)/) || [])[1] || "";
    const tag = (s.match(/tag\s*=\s*([^,]+)/) || [])[1] || "";
    // loon-Global.list → Global
    const name = (path.basename(url).match(/^loon-(.+)\.list$/) || [])[1] || path.basename(url);
    out.push({ name, url, policy, tag: tag.trim() });
  }
  return out;
}

/** 解析镜像列表: 正文规则 + 文件头声明计数 */
export function parseListFile(text) {
  const rules = [];
  const declared = {};
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s) continue;
    if (s.startsWith("#")) {
      const m = s.match(/^#\s*([A-Z][A-Z0-9-]*)\s*:\s*(\d[\d,]*)\s*$/);
      if (m) declared[m[1].toUpperCase()] = Number(m[2].replace(/,/g, ""));
      continue;
    }
    const m = s.match(/^([A-Z][A-Z0-9-]*)\s*,\s*([^,]+)/);
    if (m) rules.push({ type: m[1].toUpperCase(), pattern: m[2].trim() });
  }
  return { rules, declared };
}

/**
 * 求遮蔽: 对每一对 (靠前 Proxy 列表, 靠后 REJECT 列表), 找出后者中被前者
 * DOMAIN-KEYWORD 抢先命中的条目。
 * 判定 = 靠前关键词是该 REJECT 条目模式的**子串** (域名含该关键词即会被抢先命中)。
 */
export function findShadowed(orderedLists) {
  const shadowed = [];
  for (let i = 0; i < orderedLists.length; i++) {
    const a = orderedLists[i];
    if (!/proxy/i.test(a.policy)) continue; // 只有 Proxy 类列表才会"抢走"后续 REJECT
    const kws = a.rules.filter((r) => r.type === "DOMAIN-KEYWORD").map((r) => r.pattern.toLowerCase());
    if (!kws.length) continue;
    for (let j = i + 1; j < orderedLists.length; j++) {
      const b = orderedLists[j];
      if (!/reject/i.test(b.policy)) continue;
      for (const e of b.rules) {
        if (!["DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD"].includes(e.type)) continue;
        const p = e.pattern.toLowerCase();
        const hit = kws.filter((k) => p.includes(k));
        if (hit.length) {
          shadowed.push({ from: a.name, fromPolicy: a.policy, to: b.name, toPolicy: b.policy, keyword: hit, entry: e });
        }
      }
    }
  }
  return shadowed;
}

/** 该被遮蔽条目是否已被本地 [Rule] 段的 REJECT 兜住 (同类型精确匹配, 或更宽的 KEYWORD 包含) */
export function isCompensated(entry, localRules) {
  const p = entry.pattern.toLowerCase();
  return localRules.some((r) => {
    if (!/reject/i.test(r.policy)) return false;
    const q = r.pattern.toLowerCase();
    if (r.type === entry.type && q === p) return true;               // 同类型精确
    if (r.type === "DOMAIN-KEYWORD" && p.includes(q)) return true;   // 更宽的 KEYWORD 覆盖
    if (r.type === "DOMAIN-SUFFIX" && p === q) return true;
    return false;
  });
}

export function run(root = ROOT) {
  const tplPath = path.join(root, "template", "loon.tpl");
  const tplText = fs.readFileSync(tplPath, "utf8");
  const tplDir = path.dirname(tplPath);

  const localRules = parseRuleLines(expandIncludes(sectionLines(tplText, "Rule"), tplDir));
  const remote = parseRemoteRules(sectionLines(tplText, "Remote Rule"));

  const orderedLists = [];
  for (const r of remote) {
    const p = path.join(root, "Mirror", "rules", `loon-${r.name}.list`);
    if (!fs.existsSync(p)) continue;
    const { rules, declared } = parseListFile(fs.readFileSync(p, "utf8"));
    orderedLists.push({ ...r, rules, declared });
  }

  const problems = [];
  const warnings = [];

  // ── 1. 硬门禁: 遮蔽面必须被本地规则兜住 ──
  console.log("## 规则顺序遮蔽检查 (Proxy 列表抢先命中 REJECT 条目)\n");
  console.log(`顺序: ${orderedLists.map((l) => `${l.name}(${l.policy})`).join(" → ")}\n`);
  const shadowed = findShadowed(orderedLists);
  if (!shadowed.length) {
    console.log("✅ 无遮蔽: 靠前的 Proxy 列表关键词未抢先命中任何 REJECT 条目");
  } else {
    for (const s of shadowed) {
      const ok = isCompensated(s.entry, localRules);
      const line = `${s.from}(${s.fromPolicy}) 关键词 ${s.keyword.join(",")} 抢先命中 ${s.to}(${s.toPolicy}) 的 ${s.entry.type},${s.entry.pattern}`;
      if (ok) {
        console.log(`✅ 已兜底: ${line}`);
        console.log(`     ← [Rule] 段存在本地 REJECT 覆盖`);
      } else {
        console.log(`❌ 未兜底: ${line}`);
        problems.push(line);
      }
    }
  }

  // ── 2. 告警: 上游文件头声明计数 ≠ 正文实测 (不可作为计数来源) ──
  console.log("\n## 镜像列表 文件头声明 vs 正文实测\n");
  console.log("| 列表 | 类型 | 头声明 | 正文实测 | 差异 |");
  console.log("|------|------|--------|----------|------|");
  for (const l of orderedLists) {
    // TOTAL 是聚合行而非规则类型, 不参与逐类型比对 (否则恒显示"实测 0")
    const types = new Set([...Object.keys(l.declared), ...l.rules.map((r) => r.type)]);
    types.delete("TOTAL");
    for (const t of [...types].sort()) {
      const d = l.declared[t];
      const a = l.rules.filter((r) => r.type === t).length;
      if (d === undefined || d === a) continue;
      console.log(`| ${l.name} | ${t} | ${d} | ${a} | ${a - d} |`);
      warnings.push(`${l.name}: 头声明 ${t}=${d}, 正文实测 ${a}`);
    }
  }
  if (!warnings.length) console.log("| (全部一致) | | | | |");
  if (warnings.length) {
    console.log("\n⚠️ 上游文件头与正文不符 (上游元数据描述的是完整规则集, 非 Loon 格式正文)。");
    console.log("   **不得把文件头的计数当作本仓库实际生效的规则数引用** ——");
    console.log("   template/loon.tpl 曾据此写下 \"34,579 SUFFIX\" 的错误性能理由 (NEW-04)。");
  }

  if (problems.length) {
    console.log(`\n❌ 规则顺序遮蔽检查失败: ${problems.length} 条 REJECT 条目被靠前的 Proxy 列表遮蔽且无本地兜底`);
    console.log("   修法二选一: (a) 在 template/loon.tpl 的 [Rule] 段加一条精确 REJECT 兜底;");
    console.log("              (b) 调整 [Remote Rule] 顺序, 把该 REJECT 列表提到 Proxy 列表之前。");
    return 1;
  }
  console.log("\n✅ 规则顺序遮蔽检查通过");
  return 0;
}

const isEntryPoint = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) process.exit(run());
