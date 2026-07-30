/**
 * 滴滴出行去广告 v1.0
 * 作者：3kaiu (参考 ddgksf2013/didi.js + app2smile) — 净化开屏/信息流/横幅广告
 * 覆盖: api.didialift.com (开屏) / epid.ride.fr (信息流) / mapi.diditaxi.com (横幅)
 */

const $ = new Env("DiDi");
if (typeof $response === "undefined") { $.done(); return; }

try {
  const url = $request.url;
  const obj = JSON.parse($response.body);
  const isAd = (i) => {
    if (!i || typeof i !== "object") return false;
    const t = (i.type || i.ad_type || i.card_type || "").toString().toLowerCase();
    return ["ad", "banner", "promo", "splash"].some(s => t.includes(s));
  };

  // 开屏广告 — api.didialift.com: 清空广告数组
  if (url.includes("api.didialift.com")) {
    if (Array.isArray(obj.data)) obj.data = [];
    else if (obj.data) ["ads", "splash", "ad_list", "banner"].forEach(k => {
      if (Array.isArray(obj.data[k])) obj.data[k] = [];
    });
  }

  // 信息流广告 — epid.ride.fr: 移除广告条目
  if (url.includes("epid.ride.fr")) {
    if (Array.isArray(obj.data)) obj.data = obj.data.filter(i => !isAd(i));
    else if (obj.data && Array.isArray(obj.data.list)) obj.data.list = obj.data.list.filter(i => !isAd(i));
    else if (Array.isArray(obj.feed)) obj.feed = obj.feed.filter(i => !isAd(i));
  }

  // 横幅广告 — mapi.diditaxi.com: 移除 banner/promo 对象
  if (url.includes("mapi.diditaxi.com")) {
    if (obj.data && !Array.isArray(obj.data))
      ["banner", "promo", "popup", "float_ad"].forEach(k => delete obj.data[k]);
    if (Array.isArray(obj.data)) obj.data = obj.data.filter(i => !isAd(i));
  }

  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.done();
}

// 🌍 Env 兼容层 (Loon / Quantumult X / Surge) — 模板源: Scripts/lib/env.js
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
