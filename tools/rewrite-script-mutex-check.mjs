#!/usr/bin/env node
/**
 * rewrite × script 互斥门禁 (2026-09-30)。
 *
 * 依据官方《Script 新语法》"Rewrite 与 Script" 节 (nsloon.app/docs/Script/script_v2):
 *   · Request Body Rewrite / Request Body Mock 命中 → Request Script 不执行
 *   · Response Body Rewrite 命中 → Response Script 不执行
 *   · Request 阶段产生终止响应 → Request / Response Script 均不执行
 * 即: 同文件同侧的 body 类/终止性复写会**静默吞掉**同 URL 的脚本 —— 这是加
 * "一条 reject_dict 图省事"就能造成的隐性失效, 现有门禁(redundancy/coverage/orphan)
 * 全都检测不到。
 *
 * 本仓的合法形态是「开关编排」(qidian.plugin 范式): suppressing 复写逐条带
 * ${CAPTURE_ENABLE} == true 条件, 同侧脚本不带 —— 开=复写接管, 关=脚本净化,
 * 行为互斥且可预期。本门禁把该纪律固化为两条确定性规则:
 *   R1 (判红) 同文件同侧存在脚本, 却出现**无条件**(无开关条件/enable)的 suppressing 复写。
 *   R2 (判红) suppressing 复写与同侧脚本**共用同一开关**且 URL 模式严格前缀/相同
 *             (两开关同开时脚本必死)。
 *
 * 诚实边界: 任意两条正则是否命中同一 URL 不可静态判定。非前缀重叠的疑似冲突
 * 由 LOON-FEATURES.md §2 的「开关编排」纪律人工自查, 本门禁只保证上述两类确定性冲突。
 *
 * 用法: node tools/rewrite-script-mutex-check.mjs
 * 接线: npm test (test/cases/rewrite-script-mutex.test.js) — 归测试层, 与 wiring-check 同区。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseRuleLine } from "./rewrite-redundancy-check.mjs";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** 旧语法响应侧动作前缀 (仅用于判 side; response-header 类不是 suppressor) */
const OLD_RESPONSE_SIDE = /^(response-body-|response-header-|mock-response-body)/;
/** 旧语法 body 类 suppressor (官方互斥条文点名的 Body Rewrite / Body Mock) */
const OLD_BODY_SUPPRESSOR = /^((?:request|response)-body-|mock-(?:request|response)-body)/;
/** 旧语法请求侧终止性动作 (reject 家族 / 重定向) */
const OLD_REQUEST_TERMINAL = /^(reject|reject-200|reject-img|reject-dict|reject-array|302|307)$/;

/**
 * 抽取 v2 行的条件段 (if 与 then 之间)。旧语法返回 ""。
 */
export function v2Condition(line) {
  const m = line.match(/^\s*(?:request|response)\s+if\s+(.+?)\s+then\s+/);
  return m ? m[1] : "";
}

/**
 * 分类一条 [Rewrite] 行。返回 null 表示与互斥无关 (注释/解析失败/header 类等)。
 * 返回 { side, regex, action, gated, switches, kills, v2 }:
 *   side     — 该行作用的阶段 (request|response)
 *   kills    — 会被官方互斥语义吞掉的脚本侧数组 (["request"]/["response"]/两者)
 *   gated    — 是否带开关编排 (v2: 条件含参数比较; 旧: enable={X})
 *   switches — 编排用的参数名 (开关节 KEY)
 */
export function classifyRewriteLine(line) {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  const rule = parseRuleLine(t);
  if (!rule || !rule.regex || !rule.action) return null;
  const v2 = /^\s*(request|response)\s+if\s+/.test(t);
  const a = rule.action;
  let side;
  let gated = false;
  let switches = [];
  let kills = [];
  if (v2) {
    side = t.match(/^\s*(request|response)\s+if\s+/)[1];
    // 开关判定看条件段里对参数的比较 (排除 ${url} 本身)。
    const cond = v2Condition(t).replace(/\$\{url\}\s*~=\s*\/(?:[^/\\]|\\.)*\/[a-z]*/g, "");
    for (const m of cond.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}\s*(?:==|~=)/g)) {
      gated = true;
      switches.push(m[1]);
    }
    if (/^(request|response)\.(body|json)\./.test(a)) {
      // body 正则替换 / mock / JSON 改写都改脚本要消费的 body → 按官方同名旧语法族归类为 body 类。
      // 官方互斥条文未逐字点名 JSON 族, 从严处理 (误报方向安全: 要求编排)。
      kills = [side];
    } else if (/^reject/.test(a) || /^redirect\(/.test(a)) {
      // 终止性响应: request 阶段两侧脚本全灭 (官方明文); response 阶段吞 response 脚本。
      kills = side === "request" ? ["request", "response"] : ["response"];
    }
  } else {
    side = OLD_RESPONSE_SIDE.test(a) ? "response" : "request";
    const en = (rule.rest || "").match(/enable\s*=\s*\{([^}]+)\}/);
    if (en) {
      gated = true;
      switches.push(...en[1].split(",").map((s) => s.trim()).filter(Boolean));
    }
    if (OLD_BODY_SUPPRESSOR.test(a)) {
      kills = [side];
    } else if (OLD_REQUEST_TERMINAL.test(a)) {
      kills = ["request", "response"];
    }
  }
  if (!kills.length) return null;
  return { side, regex: rule.regex, action: a, gated, switches, kills, v2 };
}

