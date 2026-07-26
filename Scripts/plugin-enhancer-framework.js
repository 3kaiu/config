#!/usr/bin/env node
/**
 * 通用插件增强框架 v1.0
 * @description 为 Loon/QX 插件提供统一的功能开关架构 + 黑盒引擎包装器
 * @author 3kaiu
 */

const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════
// 📋 插件配置模板（可复用）
// ════════════════════════════════════════════════════════

const PLUGIN_TEMPLATE = {
  header: `#!name={PLUGIN_NAME}
#!desc={PLUGIN_DESC}
#!version={VERSION}
#!author={AUTHOR}
#!homepage={HOMEPAGE}
#!icon={ICON_URL}
#!arguments-desc=\\\\n- \\\\{ENABLE_PLUGIN\\\\}: ["true","false"],tag=总开关, desc={ENABLE_DESC}\\\\n- \\\\{CRON_EXP}: input,"{DEFAULT_CRON}",tag=Cron 表达式, desc=定时任务执行时间\\\\n- \\\\{TIMEOUT}: input,{DEFAULT_TIMEOUT},tag=超时时间 (秒), desc=脚本最大执行时长\\\\n- \\\\{FEATURE_A}: switch,"true","false",tag=功能 A, desc={FEATURE_A_DESC}\\\\n- \\\\{FEATURE_B}: switch,"true","false",tag=功能 B, desc={FEATURE_B_DESC}\\\\n- \\\\{DEBUG_MODE}: switch,"false","true",tag=调试模式，desc=开启后输出详细日志`,

  arguments: `[Argument]
ENABLE_{PLUGIN_NAME_UPPER}=switch,"{DEFAULT_ENABLE}","false",tag=总开关, desc={ENABLE_DESC}
CRON_EXP=input,"{DEFAULT_CRON}",tag=Cron 表达式，desc=定时任务执行时间
TIMEOUT=input,{DEFAULT_TIMEOUT},tag=超时时间 (秒), desc=脚本最大执行时长
FEATURE_A_ENABLE=switch,"{DEFAULT_FEATURE_A}","false",tag=功能 A, desc={FEATURE_A_DESC}
FEATURE_B_ENABLE=switch,"{DEFAULT_FEATURE_B}","false",tag=功能 B, desc={FEATURE_B_DESC}
DEBUG_MODE_ENABLE=switch,"false","true",tag=调试模式，desc=开启后输出详细日志

[Script]
# 总开关控制 - 所有规则都必须加 enable={ENABLE_{PLUGIN_NAME_UPPER}}
{RULES_SECTION}

[Rewrite]
# 重写规则示例
{REWRITE_SECTION}

[MitM]
hostname = %APPEND% {HOSTNAMES}`,

  // 引擎包装器模板（支持外部混淆引擎注入）
  engineWrapper: `/**
 * 引擎包装器 - 支持黑盒引擎注入
 * @param {Object} config - 引擎配置参数
 */
async function wrapExternalEngine(config) {
  const { 
    enabled,          // 总开关
    featureFlags,     // 功能标志 {featureA: true, featureB: false}
    timeout,          // 超时时间
    debugMode,        // 调试模式
    cronExp,          // Cron 表达式
    engineBlob        // 外部引擎二进制数据（可选）
  } = config;

  // 🔒 总开关检查
  if (!enabled) {
    $.log(`🚫 [${config.pluginName}] 插件已禁用，跳过执行`);
    return;
  }

  // 📊 调试模式初始化
  if (debugMode) {
    $.log(`🔍 [${config.pluginName}] 启动调试模式`);
    $.log(JSON.stringify({
      cronExp,
      timeout,
      featureFlags
    }));
  }

  // ⏱️ 超时保护
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`⏰ 执行超时 (${timeout}s)`)), timeout * 1000)
  );

  // 🚀 引擎执行（带优雅降级）
  try {
    const enginePromise = executeEngineWithFeatures(config);
    return await Promise.race([enginePromise, timeoutPromise]);
  } catch (error) {
    if (debugMode) {
      $.log(`❌ 引擎异常：${error.stack}`);
    } else if (error.message.includes('超时')) {
      $.notify('⚠️ ' + config.pluginName, '', error.message);
    }
    throw error;
  }
}

/**
 * 带功能标志的引擎执行器
 */
async function executeEngineWithFeatures(config) {
  const { featureFlags, debugMode } = config;

  // ✅ 预处理：根据功能标志过滤引擎逻辑
  if (debugMode) {
    $.log(`🔧 启用功能：${Object.entries(featureFlags)
      .filter(([k, v]) => v)
      .map(([k]) => k)
      .join(', ') || '无'}`);
  }

  // 🎯 分阶段执行（每阶段独立超时）
  const phases = [
    { name: '预热', fn: () => phaseWarmup(config), timeout: 5000 },
    { name: '主流程', fn: () => phaseMainProcess(config), timeout: config.timeout * 1000 },
    { name: '收尾', fn: () => phaseCleanup(config), timeout: 5000 }
  ];

  for (const phase of phases) {
    if (debugMode) {
      $.log(`▶️ 开始阶段：${phase.name}`);
    }

    try {
      await executeWithTimeout(phase.fn, phase.timeout);
      if (debugMode) {
        $.log(`✔️ ${phase.name} 完成`);
      }
    } catch (error) {
      throw new Error(`${phase.name}失败：${error.message}`);
    }
  }
}

// 工具函数：带超时的执行
async function executeWithTimeout(fn, timeoutMs) {
  const promise = new Promise((resolve, reject) => {
    fn()
      .then(resolve)
      .catch(reject);
  });

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('阶段超时')), timeoutMs)
  );

  return Promise.race([promise, timeout]);
}

// 阶段函数（由具体插件实现）
async function phaseWarmup(config) {
  // DNS 预热、连接池初始化等
  if (typeof config.warmup === 'function') {
    return config.warmup();
  }
}

async function phaseMainProcess(config) {
  // 核心业务逻辑
  if (typeof config.main === 'function') {
    return config.main();
  }
  
  // fallback: 调用外部引擎
  if (config.externalEngine) {
    return injectExternalEngine(config);
  }
}

async function phaseCleanup(config) {
  // 资源清理、状态保存等
  if (typeof config.cleanup === 'function') {
    return config.cleanup();
  }
}

/**
 * 注入外部混淆引擎（黑盒模式）
 */
function injectExternalEngine(config) {
  const { engineBlob, debugMode } = config;
  
  // ⚠️ 设置全局参数（引擎读取）
  globalThis.$argument = JSON.stringify({
    DEBUG_MODE: debugMode ? 'true' : 'false',
    ...config.featureFlags
  });

  // 注入引擎 IIFE（需确保上下文存活）
  eval(engineBlob);

  // 返回一个永远不会 resolve 的 Promise（引擎异步执行）
  return new Promise(() => {});
}`};

