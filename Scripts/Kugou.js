/**
 * 酷狗音乐去广告 v1.0 - 作者：3kaiu
 * 覆盖: ads/mobilead.kugou.com (清空广告数组), gateway.kugou.com (移除 banner/promo); ⚠️ $response 守卫防误触 request 阶段
 */
const $ = new Env("酷狗音乐去广告");
if (typeof $response === "undefined") { $.done(); return; }
try {
  const obj = JSON.parse($response.body);
  if ($request.url.includes("gateway.kugou.com")) stripKeys(obj, ["banner", "promo"]);
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
// 🌍 Env 兼容层 (Loon / Quantumult X / Surge) - 模板源: Scripts/lib/env.js
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
          // Loon response 字段名在不同版本可能是 status 或 statusCode
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
