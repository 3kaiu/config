#!/usr/bin/env node
/**
 * 插件语法门禁: 校验 Plugin/ 全部 .plugin 的段结构、规则类型、Rewrite 动作。
 * 合法但易误报的写法已豁免: 捕获组重定向 (^...)(...) 302 $1、request if 条件式、
 * 301/302/307 重定向动作。
 *
 * 用法: node tools/plugin-lint-check.mjs [--quiet]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VALID_SEG = new Set(["Rule", "Rewrite", "MitM", "Script", "Argument", "Host", "General"]);
// 官方《插件》页的 #! 字段表 (2026-09-30 逐字核对 https://nsloon.app/docs/Plugin/)。表外字段判红 ——
// 补的是"AGENTS.md 声称『插件元数据只用官方 #! 集合』, 却**没有任何门禁在查**"的假门禁:
// 2026-09-30 实测 `jd.plugin`/`qidian.plugin` 用了社区习惯的 `#!version`(官方未收录)而无人发现。
// `#!icon` 在表内但本仓不用(第三方图标服务 32/45 已 404, 见 external-deps 用例)。
const META_KEYS = new Set([
  "name", "desc", "author", "homepage", "icon",
  "system", "system_version", "loon_version", "tag", "type",
]);
// 名字里嵌数量(域/条/平台/通道)必然漂移 —— 实测 ad-block 的 `#!name` 写着"7 平台 59 域"时,
// 文件里已是 967 条规则(生成式覆盖 + 社区复核收录后没人回头改名字)。数量属于 desc/注释/清单。
const COUNT_IN_NAME = /\d+\s*个?\s*(域|条|平台|通道)/;
const ACTION_OK =
  /reject|reject-dict|reject-array|reject-img|reject-video|reject-200|reject-403|reject-drop|reject-empty|response-body|mock-response-body|redirect|header-|script-path|request-body|url-remove|exception|direct|proxy|302|307|301|\d{3}|enable=\{/i;
// 可疑的 Rewrite 第二 token — 官方动作表无此 token:
//   `http-response <regex> url reject-200` / `list reject-200` —
//   [Script] 行必须带 script-path=，[Rewrite] 动作位无 url/list。
//   `splash-reject` / `screen-reject` 同理。
//   大写 REJECT 在裸 `reject` 动作外另计 (Loon 动作大小写敏感存疑, 统一小写)。
// 先报告不判红: 真机确认逐条语义后, 批量搬 [Rewrite] 段标准形。
const SUSPICIOUS_ACTION =
  /\^[^ ]+ +(url|list) +(reject(-dict|-array|-img|-video|-200|-drop)?|302|307)\b|\^[^ ]+ +(splash-reject|screen-reject)\b/;
const RULE_PREFIX =
  /^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|URL-REGEX|IP-CIDR|IP-CIDR6|AND|DEST-PORT|SOURCE-IP|PROTOCOL|USER-AGENT|NETWORK|GEOIP|IN-PORT|NO-\w)/;

const quiet = process.argv.includes("--quiet");

/**
 * 单插件文本检查 — 纯函数 (无 I/O、无全局态), 供 CLI 与 test/cases/plugin-lint.test.js 复用。
 * @returns {{ errs: string[], reports: string[] }} errs 判红; reports 仅报告 (不判红)
 */
