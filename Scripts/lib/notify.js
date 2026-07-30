/**
 * notify.js - Canonical 通知推送模块模板 (Loon / Quantumult X / Surge)
 *
 * ⚠️ Loon/QX 脚本运行在隔离 JS 上下文中, 不支持 require()/import。
 * 本文件是"源真理"(single source of truth)模板 —— 需要推送通知的脚本
 * 应从此文件复制相关函数到自身文件中, 而非引用此文件。
 *
 * 依赖:
 *   - $httpClient (Loon/Surge) — QX 下推送函数使用 $httpClient 兼容层
 *   - $persistentStore (Loon/Surge) 或 $prefs (QX)
 *   - $notification.post (Loon/Surge) 或 $notify (QX)
 *
 * 持久化存储 Key 约定 (跨脚本统一):
 *   Bark_Key          Bark 推送 Key
 *   TG_BOT_TOKEN      Telegram Bot Token
 *   TG_USER_ID        Telegram Chat ID
 *
 * API:
 *   barkPush(title, body)     Bark 远程推送, 返回 Promise
 *   telegramPush(title, body) Telegram 远程推送, 返回 Promise
 *   notify(title, body)       本地通知 + Bark/Telegram 远程推送, 返回 Promise
 *
 * ⚠️ 重要: notify() 返回 Promise, 调用方必须 await 后再 $done(),
 *    否则上下文回收会中止未完成的推送请求 (历史 bug: 推送静默失败)。
 *
 * 变更历史:
 *   - 从 health-notify.js / traffic-notify.js 的推送代码提取统一
 *   - 统一 PUSH_TIMEOUT_MS 常量 (原各脚本使用 TIMEOUT_MS 或 10000 字面量)
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

// ── 推送超时 (毫秒) ──
const PUSH_TIMEOUT_MS = 10000;

// 远程推送统一 Promise 化: $done() 会回收 JS 上下文, fire-and-forget 的
// $httpClient 请求会被中止 - 必须 await 完成后再 $done() (历史 bug 修复)
function barkPush(title, body) {
  const barkKey = _read('Bark_Key');
  if (!barkKey) return Promise.resolve();
  const url = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  return new Promise((resolve) => $httpClient.get({ url: url, timeout: PUSH_TIMEOUT_MS }, () => resolve()));
}

function telegramPush(title, body) {
  const token = _read('TG_BOT_TOKEN');
  const chatId = _read('TG_USER_ID');
  if (!token || !chatId) return Promise.resolve();
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const params = { chat_id: chatId, text: `${title}\n${body}` };
  return new Promise((resolve) => $httpClient.post({ url: url, timeout: PUSH_TIMEOUT_MS, body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' } }, () => resolve()));
}

function notify(title, body) {
  _notify(title, body, '');
  return Promise.allSettled([barkPush(title, body), telegramPush(title, body)]);
}
