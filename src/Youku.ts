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
// hostOf / isHost → src/lib/net.ts; isAdKey / cleanAdArrays / stripKeys → src/lib/ad.ts
// (均由 esbuild --inject 注入, 原为跨脚本重复副本)
try {
  const obj = JSON.parse($response.body);
  if (isHost(url, "iyes.youku.com")) {
    stripKeys(obj, ["banner", "promo"]);
  } else if (isHost(url, "api.youku.com") || isHost(url, "vali.cp31.ott.cibntv.net")) {
    cleanAdArrays(obj);
  }
  $.done({ body: JSON.stringify(obj) });
} catch (e) { $.done(); }
