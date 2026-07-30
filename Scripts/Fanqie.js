/**
 * 番茄小说去广告 v1.0 · 3kaiu
 * 净化书架/章节列表广告 (is_ad/ad_type)，清空 ad_data，拦截追踪上报。
 * 目标: api5-normal-snkmer.fqnovel.com, ada.fqnovel.com, log.snssdk.com
 */
const $ = new Env("番茄小说去广告");
const url = $request.url;
if (typeof $response === "undefined" || !$response.body) { $.done(); return; }
if (url.includes("log.snssdk.com")) { $.log("🚫 拦截追踪上报"); $.done({}); return; }
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
// ═══ 🌍 Env 兼容层 (Loon/QX/Surge) - 模板源: Scripts/lib/env.js ═══
function Env(n) {
  this.name = n;
  this.isL = typeof $loon !== "undefined";
  this.isQ = typeof $task !== "undefined";
  this.log = (...a) => console.log(`[${this.name}] ` + a.join(" "));
  this.wait = (m) => new Promise(r => setTimeout(r, m));
  this.done = (o = {}) => $done(o);
  this.get = (k) => {
    let v = this.isL ? $persistentStore.read(k) : $prefs.valueForKey(k);
    try { return JSON.parse(v); } catch (e) { return v; }
  };
  this.set = (v, k) => {
    let s = typeof v === "object" ? JSON.stringify(v) : v;
    this.isL ? $persistentStore.write(s, k) : $prefs.setValueForKey(s, k);
  };
  this.fetch = async (o) => new Promise((r, e) => {
    if (this.isQ) $task.fetch(o).then(r, e);
    else {
      let m = (o.method || "GET").toLowerCase();
      $httpClient[m](o, (err, res, b) => {
        if (err) e(err);
        else {
          res.body = b;
          if (res.statusCode === undefined) {
            res.statusCode = res.status !== undefined ? res.status : (res.response ? res.response.statusCode : 200);
          }
          r(res);
        }
      });
    }
  });
  this.notify = (t, s, b) => this.isL ? $notification.post(t, s, b) : $notify(t, s, b);
}
