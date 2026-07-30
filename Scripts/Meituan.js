/**
 * 美团去广告 v1.0
 * 作者：3kaiu (参考 ddgksf2013 + app2smile 规则)
 *
 * 目标端点: api.meituan.com (首页信息流) / i.waimai.meituan.com (外卖) / papi.meituan.com (推荐流)
 * 功能: 信息流广告项过滤 (is_ad/ad_id/promotion) · banner/popup 清空 · ad_list 置空
 * 守卫: $response 检查 + Env 兼容层 (Loon/QX/Surge)
 */

// 🛡️ $response 守卫
if (typeof $response === "undefined") { $done(); return; }

const $ = new Env("美团去广告");
const AD_KEYS = ["is_ad", "ad_id", "promotion"];

try {
  const obj = JSON.parse($response.body);
  const u = $request.url;
  if (u.includes("api.meituan.com")) $.log("首页信息流 - 过滤广告");
  else if (u.includes("i.waimai.meituan.com")) $.log("外卖 - 过滤广告");
  else if (u.includes("papi.meituan.com")) $.log("推荐流 - 过滤广告");
  clean(obj);
  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`解析失败: ${e}`);
  $.done();
}

// 🛠️ 递归净化: 过滤广告项 + 清空 banner/popup + 置空 ad_list
function clean(data) {
  if (!data || typeof data !== "object") return;
  if (Array.isArray(data)) {
    for (let i = data.length - 1; i >= 0; i--) {
      if (isAd(data[i])) data.splice(i, 1);
      else clean(data[i]);
    }
    return;
  }
  for (const key of Object.keys(data)) {
    if (key === "banner" || key === "popup") {
      data[key] = Array.isArray(data[key]) ? [] : {};
    } else if (key === "ad_list" || key === "adList") {
      data[key] = [];
    } else {
      clean(data[key]);
    }
  }
}

// 判断对象是否含广告标记字段
function isAd(item) {
  if (!item || typeof item !== "object") return false;
  for (const k of AD_KEYS) {
    const v = item[k];
    if (v === undefined || v === null || v === 0 || v === "0" || v === false || v === "") continue;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  }
  return false;
}

// ════════════════════════════════════════
// 🌍 Env 兼容层 (Loon / Quantumult X / Surge)
// 模板源: Scripts/lib/env.js
// ════════════════════════════════════════
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
