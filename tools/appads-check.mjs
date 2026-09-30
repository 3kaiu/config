#!/usr/bin/env node
/**
 * app-ads.txt 基准核对 (appads check, 2026-09-29)
 *
 * 它是什么: IAB Tech Lab 的 app-ads.txt 是**发行方(开发者站点)**发布的授权清单, 每行
 * `<ad system domain>, <publisher account id>, DIRECT|RESELLER[, <cert authority id>]`。
 * 对本仓的用处是**发现**: 这份清单等于"这个 App 在用的变现平台根域集合", 可与拦截面双向比对。
 *
 * 为什么需要门禁: 插件里那批域级 REJECT 首版自称"基准取自广告主 App 的 AdMob app-ads.txt",
 * 但文件没入库、URL 没记 —— 属"作者说是就是"。2026-09-30 溯源结论(见 SOURCE.json
 * baseline.provenance_audit)是**该叙述不成立**: 首版 21 条全是子域(api./ads./init./ww251. …),
 * 而 IAB app-ads.txt 声明的是 ad system **根域**(44 份真实清单 200005 行里这 21 条出现 0 次)。
 *
 * 由此定下**两把钥匙**的判据(本工具的核心):
 *   ① 平台层 —— 被拦平台必须在 N 份第三方发行商的一手声明里出现过(attestation, 可复跑);
 *   ② 端点层 —— 具体主机要有 DoH + HTTPS 证据(test/cases/dns-liveness.test.js)。
 * 只有 ① 会被 app-ads.txt 回答; 只有 ② 能回答"拦哪个子域"。两把钥匙缺一即类别误标。
 *
 * 三层输入:
 *   baseline(kind=first-party-attestation) 多份发行商公开清单的一手声明语料 → 决定「是不是 ad system」
 *   baseline(kind=publisher-file)          某一份清单(可选叠加层: --file) → 决定「该不该拦这一条」
 *   references                             同一批语料的来源登记(URL/说明)
 *
 * 四种分类(publisher-file 叠加层): covered / excluded / gap(缺域, 发现项) / undeclared(信息项)
 * gap 一律**只报告不判红**: 变成规则前必须走 AGENTS.md 的「域名 REJECT 必须先取证」。
 * 平台层 0 声明则**判红** —— 端点活着不能代替平台声明(首版 supersonicads/admost 就是这么错的)。
 *
 * 用法:
 *   node tools/appads-check.mjs                   # 平台层取证门禁 + 缺口
 *   node tools/appads-check.mjs --file <path>     # 对某一份清单做四桶比对(离线)
 *   node tools/appads-check.mjs --refs [--top 25] # 语料共识 → 缺域候选(离线)
 *   node tools/appads-check.mjs --triage [--top 15] [--probe]  # 两把钥匙候选流水线
 *        (默认离线: 只核验钥匙①平台声明; --probe 再补钥匙②逐 host DoH 实测。**只报告不写规则**)
 *   node tools/appads-check.mjs --fetch           # 重抓语料 → 写回派生域集 + sha256(需联网)
 *   node tools/appads-check.mjs --check           # 平台门禁(离线) + 语料 sha256 漂移检测(联网)
 * 接线: npm test (test/cases/appads-check.test.js) 覆盖解析/分类/漂移/平台门禁/共识/溯源;
 *       .github/workflows/ad-baseline.yml 每周跑 --check。
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
// 显式导入而不是依赖全局: eslint 的 tools/** globals 是刻意收紧的白名单(无 Buffer/TextEncoder)。
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { collectRules, ruleHits, ruleDomain } from "./lib/rule-scan.mjs";
import { AD_PLATFORM_EXCLUSIONS, ROOT } from "./lib/ad-exclusions.mjs";
import { attributionOf, outOfCorpusOf } from "./lib/ad-platform-map.mjs";

export const SOURCE_PATH = path.join(ROOT, "test", "fixtures", "appads", "SOURCE.json");
export const REF_DIR = path.join(ROOT, "test", "fixtures", "appads", "reference");

/** 公共后缀碎片: 按末两段取"根域"时会产生 com.cn 这类噪声, 不当作平台根域 */
const SUFFIX_NOISE = new Set(["com", "net", "org", "gov", "edu", "co", "ac", "mil"]);

/**
 * 解析 IAB app-ads.txt。
 * 变量行(CONTACT=/SUBDOMAIN=/OWNERDOMAIN=/MANAGERDOMAIN=)不是条目; 畸形行进 malformed
 * 而**不是**被静默丢弃 —— 静默丢弃会让"清单里有但没被识别"的域变成不可见缺口。
 */
