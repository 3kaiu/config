/**
 * 支付宝小程序净化脚本 v1.0 Pro
 * @author 3kaiu
 * @version 1.0.0
 * @description 全面净化支付宝小程序各类广告 + 体验优化
 */

const $ = new Env('支付宝小程序净化');

// ════════════════════════════════════════
// 🛡️ 配置定义
// ════════════════════════════════════════
const CONFIG = {
  // URL 路由匹配
  routes: {
    splash: /gw\/open\.ap.*splash|alipaysplash/,
    homefeed: /(gateway|mapi.*home|life.*newsfeed)/,
    popup: /(popup|dialog|act|msgpush)/,
    search: /(s\.alipay|logsearch|query)/,
    payment: /(traffix|success|payment)/,
    general: /microapp|recommend|openapi/
  },

  // 广告字段识别
  adKeywords: [
    'ad', 'ads', 'promo', 'promotion', 'promotions',
    'recommend', 'recommends', 'rec_', 'adv_data',
    'adData', 'adlist', 'banner_list', 'carousel'
  ],

  // 调试模式
  debug: typeof $argument !== 'undefined' && $argument.includes('DEBUG_MODE=true')
};

// ════════════════════════════════════════
// 🚀 主入口
// ═══════════════════════════════════════===
!(async () => {
  const { url } = $request;
  
  if (typeof $response === 'undefined') {
    console.log('[支付宝小程序] Request 阶段 - 跳过');
    $.done();
    return;
  }

  if (!$response.body) {
    console.log('[支付宝小程序] 无响应体 - 跳过');
    $.done();
    return;
  }

  try {
    let bodyObj = JSON.parse($response.body);
    
    // 根据 URL 路由分发处理
    for (const [routeName, pattern] of Object.entries(CONFIG.routes)) {
      if (pattern.test(url)) {
        console.log(`[支付宝小程序] 检测到 ${routeName} 请求`);
        
        switch (routeName) {
          case 'splash':
            handleSplash(bodyObj);
            break;
          case 'homefeed':
            handleHomeFeed(bodyObj);
            break;
          case 'popup':
            handlePopup(bodyObj);
            break;
          case 'search':
            handleSearch(bodyObj);
            break;
          case 'payment':
            handlePayment(bodyObj);
            break;
          default:
            handleGeneral(bodyObj);
        }
        
        console.log('[支付宝小程序] 处理完成');
        $.done({ body: JSON.stringify(bodyObj) });
        return;
      }
    }
    
    // 通用处理（未匹配到特定规则）
    handleGeneral(bodyObj);
    console.log('[支付宝小程序] 通用净化完成');
    $.done({ body: JSON.stringify(bodyObj) });
    
  } catch (error) {
    console.error('[支付宝小程序] 处理异常:', error);
    $.done();
  }
})().catch(e => {
  $.log(`异常：${e}`);
  $.done();
});

// ════════════════════════════════════════
// 🧹 核心净化函数
// ════════════════════════════════════════

/**
 * 开屏广告净化
 */
function handleSplash(obj) {
  if (!obj || !obj.data) {
    console.log('[开屏] 数据为空，清空返回');
    Object.keys(obj).forEach(key => delete obj[key]);
    return;
  }
  
  // 清除所有推广和广告字段
  const removeFields = ['adv_info', 'advertise', 'promotion'];
  removeFields.forEach(field => {
    if (obj.data[field]) {
      console.log(`[开屏] 移除字段：${field}`);
      delete obj.data[field];
    }
  });
}

/**
 * 信息流净化
 */
