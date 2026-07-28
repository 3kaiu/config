/**
 * Bilibili 每日签到 & 信息汇总
 */

const DEBUG = typeof $argument !== "undefined" && $argument.includes("BILI_DEBUG_ENABLE=true");

function log(msg) { if (DEBUG) console.log(msg); }

// 尝试 B 站直播签到
function liveSignIn() {
  return new Promise((resolve) => {
    $httpClient.get({
      url: "https://api.live.bilibili.com/xlive/web-interface/v1/sign/doSign",
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Referer": "https://live.bilibili.com",
      }
    }, (err, resp, body) => {
      if (err) { resolve({ ok: false, msg: "请求失败: " + err }); return; }
      try {
        const data = JSON.parse(body);
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

// 获取硬币信息
function getCoinBalance() {
  return new Promise((resolve) => {
    $httpClient.get({
      url: "https://api.bilibili.com/x/web-interface/coin/balance",
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" }
    }, (err, resp, body) => {
      if (err) { resolve({ ok: false, msg: "请求失败" }); return; }
      try {
        const data = JSON.parse(body);
        if (data.code === 0) {
          resolve({ ok: true, coins: data.data || 0 });
        } else {
          resolve({ ok: false, msg: data.message || "未登录" });
        }
      } catch (e) { resolve({ ok: false, msg: "解析失败" }); }
    });
  });
}

async function run() {
  log("Bilibili 定时任务开始");
  const signResult = await liveSignIn();
  log("签到结果: " + signResult.msg);
  const coinResult = await getCoinBalance();
  log("硬币: " + (coinResult.coins ?? coinResult.msg));

  if (signResult.ok) {
    const coin = coinResult.coins !== undefined ? `，硬币: ${coinResult.coins}` : "";
    $notification.post("Bilibili", "每日签到", `${signResult.msg}${coin}`);
  } else {
    $notification.post("Bilibili", "签到失败", signResult.msg);
  }
  $done();
}

run();