export function parseAppAds(text) {
  const entries = [];
  const malformed = [];
  const seen = new Set();
  text.split("\n").forEach((raw, i) => {
    const line = raw.replace(/\s+#.*$/, "").trim(); // 行尾注释
    if (!line || line.startsWith("#")) return;
    if (/^[A-Za-z_]+ *=/.test(line)) return; // 变量行 (OWNERDOMAIN = x / CONTACT=x 两种写法)
    const [domain, publisherId, relation, certAuthority] = line.split(",").map((s) => s.trim());
    const ok = domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) && /^(DIRECT|RESELLER)$/i.test(relation || "");
    if (!ok) {
      malformed.push({ line: i + 1, text: raw.trim() });
      return;
    }
    const key = domain.toLowerCase();
    if (seen.has(key)) return; // 同一 ad system 多次声明是合法的, 去重
    seen.add(key);
    entries.push({
      domain: key,
      publisherId: publisherId || null,
      relation: relation.toUpperCase(),
      certAuthority: certAuthority || null,
      line: i + 1,
    });
  });
  return { entries, malformed };
}

/** 条目 → 按域聚合 (DIRECT 比 RESELLER 强: 前者是发行商与该 ad system 的直接关系) */
export function derive(entries) {
  const m = new Map();
  for (const e of entries) {
    const cur = m.get(e.domain) || { domain: e.domain, direct: 0, reseller: 0 };
    if (e.relation === "DIRECT") cur.direct++;
    else cur.reseller++;
    m.set(e.domain, cur);
  }
  return [...m.values()].sort((a, b) => b.direct - a.direct || b.reseller - a.reseller || a.domain.localeCompare(b.domain));
}

/** 规则面覆盖到的根域 (末两段); 用于 undeclared 方向 */
export function blockedRoots(rules) {
  const roots = new Set();
  for (const r of rules) {
    const rd = ruleDomain(r.text);
    if (!rd || rd.type === "DOMAIN-KEYWORD") continue;
    const parts = rd.value.split(".");
    const root = parts.slice(-2).join(".");
    if (!SUFFIX_NOISE.has(root.split(".")[0])) roots.add(root);
  }
  return roots;
}

/**
 * 基准清单的双向比对。判定顺序 covered 优先:
 * apex 语义的台账条目(如 applovin.com)子域上有规则, 它是"在管"而不是"排除" ——
 * 早先把台账放在前面判, 会把它们错报成 excluded。
 */
export function classify(entries, rules, exclusions = AD_PLATFORM_EXCLUSIONS) {
  const buckets = { covered: [], excluded: [], gap: [] };
  for (const e of entries) {
    const hits = rules.filter((r) => ruleHits(r.text, e.domain, "whole"));
    const ex = exclusions.find((x) => x.domain === e.domain);
    if (hits.length) buckets.covered.push({ domain: e.domain, rules: hits.length, ledger: ex ? ex.mode : null });
    else if (ex) buckets.excluded.push({ domain: e.domain, mode: ex.mode, reason: ex.reason });
    else buckets.gap.push({ domain: e.domain });
  }
  const declared = new Set(entries.map((e) => e.domain));
  const undeclared = [...blockedRoots(rules)]
    .filter((r) => !declared.has(r) && !exclusions.some((e) => e.domain === r))
    .sort();
  return { buckets, undeclared, declared: [...declared] };
}

/** 读参考清单派生文件 (test/fixtures/appads/reference/*.json) */
export function readReferences(root = ROOT) {
  const dir = path.join(root, "test", "fixtures", "appads", "reference");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
}

/** 参考清单共识: 域 → 出现在几份清单里 / 其中 DIRECT、RESELLER 各几次 */
export function consensus(refs) {
  const m = new Map();
  for (const r of refs) {
    for (const s of r.systems || []) {
      const cur = m.get(s.domain) || { domain: s.domain, refs: 0, direct: 0, reseller: 0 };
      cur.refs += 1;
      if (s.direct) cur.direct += 1;
      if (s.reseller) cur.reseller += 1;
      m.set(s.domain, cur);
    }
  }
  return [...m.values()].sort(
    (a, b) => b.direct - a.direct || b.refs - a.refs || a.domain.localeCompare(b.domain)
  );
}

/**
 * 参考清单 → 发现项。state 与基准侧同名, 但**证据弱一层**:
 * 这里的 gap 只说明"业界在声明它", 采不采用仍取决于基准 + 逐 host 取证。
 */
export function discovery(refs, rules, exclusions = AD_PLATFORM_EXCLUSIONS) {
  const rows = consensus(refs).map((c) => {
    const hits = rules.filter((r) => ruleHits(r.text, c.domain, "whole")).length;
    const ex = exclusions.find((e) => e.domain === c.domain);
    return { ...c, hits, state: hits ? "covered" : ex ? "excluded" : "gap" };
  });
  return { rows, gaps: rows.filter((r) => r.state === "gap") };
}

/**
 * 反向核对: 本仓拦的根域 × 参考清单背书。
 * 用途不是"没背书就删规则"(参考清单是西方发行商, 天然不覆盖国内 SDK), 而是:
 *   ① 找出**域迁移**类问题 —— 我们拦的域已不在任何清单里, 而清单里出现同品牌的新域
 *      (实例: 我们拦 unity3d.com 的子域, 而 7/7 参考清单声明的是 unity.com);
 *   ② 给"已覆盖"一个外部背书强度, 0/7 的域需要单独说明理由。
 */
