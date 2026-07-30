/**
 * 钉钉去广告 v1.0
 * 作者：3kaiu (参考 ddgksf2013/dingtalk.js + app2smile)
 * 信息流推广过滤 (api.dingtalk.com) + 推荐位 banner_ad 清空 (oapi.dingtalk.com)
 */
const $ = new Env("钉钉去广告");
if (typeof $response === "undefined") { $.done(); return; }
const AD_KEYS = ["is_ad", "is_promoted", "ad_type", "promoted"];
let removed = 0;
try {
  if (!$response.body) { $.done(); return; }
  const obj = JSON.parse($response.body);
  // 判定推广/广告项 + 递归净化 (数组删项, 对象清 banner_ad / 删 ad 前缀字段)
  function isAd(item) {
    if (!item || typeof item !== "object") return false;
    for (const k of AD_KEYS) {
      const v = item[k];
      if (v !== undefined && v !== null && v !== 0 && v !== "0" && v !== false && v !== "") return true;
    }
    return typeof item.type === "string" && /\b(ad|promot|sponsor|banner)/i.test(item.type);
  }
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
      if (key === "banner_ad" || key === "banner_ads") data[key] = Array.isArray(data[key]) ? [] : null;
      else if (key === "ad" || key === "ads" || key.startsWith("ad_")) delete data[key];
      else clean(data[key]);
    }
  }
  clean(obj);
  if (removed > 0) $.log(`已过滤 ${removed} 个推广/广告项`);
  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`解析失败: ${e.message}`);
  $.done();
}
// ==========================================
// 🌍 Env 兼容层 (Loon / Quantumult X / Surge)
// 模板源: Scripts/lib/env.js
// ==========================================
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
