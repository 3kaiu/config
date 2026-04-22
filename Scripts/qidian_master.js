/**
 * 起点全能助手 - 模块化版本
 * 包含：自动重放、页面净化
 */

const $ = new Env("起点全能助手");

const URL_HANDLERS = {
  "/argus/api/v1/video/adv/finishWatch": handleAdFinishWatch,
  "/argus/api/v1/video/adv/mainPage": filterMainPage,
  "/argus/api/v3/user/getaccountpage": rewriteAccountPage,
};

!(async () => {
  const url = $request.url;
  const path = new URL(url).pathname;
  const handler = URL_HANDLERS[path];

  if (handler) {
    $.log(`命中处理器: ${path}`);
    await handler($request, $response);
  } else {
    $.done();
  }
})().catch((e) => $.log(`执行异常: ${e}`)).finally(() => $.done());

// --- 处理器定义 ---

async function handleAdFinishWatch(request) {
  const body = request.body || "";
  let totalReplay = 0;
  let taskName = "";

  if (body.indexOf("taskId=1218712929269776384") !== -1) {
    totalReplay = 2; taskName = "激励视频(系列1)";
  } else if (body.indexOf("taskId=1218712929269776388") !== -1) {
    totalReplay = 8; taskName = "福利任务(系列2)";
  }

  if (totalReplay > 0) {
    $.log(`识别到 ${taskName}, 准备自动重放 ${totalReplay} 次`);
    for (let i = 0; i < totalReplay; i++) {
      const delay = Math.floor(Math.random() * 3000) + 3000;
      $.log(`第 ${i + 1} 次重放, 等待 ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      await new Promise((resolve) => {
        $.post(request, (err, res, data) => {
          $.log(`第 ${i + 1} 次重放完成`);
          resolve();
        });
      });
    }
    $.notify("起点任务完成", "", `${taskName} 已自动重放完毕`);
  }
  $.done({});
}

async function filterMainPage(request, response) {
  try {
    let obj = JSON.parse(response.body);
    if (obj.data && obj.data.bottomNavigation) {
      obj.data.bottomNavigation = obj.data.bottomNavigation.filter(item => 
        !["精选", "发现"].includes(item.name)
      );
    }
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

async function rewriteAccountPage(request, response) {
  try {
    let obj = JSON.parse(response.body);
    if (obj.data && obj.data.functionModules) {
      const excludeList = ["我的福利", "精彩活动", "我要推广", "我的礼品"];
      obj.data.functionModules = obj.data.functionModules.filter(m => !excludeList.includes(m.moduleName));
    }
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
}

// --- Env.js 核心代码 ---
function Env(n){this.name=n;this.isQX=typeof $task!=="undefined";this.log=(...m)=>m.forEach(l=>console.log(`[${this.name}] ${l}`));this.getdata=(k)=>this.isQX?$prefs.valueForKey(k):null;this.setdata=(v,k)=>this.isQX?$prefs.setValueForKey(v,k):null;this.notify=(t,s,b)=>{if(this.isQX)$notify(t,s,b);this.log(`${t}\n${s}\n${b}`)};this.get=(o,c)=>{if(this.isQX){o.method="GET";$task.fetch(o).then(r=>c(null,r,r.body),e=>c(e))}};this.post=(o,c)=>{if(this.isQX){o.method="POST";$task.fetch(o).then(r=>c(null,r,r.body),e=>c(e))}};this.done=(v={})=>$done(v)}