export function reverseAudit(rules, refs, exclusions = AD_PLATFORM_EXCLUSIONS) {
  const cons = new Map(consensus(refs).map((c) => [c.domain, c]));
  // 台账域**不排除**: 恰恰是它们最需要外部背书核对 —— 首版把台账域滤掉, 结果
  // "我们拦 unity3d.com 而 7/7 清单声明 unity.com" 这个域迁移信号被静默吞掉了。
  const rows = [...blockedRoots(rules)]
    .sort()
    .map((r) => {
      const c = cons.get(r);
      const ex = exclusions.find((e) => e.domain === r);
      return { domain: r, refs: c ? c.refs : 0, direct: c ? c.direct : 0, total: refs.length, ledger: ex ? ex.mode : null };
    });
  const attested = rows.filter((r) => r.refs > 0).sort((a, b) => b.refs - a.refs || a.domain.localeCompare(b.domain));
  return { rows, attested, unattested: rows.filter((r) => r.refs === 0) };
}

/**
 * 平台层取证: 规则域 → 它所属的**平台根域**是否有一手声明。
 *
 * 为什么不能只看根域字面量: 规则写的是端点主机(api.chartboost.com / ads.api.vungle.com),
 * 而一手声明写的是平台根域(chartboost.com / vungle.com)。故按**从长到短的后缀**回退,
 * 取第一个在语料里出现过的后缀 —— 但只回退到末两段为止, 避免 chartboost.com 认成 com。
 */
export function platformRoot(domain, attested) {
  const parts = String(domain).toLowerCase().split(".");
  for (let i = 0; i <= parts.length - 2; i++) {
    const cand = parts.slice(i).join(".");
    if (SUFFIX_NOISE.has(cand.split(".")[0])) break;
    if (attested.has(cand)) return cand;
  }
  return null;
}

/**
 * 平台层门禁 (两把钥匙的第一把)。
 *
 * 范围: 广告平台**集合插件** `Plugin/ad-block.plugin` (2026-09-30 由 7 个 ad-* 合并;
 * 兼容旧的 `Plugin/ad-intl*.plugin` 命名, 合成用例仍用它) —— 国际变现/聚合平台的规则域
 * **应当**归属于某个 ad system 根域。国内 SDK(穿山甲/广点通/快手/百度)与 Google 族在
 * 集合插件里按 `OUT_OF_CORPUS_ROOTS`(tools/lib/ad-platform-map.mjs) **结构性排除**:
 * 西方发行商清单天然不覆盖它们, 拿同一把尺子量只会产生假红。每次运行都会把排除项打印出来。
 *
 * 判定分三档, 依据是"归属 + 声明":
 *   ✅ attested      归属平台在语料里 ≥threshold 份声明
 *   ⚠️ accounted     归属台账显式记账(别名/本体/语料外), 但声明不足 —— 每次都单独列出, 不静默
 *   ❌ unaccounted   既无声明也不在台账 ⇒ 判红(首版 supersonicads/admost 那类"类别误标"的形状)
 */
/** 读覆盖管线台账的 block 域集合(缺失时返回空集: 覆盖管线没跑过不该让本门禁假红) */
function loadCoverageLedger(root = process.cwd()) {
  try {
    const p = path.join(root, "test/fixtures/ad-coverage/ledger.json");
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return new Set((j.entries || []).filter((e) => e.verdict === "block").map((e) => String(e.host).toLowerCase()));
  } catch {
    return new Set();
  }
}

