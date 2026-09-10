// read / notify / httpGet / httpPost / barkPush / telegramPush / doNotify
// 均已抽到 src/lib/notify.ts, 经 esbuild --inject 注入 (原为跨脚本重复副本)
let push: Promise<unknown> = Promise.resolve();
try {
  const env = $environment;
  if (env && env.surgeVersion) {
    let info = env.surgeVersion;
    if (env.buildVersion) info += ' (build ' + env.buildVersion + ')';
    push = doNotify('📊 Loon 流量统计', info + '\nLoon 正常运行中');
  } else {
    push = doNotify('📊 运行心跳', '正常运行中');
  }
} catch (e) {
  console.error('traffic-notify error:', e);
  push = doNotify('📊 运行心跳', '正常运行中');
}

Promise.resolve(push).then(() => $done());
