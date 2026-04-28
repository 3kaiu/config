/**
 * 📚 起点全能助手 v3.9 — KeLi 全清方案 + GDT 双层视频替换
 * 融合 KeLi Loon Rewrite 全规则 + app2smile + 自研视频 1s 替换
 * 作者：3kaiu
 */
const $ = new Env("起点助手");

const CONFIG = {
  TaskMapping: {
    "1218712929269776384": { name: "激励视频", count: 9 },
    "1218712929269776388": { name: "福利任务", count: 3 }
  },

  // 广告/追踪覆写 (仅广告相关，不动正常功能)
  ClientConfigOverrides: {
    "PangleEnable": "0", "DisableQidianBurryReport": "1", "DisableNewabInBI": "1",
    "SplashScreenInterval": "0", "SplashScreenRoundCount": "0",
    "BusinessSplashCoolDownTime": "99999", "PushDialogFrequency": "0",
    "EnableMonitorLog": "0", "EnableBeaconFullBurry": "0",
    "ReloadExposureEnabled": "false", "QDABRegularReportTimeSpan": "999999",
    "QDABReportMinThreshold": "999999", "RankBuryPoint": "0",
    "CheckInPushSwitchReport": "0", "WolfEye": 0
  },

  // KeLi 风格 — getconf JSON key 精确删除
  DeleteKeys: ["ActivityPageBackPushNoticeFrequency", "ActivityIcon", "ActivityPopup", "LuckBag"],

  // KeLi 风格 — 直接拒绝对应 API (reject-dict)
  RejectPaths: [
    "checkin/simpleinfo", "checkin/lottery", "push/getdialog",
    "booksearch/hotWords", "maintain/playstrip", "young/getconf",
    "followsubscribe/showChapterEndModule", "freshman/bookshelfbtn",
    "message/getpushedmessagelist", "dailyrecommend/recommendBook",
    "bookshelf/getTopOperation"
  ],

  // getaccountpage — 删除营销模块 (BenefitButtonList = 福利中心/活动中心/我的阅历)
  AccountPageDelKeys: ["BenefitButtonList"],

  CleanRules: {
    "video/adv/mainPage":       ["Data.DailyBenefitModule.TaskList"],
    "video/adv/mainPageDialog": ["Data"],
    "bookshelf/getHoverAdv":    ["Data.ItemList"],
    "user/getsimplediscover":   ["Data.Items[ShowName=游戏中心f]","Data.Items[ShowName=游戏中心]","Data.Items[ShowName=新活动中心]","Data.Items[ShowName=红包广场]"],
    "widget/daily/rec":         ["Data"],
    "reddot/getdot":            ["Data"]
  },

  DirectKillPaths: ["bookshelf/getad", "client/iosad"],

  AdWhitelist: ["ioscheckin", "reward", "video", "flzx", "costume", "buqian", "normaltask", "limitegg", "redpocket"],

  VideoSkipSeconds: 1,
  AdDurationKeys: ["video_duration", "video_timelife", "duration", "play_time", "total_time", "show_time", "max_time", "stay", "display_time"]
};

// ==========================================
// 🚀 主入口
// ==========================================
!(async () => {
  if (typeof $request === "undefined") {
    await handleCron();
    return;
  }

  const { url, method } = $request;

  // A. Token 窃取 (精确匹配 getconf，排除 getconfSpecify)
  if (url.includes("/v1/client/getconf") && url.includes("magev6") && !$response) {
    handleTokenSteal($request);
  }
  // B. GDT 视频拦截 — 返回 1 秒视频
  else if (url.includes(".mp4") && url.includes("adsmind.gdtimg.com")) {
    handleVideoReplace();
  }
  // C. 广告 SDK 秒播
  else if (url.includes("/gdt_inner_view") || url.includes("/get_ads")) {
    handleAdSkip($response);
  }
  else {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // KeLi 风格 — 直接拒绝 (reject-dict)
    if (CONFIG.RejectPaths.some(p => path.includes(p))) {
      handleReject();
    }
    // C. 自动重放
    else if (path.endsWith("/video/adv/finishWatch") && method === "POST") {
      await handleReplay($request);
    }
    // D. 客户端配置覆写 (精确匹配 getconf)
    else if (path.endsWith("/v1/client/getconf")) {
      handleClientConfig($response);
    }
    // E. 开屏广告 — 直接置空 List
    else if (path.includes("getsplashscreen")) {
      handleSplashScreen($response);
    }
    // F. Deeplink — 阻止冷启动跳转精选页
    else if (path.includes("deeplink/geturl")) {
      handleDeeplink($response);
    }
    // G. 每日推荐 — 清空
    else if (path.includes("dailyrecommend")) {
      handleDailyRec($response);
    }
    // H. getaccountpage — 删除营销模块 (福利中心/活动中心/我的阅历)
    else if (path.includes("getaccountpage")) {
      handleAccountPage($response);
    }
    // I. 批量广告获取 (检查白名单)
    else if (path.includes("adv/getadvlistbatch")) {
      handleAdListBatch(url, $response);
    }
    // J. 直接置空杀广告 (书架/iosad)
    else if (CONFIG.DirectKillPaths.some(p => path.includes(p))) {
      handleDirectAdKill(url, $response);
    }
    // K. 页面净化
    else if (matchCleanRule(path)) {
      handleClean(path, $response);
    }
    else {
      $.done();
    }
  }

})().catch(e => {
  $.log(`异常: ${e}`);
  $.done();
});

