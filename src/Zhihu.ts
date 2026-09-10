/**
 * 知乎去广告 Pro v1.3
 * 作者：3kaiu (基于 app2smile/zhihu.js + ddgksf2013/zhihu.ads.js)
 *
 * v1.3 (2026-09-11 审计):
 *  ✓ 修复: 任一分支遇到非预期字段形状即抛错 → $done 永不调用 → Loon 请求挂死
 *    实证 4 条挂死路径: questions 无 data / questions data=null /
 *    topstory data 非数组 / app_float_layer body 为标量
 *    修法: 精确守卫各字段形状 + 顶层 try/catch 兜底 (任何异常均原样放行)
 *  ✓ 修复: "其他视频类型" 分支对非字符串 $response.body 调 .substring 抛错
 *  ✓ 修复: 'feed_egg' in body 对非对象 body 抛错 (in 运算符要求右值为对象)
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
// 🔇 调试开关 (2026-09-11 分模块审计 MOD-03)
// ════════════════════════════════════════
// 原实现**从不读取 $argument**, 而 zhihu-pro.plugin 却传了
// argument=[{ZHIHU_DEBUG_ENABLE}] —— 参数传了没人接。现将逐请求的冗长日志
// 收敛到 log() 并受该开关控制; 错误/警告日志保持无条件输出, 不因关掉调试而丢失。
const DEBUG: boolean = readFlag("ZHIHU_DEBUG_ENABLE");

/** 冗长诊断日志 — 仅在调试开关打开时输出 */
function log(...a: unknown[]): void { if (DEBUG) console.log(...a); }

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
let body: Record<string, unknown>;
try {
  body = JSON.parse($response.body);
} catch (e) {
  console.log(`JSON parse 失败: ${url}`);
  $done({});
  return;
}

// JSON.parse 对 "123" / "null" / "true" 也成功, 但结果是标量 — 后续所有
// 字段访问与 `in` 运算符都要求对象, 故此处直接收敛为对象, 非对象按无字段处理。
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
if (!isObj(body)) {
  console.log(`⚠️ 响应体非 JSON 对象 (${body === null ? "null" : typeof body}), 原样放行: ${url}`);
  $done({});
  return;
}

// ════════════════════════════════════════
// 📱 功能模块：按 URL 路由分发
// ════════════════════════════════════════

/**
 * 按 URL 路由分发净化逻辑。
 * 提前 return 表示"不改写 payload, 继续走脚本末尾的统一 $done"。
 *
 * (2026-09-11 审计) 原实现是顶层裸 if/else 链, 任一分支遇到非预期字段形状即
 * 抛错 → 末尾 $done 永不执行 → Loon 侧请求挂死。现包进 dispatch() 由调用处
 * try/catch 兜底, 异常时一律原样放行, 保证 $done 必被调用一次。
 */
