#!/usr/bin/env node
/**
 * 规则顺序遮蔽检查 (2026-09-11 深度审计 NEW-05 新增; 2026-09-18 优化审计重写)
 *
 * 取代 mirror-scripts.yml 里原先那段**硬编码 20 个关键词的 grep**。旧门禁有两个
 * 独立缺陷: (1) 只查"Global 里有没有广告域", 方向反了 —— 真正会静默失效的是
 * 反方向; (2) 关键词表写死, 上游新增的遮蔽组合天然漏检。
 *
 * 背景: [Remote Rule] 的列表**按序线性求值, 先命中即终止**。任何**非 REJECT** 策略
 * (DIRECT / Proxy / 自定义组) 的靠前列表都会抢先命中并终止后续扫描 —— 排在 REJECT
 * 列表之前, 其域名类规则就是遮蔽者。修复漏检后遮蔽面达到千条量级:
 *   - 旧实现只把 policy 含 `proxy` 的列表当遮蔽者, 而排在最前的 China 是 DIRECT
 *     (漏掉 China→Advertising/Hijacking/goodbyeads 共 ~1050 条);
 *   - 旧实现只比较 DOMAIN-KEYWORD, 漏掉 DOMAIN-SUFFIX 遮蔽 (China 的 `cn` 后缀一条
 *     就吞掉数百条 `.cn` 广告域);
 *   - 且列表路径用 `loon-${name}.list` 硬拼, goodbyeads-qx.list (不带 loon- 前缀)
 *     解析不到文件被静默 continue —— 整张 117k 条的表根本不参与检查。
 *
 * 判定原则: **REJECT → REJECT 不算缺陷** (行为等价, 条目不可达但语义不变);
 * 非策略差异的"不可达"才是静默失效。
 *
 * 两项检查:
 *   1. [硬门禁] 对每一对 (靠前非 REJECT 列表, 靠后 REJECT 列表) 求实际集合交集,
 *      按"对"聚合报告。被遮蔽的 REJECT 条目要么有 template/loon.tpl [Rule] 段
 *      (含 include 的 snippet) 的本地 REJECT 兜底, 要么该"对"已在 ACCEPTED_PAIRS
 *      登记接受 (须写实测成因+复检日期), 否则判红。
 *   2. [告警] 对比镜像列表**文件头声明的计数**与正文实测计数。上游 blackmatrix7 的
 *      Loon 格式列表头描述的是其**完整规则集**, 与 Loon 文件正文并不一致。
 *      例如 Global 文件头的 DOMAIN-SUFFIX 声明与本地正文不符；该头**不可用作计数来源**。
 *      只告警不判红: 上游元数据不在本仓库控制范围, 判红会让每日镜像无谓刷红。
 *
 * 已知盲区: 只覆盖"域名规则被域名规则遮蔽"; IP-CIDR/URL-REGEX/USER-AGENT 与域名
 * 规则的匹配面不构成确定的子集关系, 纳入会误报, 故显式不纳入 (见 DOMAIN_TYPES)。
 *
 * 用法: node tools/rule-shadow-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 已知且接受的 **(遮蔽方 → 被遮蔽方) 列表对** (2026-09-18 优化审计新增)。
 *
 * 为什么按"对"登记而不是按条目: 修好漏检后遮蔽面是千条量级 (goodbyeads 一张表就被
 * China/Global 抢走 1500+ 条), 逐条登记既不可读也会变成"永久静默接受"的温床。
 * 按对登记的效果是: **已有的接受被记录并逐轮打印计数, 而任何新出现的对立刻判红**。
 *
 * 登记规则 (与 mirror-drift-check 的 ACCEPTED_* 同一教训): 必须写**实测成因 + 复检日期**,
 * 不得用未核实的推断充当成因; 计数会随上游刷新变化, 故 reason 里不要写死具体条数。
 */
