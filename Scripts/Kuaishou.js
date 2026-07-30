/**
 * 快手去广告 v1.0
 * 作者：3kaiu (参考 Reddit.js/Weibo.js)
 *
 * 净化快手响应:
 * - graphql.kuaishou.com (信息流): 移除含 ad_type/is_ad 的 feed 条目
 * - api2.kuaishou.com (广告): 清空 ad_info 对象
 *
 * 递归遍历 JSON: 数组删除广告条目, 对象清空 ad_info。
 */

// $response 守卫 - 防止 AllInOne 全局 MitM 误触 request 阶段
if (typeof $response === "undefined") { $done(); return; }

const $ = new Env("快手去广告");

try {
  if (!$response.body) { $.done(); return; }
  const obj = JSON.parse($response.body);
  let removed = 0;

  // 判定条目是否为广告 (ad_type 非 0 / is_ad 为 true)
  function isAd(item) {
    if (!item || typeof item !== "object") return false;
    if (item.is_ad === true || item.isAd === true) return true;
    const t = item.ad_type !== undefined ? item.ad_type : item.adType;
    return t !== undefined && t !== 0 && t !== "0" && t !== false && t !== null;
  }

  // 递归净化: 数组删广告条目, 对象清空 ad_info
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
      if (key === "ad_info" || key === "adInfo") data[key] = {};
      else clean(data[key]);
    }
  }

  clean(obj);
  if (removed > 0) $.log(`已过滤 ${removed} 个广告条目`);
  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`JSON 解析失败: ${e.message}`);
  $.done();
}

// ==========================================
// 🌍 Env 兼容层 (Loon / Quantumult X / Surge)
// 模板源: Scripts/lib/env.js - 修改请同步更新
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
    else { let m = (o.method || "GET").toLowerCase(); $httpClient[m](o, (err, res, b) => {
      if (err) e(err); else { res.body = b; if (res.statusCode === undefined) res.statusCode = res.status !== undefined ? res.status : (res.response ? res.response.statusCode : 200); r(res); } }); } });
  this.notify = (t, s, b) => this.isL ? $notification.post(t, s, b) : $notify(t, s, b);
}
