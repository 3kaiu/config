/**
 * 抖音去广告 v1.0
 * 作者：3kaiu (规则来源: app2smile/NobyDa)
 *
 * 对抖音/TikTok China JSON 响应体进行广告净化：
 * - 过滤信息流广告条目 (is_ad / ad_label / aweme_type)
 * - 递归删除 advertisement 前缀字段
 * - 清空 ad_data 广告配置对象
 * - 拦截 log.snssdk.com 追踪上报
 *
 * 目标端点: api.amemv.com/aweme/v1, aweme.snssdk.com/aweme/v1, api5-normal-dsa.amemv.com, log.snssdk.com
 */

const $ = new Env("抖音去广告");
const url = $request.url;

// $response 守卫 - 防止 AllInOne 全局 MitM 误触 request 阶段
if (typeof $response === "undefined" || !$response.body) { $.done(); return; }

// 追踪上报接口：直接返回空体
if (url.includes("log.snssdk.com")) {
  $.log("🚫 拦截追踪上报");
  $.done({});
  return;
}

try {
  const body = JSON.parse($response.body);

  // 递归净化：删除 advertisement* 字段、清空 ad_data
  function clean(data) {
    if (!data || typeof data !== "object") return;
    if (Array.isArray(data)) { data.forEach(clean); return; }
    for (const key of Object.keys(data)) {
      if (key.startsWith("advertisement")) {
        delete data[key];
      } else if (key === "ad_data" && typeof data[key] === "object") {
        data[key] = {};
      } else {
        clean(data[key]);
      }
    }
  }

  // 信息流广告条目判断
  function isAd(item) {
    if (!item || typeof item !== "object") return false;
    if (item.is_ad) return true;
    if (item.ad_label) return true;
    // aweme_type 2 = 信息流广告 (可按需扩展)
    if ([2, 4, 51].includes(item.aweme_type)) return true;
    return false;
  }

  // 过滤信息流数组 (原地删除, 兼容搜索结果嵌套 aweme_info)
  function filterFeed(arr) {
    if (!Array.isArray(arr)) return;
    const before = arr.length;
    for (let i = arr.length - 1; i >= 0; i--) {
      const aweme = arr[i]?.aweme_info || arr[i];
      if (isAd(aweme)) arr.splice(i, 1);
    }
    if (arr.length !== before) $.log(`✅ 过滤 ${before - arr.length} 条广告`);
  }

  // ── 路由分发 ──
  if (url.includes("aweme/v1")) {
    filterFeed(body.aweme_list); // 信息流
    filterFeed(body.data);       // 搜索结果
    clean(body);
    $.log("✅ 信息流净化完成");
  } else if (url.includes("api5-normal-dsa")) {
    clean(body);
    $.log("✅ 广告接口净化完成");
  } else {
    clean(body);
  }

  $.done({ body: JSON.stringify(body) });
} catch (e) {
  $.log(`❌ JSON 解析失败: ${e}`);
  $done(); // 非 JSON body 原样放行
}

// ═══ 🌍 Env 兼容层 (Loon/QX/Surge) - 模板源: Scripts/lib/env.js ═══
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
