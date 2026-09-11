// read / notify / httpGet / httpPost / barkPush / telegramPush / doNotify
// 均已抽到 src/lib/notify.ts, 经 esbuild --inject 注入 (原为跨脚本重复副本)

// 2026-09-11 深度审计 NEW-07: doNotify (src/lib/notify.ts) 首行是**同步**的
// $notification.post, 可能抛错。原实现在 catch 里**再调一次** doNotify ——
// 同一个调用同样会抛, 而这次抛在 catch 之外, 直接冒泡成顶层异常,
// 于是末尾的 $done 永不执行 → Loon 侧请求挂死。
// 改为统一经 safeNotify 包装: 通知失败绝不影响 $done。
function safeNotify(title: string, body: string): Promise<unknown> {
  try {
    return Promise.resolve(doNotify(title, body));
  } catch (e) {
    console.error('traffic-notify: 通知发送失败 (不影响 $done)', e);
    return Promise.resolve();
  }
}

let push: Promise<unknown> = Promise.resolve();
try {
  const env = $environment;
  if (env && env.surgeVersion) {
    let info = env.surgeVersion;
    if (env.buildVersion) info += ' (build ' + env.buildVersion + ')';
    push = safeNotify('📊 Loon 流量统计', info + '\nLoon 正常运行中');
  } else {
    push = safeNotify('📊 运行心跳', '正常运行中');
  }
} catch (e) {
  // 此 catch 现在只兜 "$environment 访问 / 字符串拼接" 一类失败
  console.error('traffic-notify error:', e);
  push = Promise.resolve();
}

Promise.resolve(push).then(() => $done(), () => $done());
