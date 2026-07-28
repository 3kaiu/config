import { notification } from "@nsnanocat/util/lib/notification.mjs";
import { done } from "@nsnanocat/util/lib/done.mjs";

const TEST_URL = 'http://cp.cloudflare.com/generate_204';
const TIMEOUT_MS = 10000;

function barkPush(title: string, body: string): Promise<void> {
  const barkKey = $persistentStore.read('Bark_Key');
  if (!barkKey) return Promise.resolve();
  const url = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  return new Promise<void>((resolve) => $httpClient.get({ url, timeout: TIMEOUT_MS }, () => resolve()));
}

function telegramPush(title: string, body: string): Promise<void> {
  const token = $persistentStore.read('TG_BOT_TOKEN');
  const chatId = $persistentStore.read('TG_USER_ID');
  if (!token || !chatId) return Promise.resolve();
  const params = { chat_id: chatId, text: `${title}\n${body}` };
  return new Promise<void>((resolve) => $httpClient.post({
    url: `https://api.telegram.org/bot${token}/sendMessage`, timeout: TIMEOUT_MS,
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' }
  }, () => resolve()));
}

function notify(title: string, body: string): Promise<PromiseSettledResult<void>[]> {
  notification(title, body, '');
  return Promise.allSettled([barkPush(title, body), telegramPush(title, body)]);
}

const start = Date.now();
$httpClient.get({ url: TEST_URL, timeout: TIMEOUT_MS }, (error: Error | null, response: $httpClientResponse | null) => {
  const elapsed = Date.now() - start;
  let push: Promise<unknown> = Promise.resolve();
  if (error) {
    push = notify('⚠️ 节点健康检测', `代理连接失败: ${error}\n测试地址: ${TEST_URL}\n应急: 将 Final 策略组临时切换为 DIRECT`);
  } else if (response && response.status === 204) {
    console.log(`✅ 节点正常, 延迟 ${elapsed}ms`);
  } else {
    const status = response ? response.status : 'unknown';
    push = notify('⚠️ 节点健康检测', `代理响应异常: HTTP ${status} (${elapsed}ms)\n测试地址: ${TEST_URL}`);
  }
  Promise.resolve(push).then(() => done());
});
