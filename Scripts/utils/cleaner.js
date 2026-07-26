#!/usr/bin/env node
/**
 * Common Ad Cleaning Utilities
 * @description 统一的前端净化工具函数库
 * @author 3kaiu
 * @version 1.0.0
 */

// ════════════════════════════════════════
// 🎯 默认配置
// ════════════════════════════════════════

const DEFAULT_CONFIG = {
  // 广告字段关键词
  adKeywords: [
    'ad', 'ads', 'promo', 'promotion', 'promotions',
    'recommend', 'recommends', 'rec_', 'adv_data',
    'adData', 'adlist', 'banner_list', 'carousel',
    'sponsored', 'sponsor', 'tracker', 'tracking'
  ],

  // URL 路由匹配模式
  routes: {
    splash: /splash|启动|开屏/i,
    homefeed: /home.*feed|推荐流 | 信息流/i,
    popup: /(popup|dialog|modal)/i,
    search: /(search|query|result)/i,
    payment: /(payment|checkout|success)/i
  },

  // 调试日志开关
  debug: false
};

// ════════════════════════════════════════
// 🧹 核心净化函数
// ════════════════════════════════════════

/**
 * 递归清理对象中的广告字段
 * @param {Object} obj - 要清理的对象
 * @param {string[]} keywords - 广告关键词列表 (可选)
 * @param {number} depth - 递归深度限制
 * @returns {Object} 清理后的新对象
 */
export function cleanAdFields(obj, keywords = DEFAULT_CONFIG.adKeywords, depth = 0) {
  if (!obj || typeof obj !== 'object') return obj;
  
  // 防止无限递归
  if (depth > 10) return obj;
  
  const result = JSON.parse(JSON.stringify(obj)); // 深拷贝
  
  const keys = Object.keys(result);
  
  for (const key of keys) {
    const value = result[key];
    
    // 检查字段名是否包含广告关键词
    const isAdField = keywords.some(keyword => 
      key.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isAdField) {
      if (Array.isArray(value)) {
        result[key] = [];
      } else if (typeof value === 'object' && value !== null) {
        delete result[key];
      }
      continue;
    }
    
    // 递归处理嵌套对象
    if (typeof value === 'object' && value !== null) {
      result[key] = cleanAdFields(value, keywords, depth + 1);
    }
  }
  
  return result;
}

/**
 * URL 路由匹配器
 * @param {string} url - URL 字符串
 * @param {Object} routes - 路由映射表
 * @returns {string|null} 匹配的 routeName，未匹配返回 null
 */
export function matchUrlRoute(url, routes = DEFAULT_CONFIG.routes) {
  for (const [routeName, pattern] of Object.entries(routes)) {
    if (pattern.test(url)) {
      return routeName;
    }
  }
  return null;
}

/**
 * 根据路由分发到对应的处理器
 * @param {string} url - URL 字符串
 * @param {Object} bodyObj - 响应体对象
 * @param {Object} handlers - 路由处理器映射
 * @returns {Object} 处理后的结果
 */
export function dispatchByRoute(url, bodyObj, handlers) {
  const routeName = matchUrlRoute(url);
  
  if (routeName && handlers[routeName]) {
    console.log(`[Router] Matching route: ${routeName}`);
    return handlers[routeName](bodyObj);
  }
  
  // 未匹配到特定路由，使用通用处理
  return handlers.default ? handlers.default(bodyObj) : bodyObj;
}

/**
 * 过滤数组项（移除广告项）
 * @param {Array} array - 要过滤的数组
 * @param {Function} filterFn - 过滤函数
 * @returns {Array} 过滤后的新数组
 */
export function filterAdItems(array, filterFn) {
  if (!Array.isArray(array)) return array;
  
  return array.filter((item, index) => {
    try {
      if (typeof filterFn === 'function') {
        return !filterFn(item, index);
      }
      
      // 默认过滤逻辑
      const isAdItem = 
        item.is_ad === true ||
        item.ad_data !== undefined ||
        item.promotion_tag !== undefined ||
        item.type === 'ad' ||
        item.type === 'promotion';
      
      return !isAdItem;
    } catch (error) {
      console.error('[Filter] Error filtering item:', error);
      return true; // 发生错误时保留该项
    }
  });
}

