/**
 * Zhihu / Cainiao — 分支分发类脚本回归测试
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });

exports.tests = {
  // ── Zhihu ──
  "zhihu: preset_words 分支清空推荐词且提前返回 (data 保留)": async (a, h) => {
    const sb = h.createSandbox({
      request: { url: "https://api.zhihu.com/search/preset_words?x=1" },
      response: RESP({ recommend_queries: ["词1", "词2"], data: { keep: 1 } }),
    });
    const s = await h.runScript("Scripts/Zhihu.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.recommend_queries, {}, "推荐词应清空");
    a.equal(out.data, { keep: 1 }, "preset 分支不应动 data (提前 return)");
  },
  "zhihu: 通用分支清空 data": async (a, h) => {
    const sb = h.createSandbox({
      request: { url: "https://api.zhihu.com/commercial_api/banners" },
      response: RESP({ data: { banners: ["ad"] }, meta: { ok: true } }),
    });
    const s = await h.runScript("Scripts/Zhihu.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data, {}, "data 应清空");
    a.equal(out.meta, { ok: true }, "meta 保留");
  },
  "zhihu: $response 守卫": async (a, h) => {
    const sb = h.createSandbox({ request: { url: "https://api.zhihu.com/x" } });
    const s = await h.runScript("Scripts/Zhihu.js", sb);
    a.equal(s.doneCalls.length, 1);
    a.equal(s.doneCalls[0].body, undefined);
  },

  // ── Cainiao ──
  "cainiao: 首页净化 (page.fetch) 删 searchContents/operationList": async (a, h) => {
    const body = { data: { data: { data: { mainSearch: { bizData: { searchContents: ["ad"], keep: 1 } }, operationList: ["op"], normal: 2 } } } };
    const sb = h.createSandbox({
      request: { url: "https://cn-acs.m.cainiao.com/gw/e2e.engine.page.fetch/1.0/" },
      response: RESP(body),
    });
    const s = await h.runScript("Scripts/Cainiao.js", sb);
    const d = JSON.parse(s.doneCalls[0].body).data.data.data;
    a.ok(!("operationList" in d), "operationList 应删除");
    a.ok(!("searchContents" in d.mainSearch.bizData), "searchContents 应删除");
    a.equal(d.mainSearch.bizData.keep, 1, "正常字段保留");
  },
  "cainiao: .cn 特判走我的页面分支 (优先于通用 page.fetch)": async (a, h) => {
    const body = { data: { data: { banner: "ad", activity: "ad", vip: "ad", orders: [1] } } };
    const sb = h.createSandbox({
      request: { url: "https://e2e-mtop.cainiao.com/e2e.engine.page.fetch.cn/1.0/" },
      response: RESP(body),
    });
    const s = await h.runScript("Scripts/Cainiao.js", sb);
    const d = JSON.parse(s.doneCalls[0].body).data.data;
    a.ok(!("banner" in d) && !("activity" in d) && !("vip" in d), "banner/activity/vip 应删除");
    a.equal(d.orders, [1], "订单保留");
  },
  "cainiao: 开屏广告 materialId 39017 清空 data": async (a, h) => {
    const body = { data: { result: [{ materialId: "39017", content: "splash" }] } };
    const sb = h.createSandbox({
      request: { url: "https://netflow-mtop.cainiao.com/nbnetflow.ads/x" },
      response: RESP(body),
    });
    const s = await h.runScript("Scripts/Cainiao.js", sb);
    a.equal(JSON.parse(s.doneCalls[0].body).data, {}, "开屏 data 应清空");
  },
  "cainiao: 未知路径走尾部兜底 $done()": async (a, h) => {
    const sb = h.createSandbox({ request: { url: "https://cn-acs.m.cainiao.com/other/api" }, response: RESP({ data: 1 }) });
    const s = await h.runScript("Scripts/Cainiao.js", sb);
    a.ok(s.doneCalls.length >= 1, "应有兜底 done");
    a.equal(s.doneCalls[s.doneCalls.length - 1].body, undefined, "兜底无参放行");
  },
};
