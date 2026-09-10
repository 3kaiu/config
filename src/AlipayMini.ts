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

const CONFIG: { routes: RouteConfig; debug: boolean } = {
  routes: {
    splash: /gw\/open\.ap.*splash|alipaysplash/,
    homefeed: /(gateway|mapi.*home|life.*newsfeed)/,
    popup: /(popup|dialog|act|msgpush)/,
    search: /(s\.alipay|logsearch|query)/,
    payment: /(traffix|success|payment)/,
    general: /microapp|recommend|openapi/
  },
  // (2026-09-11 分模块审计 MOD-02) 原为 `$argument.includes('DEBUG_MODE=true')` —
  // 键名 DEBUG_MODE 与插件声明的 DEBUG_ENABLE 不符, 且插件传的是动作名, 故永不可达。
  debug: readFlag('DEBUG_ENABLE')
};

/** 冗长诊断日志 — 仅 CONFIG.debug 打开时输出 (2026-09-11 分模块审计 MOD-02: 此前 debug 只读不用) */
function log(...a: unknown[]): void { if (CONFIG.debug) console.log(...a); }

/**
 * 广告字段名判定 — 按标识符分段整段匹配 (2026-09-11 审计修复)
 *
 * 原实现 `CONFIG.adKeywords.some(k => key.toLowerCase().includes(k))` 是**子串**
 * 匹配, 'ad' 会命中 header (he-ad-er)、loading (lo-ad-ing)、upload、badge、
 * shadow、read 等大量正常字段并被清空 (实证: header/loading 被置空)。
 *
 * 现按 snake_case / kebab-case / camelCase 拆词段后匹配:
 *   EXACT  — 段必须完全等于该词
 *   PREFIX — 段以该词开头 (仅限明确需要前缀语义、且不可能是普通词前缀的词)
 * 结果: ad/ads/ad_list/adData/rec_list/banner_list/recommendations 命中,
 *       header/loading/address/adaptive/badge/record 不再命中。
 */
const AD_FIELD_EXACT: ReadonlySet<string> = new Set([
  'ad', 'ads', 'adv', 'rec', 'adlist', 'banner', 'carousel',
  'promo', 'promotion', 'promotions', 'recommend', 'recommends',
]);
const AD_FIELD_PREFIX: readonly string[] = ['advert', 'promo', 'recommend'];

function isAdFieldKey(key: string): boolean {
  const segs = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')   // camelCase → 词段
    .split(/[^A-Za-z0-9]+/)                    // snake/kebab/点号 → 词段
    .filter(Boolean);
  return segs.some(seg => {
    const w = seg.toLowerCase();
    return AD_FIELD_EXACT.has(w) || AD_FIELD_PREFIX.some(p => w.startsWith(p));
  });
}

!(async () => {
  const { url } = $request!;

  if (typeof $response === 'undefined') {
    log('[支付宝小程序] Request 阶段 - 跳过');
    $done();
    return;
  }

  if (!$response.body) {
    log('[支付宝小程序] 无响应体 - 跳过');
    $done();
    return;
  }

  try {
    let bodyObj: Record<string, unknown> = JSON.parse($response.body);

    for (const [routeName, pattern] of Object.entries(CONFIG.routes)) {
      if (pattern.test(url)) {
        log(`[支付宝小程序] 检测到 ${routeName} 请求`);

        switch (routeName) {
          case 'splash': handleSplash(bodyObj); break;
          case 'homefeed': handleHomeFeed(bodyObj); break;
          case 'popup': handlePopup(bodyObj); break;
          case 'search': handleSearch(bodyObj); break;
          case 'payment': handlePayment(bodyObj); break;
          default: handleGeneral(bodyObj);
        }

        log('[支付宝小程序] 处理完成');
        $done({ body: JSON.stringify(bodyObj) });
        return;
      }
    }

    handleGeneral(bodyObj);
    log('[支付宝小程序] 通用净化完成');
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
      log(`[开屏] 移除字段：${field}`);
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
    log(`[信息流] 过滤 ${beforeCount - data.length} 条广告，剩余 ${data.length} 条`);
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
    log(`[搜索] 过滤 ${beforeCount - result.items.length} 条推广`);
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
    const isAdField = isAdFieldKey(key);
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
