/**
 * 知乎去广告 Pro v1.2 - TypeScript Version
 * @author 3kaiu (基于 app2smile/zhihu.js + ddgksf2013/zhihu.ads.js)
 * @version 1.2.0-ts
 */

// ════════════════════════════════════════
// 🔧 类型定义
// ════════════════════════════════════════

interface ApiResponse {
  data?: unknown;
  launch?: string;
  ad_info?: unknown;
  config?: {
    zhcnh_thread_sync?: {
      ZHBackUpIP_Switch_Open?: string;
    };
  };
  recommend_queries?: Record<string, unknown>;
}

interface VideoItem {
  extra?: { type: string };
  common_card?: {
    feed_content?: {
      video?: {
        id: string;
        customized_page_url?: string;
      };
    };
  };
  fields?: {
    header?: { url: string };
    body?: { video?: { id: string } };
  };
  type: string;
}

// ════════════════════════════════════════
// 🎯 主入口
// ═══════════════════════════════════════===

const { $request, $response, $done, $notification } = globalThis;

// 基础守卫检查
if (typeof $response === "undefined") {
  $done();
  process.exit(0);
}

if (!$response.body) {
  console.log(`$response.body 为 undefined: ${$request.url}`);
  $done({});
  process.exit(0);
}

let body: ApiResponse;
try {
  body = JSON.parse($response.body) as ApiResponse;
} catch (error) {
  console.error('JSON 解析失败:', error);
  $done();
  process.exit(0);
}

const noticeTitle = "知乎 Pro 脚本错误";
const method = $request.method;
const url = $request.url;

// 错误处理（非 GET 请求）
if (method !== "GET") {
  console.log(url);
  if ($notification) {
    $notification.post(noticeTitle, "method 错误:", method);
  }
}

// ── 功能模块路由分发 ───────────────────────
function handleRequest(): void {
  // 1. 开屏广告过滤
  if (url.includes("commercial_api/real_time_launch_v2")) {
    handleSplashAds(body);
  }
  // 2. 推荐列表净化
  else if (url.includes("topstory/recommend")) {
    handleRecommendList(body);
  }
  // 3. 问题回答列表
  else if (url.includes("questions") || url.includes("v4/questions")) {
    handleQuestionAnswerAds(body);
  }
  // 4. 文章下推荐回答广告
  else if (url.includes("answers/questions/related-readings")) {
    handleArticleRecommendAds(body);
  }
  // 5. 文章回答下广告
  else if (url.includes("api/v4/articles/")) {
    handleArticleAds(body);
  }
  // 6. appcloud2 config 配置
  else if (url.includes("appcloud2.zhihu.com/v3/config")) {
    handleConfigSwitch(body);
  }
  // 7. 右下角悬浮框
  else if (url.includes("commercial_api/app_float_layer")) {
    handleFloatingFrame(body);
  }
  // 8. 搜索预设词
  else if (url.includes("search/preset_words")) {
    handleSearchRecommend(body);
  }
  // 9. 通用净化
  else {
    handleGeneralClean(body);
  }

  $done({ body: JSON.stringify(body) });
}

// ── 各功能处理器 ─────────────────────────────

/**
 * 开屏广告过滤
 */
function handleSplashAds(responseBody: ApiResponse): void {
  console.log('知乎 - 开屏页');
  
  if (!responseBody.launch) {
    console.log(`body:${$response.body}`);
    return;
  }
  
  let launch: { ads?: Array<unknown> } | null;
  try {
    launch = JSON.parse(responseBody.launch);
  } catch (e) {
    console.error('Launch JSON 解析失败:', e);
    return;
  }
  
  if (!launch?.ads) {
    console.log('launch-ads 字段为空或不存在');
    return;
  }
  
  launch.ads = [];
  responseBody.launch = JSON.stringify(launch);
  console.log('✅ 成功去除开屏广告');
}

/**
 * 推荐列表净化
 */
