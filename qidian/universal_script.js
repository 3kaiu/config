const $ = new Env("起点读书通用脚本");

// URL 处理映射表
const URL_HANDLERS = {
  "/argus/api/v1/video/adv/finishWatch": handleAdFinishWatch,
  "/argus/api/v1/video/adv/mainPage": filterMainPage,
  "/argus/api/v3/user/getaccountpage": rewriteAccountPage,
};

!(async () => {
  const url = $request.url;
  const path = new URL(url).pathname;

  // 查找匹配的处理函数
  const handler = URL_HANDLERS[path] || defaultHandler;
  console.log(`ℹ️ 处理请求：${url.pathname}`);
    console.log(`🔧 使用处理器：${handler.name}`);

  // 执行处理函数
  try {
    await handler($request, $response);
  }catch (e) {
    console.error(`❌ 处理异常：${e.stack}`);
    $.msg("脚本错误", e.name, e.message);
  } finally {
    $done();
  }
})()
  .catch((e) => $.logErr(e))
  .finally(() => $.done());


function handleAdFinishWatch(request) {
  const REPLAY_MAX = 7;
  const replayTag = "X-Replayed";
  
  if (request.headers[replayTag]) {
    console.log("⏩ 跳过重放请求");
    $done();
    return;
  }

  let replayCount = Number($.getdata("replayCount") || 0;
  
  const replayRequest = () => {
    if (replayCount >= REPLAY_MAX) {
      console.log("✅ 已完成7次重放");
      $.setdata("0", "replayCount");
      return;
    }

    request.headers[replayTag] = "true";
    $task.fetch({
      ...request,
      headers: {...request.headers, [replayTag]: "true"}
    }).then(resp => {
      replayCount++;
      $.setdata(replayCount.toString(), "replayCount");
      console.log(`🔄 重放次数：${replayCount}/${REPLAY_MAX}`);
      if (replayCount < REPLAY_MAX) setTimeout(replayRequest, 100);
    });
  };

  console.log("🎬 开始广告奖励循环");
  replayRequest();
}


// 过滤主页面广告处理函数
function filterMainPage(_, response) {
  try {
    const body = JSON.parse(response.body);
    
    // 模块清理清单
    const cleanModules = [
      'EntranceTabItems',
      'MonthBenefitModule',
      'BaizeModule'
    ];
    
    cleanModules.forEach(key => {
      body.Data[key] = Array.isArray(body.Data[key]) ? [] : {};
    });

    // 保留必要任务项
    if (body.Data.CountdownBenefitModule?.TaskList?.length >= 2) {
      body.Data.CountdownBenefitModule.TaskList = [
        body.Data.CountdownBenefitModule.TaskList[0],
        body.Data.CountdownBenefitModule.TaskList[1]
      ];
    }

    $done({ body: JSON.stringify(body) });
  } catch (e) {
    console.error("❌ 主页面处理失败:", e);
    $done();
  }
}

function rewriteAccountPage(_, response) {
  try {
    const body = JSON.parse(response.body);
    
    // 账户页面清理配置
    const cleanConfig = {
      PursueBookCard: { ShowTab: 1, Url: "" },
      BenefitButtonList: [],
      FunctionButtonList: [],
      BottomButtonList: [],
      Member: {},
      SchoolText: "",
      SchoolUrl: "",
      SchoolImage: ""
    };

    Object.assign(body.Data, cleanConfig);
    $done({ body: JSON.stringify(body) });
  } catch (e) {
    console.error("❌ 账户页处理失败:", e);
    $done();
  }
}

function defaultHandler() {
  console.log("⏭️ 未匹配的请求，跳过处理");
  $done();
}

// Env 类（简化版）
function Env(t) {
  return new (class {
    constructor(t) {
      this.name = t;
    }
    getdata(t) {
      return $prefs.valueForKey(t);
    }
    setdata(t, s) {
      return $prefs.setValueForKey(t, s);
    }
    log(...t) {
      console.log(...t);
    }
    msg(t, s, e) {
      $notify(t, s, e);
    }
    logErr(t) {
      console.error(t);
    }
    done() {
      $done();
    }
  })(t);
}
