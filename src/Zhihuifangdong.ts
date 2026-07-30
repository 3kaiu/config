/**
 * 智慧房东广告屏蔽脚本 v1.1
 * 基于 Loon http-response 拦截
 * 参数: appOpenAds — 开屏广告; bannerPicMore — Banner 广告
 *
 * ⚠️ 修复(v1.1): $response 守卫提前 return, 避免穿透
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

  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`智慧房东去广告异常: ${e}`);
  $.done();
}
