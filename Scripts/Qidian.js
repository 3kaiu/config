/**
 * 📚 起点全能助手 v4.3
 * 作者：3kaiu
 *
 * v4.3 更新:
 *  1. 发现页 — 移除全部非阅读模块 (游戏/活动/红包/商城等)，保留书单/专栏/ip专区
 *  2. 每日导读 — 放行 widget/daily/rec，不再清空
 *  3. 福利中心 mainPage — 修复"无法完成"：保留 TaskList，将所有任务标记为已完成
 *     (IsFinished=1, Process=Total)，让 App 显示可领取状态
 *  4. 视频广告 — 直接将 IsFinished 置 1，跳过视频播放；保留 1s MP4 作为后备
 *  5. 每日阅读积分 — readtime/readpage 将 TodayReadTime 改写为满值，TaskList 全部标记完成
 *  6. getconf response — 独立入口确保 BookShelfBottomIcons 等悬浮广告字段被删除
 */
const $ = new Env("起点助手");

const CONFIG = {
  // finishWatch 重放任务映射
  TaskMapping: {
    "1218712929269776384": { name: "激励视频", count: 9 },
    "1218712929269776388": { name: "福利任务", count: 3 }
  },

  // getconf 广告/追踪字段覆写
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
    "ReloadExposureEnabled": "false",
    "QDABRegularReportTimeSpan": "999999",
    "QDABReportMinThreshold": "999999",
    "RankBuryPoint": "0",
    "CheckInPushSwitchReport": "0",
    "WolfEye": 0,
    "MainTabActivityRunning": 0,
    "DailyReadRecReasonSwitch": 0,
    "DailyRecommendGray": 0,
    "EnableShareChapterPloy": 0,
    "EnableChapterAdvanceGuide": 0,
    "AddBookShelfNoticeFrequency": "999999",
    "BookShelfPushNoticeFrequency": "999999",
    "UGCPushNoticeFrequency": "999999",
    "NotificationPageBackPushNoticeFrequency": "999999",
    "ActivityPageBackPushNoticeFrequency": "999999",
    "InAppPushLimitMinutes": "999999",
    "PushNoticeFrequency": "-1",
    "AegisSignOn": 0,
    "EnableFockRetryStrategy": 0
  },

  // getconf 整段删除的 key（悬浮广告/活动图标/推广模块）
  DeleteKeys: [
    "ActivityIcon", "ActivityPopup", "LuckBag",
    "BookShelfBottomIcons", "ClassicBookInfo", "ClientLocalNotify2",
    "PushDialogScenes", "RewardSatisfyDialog", "FansClubPropInfo",
    "AdVideoPositionConfig"
  ],

  // 直接 404 拒绝的纯广告/营销端点
  RejectPaths: [
    "checkin/lottery", "push/getdialog",
    "booksearch/hotWords", "maintain/playstrip", "young/getconf",
    "followsubscribe/showChapterEndModule", "freshman/bookshelfbtn",
    "freshman/freshmanGuidePopup",
    "message/getpushedmessagelist", "dailyrecommend/recommendBook",
    "bookshelf/getTopOperation",
    "popup/batchget", "ploy/getactivitylist",
    "message/pullOperationPush", "message/pullSocialPush",
    "video/adv/reportDialog", "interaction/getclassicbookinfo"
  ],

  // getaccountpage 删除营销模块
  AccountPageDelKeys: ["BenefitButtonList"],

  // 发现页保留的 KeyName 白名单（其余全部删除）
  DiscoverKeepKeys: [
    "NEW_ZHUANQU",    // ip专区
    "NEW_ZHUANLAN",   // 专栏
    "NEW_SHUDAN",     // 书单
    "NEW_DIANDIANQUAN" // 点点圈
  ],

  // 每日阅读积分满值（秒/天）— 对应 App 显示"今日已读满"
  ReadTimeFull: 7200,

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

  // A. Token 窃取 (request 阶段，精确匹配 getconf)
  if (url.includes("/v1/client/getconf") && url.includes("magev6") && !$response) {
    handleTokenSteal($request);
    return;
  }
  // A2. getconf response 覆写 — 删除悬浮广告字段
  if (url.includes("/v1/client/getconf") && $response) {
    handleClientConfig($response);
    return;
  }
  // B. GDT 视频拦截 — 返回 1 秒视频
  if (url.includes(".mp4") && url.includes("adsmind.gdtimg.com")) {
    handleVideoReplace();
    return;
  }
  // C. 广告 SDK 秒播
  if (url.includes("/gdt_inner_view") || url.includes("/get_ads")) {
    handleAdSkip($response);
    return;
  }

  const urlObj = new URL(url);
  const path = urlObj.pathname;

  // D. 直接拒绝纯广告端点
  if (CONFIG.RejectPaths.some(p => path.includes(p))) {
    handleReject();
    return;
  }
  // E. 自动重放
  if (path.endsWith("/video/adv/finishWatch") && method === "POST") {
    await handleReplay($request);
    return;
  }
  // F. 开屏广告
  if (path.includes("getsplashscreen")) {
    handleSplashScreen($response);
    return;
  }
  // G. Deeplink
  if (path.includes("deeplink/geturl")) {
    handleDeeplink($response);
    return;
  }
  // H. 每日推荐
  if (path.includes("dailyrecommend")) {
    handleDailyRec($response);
    return;
  }
  // I. 我的账户页
  if (path.includes("getaccountpage")) {
    handleAccountPage($response);
    return;
  }
  // J. 批量广告
  if (path.includes("adv/getadvlistbatch")) {
    handleAdListBatch(url, $response);
    return;
  }
  // K. 直接置空广告
  if (CONFIG.DirectKillPaths.some(p => path.includes(p))) {
    handleDirectAdKill(url, $response);
    return;
  }
  // L. 福利中心主页 — 标记任务已完成，不清空
  if (path.includes("video/adv/mainPage") && !path.includes("Dialog")) {
    handleMainPage($response);
    return;
  }
  // M. 发现页 — 按白名单过滤
  if (path.includes("getsimplediscover")) {
    handleDiscover($response);
    return;
  }
  // N. 书架悬浮广告
  if (path.includes("getHoverAdv")) {
    handleHoverAdv($response);
    return;
  }
  // O. 每日阅读积分
  if (path.includes("readtime/readpage")) {
    handleReadTime($response);
    return;
  }
  // P. 其余净化规则
  if (matchCleanRule(path)) {
    handleClean(path, $response);
    return;
  }

  $.done();

})().catch(e => {
  $.log(`异常: ${e}`);
  $.done();
});

