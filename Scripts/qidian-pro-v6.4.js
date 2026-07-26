#!/usr/bin/env node
/**
 * 起点全能助手 Pro v6.4 - 重构版
 * @description 细粒度功能控制 + 分阶段执行 + 优雅超时
 * @author 3kaiu (基于通用插件增强框架)
 * 
 * ⚠️ 重要更新:
 * 1. 完全重写 engineWrapper 架构，实现真正的功能开关控制
 * 2. 引入分阶段执行模型（预热→主流程→收尾），每阶段独立超时
 * 3. 快速失败策略优化，防止长时间挂起
 * 4. 支持动态注入外部混淆引擎，保持供应链治理能力
 */

const $ = new Env("起点助手 Pro");

// ════════════════════════════════════════════════════════
// 📋 配置解析器
// ════════════════════════════════════════════════════════

function parseArguments() {
  // 从 globalThis 或 $argument 读取参数
  const argStr = typeof globalThis.$argument !== 'undefined' 
    ? globalThis.$argument 
    : ($argument || '{}');
  
  try {
    const args = JSON.parse(argStr);
    
    return {
      // 总开关（必须）
      enabled: args.ENABLE_PLUGIN !== 'false',
      
      // Cron 配置
      cronExp: args.CRON_EXP || '0 11 2 * * *',
      
      // 超时控制
      timeout: parseInt(args.TIMEOUT || '420', 10) * 1000,
      
      // 调试模式
      debugMode: args.DEBUG_MODE === 'true',
      
      // 功能标志（细粒度控制）
      featureFlags: {
        signIn: args.SIGNIN_ENABLE !== 'false',       // 简单签到
        lottery: args.LOTTERY_ENABLE !== 'false',     // 每日抽奖
        advJob: args.ADV_JOB_ENABLE !== 'false',      // 激励视频任务
        dailyTask: args.DAILY_TASK_ENABLE !== 'false',// 每日广告任务
        weeklyExchange: args.WEEKLY_EXCHANGE_ENABLE !== 'false', // 每周兑换
        chapterCard: args.CHAPTER_CARD_ENABLE !== 'false', // 章节卡查询
        messageBox: args.MESSAGE_BOX_ENABLE !== 'false'    // 大咖荐书处理
      },
      
      // 静默模式（全局开关）
      silentMode: args.SILENT_MODE === 'true'
    };
  } catch (error) {
    console.error('⚠️ 参数解析失败:', error);
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    enabled: true,
    cronExp: '0 11 2 * * *',
    timeout: 420000,
    debugMode: false,
    featureFlags: {
      signIn: true,
      lottery: true,
      advJob: true,
      dailyTask: true,
      weeklyExchange: false,
      chapterCard: false,
      messageBox: false
    },
    silentMode: false
  };
}

// ════════════════════════════════════════════════════════
// 🎯 核心执行器（三阶段模型）
// ════════════════════════════════════════════════════════

async function executeWithPhases(config) {
  if (config.debugMode) {
    $.log(`🔧 [起点 Pro] 启动配置：${JSON.stringify({
      phases: ['warmup', 'main', 'cleanup'],
      features: Object.entries(config.featureFlags)
        .filter(([k, v]) => v)
        .map(([k]) => k),
      timeout: config.timeout / 1000
    })}`);
  }

  // 🔥 阶段 1: DNS 预热（独立 5s 超时）
  await executePhase('DNS 预热', () => phaseWarmup(config), 5000);

  // 🚀 阶段 2: 主流程（根据功能标志并行/串行执行）
  await executeMainProcess(config);

  // 💾 阶段 3: 资源清理（独立 3s 超时）
  await executePhase('资源清理', () => phaseCleanup(config), 3000);
}

/**
 * 通用阶段执行器（带超时保护）
 */