/**
 * 分类一条 [Script] 行。返回 null 表示与互斥无关 (注释/cron/network-changed/generic)。
 * 返回 { side, regex, switches, v2 }。
 */
export function classifyScriptLine(line) {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  const old = t.match(/^(http-request|http-response)\s+(\S+)\s+/);
  if (old) {
    const switches = [...t.matchAll(/(?:^|[\s,])enable\s*=\s*\{([^}]+)\}/g)]
      .flatMap((m) => m[1].split(",").map((s) => s.trim()).filter(Boolean));
    return {
      side: old[1] === "http-request" ? "request" : "response",
      regex: old[2],
      switches,
      v2: false,
    };
  }
  const v2 = t.match(/^\s*(request|response)\s+if\s+(.+?)\s+then\s+script\(/);
  if (v2) {
    const cond = v2[2];
    const um = cond.match(/\$\{url\}\s*~=\s*\/((?:[^/\\]|\\.)*)\/[a-z]*/);
    const switches = [...cond.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}\s*(?:==|~=)/g)]
      .map((m) => m[1])
      .filter((n) => n !== "url");
    const en = t.match(/enable=\$\{([A-Za-z_][A-Za-z0-9_]*)\}/);
    if (en) switches.push(en[1]);
    return { side: v2[1], regex: um ? um[1] : null, switches, v2: true };
  }
  return null;
}

/** 严格前缀/相同判定 (剥行首 ^; 与 rewrite-redundancy 的遮蔽判定同口径) */
export function prefixRelated(a, b) {
  if (!a || !b) return false;
  const x = String(a).replace(/^\^/, "");
  const y = String(b).replace(/^\^/, "");
  return x === y || x.startsWith(y) || y.startsWith(x);
}

/** R1+R2 判定。surfaces: [{file, text}] → { fails: [{file, rule, detail}], rows } */
export function checkMutex(surfaces) {
  const fails = [];
  const rows = [];
  for (const { file, text } of surfaces) {
    const scripts = [];
    const rewrites = [];
    let sec = null;
    for (const l of text.split("\n")) {
      const t = l.trim();
      if (/^\[[A-Za-z ]+\]$/.test(t)) {
        sec = t;
        continue;
      }
      if (sec === "[Script]") {
        const s = classifyScriptLine(t);
        if (s) scripts.push(s);
      } else if (sec === "[Rewrite]") {
        const r = classifyRewriteLine(t);
        if (r) rewrites.push(r);
      }
    }
    rows.push({ file, scripts: scripts.length, rewrites: rewrites.length });
    // R1: 无条件 suppressing 复写 × 同侧脚本 → 静默吞脚本
    for (const r of rewrites) {
      if (r.gated) continue;
      if (scripts.some((s) => r.kills.includes(s.side))) {
        fails.push({
          file,
          rule: "R1",
          detail: `无条件 suppressing 复写 (${r.action}) 与同侧脚本共存 — 官方互斥语义下脚本被静默吞掉; 须按 qidian 范式加开关条件编排`,
        });
      }
    }
    // R2: 同开关共激活 + URL 模式前缀重叠 → 开关打开时脚本必死
    for (const r of rewrites) {
      if (!r.gated) continue;
      for (const s of scripts) {
        if (!r.kills.includes(s.side)) continue;
        const shared = r.switches.filter((x) => s.switches.includes(x));
        if (shared.length && prefixRelated(r.regex, s.regex)) {
          fails.push({
            file,
            rule: "R2",
            detail: `复写与脚本共用开关 [${shared.join(",")}] 且 URL 模式前缀重叠 (${r.action}) — 同开时脚本必死`,
          });
        }
      }
    }
  }
  return { fails, rows };
}

/** 读 template/loon.tpl + Plugin/*.plugin 组装 surfaces 并判定 */
export function analyze(root = ROOT) {
  const surfaces = [
    { file: "template/loon.tpl", text: fs.readFileSync(path.join(root, "template", "loon.tpl"), "utf8") },
  ];
  const pdir = path.join(root, "Plugin");
  for (const f of fs.readdirSync(pdir).filter((x) => x.endsWith(".plugin")).sort()) {
    surfaces.push({ file: `Plugin/${f}`, text: fs.readFileSync(path.join(pdir, f), "utf8") });
  }
  return checkMutex(surfaces);
}

const isMain = () => process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain()) {
  const { fails, rows } = analyze();
  for (const r of rows) {
    console.log(`${r.scripts || r.rewrites ? "•" : " "} ${r.file}: scripts=${r.scripts} rewrites=${r.rewrites}`);
  }
  if (fails.length) {
    for (const f of fails) console.log(`✗ [${f.rule}] ${f.file}: ${f.detail}`);
    console.log(`✗ 复写×脚本互斥核对失败: ${fails.length} 处`);
    process.exit(1);
  }
  console.log(`✅ 复写×脚本互斥核对通过 (${rows.length} 个配置面)`);
}
