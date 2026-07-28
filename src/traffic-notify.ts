const isQX = typeof $task !== 'undefined';

function read(key: string): string | undefined {
  return isQX ? $prefs.valueForKey(key) : $persistentStore.read(key);
}

function notify(title: string, sub: string, body: string): void {
  if (isQX) $notify(title, sub, body);
  else $notification.post(title, sub, body);
}

function httpGet(url: string): Promise<void> {
  if (isQX) return $task.fetch({ url, method: 'GET' }).then(() => {});
  return new Promise<void>((resolve) => $httpClient.get({ url, timeout: 10000 }, () => resolve()));
}

function httpPost(url: string, body: string): Promise<void> {
  if (isQX) {
    return $task.fetch({ url, method: 'POST', body, headers: { 'Content-Type': 'application/json' } }).then(() => {});
  }
  return new Promise<void>((resolve) => $httpClient.post({ url, timeout: 10000, body, headers: { 'Content-Type': 'application/json' } }, () => resolve()));
}

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

let push: Promise<unknown> = Promise.resolve();
try {
  const env = $environment;
  if (env && env.surgeVersion) {
    let info = 'Loon ' + env.surgeVersion;
    if (env.buildVersion) info += ' (build ' + env.buildVersion + ')';
    push = doNotify('📊 Loon 流量统计', info + '\nLoon 正常运行中');
  } else {
    push = doNotify('📊 运行心跳', '正常运行中');
  }
} catch (e) {
  push = doNotify('📊 运行心跳', '正常运行中');
}

Promise.resolve(push).then(() => $done());
