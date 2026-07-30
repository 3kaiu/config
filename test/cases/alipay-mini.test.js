/**
 * AlipayMini — 支付宝小程序净化脚本回归测试
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });

exports.tests = {
  "alipay-mini: 开屏请求移除 adv_info/advertise/promotion": async (a, h) => {
    const body = { data: { adv_info: "x", advertise: "y", promotion: "z", normal: "keep" } };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://gw.alipay.com/gw/open.ap?splash" } });
    const s = await h.runScript("Scripts/AlipayMini.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.ok(!out.data.adv_info, "adv_info 应删除");
    a.ok(!out.data.advertise, "advertise 应删除");
    a.ok(!out.data.promotion, "promotion 应删除");
    a.equal(out.data.normal, "keep", "正常字段保留");
  },
  "alipay-mini: 信息流请求过滤 ad_data/is_ad/promotion_tag": async (a, h) => {
    const body = { dataList: [
      { id: 1, ad_data: {} },
      { id: 2, is_ad: true },
      { id: 3, promotion_tag: "x" },
      { id: 4, type: "ad" },
      { id: 5, content: { ad_title: "spam" } },
      { id: 6, title: "正常内容" },
    ]};
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://mapi.alipay.com/home" } });
    const s = await h.runScript("Scripts/AlipayMini.js", sb);
    const items = JSON.parse(s.doneCalls[0].body).dataList;
    a.equal(items.length, 1, "应只剩 1 条正常内容");
    a.equal(items[0].title, "正常内容");
  },
  "alipay-mini: $response 守卫放行 request 阶段": async (a, h) => {
    const sb = h.createSandbox({ request: { url: "https://s.alipay.com/search" } });
    const s = await h.runScript("Scripts/AlipayMini.js", sb);
    a.equal(s.doneCalls.length, 1, "应调用一次 $done");
    a.equal(s.doneCalls[0].body, undefined, "不应改写 body");
  },
  "alipay-mini: 无响应体跳过处理": async (a, h) => {
    const sb = h.createSandbox({ response: { status: 200, body: "" }, request: { url: "https://s.alipay.com/search" } });
    const s = await h.runScript("Scripts/AlipayMini.js", sb);
    a.equal(s.doneCalls[0].body, undefined, "空 body 应跳过");
  },
  "alipay-mini: 非法 JSON 走异常分支": async (a, h) => {
    const sb = h.createSandbox({ response: { status: 200, body: "{" }, request: { url: "https://s.alipay.com/search" } });
    const s = await h.runScript("Scripts/AlipayMini.js", sb);
    a.equal(s.doneCalls[0].body, undefined, "解析失败异常分支");
  },
};