// ==========================================
// 🛠️ 核心函数
// ==========================================

function handleTokenSteal(request) {
  try {
    if (request.headers) {
      $.set(request.headers, "Qidian_Headers");
      $.log("✨ 已保存起点 Token");
    }
    $.done();
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
    CONFIG.DeleteKeys.forEach(k => { delete obj.Data[k]; });

    // 关闭发现 tab（NewFeedsDiscover=0 已由 getconf 服务端返回，此处强制确保）
    obj.Data.NewFeedsDiscover = 0;

    if (obj.Data.CloudSetting && obj.Data.CloudSetting.TeenShowFreq) {
      obj.Data.CloudSetting.TeenShowFreq = "0";
    }
    if (obj.Data.GDT) delete obj.Data.GDT;

    $.log("✨ 已覆盖客户端配置");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`❌ 配置覆写失败: ${e}`);
    $.done();
  }
}

/**
 * 福利中心主页 — 保留 TaskList，将所有任务标记为已完成可领取
 * 不清空 TaskList，否则 App 显示"无法完成"
 */
function handleMainPage(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (!obj || !obj.Data) { $.done(); return; }
    const data = obj.Data;

    // DailyBenefitModule — 标记所有任务已完成
    if (data.DailyBenefitModule && Array.isArray(data.DailyBenefitModule.TaskList)) {
      data.DailyBenefitModule.TaskList.forEach(t => {
        t.IsFinished = 1;
        if (t.Total > 0) t.Process = t.Total;
      });
      data.DailyBenefitModule.RotateText = [];
    }

    // VideoRewardTab — 标记已完成
    if (data.VideoRewardTab && Array.isArray(data.VideoRewardTab.TaskList)) {
      data.VideoRewardTab.TaskList.forEach(t => { t.IsFinished = 1; });
    }

    // 清除纯营销模块（不影响任务领取）
    delete data.BaizeModule;
    delete data.IndexBannerTabs;
    delete data.MemberExclusiveTaskModule;
    delete data.MoreRewardTab;
    delete data.PrivilegedTaskModule;
    delete data.RedeemGifts;
    delete data.ScoreDrawModule;
    delete data.SurpriseBenefit;
    delete data.LastRewardItems;
    delete data.TaskShowData;

    $.log("✨ 福利中心任务已标记完成");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

/**
 * 发现页 — 只保留白名单 KeyName，其余全部过滤
 */
function handleDiscover(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (!obj || !obj.Data || !Array.isArray(obj.Data.Items)) { $.done(); return; }
    obj.Data.Items = obj.Data.Items.filter(
      item => CONFIG.DiscoverKeepKeys.includes(item.KeyName)
    );
    $.log(`✨ 发现页已过滤，保留 ${obj.Data.Items.length} 项`);
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

/**
 * 书架悬浮广告 — 清空 ItemList
 */
function handleHoverAdv(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (!obj) { $.done(); return; }
    if (!obj.Data) obj.Data = {};
    obj.Data.ItemList = [];
    $.log("✨ 已清除悬浮广告");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

/**
 * 每日阅读积分 — 将今日阅读时长改写为满值，任务全部标记完成
 * 注意：积分实际由服务端计算，此处只改 App 显示；真实积分需实际阅读
 */
function handleReadTime(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (!obj || !obj.Data) { $.done(); return; }
    const data = obj.Data;

    if (data.ReadInfo) {
      data.ReadInfo.TodayReadTime = CONFIG.ReadTimeFull;
    }
    if (data.TaskModule && Array.isArray(data.TaskModule.TaskList)) {
      data.TaskModule.TaskList.forEach(t => {
        t.Status = 2; // 2 = 已完成可领取
      });
    }
    $.log("✨ 每日阅读积分已满");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleAdSkip(response) {
  try {
    const s = CONFIG.VideoSkipSeconds;
    const obj = safeJsonParse(response.body);

    if (obj) {
      // 只 patch 时长字段，让 SDK 认为广告 1 秒就结束
      // adsmind.gdtimg.com 的 .mp4 下载由 handleVideoReplace 直接拦截
      patchDurationFields(obj, CONFIG.AdDurationKeys, s);
      $.done({ body: JSON.stringify(obj) });
      return;
    }

    let body = String(response.body || "");
    body = body
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

function handleReject() {
  $.done({ status: 404 });
}

// 预编码的 1 秒 MP4 (H.264 320x240 黑屏, 655 bytes)
const ONE_SEC_MP4_BASE64 = "AAAAFGZ0eXBpc29tAAAAAWlzb20AAAJKbW9vdgAAAGhtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB2nRyYWsAAABcdGtoZAAAAAcAAAAAAAAAAAAAAAEAAAAAAAAD6AAAAAAAAAAAAAAAAAEAAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAABQAAAAPAAAAAAAXZtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAAPoAAAD6FXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAEhbWluZgAAABR2bWhkAAAAAAAAAAAAAAAAAAAAKGRpbmYAAAAgZHJlZgAAAAAAAAABAAAAEHVybCAAAAAAAAAAAQAAAN1zdGJsAAAAdXN0c2QAAAAAAAAAAQAAAGVhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAABQADwAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFwFCAB7/4QAIQgAeq0B4FgABAAQ4gAAAAAAAGHN0dHMAAAAAAAAAAQAAAAEAAAPoAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABhzdHN6AAAAAAAAAAAAAAABAAAAKQAAABRzdGNvAAAAAAAAAAEAAAJmAAAAMW1kYXQAAAABZ0IAHqtAeBYAAAABaM44gAAAAAFliIQAR//89S5qCCNTGQASiA==";

function handleVideoReplace() {
  try {
    const mp4 = Uint8Array.from(atob(ONE_SEC_MP4_BASE64), c => c.charCodeAt(0));
    $.done({ body: mp4.buffer, headers: { "Content-Type": "video/mp4" } });
  } catch (e) {
    $.done();
  }
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

function handleSplashScreen(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (obj && obj.Data) {
      if (Array.isArray(obj.Data.List)) obj.Data.List = [];
      if (Array.isArray(obj.Data)) obj.Data = [];
    }
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleDeeplink(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (obj && obj.Data) obj.Data = {};
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleDailyRec(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (obj && obj.Data && obj.Data.Items) obj.Data.Items = [];
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleAccountPage(response) {
  try {
    const obj = safeJsonParse(response.body);
    if (obj && obj.Data) {
      CONFIG.AccountPageDelKeys.forEach(k => { delete obj.Data[k]; });
    }
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleAdListBatch(url, response) {
  try {
    if (CONFIG.AdWhitelist.some(kw => url.includes(kw))) { $.done(); return; }
    const obj = safeJsonParse(response.body);
    if (!obj) { $.done(); return; }
    if (obj.Data) obj.Data = Array.isArray(obj.Data) ? [] : {};
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

function handleDirectAdKill(url, response) {
  try {
    if (CONFIG.AdWhitelist.some(kw => url.includes(kw))) { $.done(); return; }
    const obj = safeJsonParse(response.body);
    if (!obj) { $.done(); return; }
    if (obj.Data) obj.Data = Array.isArray(obj.Data) ? [] : {};
    $.log("✨ 已秒杀原生广告");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

// ==========================================
// CleanRules — 剩余端点的精细净化
// ==========================================
const CLEAN_RULES = {
  "video/adv/mainPageDialog": ["Data"],
  "reddot/getdot":            ["Data"],
  "checkin/checkinexchangepage": ["Data.Goods"]
};

function matchCleanRule(path) {
  return Object.keys(CLEAN_RULES).some(k => path.includes(k));
}

function getCleanRules(path) {
  for (const [k, rules] of Object.entries(CLEAN_RULES)) {
    if (path.includes(k)) return rules;
  }
  return null;
}

function handleClean(path, response) {
  try {
    let obj = safeJsonParse(response.body);
    if (!obj) { $.done(); return; }
    const rules = getCleanRules(path);
    if (rules) {
      rules.forEach(r => applyCleanRule(obj, r.split(".")));
    }
    $.log(`✨ 净化完成: ${path.split("/").pop()}`);
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

// ==========================================
// ⏰ Cron 签到
// ==========================================
async function handleCron() {
  const headers = $.get("Qidian_Headers");
  if (!headers) {
    $.notify("起点助手", "签到失败", "未找到 Token，请先打开起点 App");
    $.done();
    return;
  }

  try {
    const res = await $.fetch({
      url: "https://magev6.if.qidian.com/argus/api/v2/checkin/checkin",
      method: "POST",
      headers: normalizeHeaders(headers),
      body: ""
    });

    if (res && res.statusCode === 200) {
      const obj = safeJsonParse(res.body);
      if (obj && obj.Result === 0) {
        $.notify("起点助手", "✅ 签到成功", obj.Message || "今日签到完成");
      } else if (obj && obj.Result === -452000) {
        $.notify("起点助手", "📅 今日已签到", "");
      } else {
        $.notify("起点助手", "⚠️ 签到异常", JSON.stringify(obj));
      }
    }
  } catch (e) {
    $.notify("起点助手", "❌ 签到失败", String(e));
  }
  $.done();
}

// ==========================================
// 🔧 工具函数
// ==========================================
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
  if (value.name && ["rewardTime", "appearanceTime", "minVideoTime", "videoTime"].includes(value.name) && Array.isArray(value.data)) {
    value.data.forEach(d => {
      if (d && d.data && d.data.int_val !== undefined) d.data.int_val = String(nextValue);
    });
  }
  for (const [key, item] of Object.entries(value)) {
    if (keys.includes(key)) {
      if (typeof item === "number") { value[key] = nextValue; continue; }
      if (typeof item === "string" && !isNaN(item)) { value[key] = String(nextValue); continue; }
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
    current.filter(item => String(item?.[filterKey]) === filterValue)
           .forEach(item => applyCleanRule(item, segments, index + 1));
    return;
  }
  applyCleanRule(current, segments, index + 1);
}

function safeJsonParse(body) {
  try { return JSON.parse(body); } catch (e) { return null; }
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
        else { res.body = b; res.statusCode = res.status || 200; r(res); }
      });
    }
  });
  this.notify = (t, s, b) => this.isL ? $notification.post(t, s, b) : $notify(t, s, b);
}
