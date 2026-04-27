/**
 * 📚 起点全能助手 (Pro+ Max 终极版)
 * 集成通用 Env v2.0 深度优化算法
 * 功能：智能重放、全局页面净化、特权原生广告拦截、底层配置覆写、广告视频秒播
 * 作者：3kaiu
 */

const $ = new Env("起点助手");

// ==========================================
// ⚙️ 全局配置区 (Global Configuration)
// ==========================================
const CONFIG = {
  // 1. 自动重放任务映射
  TaskMapping: {
    "1218712929269776384": { name: "系列1(激励视频)", count: 9 },
    "1218712929269776388": { name: "系列2(福利任务)", count: 3 }
  },

  // 2. 页面净化规则 (基于 JSON 路径)
  CleanRules: {
    "/argus/api/v1/video/adv/mainPage": [
      "data.bottomNavigation[name=发现]",
      "data.bottomNavigation[name=精选]"
    ],
    "/argus/api/v3/user/getaccountpage": [
      "data.functionModules[moduleName=我的福利]",
      "data.functionModules[moduleName=精彩活动]",
      "data.functionModules[moduleName=我要推广]",
      "data.functionModules[moduleName=我的礼品]"
    ],
    "/argus/api/v1/user/getsimplediscover": [
      "Data.Items[ShowName=游戏中心f]",
      "Data.Items[ShowName=游戏中心]",
      "Data.Items[ShowName=新活动中心]"
    ],
    // 清空书架悬浮窗广告
    "/argus/api/v1/bookshelf/getHoverAdv": [
      "Data.ItemList"
    ],
    // 清空开屏特供广告源
    "/argus/api/v4/client/getsplashscreen": [
      "Data.List"
    ]
  },

  // 3. 客户端超级配置覆写 (Client Config Overrides)
  ClientConfigOverrides: {
    "PangleEnable": "0",                  // 关闭穿山甲 SDK
    "DisableQidianBurryReport": "1",      // 禁用核心埋点
    "DisableNewabInBI": "1",              // 禁用 BI 埋点
    "SplashScreenInterval": "0",          // 开屏间隔置0
    "BusinessSplashCoolDownTime": "99999",// 商业开屏广告冷却时间拉满
    "PushDialogFrequency": "0",           // 关闭推屏弹窗
    "EnableMonitorLog": "0",              // 关闭监控日志
    "EnableBeaconFullBurry": "0"          // 关闭信标打点
  },

  // 4. 原生广告放行白名单 (保证看视频功能正常)
  AdWhitelist: ["ioscheckin", "reward", "video"],

  // 5. 视频广告时长强制跳过设定 (单位: 秒)
  VideoSkipSeconds: 1
};


// ==========================================
// 🚀 主入口程序 (Main Execution)
// ==========================================
!(async () => {
  // 识别是否为 Cron 定时任务运行
  if (typeof $request === "undefined") {
    await handleCron();
    return;
  }

  const { url, method } = $request;
  
  // A. 签到 Token 窃取 (拦截请求头)
  if (url.includes("/v1/client/getconf") && !$response) {
    handleTokenSteal($request);
  }

  // B. 第三方广告 SDK 秒播逻辑
  else if (url.includes("/gdt_inner_view") || url.includes("/get_ads")) {
    handleAdSkip($response);
  }
  else {
    const path = new URL(url).pathname;

    // C. 自动重放逻辑
    if (path === "/argus/api/v1/video/adv/finishWatch" && method === "POST") {
      await handleReplay($request);
    } 
    
    // D. 底层超级配置覆写
    else if (path.includes("/v1/client/getconf")) {
      handleClientConfig($response);
    }

    // D. 全局原生广告及特权广告拦截
    else if (path.includes("/adv/getadvlistbatch")) {
      handleGlobalAdBlock(url, $response);
    }
    // 书架横幅广告与 iOS 特供广告源置空拦截
    else if (path.includes("/bookshelf/getad") || path.includes("/client/iosad")) {
      handleDirectAdKill($response);
    }

    // E. 页面模块与特权弹窗净化逻辑
    else if (CONFIG.CleanRules[path]) {
      handleClean(path, $response);
    } 
    
    // 未匹配放行
    else {
      $.done();
    }
  }

})().catch(e => $.log(`运行时全局异常: ${e}`)).finally(() => $.done());


// ==========================================
// 🛠️ 核心业务逻辑 (Core Functions)
// ==========================================

/**
 * 粗暴秒杀专用特权广告 (如书架广告)
 */
function handleDirectAdKill(response) {
  try {
    let obj = JSON.parse(response.body);
    // 直接移除 Data 内容或置为默认空响应
    if (obj.Data) {
      if (typeof obj.Data === "object") {
        obj.Data = { Show: 0 }; // 针对 bookshelf/getad
      } else {
        obj.Data = null;
      }
    }
    $.log("✨ 终极去广告：已秒杀书架与 iOS 特供广告");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.done();
  }
}

/**
 * 客户端全局超级配置篡改
 */
function handleClientConfig(response) {
  try {
    let obj = JSON.parse(response.body);
    if (obj && obj.Data) {
      for (const [key, value] of Object.entries(CONFIG.ClientConfigOverrides)) {
        if (obj.Data.hasOwnProperty(key)) {
          obj.Data[key] = value;
        }
      }
      if (obj.Data.GDT) delete obj.Data.GDT;
    }
    $.log("✨ 深度优化：已成功覆盖底层超级开关");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`❌ 客户端配置覆写失败: ${e}`);
    $.done();
  }
}

/**
 * 原生广告分发拦截
 */
