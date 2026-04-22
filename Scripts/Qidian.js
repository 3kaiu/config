/**
 * 📚 起点全能助手 (Pro版)
 * 集成通用 Env v2.0 深度优化算法
 * 功能：智能重放、路径化页面净化
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
  ]
};

const TASK_MAPPING = {
  "1218712929269776384": { name: "系列1(激励视频)", count: 9 },
  "1218712929269776388": { name: "系列2(福利任务)", count: 3 }
};

// --- 主程序 ---
!(async () => {
  const { url, method } = $request;
  const path = new URL(url).pathname;

  // 1. 自动重放逻辑 (POST 请求)
  if (path === "/argus/api/v1/video/adv/finishWatch" && method === "POST") {
    await handleReplay($request);
  } 
  
  // 2. 页面净化逻辑 (GET 响应)
  else if (CLEAN_RULES[path]) {
    await handleClean(path, $response);
  }

})().catch(e => $.log(`运行时错误: ${e}`)).finally(() => $.done());

// --- 核心函数 ---

/**
 * 智能重放算法
 * 采用指数随机退避策略，模拟真人点击间隔
 */
async function handleReplay(request) {
  const body = request.body || "";
  const match = Object.keys(TASK_MAPPING).find(id => body.includes(id));
  
  if (!match) return;
  const task = TASK_MAPPING[match];
  $.log(`🚀 识别到任务: ${task.name}`);

  // 为了安全，我们只重放 count - 1 次（因为当前已经成功手动完成了一次）
  const replayCount = task.count - 1;
  
  for (let i = 0; i < replayCount; i++) {
    // 算法优化：3~6秒随机间隔 + 步进延迟
    const delay = 3000 + Math.random() * 3000 + (i * 500);
    $.log(`⏳ 等待 ${Math.round(delay)}ms 后进行第 ${i + 1}/${replayCount} 次自动重放...`);
    await $.wait(delay);

    const res = await $.fetch({
      url: request.url,
      method: "POST",
      headers: request.headers,
      body: request.body
    });

    if (res && res.statusCode === 200) {
      $.log(`✅ 第 ${i + 1} 次重放成功`);
    } else {
      $.log(`⚠️ 第 ${i + 1} 次重放可能失败 (状态码: ${res ? res.statusCode : "未知"})`);
    }
  }
  
  $.notify("起点任务全自动完成", "", `${task.name} 共 ${task.count} 次任务已全部闭环`);
}

/**
 * 路径化净化算法
 * 使用 Env.clean 递归处理 JSON，无需手动写 filter
 */
async function handleClean(path, response) {
  try {
    let obj = JSON.parse(response.body);
    const rules = CLEAN_RULES[path];
    
    // 调用通用库的深度清理算法
    obj = $.clean(obj, rules);
    
    $.log(`✨ 页面净化完成: ${path}`);
    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`❌ 净化失败: ${e}`);
    $.done();
  }
}

// --- 注入增强型 Env (QX 专用极简版) ---
function Env(n){this.name=n;this.startTime=Date.now();this.log=(...m)=>console.log(`[${this.name}] [${new Date().toLocaleTimeString()}] ${m.join(" ")}`);this.wait=(ms)=>new Promise(r=>setTimeout(r,ms));this.done=(v={})=>$done(v);this.get=(k)=>{let v=$prefs.valueForKey(k);try{return JSON.parse(v)}catch(e){return v}};this.set=(v,k)=>{let val=typeof v==="object"?JSON.stringify(v):v;$prefs.setValueForKey(val,k)};this.fetch=async(o)=>{try{return await $task.fetch(o)}catch(e){return null}};this.clean=(obj,ps)=>{if(!obj||!ps)return obj;ps.forEach(p=>{let ks=p.split("."),c=obj;for(let i=0;i<ks.length-1;i++){let k=ks[i];if(k.includes("[")&&k.includes("]")){let[ak,f]=k.split(/[\[\]]/),[fk,fv]=f.split("=");if(c[ak]){c[ak]=c[ak].filter(item=>item[fk]!==fv);return}}c=c[k];if(!c)break}if(c)delete c[ks[ks.length-1]]});return obj};this.notify=(t,s,b)=>$notify(t,s,b)}
