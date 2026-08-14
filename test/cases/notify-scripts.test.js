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
