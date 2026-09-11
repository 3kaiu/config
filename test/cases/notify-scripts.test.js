const { createSandbox, runScript } = require("../harness");

module.exports.tests = {};

const t = (name, fn) => { module.exports.tests[name] = fn; };

t("health-notify: 节点正常时无通知", async (assert) => {
  const sb = createSandbox({
    httpHandler: () => ({ res: { status: 204 }, body: "" }),
  });
  const state = await runScript("Scripts/health-notify.js", sb);
  assert.equal(state.notifications.length, 0, "不应推送通知");
  assert.equal(state.doneCalls.length, 1, "应调用 $done");
});

t("health-notify: 连接失败推送告警", async (assert) => {
  const sb = createSandbox({
    httpHandler: () => ({ err: new Error("ETIMEDOUT") }),
  });
  const state = await runScript("Scripts/health-notify.js", sb);
  assert.ok(state.notifications.length > 0, "应有通知");
  assert.ok(state.notifications[0].title.includes("节点"), "标题含节点");
  assert.equal(state.doneCalls.length, 1, "应调用 $done");
});

t("health-notify: 异常状态码推送告警", async (assert) => {
  const sb = createSandbox({
    httpHandler: () => ({ res: { status: 502 }, body: "" }),
  });
  const state = await runScript("Scripts/health-notify.js", sb);
  assert.ok(state.notifications.length > 0, "应有通知");
  assert.equal(state.doneCalls.length, 1, "应调用 $done");
});

t("health-notify: Bark 推送", async (assert) => {
  const sb = createSandbox({
    store: { Bark_Key: "test-bark-key" },
    httpHandler: () => ({ err: new Error("timeout") }),
  });
  const state = await runScript("Scripts/health-notify.js", sb);
  const bark = state.httpCalls.filter((c) => c.url.startsWith("https://api.day.app/"));
  assert.ok(bark.length > 0, "应调用 Bark API");
  assert.equal(state.doneCalls.length, 1, "应调用 $done");
});

t("health-notify: Telegram 推送", async (assert) => {
  const sb = createSandbox({
    store: { TG_BOT_TOKEN: "bot:token", TG_USER_ID: "12345" },
    httpHandler: () => ({ err: new Error("timeout") }),
  });
  const state = await runScript("Scripts/health-notify.js", sb);
  const tg = state.httpCalls.filter((c) => c.url.startsWith("https://api.telegram.org/"));
  assert.ok(tg.length > 0, "应调用 Telegram API");
});

t("traffic-notify: 推送心跳", async (assert) => {
  const sb = createSandbox();
  const state = await runScript("Scripts/traffic-notify.js", sb);
  assert.ok(state.notifications.length > 0, "应有通知");
  assert.equal(state.doneCalls.length, 1, "应调用 $done");
});

// ── 2026-09-11 深度审计 NEW-07: 通知失败不得让 $done 消失 ──
// doNotify (src/lib/notify.ts) 首行是**同步**的 $notification.post。它抛错时,
// 旧实现会让末尾的 .then(() => $done()) 被跳过 (health-notify),
// 或在 catch 内二次抛错直接冒泡成顶层异常 (traffic-notify) ——
// 两者同一后果: Loon 侧请求挂死, 且伴随 unhandled rejection。
// 装 process 级监听器 (同 audit-regressions 的 rob-02), 否则未处理拒绝会直接终止 runner,
// 只能看到崩溃而看不到"哪条断言失败"。
async function withUnhandledWatch(assert, fn) {
  const unhandled = [];
  const onUnhandled = (e) => unhandled.push(e && e.message);
  process.on("unhandledRejection", onUnhandled);
  try {
    await fn();
    for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
    assert.equal(unhandled.length, 0, "不应产生 unhandled rejection");
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
  }
}

t("health-notify: $notification.post 抛错仍收尾 $done (NEW-07)", async (assert) => {
  const sb = createSandbox({ httpHandler: () => ({ err: new Error("ETIMEDOUT") }) });
  sb.ctx.$notification.post = () => { throw new Error("notification unavailable"); };
  await withUnhandledWatch(assert, async () => {
    const state = await runScript("Scripts/health-notify.js", sb);
    assert.equal(state.doneCalls.length, 1, "通知抛错也必须恰好调用一次 $done");
    assert.equal(state.scriptError, null, "不应有未捕获的顶层异常");
  });
});

t("traffic-notify: $notification.post 抛错仍收尾 $done (NEW-07)", async (assert) => {
  const sb = createSandbox();
  sb.ctx.$notification.post = () => { throw new Error("notification unavailable"); };
  await withUnhandledWatch(assert, async () => {
    const state = await runScript("Scripts/traffic-notify.js", sb);
    assert.equal(state.doneCalls.length, 1, "通知抛错也必须恰好调用一次 $done");
    assert.equal(state.scriptError, null, "不应有未捕获的顶层异常");
  });
});