// ════════════════════════════════════════
// 📊 数据分析与验证
// ═══════════════════════════════════════===

/**
 * 解析并验证 JSON 响应
 * @param {string} responseBody - 响应体字符串
 * @returns {Object|null} 解析后的对象，失败返回 null
 */
export function parseResponse(responseBody) {
  try {
    if (!responseBody) {
      console.log('[Parser] Empty response body');
      return null;
    }
    
    return JSON.parse(responseBody);
  } catch (error) {
    console.error('[Parser] JSON parsing failed:', error.message);
    return null;
  }
}

/**
 * 验证对象结构
 * @param {Object} obj - 要验证的对象
 * @param {string[]} requiredKeys - 必需的键名列表
 * @returns {Object} 验证结果 { valid: boolean, missingKeys: string[] }
 */
export function validateStructure(obj, requiredKeys = []) {
  const result = {
    valid: true,
    missingKeys: [],
    extraKeys: []
  };
  
  if (!obj || typeof obj !== 'object') {
    result.valid = false;
    result.missingKeys = [...requiredKeys];
    return result;
  }
  
  // 检查必需键
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      result.valid = false;
      result.missingKeys.push(key);
    }
  }
  
  // 检测多余键
  const objKeys = Object.keys(obj);
  for (const key of objKeys) {
    if (!requiredKeys.includes(key)) {
      result.extraKeys.push(key);
    }
  }
  
  return result;
}

// ════════════════════════════════════════
// 🔍 日志与调试工具
// ═══════════════════════════════════════===

/**
 * 统一的日志输出函数
 * @param {string} level - 日志级别 (info/warn/error/debug)
 * @param {string} message - 日志消息
 * @param {Object} data - 附加数据 (可选)
 */
export function log(level, message, data = {}) {
  if (!DEFAULT_CONFIG.debug && level === 'debug') {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...data
  };
  
  switch (level) {
    case 'error':
      console.error(`[${timestamp}] [ERROR] ${message}`, data);
      break;
    case 'warn':
      console.warn(`[${timestamp}] [WARN] ${message}`, data);
      break;
    case 'info':
      console.info(`[${timestamp}] [INFO] ${message}`, data);
      break;
    case 'debug':
    default:
      console.log(`[${timestamp}] [DEBUG] ${message}`, data);
  }
}

/**
 * 性能追踪装饰器
 * @param {Function} fn - 要装饰的函数
 * @param {string} functionName - 函数名称
 * @returns {Function} 增强后的函数
 */
export function performanceTrack(fn, functionName) {
  return async function(...args) {
    const start = Date.now();
    
    try {
      const result = await fn.apply(this, args);
      const duration = Date.now() - start;
      
      log('debug', `${functionName} completed in ${duration}ms`);
      return result;
    } catch (error) {
      log('error', `${functionName} failed`, { error: error.message });
      throw error;
    }
  };
}

// ════════════════════════════════════════
// 🛡️ 错误处理
// ═══════════════════════════════════════===

/**
 * 安全的 JSON 序列化（带错误处理）
 * @param {any} obj - 要序列化的对象
 * @param {number} replacer - replacer 参数（可选）
 * @param {number} space - space 参数（可选）
 * @returns {string} JSON 字符串或空字符串
 */
export function safeStringify(obj, replacer = null, space = null) {
  try {
    return JSON.stringify(obj, replacer, space);
  } catch (error) {
    log('error', 'JSON stringify failed', { error: error.message });
    return '';
  }
}

/**
 * 安全的属性访问（避免抛出异常）
 * @param {Object} obj - 源对象
 * @param {string} path - 属性路径（如 "user.profile.name"）
 * @param {*} defaultValue - 默认值
 * @returns {*} 属性的值或默认值
 */
export function getSafeValue(obj, path, defaultValue = undefined) {
  try {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current !== undefined ? current : defaultValue;
  } catch (error) {
    log('error', 'getSafeValue error', { path, error: error.message });
    return defaultValue;
  }
}

// ════════════════════════════════════════
// 📦 导出所有函数
// ═══════════════════════════════════════===

export {
  cleanAdFields,
  matchUrlRoute,
  dispatchByRoute,
  filterAdItems,
  parseResponse,
  validateStructure,
  log,
  performanceTrack,
  safeStringify,
  getSafeValue
};

export { DEFAULT_CONFIG };
