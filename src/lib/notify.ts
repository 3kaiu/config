/**
 * 共享工具 — 通知推送 (Bark / Telegram)
 *
 * 为什么单独成模块: `barkPush` / `telegramPush` / `doNotify` 此前在
 * traffic-notify.ts 与 health-notify.ts 里各有一份**逐字符相同**的副本。
 * 通知是"监控脚本唯一的输出通道" — 两份副本意味着通道修正要改两处,
 * 漏一处就是静默的告警丢失。
 *
 * 分发方式: 经 esbuild `--inject` 注入, 导出名在脚本中直接以全局标识符使用。
 * 见 package.json 的 build 脚本与 AGENTS.md。
 *
 * 与 Env 类的关系: src/env.ts 的 Env 实例方法 (barkPush/telegramPush/doNotify)
 * 是**功能超集** — 额外支持 `barkKey` 别名与 PushPlus 渠道, 供 `new Env(...)`
 * 的脚本使用。本模块刻意保持与两个监控脚本**原有语义完全一致** (仅 Bark_Key +
 * Telegram, HTTP 错误一律吞掉只求"发出即可"), 故不合并进 Env —
 * 统一两者属行为变更 (会给监控脚本新增 PushPlus 渠道), 需单独决策。
 */

/** 读取持久化存储; 缺失返回 undefined */
function readStore(key: string): string | undefined {
  return $persistentStore.read(key);
}

/** GET 并忽略结果 — 推送属尽力而为, 失败不抛错 (与两脚本原语义一致) */
function httpGet(url: string): Promise<void> {
  return new Promise<void>((resolve) => $httpClient.get({ url, timeout: 10000 }, () => resolve()));
}

/** POST JSON 并忽略结果 — 同上 */
function httpPost(url: string, body: string): Promise<void> {
  return new Promise<void>((resolve) =>
    $httpClient.post({ url, timeout: 10000, body, headers: { 'Content-Type': 'application/json' } }, () => resolve())
  );
}

/** Bark 推送; 未配置 Bark_Key 时静默跳过 */
export function barkPush(title: string, body: string): Promise<void> {
  const barkKey = readStore('Bark_Key');
  if (!barkKey) return Promise.resolve();
  return httpGet(`https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`);
}

/** Telegram 推送; 未配置 token/chatId 时静默跳过 */
export function telegramPush(title: string, body: string): Promise<void> {
  const token = readStore('TG_BOT_TOKEN');
  const chatId = readStore('TG_USER_ID');
  if (!token || !chatId) return Promise.resolve();
  return httpPost(
    `https://api.telegram.org/bot${token}/sendMessage`,
    JSON.stringify({ chat_id: chatId, text: `${title}\n${body}` })
  );
}

/**
 * 本地通知 + 并行推送全部渠道。
 * 用 allSettled 保证单个渠道失败不影响其他渠道, 也不影响脚本收尾 ($done)。
 */
export function doNotify(title: string, body: string): Promise<PromiseSettledResult<void>[]> {
  $notification.post(title, body, '');
  return Promise.allSettled([barkPush(title, body), telegramPush(title, body)]);
}
