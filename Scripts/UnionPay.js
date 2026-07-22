/**
 * 云闪付去广告脚本 v1.1
 * 作者：3kaiu
 * 移除首页推广模块、理财页广告、推荐/权益营销内容
 *
 * ⚠️ 修复(v1.1): 添加 $response 守卫, 防止 AllInOne 全局 MitM 误触 request 阶段
 */

const $ = new Env("云闪付");

// $response 守卫
if (typeof $response === "undefined") { $.done(); }

const AD_KEYWORDS = ["广告", "推广", "营销", "活动", "banner", "弹窗", "浮层"];

if (typeof $request !== "undefined") {
  try {
    const url = $request.url;
    const obj = JSON.parse($response.body);

    if (url.includes("appShowGroup")) {
      if (obj.data && Array.isArray(obj.data)) {
        obj.data = obj.data.filter(item => {
          const type = item.showType || item.type || "";
          const name = item.groupName || item.name || "";
          return !AD_KEYWORDS.some(kw => name.includes(kw) || type.includes(kw));
        });
      }
      if (obj.data && obj.data.list) {
        obj.data.list = obj.data.list.filter(item => {
          const t = item.showType || "";
          return t !== "AD" && t !== "BANNER";
        });
      }
    }

    if (url.includes("fortune/inApp/common")) {
      if (obj.data && obj.data.adList) obj.data.adList = [];
      if (obj.data && obj.data.bannerList) obj.data.bannerList = [];
      if (obj.data && obj.data.popupList) obj.data.popupList = [];
      if (obj.data && obj.data.floatList) obj.data.floatList = [];
    }

    if (url.includes("recommend/hotList")) {
      if (obj.data && obj.data.list) obj.data.list = [];
      if (obj.data && Array.isArray(obj.data)) obj.data = [];
    }

    if (url.includes("queryAllRights")) {
      if (obj.data && obj.data.adList) obj.data.adList = [];
      if (obj.data && obj.data.bannerList) obj.data.bannerList = [];
    }

    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`Error: ${e.message}`);
    $.done();
  }
} else {
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