export const ACCEPTED_PAIRS = new Map([
  // 拦截区 (Advertising/Privacy/Hijacking) 已重排到 China/Global 之前 (2026-09-18),
  // 此后仅剩 goodbyeads(117k 条, 全仓库最大表) 压轴产生的两对遮蔽。原因见
  // template/loon.tpl [Remote Rule] 段的排序注释: 最大表排最后才能让 China/Global
  // 覆盖的绝大多数请求免扫 117k 条 —— 被抢走的条目是"该表让路"的显性代价。
  [
    "China→goodbyeads-qx",
    {
      reason: "China(DIRECT,63 条) 在前: 国内域名先命中 DIRECT, 其 `cn` 后缀与 aliyun 等关键词抢先命中 goodbyeads 的 .cn/阿里系条目。取舍: 换取国内请求免扫 117k 条; 被抢条目多为 .cn 广告域, 拦截收益让位于国内直连路径最短。",
      reviewBy: "2027-03-31 (半年后随上游 goodbyeads 复检: 若 .cn 条目占比上升或出现误杀投诉, 评估 China 拆分 `cn` 后缀改放 goodbyeads 之后)",
    },
  ],
  [
    "Global→goodbyeads-qx",
    {
      reason: "Global(Proxy,198 条,36 个宽匹配 DOMAIN-KEYWORD) 在 goodbyeads 之前: 国际主流域名请求提前终止, 免扫 117k 条; 被抢条目 (porn/google 等关键词命中的成人/广告域) 本就会被 Global 走代理而非拦截 —— 这是取舍的真实代价: 这部分域名从 REJECT 变为 Proxy。",
      reviewBy: "2027-03-31 (随上游 goodbyeads 复检)",
    },
  ],
]);
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

