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

/**
 * "保留"判定 — 2026-09-11 深度审计 NEW-08
 *
 * 原实现直接 `e.realLink.indexOf("open")`, 无任何守卫。realLink 缺失或非字符串时
 * 抛 TypeError, 被入口 catch 吞掉 → **整个响应原样放行**(静默全量降级:
 * 本该净化 100 条, 实际 0 条, 且只留一行日志)。
 * 现按"realLink 不是字符串即不算 open 链接"处理, 与过滤器的既有契约一致
 * (保留 realLink 含 open 且非广告的条目)。
 */
function isOpenLink(e: any): boolean {
  return typeof e?.realLink === "string" && e.realLink.indexOf("open") !== -1 && !e.isAd;
}

/** 仅当值是数组时才过滤, 否则原样返回 (避免 .filter 不是函数而整段降级) */
function filterIfArray(v: any, pred: (e: any) => boolean): any {
  return Array.isArray(v) ? v.filter(pred) : v;
}

function clean(body: any, url: string): { body: any; changed: boolean } {
  if (/discovery-category\/customCategories/.test(url)) {
    const filter = (e: any) =>
      (e.itemType === "recommend" || e.itemType === "template_category" || e.itemType === "single_category") &&
      e.categoryId !== 1005;
    if (body.customCategoryList) body.customCategoryList = filterIfArray(body.customCategoryList, filter);
    if (body.defaultTabList) body.defaultTabList = filterIfArray(body.defaultTabList, filter);
    return { body, changed: true };
  }
  if (/discovery-category\/v\d\/category/.test(url)) {
    if (body.focusImages && body.focusImages.data) {
      body.focusImages.data = filterIfArray(body.focusImages.data, isOpenLink);
    }
    return { body, changed: true };
  }
  if (/focus-mobile\/focusPic/.test(url)) {
    // 原为 `header.length <= 1` — length===0 时 header[0] 是 undefined,
    // 紧接着读 .item 即抛错。语义上该分支只对"恰好一个 header"成立, 故改 === 1。
    if (body.header && body.header.length === 1) {
      const list = body.header[0]?.item?.list?.[0];
      if (list && Array.isArray(list.data)) {
        list.data = list.data.filter(isOpenLink);
      }
    }
    return { body, changed: true };
  }
  if (/discovery-feed\/v\d\/mix/.test(url)) {
    if (body.header && body.header.length === 2) delete body.header[0];
    if (Array.isArray(body.body)) {
      body.body = body.body.filter(
        (e: any) => !(e.item?.adInfo || e.item?.moduleType === "mix_ad" || e.displayClass === "bigCard")
      );
    }
    return { body, changed: true };
  }
  if (/mobile-user\/v\d\/homePage/.test(url)) {
    const keep = new Set([210, 213, 215]);
    if (body.data?.serviceModule?.entrances) {
      body.data.serviceModule.entrances = filterIfArray(
        body.data.serviceModule.entrances,
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
