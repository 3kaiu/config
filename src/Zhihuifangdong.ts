/**
 * 智慧房东广告屏蔽脚本 v1.2
 * 基于 Loon http-response 拦截
 * 参数: appOpenAds — 开屏广告; bannerPicMore — Banner 广告;
 *       showAds — 广告白名单; clickPic/clickPicMore/platformPic — 活动/广告位
 *
 * ⚠️ 修复(v1.1): $response 守卫提前 return, 避免穿透
 * ⚠️ 扩展(v1.2): HAR 审计 (2026-08-12) — adWhitelist/showAds 返回 data:true 穿透,
 *    clickPicMore/platformPic/clickPic 广告位/点击上报端点一并置空
 */

// $response 守卫
if (typeof $response === "undefined") { $done(); return; }

const arg = typeof $argument !== "undefined" ? $argument : "";
const $ = new Env("智慧房东");

try {
  const obj = JSON.parse($response.body);

  const url = typeof $request !== "undefined" ? $request.url : "";
  if (arg === "appOpenAds" || url.includes("appOpenAds")) {
    if (obj && obj.data) {
      obj.data = [];
    }
    $.log("已屏蔽智慧房东开屏广告");
  }
  else if (arg === "bannerPicMore" || url.includes("bannerPicMore")) {
    if (obj && obj.data) {
      obj.data = {};
    }
    $.log("已屏蔽智慧房东 Banner 广告");
  }
  else if (arg === "showAds" || url.includes("adWhitelist/showAds")) {
    if (obj && obj.data) {
      obj.data = null;
    }
    $.log("已屏蔽智慧房东广告白名单");
  }
  else if (arg === "clickPicMore" || url.includes("clickPicMore")) {
    if (obj && obj.data) {
      obj.data = {};
    }
    $.log("已屏蔽智慧房东广告位 (clickPicMore)");
  }
  else if (arg === "platformPic" || url.includes("platformPic")) {
    if (obj && obj.data) {
      obj.data = {};
    }
    $.log("已屏蔽智慧房东广告位 (platformPic)");
  }
  else if (arg === "clickPic" || url.includes("clickPic")) {
    if (obj && obj.data) {
      obj.data = {};
    }
    $.log("已屏蔽智慧房东广告位 (clickPic)");
  }

  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`智慧房东去广告异常: ${e}`);
  $.done();
}
