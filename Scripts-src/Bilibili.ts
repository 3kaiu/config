interface SignResult {
  ok: boolean;
  msg: string;
  coins?: number;
}

const DEBUG: boolean = typeof $argument !== "undefined" && $argument.includes("BILI_DEBUG_ENABLE=true");

function log(msg: string): void { if (DEBUG) console.log(msg); }

function liveSignIn(): Promise<SignResult> {
  return new Promise<SignResult>((resolve) => {
    $httpClient.get({
      url: "https://api.live.bilibili.com/xlive/web-interface/v1/sign/doSign",
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Referer": "https://live.bilibili.com",
      }
    }, (err: Error | null, _resp: $httpClientResponse, body: string) => {
      if (err) { resolve({ ok: false, msg: "请求失败: " + err }); return; }
      try {
        const data: { code: number; data?: { text?: string }; message?: string } = JSON.parse(body);
        if (data.code === 0) {
          resolve({ ok: true, msg: data.data && data.data.text || "签到成功" });
        } else if (data.code === 1011040) {
          resolve({ ok: true, msg: "已签到过" });
        } else {
          resolve({ ok: false, msg: data.message || "未知错误" });
        }
      } catch (e) {
        resolve({ ok: false, msg: "解析失败" });
      }
    });
  });
}

function getCoinBalance(): Promise<SignResult> {
  return new Promise<SignResult>((resolve) => {
    $httpClient.get({
      url: "https://api.bilibili.com/x/web-interface/coin/balance",
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" }
    }, (err: Error | null, _resp: $httpClientResponse, body: string) => {
      if (err) { resolve({ ok: false, msg: "请求失败" }); return; }
      try {
        const data: { code: number; data?: number; message?: string } = JSON.parse(body);
        if (data.code === 0) {
          resolve({ ok: true, coins: data.data || 0, msg: "" });
        } else {
          resolve({ ok: false, msg: data.message || "未登录" });
        }
      } catch (e) { resolve({ ok: false, msg: "解析失败" }); }
    });
  });
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
