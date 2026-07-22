/**
 * 菜鸟包裹去广告 v1.1
 * 作者：3kaiu
 *
 * 处理 jq 过滤：
 * - 首页卡片净化：删除 searchContents 和 operationList
 * - 我的页面净化：删除 banner/activity/vip
 * - 发现页面净化：删除 placeContentMap["780001"]
 * - 开屏广告阻塞：materialId==39017 时清空 data
 *
 * ⚠️ 修复(v1.1): 添加 $response 守卫, 防止 AllInOne 全局 MitM 误触 request 阶段
 */

// $response 守卫
if (typeof $response === "undefined") { $done(); }

const url = $request.url;

if (url.includes("e2e.engine.page.fetch.cn")) {
  handleMinePage();
} else if (url.includes("e2e.engine.page.fetch")) {
  handleHomePage();
} else if (url.includes("longquan")) {
  handleDiscover();
} else if (url.includes("nbnetflow.ads")) {
  handleSplashAd();
}

function handleHomePage() {
  try {
    const obj = JSON.parse($response.body);
    const searchContents = obj?.data?.data?.data?.mainSearch?.bizData?.searchContents;
    if (searchContents) delete obj.data.data.data.mainSearch.bizData.searchContents;
    const opList = obj?.data?.data?.data?.operationList;
    if (opList) delete obj.data.data.data.operationList;
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleMinePage() {
  try {
    const obj = JSON.parse($response.body);
    if (obj?.data?.data) {
      delete obj.data.data.banner;
      delete obj.data.data.activity;
      delete obj.data.data.vip;
    }
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleDiscover() {
  try {
    const obj = JSON.parse($response.body);
    const contentList = obj?.data?.result?.placeContentMap?.["780001"]?.contentList;
    if (contentList) delete obj.data.result.placeContentMap["780001"].contentList;
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleSplashAd() {
  try {
    const obj = JSON.parse($response.body);
    if (obj?.data?.result?.[0]?.materialId === "39017") {
      obj.data = {};
    }
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

$.done();