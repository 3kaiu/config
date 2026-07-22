/**
 * traffic-notify.js — 流量统计通知 (v7.8)
 *
 * Loon: 通过 $environment 获取运行状态信息, 推送流量摘要。
 * QX: $environment 不可用, 推送心跳通知。
 * 兼容 Loon / Quantumult X
 *
 * Loon cron: 0 22 * * *
 * QX cron: 0 22 * * *
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

function barkPush(title, body) {
  const barkKey = _read('Bark_Key');
  if (!barkKey) return;
  const url = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  $httpClient.get({ url: url, timeout: 10000 }, () => {});
}

function telegramPush(title, body) {
  const token = _read('TG_BOT_TOKEN');
  const chatId = _read('TG_USER_ID');
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const params = { chat_id: chatId, text: `${title}\n${body}` };
  $httpClient.post({ url: url, timeout: 10000, body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' } }, () => {});
}

function notify(title, body) {
  _notify(title, body, '');
  barkPush(title, body);
  telegramPush(title, body);
}

try {
  if (isQX) {
    // QX 无 $environment API, 推送心跳通知
    notify('📊 运行心跳', 'QX 正常运行中\n(流量详情不可用, QX 不支持 $environment)');
  } else {
    const env = $environment;
    if (env && env.surgeVersion) {
      var info = 'Loon ' + env.surgeVersion;
      if (env.buildVersion) info += ' (build ' + env.buildVersion + ')';
      notify('📊 Loon 流量统计', info + '\nLoon 正常运行中');
    } else {
      notify('📊 Loon 运行心跳', 'Loon 正常运行中\n(流量详情不可用)');
    }
  }
} catch (e) {
  notify('📊 运行心跳', '正常运行中\n(环境信息获取异常)');
}
$done();
