const isQX: boolean = typeof $task !== 'undefined';

function _read(key: string): string | undefined {
  if (isQX) return $prefs.valueForKey(key);
  return $persistentStore.read(key);
}

function _notify(title: string, sub: string, body: string): void {
  if (isQX) $notify(title, sub, body);
  else $notification.post(title, sub, body);
}

const TEST_URL: string = 'http://cp.cloudflare.com/generate_204';
const TIMEOUT_MS: number = 10000;

function barkPush(title: string, body: string): Promise<void> {
  const barkKey: string | undefined = _read('Bark_Key');
  if (!barkKey) return Promise.resolve();
  const url: string = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  return new Promise<void>((resolve) => $httpClient.get({ url, timeout: TIMEOUT_MS }, () => resolve()));
}

function telegramPush(title: string, body: string): Promise<void> {
  const token: string | undefined = _read('TG_BOT_TOKEN');
  const chatId: string | undefined = _read('TG_USER_ID');
  if (!token || !chatId) return Promise.resolve();
  const url: string = `https://api.telegram.org/bot${token}/sendMessage`;
  const params: { chat_id: string; text: string } = { chat_id: chatId, text: `${title}\n${body}` };
  return new Promise<void>((resolve) => $httpClient.post({
    url, timeout: TIMEOUT_MS,
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' }
  }, () => resolve()));
}

function notify(title: string, body: string): Promise<PromiseSettledResult<void>[]> {
  _notify(title, body, '');
  return Promise.allSettled([barkPush(title, body), telegramPush(title, body)]);
}

const start: number = Date.now();
$httpClient.get({ url: TEST_URL, timeout: TIMEOUT_MS }, (error: Error | null, response: $httpClientResponse | null, _data: string) => {
  const elapsed: number = Date.now() - start;
  let push: Promise<unknown> = Promise.resolve();
  if (error) {
    push = notify('⚠️ 节点健康检测', `代理连接失败: ${error}\n测试地址: ${TEST_URL}\n应急: 将 Final 策略组临时切换为 DIRECT`);
  } else if (response && (response.status === 204)) {
    console.log(`✅ 节点正常, 延迟 ${elapsed}ms`);
  } else {
    const status: number | string = response ? (response.status) : 'unknown';
    push = notify('⚠️ 节点健康检测', `代理响应异常: HTTP ${status} (${elapsed}ms)\n测试地址: ${TEST_URL}`);
  }
  Promise.resolve(push).then(() => $done());
});
