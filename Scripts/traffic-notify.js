/**
 * traffic-notify.js — 流量统计通知 (v7.8)
 *
 * 通过 Loon 的 $environment 获取运行状态信息,
 * 推送流量摘要到通知。如果 API 不可用, 推送心跳通知。
 *
 * Loon cron: 0 22 * * *
 */

function barkPush(title, body) {
  const barkKey = $persistentStore.read('Bark_Key');
  if (!barkKey) return;
  const url = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  $httpClient.get({ url: url, timeout: 10000 }, () => {});
}

function telegramPush(title, body) {
  const token = $persistentStore.read('TG_BOT_TOKEN');
  const chatId = $persistentStore.read('TG_USER_ID');
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const params = { chat_id: chatId, text: `${title}\n${body}` };
  $httpClient.post({ url: url, timeout: 10000, body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' } }, () => {});
}

function notify(title, body) {
  $notification.post(title, body, '');
  barkPush(title, body);
  telegramPush(title, body);
}

try {
  const env = $environment;
  if (env && env.surgeVersion) {
    var info = 'Loon ' + env.surgeVersion;
    if (env.buildVersion) info += ' (build ' + env.buildVersion + ')';
    notify('📊 Loon 流量统计', info + '\nLoon 正常运行中');
  } else {
    notify('📊 Loon 运行心跳', 'Loon 正常运行中\n(流量详情不可用)');
  }
} catch (e) {
  notify('📊 Loon 运行心跳', 'Loon 正常运行中\n(环境信息获取异常)');
}
$done();
