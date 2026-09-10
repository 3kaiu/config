/**
 * 酷狗音乐去广告 v1.0 - 作者：3kaiu
 * 覆盖: ads/mobilead.kugou.com (清空广告数组), gateway.kugou.com (移除 banner/promo); ⚠️ $response 守卫防误触 request 阶段
 */
const $ = new Env("酷狗音乐去广告");
if (typeof $response === "undefined") { $.done(); return; }
// hostOf / isHost → src/lib/net.ts; isAdKey / cleanAdArrays / stripKeys → src/lib/ad.ts
// (均由 esbuild --inject 注入, 原为跨脚本重复副本)
try {
  const obj = JSON.parse($response.body);
  if (isHost($request.url, "gateway.kugou.com")) stripKeys(obj, ["banner", "promo"]);
  else cleanAdArrays(obj);
  $.done({ body: JSON.stringify(obj) });
} catch (e) { $.done(); }
