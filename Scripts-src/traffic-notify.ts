const isQX: boolean = typeof $task !== 'undefined';

function _read(key: string): string | undefined {
  if (isQX) return $prefs.valueForKey(key);
  return $persistentStore.read(key);
}

function _notify(title: string, sub: string, body: string): void {
  if (isQX) $notify(title, sub, body);
  else $notification.post(title, sub, body);
}

function barkPush(title: string, body: string): Promise<void> {
  const barkKey: string | undefined = _read('Bark_Key');
  if (!barkKey) return Promise.resolve();
  const url: string = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  return new Promise<void>((resolve) => $httpClient.get({ url, timeout: 10000 }, () => resolve()));
}

function telegramPush(title: string, body: string): Promise<void> {
  const token: string | undefined = _read('TG_BOT_TOKEN');
  const chatId: string | undefined = _read('TG_USER_ID');
  if (!token || !chatId) return Promise.resolve();
  const params: { chat_id: string; text: string } = { chat_id: chatId, text: `${title}\n${body}` };
  return new Promise<void>((resolve) => $httpClient.post({
    url: `https://api.telegram.org/bot${token}/sendMessage`, timeout: 10000,
    body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' }
  }, () => resolve()));
}

function notify(title: string, body: string): Promise<PromiseSettledResult<void>[]> {
  _notify(title, body, '');
  return Promise.allSettled([barkPush(title, body), telegramPush(title, body)]);
}

let push: Promise<unknown> = Promise.resolve();
try {
  if (isQX) {
    push = notify('📊 运行心跳', 'QX 正常运行中\n(流量详情不可用, QX 不支持 $environment)');
  } else {
    const env: { surgeVersion?: string; buildVersion?: string } | undefined = $environment;
    if (env && env.surgeVersion) {
      let info: string = 'Loon ' + env.surgeVersion;
      if (env.buildVersion) info += ' (build ' + env.buildVersion + ')';
      push = notify('📊 Loon 流量统计', info + '\nLoon 正常运行中');
    } else {
      push = notify('📊 Loon 运行心跳', 'Loon 正常运行中\n(流量详情不可用)');
    }
  }
} catch (e) {
  push = notify('📊 运行心跳', '正常运行中\n(环境信息获取异常)');
}

Promise.resolve(push).then(() => $done());
