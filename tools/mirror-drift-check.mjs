#!/usr/bin/env node
/**
 * 镜像漂移检测 (2026-09-11 分模块审计 MOD-09)
 *
 * 问题: mirror-scripts.yml 声明 `releases/latest/download/…`, 但 keep_old 会在 fetch
 * 失败时静默保留旧版 → MANIFEST 记录的是固定旧版本, 与声明不再一致。
 * 本工具比对 "workflow 声明的 mirror() URL" 与 "MANIFEST 实际记录的 source_url",
 * 输出漂移清单 — 供维护者决定是修复上游 URL、还是接受受管陈旧。
 *
 * 用法:
 *   node tools/mirror-drift-check.mjs           报告模式 (始终 exit 0, 供人看)
 *   node tools/mirror-drift-check.mjs --strict  门禁模式 (出现**未登记**的漂移/从未抓取即 exit 1)
 *   node tools/mirror-drift-check.mjs --quiet   只输出判定行
 *
 * ── 退出码语义 (2026-09-11 深度审计 NEW-10 决策) ──
 * 本工具此前默认在"从未抓到"时 exit 1, 但该状态**并不等价于缺陷** —— 镜像 PR 未合并时
 * main 上必然看到全部新增条目都是"从未抓到"(实测 PR #39 未合并期间 13 条 bundle.js)。
 * 故拆成两种模式: 默认报告 (exit 0), `--strict` 才是门禁。
 *
 * `--strict` 判定为**子集**而非相等: `ACCEPTED_*` 登记的是"已知且接受"的条目, 出现登记表
 * 之外的漂移才判红。条目消解后 (如镜像 PR 合并) 保留在登记表内无害 — 避免每次上游变化
 * 都要同步删表。
 *
 * ⚠️ 2026-09-18 优化审计补充: "留存无害"只对**判定**成立, 对**成因标注**不成立 ——
 * 实测两张表里 20 条的成因写着"上游已移除 .plugin asset", 而该断言只对 7 条中的 1 条属实
 * (见下方 ACCEPTED_DRIFT 注释)。错误的成因会把红门禁变成永久静默接受, 故条目消解时应
 * 一并清掉成因, 而不是留着一份与事实相反的"解释"。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * 已知且接受的 **URL 漂移** (workflow 声明 ≠ MANIFEST 记录)。
 *
 * 2026-09-18 优化审计: **本表已清空** —— 原 7 条 iRingo 登记随镜像 PR #42 合并全部消解
 * (PR #42 把 13 个 bundle.js 落库、MANIFEST 的 source_url 翻到 `releases/latest/…`),
 * 实测 `--strict` 漂移 0 条 / 从未抓到 0 条。
 *
 * ⚠️ 教训 (为什么必须清掉而不是"留着无害"): 原登记的成因写的是
 * "NSRingo 自 v3.2.0 (2026-08) 起从 release 中移除 `.plugin` asset" —— 该断言**只对
 * WeatherKit 成立**。实测其余 6 家 latest 仍供 `.plugin` 且 200 可用 (上游把仓库从
 * `Maps` 改名为 `MapKit`, GitHub 301 重定向后照常下载); mirror-scripts.yml 已于
 * 2026-09-18 就地更正同一条注释。一条**未核实的推断**被写成登记成因 = 把"上游坏"
 * 当既成事实, 于是 7 条真实漂移从"待查"变成"永久静默接受", 门禁全绿而 PR 积压 6 天。
 * 故本表的使用规则: 登记必须写明**实测成因 + 复检日期**, 且不得用推断充当成因。
 */
export const ACCEPTED_DRIFT = new Map([]);

/**
 * 已知且接受的 **从未抓到** (workflow 声明但 MANIFEST 无记录)。
 *
 * 2026-09-18 优化审计: **本表已清空** —— 原 13 条 NSRingo bundle.js 登记随镜像 PR #42
 * 合并消解 (文件已落库, MANIFEST 有记录)。原成因"由未合并的镜像 PR 引入"属实, 但它暴露的
 * 真问题是流程本身: 未合并的 PR 会让 main 长期处于"声明了却没抓到"的状态, 而登记表把这种
 * 状态常态化。**排查方向应是"为什么 PR 没合并", 不是"把它登记掉"** —— 实测根因是
 * `secrets.MIRROR_TOKEN` 未配置导致镜像 PR 的 CI 停在 action_required (见 mirror-scripts.yml
 * 的 verify job 注释), 现已有不依赖 secret 的自校验通道。
 */
