// 通用脚本，根据 URL 动态处理请求和响应
const $ = new Env("起点读书通用脚本");

// URL 处理映射表
const URL_HANDLERS = {
  "/argus/api/v1/video/adv/finishWatch": handleAdFinishWatch,
  "/argus/api/v1/video/adv/mainPage": filterMainPage,
  "/argus/api/v3/user/getaccountpage": rewritPage,
};

!(async () => {
  const url = $request.url;
  const path = new URL(url).pathname;

  // 查找匹配的处理函数
  const handler = URL_HANDLERS[path] || defaultHandler;
  console.log(`处理 URL: ${url}, 使用处理器: ${handler.name}`);

  // 执行处理函数
  try {
    await handler($request, $response);
  } catch (e) {
    console.error(`处理 URL ${url} 时出错:`, e);
  } finally {
    $done();
  }
})()
  .catch((e) => $.logErr(e))
  .finally(() => $.done());

// 默认处理函数
function defaultHandler(request, response) {
  console.log("未匹配到特定逻辑，跳过处理");
  $done();
}

// 广告观看完成处理函数
function handleAdFinishWatch(request, response) {
  // 定义一个全局计数器
  let replayCount = 0;

  // 重放请求函数
  function replayRequest(request) {
    // 检查是否已经重放 7 次
    if (replayCount >= 7) {
      console.log("重放 7 次已完成，结束重放。");
      $done();
      return;
    }

    // 标记重放的请求，防止其进入重写规则
    request.headers["X-Replayed"] = "true";

    // 发送重放请求
    $task
      .fetch({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
      })
      .then(
        (response) => {
          // 处理响应
          console.log(`重放次数: ${replayCount + 1}, Response:`, response);
          replayCount++;

          // 使用 setTimeout 避免递归调用导致的栈溢出
          setTimeout(() => replayRequest(request), 0);
        },
        (error) => {
          // 处理错误
          console.error("重放失败:", error);
          $done();
        }
      );
  }
  if (request.headers["X-Replayed"] === "true") {
    console.log("当前请求为重放请求，跳过重写规则。");
    $done();
    return;
  }

  // 如果是第一次请求，开始重放
  console.log("捕获到第一次请求，开始重放。");
  replayRequest(request);
}

// 过滤主页面广告处理函数
function filterMainPage(request, response) {
  if (response) {
    let body = JSON.parse(response.body);

    body.Data.EntranceTabItems = [];

    // 确保从 CountdownBenefitModule 中提取 TaskList 的正确元素
    body.Data.CountdownBenefitModule.TaskList = [
      body.Data.CountdownBenefitModule.TaskList[0],
      body.Data.CountdownBenefitModule.TaskList[1],
    ];

    body.Data.MonthBenefitModule = {};
    body.Data.BaizeModule = {};
    $done({ body: JSON.stringify(body) });
  }
}

//过滤账户页
function rewritPage(request, response) {
  if (response) {
    const body = JSON.parse(response.body);
    body.Data.PursueBookCard = { ShowTab: 1, Url: "" };
    body.Data.BenefitButtonList = [];
    body.Data.FunctionButtonList = [];
    body.Data.BottomButtonList = [];
    body.Data.Member = {};
    body.Data.SchoolText = "";
    body.Data.SchoolUrl = "";
    body.Data.SchoolImage = "";

    $done({ body: JSON.stringify(body) });
  }
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