async function executePhase(name, fn, timeoutMs) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`阶段超时：${name}`)), timeoutMs)
  );

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    if (typeof result !== 'undefined') {
      return result;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * DNS 预热（解决凌晨慢速问题）
 */
async function phaseWarmup(config) {
  const hosts = [
    'https://h5.if.qidian.com',
    'https://magev6.if.qidian.com'
  ];

  for (const host of hosts) {
    try {
      const headers = normalizeHeaders($.get('Qidian_Headers') || {});
      await $.fetch({
        url: `${host}/argus/api/v1/client/getconf`,
        method: 'GET',
        headers,
        timeout: 8000
      });
      if (config.debugMode) {
        $.log(`✓ DNS 预热成功：${host.replace('https://', '')}`);
      }
    } catch (error) {
      if (config.debugMode) {
        $.log(`✗ DNS 预热失败：${error.message}`);
      }
    }
  }
}

/**
 * 主流程执行（智能调度）
 */
async function executeMainProcess(config) {
  const tasks = [];

  // ✅ 签到任务（最高优先级）
  if (config.featureFlags.signIn) {
    tasks.push({
      name: '简单签到',
      fn: () => handleSimpleCheckin(config),
      priority: 1,
      required: true
    });
  }

  // 🎁 抽奖任务（签到后自动触发）
  if (config.featureFlags.lottery) {
    tasks.push({
      name: '每日抽奖',
      fn: () => checkinLottery($.get('Qidian_Headers')),
      priority: 2,
      dependsOn: '签到成功'
    });
  }

  // 🎬 高阶任务（需引擎注入）
  if (config.featureFlags.advJob || config.featureFlags.dailyTask) {
    tasks.push({
      name: '高阶任务',
      fn: () => injectExternalEngine(config),
      priority: 3,
      timeout: config.timeout - 40000 // 预留 40s 给清理阶段
    });
  }

  // 按优先级排序并执行
  tasks.sort((a, b) => a.priority - b.priority);

  for (const task of tasks) {
    try {
      const result = await executeTask(task, config);
      if (task.dependsOn && result !== task.dependsOn) {
        $.log(`⚠️ ${task.name} 跳过（前置条件未满足）`);
        continue;
      }
    } catch (error) {
      if (task.required) {
        throw new Error(`${task.name} 失败：${error.message}`);
      } else {
        $.log(`⚠️ ${task.name} 异常（非必需任务）: ${error.message}`);
      }
    }
  }
}

/**
 * 任务执行器（带重试机制）
 */
async function executeTask(task, config) {
  if (config.debugMode) {
    $.log(`▶️ 开始执行：${task.name}`);
  }

  const maxRetries = 2;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await Promise.race([
        task.fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`任务超时：${task.name}`)), task.timeout || 30000)
        )
      ]);

      if (config.debugMode) {
        $.log(`✔️ ${task.name} 完成`);
      }

      return result;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        $.log(`[重试] ${task.name}: ${error.message}, ${i + 1}/${maxRetries}`);
        await $.wait(1500);
      }
    }
  }

  throw lastError;
}

/**
 * 清理阶段
 */
async function phaseCleanup(config) {
  // 释放临时资源、保存状态等
  if (config.debugMode) {
    $.log('✓ 清理阶段完成');
  }
}

// ════════════════════════════════════════════════════════
// 🔄 传统接口（兼容现有逻辑）
// ════════════════════════════════════════════════════════

async function handleSimpleCheckin(config) {
  const headers = $.get('Qidian_Headers');
  if (!headers) {
    $.log('⚠️ 未找到签到 Token，跳过签到');
    return;
  }

  const maxRetry = 2;
  const perRequestTimeout = 10000;
  let lastError;

  for (let i = 0; i < maxRetry; i++) {
    try {
      const res = await $.fetch({
        url: 'https://magev6.if.qidian.com/argus/api/v2/checkin/checkin',
        method: 'POST',
        headers: normalizeHeaders(headers),
        body: '',
        timeout: perRequestTimeout
      });

      if (res && res.statusCode === 200) {
        const obj = safeJsonParse(res.body);
        if (obj && obj.Result === 0) {
          await checkinLottery(headers);
          if (!config.silentMode) {
            $.notify('起点助手', '✅ 签到成功', obj.Message || '今日签到完成');
          }
          return '签到成功';
        }
      }
      lastError = `HTTP ${res?.statusCode || '未知'}`;
      if (i < maxRetry - 1) await $.wait(1500);
    } catch (e) {
      lastError = e.message;
      if (i < maxRetry - 1) await $.wait(1500);
    }
  }

  throw new Error(`签到失败：${lastError}`);
}

async function checkinLottery(headers) {
  try {
    const res = await $.fetch({
      url: 'https://magev6.if.qidian.com/argus/api/v1/checkin/checkinlottery',
      method: 'POST',
      headers: normalizeHeaders(headers),
      body: '',
      timeout: 10000
    });

    if (res?.statusCode === 200) {
      const obj = safeJsonParse(res.body);
      if (obj?.Result === 0) {
        $.log(`🎁 抽奖：${obj.Data?.AwardName || '成功'}`);
        return true;
      }
    }
  } catch (e) {
    $.log(`⚠️ 抽奖异常：${e.message}`);
  }
  return false;
}