// ==========================================
// 🛠️ 核心函数
// ==========================================

function matchCleanRule(path) {
  for (const key of Object.keys(CONFIG.CleanRules)) {
    if (path.includes(key)) return true;
  }
  return false;
}

function getCleanRules(path) {
  for (const key of Object.keys(CONFIG.CleanRules)) {
    if (path.includes(key)) return CONFIG.CleanRules[key];
  }
  return null;
}

function handleDirectAdKill(url, response) {
  try {
    if (CONFIG.AdWhitelist.some(kw => url.includes(kw))) {
      $.done();
      return;
    }
    const obj = safeJsonParse(response.body);
    if (!obj) { $.done(); return; }
    if (obj.Data) {
      obj.Data = Array.isArray(obj.Data) ? [] : {};
    }
    $.log("✨ 已秒杀原生广告");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.done();
  }
}

function handleClientConfig(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (!obj || !obj.Data) { $.done(); return; }

    // 基础广告覆盖
    for (const [k, v] of Object.entries(CONFIG.ClientConfigOverrides)) {
      obj.Data[k] = v;
    }

    // KeLi 风格: 精确删除 JSON key
    CONFIG.DeleteKeys.forEach(k => {
      if (obj.Data.hasOwnProperty(k)) delete obj.Data[k];
    });

    // app2smile 补充: 青少年模式 + 悬浮图标 + 搜索用户
    if (obj.Data.CloudSetting && obj.Data.CloudSetting.TeenShowFreq) obj.Data.CloudSetting.TeenShowFreq = "0";
    obj.Data.EnableSearchUser = "1";

    // 删除 GDT 配置 + 广告位置
    if (obj.Data.GDT) delete obj.Data.GDT;
    if (obj.Data.AdVideoPositionConfig) obj.Data.AdVideoPositionConfig = [];

    $.log("✨ 已覆盖客户端配置 (KeLi 风格)");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`❌ 配置覆写失败: ${e}`);
    $.done();
  }
}

function handleAdSkip(response) {
  try {
    const s = CONFIG.VideoSkipSeconds;
    const ONE_SEC_VIDEO = "https://raw.githubusercontent.com/3kaiu/config/main/Assets/1s.mp4";
    const obj = safeJsonParse(response.body);

    if (obj) {
      // 替换所有视频 URL 为 1 秒占位视频
      replaceVideoUrls(obj, ONE_SEC_VIDEO);
      // 递归修改所有时长字段
      patchDurationFields(obj, CONFIG.AdDurationKeys, s);
      $.done({ body: JSON.stringify(obj) });
      return;
    }

    // 非 JSON 回退：正则替换
    let body = String(response.body || "");
    body = body
      .replace(/"video":\s*"https?:\/\/[^"]+\.mp4[^"]*"/g, `"video":"${ONE_SEC_VIDEO}"`)
      .replace(/"video_duration":\s*\d+/g, `"video_duration":${s}`)
      .replace(/"video_timelife":\s*\d+/g, `"video_timelife":${s}`)
      .replace(/"duration":\s*\d+/g, `"duration":${s}`)
      .replace(/"play_time":\s*\d+/g, `"play_time":${s}`)
      .replace(/"total_time":\s*\d+/g, `"total_time":${s}`)
      .replace(/"show_time":\s*\d+/g, `"show_time":${s}`)
      .replace(/"max_time":\s*\d+/g, `"max_time":${s}`);
    $.done({ body });
  } catch (e) {
    $.done();
  }
}

