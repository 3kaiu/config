// barkPush / telegramPush / doNotify 已抽到 src/lib/notify.ts,
// 经 esbuild --inject 注入 (原为跨脚本重复副本)
const TEST_URL = 'http://cp.cloudflare.com/generate_204';
const TIMEOUT_MS = 10000;

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
