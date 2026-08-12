/**
 * 番茄小说去广告 v1.0 · 3kaiu
 * 净化书架/章节列表广告 (is_ad/ad_type)，清空 ad_data，拦截追踪上报。
 * 目标: api5-normal-snkmer.fqnovel.com, ada.fqnovel.com, log.snssdk.com
 */
const $ = new Env("番茄小说去广告");
const url = $request.url;
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ""; } };
const isHost = (u, d) => { const h = hostOf(u); return h === d || h.endsWith("." + d); };
if (typeof $response === "undefined" || !$response.body) { $.done(); return; }
if (isHost(url, "log.snssdk.com")) { $.log("🚫 拦截追踪上报"); $.done({}); return; }
try {
  const body = JSON.parse($response.body);
  function clean(d) { // 递归清空 ad_data 对象
    if (!d || typeof d !== "object") return;
    if (Array.isArray(d)) return d.forEach(clean);
    for (const k of Object.keys(d)) {
      if (k === "ad_data" && typeof d[k] === "object") d[k] = {};
      else clean(d[k]);
    }
  }
  function filterList(arr) { // 过滤列表广告条目
    if (!Array.isArray(arr)) return;
    const n = arr.length;
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      if (it && (it.is_ad === true || it.is_ad === 1 || (it.ad_type && it.ad_type !== 0))) arr.splice(i, 1);
    }
    if (arr.length !== n) $.log(`✅ 过滤 ${n - arr.length} 条广告`);
  }
  if (url.includes("api5-normal-snkmer")) { filterList(body.data); filterList(body.list); }
  clean(body);
  $.log("✅ 净化完成"); $.done({ body: JSON.stringify(body) });
} catch (e) {
  $.log(`❌ JSON 解析失败: ${e}`);
  $done();
}
