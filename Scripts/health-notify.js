/**
 * health-notify.js — 节点健康检测通知 (v7.8)
 *
 * 通过 $httpClient.get 向 Cloudflare generate_204 发请求,
 * 测量响应时间, 超时或失败时通过 $notification.post 推送通知。
 * 支持 Bark/Telegram 推送 (读取 $persistentStore 获取 token)。
 *
 * 兼容 Loon / Quantumult X / Surge (Surge: $notification.post 同 Loon 分支)
 * Loon cron: 0 \/*\/6 * * * (every 6 hours)
 * QX cron: 0 *\/6 * * *
 * Surge cron: 0 *\/6 * * * (5 字段)
 *
 * 已知局限: Bark/Telegram 远程推送为 fire-and-forget, $done() 后上下文
 * 回收会中止未完成的推送请求 (本地通知不受影响), 待统一修复。
 */

// ── QX / Loon 兼容层 ──
const isQX = typeof $task !== 'undefined';
function _read(key) {
  if (isQX) return $prefs.valueForKey(key);
  return $persistentStore.read(key);
}
function _notify(title, sub, body) {
  if (isQX) $notify(title, sub, body);
  else $notification.post(title, sub, body);
}

const TEST_URL = 'http://cp.cloudflare.com/generate_204';
const TIMEOUT_MS = 10000;

// 远程推送统一 Promise 化: $done() 会回收 JS 上下文, fire-and-forget 的
// $httpClient 请求会被中止 — 必须 await 完成后再 $done() (历史 bug 修复)
function barkPush(title, body) {
  const barkKey = _read('Bark_Key');
  if (!barkKey) return Promise.resolve();
  const url = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  return new Promise((resolve) => $httpClient.get({ url: url, timeout: TIMEOUT_MS }, () => resolve()));
}

function telegramPush(title, body) {
  const token = _read('TG_BOT_TOKEN');
  const chatId = _read('TG_USER_ID');
  if (!token || !chatId) return Promise.resolve();
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const params = { chat_id: chatId, text: `${title}\n${body}` };
  return new Promise((resolve) => $httpClient.post({ url: url, timeout: TIMEOUT_MS, body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' } }, () => resolve()));
}

function notify(title, body) {
  _notify(title, body, '');
  return Promise.allSettled([barkPush(title, body), telegramPush(title, body)]);
}

const start = Date.now();
$httpClient.get({ url: TEST_URL, timeout: TIMEOUT_MS }, (error, response, data) => {
  const elapsed = Date.now() - start;
  let push = Promise.resolve();
  if (error) {
    push = notify('⚠️ 节点健康检测', `代理连接失败: ${error}\n测试地址: ${TEST_URL}\n应急: 将 Final 策略组临时切换为 DIRECT (见 README 节点故障应急)`);
  } else if (response && (response.status === 204 || response.statusCode === 204)) {
    console.log(`✅ 节点正常, 延迟 ${elapsed}ms`);
  } else {
    const status = response ? (response.status || response.statusCode) : 'unknown';
    push = notify('⚠️ 节点健康检测', `代理响应异常: HTTP ${status} (${elapsed}ms)\n测试地址: ${TEST_URL}\n应急: 将 Final 策略组临时切换为 DIRECT (见 README 节点故障应急)`);
  }
  // 等待推送完成再结束, 否则上下文回收会中止推送
  Promise.resolve(push).then(() => $done());
});