function handleRecommendList(responseBody: ApiResponse): void {
  console.log('知乎 - 推荐列表');
  
  const dataArr = responseBody.data;
  if (!dataArr || !Array.isArray(dataArr)) {
    console.log(`body:${$response.body}`);
    return;
  }
  
  const initialLength = dataArr.length;
  const filteredData = dataArr.filter((item: unknown): item is VideoItem => {
    if (typeof item !== 'object' || item === null) return false;
    
    // ① zvideo 类型 (视频)
    if (item.extra?.type === "zvideo") {
      const videoUrl = item.common_card?.feed_content?.video?.customized_page_url;
      if (videoUrl) {
        const videoID = getUrlParamValue(videoUrl, "videoID");
        if (videoID) {
          console.log(`🎬 zvideo-videoID 处理：原始=${item.common_card?.feed_content?.video?.id} → 修改=${videoID}`);
          item.common_card?.feed_content?.video && (item.common_card.feed_content.video.id = videoID);
        }
      }
    }
    // ② market_card 类型 (商业化卡片)
    else if (item.type === 'market_card' && item.fields?.header?.url && item.fields.body?.video?.id) {
      const videoURL = item.fields.header.url;
      const videoID = getUrlParamValue(videoURL, "videoID");
      if (videoID) {
        console.log(`🎬 market_card-videoID 处理：原始=${item.fields.body?.video?.id} → 修改=${videoID}`);
        item.fields.body && (item.fields.body.video.id = videoID);
      }
    }
    // ③ 其他视频类型
    else if (item.common_card?.feed_content?.video?.id) {
      const searchStr = '"feed_content":{"video":{"id":';
      const str = $response.body.substring($response.body.indexOf(searchStr) + searchStr.length);
      const videoID = str.substring(0, str.indexOf(','));
      if (videoID) {
        console.log(`🎬 其他-videoID 处理：原始=${item.common_card?.feed_content?.video?.id} → 修改=${videoID}`);
        item.common_card?.feed_content?.video && (item.common_card.feed_content.video.id = videoID);
      }
    }
    
    // 过滤掉广告
    return item.type !== 'feed_advert';
  });
  
  responseBody.data = filteredData;
  console.log(filteredData.length === initialLength ? '✅ 列表无广告' : '✅ 成功过滤广告');
}

/**
 * 问题回答列表广告清理
 */
function handleQuestionAnswerAds(responseBody: ApiResponse): void {
  console.log(url.includes("v4/questions") ? '知乎-v4/questions' : '知乎-questions');
  
  if (!responseBody.data?.ad_info && !responseBody.ad_info) {
    console.log('问题回答列表无广告');
    return;
  }
  
  if (responseBody.data) {
    responseBody.data.ad_info = null;
  }
  responseBody.ad_info = null;
  console.log('✅ 成功去除问答列表广告');
}

/**
 * 文章下推荐回答广告清理
 */
function handleArticleRecommendAds(responseBody: ApiResponse): void {
  console.log('知乎 - 文章推荐回答');
  if (responseBody.data) {
    responseBody.data = null;
  }
  console.log('✅ 成功去除文章推荐回答');
}

/**
 * 文章回答下广告清理
 */
function handleArticleAds(responseBody: ApiResponse): void {
  console.log('知乎 - 文章回答下广告');
  if (!responseBody.ad_info) {
    console.log(`body:${$response.body}`);
    return;
  }
  responseBody.ad_info = null;
  console.log('✅ 成功去除文章广告');
}

/**
 * Config IP 开关管理
 */
function handleConfigSwitch(responseBody: ApiResponse): void {
  console.log('知乎-appcloud2 config');
  
  const config = responseBody.config;
  if (!config?.zhcnh_thread_sync) {
    console.log('ℹ️ 无需更改 ZHBackUpIP_Switch_Open');
    return;
  }
  
  if (config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open === '1') {
    config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open = '0';
    console.log('⚙️ ZHBackUpIP_Switch_Open 改为 0');
  } else {
    console.log('ℹ️ 无需更改 ZHBackUpIP_Switch_Open');
  }
}

/**
 * 右下角悬浮框清理
 */
function handleFloatingFrame(responseBody: ApiResponse): void {
  console.log('知乎 - 右下角悬浮框');
  if ('feed_egg' in responseBody) {
    Object.keys(responseBody).forEach(key => delete responseBody[key]);
    console.log('✅ 成功清除右下角悬浮框');
  } else {
    console.log('ℹ️ 无悬浮框，无需处理');
  }
}

/**
 * 搜索预设词清理
 */
function handleSearchRecommend(responseBody: ApiResponse): void {
  console.log('知乎 - 搜索预设词');
  if (responseBody.recommend_queries) {
    responseBody.recommend_queries = {};
    console.log('✅ 已清空搜索推荐词');
  }
}

/**
 * 通用净化
 */
function handleGeneralClean(responseBody: ApiResponse): void {
  console.log('知乎 - 通用净化');
  try {
    if (responseBody && responseBody.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj = responseBody as any;
      obj.data = {};
    }
    console.log('✅ 通用净化完成');
  } catch (e) {
    console.error('解析失败:', e);
  }
}

/**
 * 从 URL 中提取查询参数值
 */
function getUrlParamValue(url: string, queryName: string): string | undefined {
  const queryString = url.substring(url.indexOf("?") + 1);
  const params = new URLSearchParams(queryString);
  return params.get(queryName) || undefined;
}

// ════════════════════════════════════════
// 🚀 执行主流程
// ═══════════════════════════════════════===
handleRequest();
process.exit(0);