export const ACCEPTED_MISSING = new Map([]);

/**
 * 已登记条目的复检日期 (2026-09-18 优化审计)。
 *
 * ACCEPTED_* 是"已知且接受", 不是"永久豁免" —— 无到期日的登记会常态化
 * (实测 20/53 声明处于漂移/从未抓到)。到期后报告与 --strict 通过行会标注
 * `复检已过期`, 提醒决定: 修 URL / 删镜像 / 续期。判定逻辑不变 (到期不判红,
 * 只提醒), 故不改变任何现有门禁语义。
 * 2026-09-18: 随上面两张表一并清空 (无登记条目即无复检日期)。机制保留 —— 将来确有
 * 需接受的漂移时, 三张表必须**同时**登记 (成因 + 复检日期), 否则复检提醒会静默失效。
 */
export const ACCEPTED_REVIEW_BY = new Map([]);


/**
 * 登记条目的复检标注: 未到期 ` (复检 YYYY-MM-DD)`, 过期 ` ⚠️ 复检已过期 YYYY-MM-DD`。
 *
 * 第三个参数是**可注入的登记表**, 默认用生产表 `ACCEPTED_REVIEW_BY`。
 * 2026-09-18 优化审计: 原先用例直接拿生产登记条目 (`iringo/iRingo.News.plugin`) 断言,
 * 于是清空登记表 (本条目的正确归宿) 会让用例转红 —— 测试与生产数据耦合。现由用例注入夹具表。
 */
export function reviewNote(dest, today = new Date().toISOString().slice(0, 10), table = ACCEPTED_REVIEW_BY) {
  const by = table.get(dest);
  if (!by) return "";
  return today > by ? ` ⚠️ 复检已过期 ${by}` : ` (复检 ${by})`;
}

/**
 * 解析 workflow 中的 mirror() 调用 → Map(dest → url)。
 *
 * 2026-09-11 深度审计 NEW-10: 旧实现只匹配"URL 与 dest 相邻两行"的写法, 对
 * `for n in Advertising … Global; do mirror "…/Loon/$n/$n.list" "rules/loon-$n.list" …; done`
 * 完全失明 — 它把 `rules/loon-$n.list` 当成一个字面 dest, 于是 6 个真实条目同时被报成
 * "孤儿保留"(MANIFEST 有而"workflow 不再声明") 与"从未抓到"(幻影条目)。先展开循环再解析。
 */
