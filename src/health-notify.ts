function read(key: string): string | undefined {
  return $persistentStore.read(key);
}

function notify(title: string, sub: string, body: string): void {
  $notification.post(title, sub, body);
}

function httpGet(url: string): Promise<void> {
  return new Promise<void>((resolve) => $httpClient.get({ url, timeout: 10000 }, () => resolve()));
}

function httpPost(url: string, body: string): Promise<void> {
  return new Promise<void>((resolve) => $httpClient.post({ url, timeout: 10000, body, headers: { 'Content-Type': 'application/json' } }, () => resolve()));
}

const TEST_URL = 'http://cp.cloudflare.com/generate_204';
const TIMEOUT_MS = 10000;

function barkPush(title: string, body: string): Promise<void> {
  const barkKey = read('Bark_Key');
  if (!barkKey) return Promise.resolve();
  return httpGet(`https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`);
}

function telegramPush(title: string, body: string): Promise<void> {
  const token = read('TG_BOT_TOKEN');
  const chatId = read('TG_USER_ID');
  if (!token || !chatId) return Promise.resolve();
  return httpPost(
    `https://api.telegram.org/bot${token}/sendMessage`,
    JSON.stringify({ chat_id: chatId, text: `${title}\n${body}` })
  );
}

function doNotify(title: string, body: string): Promise<PromiseSettledResult<void>[]> {
  notify(title, body, '');
  return Promise.allSettled([barkPush(title, body), telegramPush(title, body)]);
}

const start = Date.now();
const req = new Promise<{ status?: number }>((resolve) => $httpClient.get({ url: TEST_URL, timeout: TIMEOUT_MS }, (_e: Error | null, r: $httpClientResponse | null) => resolve(r || {})));

req.then((response: { status?: number }) => {
  const elapsed = Date.now() - start;
  let push: Promise<unknown> = Promise.resolve();
  if (response.status === 204) {
    console.log(`✅ 节点正常, 延迟 ${elapsed}ms`);
  } else if (response.status === undefined) {
    push = doNotify('⚠️ 节点健康检测', `代理连接失败\n测试地址: ${TEST_URL}\n应急: 将 Final 策略组临时切换为 DIRECT`);
  } else {
    push = doNotify('⚠️ 节点健康检测', `代理响应异常: HTTP ${response.status} (${elapsed}ms)\n测试地址: ${TEST_URL}`);
  }
  return Promise.resolve(push);
}).catch(() => doNotify('⚠️ 节点健康检测', `代理请求失败\n测试地址: ${TEST_URL}`)).then(() => $done());
