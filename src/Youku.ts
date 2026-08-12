/**
 * 优酷去广告 v1.0
 * 作者：3kaiu
 *
 * 覆盖:
 * - api.youku.com (开屏广告): 清空广告数组
 * - iyes.youku.com (广告追踪): 移除 banner/promo 对象
 * - vali.cp31.ott.cibntv.net (视频广告): 清空广告数组
 *
 * ⚠️ $response 守卫, 防止 AllInOne 全局 MitM 误触 request 阶段
 */
const $ = new Env("优酷去广告");
if (typeof $response === "undefined") { $.done(); return; }

const url = $request.url;
try {
  const obj = JSON.parse($response.body);
  if (url.includes("iyes.youku.com")) {
    stripKeys(obj, ["banner", "promo"]);
  } else if (url.includes("api.youku.com") || url.includes("vali.cp31.ott.cibntv.net")) {
    cleanAdArrays(obj);
  }
  $.done({ body: JSON.stringify(obj) });
} catch (e) { $.done(); }

// 递归清空名称含 "ad" 的数组字段
function cleanAdArrays(o) {
  if (!o || typeof o !== "object") return;
  for (const k of Object.keys(o)) {
    if (Array.isArray(o[k]) && /ad/i.test(k)) o[k] = [];
    else if (typeof o[k] === "object") cleanAdArrays(o[k]);
  }
}
// 递归删除指定键 (banner/promo)
function stripKeys(o, keys) {
  if (!o || typeof o !== "object") return;
  for (const k of Object.keys(o)) {
    if (keys.includes(k)) delete o[k];
    else if (typeof o[k] === "object") stripKeys(o[k], keys);
  }
}
