/**
 * 智慧房东广告屏蔽脚本
 * 基于 Loon http-response 拦截
 * 参数: appOpenAds — 开屏广告; bannerPicMore — Banner 广告
 */
const arg = typeof $argument !== "undefined" ? $argument : "";
const $ = new Env("智慧房东");

try {
  const obj = JSON.parse($response.body);

  const url = typeof $request !== "undefined" ? $request.url : "";
  if (arg === "appOpenAds" || url.includes("appOpenAds")) {
    if (obj && obj.data) {
      obj.data = [];
    }
    $.log("已屏蔽智慧房东开屏广告");
  }
  else if (arg === "bannerPicMore" || url.includes("bannerPicMore")) {
    if (obj && obj.data && obj.data.data) {
      obj.data.data = [];
    }
    if (obj && obj.data) {
      obj.data = {};
    }
    $.log("已屏蔽智慧房东 Banner 广告");
  }

  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`智慧房东去广告异常: ${e}`);
  $.done();
}

// ==========================================
// 🌍 Env 兼容层 (Loon / Quantumult X)
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
        else { res.body = b; res.statusCode = res.status || 200; r(res); }
      });
    }
  });
  this.notify = (t, s, b) => this.isL ? $notification.post(t, s, b) : $notify(t, s, b);
}
