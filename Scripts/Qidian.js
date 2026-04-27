/**
 * 📚 起点全能助手 (Pro+ Max版)
 * 集成通用 Env v2.0 深度优化算法
 * 功能：智能重放、全局页面净化、原生广告拦截、底层配置覆写、广告视频秒播
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

  // 2. 页面净化规则
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
    ]
  },

  // 3. 客户端超级配置覆写 (Client Config Overrides)
  // 用于关闭底层开屏广告、第三方 SDK 开关及冗余弹窗
  ClientConfigOverrides: {
    "PangleEnable": "0",                  // 彻底关闭穿山甲广告 SDK
    "DisableQidianBurryReport": "1",      // 禁用起点内部核心埋点数据上报
    "DisableNewabInBI": "1",              // 禁用新的 BI 埋点
    "SplashScreenInterval": "0",          // 开屏间隔置0
    "BusinessSplashCoolDownTime": "99999",// 商业开屏广告冷却时间拉满
    "PushDialogFrequency": "0",           // 关闭推屏弹窗频率
    "EnableMonitorLog": "0",              // 关闭监控日志
    "EnableBeaconFullBurry": "0"          // 关闭信标全量埋点
  },

  // 4. 原生广告放行白名单
  AdWhitelist: ["ioscheckin", "reward", "video"],

  // 5. 视频广告时长强制跳过设定 (单位: 秒)
  VideoSkipSeconds: 1
};


// ==========================================
// 🚀 主入口程序 (Main Execution)
// ==========================================
!(async () => {
  const { url, method } = $request;
  
  // A. 第三方广告 SDK 秒播逻辑 (广点通/穿山甲)
  if (url.includes("/gdt_inner_view") || url.includes("/get_ads")) {
    handleAdSkip($response);
  }
  else {
    const path = new URL(url).pathname;

    // B. 自动重放逻辑 (拦截 POST 请求体)
    if (path === "/argus/api/v1/video/adv/finishWatch" && method === "POST") {
      await handleReplay($request);
    } 
    
    // C. 底层配置强力覆写
    else if (path.includes("/v1/client/getconf")) {
      handleClientConfig($response);
    }

    // D. 全局原生广告拦截 (拦截业务线广告分发)
    else if (path.includes("/adv/getadvlistbatch")) {
      handleGlobalAdBlock(url, $response);
    }

    // E. 页面模块净化逻辑 (基于 CleanRules)
    else if (CONFIG.CleanRules[path]) {
      handleClean(path, $response);
    } 
    
    // 未匹配任何规则直接放行
    else {
      $.done();
    }
  }

})().catch(e => $.log(`运行时全局异常: ${e}`)).finally(() => $.done());


// ==========================================
// 🛠️ 核心业务逻辑 (Core Functions)
// ==========================================

/**
 * 客户端全局超级配置篡改
 * 强行关闭后台下发的广告引擎开关、弹窗开关与监控打点
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
      // 暴击：直接移除广点通对象配置
      if (obj.Data.GDT) {
        delete obj.Data.GDT;
      }
    }
    $.log("✨ 深度优化：已成功覆盖底层超级开关及屏蔽埋点");
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
    $.log("⚠️ 放行福利看视频广告位下发");
    $.done();
    return;
  }
  try {
    let obj = JSON.parse(response.body);
    if (obj && obj.Data) {
      obj.Data = []; 
    }
    $.log("✨ 全局去广告：已拦截常规原生广告下发");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`❌ 原生广告拦截解析失败: ${e}`);
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
    $.log(`❌ 广告时长篡改失败: ${e}`);
    $.done();
  }
}

/**
 * 极速并发重放算法
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
    $.log(`ℹ️ 任务配置为无需重复执行`);
    $.done();
    return;
  }
  
  $.log(`⚡ 抛弃时序延迟，触发 ${replayCount} 次极速并发重放...`);
  const replayTasks = Array.from({ length: replayCount }, async (_, i) => {
    const res = await $.fetch({
      url: request.url,
      method: "POST",
      headers: request.headers,
      body: request.body
    });

    if (res && res.statusCode === 200) {
      $.log(`✅ 重放 [${i + 1}/${replayCount}] 成功`);
    } else {
      $.log(`⚠️ 重放 [${i + 1}/${replayCount}] 异常`);
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
    $.log(`✨ 页面模块净化完成: ${path}`);
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`❌ 页面净化解析失败: ${e}`);
    $.done();
  }
}


// ==========================================
// 📦 底层运行环境 (Environment Wrapper)
// ==========================================
function Env(n){this.name=n;this.startTime=Date.now();this.log=(...m)=>console.log(`[${this.name}] [${new Date().toLocaleTimeString()}] ${m.join(" ")}`);this.wait=(ms)=>new Promise(r=>setTimeout(r,ms));this.done=(v={})=>$done(v);this.get=(k)=>{let v=$prefs.valueForKey(k);try{return JSON.parse(v)}catch(e){return v}};this.set=(v,k)=>{let val=typeof v==="object"?JSON.stringify(v):v;$prefs.setValueForKey(val,k)};this.fetch=async(o)=>{try{return await $task.fetch(o)}catch(e){return null}};this.clean=(obj,ps)=>{if(!obj||!ps)return obj;ps.forEach(p=>{let ks=p.split("."),c=obj;for(let i=0;i<ks.length-1;i++){let k=ks[i];if(k.includes("[")&&k.includes("]")){let[ak,f]=k.split(/[\[\]]/),[fk,fv]=f.split("=");if(c[ak]){c[ak]=c[ak].filter(item=>item[fk]!==fv);return}}c=c[k];if(!c)break}if(c)delete c[ks[ks.length-1]]});return obj};this.notify=(t,s,b)=>$notify(t,s,b)}