function handleTokenSteal(request) {
  if (request.headers) {
    $.set(request.headers, "Qidian_Headers");
    $.log("✨ 已保存起点 Token");
  }
  $.done();
}

async function handleCron() {
  $.log("⏰ 起点自动签到...");
  const headers = $.get("Qidian_Headers");
  if (!headers) {
    $.log("❌ 缺少 Token");
    $.notify("起点助手", "签到失败", "请先打开起点App获取Token");
    $.done();
    return;
  }
  const res = await $.fetch({
    url: "https://magev6.if.qidian.com/argus/api/v2/checkin/checkin",
    method: "GET",
    headers
  });
  if (res && res.body) {
    try {
      const obj = JSON.parse(res.body);
      if (obj.Result === 0) {
        $.notify("起点助手", "签到成功", obj.Message || "奖励已入账");
        $.log(`✅ 签到成功`);
      } else {
        $.notify("起点助手", "签到异常", obj.Message || "");
      }
    } catch (e) {
      $.log(`❌ 签到解析失败: ${e}`);
    }
  }
  $.done();
}

async function handleReplay(request) {
  const body = request.body || "";
  const match = Object.keys(CONFIG.TaskMapping).find(id => body.includes(id));
  if (!match) { $.done(); return; }
  const task = CONFIG.TaskMapping[match];
  const replayCount = task.count - 1;
  if (replayCount <= 0) { $.done(); return; }

  $.log(`🚀 识别任务: ${task.name}, 重放 ${replayCount} 次`);
  const tasks = Array.from({ length: replayCount }, async (_, i) => {
    await $.wait(i * 15);
    const res = await $.fetch({
      url: request.url,
      method: "POST",
      headers: normalizeHeaders(request.headers),
      body: request.body
    });
    return res && res.statusCode === 200;
  });
  const results = await Promise.allSettled(tasks);
  const ok = results.filter(r => r.status === "fulfilled" && r.value).length;
  $.notify("起点助手", "", `${task.name}: ${ok + 1}/${task.count}`);
  $.done();
}

function handleClean(path, response) {
  try {
    let obj = safeJsonParse(response.body);
    if (!obj) { $.done(); return; }
    const rules = getCleanRules(path);
    if (rules) {
      obj = $.clean(obj, rules);
    }
    // 后处理空安全
    if (path.includes("getsplashscreen")) {
      if (!obj.Data) obj.Data = {};
      if (!obj.Data.List) obj.Data.List = [];
    }
    if (path.includes("getHoverAdv")) {
      if (!obj.Data) obj.Data = {};
      if (!obj.Data.ItemList) obj.Data.ItemList = [];
    }
    if (path.includes("getadvlistbatch")) {
      if (!obj.Data) obj.Data = [];
    }
    if (path.includes("mainPage") && obj.Data && obj.Data.DailyBenefitModule) {
      obj.Data.DailyBenefitModule.TaskList = [];
    }
    $.log(`✨ 净化完成: ${path.split("/").pop()}`);
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.done();
  }
}

