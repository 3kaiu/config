/**
 * Keep 去广告 Pro v1.0
 * 作者：3kaiu (基于 ddgksf2013/keepStyle.js 忠实移植)
 *
 * $response.body 为 JSON, 按 URL 路径分发清洗:
 *   people/my              floatingInfo={}, 删除 memberInfo
 *   start                  data.status=true (跳过开屏)
 *   preview                detailSections 过滤 recommendation;
 *                          extendInfo.startEnable=true, hasPaid=true
 *   twins/v4/feed/course   modules 过滤 homepageCommonContainer/homepageLive
 *   config/v3/basic        bottomBarControl.defaultTab="home";
 *                          tabs 过滤保留 home/dynamic_sports/personal;
 *                          homeTabs 硬编码为推荐+会员
 *   其他                   $done() 原样放行
 */

function clean(body: any, url: string): any {
  if (url.indexOf("people/my") !== -1) {
    body.data.floatingInfo = {};
    if (body.data.memberInfo) delete body.data.memberInfo;
    return body;
  }
  if (url.indexOf("start") !== -1) {
    body.data.status = true;
    return body;
  }
  if (url.indexOf("preview") !== -1) {
    body.data.detailSections = Object.values(body.data.detailSections)
      .filter((e: any) => e.sectionType !== "recommendation");
    body.data.extendInfo.startEnable = true;
    body.data.extendInfo.hasPaid = true;
    return body;
  }
  if (url.indexOf("twins/v4/feed/course") !== -1) {
    body.data.modules = Object.values(body.data.modules)
      .filter((e: any) => e.code !== "homepageCommonContainer" && e.code !== "homepageLive");
    return body;
  }
  if (url.indexOf("config/v3/basic") !== -1) {
    body.data.bottomBarControl.defaultTab = "home";
    body.data.bottomBarControl.tabs = Object.values(body.data.bottomBarControl.tabs)
      .filter((e: any) => e.tabType === "home" || e.tabType === "dynamic_sports" || e.tabType === "personal");
    body.data.homeTabs = [
      { type: "homeRecommend", order: 1, name: "推荐", schema: "keep://homepage/homeRecommend", showInFewDays: 7, reverseSwitch: false, default: true },
      { type: "homePrime", order: 2, name: "会员", schema: "keep://coursepage/homePrime", showInFewDays: 7, reverseSwitch: false, default: false },
    ];
    return body;
  }
  return null;
}

// ════════════════════════════════════════
// 🚪 入口: Node 测试导出 / Loon 运行时
// ════════════════════════════════════════
if (typeof module !== "undefined" && module.exports) {
  module.exports = { clean };
} else {
  try {
    const result = clean(JSON.parse($response.body), $request.url);
    if (result) {
      $done({ body: JSON.stringify(result) });
    } else {
      $done();
    }
  } catch (e) {
    console.log("[Keep Clean] " + e);
    $done();
  }
}
