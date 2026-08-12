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
  function isAd(item) {
    if (!item || typeof item !== "object") return false;
    for (const k of AD_KEYS) { const v = item[k]; if (v != null && v !== 0 && v !== "0" && v !== false && v !== "") return true; }
    return typeof item.type === "string" && /\b(ad|promot|sponsor|banner)/i.test(item.type);
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