// ════════════════════════════════════════════════════════
// 🛡️ 错误处理模板
// ════════════════════════════════════════════════

const ERROR_HANDLING = {
  quickFail: `/**
 * 快速失败策略 - 防止长时间挂起
 * @param {Function} operation 操作函数
 * @param {Object} options 选项
 */
async function quickFailRetry(operation, options = {}) {
  const {
    maxRetries = 2,           // 最大重试次数
    perRequestTimeout = 10000, // 单次请求超时 (ms)
    retryInterval = 1500       // 重试间隔 (ms)
  } = options;

  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await Promise.race([
        operation(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('单次请求超时')), perRequestTimeout)
        )
      ]);
      
      return result; // 成功则立即返回
    } catch (error) {
      lastError = error;
      const errMsg = \`\${error.message || 'Unknown'}\`;
      
      if (i < maxRetries - 1) {
        $.log(\`[重试] \${errMsg}, \${i + 1}/${maxRetries}, 等待 \${retryInterval}ms...\`);
        await $.wait(retryInterval);
      }
    }
  }

  // 全部失败
  throw new Error(\`快速失败策略耗尽：\${lastError.message}\`);
}`
};

// ════════════════════════════════════════════════════════
// 📦 预设插件配置
// ════════════════════════════════════════════════════════

const PRESET_PLUGINS = {
  jd: {
    name: '京东去广告',
    version: '7.8',
    features: {
      signin: { name: '每日签到', default: true },
      mall: { name: '逛商城', default: true },
      coupon: { name: '领券中心', default: true },
      lottery: { name: '天天抽奖', default: true },
      price: { name: '比价工具', default: true }
    },
    hostnames: ['jd.com', '360buy.com'],
    timeout: 180
  },
  netease: {
    name: '网易云音乐',
    version: '7.8',
    features: {
      signin: { name: '每日签到', default: true },
      checkin: { name: '周打卡', default: true },
      adblock: { name: '广告净化', default: true },
      framework: { name: '框架净化', default: true }
    },
    hostnames: ['music.163.com'],
    timeout: 120
  }
};

// ════════════════════════════════════════════════════════
// 🔧 生成器工具
// ════════════════════════════════════════════════════════

class PluginGenerator {
  constructor(pluginConfig) {
    this.config = pluginConfig;
  }

  generatePluginFile() {
    const { name, version, features, hostnames, timeout } = this.config;
    
    // 构建参数列表
    const args = Object.entries(features).map(([key, feat], idx) => {
      const varName = `FEATURE_${key.toUpperCase()}_ENABLE`;
      return `- \\\\{${varName}}: switch,"${feat.default ? 'true' : 'false'}","false",tag=${feat.name}, desc=${feat.name}`;
    }).join('\\\n');

    // 构建规则列表（简化示例）
    const rules = [`# TODO: 添加实际规则\nhttp-request https?:\\/\\/.*\\.\\* hostname script-path=script.js, timeout=${timeout}, argument=[{ENABLE_${name.toUpperCase()}},{CRON_EXP},{TIMEOUT}${args.replace(/\\\\/g, '')}]`];

    return this.render(PLUGIN_TEMPLATE.header, {
      PLUGIN_NAME: name,
      PLUGIN_DESC: `${name} — ${Object.values(features).map(f => f.name).join('/')}`,
      VERSION: version,
      AUTHOR: '3kaiu',
      HOMEPAGE: 'https://github.com/3kaiu/config',
      ICON_URL: `https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/${name}.png`,
      DEFAULT_CRON: '0 12 * * *',
      DEFAULT_TIMEOUT: timeout,
      FEATURE_A_DESC: Object.values(features)[0]?.name || '功能 A',
      FEATURE_B_DESC: Object.values(features)[1]?.name || '功能 B'
    }).replace('{RULES_SECTION}', rules.join('\n'));
  }

  render(template, replacements) {
    return template.replace(/\{(.*?)\}/g, (match, key) => {
      return replacements[key] || match;
    });
  }
}

// 导出工具
module.exports = {
  PLUGIN_TEMPLATE,
  ERROR_HANDLING,
  PRESET_PLUGINS,
  PluginGenerator
};
