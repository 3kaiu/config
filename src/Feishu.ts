/**
 * 飞书去广告 v1.0
 * 作者：3kaiu
 * 信息流推广过滤 (internal-api.feishu.cn) + 推荐位 banner_ad 清空 (open.feishu.cn)
 */
const $ = new Env("飞书去广告");
if (typeof $response === "undefined") { $.done(); return; }
const AD_KEYS = ["is_ad", "is_promoted", "ad_type", "promoted"];
try { let removed = 0;
  if (!$response.body) { $.done(); return; }
  const obj = JSON.parse($response.body);
  /**
   * 类型名判定 — 整词/明确词干匹配 (2026-09-11 审计修复)
   *
   * 原实现 `/\b(ad|promot|sponsor|banner)/i.test(item.type)` 的 `\b` 是**词首边界**
   * 而非词尾锚定: "adaptive" 的 "ad" 前面正是词首边界, 于是正常类型 adaptive 被
   * 判为广告并整项删除 (审计探针实证: 内容被删成 {"items":[]})。
   * "address"/"admin"/"advisory" 同理。
   *
   * 现改为首尾锚定: 整词 (ad/ads) 或明确词干 (advert… / promot… / sponsor… / banner…)。
   */
  function isAdType(t: unknown): boolean {
    if (typeof t !== "string") return false;
    return /^(ad|ads|advert\w*|promot\w*|sponsor\w*|banner\w*|recommend\w*)$/.test(t.toLowerCase());
  }
  function isAd(item) {
    if (!item || typeof item !== "object") return false;
    for (const k of AD_KEYS) { const v = item[k]; if (v != null && v !== 0 && v !== "0" && v !== false && v !== "") return true; }
    return isAdType(item.type);
  }
  function clean(data) {
    if (!data || typeof data !== "object") return;
    if (Array.isArray(data)) {
      for (let i = data.length - 1; i >= 0; i--) { if (isAd(data[i])) { data.splice(i, 1); removed++; } else clean(data[i]); }
      return;
    }
    for (const key of Object.keys(data)) {
      if (key === "banner_ad" || key === "banner_ads") data[key] = Array.isArray(data[key]) ? [] : null;
      else if (key === "ad" || key === "ads" || key.startsWith("ad_")) delete data[key];
      else clean(data[key]);
    }
  }
  clean(obj);
  if (removed > 0) $.log(`已过滤 ${removed} 个推广/广告项`);
  $.done({ body: JSON.stringify(obj) });
} catch (e) { $.log(`解析失败: ${e.message}`); $.done(); }
// ==========================================
