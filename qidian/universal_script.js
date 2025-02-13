// 增强版起点读书通用脚本 v2.0
const $ = new Env("起点读书增强脚本");

// 精确的URL处理映射表
const URL_HANDLERS = new Map([
  ["/argus/api/v1/video/adv/finishWatch", handleAdFinishWatch],
  ["/argus/api/v1/video/adv/mainPage", filterMainPage],
  ["/argus/api/v3/user/getaccountpage", rewriteAccountPage]
]);

!(async () => {
  try {
    console.log('进来脚本了----------------------')
    const url = new URL($request.url);
    const handler = URL_HANDLERS.get(url.pathname) || defaultHandler;
    
    console.log(`ℹ️ 处理请求：${url.pathname}`);
    console.log(`🔧 使用处理器：${handler.name}`);
    
    await handler($request, $response);
  } catch (e) {
    console.error(`❌ 处理异常：${e.stack}`);
    $.msg("脚本错误", e.name, e.message);
  } finally {
    $done();
  }
})();

function handleAdFinishWatch(request) {
  const REPLAY_MAX = 7; // 需要重放的总次数
  const REPLAY_INTERVAL = 300; // 每次请求间隔(ms)
  const replayTag = "X-Replayed-Token";

  // 拦截重放请求的回环
  if (request.headers[replayTag]) {
    console.log("⏭️ 跳过已标记的重放请求");
    $done();
    return;
  }

  // 初始化计数器（使用持久化存储）
  let replayCount = parseInt($.getdata("qidian_replay_counter") || 0);
  console.log(`📊 当前进度：${replayCount}/${REPLAY_MAX}`);

  // 智能重放控制器
  const replayEngine = () => {
    // 终止条件判断
    if (replayCount >= REPLAY_MAX) {
      console.log("🏁 已完成所有重放任务");
      $.setdata("0", "qidian_replay_counter"); // 重置计数器
      return;
    }

    // 构造带标识的请求头
    const signedHeaders = {
      ...request.headers,
      [replayTag]: `v2/${Date.now()}` // 动态签名防检测
    };

    // 发送重放请求
    $task.fetch({
      ...request,
      headers: signedHeaders
    }).then(response => {
      // 成功回调
      replayCount++;
      $.setdata(replayCount.toString(), "qidian_replay_counter");
      console.log(`✅ 第 ${replayCount} 次奖励获取成功`);
      
      // 进度显示优化
      const progress = Math.round((replayCount / REPLAY_MAX) * 100);
      $.msg("广告奖励", `进度: ${progress}%`, `已完成 ${replayCount} 次`);

      // 继续下一轮（带随机延迟）
      setTimeout(replayEngine, REPLAY_INTERVAL + Math.random() * 200);
    }).catch(error => {
      // 错误处理
      console.error(`❌ 第 ${replayCount+1} 次失败:`, error);
      $.msg("奖励获取失败", error.statusCode || "网络错误", error.error);
    });
  };

  // 首次执行（立即启动）
  console.log("🚀 启动广告奖励加速引擎");
  replayEngine();
}

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

// 增强版Env类
class Env {
  constructor(name) {
    this.name = name;
    this.cache = new Map();
  }
  
  getdata(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const value = $prefs.valueForKey(key);
    this.cache.set(key, value);
    return value;
  }
  
  setdata(value, key) {
    this.cache.set(key, value);
    return $prefs.setValueForKey(value, key);
  }
  
  log(...args) {
    console.log(`[${this.name}]`, ...args);
  }
  
  msg(title, subtitle, content) {
    $notify(title, subtitle, content);
  }
  
  logErr(err) {
    console.error(`[${this.name}] ❌`, err.stack || err);
  }
  
  done() {
    $done();
  }
}
