/**
 * traffic-notify.js — 流量统计通知 (v7.8)
 *
 * Loon: 通过 $environment 获取运行状态信息, 推送流量摘要。
 * QX / Surge: $environment 不可用, 推送心跳通知。
 * 兼容 Loon / Quantumult X / Surge
 *
 * 注: 本脚本实际为运行心跳 (两端 JS 环境均无真实流量统计 API),
 * 名称保留是为与 notify.plugin / task_local 的 tag 对齐。
 *
 * Loon cron: 0 22 * * *
 * QX cron: 0 22 * * *
 * Surge cron: 0 22 * * * (5 字段)
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

// 远程推送统一 Promise 化: $done() 会回收 JS 上下文, fire-and-forget 的
// $httpClient 请求会被中止 — 必须 await 完成后再 $done() (历史 bug 修复)
function barkPush(title, body) {
  const barkKey = _read('Bark_Key');
  if (!barkKey) return Promise.resolve();
  const url = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  return new Promise((resolve) => $httpClient.get({ url: url, timeout: 10000 }, () => resolve()));
}

function telegramPush(title, body) {
  const token = _read('TG_BOT_TOKEN');
  const chatId = _read('TG_USER_ID');
  if (!token || !chatId) return Promise.resolve();
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const params = { chat_id: chatId, text: `${title}\n${body}` };
  return new Promise((resolve) => $httpClient.post({ url: url, timeout: 10000, body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' } }, () => resolve()));
}

function notify(title, body) {
  _notify(title, body, '');
  return Promise.allSettled([barkPush(title, body), telegramPush(title, body)]);
}

let push = Promise.resolve();
try {
  if (isQX) {
    // QX 无 $environment API, 推送心跳通知
    push = notify('📊 运行心跳', 'QX 正常运行中\n(流量详情不可用, QX 不支持 $environment)');
  } else {
    const env = $environment;
    if (env && env.surgeVersion) {
      var info = 'Loon ' + env.surgeVersion;
      if (env.buildVersion) info += ' (build ' + env.buildVersion + ')';
      push = notify('📊 Loon 流量统计', info + '\nLoon 正常运行中');
    } else {
      push = notify('📊 Loon 运行心跳', 'Loon 正常运行中\n(流量详情不可用)');
    }
  }
} catch (e) {
  push = notify('📊 运行心跳', '正常运行中\n(环境信息获取异常)');
}
// 等待推送完成再结束, 否则上下文回收会中止推送
Promise.resolve(push).then(() => $done());