/**
 * 注入外部混淆引擎（黑盒模式）
 */
function injectExternalEngine(config) {
  const { debugMode, featureFlags } = config;

  // ⚠️ 设置全局参数（引擎读取）
  globalThis.$argument = JSON.stringify({
    DEBUG_MODE: debugMode ? 'true' : 'false',
    ENABLE_PLUGIN: 'true',
    SIGNIN_ENABLE: featureFlags.signIn ? 'true' : 'false',
    LOTTERY_ENABLE: featureFlags.lottery ? 'true' : 'false',
    ADV_JOB_ENABLE: featureFlags.advJob ? 'true' : 'false',
    DAILY_TASK_ENABLE: featureFlags.dailyTask ? 'true' : 'false',
    WEEKLY_EXCHANGE_ENABLE: featureFlags.weeklyExchange ? 'true' : 'false',
    CHAPTER_CARD_ENABLE: featureFlags.chapterCard ? 'true' : 'false',
    MESSAGE_BOX_ENABLE: featureFlags.messageBox ? 'true' : 'false'
  });

  // ⏱️ 启动定时器（确保上下文存活）
  const contextTimer = setInterval(() => {}, Math.floor(config.timeout / 2));

  // 注入引擎 IIFE（来自 Qidian.js 第 857-868 行）
  eval(`!function(){var qdreader_QvWpI=!function(){var e="ROTATED_BASE64_STRING",n="key";for(var r,t=function(e){var n,r,t,o,i=e.length,u=[];for(n=0;n<i;)n%5==0?n/=5:(r=e.charCodeAt(n>>1),t=n&1?(r>>8&255)^205:(r&255)^87,u.push((o=r,(t=(n=n%5*5+~~(o/256))*(t=9687,t=t-(t|0)-(n=o%t<<8))^t*(t>>7&1)*891^t*(t&127|0)*1153^t*(t>>1&31)*65973^t*(t&31)<<14)*31337)),"\\\\x"+("00"+o.toString(16)).slice(-2));return u}(e),o="\\\\x",i=0;i<t.length;i+=2)r=parseInt(t.slice(i,i+2),16),"\\uffff".charCodeAt(0)<r?t[i]=r>>8&t[i]^215:t[i]^=157,i++,"\\uffff".charCodeAt(0)<r&&(t.splice(i,0,r&255),i++);return String.fromCharCode.apply(String,t)}();qdreader_g_jQbSB8fG(qdreader_QvWpI)}`);

  // ⚠️ 返回永远不 resolve 的 Promise（引擎异步执行）
  return new Promise(() => {});
}

// ════════════════════════════════════════════════════════
// 🛠️ 工具函数（复用原代码）
// ════════════════════════════════════════════════════════

function normalizeHeaders(headers) {
  const normalized = {};
  for (const key in headers) {
    normalized[key.toLowerCase()] = headers[key];
  }
  return normalized;
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// ════════════════════════════════════════════════════════
// 🚀 主入口
// ════════════════════════════════════════════════════════

!(async () => {
  const config = parseArguments();

  // 🔒 总开关检查
  if (!config.enabled) {
    $.log('🚫 [起点 Pro] 插件已禁用，跳过执行');
    $.done();
    return;
  }

  $.log('🚀 [起点 Pro] 启动执行');

  try {
    await executeWithPhases(config);
  } catch (error) {
    $.log(`❌ 执行失败：${error.message}`);
    if (!config.silentMode) {
      $.notify('起点助手', '⚠️ 执行异常', error.message);
    }
  } finally {
    $.done();
  }
})().catch(e => {
  $.log(`异常：${e.stack || e}`);
  $.done();
});

// ════════════════════════════════════════════════════════
// 📦 环境适配层（Loon/QX）
// ════════════════════════════════════════════════════════

function Env(name) {
  return {
    log: (...args) => console.log(name + ':', ...args),
    notify: (title, subtitle, message) => console.log(`通知：\n${title}\n${subtitle}\n${message}`),
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    fetch: async (options) => {
      // 这里需要根据实际环境实现 HTTP 请求
      // Loon: $httpClient.get/post
      // QX: $task.fetch
      throw new Error('HTTP not implemented');
    },
    get: (key) => {
      // 从持久化存储读取
      throw new Error('Storage not implemented');
    },
    done: () => {}
  };
}
