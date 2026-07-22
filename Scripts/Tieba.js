/**
 * 贴吧去广告 v1.1
 * 作者：3kaiu (规则来源: app2smile)
 *
 * 对贴吧 JSON/Proto 响应体进行广告净化：
 * - 删除 ad 相关字段
 * - 处理 JSON 响应中的推广帖
 *
 * ⚠️ 修复(v1.1): 添加 $response 守卫, 防止 AllInOne 全局 MitM 误触 request 阶段
 */

// $response 守卫
if (typeof $response === "undefined") { $done(); }

// 需要删除的字段列表 (JSON 模式)
const AD_KEYS = [
  "ad", "adlist", "ad_info", "ad_cont", "activity",
  "banner", "banner_list", "recommend", "promotion",
  "ad_callback", "ad_extra", "ad_ext", "ad_meta"
];

try {
  const obj = JSON.parse($response.body);

  function clean(data) {
    if (!data || typeof data !== "object") return;
    if (Array.isArray(data)) {
      for (const item of data) clean(item);
      return;
    }
    for (const key of Object.keys(data)) {
      if (AD_KEYS.includes(key)) {
        delete data[key];
      } else if (key.startsWith("ad_") || key.startsWith("ads_")) {
        delete data[key];
      } else {
        clean(data[key]);
      }
    }
  }

  clean(obj);
  $done({ body: JSON.stringify(obj) });
} catch (e) {
  // 非 JSON body (Proto), pass through
  $done();
}
