/**
 * 📚 起点全能助手 (Pro+ Max版)
 * 集成通用 Env v2.0 深度优化算法
 * 功能：智能重放、全局页面净化、原生广告拦截、广告视频秒播
 */

const $ = new Env("起点助手");

// --- 配置区 ---
const CLEAN_RULES = {
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
};

const TASK_MAPPING = {
  "1218712929269776384": { name: "系列1(激励视频)", count: 9 },
  "1218712929269776388": { name: "系列2(福利任务)", count: 3 }
};

// --- 主程序 ---
!(async () => {
  const { url, method } = $request;
  
  // 1. 广点通/穿山甲广告秒播逻辑
  if (url.includes("/gdt_inner_view") || url.includes("/get_ads")) {
    handleAdSkip($response);
  }
  else {
    const path = new URL(url).pathname;

    // 2. 自动重放逻辑 (POST 请求)
    if (path === "/argus/api/v1/video/adv/finishWatch" && method === "POST") {
      await handleReplay($request);
    } 
    
    // 3. 全局原生广告分发拦截 (放行福利相关位)
    else if (path.includes("/adv/getadvlistbatch")) {
      handleGlobalAdBlock(url, $response);
    }

    // 4. 页面净化逻辑 (GET 响应)
    else if (CLEAN_RULES[path]) {
      await handleClean(path, $response);
    } else {
      $.done();
    }
  }

})().catch(e => $.log(`运行时错误: ${e}`)).finally(() => $.done());

// --- 核心函数 ---

/**
 * 原生广告分发拦截
 * 清空大部分流内广告、底部 Tab 广告，但必须放行福利和签到的视频位
 */
function handleGlobalAdBlock(url, response) {
  // 放行福利和签到相关的广告位，否则将无法触发看视频
  if (url.includes("ioscheckin") || url.includes("reward") || url.includes("video")) {
    $.log("⚠️ 放行福利看视频广告位下发");
    $.done();
    return;
  }

  try {
    let obj = JSON.parse(response.body);
    if (obj && obj.Data) {
      obj.Data = []; // 清空所有常规广告下发
    }
    $.log("✨ 全局去广告：已拦截常规广告位下发");
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`❌ 广告拦截失败: ${e}`);
    $.done();
  }
}

/**
 * 广告秒播算法 (跳过15/30秒等待)
 */
function handleAdSkip(response) {
  try {
    let body = response.body
      .replace(/"video_duration":\s*\d+/g, '"video_duration":1')
      .replace(/"video_timelife":\s*\d+/g, '"video_timelife":1')
      .replace(/"duration":\s*\d+/g, '"duration":1')
      .replace(/"play_time":\s*\d+/g, '"play_time":1');
    
    $.log("✨ 成功拦截广告下发，视频时长已强制修改为 1 秒");
    $.done({ body });
  } catch (e) {
    $.log(`❌ 广告时长修改失败: ${e}`);
    $.done();
  }
}

/**
 * 极速重放算法
 */
async function handleReplay(request) {
  const body = request.body || "";
  const match = Object.keys(TASK_MAPPING).find(id => body.includes(id));
  
  if (!match) {
    $.done(); 
    return;
  }
  const task = TASK_MAPPING[match];
  $.log(`🚀 识别到任务: ${task.name}`);

  const replayCount = task.count - 1;
  if (replayCount <= 0) {
    $.log(`ℹ️ 无需重复执行`);
    $.done();
    return;
  }
  
  $.log(`⚡ 抛弃间隔，开始极速并发 ${replayCount} 次重放...`);

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
      $.log(`⚠️ 重放 [${i + 1}/${replayCount}] 可能失败 (状态码: ${res ? res.statusCode : "未知"})`);
    }
  });

  $.done(); 
  
  await Promise.all(replayTasks);
  $.notify("起点任务全自动完成", "", `${task.name} 共 ${task.count} 次任务已极速闭环`);
}

/**
 * 路径化净化算法
 */
async function handleClean(path, response) {
  try {
    let obj = JSON.parse(response.body);
    const rules = CLEAN_RULES[path];
    
    obj = $.clean(obj, rules);
    
    $.log(`✨ 页面净化完成: ${path}`);
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`❌ 净化失败: ${e}`);
    $.done();
  }
}

// --- 注入增强型 Env (保持不变) ---
function Env(n){this.name=n;this.startTime=Date.now();this.log=(...m)=>console.log(`[${this.name}] [${new Date().toLocaleTimeString()}] ${m.join(" ")}`);this.wait=(ms)=>new Promise(r=>setTimeout(r,ms));this.done=(v={})=>$done(v);this.get=(k)=>{let v=$prefs.valueForKey(k);try{return JSON.parse(v)}catch(e){return v}};this.set=(v,k)=>{let val=typeof v==="object"?JSON.stringify(v):v;$prefs.setValueForKey(val,k)};this.fetch=async(o)=>{try{return await $task.fetch(o)}catch(e){return null}};this.clean=(obj,ps)=>{if(!obj||!ps)return obj;ps.forEach(p=>{let ks=p.split("."),c=obj;for(let i=0;i<ks.length-1;i++){let k=ks[i];if(k.includes("[")&&k.includes("]")){let[ak,f]=k.split(/[\[\]]/),[fk,fv]=f.split("=");if(c[ak]){c[ak]=c[ak].filter(item=>item[fk]!==fv);return}}c=c[k];if(!c)break}if(c)delete c[ks[ks.length-1]]});return obj};this.notify=(t,s,b)=>$notify(t,s,b)}
