interface RouteConfig {
  splash: RegExp;
  homefeed: RegExp;
  popup: RegExp;
  search: RegExp;
  payment: RegExp;
  general: RegExp;
}

interface AdItem {
  ad_data?: unknown;
  is_ad?: boolean;
  promotion_tag?: unknown;
  type?: string;
  content?: Record<string, unknown>;
  source?: string;
  is_promote?: boolean;
}

const CONFIG: { routes: RouteConfig; adKeywords: string[]; debug: boolean } = {
  routes: {
    splash: /gw\/open\.ap.*splash|alipaysplash/,
    homefeed: /(gateway|mapi.*home|life.*newsfeed)/,
    popup: /(popup|dialog|act|msgpush)/,
    search: /(s\.alipay|logsearch|query)/,
    payment: /(traffix|success|payment)/,
    general: /microapp|recommend|openapi/
  },
  adKeywords: [
    'ad', 'ads', 'promo', 'promotion', 'promotions',
    'recommend', 'recommends', 'rec_', 'adv_data',
    'adData', 'adlist', 'banner_list', 'carousel'
  ],
  debug: typeof $argument !== 'undefined' && $argument.includes('DEBUG_MODE=true')
};

!(async () => {
  const { url } = $request!;

  if (typeof $response === 'undefined') {
    console.log('[支付宝小程序] Request 阶段 - 跳过');
    $done();
    return;
  }

  if (!$response.body) {
    console.log('[支付宝小程序] 无响应体 - 跳过');
    $done();
    return;
  }

  try {
    let bodyObj: Record<string, unknown> = JSON.parse($response.body);

    for (const [routeName, pattern] of Object.entries(CONFIG.routes)) {
      if (pattern.test(url)) {
        console.log(`[支付宝小程序] 检测到 ${routeName} 请求`);

        switch (routeName) {
          case 'splash': handleSplash(bodyObj); break;
          case 'homefeed': handleHomeFeed(bodyObj); break;
          case 'popup': handlePopup(bodyObj); break;
          case 'search': handleSearch(bodyObj); break;
          case 'payment': handlePayment(bodyObj); break;
          default: handleGeneral(bodyObj);
        }

        console.log('[支付宝小程序] 处理完成');
        $done({ body: JSON.stringify(bodyObj) });
        return;
      }
    }

    handleGeneral(bodyObj);
    console.log('[支付宝小程序] 通用净化完成');
    $done({ body: JSON.stringify(bodyObj) });

  } catch (error) {
    console.error('[支付宝小程序] 处理异常:', error);
    $done();
  }
})().catch((e: Error) => {
  console.log(`异常：${e}`);
  $done();
});

function handleSplash(obj: Record<string, unknown>): void {
  if (!obj || !obj.data) {
    Object.keys(obj).forEach(key => delete obj[key]);
    return;
  }
  const removeFields = ['adv_info', 'advertise', 'promotion'];
  const data = obj.data as Record<string, unknown>;
  removeFields.forEach(field => {
    if (data[field]) {
      console.log(`[开屏] 移除字段：${field}`);
      delete data[field];
    }
  });
}

function handleHomeFeed(obj: Record<string, unknown>): void {
  const processList = (data: AdItem[] | undefined): AdItem[] | undefined => {
    if (!data || !Array.isArray(data)) return data;
    const beforeCount = data.length;
    data = data.filter((item: AdItem) => {
      if (item.ad_data || item.is_ad || item.promotion_tag) return false;
      if (item.type && (item.type === 'ad' || item.type === 'promotion')) return false;
      if (item.content && typeof item.content === 'object') return !isAdContent(item.content);
      return true;
    });
    console.log(`[信息流] 过滤 ${beforeCount - data.length} 条广告，剩余 ${data.length} 条`);
    return data;
  };
  if (obj.dataList) obj.dataList = processList(obj.dataList as AdItem[]);
  if (obj.feed_list) obj.feed_list = processList(obj.feed_list as AdItem[]);
  if (obj.list) obj.list = processList(obj.list as AdItem[]);
  if (obj.items) obj.items = processList(obj.items as AdItem[]);
}

function handlePopup(obj: Record<string, unknown>): void {
  if (!obj) return;
  ['popup', 'dialog', 'modal', 'message', 'notice', 'toast', 'alert'].forEach(field => {
    if (obj[field]) { delete obj[field]; }
  });
  if (obj.promotions && Array.isArray(obj.promotions)) {
    obj.promotions = [];
  }
}

function handleSearch(obj: Record<string, unknown>): void {
  if (obj.advData && Array.isArray(obj.advData)) {
    obj.advData = [];
  }
  const result = obj.result as Record<string, AdItem[]> | undefined;
  if (result && result.items) {
    const beforeCount = result.items.length;
    result.items = result.items.filter((item: AdItem) => !(item.source === 'tencent' || item.is_promote));
    console.log(`[搜索] 过滤 ${beforeCount - result.items.length} 条推广`);
  }
}

function handlePayment(obj: Record<string, unknown>): void {
  if (obj.recommendations) obj.recommendations = [];
  if (obj.couponPromotions) obj.couponPromotions = [];
}

function handleGeneral(obj: Record<string, unknown>): void {
  cleanObject(obj);
}

function cleanObject(obj: unknown, depth: number = 0): void {
  if (!obj || typeof obj !== 'object') return;
  if (depth > 10) return;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const isAdField = CONFIG.adKeywords.some(keyword => key.toLowerCase().includes(keyword));
    if (isAdField) {
      if (Array.isArray(value)) {
        (obj as Record<string, unknown>)[key] = [];
      } else if (typeof value === 'object' && value !== null) {
        delete (obj as Record<string, unknown>)[key];
      }
    } else if (typeof value === 'object' && value !== null) {
      cleanObject(value, depth + 1);
    }
  }
}

function isAdContent(content: Record<string, unknown>): boolean {
  if (!content) return false;
  return ['ad_url', 'ad_title', 'ad_image', 'ad_link'].some(field => content[field]);
}
