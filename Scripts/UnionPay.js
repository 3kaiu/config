/**
 * 云闪付去广告脚本
 * 作者：3kaiu
 * 移除首页推广模块、理财页广告、推荐/权益营销内容
 */

const url = $request.url;

try {
  const obj = JSON.parse($response.body);

  if (url.includes("appShowGroup")) {
    if (obj.data && Array.isArray(obj.data)) {
      obj.data = obj.data.filter(item => {
        const type = item.showType || item.type || "";
        const name = item.groupName || item.name || "";
        const adKeywords = ["广告", "推广", "营销", "活动", "banner", "弹窗", "浮层"];
        return !adKeywords.some(kw => name.includes(kw) || type.includes(kw));
      });
    }
    if (obj.data && obj.data.list) {
      obj.data.list = obj.data.list.filter(item => {
        const t = item.showType || "";
        return t !== "AD" && t !== "BANNER";
      });
    }
  }

  if (url.includes("fortune/inApp/common")) {
    if (obj.data && obj.data.adList) obj.data.adList = [];
    if (obj.data && obj.data.bannerList) obj.data.bannerList = [];
    if (obj.data && obj.data.popupList) obj.data.popupList = [];
    if (obj.data && obj.data.floatList) obj.data.floatList = [];
  }

  if (url.includes("recommend/hotList")) {
    if (obj.data && obj.data.list) obj.data.list = [];
    if (obj.data && Array.isArray(obj.data)) obj.data = [];
  }

  if (url.includes("queryAllRights")) {
    if (obj.data && obj.data.adList) obj.data.adList = [];
    if (obj.data && obj.data.bannerList) obj.data.bannerList = [];
  }

  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done();
}
