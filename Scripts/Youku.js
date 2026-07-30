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
          if (res.statusCode === undefined)
            res.statusCode = res.status !== undefined ? res.status : (res.response ? res.response.statusCode : 200);
          r(res);
        }
      });
    }
  });
  this.notify = (t, s, b) => this.isL ? $notification.post(t, s, b) : $notify(t, s, b);
}
