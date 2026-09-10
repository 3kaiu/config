interface SignResult {
  ok: boolean;
  msg: string;
  coins?: number;
}

/**
 * 调试开关 — 由插件 argument=[{BILI_DEBUG_ENABLE}] 传入。
 * (2026-09-11 分模块审计 MOD-02) 原实现为 `$argument.includes("BILI_DEBUG_ENABLE=true")`,
 * 但 bilibili-pro.plugin 的 cron 行**从不传 argument=**, 故该分支永远不可达。
 * 改用共享 readFlag 后同时兼容现代(对象)与传统(字符串)两种传参形态。
 */
const DEBUG: boolean = readFlag("BILI_DEBUG_ENABLE");

function log(msg: string): void { if (DEBUG) console.log(msg); }

const TIMEOUT = 10000;

function httpGet<T>(url: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    $httpClient.get({ url, headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" }, timeout: TIMEOUT }, (err: Error | null, _resp: $httpClientResponse, body: string) => {
      clearTimeout(timer);
      if (err) { reject(err); return; }
      try { resolve(JSON.parse(body)); } catch { reject(new Error("parse")); }
    });
  });
}

function liveSignIn(): Promise<SignResult> {
  return httpGet<{ code: number; data?: { text?: string }; message?: string }>("https://api.live.bilibili.com/xlive/web-interface/v1/sign/doSign")
    .then(data => {
      if (data.code === 0) return { ok: true, msg: data.data?.text || "签到成功" };
      if (data.code === 1011040) return { ok: true, msg: "已签到过" };
      return { ok: false, msg: data.message || "未知错误" };
    })
    .catch(e => ({ ok: false, msg: "请求失败: " + (e.message || e) }));
}

function getCoinBalance(): Promise<SignResult> {
  return httpGet<{ code: number; data?: number; message?: string }>("https://api.bilibili.com/x/web-interface/coin/balance")
    .then(data => {
      if (data.code === 0) return { ok: true, coins: data.data || 0, msg: "" };
      return { ok: false, msg: data.message || "未登录" };
    })
    .catch(() => ({ ok: false, msg: "请求失败" }));
}

/**
 * 收尾守卫 (2026-09-11 审计, ROB-02)
 *
 * 原实现 `run();` 是 fire-and-forget: run() 内任一步抛错 (最现实的是
 * $notification.post 在运行时不可用) 都会让 $done() 永不执行 — 定时任务
 * 既不报错也不收尾, 且产生 unhandled rejection。现改为 catch 兜底 + 统一收尾,
 * 并用 finished 标志防止"catch 里已收尾 + finally 再收尾"造成重复 $done。
 */
let finished = false;
function finish(): void {
  if (finished) return;
  finished = true;
  $done();
}

async function run(): Promise<void> {
  log("Bilibili 定时任务开始");
  const signResult: SignResult = await liveSignIn();
  log("签到结果: " + signResult.msg);
  const coinResult: SignResult = await getCoinBalance();

  if (signResult.ok) {
    const coin: string = coinResult.coins !== undefined ? `，硬币: ${coinResult.coins}` : "";
    $notification.post("Bilibili", "每日签到", `${signResult.msg}${coin}`);
  } else {
    $notification.post("Bilibili", "签到失败", signResult.msg);
  }
}

run()
  .catch((e: Error) => {
    // 此 catch 自身必须绝不抛出, 否则下方 then 不会执行 → $done 仍会丢失
    try {
      console.log("Bilibili 执行异常: " + (e && e.message ? e.message : e));
      $notification.post("Bilibili", "脚本异常", String(e && e.message ? e.message : e));
    } catch { /* 通知不可用时只记录, 不能影响收尾 */ }
  })
  .then(() => finish());