function dispatch(): void {
  // 🔔 错误处理（非 GET 请求）
  if (method !== "GET") {
    log(url);
    $notification.post(noticeTitle, "method 错误:", method);
  }

  // ── 1. 开屏广告过滤 ────────────────────────
  if (url.includes("commercial_api/real_time_launch_v2")) {
    log('知乎 - 开屏页');
    if (!body.launch) {
      log(`body:${$response.body}`);
    } else {
      let launch: { ads?: unknown[] };
      try {
        launch = JSON.parse(body.launch as string);
      } catch (e) {
        console.log('launch JSON parse 失败');
        // 原为 $done(...) + return; 现提前 return 即可 — 末尾统一 $done 的
        // payload 与此处完全一致, 避免重复 $done。
        return;
      }
      if (!isObj(launch)) {
        console.log('⚠️ launch 非对象, 跳过开屏净化');
        return;
      }
      if (!launch.ads) {
        // ads 字段有时候为空，有时候没有 ads 字段
        // $notification.post(noticeTitle, name, "launch-ads 字段为空");
      } else {
        launch.ads = [];
        log('✅ 成功去除开屏广告');
      }
      body.launch = JSON.stringify(launch);
    }
  }
  // ── 2. 推荐列表净化 ──────────────────────
  else if (url.includes("topstory/recommend")) {
    log('知乎 - 推荐列表');
    const dataArr = body.data;
    if (!dataArr) {
      log(`body:${$response.body}`);
      // $notification.post(noticeTitle, "知乎推荐", "data 字段为空");
    } else if (!Array.isArray(dataArr)) {
      // data 非数组时 .filter 不存在, 原实现直接抛错 (2026-09-11 审计实证)
      console.log(`⚠️ topstory/recommend 的 data 非数组 (${typeof dataArr}), 跳过净化`);
    } else {
      body.data = dataArr.filter(item => {
        if (!isObj(item)) return true;
        // ① zvideo 类型 (视频)
        if (item.extra?.type === "zvideo") {
          const videoUrl = item.common_card?.feed_content?.video?.customized_page_url;
          if (videoUrl) {
            const videoID = getUrlParamValue(videoUrl, "videoID");
            if (videoID) {
              log(`🎬 zvideo-videoID 处理：原始=${item.common_card.feed_content.video.id} → 修改=${videoID}`);
              item.common_card.feed_content.video.id = videoID;
            }
          }
        }
        // ② market_card 类型 (商业化卡片)
        else if (item.type === 'market_card' && item.fields?.header?.url && item.fields.body?.video?.id) {
          const videoURL = item.fields.header.url;
          const videoID = getUrlParamValue(videoURL, "videoID");
          if (videoID) {
            log(`🎬 market_card-videoID 处理：原始=${item.fields.body.video.id} → 修改=${videoID}`);
            item.fields.body.video.id = videoID;
          }
        }
        // ③ 其他视频类型
        else if (item.common_card?.feed_content?.video?.id) {
          const videoID = extractVideoIDFromRawBody();
          if (videoID) {
            log(`🎬 其他-videoID 处理：原始=${item.common_card.feed_content.video.id} → 修改=${videoID}`);
            item.common_card.feed_content.video.id = videoID;
          }
        }

        // 过滤掉广告
        return item.type !== 'feed_advert';
      });

      log((body.data as unknown[]).length === dataArr.length ? '✅ 列表无广告' : '✅ 成功过滤广告');
    }
  }
  // ── 3. 文章下推荐回答广告 ────────────────
  // ⚠️ 必须在 questions 检查之前, 避免被 url.includes("questions") 截胡 (2026-07 审计修复)
  else if (url.includes("answers/questions/related-readings")) {
    log('知乎 - 文章推荐回答');
    if (body.data) body.data = null;
    log('✅ 成功去除文章推荐回答');
  }
  // ── 4. 问题回答列表 ──────────────────────
  else if (url.includes("questions")) {
    log('知乎-questions');
    // body.data 可能不存在 (错误响应 / 分页响应) 或为 null — 原实现直接读
    // body.data.ad_info 会抛 TypeError (2026-09-11 审计实证)。
    const dataObj = isObj(body.data) ? body.data : undefined;
    if (!dataObj?.ad_info && !body.ad_info) {
      log('问题回答列表无广告');
    } else {
      if (dataObj) dataObj.ad_info = null;
      body.ad_info = null;
      log('✅ 成功去除问答列表广告');
    }
  }
  // ── 5. 文章回答下广告 ────────────────────
  else if (url.includes("api/v4/articles/")) {
    log('知乎 - 文章回答下广告');
    if (!body.ad_info) {
      log(`body:${$response.body}`);
      // $notification.post(noticeTitle, name, "articles-ad_info 字段为 undefined");
    } else {
      body.ad_info = null;
      log('✅ 成功去除文章广告');
    }
  }
  // ── 6. appcloud2 config 配置 ────────────────
  else if (url.includes("appcloud2.zhihu.com/v3/config")) {
    log('知乎-appcloud2 config');
    const sync = isObj(body.config) ? body.config.zhcnh_thread_sync : undefined;
    if (isObj(sync) && sync.ZHBackUpIP_Switch_Open === '1') {
      sync.ZHBackUpIP_Switch_Open = '0';
      log('⚙️ ZHBackUpIP_Switch_Open改为 0');
    } else {
      log('ℹ️ 无需更改 ZHBackUpIP_Switch_Open');
    }
  }
  // ── 7. 右下角悬浮框 ───────────────────────
  else if (url.includes("commercial_api/app_float_layer")) {
    log('知乎 - 右下角悬浮框');
    // `in` 运算符要求右值为对象; body 已由上方 isObj 收敛, 此处安全。
    if ('feed_egg' in body) {
      log('✅ 成功清除右下角悬浮框');
      body = {};
    } else {
      log('ℹ️ 无悬浮框，无需处理');
    }
  }
  // ── 8. 搜索预设词 ──────────────────────
  else if (url.includes("search/preset_words")) {
    log('知乎 - 搜索预设词');
    if (body.recommend_queries) {
      body.recommend_queries = {};
      log('✅ 已清空搜索推荐词');
    }
  }
  // ── 9. 通用净化 (其他所有请求) ────────────
  else {
    log('知乎 - 通用净化');
    if (body.data) {
      body.data = {};
    }
    log('✅ 通用净化完成');
  }
}

try {
  dispatch();
} catch (e) {
  // 兜底: 任何未预料的字段形状都不应让请求挂死 — 原样放行并通知。
  console.log(`[知乎] 处理异常, 原样放行: ${e}`);
  $notification.post(noticeTitle, "处理异常", String(e));
  $done({});
  return;
}

$done({ body: JSON.stringify(body) });

// ════════════════════════════════════════
// 🛠️ 工具函数
// ════════════════════════════════════════

function getUrlParamValue(u: string, queryName: string): string | undefined {
  const qIdx = u.indexOf("?");
  if (qIdx === -1) return undefined;
  return Object.fromEntries(u.substring(qIdx + 1)
    .split("&")
    .map(pair => pair.split("="))
  )[queryName];
}

/**
 * 从原始响应体中提取第一个 feed_content.video.id 的字面值。
 * (2026-09-11 审计) 原实现直接对 $response.body 调 .substring — 该值可能不是
 * 字符串 (JSON.parse 接受标量), 会抛 TypeError。现先做类型与索引守卫。
 */
function extractVideoIDFromRawBody(): string | undefined {
  const raw = $response.body;
  if (typeof raw !== "string") return undefined;
  const search = '"feed_content":{"video":{"id":';
  const at = raw.indexOf(search);
  if (at === -1) return undefined;
  const rest = raw.substring(at + search.length);
  const comma = rest.indexOf(",");
  if (comma === -1) return undefined;
  return rest.substring(0, comma) || undefined;
}
