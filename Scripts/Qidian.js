/**
 * 📚 起点全能助手 (Pro+ Max版)
 * 集成通用 Env v2.0 深度优化算法
 * 功能：智能重放、全局页面净化、原生广告拦截、广告视频秒播
 * 作者：3kaiu
 */

const $ = new Env("起点助手");

// ==========================================
// ⚙️ 全局配置区 (Global Configuration)
// ==========================================
const CONFIG = {
  // 1. 自动重放任务映射
  // Key: taskId, Value: { name: 任务名称, count: 需重放的总次数 }
  TaskMapping: {
    "1218712929269776384": { name: "系列1(激励视频)", count: 9 },
    "1218712929269776388": { name: "系列2(福利任务)", count: 3 }
  },

  // 2. 页面净化规则
  // Key: API 路径, Value: 需移除的 JSON 节点路径数组
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

  // 3. 原生广告放行白名单
  // 若 URL 包含以下关键字，则不对其广告进行屏蔽（以防导致福利视频无法加载）
  AdWhitelist: ["ioscheckin", "reward", "video"],

  // 4. 视频广告时长强制跳过设定 (单位: 秒)
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
    
    // C. 全局原生广告拦截 (拦截业务线广告分发)
    else if (path.includes("/adv/getadvlistbatch")) {
      handleGlobalAdBlock(url, $response);
    }

    // D. 页面模块净化逻辑 (基于 CleanRules)
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
 * 原生广告分发拦截
 * 清空常规流内、底部 Tab 广告，放行白名单内的福利广告位
 */
function handleGlobalAdBlock(url, response) {
  // 检查白名单
  if (CONFIG.AdWhitelist.some(keyword => url.includes(keyword))) {
    $.log("⚠️ 放行福利看视频广告位下发");
    $.done();
    return;
  }

  try {
    let obj = JSON.parse(response.body);
    if (obj && obj.Data) {
      obj.Data = []; // 清空所有常规广告下发
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
 * 拦截 SDK 响应，将视频强制配置为 Config.VideoSkipSeconds
 */
function handleAdSkip(response) {
  try {
    const s = CONFIG.VideoSkipSeconds;
    // 使用正则批量篡改时间，避免超大 JSON Parse 导致 QX 崩溃
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
  
  // 匹配 TaskId
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

  // 构建并发请求队列
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
      $.log(`⚠️ 重放 [${i + 1}/${replayCount}] 异常 (状态码: ${res ? res.statusCode : "N/A"})`);
    }
  });

  // 并发等待期间优先放行用户的原始请求，确保 App 不卡顿
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