function handleGlobalAdBlock(url, response) {
  if (CONFIG.AdWhitelist.some(keyword => url.includes(keyword))) {
    $.done();
    return;
  }
  try {
    let obj = JSON.parse(response.body);
    if (obj && obj.Data) obj.Data = []; 
    $.log("✨ 全局去广告：已拦截常规原生广告");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.done();
  }
}

/**
 * 第三方广告秒播算法
 */
function handleAdSkip(response) {
  try {
    const s = CONFIG.VideoSkipSeconds;
    let body = response.body
      .replace(/"video_duration":\s*\d+/g, `"video_duration":${s}`)
      .replace(/"video_timelife":\s*\d+/g, `"video_timelife":${s}`)
      .replace(/"duration":\s*\d+/g, `"duration":${s}`)
      .replace(/"play_time":\s*\d+/g, `"play_time":${s}`);
    
    $.log(`✨ 成功拦截底层广告 SDK，视频时长强制设为 ${s} 秒`);
    $.done({ body });
  } catch (e) {
    $.done();
  }
}

/**
 * 窃取用户身份 Token
 */
function handleTokenSteal(request) {
  if (request.headers) {
    $.set(request.headers, "Qidian_Headers");
    $.log("✨ 成功窃取并保存起点身份 Token，已准备好自动签到");
  }
  $.done();
}

/**
 * 每日静默全自动签到 (Cron 触发)
 */
async function handleCron() {
  $.log("⏰ 开始执行起点全自动静默签到...");
  const headers = $.get("Qidian_Headers");
  if (!headers) {
    $.log("❌ 缺少起点 Token，请先打开一次起点 App 获取！");
    $.notify("起点全能助手", "自动签到失败", "请先打开一次起点App获取Token");
    $.done();
    return;
  }
  
  // 伪造完整的签到请求
  const res = await $.fetch({
    url: "https://magev6.if.qidian.com/argus/api/v2/checkin/checkin",
    method: "GET",
    headers: headers
  });

  if (res && res.body) {
    try {
      const obj = JSON.parse(res.body);
      if (obj.Result === 0) {
        $.notify("起点全能助手", "🎉 每日签到成功", `获得奖励: ${obj.Message || "硬币/经验已入账"}`);
        $.log(`✅ 签到成功: ${res.body}`);
      } else {
        $.notify("起点全能助手", "⚠️ 签到异常/已签到", obj.Message || "未知状态");
      }
    } catch (e) {
      $.log(`❌ 签到解析失败: ${e}`);
    }
  }
  $.done();
}

/**
 * 极速并发重放算法 (加入智能 TCP 抖动防封)
 */
async function handleReplay(request) {
  const body = request.body || "";
  const match = Object.keys(CONFIG.TaskMapping).find(id => body.includes(id));
  if (!match) {
    $.done(); 
    return;
  }
  const task = CONFIG.TaskMapping[match];
  $.log(`🚀 识别到自动化任务: ${task.name}`);

  const replayCount = task.count - 1;
  if (replayCount <= 0) {
    $.done();
    return;
  }
  
  $.log(`⚡ 触发 ${replayCount} 次并发重放 (附带 15ms 智能抖动)...`);
  const replayTasks = Array.from({ length: replayCount }, async (_, i) => {
    await $.wait(i * 15); // 智能排队防封
    const res = await $.fetch({
      url: request.url,
      method: "POST",
      headers: request.headers,
      body: request.body
    });
    if (res && res.statusCode === 200) {
      $.log(`✅ 重放 [${i + 1}/${replayCount}] 成功`);
    }
  });

  $.done(); 
  await Promise.all(replayTasks);
  $.notify("起点自动化助手", "", `${task.name} 共 ${task.count} 次任务极速闭环完成`);
}

/**
 * 路径化净化算法
 */
function handleClean(path, response) {
  try {
    let obj = JSON.parse(response.body);
    const rules = CONFIG.CleanRules[path];
    obj = $.clean(obj, rules);
    
    // 如果净化后的节点刚好为空，直接初始化为空数组确保安全
    if (path.includes("getsplashscreen")) {
      if (!obj.Data) obj.Data = {};
      if (!obj.Data.List) obj.Data.List = [];
    }
    if (path.includes("getHoverAdv")) {
      if (!obj.Data) obj.Data = {};
      if (!obj.Data.ItemList) obj.Data.ItemList = [];
    }

    $.log(`✨ 页面模块/弹窗净化完成: ${path}`);
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.done();
  }
}

// ==========================================
// 📦 底层运行环境 (Environment Wrapper)
// ==========================================
function Env(n){this.name=n;this.startTime=Date.now();this.log=(...m)=>console.log(`[${this.name}] [${new Date().toLocaleTimeString()}] ${m.join(" ")}`);this.wait=(ms)=>new Promise(r=>setTimeout(r,ms));this.done=(v={})=>$done(v);this.get=(k)=>{let v=$prefs.valueForKey(k);try{return JSON.parse(v)}catch(e){return v}};this.set=(v,k)=>{let val=typeof v==="object"?JSON.stringify(v):v;$prefs.setValueForKey(val,k)};this.fetch=async(o)=>{try{return await $task.fetch(o)}catch(e){return null}};this.clean=(obj,ps)=>{if(!obj||!ps)return obj;ps.forEach(p=>{let ks=p.split("."),c=obj;for(let i=0;i<ks.length-1;i++){let k=ks[i];if(k.includes("[")&&k.includes("]")){let[ak,f]=k.split(/[\[\]]/),[fk,fv]=f.split("=");if(c[ak]){c[ak]=c[ak].filter(item=>item[fk]!==fv);return}}c=c[k];if(!c)break}if(c)delete c[ks[ks.length-1]]});return obj};this.notify=(t,s,b)=>$notify(t,s,b)}