export function parseDeclarations(wfTxt) {
  const declared = new Map();
  const MIRROR_RE = /mirror\s+"([^"]+)"\s+\\?\s*\n?\s*"([^"]+)"/g;

  // ① 展开 `for VAR in V1 V2 …; do … done` (单层; 本仓库仅一处, 位于规则列表段)
  //    注意 `done` 前有缩进 — 必须 `\n\s*done` 而非 `\ndone` (后者永不匹配, 静默退回旧行为)
  let rest = wfTxt;
  const LOOP_RE = /for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([^;]+);\s*do\b([\s\S]*?)\n\s*done\b/g;
  rest = rest.replace(LOOP_RE, (_all, varName, vals, body) => {
    for (const v of vals.trim().split(/\s+/).filter(Boolean)) {
      // 同时支持 `$n` 与 `${n}` 两种写法
      const expanded = body
        .replace(new RegExp(`\\$\\{${varName}\\}`, "g"), v)
        .replace(new RegExp(`\\$${varName}\\b`, "g"), v);
      for (const m of expanded.matchAll(MIRROR_RE)) declared.set(m[2], m[1]);
    }
    return ""; // 原循环体不再参与 ② (避免重复/幻影 dest)
  });

  // ② 解析循环外的普通 mirror() 调用
  for (const m of rest.matchAll(MIRROR_RE)) declared.set(m[2], m[1]);

  return declared;
}

/** MANIFEST → Map(dest → source_url) */
export function collectRecorded(manifest) {
  const recorded = new Map();
  for (const [k, v] of Object.entries(manifest.files || {})) {
    if (v && v.source_url) recorded.set(k, v.source_url);
  }
  return recorded;
}

/**
 * 三类差异:
 *   drift   — 声明 URL ≠ 记录 URL (keep_old 残留)
 *   missing — 声明有但清单无 (从未抓到 / 镜像 PR 未合并)
 *   orphan  — 清单有但 workflow 不再声明 (孤儿保留)
 */
export function diffDeclarations(declared, recorded) {
  const drift = [];
  const missing = [];
  const orphan = [];
  for (const [dest, url] of declared) {
    const actual = recorded.get(dest);
    if (!actual) { missing.push({ dest, url }); continue; }
    if (url !== actual) drift.push({ dest, declared: url, recorded: actual });
  }
  for (const dest of recorded.keys()) {
    if (!declared.has(dest)) orphan.push({ dest, url: recorded.get(dest) });
  }
  return { drift, missing, orphan };
}

export function run(root = ROOT, { strict = false, quiet = false } = {}) {
  const wfTxt = fs.readFileSync(path.join(root, ".github/workflows/mirror-scripts.yml"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "Mirror/MANIFEST.json"), "utf8"));

  const declared = parseDeclarations(wfTxt);
  const recorded = collectRecorded(manifest);
  const { drift, missing, orphan } = diffDeclarations(declared, recorded);

  if (!quiet) {
    for (const d of drift) {
      console.log(`[URL漂移] ${d.dest}${ACCEPTED_DRIFT.has(d.dest) ? " (已登记)" + reviewNote(d.dest) : " ⚠️ 未登记"}`);
      console.log(`  声明: ${d.declared}`);
      console.log(`  记录: ${d.recorded}`);
    }
    for (const o of orphan) console.log(`[孤儿保留] ${o.dest} (workflow 不再声明)`);
    if (missing.length) {
      console.log(`\n[从未抓到] ${missing.length} 条 (声明存在但清单无记录 — 可能永久失败, 或镜像 PR 尚未合并):`);
      for (const m of missing) console.log(`  ${m.dest} → ${m.url}${ACCEPTED_MISSING.has(m.dest) ? " (已登记)" + reviewNote(m.dest) : " ⚠️ 未登记"}`);
    }
    console.log(`\n══ 镜像漂移摘要 ══`);
    console.log(`  workflow 声明: ${declared.size} 条`);
    console.log(`  MANIFEST 记录: ${recorded.size} 条`);
    console.log(`  一致:          ${declared.size - drift.length - missing.length} 条`);
    console.log(`  URL 漂移:      ${drift.length} 条 (keep_old 保留旧版)`);
    console.log(`  从未抓到:      ${missing.length} 条`);
    console.log(`  孤儿保留:      ${orphan.length} 条 (设计意图: 防清单漏项静默删仓库文件)`);
  }

  if (!strict) {
    console.log(`✅ 镜像漂移检测 (报告模式): 漂移 ${drift.length} / 从未抓到 ${missing.length} / 孤儿 ${orphan.length}`);
    return 0;
  }

  const badDrift = drift.filter((d) => !ACCEPTED_DRIFT.has(d.dest));
  const badMissing = missing.filter((m) => !ACCEPTED_MISSING.has(m.dest));
  if (badDrift.length || badMissing.length) {
    console.log(`✗ 镜像漂移门禁: ${badDrift.length} 条未登记漂移 + ${badMissing.length} 条未登记从未抓到`);
    if (!quiet) {
      for (const d of badDrift) console.log(`  [新漂移] ${d.dest}: 声明 ${d.declared} ≠ 记录 ${d.recorded}`);
      for (const m of badMissing) console.log(`  [新从未抓到] ${m.dest} → ${m.url}`);
      console.log("  处置: 修正 workflow URL, 或确认可接受后登记进 tools/mirror-drift-check.mjs 的 ACCEPTED_* 表");
    }
    return 1;
  }
  console.log(`✅ 镜像漂移门禁通过: 漂移 ${drift.length} 条 + 从未抓到 ${missing.length} 条均已登记 (孤儿 ${orphan.length} 条不参与判定)`);
  const overdue = [...drift, ...missing].filter((d) => reviewNote(d.dest).includes("已过期"));
  if (overdue.length && !quiet) {
    console.log(`⚠️ 其中 ${overdue.length} 条登记已过复检日期 (修 URL / 删镜像 / 续期三选一):`);
    for (const d of overdue) console.log(`  ${d.dest}${reviewNote(d.dest)}`);
  }
  return 0;
}

const isEntryPoint = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  process.exit(run(ROOT, { strict: process.argv.includes("--strict"), quiet: process.argv.includes("--quiet") }));
}