function handleHomeFeed(obj) {
  const processList = (data) => {
    if (!data || !Array.isArray(data)) return data;
    
    const beforeCount = data.length;
    data = data.filter(item => {
      // 过滤带广告标记的项
      if (item.ad_data || item.is_ad || item.promotion_tag) {
        return false;
      }
      
      // 检查类型是否包含广告
      if (item.type && (item.type === 'ad' || item.type === 'promotion')) {
        return false;
      }
      
      // 递归检查子对象
      if (item.content && typeof item.content === 'object') {
        return !isAdContent(item.content);
      }
      
      return true;
    });
    
    console.log(`[信息流] 过滤 ${beforeCount - data.length} 条广告，剩余 ${data.length} 条`);
    return data;
  };
  
  // 处理不同结构的数据
  if (obj.dataList) obj.dataList = processList(obj.dataList);
  if (obj.feed_list) obj.feed_list = processList(obj.feed_list);
  if (obj.list) obj.list = processList(obj.list);
  if (obj.items) obj.items = processList(obj.items);
}

/**
 * 弹窗广告净化
 */
function handlePopup(obj) {
  if (!obj) return;
  
  // 清除弹窗相关内容
  const popupFields = [
    'popup', 'dialog', 'modal', 'message', 
    'notice', 'toast', 'alert'
  ];
  
  popupFields.forEach(field => {
    if (obj[field]) {
      console.log(`[弹窗] 移除字段：${field}`);
      delete obj[field];
    }
  });
  
  // 清除推广信息
  if (obj.promotions && Array.isArray(obj.promotions)) {
    obj.promotions = [];
    console.log('[弹窗] 清除所有推广信息');
  }
}

/**
 * 搜索结果净化
 */
function handleSearch(obj) {
  // 清除广告数据
  if (obj.advData && Array.isArray(obj.advData)) {
    obj.advData = [];
    console.log('[搜索] 清除广告数据');
  }
  
  // 过滤推广标记的搜索项
  if (obj.result && obj.result.items) {
    const beforeCount = obj.result.items.length;
    obj.result.items = obj.result.items.filter(item => {
      // 过滤腾讯来源的推广（常见特征）
      if (item.source === 'tencent' || item.is_promote) {
        return false;
      }
      return true;
    });
    console.log(`[搜索] 过滤 ${beforeCount - obj.result.items.length} 条推广`);
  }
}

/**
 * 支付页面净化
 */
function handlePayment(obj) {
  // 清除营销推荐
  if (obj.recommendations) {
    obj.recommendations = [];
    console.log('[支付页] 清除推荐内容');
  }
  
  // 清除优惠券推广（可选）
  if (obj.couponPromotions) {
    obj.couponPromotions = [];
    console.log('[支付页] 清除优惠券推广');
  }
  
  // 保留交易关键信息
  if (obj.transactionInfo) {
    console.log('[支付页] 保留交易信息');
  }
}

/**
 * 通用净化函数（递归遍历）
 */
function handleGeneral(obj) {
  cleanObject(obj);
}

/**
 * 递归清理对象中的广告字段
 */
function cleanObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object') return;
  
  if (depth > 10) return; // 防止无限递归
  
  const keys = Object.keys(obj);
  
  for (const key of keys) {
    const value = obj[key];
    
    // 检查字段名是否包含广告关键词
    const isAdField = CONFIG.adKeywords.some(keyword => 
      key.toLowerCase().includes(keyword)
    );
    
    if (isAdField) {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          console.log(`[通用] 清空数组字段：${key} (${value.length}项)`);
        }
        obj[key] = [];
      } else if (typeof value === 'object' && value !== null) {
        if (depth === 0) {
          console.log(`[通用] 移除对象字段：${key}`);
        }
        delete obj[key];
      }
      continue;
    }
    
    // 递归处理嵌套对象
    if (typeof value === 'object' && value !== null) {
      cleanObject(value, depth + 1);
    }
  }
}

/**
 * 判断内容是否为广告
 */
function isAdContent(content) {
  if (!content) return false;
  
  // 检查关键字段
  const adFields = ['ad_url', 'ad_title', 'ad_image', 'ad_link'];
  return adFields.some(field => content[field]);
}

// ════════════════════════════════════════
// 📦 环境适配层
// ════════════════════════════════════════

function Env(name) {
  return {
    log: (...args) => console.log(`${name}:`, ...args),
    done: (obj = {}) => {},
  };
}
