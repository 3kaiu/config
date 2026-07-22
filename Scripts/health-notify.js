/**
 * health-notify.js — 节点健康检测通知 (v7.8)
 *
 * 通过 $httpClient.get 向 Cloudflare generate_204 发请求,
 * 测量响应时间, 超时或失败时通过 $notification.post 推送通知。
 * 支持 Bark/Telegram 推送 (读取 $persistentStore 获取 token)。
 *
 * Loon cron: 0 \/*\/6 * * * (every 6 hours)
 */

const TEST_URL = 'http://cp.cloudflare.com/generate_204';
const TIMEOUT_MS = 10000;

function barkPush(title, body) {
  const barkKey = $persistentStore.read('Bark_Key');
  if (!barkKey) return;
  const url = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  $httpClient.get({ url: url, timeout: TIMEOUT_MS }, () => {});
}

function telegramPush(title, body) {
  const token = $persistentStore.read('TG_BOT_TOKEN');
  const chatId = $persistentStore.read('TG_USER_ID');
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const params = { chat_id: chatId, text: `${title}\n${body}` };
  $httpClient.post({ url: url, timeout: TIMEOUT_MS, body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' } }, () => {});
}

function notify(title, body) {
  $notification.post(title, body, '');
  barkPush(title, body);
  telegramPush(title, body);
}

const start = Date.now();
$httpClient.get({ url: TEST_URL, timeout: TIMEOUT_MS }, (error, response, data) => {
  const elapsed = Date.now() - start;
  if (error) {
    notify('⚠️ 节点健康检测', `代理连接失败: ${error}\n测试地址: ${TEST_URL}`);
  } else if (response && response.status === 204) {
    console.log(`✅ 节点正常, 延迟 ${elapsed}ms`);
  } else {
    const status = response ? response.status : 'unknown';
    notify('⚠️ 节点健康检测', `代理响应异常: HTTP ${status} (${elapsed}ms)\n测试地址: ${TEST_URL}`);
  }
  $done();
});
