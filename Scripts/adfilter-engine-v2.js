/**
 * 高级去广告脚本引擎 v2.0 (Ultra AdFilter Engine)
 * @description 智能多层去广告 + 性能优化 + 错误恢复
 * @version 2.0.0
 * @author Loon Ultra AdBlock Team
 */

// ════════════════════════════════════════════════════════
// 🎯 配置与初始化
// ════════════════════════════════════════════════════════

const CONFIG = {
  // 启用调试日志（影响性能，生产环境建议关闭）
  DEBUG: false,
  
  // 超时控制（毫秒）
  TIMEOUT: 5000,
  
  // 重试次数
  RETRIES: 2,
  
  // 内存限制（MB）
  MEMORY_LIMIT: 100,
};

// 性能监控器
class PerformanceMonitor {
  constructor(name) {
    this.name = name;
    this.startTime = Date.now();
    this.memoryUsage = 0;
  }

  start() {
    this.startTime = Date.now();
    if (typeof $persistentStore !== 'undefined') {
      try {
        const prev = $persistentStore.read(`perf_${this.name}`);
        this.memoryUsage = prev ? JSON.parse(prev).avg || 0 : 0;
      } catch (e) {}
    }
  }

  end() {
    const duration = Date.now() - this.startTime;
    if (CONFIG.DEBUG) {
      console.log(`⏱️ ${this.name}: ${duration}ms`);
    }
    
    // 保存性能数据
    this.saveStats(duration);
    return duration;
  }

  saveStats(duration) {
    if (typeof $persistentStore === 'undefined') return;
    
    try {
      const key = `perf_${this.name}`;
      const history = JSON.parse($persistentStore.read(key) || '[]');
      history.push({ duration, timestamp: Date.now() });
      
      // 只保留最近 100 条记录
      if (history.length > 100) {
        history.shift();
      }
      
      // 计算平均值
      const avg = history.reduce((sum, item) => sum + item.duration, 0) / history.length;
      history.avg = avg;
      
      $persistentStore.write(JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save performance stats:', e);
    }
  }
}

// ════════════════════════════════════════════════════════
// 🔧 核心过滤函数
// ════════════════════════════════════════════════════════

/**
 * 智能响应净化器
 * @param {Object} response - Loon 原始响应对象
 * @returns {Object} 净化后的响应对象
 */
function cleanAdResponse(response) {
  const monitor = new PerformanceMonitor('clean_ad_response');
  monitor.start();

  try {
    // 安全检查
    if (!response || !response.body) {
      return response;
    }

    // 解析 JSON
    let data;
    try {
      data = JSON.parse(response.body);
    } catch (e) {
      // 非 JSON 格式，直接返回
      return response;
    }

    // 深度清理广告字段
    const cleaned = deepCleanAds(data);
    
    // 更新响应体
    response.body = JSON.stringify(cleaned);
    
    monitor.end();
    return response;

  } catch (error) {
    console.error('[AdFilter] Error cleaning response:', error);
    return response; // 失败时保持原样，避免破坏功能
  }
}

/**
 * 深度递归清理广告字段
 * @param {*} obj - 任意对象
 * @returns {*} 清理后的对象
 */
function deepCleanAds(obj) {
  // 基础类型直接返回
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 数组处理
  if (Array.isArray(obj)) {
    return obj
      .filter(item => !isAdItem(item))      // 过滤广告项
      .map(item => deepCleanAds(item));      // 递归清理
  }

  // 对象处理
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    // 跳过广告相关字段
    if (isAdField(key, value)) {
      continue;
    }

    // 递归清理嵌套对象
    result[key] = deepCleanAds(value);
  }

  return result;
}

/**
 * 判断是否为广告项
 * @param {*} item - 检查对象
 * @returns {boolean}
 */
function isAdItem(item) {
  if (!item || typeof item !== 'object') return false;

  // 常见广告特征
  const adPatterns = [
    /^ad_/,                                    // 以 ad_开头
    /ads?$/,                                   // 以 ads 或 ad 结尾
    /^(banner|splash|popup|interstitial)/i,   // banner/splash/popup 前缀
    /sponsor/i,                                // 赞助内容
    /^(推荐 | 推广 | 广告)/                      // 中文广告关键词
  ];

  // 检查所有字符串字段
  for (const value of Object.values(item)) {
    if (typeof value === 'string') {
      for (const pattern of adPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * 判断是否为广告字段
 * @param {string} key - 字段名
 * @param {*} value - 字段值
 * @returns {boolean}
 */
function isAdField(key, value) {
  const adKeywords = [
    'ad', 'ads', 'adver', 'promotion', 'sponsor',
    'track', 'analytics', 'report', 'log',
    'tracker', 'monitor', 'stat'
  ];

  const lowerKey = key.toLowerCase();
  return adKeywords.some(keyword => lowerKey.includes(keyword));
}

// ════════════════════════════════════════════════════════
// 🚀 主执行入口
// ════════════════════════════════════════════════════════

/**
 * 请求拦截器（可选）
 */
function onRequest(request) {
  if (CONFIG.DEBUG) {
    console.log('[AdFilter] Request:', request.url);
  }
  return $done();
}

/**
 * 响应处理器（主要逻辑）
 */
if (typeof $response !== 'undefined') {
  // 安全性检查
  if (!$response || !$response.body) {
    console.log('[AdFilter] No response body to process');
    $done();
    return;
  }

  // 获取 URL
  const url = $request?.url || '';
  
  if (CONFIG.DEBUG) {
    console.log('[AdFilter] Processing URL:', url);
  }

  // 应用净化
  const cleaned = cleanAdResponse($response);
  
  // 发送净化后的响应
  $done(cleaned);
} else {
  // 非响应模式，直接退出
  $done();
}