export function platformGate(rules, refs, { threshold = 3, scope = /^Plugin\/(ad-block|ad-intl)/ } = {}) {
  // 第三类背书: 覆盖管线台账(社区清单 → 我方探针 → 五道判据)的 block 条目。
  // 为什么需要它: 中文广告平台结构性不在 app-ads.txt 语料里(西方发行商声明),
  // 而覆盖管线的准入同样逐条留了证据(双解析器 A + 非功能页 + 非泛解析 + 红线过滤)。
  // 三类背书并列可见: attested(一手声明) / accounted(平台归属台账) / covered(覆盖管线台账)。
  const coveredLedger = loadCoverageLedger();
  const cons = new Map(consensus(refs).map((c) => [c.domain, c]));
  const attestedDomains = new Set(cons.keys());
  const rows = [];
  const seen = new Map();
  const skipped = new Map();
  for (const r of rules.filter((x) => scope.test(x.source))) {
    const d = ruleDomain(r.text);
    if (!d || d.type === "DOMAIN-KEYWORD") continue;
    const exempt = outOfCorpusOf(d.value);
    if (exempt) {
      if (!skipped.has(exempt.root)) skipped.set(exempt.root, { ...exempt, sample: d.value });
      continue;
    }
    const own = attributionOf(d.value);
    const root = own ? own.platform : platformRoot(d.value, attestedDomains);
    const c = root ? cons.get(root) : null;
    const key = root || d.value;
    const prior = seen.get(key);
    if (prior) {
      prior.rules.push(d.value);
      continue;
    }
    const files = c ? c.refs : 0;
    const row = {
      platform: root || null,
      attribution: own ? { kind: own.kind, domain: own.domain, reason: own.reason, declaration_gap: !!own.declaration_gap } : null,
      files,
      direct: c ? c.direct : 0,
      total: refs.length,
      sample: d.value,
      rules: [d.value],
      source: r.source,
      line: r.line,
      verdict:
        files >= threshold
          ? "attested"
          : own
            ? "accounted"
            : coveredLedger.has(d.value)
              ? "covered"
              : "unaccounted",
    };
    seen.set(key, row);
    rows.push(row);
  }
  rows.sort((a, b) => b.files - a.files || String(a.sample).localeCompare(String(b.sample)));
  const fails = rows
    .filter((x) => x.verdict === "unaccounted")
    .map((x) => ({
      platform: x.platform,
      domain: x.sample,
      files: x.files,
      total: x.total,
      source: x.source,
      line: x.line,
      reason: `规则域 ${x.sample} 三类背书都没有: 不在 ${x.total} 份一手声明(0 声明) · 不在 tools/lib/ad-platform-map.mjs 归属台账 · 不在 test/fixtures/ad-coverage/ledger.json 的 block 条目 —— 端点活着不能代替平台声明, 须补归属证据或撤规则(三类背书见 AGENTS.md 广告面治理纪律)`,
    }));
  return { rows, fails, threshold, total: refs.length, gaps: rows.filter((x) => x.attribution?.declaration_gap), outOfCorpus: [...skipped.values()].sort((a, b) => a.root.localeCompare(b.root)) };
}

export function renderPlatformGate(gate) {
  const lines = [];
  lines.push(`── 平台层取证 (语料 ${gate.total} 份第三方发行商 app-ads.txt; 阈值 ≥${gate.threshold} 份) ──`);
  lines.push("   判据(两把钥匙之一): 被拦平台必须有**一手声明**; 端点证据另由 dns-liveness 门禁守。");
  if (gate.outOfCorpus?.length)
    lines.push(
      `   结构性排除 (语料不覆盖, 每次运行可见): ${gate.outOfCorpus.map((x) => `${x.root}=${x.platform}`).join(" / ")}`
    );
  const mark = { attested: "✅", accounted: "⚠️", unaccounted: "❌" };
  for (const r of gate.rows) {
    const att = r.attribution ? ` [台账:${r.attribution.kind}=${r.attribution.domain}]` : "";
    lines.push(
      `   ${mark[r.verdict]} ${(r.platform || "(无归属)").padEnd(22)} ${String(`${r.files}/${r.total}`).padStart(6)} 份声明 (DIRECT ${r.direct})  ← ${r.rules.length} 条规则, 例: ${r.sample} (${r.source}:${r.line})${att}`
    );
  }
  if (gate.gaps.length) {
    lines.push("");
    lines.push(`   ⚠️ 无一手声明的保留项 ${gate.gaps.length} 个(台账已记账, 每次运行都列出 —— 待裁决, 不许静默):`);
    for (const g of gate.gaps) {
      lines.push(`      ${g.attribution.domain} — 声明 0/${g.total}; 理由: ${g.attribution.reason}`);
    }
  }
  if (gate.fails.length) {
    lines.push("");
    lines.push(`   ❌ 平台层判红 ${gate.fails.length} 处:`);
    for (const f of gate.fails) lines.push(`      ${f.source}:${f.line} ${f.domain} — ${f.reason}`);
  }
  return lines.join("\n");
}