function handleSplashScreen(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (!obj || !obj.Data) { $.done(); return; }
    obj.Data.List = null;
    if (obj.Data.EnableGDT === 1) obj.Data.EnableGDT = 0;
    $.log("✨ 已清除开屏广告");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleDeeplink(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (obj && obj.Data && obj.Data.ActionUrl) {
      obj.Data.ActionUrl = "";
      $.log("✨ 已阻止冷启动跳转精选页");
    }
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleDailyRec(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (obj && obj.Data && obj.Data.Items) {
      obj.Data.Items = [];
      $.log("✨ 已清除每日推荐");
    }
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleAccountPage(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (obj && obj.Data && CONFIG.AccountPageDelKeys) {
      CONFIG.AccountPageDelKeys.forEach(k => {
        if (obj.Data[k]) delete obj.Data[k];
      });
      $.log("✨ 已删除营销模块 (福利中心/活动中心/我的阅历)");
    }
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleReject() {
  $.done({ status: 404 });
}

// 预编码的 1 秒 MP4 (H.264 320x240 黑屏, 655 bytes)
const ONE_SEC_MP4_BASE64 = "AAAAFGZ0eXBpc29tAAAAAWlzb20AAAJKbW9vdgAAAGhtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB2nRyYWsAAABcdGtoZAAAAAcAAAAAAAAAAAAAAAEAAAAAAAAD6AAAAAAAAAAAAAAAAAEAAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAABQAAAAPAAAAAAAXZtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAAPoAAAD6FXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAEhbWluZgAAABR2bWhkAAAAAAAAAAAAAAAAAAAAKGRpbmYAAAAgZHJlZgAAAAAAAAABAAAAEHVybCAAAAAAAAAAAQAAAN1zdGJsAAAAdXN0c2QAAAAAAAAAAQAAAGVhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAABQADwAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFwFCAB7/4QAIQgAeq0B4FgABAAQ4gAAAAAAAGHN0dHMAAAAAAAAAAQAAAAEAAAPoAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABhzdHN6AAAAAAAAAAAAAAABAAAAKQAAABRzdGNvAAAAAAAAAAEAAAJmAAAAMW1kYXQAAAABZ0IAHqtAeBYAAAABaM44gAAAAAFliIQAR//89S5qCCNTGQASiA==";

function handleVideoReplace() {
  try {
    const mp4 = Uint8Array.from(atob(ONE_SEC_MP4_BASE64), c => c.charCodeAt(0));
    $.log("已替换 GDT 视频为 1 秒");
    $.done({ body: mp4 });
  } catch (e) {
    $.log(`视频替换失败: ${e}`);
    $.done();
  }
}

function handleAdListBatch(url, response) {
  if (CONFIG.AdWhitelist.some(kw => url.includes(kw))) {
    $.done();
    return;
  }
  try {
    const obj = safeJsonParse(response.body);
    if (!obj) { $.done(); return; }
    // 清空广告数据，保持结构完整
    if (obj.Data) {
      if (typeof obj.Data === "object" && !Array.isArray(obj.Data)) {
        for (const key of Object.keys(obj.Data)) {
          if (Array.isArray(obj.Data[key])) obj.Data[key] = [];
        }
      } else if (Array.isArray(obj.Data)) {
        obj.Data = [];
      }
    }
    $.log("✨ 已拦截批量广告");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}
function Env(n) {
  this.name = n;
  this.isL = typeof $loon !== "undefined";
  this.isQ = typeof $task !== "undefined";
  this.log = (...a) => console.log(`[${this.name}] ` + a.join(" "));
  this.wait = (m) => new Promise(r => setTimeout(r, m));
  this.done = (o = {}) => $done(o);
  this.get = (k) => {
    let v = this.isL ? $persistentStore.read(k) : $prefs.valueForKey(k);
    try { return JSON.parse(v) } catch (e) { return v }
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
  this.clean = (obj, ps) => {
    if (!obj || !ps) return obj;
    ps.forEach(path => applyCleanRule(obj, path.split(".")));
    return obj;
  };
  this.notify = (t, s, b) => this.isL ? $notification.post(t, s, b) : $notify(t, s, b);
}

$.clean = Env.prototype.clean;

function safeJsonParse(body) {
  try { return JSON.parse(body); } catch (e) { return null; }
}

function normalizeHeaders(headers = {}) {
  const h = { ...headers };
  delete h["Content-Length"];
  delete h["content-length"];
  return h;
}

function patchDurationFields(value, keys, nextValue) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(item => patchDurationFields(item, keys, nextValue));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (keys.includes(key) && typeof item === "number") {
      value[key] = nextValue;
      continue;
    }
    patchDurationFields(item, keys, nextValue);
  }
}

function replaceVideoUrls(obj, newUrl) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach(item => replaceVideoUrls(item, newUrl));
    return;
  }
  for (const [key, val] of Object.entries(obj)) {
    if (key === "video" && typeof val === "string" && val.includes(".mp4")) {
      obj[key] = newUrl;
      continue;
    }
    replaceVideoUrls(val, newUrl);
  }
}

function parseSelector(segment) {
  const match = /^([^[\]]+)(?:\[([^=\]]+)=([^\]]+)\])?$/.exec(segment);
  if (!match) return { key: segment };
  return { key: match[1], filterKey: match[2], filterValue: match[3] };
}

function applyCleanRule(target, segments, index = 0) {
  if (!target || index >= segments.length) return;
  const { key, filterKey, filterValue } = parseSelector(segments[index]);
  const current = target[key];
  if (current == null) return;
  if (index === segments.length - 1) {
    if (filterKey && Array.isArray(current)) {
      target[key] = current.filter(item => String(item?.[filterKey]) !== filterValue);
      return;
    }
    delete target[key];
    return;
  }
  if (filterKey && Array.isArray(current)) {
    current
      .filter(item => String(item?.[filterKey]) === filterValue)
      .forEach(item => applyCleanRule(item, segments, index + 1));
    return;
  }
  applyCleanRule(current, segments, index + 1);
}