/** 解析 [Remote Rule] 的引用行 → [{name, url, rel, policy, tag}] 保持文件顺序 */
export function parseRemoteRules(lines) {
  const out = [];
  for (const raw of lines) {
    const s = raw.trim();
    if (!s || s.startsWith("#")) continue;
    const url = (s.match(/https?:\/\/\S+?\.list/) || [])[0];
    if (!url) continue;
    const policy = (s.match(/policy\s*=\s*([^,\s]+)/) || [])[1] || "";
    const tag = (s.match(/tag\s*=\s*([^,]+)/) || [])[1] || "";
    // loon-Global.list → Global; 无 loon- 前缀者 (goodbyeads-qx.list) 原样
    const name = path.basename(url).replace(/\.list$/, "").replace(/^loon-/, "");
    // 仓库内路径必须**由 URL 推出**, 不可用 `loon-${name}.list` 硬拼:
    // 2026-09-18 优化审计实测 —— goodbyeads-qx.list 不带 loon- 前缀, 硬拼得到不存在的
    // `loon-goodbyeads-qx.list`, run() 里 `if (!fs.existsSync(p)) continue` 于是**静默跳过
    // 整张 117k 条的表** (工具输出里顺序序列根本没有它), 该表的所有遮蔽都不可见。
    const rel = (url.match(/\/main\/(?:Mirror\/)?(.+)$/) || [])[1] || `rules/${path.basename(url)}`;
    out.push({ name, url, rel, policy, tag: tag.trim() });
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
 * 参与遮蔽判定的域名类规则类型。
 * 不纳入: IP-CIDR/IP-CIDR6/USER-AGENT/URL-REGEX —— 它们与域名规则的匹配面不构成
 * 确定的子集关系 (Loon 对域名目标先匹配域名规则, 再解析 DNS 匹配 IP 规则), 逐条判定
 * 会误报。**已知盲区**: 因此本工具只覆盖"域名规则被域名规则遮蔽"一类。
 */
const DOMAIN_TYPES = ["DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD"];

/**
 * 求一条靠后条目被靠前列表**完全遮蔽**的命中项 (返回命中描述数组, 空 = 未被遮蔽)。
 *
 * "完全遮蔽"的三种子集关系 (满足即该条目的请求 100% 被靠前规则抢先匹配):
 *   - 靠前 `DOMAIN-KEYWORD,k` 且 k 是条目模式的**子串** → 匹配该模式的域名必然含 k
 *   - 靠前 `DOMAIN-SUFFIX,s` 且条目模式 v 等于 s 或以 `.s` 结尾 → 匹配 v 的域名都匹配 s
 *   - 靠前 `DOMAIN,d` 且与条目模式 v 精确相等
 * 注意方向性: `DOMAIN-SUFFIX,cn` 会吞掉 `DOMAIN,x.com.cn` (v.endsWith('.cn') 成立),
 * 而 `DOMAIN-SUFFIX,x.com.cn` **不会**吞掉 `DOMAIN,cn`。
 */
export function shadowHits(entry, shadowerRules) {
  const v = String(entry.pattern).toLowerCase().replace(/^\*\./, "");
  const hits = [];
  for (const r of shadowerRules) {
    const q = String(r.pattern).toLowerCase();
    if (!q) continue;
    if (r.type === "DOMAIN-KEYWORD" && v.includes(q)) hits.push(`DOMAIN-KEYWORD,${q}`);
    else if (r.type === "DOMAIN-SUFFIX" && (v === q || v.endsWith("." + q))) hits.push(`DOMAIN-SUFFIX,${q}`);
    else if (r.type === "DOMAIN" && q === v) hits.push(`DOMAIN,${q}`);
  }
  return [...new Set(hits)];
}

/**
 * 求遮蔽: 对每一对 (靠前**非 REJECT** 列表, 靠后 REJECT 列表), 找出后者中被前者
 * 域名类规则抢先命中的条目。
 *
 * 2026-09-18 优化审计重写 (原实现有两处漏检, 合计漏报 1052 条):
 *   1. 遮蔽者只认 `policy` 含 `proxy` 的列表 —— 而排在最前的 China 是 **DIRECT**,
 *      DIRECT 同样抢先命中并终止后续列表扫描 (`loon.tpl` 自己写着"国内流量先命中 DIRECT,
 *      不必扫描广告/隐私/反劫持列表", 却正是这句话描述的遮蔽被工具跳过)。
 *   2. 命中类型只认 DOMAIN-KEYWORD —— 实测 China 的 `DOMAIN-SUFFIX,cn` 吞掉 759 条。
 * 判定原则: **REJECT → REJECT 不算缺陷** (两者行为等价, 条目不可达但语义不变),
 * 只有"非 REJECT 列表抢先了 REJECT 条目"才是静默失效。
 */
export function findShadowed(orderedLists) {
  const shadowed = [];
  for (let i = 0; i < orderedLists.length; i++) {
    const a = orderedLists[i];
    if (/reject/i.test(a.policy)) continue;
    const shadower = a.rules.filter((r) => DOMAIN_TYPES.includes(r.type));
    if (!shadower.length) continue;
    for (let j = i + 1; j < orderedLists.length; j++) {
      const b = orderedLists[j];
      if (!/reject/i.test(b.policy)) continue;
      for (const e of b.rules) {
        if (!DOMAIN_TYPES.includes(e.type)) continue;
        const hits = shadowHits(e, shadower);
        if (!hits.length) continue;
        shadowed.push({
          from: a.name, fromPolicy: a.policy, to: b.name, toPolicy: b.policy,
          hit: hits,
          // 向后兼容字段 (旧用例断言 keyword): 仅取 KEYWORD 类命中的模式部分
          keyword: hits.filter((h) => h.startsWith("DOMAIN-KEYWORD,")).map((h) => h.slice("DOMAIN-KEYWORD,".length)),
          entry: e,
        });
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

export function run(root = ROOT, acceptedPairs = ACCEPTED_PAIRS) {
  const tplPath = path.join(root, "template", "loon.tpl");
  const tplText = fs.readFileSync(tplPath, "utf8");
  const tplDir = path.dirname(tplPath);

  const localRules = parseRuleLines(expandIncludes(sectionLines(tplText, "Rule"), tplDir));
  const remote = parseRemoteRules(sectionLines(tplText, "Remote Rule"));

  const orderedLists = [];
  for (const r of remote) {
    // 路径由 URL 推出 (r.rel), 不用 `loon-${name}.list` 硬拼 —— 见 parseRemoteRules 注释
    const p = path.join(root, "Mirror", r.rel);
    if (!fs.existsSync(p)) {
      // 不静默跳过: 声明了却解析不到文件本身就是缺陷 (旧实现静默 continue, 于是
      // goodbyeads-qx.list 整张表不参与检查)
      console.log(`⚠️ 声明存在但仓库内无对应文件, 该列表不参与遮蔽判定: ${r.url} → Mirror/${r.rel}`);
      continue;
    }
    const { rules, declared } = parseListFile(fs.readFileSync(p, "utf8"));
    orderedLists.push({ ...r, rules, declared });
  }

  const problems = [];
  const warnings = [];

  // ── 1. 硬门禁: 遮蔽面必须被本地规则兜住, 或已被登记接受 ──
  console.log("## 规则顺序遮蔽检查 (靠前的非 REJECT 列表抢先命中 REJECT 条目)\n");
  console.log(`顺序: ${orderedLists.map((l) => `${l.name}(${l.policy})`).join(" → ")}\n`);
  const shadowed = findShadowed(orderedLists);

  // 按 (遮蔽方 → 被遮蔽方) 聚合。2026-09-18: 修好漏检后遮蔽面达千条量级, 逐条打印会淹没
  // 输出, 而门禁的判定主体本来就是"这一对是否可接受"。
  const pairs = new Map();
  for (const s of shadowed) {
    const key = `${s.from}→${s.to}`;
    const rec = pairs.get(key) || {
      key, from: s.from, to: s.to, fromPolicy: s.fromPolicy, toPolicy: s.toPolicy,
      total: 0, compensated: 0, types: new Map(), samples: [],
    };
    rec.total++;
    const ok = isCompensated(s.entry, localRules);
    if (ok) rec.compensated++;
    const t = s.hit[0].split(",")[0];
    rec.types.set(t, (rec.types.get(t) || 0) + 1);
    if (!ok && rec.samples.length < 5) {
      rec.samples.push(`${s.entry.type},${s.entry.pattern}  ←  ${s.hit.slice(0, 2).join(" / ")}`);
    }
    pairs.set(key, rec);
  }

  if (!pairs.size) {
    console.log("✅ 无遮蔽: 靠前的非 REJECT 列表没有抢先命中任何 REJECT 条目");
  }
  for (const [, rec] of [...pairs].sort((a, b) => b[1].total - a[1].total)) {
    const unreachable = rec.total - rec.compensated;
    const counts = [...rec.types].map(([t, n]) => `${t} ${n}`).join(" / ");
    if (unreachable === 0) {
      console.log(`✅ ${rec.key}: ${rec.total} 条全部有本地 [Rule] REJECT 兜底 (${counts})`);
      continue;
    }
    const reg = acceptedPairs.get(rec.key);
    if (reg) {
      console.log(`⚠️ 已登记接受 ${rec.key}: ${unreachable}/${rec.total} 条不可达 (${counts})`);
      console.log(`     ${reg.reason}`);
      console.log(`     复检 ${reg.reviewBy}`);
      warnings.push(`${rec.key}: ${unreachable} 条不可达 (已登记)`);
      continue;
    }
    console.log(`❌ ${rec.key}: ${unreachable}/${rec.total} 条 REJECT 条目被靠前列表遮蔽且无本地兜底 (${counts})`);
    for (const s of rec.samples) console.log(`     · ${s}`);
    problems.push(`${rec.key}: ${unreachable} 条不可达`);
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
    console.log(`\n❌ 规则顺序遮蔽检查失败: ${problems.length} 对遮蔽未处理 — 静默失效 = 上游规则在加载, 但相关域名永远走不到它`);
    console.log("   修法任选: ① 把被遮蔽的 REJECT 列表移到遮蔽方之前 (改 template/loon.tpl 的 [Remote Rule] 顺序, 重排后跑 npm run generate)");
    console.log("            ② 在 template/loon.tpl 的 [Rule] 段加本地 REJECT 兜底 (适合面窄的, 如单一关键词)");
    console.log("            ③ 确认是刻意取舍后在 tools/rule-shadow-check.mjs 的 ACCEPTED_PAIRS 登记 (须写实测成因+复检日期)");
    return 1;
  }
  console.log(`\n✅ 规则顺序遮蔽检查通过 (${warnings.length} 条告警)`);
  return 0;
}

const isEntryPoint = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) process.exit(run());
