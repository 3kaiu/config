/**
 * 喜马拉雅去广告 Pro v1.0
 * 作者：3kaiu (基于 ddgksf2013/ximalaya_json.js 忠实移植)
 *
 * $response.body 为 JSON, 按 URL 路径分发清洗:
 *   discovery-category/customCategories   customCategoryList/defaultTabList 过滤
 *                                         保留 itemType∈{recommend,template_category,single_category}
 *                                         且 categoryId!=1005
 *   discovery-category/v\d/category       focusImages.data 过滤保留 realLink 含 "open" 且 !isAd
 *   focus-mobile/focusPic                 header[0].item.list[0].data 同上过滤
 *   discovery-feed/v\d/mix               header 长度==2 时删 header[0];
 *                                         body 过滤掉 adInfo/mix_ad/bigCard
 *   mobile-user/v\d/homePage             serviceModule.entrances 过滤保留 id∈{210,213,215}
 *   其他                                  $done({}) 原样放行
 */

function clean(body: any, url: string): { body: any; changed: boolean } {
  if (/discovery-category\/customCategories/.test(url)) {
    const filter = (e: any) =>
      (e.itemType === "recommend" || e.itemType === "template_category" || e.itemType === "single_category") &&
      e.categoryId !== 1005;
    if (body.customCategoryList) body.customCategoryList = body.customCategoryList.filter(filter);
    if (body.defaultTabList) body.defaultTabList = body.defaultTabList.filter(filter);
    return { body, changed: true };
  }
  if (/discovery-category\/v\d\/category/.test(url)) {
    if (body.focusImages && body.focusImages.data) {
      body.focusImages.data = body.focusImages.data.filter(
        (e: any) => e.realLink.indexOf("open") !== -1 && !e.isAd
      );
    }
    return { body, changed: true };
  }
  if (/focus-mobile\/focusPic/.test(url)) {
    if (body.header && body.header.length <= 1) {
      body.header[0].item.list[0].data = body.header[0].item.list[0].data.filter(
        (e: any) => e.realLink.indexOf("open") !== -1 && !e.isAd
      );
    }
    return { body, changed: true };
  }
  if (/discovery-feed\/v\d\/mix/.test(url)) {
    if (body.header && body.header.length === 2) delete body.header[0];
    body.body = body.body.filter(
      (e: any) => !(e.item?.adInfo || e.item?.moduleType === "mix_ad" || e.displayClass === "bigCard")
    );
    return { body, changed: true };
  }
  if (/mobile-user\/v\d\/homePage/.test(url)) {
    const keep = new Set([210, 213, 215]);
    if (body.data?.serviceModule?.entrances) {
      body.data.serviceModule.entrances = body.data.serviceModule.entrances.filter(
        (e: any) => keep.has(e.id)
      );
    }
    return { body, changed: true };
  }
  return { body, changed: false };
}

// ════════════════════════════════════════
// 🚪 入口: Node 测试导出 / Loon 运行时
// ════════════════════════════════════════
if (typeof module !== "undefined" && module.exports) {
  module.exports = { clean };
} else {
  try {
    const body = $response.body;
    if (body) {
      const result = clean(JSON.parse(body), $request.url);
      if (result.changed) {
        $done({ body: JSON.stringify(result.body) });
      } else {
        $done({});
      }
    } else {
      $done({});
    }
  } catch (e) {
    console.log("[Ximalaya Clean] " + e);
    $done({});
  }
}