export function lintText(txt, { dir = "Plugin", file = "x.plugin" } = {}) {
  const errs = [];
  const reports = [];
  const lines = txt.split("\n");
  let seg = null;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const sm = t.match(/^\[([A-Za-z ]+)\]$/);
    if (sm) {
      seg = sm[1];
      if (!VALID_SEG.has(sm[1])) errs.push(`[段错] ${dir}/${file}:${i + 1} [${sm[1]}]`);
      continue;
    }
    // `#!` 元数据: 必须在"跳过注释"之前判, 否则整行被当注释吞掉(原实现即如此)
    if (t.startsWith("#!")) {
      const km = /^#!\s*([A-Za-z_][\w-]*)\s*=?/.exec(t);
      const key = km ? km[1] : "";
      if (!META_KEYS.has(key)) {
        errs.push(`[元数据] ${dir}/${file}:${i + 1} 非官方 #! 字段 "${key}" —— 官方表: ${[...META_KEYS].join(" ")}`);
      } else if (key === "name" && COUNT_IN_NAME.test(t)) {
        errs.push(`[元数据] ${dir}/${file}:${i + 1} #!name 里嵌了数量(会漂移): ${t.slice(0, 60)} —— 数量属 desc/注释/清单`);
      }
      continue;
    }
    if (!seg || !t || t.startsWith("#") || t.startsWith("!")) continue;
    if (seg === "Rewrite") {
      if (t.startsWith("(") && /\)\s+(302|307|301)/.test(t)) continue; // 捕获组重定向
      const ok = /^(\^|http-request |http-response |request |response |script )/.test(t) || t.startsWith("(");
      if (!ok) {
        errs.push(`[Rewrite格式] ${dir}/${file}:${i + 1} → ${t.slice(0, 60)}`);
      } else if (/^(\^|http-)/.test(t) && !ACTION_OK.test(t)) {
        errs.push(`[Rewrite动作] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
      }
      if (SUSPICIOUS_ACTION.test(t)) reports.push(`[Rewrite动作可疑] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
      // 裸 reject 分拣 — 2026-09-19 官方文档对齐 (docs/Policy/ + docs/Rewrite/):
      // 裸 `reject` = 直接断开连接; 有 UI 等待的接口会转圈/重试, 应改 reject-dict/200。
      // 确认无重试的纯埋点在行尾加 `# no-retry` 豁免。
      // 报告级 (不判红): 存量逐条需真机确认, 先报告清单; 新出现的行由本报告 + 用例兜底。
      if (/(^|\s)reject([, ]|$)/.test(t) && !/#\s*no-retry/.test(t)) {
        reports.push(`[裸reject待确认] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
      }
    }
    // [Script]/[Rewrite] 跨段复核 — 2026-09-19 官方文档对齐 (docs/Script/ + docs/Rewrite/):
    // Loon 3.5.1 新语法下 `[Script]` 段的 `http-response <regex> reject-dict` 是合法形态
    // (脚本触发器位复用 Rewrite 动作, 无 script-path 即纯拒绝)。旧认知"必须带 script-path"
    // 已证伪 — 全仓大量行皆此形态, 上游同构。故本检查只抓真正的段外行:
    // 非 cron / 非 http-request / 非 http-response / 非 generic (手动触发) 出现在 [Script] 段。
    // (generic 见 docs/Script/: "在 App 中手动触发" — 如 Plugin/diagnostics.plugin。)
    if (seg === "Script" && !/^(http-request|http-response|cron|generic)\b/.test(t)) {
      errs.push(`[Script段外行] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
    }
    // enable={X}&{Y} 大括号配对(导入损坏形态: enable={X&{Y}})
    if (/enable=\{[^}&\s]*&\{[^}]*\}\}/.test(t)) {
      errs.push(`[enable括号] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
    }
    // [Argument] 参数名以数字开头 — 解析器兼容性风险 (MOD-07)
    if (seg === "Argument" && /^\d/.test(t)) {
      errs.push(`[Argument数字开头] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
    }
    // [MitM] hostname 行内混入字面量 hostname=(多行拼接污染)
    if (seg === "MitM" && /(^|\s)%APPEND%\s*hostname=|,\s*hostname=/.test(t)) {
      errs.push(`[MitM拼接] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
    }
    if (seg === "Rule") {
      if (!RULE_PREFIX.test(t)) {
        errs.push(`[Rule错] ${dir}/${file}:${i + 1} → ${t.slice(0, 60)}`);
      }
      // REJECT 动作分级 — 2026-09-19 官方文档对齐 (docs/Policy/: REJECT=404空体,
      // REJECT-DROP=直接丢弃无响应, App 会立即重试, 请求风暴时慎用):
      // 本仓 [Rule]/插件 [Rule] 段不得用 DROP (上报域用 REJECT 同样不展示且不制造重试)。
      if (/,\s*REJECT-DROP\b/.test(t)) {
        errs.push(`[DROP禁用于Rule] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
      }
      // KEYWORD 门控 — 2026-09-19 官方文档对齐 (docs/Rule/sub_rule: KEYWORD 随数量涨耗时):
      // 裸 DOMAIN-KEYWORD 必须被 AND(SUFFIX,…)/AND(USER-AGENT,…) 锚定 (bilibili-pro:81 /
      // qidian:71-73 双样板); ai.plugin 的 `{AI_Policy}` 占位策略行豁免 (分流非拦截)。
      // 上游外壳豁免 — 本地门禁只约束 Plugin/ 自维护插件。
      if (dir === "Plugin" && /^DOMAIN-KEYWORD,/.test(t) && !/, *\{[A-Za-z0-9_]+\}\s*$/.test(t)) {
        errs.push(`[KEYWORD裸奔] ${dir}/${file}:${i + 1} → ${t.slice(0, 80)}`);
      }
    }
  }
  // ── 跨层矛盾扫描 (2026-09-29, 见 APP-ONBOARDING.md 第 6 节) ──
  // 只报告不判红: 这类冲突往往源于用户的**主动权衡**(如"开屏必除, 接受秒播失效"),
  // 擅自判红等于推翻决策。门禁的职责是把它们**显式化**, 而不是替用户选边。
  {
    // ⚠️ 段定位必须**行首锚定**: `txt.indexOf("[MitM]")` 会命中 [Script] 段注释里
    // 提到的 "[MitM]" 字样(本插件就有一处), 导致取到错误的段、hostname 正则不匹配,
    // 检查静默失效 —— 又一个"看起来有门禁其实没有"的形态。
    const sec = (name) => {
      const re = new RegExp(`^\\[${name}\\]\\s*$`, "m");
      const m0 = txt.match(re);
      if (!m0) return "";
      const i = m0.index + m0[0].length;
      return txt.slice(i).replace(/^\n/, "").split(/^\[[A-Za-z ]+\]\s*$/m)[0];
    };
    // ① 插件 [Rule] 的 DIRECT 白名单, 若被主配置 [Rule] 的 REJECT 覆盖 → 空转
    const tplPath = path.join(ROOT, "template", "loon.tpl");
    if (fs.existsSync(tplPath) && dir === "Plugin") {
      const tpl = fs.readFileSync(tplPath, "utf8");
      const rs = tpl.slice(tpl.indexOf("[Rule]"), tpl.indexOf("[Remote Rule]"));
      const rej = [];
      for (const l of rs.split("\n")) {
        const t = l.trim();
        if (!t || t.startsWith("#")) continue;
        const f = t.split(",").map((x) => x.trim());
        if (f.length >= 3 && /^REJECT/.test(f[2])) rej.push([f[0], f[1]]);
      }
      const covered = (d) => {
        for (const [k, v] of rej) {
          if (k === "DOMAIN" && v === d) return true;
          // DOMAIN-SUFFIX 只覆盖完全相同的后缀或真子域 —— .com1 是独立域, 不被 .com 覆盖
          if (k === "DOMAIN-SUFFIX" && (v === d || d.endsWith("." + v))) return true;
        }
        return false;
      };
      for (const l of sec("Rule").split("\n")) {
        const t = l.trim();
        if (!t || t.startsWith("#")) continue;
        const f = t.split(",").map((x) => x.trim());
        if (f.length < 3 || f[2] !== "DIRECT") continue;
        if (covered(f[1]))
          reports.push(
            `[跨层空转] ${dir}/${file}: ${f[0]}, ${f[1]}, DIRECT 被主配置 [Rule] 的 REJECT 覆盖` +
              `(本地配置 > 插件, 官方《规则系统 3.1》第 4 条) —— 该条永不生效。` +
              `若是有意为之请在注释登记矛盾; 若是无意请删除`
          );
      }
    }
    // ② 插件 [MitM] 正条目, 若被主配置 REJECT 覆盖 → 解密面无消费
    //    (domain-reject-mode=DNS 时域在 DNS 阶段即被拒, 到不了解密层)
    const m = sec("MitM").match(/^hostname\s*=\s*(.*)$/m);
    if (m && dir === "Plugin") {
      const tplPath = path.join(ROOT, "template", "loon.tpl");
      if (fs.existsSync(tplPath)) {
        const tpl = fs.readFileSync(tplPath, "utf8");
        const rs = tpl.slice(tpl.indexOf("[Rule]"), tpl.indexOf("[Remote Rule]"));
        const rej = [];
        for (const l of rs.split("\n")) {
          const t = l.trim();
          if (!t || t.startsWith("#")) continue;
          const f = t.split(",").map((x) => x.trim());
          if (f.length >= 3 && /^REJECT/.test(f[2])) rej.push([f[0], f[1]]);
        }
        const covered = (d) =>
          rej.some(([k, v]) => (k === "DOMAIN" && v === d) || (k === "DOMAIN-SUFFIX" && (v === d || d.endsWith("." + v))));
        for (const h0 of m[1].split(",")) {
          const h = h0.trim().replace(/^%APPEND%\s*,?\s*/, "");
          if (!h || h.startsWith("-") || h.startsWith("%")) continue;
          if (covered(h))
            reports.push(
              `[解密面无消费] ${dir}/${file}: ${h} 在主配置被 REJECT; domain-reject-mode=DNS 下` +
                `该域在 DNS 阶段即被拒, 到不了解密层 —— 应从 [MitM] 移除`
            );
        }
      }
    }
  }
  return { errs, reports };
}

/** 扫描 Plugin/ 全部外壳。@returns {{ errs, reports, files }} */
export function scanAll(dirs = ["Plugin"]) {
  const errs = [];
  const reports = [];
  let files = 0;
  for (const dir of dirs) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith(".plugin"))) {
      files++;
      const r = lintText(fs.readFileSync(path.join(ROOT, dir, f), "utf8"), { dir, file: f });
      errs.push(...r.errs);
      reports.push(...r.reports);
    }
  }
  return { errs, reports, files };
}

export function main() {
  const { errs, reports, files } = scanAll();
  if (!quiet) for (const r of reports) console.log(r);
  if (errs.length) {
    for (const e of errs) console.log(e);
    console.log(`✗ 插件语法门禁失败: ${errs.length} 个问题 (扫描 ${files} 个插件)`);
    process.exit(1);
  }
  console.log(`✅ 插件语法门禁通过: ${files} 个插件段结构与规则语法正常`);
}

/** 入口守卫: 顶层仅在被直接执行时跑 main (测试可安全 import) */
function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
if (isMain()) main();
