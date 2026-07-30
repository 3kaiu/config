/**
 * 小红书去广告 v1.0
 * 作者：3kaiu (参考 ddgksf2013 + app2smile)
 *
 * 信息流/搜索/用户主页响应净化: 移除广告项 (ads_info / is_ad),
 * 清理 tracking 字段。
 */

// $response 守卫 — 防止 AllInOne 全局 MitM 误触 request 阶段
if (typeof $response === "undefined") { $done(); return; }

const $ = new Env("小红书");
const url = $request.url;

try {
  const obj = JSON.parse($response.body);

  // ── 信息流 API (edith/api.xiaohongshu.com /feed, /homefeed) ──
  if (url.includes("/feed") || url.includes("/homefeed")) {
    filterItems(obj.data);
  }
  // ── 搜索 API (/search/notes, /search/recommend …) ──
  else if (url.includes("/search/")) {
    filterItems(obj.data);
    if (obj.data?.search_ad) obj.data.search_ad = null;
  }
  // ── 用户主页 API (/user/posted, /page/notes) ──
  else if (url.includes("/user/posted") || url.includes("/page/notes")) {
    filterItems(obj.data);
  }

  // ── 通用: 递归清理 tracking 字段 ──
  cleanTracking(obj);
  $.log(`净化完成: ${url.split("?")[0]}`);
  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.log(`错误: ${e}`);
  $.done();
}

// ════════════════════════════════════════
// 🛠️ 工具函数
// ════════════════════════════════════════

/** 过滤广告项: 移除含 ads_info 或 is_ad=true 的条目 */
function filterItems(data) {
  if (!data) return;
  for (const key of ["items", "notes", "list"]) {
    if (!Array.isArray(data[key])) continue;
    const before = data[key].length;
    data[key] = data[key].filter(i => !i.ads_info && i.is_ad !== true);
    if (before !== data[key].length) $.log(`过滤广告: ${before} -> ${data[key].length}`);
  }
}

/** 递归清理 tracking 字段 */
function cleanTracking(obj) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) return obj.forEach(cleanTracking);
  for (const f of ["ads_info", "ad_id", "track_id", "trace_id", "imp_id"]) delete obj[f];
  for (const v of Object.values(obj)) cleanTracking(v);
}

// ==========================================
// 🌍 Env 兼容层 (Loon / Quantumult X / Surge)
// 模板源: Scripts/lib/env.js — 修改请同步更新
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
