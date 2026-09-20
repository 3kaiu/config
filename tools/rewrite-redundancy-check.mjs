#!/usr/bin/env node
/**
 * Rewrite 规则冗余检查 (2026-09-20 精简优化新增)
 *
 * 前线攻克: 本轮把三处同文件"前缀遮蔽"死规则清除 (keep-pro hotwords、
 * news-purify eapi/ad\/) + 生成器加前缀剪枝 (startup getAdInfos) + 跨插件精确重复
 * fcbox dsp 去重 — 删干净后, 本门禁接管该空间, 防上游/手改重新引入。
 *
 * Loon rewrite 规则的匹配语义 = `^` 锚定的 URL **前缀**匹配 (无 `$` 时整段是字面前缀,
 * 有 `$` 才是整串锚定)。于是判别可完全在**源字符串**层完成, 不需要解析正则:
 *   同一插件内, 若第 i 条规则的 regex 是第 j 条 (i<j) regex 的**严格字面前缀**,
 *   且**作用完全相同** (action 与 enable 等其余参数逐字一致), 则 j 永远命中不了
 *   —— i 已先把 j 能匹配的每一个 URL 抢先消费掉。j 即死规则。
 * 注意只按"字符串前缀"判: 字符类/转义在两条规则源文本里就是同形字符, 前缀成立
 * 依赖的是"同形"而非正则语义; A 若以 `$` 收尾则扮演不了前缀 (锚定了整串), 天然不成立。
 *
 * 镜像文件 (Mirror/**) 的同类冗余**只报告不修改** —— 镜像由 mirror-scripts 每日重写,
 * 手改即漂移; 非源头文件按"登记接受"处理 (须写实测成因+复检日期, 同 check:shadow 纪律)。
 *
 * 两项检查:
 *   1. [同文件前缀遮蔽] 逐插件扫描 [Rewrite] 行, 报告 A⊇B 且 B 不可达的对。
 *      B 已登记接受 (ACCEPTED_PAIRS) 或 B 属于生成块且其遮蔽方也同为生成块 → 通过,
 *      否则判红。
 *   2. [跨文件精确重复] 非镜像文件 (Plugin//Kelee//Profile/) 间 regex+action+rest
 *      逐字相同的规则。镜像与自维护文件的重复是"上游各自维护同名过滤"的常态
 *      (如 AllInOne 与 Plugin/ 共享大量域), 不作为缺陷; 自维护文件之间的精确重复
 *      才是本轮清理 (fcbox dsp) 的对象, 判红。
 *
 * 用法: node tools/rewrite-redundancy-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 已知且接受的 **(文件|被遮蔽 REJECT 规则) 镜像对** (2026-09-20 新增)。
 *
 * 全部来自 Mirror/rules/loon-AllInOne.plugin —— 上游自身同文件重复 (更宽的
 * 前缀规则先出现, 子规则永远不可达)。镜像不手改 (mirror-scripts 每日重写, 手改漂移),
 * 故登记接受; 上游下次刷新即自然消解或继续如此, 由复检日期滚动复核。
 */
