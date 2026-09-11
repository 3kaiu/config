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
  "linkedin: 词段级广告键删除 (address/adaptive/admin 不再误删)": async (a, h) => {
    // 2026-09-11 深度审计 NEW-06 修正本用例的旧期望:
    // 原用例锁的是 `/^(?:ad|sponsor|promot|recommend)/i` 的**未锚定前缀**语义
    // (some_sponsor 存活), 并把"删掉 address/admin"写成"预期行为" —— 但审计判定
    // 那正是缺陷 (address/adaptive/admin 是正常字段, 整键删除 = 数据丢失)。
    // 现改为与 src/lib/ad.ts 的 isAdKey 同一口径 (词段匹配), 删除面按"广告词段"重定义:
    //   命中: 段级 ad/ads 整段, 或 advert|sponsor|promot|recommend|trend 词干
    //   不再命中: address / adaptive / admin / advance / badge
    const body = {
      data: {
        ad: {}, sponsor: {}, promoted: {}, recommend: {},
        sponsoredContent: {}, adData: {},
        address: "keep", adaptive: "keep", admin: "keep", advance: "keep", badge: "keep",
        normal: "keep"
      }
    };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://www.linkedin.com/feed" } });
    const s = await h.runScript("Scripts/LinkedIn.js", sb);
    const out = JSON.parse(s.doneCalls[0].body).data;
    for (const k of ["ad", "sponsor", "promoted", "recommend", "sponsoredContent", "adData"]) {
      a.ok(!(k in out), `${k} 应删 (广告词段)`);
    }
    for (const k of ["address", "adaptive", "admin", "advance", "badge", "normal"]) {
      a.ok(k in out, `${k} 应保留 (原未锚定前缀正则的误伤)`);
    }
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
  "twitter: 词段级广告键删除 (含 trend 词干, 不误删 address/admin)": async (a, h) => {
    // 同 LinkedIn: 原用例锁的是未锚定前缀语义, 现统一到词段匹配 (见 src/lib/ad.ts isSocialAdKey)。
    // 注意 trending 仍应删 (trend 是词干, 允许派生形), 而 address/adaptive/admin 不再删。
    const body = {
      data: {
        ad: {}, sponsor: {}, promoted: {}, recommend: {}, trending: {},
        address: "keep", adaptive: "keep", admin: "keep", badge: "keep",
        normal: "keep"
      }
    };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://api.twitter.com/2/tweets" } });
    const s = await h.runScript("Scripts/Twitter.js", sb);
    const out = JSON.parse(s.doneCalls[0].body).data;
    for (const k of ["ad", "sponsor", "promoted", "recommend", "trending"]) {
      a.ok(!(k in out), `${k} 应删 (广告词段)`);
    }
    for (const k of ["address", "adaptive", "admin", "badge", "normal"]) {
      a.ok(k in out, `${k} 应保留 (原未锚定前缀正则的误伤)`);
    }
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
