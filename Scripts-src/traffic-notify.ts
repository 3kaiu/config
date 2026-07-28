import { notification } from "@nsnanocat/util/lib/notification.mjs";
import { done } from "@nsnanocat/util/lib/done.mjs";

function barkPush(title: string, body: string): Promise<void> {
  const barkKey = $persistentStore.read('Bark_Key');
  if (!barkKey) return Promise.resolve();
  const url = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  return new Promise<void>((resolve) => $httpClient.get({ url, timeout: 10000 }, () => resolve()));
}

function telegramPush(title: string, body: string): Promise<void> {
  const token = $persistentStore.read('TG_BOT_TOKEN');
  const chatId = $persistentStore.read('TG_USER_ID');
  if (!token || !chatId) return Promise.resolve();
  const params = { chat_id: chatId, text: `${title}\n${body}` };
  return new Promise<void>((resolve) => $httpClient.post({
    url: `https://api.telegram.org/bot${token}/sendMessage`, timeout: 10000,
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' }
  }, () => resolve()));
}

function notify(title: string, body: string): Promise<PromiseSettledResult<void>[]> {
  notification(title, body, '');
  return Promise.allSettled([barkPush(title, body), telegramPush(title, body)]);
}

let push: Promise<unknown> = Promise.resolve();
try {
  const env = $environment;
  if (env && env.surgeVersion) {
    let info = 'Loon ' + env.surgeVersion;
    if (env.buildVersion) info += ' (build ' + env.buildVersion + ')';
    push = notify('📊 Loon 流量统计', info + '\nLoon 正常运行中');
  } else {
    push = notify('📊 运行心跳', '正常运行中');
  }
} catch (e) {
  push = notify('📊 运行心跳', '正常运行中');
}

Promise.resolve(push).then(() => done());
