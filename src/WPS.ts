/**
 * WPS Office 去广告 v1.0
 * 目标: adservice.wps.cn (广告) / docer.wps.cn (文档推荐)
 * 策略: 清空广告数组, 移除 banner/promo 对象
 */
if (typeof $response === "undefined") { $done(); return; }

const $ = new Env("WPS去广告");

try {
  const obj = JSON.parse($response.body);
  const url = $request.url;
  const adKeys = ["ads", "ad_list", "list", "banners"];
  const promoKeys = ["banner", "promo", "recommend", "promotion"];
  if (url.includes("adservice.wps.cn")) {
    [obj, obj.data].filter(Boolean).forEach(o =>
      adKeys.forEach(k => { if (Array.isArray(o[k])) o[k] = []; })
    );
    $.log("已清空广告数组");
  } else if (url.includes("docer.wps.cn")) {
    [obj, obj.data].filter(Boolean).forEach(o =>
      promoKeys.forEach(k => { delete o[k]; })
    );
    $.log("已移除推荐/Banner对象");
  }
  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`WPS去广告异常: ${e}`);
  $.done();
}

// ==========================================
