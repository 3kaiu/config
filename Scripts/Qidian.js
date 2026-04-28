/**
 * 📚 起点全能助手 Pro v3.0
 * 基于 2026-04 五批次 ×553+ 抓包深度重构
 * 作者：3kaiu
 */
const $ = new Env("起点助手");

// ==========================================
// ⚙️ 配置区
// ==========================================
const CONFIG = {
  TaskMapping: {
    "1218712929269776384": { name: "激励视频", count: 9 },
    "1218712929269776388": { name: "福利任务", count: 3 }
  },

  // 页面净化 (支持 v1/v2/v3 通用匹配)
  CleanRules: {
    // 视频广告首页 (v1/v2 共用)
    "video/adv/mainPage": [
      "Data.DailyBenefitModule.TaskList"
    ],
    // 视频广告弹窗
    "video/adv/mainPageDialog": [
      "Data"
    ],
    // 批量广告获取
    "adv/getadvlistbatch": [
      "Data"
    ],
    // 书架悬浮广告
    "bookshelf/getHoverAdv": [
      "Data.ItemList"
    ],
    "bookshelf/getTopOperation": [
      "Data"
    ],
    // 开屏广告
    "client/getsplashscreen": [
      "Data.List"
    ],
    // 发现页模块
    "user/getsimplediscover": [
      "Data.Items[ShowName=游戏中心f]",
      "Data.Items[ShowName=游戏中心]",
      "Data.Items[ShowName=新活动中心]",
      "Data.Items[ShowName=红包广场]"
    ],
    // 每日推荐
    "widget/daily/rec": [
      "Data"
    ],
    // 红点推送
    "reddot/getdot": [
      "Data"
    ]
  },

  // 直接置空 (无需路径匹配，直接杀)
  DirectKillPaths: [
    "bookshelf/getad",
    "client/iosad",
    "adv/getadvlistbatch"
  ],

  // 客户端配置覆写
  ClientConfigOverrides: {
    "PangleEnable": "0",
    "DisableQidianBurryReport": "1",
    "DisableNewabInBI": "1",
    "SplashScreenInterval": "0",
    "SplashScreenRoundCount": "0",
    "BusinessSplashCoolDownTime": "99999",
    "PushDialogFrequency": "0",
    "EnableMonitorLog": "0",
    "EnableBeaconFullBurry": "0",
    "DailyRecommendGray": "0",
    "EnableSubscriptionAward": "0",
    "ReloadExposureEnabled": "false",
    "QDABRegularReportTimeSpan": "999999",
    "QDABReportMinThreshold": "999999",
    "RankBuryPoint": "0",
    "CheckInPushSwitchReport": "0",
    "UserGrowthEnable": "0",
    "IsReceiveFreeReading": "0"
  },

  // 广告放行白名单 (保证奖励视频、签到等功5能正常)
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

  // A. Token 窃取
  if (url.includes("/v1/client/getconf") && !$response) {
    handleTokenSteal($request);
  }
  // B. 广告 SDK 秒播
  else if (url.includes("/gdt_inner_view") || url.includes("/get_ads")) {
    handleAdSkip($response);
  }
  else {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // C. 自动重放
    if (path.endsWith("/video/adv/finishWatch") && method === "POST") {
      await handleReplay($request);
    }
    // D. 客户端配置覆写 (精确匹配，排除 getconfSpecify)
    else if (path.endsWith("/v1/client/getconf")) {
      handleClientConfig($response);
    }
    // E. 直接置空杀广告
    else if (CONFIG.DirectKillPaths.some(p => path.includes(p))) {
      handleDirectAdKill(url, $response);
    }
    // F. 页面净化
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
    for (const [k, v] of Object.entries(CONFIG.ClientConfigOverrides)) {
      obj.Data[k] = v;
    }
    // 删除 GDT 配置 + 广告位置配置
    if (obj.Data.GDT) delete obj.Data.GDT;
    if (obj.Data.AdVideoPositionConfig) obj.Data.AdVideoPositionConfig = [];
    if (obj.Data.AbtestUrls) delete obj.Data.AbtestUrls;
    $.log("✨ 已覆盖客户端超级开关 (v3.0)");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`❌ 配置覆写失败: ${e}`);
    $.done();
  }
}

function handleAdSkip(response) {
  try {
    const s = CONFIG.VideoSkipSeconds;
    const obj = safeJsonParse(response.body);
    if (obj) {
      patchDurationFields(obj, CONFIG.AdDurationKeys, s);
      $.done({ body: JSON.stringify(obj) });
      return;
    }
    const body = String(response.body || "")
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

// ==========================================
// 🔧 工具函数
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
