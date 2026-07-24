/**
 * Qidian.js 包装层回归测试 (不含混淆引擎 — 引擎路径由 cron/getlogininfo 触发, 不在覆盖范围)
 *
 * 覆盖: finishWatch 重放计数 (Loon 8 次 / QX 3 次) · 404 拒绝端点 · getconf 覆写 ·
 *       广告 SDK 秒播 · 每日阅读积分满值 · Token 窃取持久化
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });
const QIDIAN_BASE = "https://magev6.if.qidian.com/argus/api";

exports.tests = {
  "replay: 激励视频 Loon 重放 8 次 (共 9/9)": async (a, h) => {
    const sb = h.createSandbox({
      mode: "loon",
      request: {
        method: "POST",
        url: `${QIDIAN_BASE}/v1/video/adv/finishWatch`,
        headers: { "X-Test": "1" },
        body: JSON.stringify({ taskId: "1218712929269776384", extra: "x" }),
      },
      // 无 $response → request 阶段
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    a.equal(s.httpCalls.length, 8, "应重放 8 次 (原始请求由宿主转发, 不在 httpCalls 中)");
    a.ok(s.httpCalls.every((c) => c.method === "POST"), "全部为 POST");
    a.ok(s.httpCalls.every((c) => String(c.body).includes("1218712929269776384")), "重放 body 含 taskId");
    const noti = s.notifications[0];
    a.ok(noti, "应有完成通知");
    a.includes(noti.body, "9/9", "通知应报 9/9");
  },
  "replay: 福利任务 QX 精简模式重放 2 次 (count=3 → min(2,3)=2, 共 3/3)": async (a, h) => {
    const sb = h.createSandbox({
      mode: "qx",
      request: {
        method: "POST",
        url: `https://h5.if.qidian.com/argus/api/v2/video/adv/finishWatch`,
        headers: {},
        body: JSON.stringify({ taskId: "1218712929269776388" }),
      },
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    a.equal(s.httpCalls.length, 2, "QX 精简: min(count-1, 3) = 2 次重放");
    a.includes(s.notifications[0].body, "3/3", "通知应报 3/3");
  },
  "replay: 激励视频 QX 精简模式重放 3 次 (count=9 → min(8,3)=3)": async (a, h) => {
    const sb = h.createSandbox({
      mode: "qx",
      request: {
        method: "POST",
        url: `https://h5.if.qidian.com/argus/api/v2/video/adv/finishWatch`,
        headers: {},
        body: JSON.stringify({ taskId: "1218712929269776384" }),
      },
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    a.equal(s.httpCalls.length, 3, "QX 精简: min(8, 3) = 3 次重放 (避免 10s 任务超时)");
    // 注: QX 精简模式 total = replayCount+1 = 4, 通知反映本次精简执行数 (4/4), 非任务总数 9
    a.includes(s.notifications[0].body, "4/4", "通知应报 4/4 (精简模式执行数)");
  },
  "replay: 未知 taskId 不重放直接放行": async (a, h) => {
    const sb = h.createSandbox({
      mode: "loon",
      request: { method: "POST", url: `${QIDIAN_BASE}/v1/video/adv/finishWatch`, headers: {}, body: JSON.stringify({ taskId: "9999999" }) },
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    a.equal(s.httpCalls.length, 0, "未知任务不应重放");
  },
  "replay: 部分失败时通知反映成功数": async (a, h) => {
    let n = 0;
    const sb = h.createSandbox({
      mode: "loon",
      request: { method: "POST", url: `${QIDIAN_BASE}/v1/video/adv/finishWatch`, headers: {}, body: JSON.stringify({ taskId: "1218712929269776384" }) },
      httpHandler: () => { n++; return n % 2 === 0 ? { err: new Error("boom") } : { res: { statusCode: 200 }, body: "{}" }; },
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    a.equal(s.httpCalls.length, 8, "仍应尝试全部 8 次");
    a.includes(s.notifications[0].body, "5/9", "4 次成功 + 1 原始 = 5/9");
  },
  "reject: 纯广告端点返回 404": async (a, h) => {
    const sb = h.createSandbox({
      mode: "loon",
      request: { method: "GET", url: `${QIDIAN_BASE}/v1/push/getdialog` },
      response: RESP({ Data: 1 }),
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    a.equal(s.doneCalls[0].status, 404, "getdialog 应 404");
  },
  "getconf: 广告字段覆写 + 删除 + GDT 移除": async (a, h) => {
    const sb = h.createSandbox({
      mode: "loon",
      request: { method: "GET", url: `${QIDIAN_BASE}/v1/client/getconf` },
      response: RESP({ Data: { PangleEnable: "1", SplashScreenInterval: "5", ActivityIcon: "x", BookShelfBottomIcons: "y", GDT: { a: 1 }, NewFeedsDiscover: 1, Keep: 42 } }),
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    const d = JSON.parse(s.doneCalls[0].body).Data;
    a.equal(d.PangleEnable, "0", "Pangle 应关闭");
    a.equal(d.SplashScreenInterval, "0", "开屏间隔应归零");
    a.equal(d.NewFeedsDiscover, 0, "发现 tab 应关闭");
    a.ok(!("ActivityIcon" in d), "ActivityIcon 应删除");
    a.ok(!("BookShelfBottomIcons" in d), "书架悬浮应删除");
    a.ok(!("GDT" in d), "GDT 应删除");
    a.equal(d.Keep, 42, "无关字段保留");
  },
  "adskip: GDT get_ads 时长 patch 为 1 秒": async (a, h) => {
    const sb = h.createSandbox({
      mode: "loon",
      request: { method: "GET", url: "https://ii.gdt.qq.com/get_ads?x=1" },
      response: RESP({ video_duration: 30, play_time: "15", nested: { show_time: 20 }, keep: 1 }),
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.video_duration, 1, "video_duration → 1");
    a.equal(out.play_time, "1", "play_time → '1' (字符串保持)");
    a.equal(out.nested.show_time, 1, "嵌套时长 → 1");
    a.equal(out.keep, 1, "无关字段保留");
  },
  "readtime: 今日阅读时长改写满值 + 任务全部完成": async (a, h) => {
    const sb = h.createSandbox({
      mode: "loon",
      request: { method: "GET", url: `${QIDIAN_BASE}/v1/readtime/readpage` },
      response: RESP({ Data: { ReadInfo: { TodayReadTime: 120 }, TaskModule: { TaskList: [{ Status: 0 }, { Status: 1 }] } } }),
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    const d = JSON.parse(s.doneCalls[0].body).Data;
    a.equal(d.ReadInfo.TodayReadTime, 7200, "阅读时长应满值 7200");
    a.ok(d.TaskModule.TaskList.every((t) => t.Status === 2), "任务应全部标记完成");
  },
  "token: request 阶段窃取请求头并持久化 (Qidian_Headers)": async (a, h) => {
    const sb = h.createSandbox({
      mode: "loon",
      request: { method: "POST", url: `${QIDIAN_BASE}/v2/checkin/checkin`, headers: { Cookie: "cmfuToken=test-token; QDH=1" } },
      // 无 $response → request 阶段
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    a.ok(s.store["Qidian_Headers"], "应持久化请求头");
    a.includes(s.store["Qidian_Headers"], "cmfuToken=test-token", "持久化内容含 Cookie");
    a.includes(s.logs.join("\n"), "已保存起点 Token", "应有保存日志");
  },
  "token: 日志/通知不泄漏 token 值": async (a, h) => {
    const sb = h.createSandbox({
      mode: "loon",
      request: { method: "POST", url: `${QIDIAN_BASE}/v2/checkin/checkin`, headers: { Cookie: "cmfuToken=SECRET-VALUE-123" } },
    });
    const s = await h.runScript("Scripts/Qidian.js", sb);
    a.notIncludes(s.logs.join("\n"), "SECRET-VALUE-123", "日志不应含 token 值");
    a.notIncludes(JSON.stringify(s.notifications), "SECRET-VALUE-123", "通知不应含 token 值");
  },
};
