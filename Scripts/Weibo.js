"use strict";
/**
 * 微博去广告 v1.0
 * 作者：3kaiu (参考 ddgksf2013/WeiboAds.conf + app2smile + Tieba.js/Reddit.js)
 *
 * 对微博 API 响应进行 JSON 级广告净化：
 * - 信息流/时间线/未读 feed 推广博文
 * - 热搜推广词条
 * - 评论区广告
 * - 客户端/页面/首页广告
 * - 递归删除 ad 前缀字段与广告元数据
 *
 * 使用 $response 守卫防止 request 阶段误触
 */

const $ = new Env("微博去广告");

// $response 守卫
if (typeof $response === "undefined") { $.done(); return; }

const url = $request.url;

// 对象级别广告标记字段 (truthy 即判定为广告)
const AD_MARK_KEYS = ["promotion", "ad_state", "ad_marked", "is_hot_search_ad"];
// 需要清空的广告元数据字段 (置空而非删除, 避免客户端解析异常)
const AD_META_KEYS = ["trend_ids", "headers"];

try {
  if (!$response.body) { $.done(); return; }

  const obj = JSON.parse($response.body);
  let removed = 0;

  // 纯广告端点: 直接返回空结构 (ad/home, page/ad, client/ads)
  if (/\/(ad\/home|page\/ad|client\/ads)\b/.test(url)) {
    $.done({ body: JSON.stringify(Array.isArray(obj) ? [] : {}) });
    return;
  }

  // 判定单个对象是否为广告项
  function isAdItem(item) {
    if (!item || typeof item !== "object") return false;
    for (const k of AD_MARK_KEYS) {
      const v = item[k];
      if (v !== undefined && v !== null && v !== 0 && v !== "0" && v !== false && v !== "") return true;
    }
    const tn = item.__typename || item.type;
    if (typeof tn === "string" && /\b(ad|advert|promot|sponsor)/i.test(tn)) return true;
    return false;
  }

  // 递归净化: 数组删广告项, 对象删 ad 前缀字段 + 清空元数据字段
  function clean(data) {
    if (!data || typeof data !== "object") return;
    if (Array.isArray(data)) {
      for (let i = data.length - 1; i >= 0; i--) {
        if (isAdItem(data[i])) {
          data.splice(i, 1);
          removed++;
        } else {
          clean(data[i]);
        }
      }
      return;
    }
    for (const key of Object.keys(data)) {
      if (key === "ad" || key === "ads" || key === "adlist" ||
          key.startsWith("ad_") || key.startsWith("ads_")) {
        delete data[key];
      } else if (AD_META_KEYS.includes(key)) {
        data[key] = Array.isArray(data[key]) ? [] : {};
      } else {
        clean(data[key]);
      }
    }
  }

  clean(obj);
  if (removed > 0) $.log(`已过滤 ${removed} 个广告项`);
  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`JSON 解析失败: ${e.message}`);
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