export const ACCEPTED_PAIRS = new Map([
  [
    "Mirror/rules/loon-AllInOne.plugin|^https?:\\/\\/ad\\.mcloud\\.139\\.com\\/advertapi\\/adv-filter\\/adv-filter\\/AdInfoFilter\\/getAdInfos$",
    {
      reason: "镜像侧上游自重复: 同文件更早的 `advertapi` (reject-200) 已罩住其尾部 getAdInfos 子条。同对已在本仓库生成器侧剪枝 (startup-adblock-pro), 镜像无法手改, 等待镜像源刷新消解或复核。",
      reviewBy: "2027-03-31 (随 mirror-scripts 刷新复核该对是否仍存在)",
    },
  ],
  [
    "Mirror/rules/loon-AllInOne.plugin|^https?:\\/\\/api\\.gotokeep\\.com\\/ads\\/v\\d\\/ads\\/preload",
    {
      reason: "镜像侧上游自重复: `api.gotokeep.com/ads` (reject) 为 `/ads/v\\d/ads/preload` 等所有 ads 子路径的字符串前缀。keep-pro 本体只保留热词/弹窗等独立路径,认证面不相撞。",
      reviewBy: "2027-03-31 (随上游 gotokeep 规则刷新复核)",
    },
  ],
  [
    "Mirror/rules/loon-AllInOne.plugin|^https?:\\/\\/cdn-evone-ceph\\.echargenet\\.com\\/gw-emas-cdn\\/63c4e3b558bb610008969f89",
    {
      reason: "镜像侧上游自重复: `cdn-evone-ceph.echargenet.com/gw-emas-cdn` 前缀 (reject-200) 罩住指纹路径子条。",
      reviewBy: "2027-03-31 (随上游 echargenet 规则刷新复核)",
    },
  ],
  [
    "Mirror/rules/loon-AllInOne.plugin|^https?:\\/\\/sf3-fe-tos\\.pglstatp-toutiao\\.com\\/obj\\/ad-pattern\\/renderer\\/package\\.json",
    {
      reason: "镜像侧上游自重复: `/obj/ad-pattern/renderer/` 前缀 (reject-200) 罩住 package.json 子条。",
      reviewBy: "2027-03-31 (随上游 pglstatp-toutiao 规则刷新复核)",
    },
  ],
]);

const MIRROR_PREFIX = "Mirror/";

/** 拆一条 Loon rewrite 规则行为 `{regex, action, rest}`; 非规则行返回 null */
export function parseRuleLine(line) {
  const m = line.trim().match(/^(\^\S+)(?:\s+-\s+|\s+)(\S+)(?:\s+(.*))?$/);
  if (!m) return null;
  return { regex: m[1], action: m[2], rest: m[3] || "" };
}

/**
 * 扫描某插件文本的 [Rewrite] 规则行 (带 keepOriginalPos 便于生成块归属判断)。
 * 只收 `^` 起始的行; 跳过 [MitM] 之后的 hostname 行 (非 `^` 起始, 天然排除)。
 */
export function scanRewriteRules(text) {
  const rules = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const p = parseRuleLine(lines[i]);
    if (p) rules.push({ ...p, line: i + 1 });
  }
  return rules;
}

/**
 * 同文件前缀遮蔽: 返回被遮蔽的行条目列表。
 * A 遮蔽 j 条件: sourceIndex 更小、A.regex 是 j.regex 的严格前缀、
 * action 与 rest (enable 等) 逐字一致。
 */
export function findShadowed(rules) {
  const shadowed = [];
  for (let j = 0; j < rules.length; j++) {
    const jj = rules[j];
    for (let i = 0; i < j; i++) {
      const ii = rules[i];
      if (
        ii.action === jj.action &&
        ii.rest === jj.rest &&
        jj.regex.length > ii.regex.length &&
        jj.regex.startsWith(ii.regex)
      ) {
        shadowed.push({ shadowedBy: ii, ...jj });
        break;
      }
    }
  }
  return shadowed;
}

/** 跨文件精确重复: 非镜像文件中 regex+action+rest 完全相同的规则 (>1 个文件即报告) */
export function findExactDuplicates(fileRules) {
  const groups = new Map();
  for (const [file, rules] of fileRules) {
    for (const r of rules) {
      const key = `${r.regex}\x00${r.action}\x00${r.rest}`;
      const g = groups.get(key) || [];
      g.push({ file, line: r.line });
      groups.set(key, g);
    }
  }
  const dups = [];
  for (const [key, occ] of groups) {
    const files = new Set(occ.map((o) => o.file));
    if (files.size > 1) {
      const [regex, action, rest] = key.split("\x00");
      dups.push({ regex, action, rest, occurrences: occ });
    }
  }
  return dups;
}

