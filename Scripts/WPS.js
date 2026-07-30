/**
 * WPS Office 去广告 v1.0
 * 目标: adservice.wps.cn (广告) / docer.wps.cn (文档推荐)
 * 策略: 清空广告数组, 移除 banner/promo 对象
 */
if (typeof $response === "undefined") { $done(); return; }

const $ = new Env("WPS去广告");

try {
  const obj = JSON.parse($response.body);
  const url = $request.url;
  const adKeys = ["ads", "ad_list", "list", "banners"];
  const promoKeys = ["banner", "promo", "recommend", "promotion"];
  if (url.includes("adservice.wps.cn")) {
    [obj, obj.data].filter(Boolean).forEach(o =>
      adKeys.forEach(k => { if (Array.isArray(o[k])) o[k] = []; })
    );
    $.log("已清空广告数组");
  } else if (url.includes("docer.wps.cn")) {
    [obj, obj.data].filter(Boolean).forEach(o =>
      promoKeys.forEach(k => { delete o[k]; })
    );
    $.log("已移除推荐/Banner对象");
  }
  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`WPS去广告异常: ${e}`);
  $.done();
}

// ==========================================
// 🌍 Env 兼容层 (Loon / Quantumult X / Surge)
// 模板源: Scripts/lib/env.js - 修改请同步更新此文件及所有使用脚本
// ==========================================
function Env(n) {
  this.name = n;
  this.isL = typeof $loon !== "undefined";
  this.isQ = typeof $task !== "undefined";
  this.log = (...a) => console.log(`[${this.name}] ` + a.join(" "));
  this.wait = (m) => new Promise(r => setTimeout(r, m));
  this.done = (o = {}) => $done(o);
  this.get = (k) => { let v = this.isL ? $persistentStore.read(k) : $prefs.valueForKey(k); try { return JSON.parse(v); } catch (e) { return v; } };
  this.set = (v, k) => { let s = typeof v === "object" ? JSON.stringify(v) : v; this.isL ? $persistentStore.write(s, k) : $prefs.setValueForKey(s, k); };
  this.fetch = async (o) => new Promise((r, e) => {
    if (this.isQ) $task.fetch(o).then(r, e);
    else {
      let m = (o.method || "GET").toLowerCase();
      $httpClient[m](o, (err, res, b) => {
        if (err) e(err);
        else { res.body = b; if (res.statusCode === undefined) res.statusCode = res.status !== undefined ? res.status : 200; r(res); }
      });
    }
  });
  this.notify = (t, s, b) => this.isL ? $notification.post(t, s, b) : $notify(t, s, b);
}
