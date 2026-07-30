interface SignResult {
  ok: boolean;
  msg: string;
  coins?: number;
}

const DEBUG: boolean = typeof $argument !== "undefined" && $argument.includes("BILI_DEBUG_ENABLE=true");

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
  $done();
}

run();
