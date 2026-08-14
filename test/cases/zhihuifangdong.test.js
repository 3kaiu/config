/**
 * Zhihuifangdong — argument 分流 + URL 回退回归测试
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });

exports.tests = {
  "loon: $argument=appOpenAds → data 清空为数组": async (a, h) => {
    const sb = h.createSandbox({
      argument: "appOpenAds",
      request: { url: "https://api.zhihuifangdong.net/core/app/activity/appOpenAds" },
      response: RESP({ code: 0, data: [{ ad: 1 }] }),
    });
    const s = await h.runScript("Scripts/Zhihuifangdong.js", sb);
    a.equal(JSON.parse(s.doneCalls[0].body).data, [], "开屏 data 应为空数组");
    a.includes(s.logs.join("\n"), "开屏广告", "日志应说明开屏");
  },
  "loon: $argument=bannerPicMore → data 清空为对象": async (a, h) => {
    const sb = h.createSandbox({
      argument: "bannerPicMore",
      request: { url: "https://api.zhihuifangdong.net/core/app/activity/bannerPicMore" },
      response: RESP({ code: 0, data: { banner: "x" } }),
    });
    const s = await h.runScript("Scripts/Zhihuifangdong.js", sb);
    a.equal(JSON.parse(s.doneCalls[0].body).data, {}, "banner data 应为空对象");
  },
  "loon: 无 $argument 时按 URL 回退分流": async (a, h) => {
    const sb = h.createSandbox({
      request: { url: "https://api.zhihuifangdong.net/core/app/activity/bannerPicMore?v=2" },
      response: RESP({ code: 0, data: { banner: "x" } }),
    });
    const s = await h.runScript("Scripts/Zhihuifangdong.js", sb);
    a.equal(JSON.parse(s.doneCalls[0].body).data, {}, "URL 回退应命中 banner 分支");
  },
  "loon: $argument=showAds → data 置 null (广告白名单)": async (a, h) => {
    const sb = h.createSandbox({
      argument: "showAds",
      request: { url: "https://api.zhihuifangdong.net/core/adWhitelist/showAds" },
      response: RESP({ code: 0, data: true }),
    });
    const s = await h.runScript("Scripts/Zhihuifangdong.js", sb);
    a.equal(JSON.parse(s.doneCalls[0].body).data, null, "广告白名单 data 应为 null");
  },
  "loon: $argument=activityAds + URL clickPicMore → data 清空为对象": async (a, h) => {
    const sb = h.createSandbox({
      argument: "activityAds",
      request: { url: "https://api.zhihuifangdong.net/core/app/activity/clickPicMore" },
      response: RESP({ code: 0, data: { pic: "ad" } }),
    });
    const s = await h.runScript("Scripts/Zhihuifangdong.js", sb);
    a.equal(JSON.parse(s.doneCalls[0].body).data, {}, "clickPicMore data 应为空对象");
  },
  "loon: $argument=activityAds + URL platformPic → data 清空为对象": async (a, h) => {
    const sb = h.createSandbox({
      argument: "activityAds",
      request: { url: "https://api.zhihuifangdong.net/core/app/activity/platformPic" },
      response: RESP({ code: 0, data: { pic: "ad" } }),
    });
    const s = await h.runScript("Scripts/Zhihuifangdong.js", sb);
    a.equal(JSON.parse(s.doneCalls[0].body).data, {}, "platformPic data 应为空对象");
  },
  "loon: $argument=activityAds + URL clickPic → data 清空为对象": async (a, h) => {
    const sb = h.createSandbox({
      argument: "activityAds",
      request: { url: "https://api.zhihuifangdong.net/core/app/activity/clickPic" },
      response: RESP({ code: 0, data: { pic: "ad" } }),
    });
    const s = await h.runScript("Scripts/Zhihuifangdong.js", sb);
    a.equal(JSON.parse(s.doneCalls[0].body).data, {}, "clickPic data 应为空对象");
  },
  "守卫: 无 $response 直接放行": async (a, h) => {
    const sb = h.createSandbox({ argument: "appOpenAds", request: { url: "https://api.zhihuifangdong.net/core/app/activity/appOpenAds" } });
    const s = await h.runScript("Scripts/Zhihuifangdong.js", sb);
    a.equal(s.doneCalls.length, 1);
    a.equal(s.doneCalls[0].body, undefined);
  },
  "非法 JSON 走异常分支且 done 无 body": async (a, h) => {
    const sb = h.createSandbox({
      argument: "appOpenAds",
      request: { url: "https://api.zhihuifangdong.net/core/app/activity/appOpenAds" },
      response: { status: 200, body: "<html>" },
    });
    const s = await h.runScript("Scripts/Zhihuifangdong.js", sb);
    a.equal(s.doneCalls[0].body, undefined);
    a.includes(s.logs.join("\n"), "异常", "应记录异常日志");
  },
};
