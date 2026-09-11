/**
 * 共享工具 — 广告字段判定与递归净化
 *
 * 为什么单独成模块: `isAdKey` / `cleanAdArrays` / `stripKeys` 此前在
 * Kugou / Youku 各有一份**逐字符相同**的副本。三者共同构成"哪些字段算广告"的
 * 唯一判定口径 — 两份副本意味着口径可能各自漂移 (2026-09-11 审计正是因为
 * 子串匹配 `\ad\i` 而误伤 header/loading, 两处都要改)。
 *
 * 分发方式: 经 esbuild `--inject` 注入, 导出名在脚本中直接以全局标识符使用。
 * 见 package.json 的 build 脚本与 AGENTS.md。
 */

/**
 * 标识符 → 词段 (2026-09-11 深度审计 NEW-06 抽出, 供 isAdKey / isSocialAdKey 共用)
 *
 * camelCase → 拆词, snake_case / kebab-case / 点号 → 拆词, 统一小写。
 *   adInbox → ["ad","inbox"]   ad_list → ["ad","list"]   sponsoredContent → ["sponsored","content"]
 */
export function splitKeySegments(k: unknown): string[] {
  return String(k)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")   // camelCase → 词段
    .split(/[^A-Za-z0-9]+/)                    // snake/kebab/点号 → 词段
    .filter(Boolean)
    .map(s => s.toLowerCase());
}

/** 词段级匹配: 任一词段满足 pred 即命中 */
export function hasKeySegment(k: unknown, pred: (seg: string) => boolean): boolean {
  return splitKeySegments(k).some(pred);
}

/**
 * 广告字段名判定 — 按标识符分段整段匹配 (2026-09-11 审计修复)
 *
 * 原实现 `Array.isArray(o[k]) && /ad/i.test(k)` 是**子串**匹配, 任何含 "ad" 子串的
 * 正常字段都会被判为广告并清空为空数组。实证误伤: header (he-ad-er)、loading
 * (lo-ad-ing)、upload、thread、badge、shadow、read、road 等。
 * 审计探针实测 Kugou 响应被改成 {"header":[],"ads":[],"loading":[]} — 正常字段丢失。
 *
 * 现拆分为 snake_case / kebab-case / camelCase 词段后匹配:
 *   ad / ads           → 命中 (整段)
 *   ad_list / adData   → 命中 (camel/snake 拆出 "ad" 段)
 *   advert*            → 命中 (明确词干, 不可能是普通词前缀)
 *   header / loading / address / adaptive / badge → 不再命中
 */
export function isAdKey(k: unknown): boolean {
  return hasKeySegment(k, w => w === "ad" || w === "ads" || w.startsWith("advert"));
}

/**
 * 社交类脚本 (LinkedIn / Twitter) 的广告键判定 — 2026-09-11 深度审计 NEW-06
 *
 * 这两处是 BUG-01/BUG-02 的**漏网同类**: 原实现
 *   `/^(?:ad|sponsor|promot|recommend)/i`   (Twitter 另有 trend)
 * 是**未锚定的前缀**匹配 —— 只约束了开头, 结尾不限, 于是
 *   address / adaptive / admin / advance / additional / adult
 * 全部被判为广告键并**整个删除**。Kugou/Youku/Feishu 已修, 这两处未修。
 *
 * 改为词段级匹配, 并区分两类词干:
 *   - 整段命中 (`ad` / `ads`): 前缀扩展会撞上 address/adaptive, 必须整段相等
 *   - 词干命中 (advert/sponsor/promot/recommend/trend): 这些词干本身不可能是
 *     普通词前缀, 允许 sponsored / promoted / recommendation / trending 等派生形
 * 删除面与原实现保持一致 (sponsor 系 / promot 系 / recommend 系 / trend 系仍被删), 只消除误伤。
 */
const SOCIAL_AD_EXACT = ["ad", "ads"];
const SOCIAL_AD_STEMS = ["advert", "sponsor", "promot", "recommend", "trend"];

export function isSocialAdKey(k: unknown): boolean {
  return hasKeySegment(
    k,
    w => SOCIAL_AD_EXACT.indexOf(w) !== -1 || SOCIAL_AD_STEMS.some(s => w.startsWith(s))
  );
}

/** 递归把广告数组字段清空为空数组 (保留字段本身, 避免客户端读 undefined) */
export function cleanAdArrays(o: unknown): void {
  if (!o || typeof o !== "object") return;
  const rec = o as Record<string, unknown>;
  for (const k of Object.keys(rec))
    if (Array.isArray(rec[k]) && isAdKey(k)) rec[k] = [];
    else if (typeof rec[k] === "object") cleanAdArrays(rec[k]);
}

/** 递归删除指定键 (如 banner/promo) */
export function stripKeys(o: unknown, keys: string[]): void {
  if (!o || typeof o !== "object") return;
  const rec = o as Record<string, unknown>;
  for (const k of Object.keys(rec))
    if (keys.includes(k)) delete rec[k];
    else if (typeof rec[k] === "object") stripKeys(rec[k], keys);
}
