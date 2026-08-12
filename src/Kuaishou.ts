/**
 * 快手去广告 v1.0
 * 作者：3kaiu (参考 Reddit.js/Weibo.js)
 *
 * 净化快手响应:
 * - graphql.kuaishou.com (信息流): 移除含 ad_type/is_ad 的 feed 条目
 * - api2.kuaishou.com (广告): 清空 ad_info 对象
 *
 * 递归遍历 JSON: 数组删除广告条目, 对象清空 ad_info。
 */

// $response 守卫 - 防止 AllInOne 全局 MitM 误触 request 阶段
if (typeof $response === "undefined") { $done(); return; }

const $ = new Env("快手去广告");

try {
  if (!$response.body) { $.done(); return; }
  const obj = JSON.parse($response.body);
  let removed = 0;

  // 判定条目是否为广告 (ad_type 非 0 / is_ad 为 true)
  function isAd(item) {
    if (!item || typeof item !== "object") return false;
    if (item.is_ad === true || item.isAd === true) return true;
    const t = item.ad_type !== undefined ? item.ad_type : item.adType;
    return t !== undefined && t !== 0 && t !== "0" && t !== false && t !== null;
  }

  // 递归净化: 数组删广告条目, 对象清空 ad_info
  function clean(data) {
    if (!data || typeof data !== "object") return;
    if (Array.isArray(data)) {
      for (let i = data.length - 1; i >= 0; i--) {
        if (isAd(data[i])) { data.splice(i, 1); removed++; }
        else clean(data[i]);
      }
      return;
    }
    for (const key of Object.keys(data)) {
      if (key === "ad_info" || key === "adInfo") data[key] = {};
      else clean(data[key]);
    }
  }

  clean(obj);
  if (removed > 0) $.log(`已过滤 ${removed} 个广告条目`);
  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`JSON 解析失败: ${e.message}`);
  $.done();
}

// ==========================================
