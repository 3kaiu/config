/**
 * 淘宝天猫去广告 v1.0
 * 作者：3kaiu (参考 ddgksf2013/taobao.js + app2smile)
 *
 * 目标端点:
 *  - amdc.m.taobao.com  (设备指纹)
 *  - h5api.m.taobao.com (首页信息流)
 *  - ace.taobao.com     (推荐流)
 *  - api.m.taobao.com   (搜索)
 *
 * 功能:
 *  ✓ 信息流广告对象过滤 (adSpm / is_ad / promoted)
 *  ✓ advertise 前缀字段递归清理
 *  ✓ advertiseList / promoteList 数组置空
 *  ✓ $response 守卫 + Env 兼容层
 */

// 🛡️ $response 守卫
if (typeof $response === "undefined") { $done(); return; }

const $ = new Env("淘宝天猫");
const url = $request.url;
const AD_MARKERS = ["adSpm", "is_ad", "isAd", "promoted", "is_promoted"];

try {
  const body = JSON.parse($response.body);

  if (url.includes("amdc.m.taobao.com")) {
    $.log("设备指纹 - 清理广告追踪");
  } else if (url.includes("h5api.m.taobao.com")) {
    $.log("首页信息流 - 过滤广告");
  } else if (url.includes("ace.taobao.com")) {
    $.log("推荐流 - 过滤广告");
  } else if (url.includes("api.m.taobao.com")) {
    $.log("搜索 - 过滤广告");
  }

  clean(body);
  $.done({ body: JSON.stringify(body) });
} catch (e) {
  $.log(`解析失败: ${e}`);
  $.done();
}

// 🛠️ 递归净化: 过滤广告对象 + 清理 advertise 字段
function clean(data) {
  if (!data || typeof data !== "object") return;
  if (Array.isArray(data)) {
    for (let i = data.length - 1; i >= 0; i--) {
      if (isAdItem(data[i])) data.splice(i, 1);
    }
    for (const item of data) clean(item);
    return;
  }
  for (const key of Object.keys(data)) {
    if (key === "advertiseList" || key === "promoteList") {
      data[key] = [];
    } else if (key.startsWith("advertise")) {
      delete data[key];
    } else {
      clean(data[key]);
    }
  }
}

// 判断对象是否含广告标记字段
function isAdItem(item) {
  if (!item || typeof item !== "object") return false;
  return AD_MARKERS.some(m => item[m]);
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
