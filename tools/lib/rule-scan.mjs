/**
 * 规则扫描原语 (2026-09-29)
 *
 * 性质: **技术原语**, 无业务决策 —— 与 test/lib/ 下的台账/判据分开, 因为
 * tools/ 下的门禁与 test/ 下的用例都要用它, 而 tools/ 不应反向依赖 test/。
 *
 * 两个原语:
 *   collectRules()  取 主配置 [Rule] + 所有插件 [Rule] 段里的规则行
 *   ruleHits()      判断一条规则是否命中某个域 (含 Loon 的三种域匹配语义)
 *
 * ⚠️ 段定位一律用**逐行状态机**: 不要用 `^\[Rule\]\n([\s\S]*?)(?=^\[)` 这类"到下一个
 * 段落"的正则 —— 插件里 [Rule] 常是最后一段, 前瞻找不到下一个 `[` 就整体不匹配,
 * 扫描面恒为 0 而门禁静默失效 (doc-claims-check 首版即踩过此坑)。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

/** @returns {{source:string,line:number,text:string}[]} */
export function collectRules(root = ROOT) {
  const out = [];
  const scan = (file, label) => {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    let sec = null;
    lines.forEach((l, i) => {
      const t = l.trim();
      if (/^\[[A-Za-z ]+\]$/.test(t)) { sec = t; return; }
      if (sec === "[Rule]" && t && !t.startsWith("#")) out.push({ source: label, line: i + 1, text: t });
    });
  };
  scan(path.join(root, "Profile", "Loon.lcf"), "Profile/Loon.lcf");
  const dir = path.join(root, "Plugin");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".plugin")).sort()) {
    scan(path.join(dir, f), `Plugin/${f}`);
  }
  return out;
}

/** 从规则行里取 (类型, 域值); 非域名类规则返回 null */
export function ruleDomain(ruleText) {
  const m = ruleText.match(/^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD)\s*,\s*([^,]+?)\s*,\s*\S+/i);
  return m ? { type: m[1].toUpperCase(), value: m[2].trim().toLowerCase() } : null;
}

/**
 * 规则行是否命中 domain。
 * scope="whole": 命中裸域**或任一子域**都算
 * scope="apex" : 只算**裸域**被罩住
 * @returns 命中的规则类型, 未命中返回 null
 */
export function ruleHits(ruleText, domain, scope) {
  const r = ruleDomain(ruleText);
  if (!r) return null;
  const { type, value: v } = r;
  const d = domain.toLowerCase();
  if (type === "DOMAIN-KEYWORD") return v.includes(d) ? type : null;
  const inSubtree = v === d || v.endsWith(`.${d}`); // 规则值落在 d 的子树内
  const coversApex = v === d || (type === "DOMAIN-SUFFIX" && d.endsWith(`.${v}`)); // 裸域本身被罩
  if (scope === "apex") return coversApex ? type : null;
  return inSubtree || coversApex ? type : null;
}