export function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function readSource(root = ROOT) {
  const p = path.join(root, "test", "fixtures", "appads", "SOURCE.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export const baselineOf = (src) => src.baseline || {};

/**
 * 基准源状态: **只有未钉死**才给缺口说明。
 * kind=first-party-attestation 的钉死判据不是"有 url", 而是 baisis 里那批语料可复核
 * (URL + sha256 在 reference/*.json 里) —— 故 pinned 一票即过。
 */
export function sourceNotice(baseline) {
  if (baseline.pinned) return null;
  return [
    "⚠️  证据缺口(可见): app-ads.txt **基准**源未钉死 → 「缺域该不该拦」当前不可判(参考清单只能给发现候选)。",
    `   原因: ${baseline.reason || "未钉死"}`,
    `   已排除的替代源: ${(baseline.ruled_out || []).map((x) => x.candidate).join("; ")}`,
    `   解除条件: ${baseline.unblocks || "钉死一份可复核的来源"}`,
  ].join("\n");
}

/** 快照漂移判定 (纯函数, 便于用例注入而不必造临时仓库) */
export function driftNotice(actualSha, baseline) {
  if (!baseline || !baseline.pinned || !baseline.sha256 || !actualSha) return null;
  if (actualSha === baseline.sha256) return null;
  return (
    `❌ 快照漂移: 当前文件 sha256 ${String(actualSha).slice(0, 16)}… ≠ 入库快照 ${String(baseline.sha256).slice(0, 16)}…\n` +
    `   上游 app-ads.txt 变了 —— 基准已过期。复核差异后更新 snapshot 与 sha256(并重跑 gap 比对)。`
  );
}

export function render(result) {
  const { buckets, undeclared, declared, malformed } = result;
  const lines = [];
  lines.push(`── app-ads.txt 双向比对 (声明 ${declared.length} 个 ad system) ──`);
  lines.push(
    `  ✅ covered  ${buckets.covered.length}: ${buckets.covered.map((x) => x.domain + (x.ledger ? `(台账:${x.ledger})` : "")).join(", ") || "—"}`
  );
  lines.push(`  ⏸  excluded ${buckets.excluded.length}: ${buckets.excluded.map((x) => x.domain).join(", ") || "—"}`);
  lines.push(`  ⚠️  gap      ${buckets.gap.length}: ${buckets.gap.map((x) => x.domain).join(", ") || "—"}`);
  if (buckets.gap.length) {
    lines.push("     (gap 是发现项, 不判红: 变规则前须 DoH + HTTPS 取证 —— 见 AGENTS.md)");
  }
  lines.push(
    `  ℹ️  undeclared ${undeclared.length}: ${undeclared.slice(0, 12).join(", ")}${undeclared.length > 12 ? " …" : ""}`
  );
  lines.push("     (信息项, 不判红: 本仓还拦了很多与本 App 无关的通道, 数量大属正常)");
  if (malformed && malformed.length) {
    lines.push(
      `  ⚠️  malformed ${malformed.length} 行未被识别(不许静默丢弃): ${malformed.map((m) => `L${m.line}`).join(", ")}`
    );
  }
  return lines.join("\n");
}

export function renderReferences({ rows, gaps }, refs, audit, top = 25) {
  const lines = [];
  lines.push(`── 参考清单发现 (${refs.length} 份第三方发行商 app-ads.txt, 共 ${rows.length} 个 ad system) ──`);
  lines.push("   ⚠️ 这份语料是**平台层基准**(回答『是不是 ad system』), 但它**不回答**『哪个子域该拦』:");
  lines.push("      端点层必须逐 host DoH + HTTPS 取证(见 test/cases/dns-liveness.test.js) —— 两把钥匙缺一即类别误标。");
  lines.push(
    `   ✅ covered ${rows.filter((r) => r.state === "covered").length} · ⏸ excluded ${rows.filter((r) => r.state === "excluded").length} · ⚠️ gap ${gaps.length}`
  );
  lines.push(`   缺域候选 (按 DIRECT 声明数排序, 前 ${Math.min(top, gaps.length)}/${gaps.length}):`);
  for (const g of gaps.slice(0, top)) {
    lines.push(`     ${g.domain.padEnd(34)} DIRECT ${g.direct}/${refs.length} · 出现 ${g.refs}/${refs.length}`);
  }
  lines.push("   处置: 候选 → 逐 host DoH + HTTPS 取证 → 才谈规则; 不取证就写规则是本仓已犯过的错。");

  lines.push("");
  lines.push(`── 反向核对: 本仓广告插件拦截的根域 × 参考清单背书 (${audit.rows.length} 个根域) ──`);
  lines.push(`   ✅ 有背书 ${audit.attested.length} · ❔ 无任何背书 ${audit.unattested.length}`);
  lines.push("   背书最强的 (参考清单声明数降序):");
  for (const a of audit.attested.slice(0, 15)) {
    lines.push(`     ${a.domain.padEnd(34)} ${a.refs}/${refs.length} 份声明 (DIRECT ${a.direct})${a.ledger ? ` [台账:${a.ledger}]` : ""}`);
  }
  if (audit.unattested.length) {
    lines.push("   无任何参考清单背书(不等于错 —— 参考清单是西方发行商, 天然不覆盖国内 SDK;");
    lines.push("   但**同品牌新域**出现在清单里 = 疑似域迁移, 需单独复核):");
    lines.push(`     ${audit.unattested.map((u) => u.domain).join(", ")}`);
  }
  return lines.join("\n");
}

/** 纯逻辑入口 (无网络); 供用例复用。file 为空则只用快照 */
export function run({ root = ROOT, file = null, quiet = false } = {}) {
  const src = readSource(root);
  const baseline = baselineOf(src);
  const notices = [];
  const notice = sourceNotice(baseline);
  if (notice) notices.push(notice);

  const target = file || (baseline.pinned && baseline.snapshot ? path.join(root, baseline.snapshot) : null);
  if (!target) {
    return { source: src, baseline, notices, result: null, exitCode: 0 };
  }
  const text = fs.readFileSync(path.isAbsolute(target) ? target : path.join(root, target), "utf8");
  const parsed = parseAppAds(text);
  const result = {
    ...classify(parsed.entries, collectRules(root)),
    malformed: parsed.malformed,
    file: target,
    sha256: sha256(text),
  };

  const drift = driftNotice(result.sha256, baseline);
  if (drift && !quiet) {
    notices.push(drift);
    return { source: src, baseline, notices, result, exitCode: 1 };
  }
  return { source: src, baseline, notices, result, exitCode: 0 };
}

/**
 * 平台层入口 (离线): 语料 + 规则面 → 取证表与判红。
 * 平台层还有一份**平台缺口**: 有一手声明(≥阈值)、但本仓既没拦也没登记排除的平台 ——
 * 这是"缺域"在平台粒度上的形态, 只报告; 变规则前仍需端点 DoH + HTTPS 取证。
 */
export function runAttestation({ root = ROOT, threshold = null } = {}) {
  const src = readSource(root);
  const baseline = baselineOf(src);
  const refs = readReferences(root);
  const rules = collectRules(root);
  const gate = platformGate(rules, refs, { threshold: threshold ?? baseline.threshold_files ?? 3 });
  const blocked = new Set(gate.rows.map((r) => r.platform).filter(Boolean));
  const platformGaps = consensus(refs)
    .filter((c) => c.refs >= gate.threshold && !blocked.has(c.domain))
    .filter((c) => !AD_PLATFORM_EXCLUSIONS.some((e) => e.domain === c.domain));
  return { source: src, baseline, refs, gate, platformGaps, text: renderPlatformGate(gate) };
}

/** 参考清单模式 (离线): 读派生文件 → 共识 → 缺域候选 + 反向核对 */
export function runDiscovery({ root = ROOT, top = 25 } = {}) {
  const src = readSource(root);
  const refs = readReferences(root);
  const rules = collectRules(root);
  const d = discovery(refs, rules);
  // 反向核对只看广告插件: 主配置里那 300+ 条国内分流域拿西方发行商清单核对没有意义。
  const audit = reverseAudit(rules.filter((r) => /^Plugin\/ad-/.test(r.source)), refs);
  return { source: src, refs, ...d, audit, text: renderReferences(d, refs, audit, top) };
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "loon-config-appads-check" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * 候选流水线 (2026-09-30): 把"有平台声明但本仓未拦"的 800+ 个平台变成**可跟踪的候选队列**。
 *
 * 为什么需要它: `--refs` 只给出"哪些域被声明得多", 而本仓写规则的判据是**两把钥匙**——
 *   ① 平台层: 该平台在语料里有声明(≥threshold 份);
 *   ② 端点层: 具体 host 有 DoH + HTTPS 实测证据。
 * 两者之间隔着大量手工劳动(枚举候选 host → 逐个探针), 于是 807 个缺口长期只是"一个数字"。
 * 本函数把它变成一张表: 候选 host = 平台根域 × SDK 常见前缀, 标出钥匙①是否成立、
 * 该 host 是否已被现有规则覆盖、以及(可选)钥匙②的实测结果。
 *
 * **只报告, 永不写规则**: 自动写规则等于把"枚举 + 探针"的产物当证据——正是本仓 21 域
 * 首版踩过的坑。人仍需为每条候选决定"拦不拦", 但不必再从零取证。
 */
export const CANDIDATE_PREFIXES = ["api", "sdk", "ads", "ad", "init", "config", "log", "track", "events", "req"];

/** 纯逻辑: 生成候选表(不联网)。probe 结果由调用方注入(键 = host) */
export function triage(refs, rules, { top = 15, threshold = 3, prefixes = CANDIDATE_PREFIXES, probes = null } = {}) {
  const blocked = blockedRoots(rules);
  const rows = [];
  for (const c of consensus(refs).filter((x) => x.refs >= threshold)) {
    if (blocked.has(c.domain)) continue;
    const hosts = prefixes.map((p) => ({ host: `${p}.${c.domain}`, blocked: blocked.has(`${p}.${c.domain}`) }));
    rows.push({
      platform: c.domain,
      files: c.refs,
      direct: c.direct,
      total: refs.length,
      hosts: probes ? hosts.map((h) => ({ ...h, probe: probes[h.host] || null })) : hosts.map((h) => ({ ...h, probe: null })),
    });
    if (rows.length >= top) break;
  }
  return rows;
}

export function renderTriage(rows, { probed = false, total = null } = {}) {
  const lines = [];
  lines.push(`── 候选流水线 (两把钥匙; ${probed ? "已实测端点" : "离线: 仅钥匙①"}) ──`);
  lines.push("   钥匙① = 语料里有平台声明(下表 files 列); 钥匙② = 逐 host DoH/HTTPS 实测。");
  lines.push("   但**两把齐也只是候选**: ③ 该 host 是否广告/上报专有(而非引擎/开发者功能页) 必须由人按");
  lines.push("   APP-ONBOARDING 第 1 节判断 —— 本表测的是『这个 host 活着吗』, 不是『它是不是广告端点』。");
  lines.push("   本命令**不写任何规则**: 枚举 + 探针的产物当规则用, 正是首版 21 域踩过的坑。");
  for (const r of rows) {
    lines.push(
      `   ${r.platform.padEnd(26)} 钥匙① ${String(`${r.files}/${r.total}`).padStart(6)} 份声明 (DIRECT ${r.direct})`
    );
    const shown = r.hosts.slice(0, 6);
    for (const h of shown) {
      const p = h.probe;
      const mark = h.blocked ? "已拦" : p ? (p.a > 0 ? `live A×${p.a}${p.mismatch ? "(解析器不一致)" : ""}` : `无 A (${p.status})`) : "未实测";
      lines.push(`      ${h.host.padEnd(38)} ${mark}`);
    }
    if (r.hosts.length > shown.length) lines.push(`      … 另 ${r.hosts.length - shown.length} 个前缀候选见 --probe 输出`);
  }
  lines.push("");
  lines.push("   处置: 钥匙①+②齐备 → 按 APP-ONBOARDING 第 1 节取证后写入 Plugin/ad-block.plugin;");
  lines.push("         只有钥匙①  → 停在候选(端点不存在 = 写了也是死规则, 见 dns-liveness 判据)。");
  return lines.join("\n");
}

/** 双解析器 DoH A 记录实测(联网; 供 --triage --probe 使用) */
export async function probeHosts(hosts, { timeout = 8000 } = {}) {
  const RES = [
    { name: "cloudflare", base: "https://cloudflare-dns.com/dns-query?name=" },
    { name: "google", base: "https://dns.google/resolve?name=" },
  ];
  const out = {};
  for (const host of hosts) {
    const res = [];
    for (const r of RES) {
      try {
        const resp = await fetch(`${r.base}${host}&type=A`, {
          headers: { accept: "application/dns-json" },
          signal: AbortSignal.timeout(timeout),
        });
        const j = await resp.json();
        res.push({ status: j.Status, a: (j.Answer || []).filter((x) => x.type === 1).map((x) => x.data).sort().join(",") });
      } catch {
        res.push({ status: "ERR", a: "" });
      }
    }
    const a = res.filter((x) => x.status === 0 && x.a).length;
    out[host] = {
      a,
      status: res.map((x) => x.status).join("/"),
      mismatch: res[0].a !== res[1].a,
    };
  }
  return out;
}

/** 候选流水线入口: root + top + 是否实测 */
export async function runTriage({ root = ROOT, top = 15, probe = false } = {}) {
  const refs = readReferences(root);
  const rules = collectRules(root);
  const base = triage(refs, rules, { top });
  let rows = base;
  if (probe) {
    const hosts = base.flatMap((r) => r.hosts.filter((h) => !h.blocked).map((h) => h.host));
    const probes = await probeHosts(hosts);
    rows = triage(refs, rules, { top, probes });
  }
  return { refs, rules, rows, probed: probe, text: renderTriage(rows, { probed: probe }) };
}

/** 抓一份参考清单 → 派生域集 (原始文件不入库, 只留 URL + sha256 + 域集, 可重抓核对) */
export async function fetchReference(src) {
  const text = await fetchText(src.url);
  const { entries, malformed } = parseAppAds(text);
  return {
    slug: src.slug,
    url: src.url,
    note: src.note,
    fetched_at: new Date().toISOString().slice(0, 10),
    sha256: sha256(text),
    bytes: Buffer.byteLength(text),
    declared_lines: entries.length,
    malformed_lines: malformed.length,
    _warning: "一手声明语料(第三方发行商自报的 ad system 根域): 平台层判定依据, **不得直接当规则** —— 端点层须另做 DoH + HTTPS 取证。原始文件未入库, 用 url + sha256 可重抓核对。",
    systems: derive(entries),
  };
}

function isMain() {
  const arg = process.argv[1] && path.resolve(process.argv[1]);
  return arg === fileURLToPath(import.meta.url);
}

async function main() {
  const flag = (name) => process.argv.includes(name);
  const value = (name, dflt) => (flag(name) ? process.argv[process.argv.indexOf(name) + 1] : dflt);
  const quiet = flag("--quiet");

  if (flag("--fetch")) {
    const src = readSource();
    const sources = (src.references && src.references.sources) || [];
    const dir = path.join(ROOT, "test", "fixtures", "appads", "reference");
    fs.mkdirSync(dir, { recursive: true });
    for (const s of sources) {
      try {
        const ref = await fetchReference(s);
        fs.writeFileSync(path.join(dir, `${s.slug}.json`), JSON.stringify(ref, null, 2) + "\n");
        console.log(`✅ ${s.slug.padEnd(12)} ${ref.declared_lines} 个 ad system (${ref.bytes} bytes, sha256 ${ref.sha256.slice(0, 12)}…)`);
      } catch (e) {
        console.log(`❌ ${s.slug.padEnd(12)} 抓取失败: ${e.message} — 保留上一次的派生文件, 不写空文件`);
      }
    }
    return;
  }

  if (flag("--triage")) {
    const { text, rows } = await runTriage({ top: Number(value("--top", 15)), probe: flag("--probe") });
    console.log(text);
    const live = rows.flatMap((r) => r.hosts).filter((h) => h.probe && h.probe.a > 0 && !h.blocked).length;
    console.log(`\n   汇总: ${rows.length} 个平台候选, 其中钥匙②已实测存活的 host ${live} 个 (其余为无 A 或已拦)。`);
    process.exit(0);
  }

  if (flag("--refs")) {
    const { text } = runDiscovery({ top: Number(value("--top", 25)) });
    console.log(text);
    process.exit(0);
  }

  const attestationMode = flag("--platforms") || readSource().baseline?.kind === "first-party-attestation";
  if (attestationMode && !value("--file", null)) {
    const { baseline, gate, platformGaps, refs, text } = runAttestation();
    console.log(text);
    if (platformGaps.length) {
      console.log("");
      console.log(`   平台缺口 ${platformGaps.length} 个(有一手声明、本仓未拦也未登记排除, 只报告):`);
      for (const g of platformGaps.slice(0, 12)) {
        console.log(`     ${g.domain.padEnd(30)} ${g.refs}/${refs.length} 份声明 (DIRECT ${g.direct})`);
      }
      if (platformGaps.length > 12) console.log(`     … 其余 ${platformGaps.length - 12} 个见 --refs`);
      console.log("     处置: 平台有声明 ≠ 端点存在 —— 拦之前仍须逐 host DoH + HTTPS 取证。");
    }
    if (process.env.GITHUB_ACTIONS === "true" && !baseline.pinned) {
      console.log(`::warning title=app-ads.txt 基准源未钉死::${baseline.reason || ""}`);
    }
    if (flag("--check")) {
      if (gate.fails.length) {
        console.log("");
        console.log(`❌ --check: 平台层判红 ${gate.fails.length} 处 —— 被拦平台缺一手声明(类别误标)`);
        process.exit(1);
      }
      // 语料漂移: 上游清单变了 ⇒ 基准的证据基础已变, 必须复核后 --fetch 更新。
      const drift = [];
      for (const s of readSource().references?.sources || []) {
        try {
          const live = await fetchText(s.url);
          const rec = refs.find((r) => r.slug === s.slug);
          const liveHash = sha256(live);
          if (rec && rec.sha256 !== liveHash) {
            drift.push({ slug: s.slug, was: rec.sha256, now: liveHash });
          }
        } catch (e) {
          drift.push({ slug: s.slug, err: e.message });
        }
      }
      if (drift.length) {
        console.log("");
        console.log(`❌ --check: 语料漂移 ${drift.length}/${(readSource().references?.sources || []).length} 份`);
        for (const d of drift) {
          console.log(
            d.err
              ? `   ⚠️ ${d.slug}: 抓取失败 ${d.err}`
              : `   ${d.slug}: ${String(d.was).slice(0, 12)}… → ${String(d.now).slice(0, 12)}…`
          );
        }
        console.log("   复核差异后跑 `node tools/appads-check.mjs --fetch` 更新派生域集与 sha256。");
        process.exit(1);
      }
      console.log("✅ --check: 平台层取证通过, 语料 sha256 与入库一致");
      process.exit(0);
    }
    process.exit(gate.fails.length ? 1 : 0);
  }

  const { source, baseline, notices, result, exitCode } = run({ file: value("--file", null), quiet });
  for (const n of notices) console.log(n);
  // CI 里把"基准源未钉死"打成一个注解 —— 一个输入缺失就静默转绿的定时任务比没有它更坏。
  if (process.env.GITHUB_ACTIONS === "true" && !baseline.pinned) {
    console.log(`::warning title=app-ads.txt 基准源未钉死::缺域(该不该拦)不可判。${baseline.reason}`);
  }
  if (result) console.log(render(result));
  else console.log("(基准无快照可比对 —— 见上方缺口说明; 可先看参考清单发现: --refs)");

  if (flag("--check") && baseline.pinned && baseline.url) {
    const live = await fetchText(baseline.url);
    const liveHash = sha256(live);
    if (liveHash !== baseline.sha256) {
      console.log(`❌ --check: 活文件 sha256 ${liveHash.slice(0, 16)}… ≠ 快照 ${String(baseline.sha256).slice(0, 16)}… → 基准已过期`);
      process.exit(1);
    }
    console.log("✅ --check: 活文件与入库快照一致");
  }
  process.exit(exitCode);
}

if (isMain()) main();
