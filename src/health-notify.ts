// barkPush / telegramPush / doNotify 已抽到 src/lib/notify.ts,
// 经 esbuild --inject 注入 (原为跨脚本重复副本)
const TEST_URL = 'http://cp.cloudflare.com/generate_204';
const TIMEOUT_MS = 10000;

// $done 幂等守卫 — 2026-09-11 深度审计 NEW-07。
// 原实现末尾是 `....catch(() => doNotify(...)).then(() => $done())`。
// doNotify (src/lib/notify.ts) 首行是**同步**的 $notification.post, 它抛错时:
//   1. 该 .catch 回调返回 rejected promise → 后面的 .then(() => $done()) 被跳过
//   2. 且这个 rejection 无后续 .catch → 顶层未处理
// 两条都指向同一后果: $done 永不执行 → Loon 侧请求挂死。
// 与 Bilibili.ts 的 finished 模式保持一致 (代理脚本必须恰好调用一次 $done)。
let finished = false;
function finish(): void {
  if (finished) return;
  finished = true;
  $done();
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
}).catch(() => {
  // 通知失败不得阻断 $done: 再套一层 try/catch, 失败时返回已决议的 promise
  try {
    return doNotify('⚠️ 节点健康检测', `代理请求失败\n测试地址: ${TEST_URL}`);
  } catch (e) {
    console.error('health-notify: 通知发送失败 (不影响 $done)', e);
    return Promise.resolve();
  }
}).then(() => finish(), () => finish());
