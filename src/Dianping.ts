/** 大众点评去广告 v1.0 — 作者：3kaiu (参考 ddgksf2013 + app2smile)
 * 端点: mapi.dianping.com (首页信息流) / check.dianping.com (推荐流)
 * 功能: 信息流广告项过滤 (is_ad/ad_id/promotion) · banner/popup 清空 · ad_list 置空
 * 守卫: $response 检查 + Env 兼容层 (Loon/QX/Surge) */

if (typeof $response === "undefined") { $done(); return; }
const $ = new Env("大众点评去广告");
const AD_KEYS = ["is_ad", "ad_id", "promotion"];
try {
  const obj = JSON.parse($response.body);
  const u = $request.url;
  if (u.includes("mapi.dianping.com")) $.log("首页信息流 - 过滤广告");
  else if (u.includes("check.dianping.com")) $.log("推荐流 - 过滤广告");
  clean(obj);
  $.done({ body: JSON.stringify(obj) });
} catch (e) { $.log(`解析失败: ${e}`); $.done(); }

// 🛠️ 递归净化: 过滤广告项 + 清空 banner/popup + 置空 ad_list
function clean(data) {
  if (!data || typeof data !== "object") return;
  if (Array.isArray(data)) {
    for (let i = data.length - 1; i >= 0; i--) {
      if (isAd(data[i])) data.splice(i, 1); else clean(data[i]);
    }
    return;
  }
  for (const key of Object.keys(data)) {
    if (key === "banner" || key === "popup") data[key] = Array.isArray(data[key]) ? [] : {};
    else if (key === "ad_list" || key === "adList") data[key] = [];
    else clean(data[key]);
  }
}

// 判断对象是否含广告标记字段
function isAd(item) {
  if (!item || typeof item !== "object") return false;
  for (const k of AD_KEYS) {
    const v = item[k];
    if (v === undefined || v === null || v === 0 || v === "0" || v === false || v === "") continue;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  }
  return false;
}
