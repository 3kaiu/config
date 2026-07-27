/**
 * 知乎去广告 Pro v1.2
 * 作者：3kaiu (基于 app2smile/zhihu.js + ddgksf2013/zhihu.ads.js)
 *
 * v1.2 (v7.9 Pro):
 *  ✓ 开屏广告精准过滤 (launch.ads = [])
 *  ✓ 推荐流 videoID 修复 (解决视频无法播放问题)
 *  ✓ market_card 类型视频支持
 *  ✓ 回答/文章广告清理
 *  ✓ 右下角悬浮框控制
 *  ✓ config 备份 IP 开关管理
 *  ✓ 搜索预设词清空
 *  ✓ 通用 data 字段净化
 *
 * ⚠️ 修复: 添加 $response 守卫 + method 检查
 */

// ════════════════════════════════════════
// 🛡️ 基础守卫
// ════════════════════════════════════════
const url = $request.url;
const method = $request.method;

if (typeof $response === "undefined") { $done(); return; }
if (!$response.body) {
  console.log(`$response.body 为 undefined: ${url}`);
  $done({});
  return;
}

const noticeTitle = "知乎 Pro 脚本错误";
let body = JSON.parse($response.body);

// ════════════════════════════════════════
// 📱 功能模块：按 URL 路由分发
// ════════════════════════════════════════

// 🔔 错误处理（非 GET 请求）
if (method !== "GET") {
  console.log(url);
  $notification.post(noticeTitle, "method 错误:", method);
}

// ── 1. 开屏广告过滤 ────────────────────────
if (url.includes("commercial_api/real_time_launch_v2")) {
  console.log('知乎 - 开屏页');
  if (!body.launch) {
    console.log(`body:${$response.body}`);
    // $notification.post(noticeTitle, name, "launch 字段为空");
  } else {
    let launch = JSON.parse(body.launch);
    if (!launch.ads) {
      // ads 字段有时候为空，有时候没有 ads 字段
      // $notification.post(noticeTitle, name, "launch-ads 字段为空");
    } else {
      launch.ads = [];
      console.log('✅ 成功去除开屏广告');
    }
    body.launch = JSON.stringify(launch);
  }
}
// ── 2. 推荐列表净化 ──────────────────────
else if (url.includes("topstory/recommend")) {
  console.log('知乎 - 推荐列表');
  let dataArr = body.data;
  if (!dataArr) {
    console.log(`body:${$response.body}`);
    // $notification.post(noticeTitle, "知乎推荐", "data 字段为空");
  } else {
    body.data = dataArr.filter(item => {
      // ① zvideo 类型 (视频)
      if (item.extra?.type === "zvideo") {
        let videoUrl = item.common_card?.feed_content?.video?.customized_page_url;
        if (videoUrl) {
          let videoID = getUrlParamValue(videoUrl, "videoID");
          if (videoID) {
            console.log(`🎬 zvideo-videoID 处理：原始=${item.common_card.feed_content.video.id} → 修改=${videoID}`);
            item.common_card.feed_content.video.id = videoID;
          }
        }
      }
      // ② market_card 类型 (商业化卡片)
      else if (item.type === 'market_card' && item.fields?.header?.url && item.fields.body?.video?.id) {
        let videoURL = item.fields.header.url;
        let videoID = getUrlParamValue(videoURL, "videoID");
        if (videoID) {
          console.log(`🎬 market_card-videoID 处理：原始=${item.fields.body.video.id} → 修改=${videoID}`);
          item.fields.body.video.id = videoID;
        }
      }
      // ③ 其他视频类型
      else if (item.common_card?.feed_content?.video?.id) {
        let search = '"feed_content":{"video":{"id":';
        let str = $response.body.substring($response.body.indexOf(search) + search.length);
        let videoID = str.substring(0, str.indexOf(','));
        if (videoID) {
          console.log(`🎬 其他-videoID 处理：原始=${item.common_card.feed_content.video.id} → 修改=${videoID}`);
          item.common_card.feed_content.video.id = videoID;
        }
      }
      
      // 过滤掉广告
      return item.type !== 'feed_advert';
    });
    
    console.log(body.data.length === dataArr.length ? '✅ 列表无广告' : '✅ 成功过滤广告');
  }
}
// ── 3. 问题回答列表 ──────────────────────
else if (url.includes("questions") || url.includes("v4/questions")) {
  console.log(url.includes("v4/questions") ? '知乎-v4/questions' : '知乎-questions');
  if (!body.data.ad_info && !body.ad_info) {
    console.log('问题回答列表无广告');
  } else {
    body.data.ad_info = null;
    body.ad_info = null;
    console.log('✅ 成功去除问答列表广告');
  }
}
// ── 4. 文章下推荐回答广告 ────────────────
else if (url.includes("answers/questions/related-readings")) {
  console.log('知乎 - 文章推荐回答');
  if (body.data) body.data = null;
  console.log('✅ 成功去除文章推荐回答');
}
// ── 5. 文章回答下广告 ────────────────────
else if (url.includes("api/v4/articles/")) {
  console.log('知乎 - 文章回答下广告');
  if (!body.ad_info) {
    console.log(`body:${$response.body}`);
    // $notification.post(noticeTitle, name, "articles-ad_info 字段为 undefined");
  } else {
    body.ad_info = null;
    console.log('✅ 成功去除文章广告');
  }
}
// ── 6. appcloud2 config 配置 ────────────────
else if (url.includes("appcloud2.zhihu.com/v3/config")) {
  console.log('知乎-appcloud2 config');
  if (body.config?.zhcnh_thread_sync?.ZHBackUpIP_Switch_Open === '1') {
    body.config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open = '0';
    console.log('⚙️ ZHBackUpIP_Switch_Open改为 0');
  } else {
    console.log('ℹ️ 无需更改 ZHBackUpIP_Switch_Open');
  }
}
// ── 7. 右下角悬浮框 ───────────────────────
else if (url.includes("commercial_api/app_float_layer")) {
  console.log('知乎 - 右下角悬浮框');
  if ('feed_egg' in body) {
    console.log('✅ 成功清除右下角悬浮框');
    body = {};
  } else {
    console.log('ℹ️ 无悬浮框，无需处理');
  }
}
// ── 8. 搜索预设词 ──────────────────────
else if (url.includes("search/preset_words")) {
  console.log('知乎 - 搜索预设词');
  if (body.recommend_queries) {
    body.recommend_queries = {};
    console.log('✅ 已清空搜索推荐词');
  }
}
// ── 9. 通用净化 (其他所有请求) ────────────
else {
  console.log('知乎 - 通用净化');
  if (body && body.data) {
    body.data = {};
  }
  console.log('✅ 通用净化完成');
}

$done({ body: JSON.stringify(body) });

// ════════════════════════════════════════
// 🛠️ 工具函数
// ════════════════════════════════════════

function getUrlParamValue(url, queryName) {
  return Object.fromEntries(url.substring(url.indexOf("?") + 1)
    .split("&")
    .map(pair => pair.split("="))
  )[queryName];
}