/**
 * Fanqie (番茄小说) - 响应净化类脚本回归测试
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });

exports.tests = {
  "fanqie: 过滤书架列表 is_ad 广告条目": async (a, h) => {
    const body = {
      data: [
        { book_id: "1", title: "正常小说" },
        { book_id: "2", title: "广告", is_ad: true },
        { book_id: "3", title: "正常小说2" },
      ],
    };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://api5-normal-snkmer.fqnovel.com/reading/bookapi/bookshelf/list" } });
    const s = await h.runScript("Scripts/Fanqie.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data.length, 2, "应过滤掉 1 条广告");
    a.ok(out.data.every((b) => b.title !== "广告"), "广告条目应被移除");
  },
  "fanqie: 过滤 ad_type 广告条目": async (a, h) => {
    const body = {
      list: [
        { id: 1, ad_type: 0, name: "正常" },
        { id: 2, ad_type: 5, name: "广告" },
        { id: 3, ad_type: 0, name: "正常2" },
      ],
    };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://api5-normal-snkmer.fqnovel.com/reading/bookapi/feed" } });
    const s = await h.runScript("Scripts/Fanqie.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.list.length, 2, "应过滤掉 1 条广告");
  },
  "fanqie: 清空 ad_data 对象": async (a, h) => {
    const body = { ad_data: { banner: "ad1", splash: "ad2" }, data: [{ id: 1 }] };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://ada.fqnovel.com/ad/service" } });
    const s = await h.runScript("Scripts/Fanqie.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.ad_data, {}, "ad_data 应被清空");
    a.equal(out.data.length, 1, "data 应保留");
  },
  "fanqie: $response 守卫 (request 阶段直接放行)": async (a, h) => {
    const sb = h.createSandbox({ request: { url: "https://api5-normal-snkmer.fqnovel.com/feed" } });
    const s = await h.runScript("Scripts/Fanqie.js", sb);
    a.equal(s.doneCalls.length, 1, "应调用一次 $done");
    a.equal(s.doneCalls[0].body, undefined, "不应改写 body");
  },
  "fanqie: log.snssdk.com 追踪拦截": async (a, h) => {
    const sb = h.createSandbox({ response: RESP({ events: [1, 2] }), request: { url: "https://log.snssdk.com/service/log" } });
    const s = await h.runScript("Scripts/Fanqie.js", sb);
    a.equal(s.doneCalls[0].body, undefined, "追踪接口应返回空体");
  },
  "fanqie: 非 JSON body 原样放行": async (a, h) => {
    const sb = h.createSandbox({ response: { status: 200, body: "not-json{" }, request: { url: "https://ada.fqnovel.com/ad" } });
    const s = await h.runScript("Scripts/Fanqie.js", sb);
    a.equal(s.doneCalls[0].body, undefined, "解析失败应无参 done");
  },
};
