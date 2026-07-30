/**
 * Bilibili / LinkedIn / Twitter — 回归测试
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });

exports.tests = {
  // ── Bilibili ──
  "bilibili: 签到成功时通知签到结果和硬币数": async (a, h) => {
    const sb = h.createSandbox({});
    sb.context.$httpClient = {
      get: (opts, cb) => {
        if (opts.url.includes("doSign")) cb(null, { status: 200 }, JSON.stringify({ code: 0, data: { text: "签到成功" } }));
        else if (opts.url.includes("coin/balance")) cb(null, { status: 200 }, JSON.stringify({ code: 0, data: 42 }));
      }
    };
    const s = await h.runScript("Scripts/Bilibili.js", sb);
    const n = s.notifications;
    a.equal(n.length, 1, "应发送一次通知");
    a.equal(n[0].title, "Bilibili", "标题应为 Bilibili");
    a.ok(n[0].body.includes("签到成功"), "正文应含签到结果");
    a.ok(n[0].body.includes("42"), "应含硬币数");
  },
  "bilibili: 已签到过不报错": async (a, h) => {
    const sb = h.createSandbox({});
    sb.context.$httpClient = {
      get: (opts, cb) => {
        if (opts.url.includes("doSign")) cb(null, { status: 200 }, JSON.stringify({ code: 1011040 }));
        else if (opts.url.includes("coin/balance")) cb(null, { status: 200 }, JSON.stringify({ code: 0, data: 10 }));
      }
    };
    const s = await h.runScript("Scripts/Bilibili.js", sb);
    const n = s.notifications;
    a.equal(n.length, 1, "应发送一次通知");
    a.ok(n[0].body.includes("已签到过"), "应提示已签到");
  },
  "bilibili: 网络错误时通知失败": async (a, h) => {
    const sb = h.createSandbox({});
    sb.context.$httpClient = { get: (opts, cb) => cb(new Error("timeout"), null, "") };
    const s = await h.runScript("Scripts/Bilibili.js", sb);
    const n = s.notifications;
    a.equal(n.length, 1, "应发送一次通知");
    a.ok(n[0].body.includes("请求失败"), "应含失败原因");
  },
  "bilibili: 未登录时提示": async (a, h) => {
    const sb = h.createSandbox({});
    sb.context.$httpClient = {
      get: (opts, cb) => cb(null, { status: 200 }, JSON.stringify({ code: -101, message: "未登录" }))
    };
    const s = await h.runScript("Scripts/Bilibili.js", sb);
    const n = s.notifications;
    a.equal(n.length, 1, "应发送一次通知");
    a.ok(n[0].body.includes("未登录"), "应提示未登录");
  },

  // ── LinkedIn ──
  "linkedin: 删除 ad/sponsor/promot/recommend 前缀字段, 保留误匹配": async (a, h) => {
    // admin/address 也以 ad 开头 → 新旧正则都会删, 这是预期行为
    // 修复重点: some_sponsor 在新正则下不再匹配(旧正则无 ^ 锚定 sponsor)
    const body = {
      data: {
        ad: {}, sponsor: {}, promoted: {}, recommend: {},
        some_sponsor: "old-regex-false-positive", // 旧正则匹配, 新正则不匹配
        normal: "keep"
      }
    };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://www.linkedin.com/feed" } });
    const s = await h.runScript("Scripts/LinkedIn.js", sb);
    const out = JSON.parse(s.doneCalls[0].body).data;
    a.ok("some_sponsor" in out, "some_sponsor 应保留 (旧正则误删, 新正则修复)");
    a.ok("normal" in out, "normal 保留");
    a.ok(!("ad" in out), "ad 应删");
    a.ok(!("sponsor" in out), "sponsor 应删");
    a.ok(!("promoted" in out), "promoted 应删");
    a.ok(!("recommend" in out), "recommend 应删");
  },
  "linkedin: $response 守卫放行 request 阶段": async (a, h) => {
    const sb = h.createSandbox({ request: { url: "https://www.linkedin.com/" } });
    const s = await h.runScript("Scripts/LinkedIn.js", sb);
    a.equal(s.doneCalls.length, 1, "应调用一次 $done");
    a.equal(s.doneCalls[0].body, undefined, "不应改写 body");
  },
  "linkedin: 非法 JSON 原样放行": async (a, h) => {
    const sb = h.createSandbox({ response: { status: 200, body: "" }, request: { url: "https://www.linkedin.com/" } });
    const s = await h.runScript("Scripts/LinkedIn.js", sb);
    a.equal(s.doneCalls[0].body, undefined, "解析失败应无参 done");
  },

  // ── Twitter ──
  "twitter: 删除 ad/sponsor/promot/recommend/trend 前缀字段": async (a, h) => {
    const body = {
      data: {
        ad: {}, sponsor: {}, promoted: {}, recommend: {}, trending: {},
        some_ad: "old-regex-false-positive",
        normal: "keep"
      }
    };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://api.twitter.com/2/tweets" } });
    const s = await h.runScript("Scripts/Twitter.js", sb);
    const out = JSON.parse(s.doneCalls[0].body).data;
    a.ok("some_ad" in out, "some_ad 应保留 (旧正则误删, 新正则修复)");
    a.ok("normal" in out, "normal 保留");
    a.ok(!("ad" in out), "ad 应删");
    a.ok(!("sponsor" in out), "sponsor 应删");
    a.ok(!("promoted" in out), "promoted 应删");
    a.ok(!("recommend" in out), "recommend 应删");
    a.ok(!("trending" in out), "trending 应删");
  },
  "twitter: $response 守卫放行 request 阶段": async (a, h) => {
    const sb = h.createSandbox({ request: { url: "https://api.twitter.com/" } });
    const s = await h.runScript("Scripts/Twitter.js", sb);
    a.equal(s.doneCalls.length, 1, "应调用一次 $done");
  },
  "twitter: 非法 JSON 原样放行": async (a, h) => {
    const sb = h.createSandbox({ response: { status: 200, body: "not-json" }, request: { url: "https://api.twitter.com/" } });
    const s = await h.runScript("Scripts/Twitter.js", sb);
    a.equal(s.doneCalls[0].body, undefined, "解析失败应无参 done");
  },
};