/** 全局扫描入口 (供测试调用; 渲染报告并返回问题数) */
export function analyze(root = ROOT) {
  const ownFiles = [];
  for (const dir of ["Plugin", "Kelee"]) {
    const p = path.join(root, dir);
    for (const f of fs.readdirSync(p).filter((x) => x.endsWith(".plugin"))) {
      ownFiles.push({ rel: path.join(dir, f), isMirror: false, text: fs.readFileSync(path.join(p, f), "utf8") });
    }
  }
  const pdir = path.join(root, "Mirror", "rules");
  for (const f of fs.readdirSync(pdir).filter((x) => x.endsWith(".plugin"))) {
    ownFiles.push({ rel: path.join("Mirror", "rules", f), isMirror: true, text: fs.readFileSync(path.join(pdir, f), "utf8") });
  }
  const lcf = path.join(root, "Profile", "Loon.lcf");
  if (fs.existsSync(lcf)) ownFiles.push({ rel: "Profile/Loon.lcf", isMirror: false, text: fs.readFileSync(lcf, "utf8") });

  const problems = [];
  const warnings = [];

  console.log("## Rewrite 规则冗余检查 (同文件前缀遮蔽 + 跨文件精确重复)\n");

  // ── 1. 同文件前缀遮蔽 ──
  const pairCounts = new Map();
  for (const f of ownFiles) {
    const rules = scanRewriteRules(f.text);
    const shadowed = findShadowed(rules);
    for (const s of shadowed) {
      const key = `${f.rel}|${s.regex}`;
      const rec = pairCounts.get(key) || { file: f.rel, regex: s.regex, shadowedBy: s.shadowedBy.regex, action: s.action, count: 0, mirror: f.isMirror };
      rec.count++;
      pairCounts.set(key, rec);
    }
  }
  const registered = new Map([...ACCEPTED_PAIRS]);
  if (!pairCounts.size) {
    console.log("✅ 无同文件前缀遮蔽");
  }
  for (const [, rec] of pairCounts) {
    const reg = registered.get(`${rec.file}|${rec.regex}`);
    if (reg) {
      console.log(`⚠️ 已登记接受 ${rec.file} (${rec.count} 条): ${rec.regex} ← 被 ${rec.shadowedBy} 罩住`);
      console.log(`     ${reg.reason}`);
      console.log(`     复检 ${reg.reviewBy}`);
      warnings.push(`${rec.file}: ${rec.regex} (已登记)`);
      continue;
    }
    console.log(`❌ 未登记 ${rec.file} (${rec.count} 条): ${rec.regex} ← 被 ${rec.shadowedBy} 罩住 (action=${rec.action})`);
    problems.push(`${rec.file}: ${rec.regex} 无前缀遮蔽登记`);
  }

  // ── 2. 跨文件精确重复 (非镜像) ──
  const nonMirror = ownFiles.filter((f) => !f.isMirror);
  const dups = findExactDuplicates(nonMirror.map((f) => [f.rel, scanRewriteRules(f.text)]));
  console.log(`\n## 跨文件精确重复 (非镜像 Plugin//Kelee/Profile/, ${dups.length} 组)`);
  if (!dups.length) {
    console.log("✅ 精确重复 0 组");
  }
  for (const d of dups) {
    console.log(`❌ ${d.regex} ${d.action} ${d.rest}`);
    for (const o of d.occurrences) console.log(`     · ${o.file}:${o.line}`);
    problems.push(`${d.regex} 在 ${d.occurrences.map((o) => o.file).join(" 与 ")} 精确重复`);
  }

  if (problems.length) {
    console.log(`\n❌ Rewrite 规则冗余检查失败: ${problems.length} 组冗余未处理`);
    console.log("   修法任选: ① 同文件遮蔽 → 删被遮蔽行 (语义已在更宽的规则里, 行为零变化)");
    console.log("            ② 跨文件精确重复 → 保留一方 (enable 语义相同取其一), 另一方删行");
    console.log("            ③ 确认上游镜像/刻意保留 → 在 tools/rewrite-redundancy-check.mjs 的 ACCEPTED_PAIRS 登记 (须写实测成因+复检日期)");
    return 1;
  }
  console.log(`\n✅ Rewrite 规则冗余检查通过 (${warnings.length} 条登记告警)`);
  return 0;
}

const isEntryPoint = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) process.exitCode = analyze();