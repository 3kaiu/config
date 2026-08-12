/**
 * 酷狗音乐去广告 v1.0 - 作者：3kaiu
 * 覆盖: ads/mobilead.kugou.com (清空广告数组), gateway.kugou.com (移除 banner/promo); ⚠️ $response 守卫防误触 request 阶段
 */
const $ = new Env("酷狗音乐去广告");
if (typeof $response === "undefined") { $.done(); return; }
try {
  const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ""; } };
  const isHost = (u, d) => { const h = hostOf(u); return h === d || h.endsWith("." + d); };
  const obj = JSON.parse($response.body);
  if (isHost($request.url, "gateway.kugou.com")) stripKeys(obj, ["banner", "promo"]);
  else cleanAdArrays(obj);
  $.done({ body: JSON.stringify(obj) });
} catch (e) { $.done(); }
function cleanAdArrays(o) {
  if (!o || typeof o !== "object") return;
  for (const k of Object.keys(o))
    if (Array.isArray(o[k]) && /ad/i.test(k)) o[k] = [];
    else if (typeof o[k] === "object") cleanAdArrays(o[k]);
}
function stripKeys(o, keys) {
  if (!o || typeof o !== "object") return;
  for (const k of Object.keys(o))
    if (keys.includes(k)) delete o[k];
    else if (typeof o[k] === "object") stripKeys(o[k], keys);
}
