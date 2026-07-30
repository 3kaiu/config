/**
 * 酷我音乐去广告 v1.0
 * 作者：3kaiu
 *
 * 净化 rich.kuwo.cn (广告服务) / mobilead.kuwo.cn (移动广告) 响应
 * 策略: 清空广告数据, 移除 banner 字段
 *
 * ⚠️ $response 守卫: 防止 AllInOne 全局 MitM 误触 request 阶段
 */
const $ = new Env("酷我音乐");
if (typeof $response === "undefined") { $.done(); return; }
try {
  const obj = JSON.parse($response.body);
  if (obj) {
    ["data", "adlist", "list", "ads", "adList"].forEach(k => {
      if (obj[k]) obj[k] = Array.isArray(obj[k]) ? [] : {};
    });
    ["banner", "bannerList", "banners", "topBanner", "bottomBanner"].forEach(k => delete obj[k]);
    if (obj.data && typeof obj.data === "object") {
      ["banner", "bannerList", "banners", "adlist", "ads"].forEach(k => delete obj.data[k]);
    }
  }
  $.done({ body: JSON.stringify(obj) });
} catch (e) { $.done(); }

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
