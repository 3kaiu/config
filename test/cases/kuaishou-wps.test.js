/**
 * Kuaishou / WPS 行为回归 (2026-09-11 分模块审计 MOD-11)
 *
 * 这两个脚本的测试引用数仅 2 处 (全仓库最低), 与 Zhihu 的 22 处差 11×。
 * 结合 DEP-03 无 tsc 类型检查, 属双兜底缺失。补边界用例覆盖常见误杀/漏杀场景。
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });

exports.tests = {
  // ── Kuaishou ──
  "kuaishou: 信息流广告条目被移除, 正常条目保留": async (a, h) => {
    const s = await h.runScript("Scripts/Kuaishou.js", h.createSandbox({
      request: { url: "https://graphql.kuaishou.com/feed", method: "POST" },
      response: RESP({
        data: {
          feed: [
            { id: 1, title: "正常视频" },
            { id: 2, is_ad: true, title: "广告" },
            { id: 3, ad_type: 1, title: "广告2" },
            { id: 4, adType: "1", title: "广告3" },
            { id: 5, title: "也是正常" },
          ],
        },
      }),
    }));
    a.noScriptError(s);
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    const ids = out.data.feed.map((i) => i.id);
    a.equal(ids.join(","), "1,5", "ad_type/is_ad 条目应被移除, 正常条目保留");
  },
  "kuaishou: ad_info 对象被清空": async (a, h) => {
    const s = await h.runScript("Scripts/Kuaishou.js", h.createSandbox({
      request: { url: "https://api2.kuaishou.com/ad", method: "POST" },
      response: RESP({ data: { ad_info: { url: "https://ad.com", id: 123 }, title: "内容" } }),
    }));
    a.noScriptError(s);
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(Object.keys(out.data.ad_info).length, 0, "ad_info 应被清空为空对象");
    a.equal(out.data.title, "内容", "ad_info 旁的正常字段应保留");
  },
  "kuaishou: 非广告 ad_type=0 不应误杀": async (a, h) => {
    const s = await h.runScript("Scripts/Kuaishou.js", h.createSandbox({
      request: { url: "https://graphql.kuaishou.com/feed", method: "POST" },
      response: RESP({
        data: { feed: [{ id: 1, ad_type: 0, title: "正常" }, { id: 2, ad_type: "0", title: "也是正常" }] },
      }),
    }));
    a.noScriptError(s);
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data.feed.length, 2, "ad_type=0 / ad_type='0' 不应被移除");
  },
  "kuaishou: 无 body 时安全放行": async (a, h) => {
    const s = await h.runScript("Scripts/Kuaishou.js", h.createSandbox({
      request: { url: "https://graphql.kuaishou.com/feed", method: "POST" },
      response: { status: 204 },
    }));
    a.noScriptError(s);
    a.doneCalled(s);
  },

  // ── WPS ──
  "wps: adservice 广告数组被清空": async (a, h) => {
    const s = await h.runScript("Scripts/WPS.js", h.createSandbox({
      request: { url: "https://adservice.wps.cn/v1/ads", method: "GET" },
      response: RESP({
        data: { ads: [{ id: 1 }], ad_list: [{ id: 2 }], list: [{ id: 3 }], banners: [{ id: 4 }], title: "保留" },
      }),
    }));
    a.noScriptError(s);
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    for (const k of ["ads", "ad_list", "list", "banners"]) {
      a.equal(out.data[k].length, 0, `${k} 应被清空为空数组`);
    }
    a.equal(out.data.title, "保留", "广告数组旁的正常字段应保留");
  },
  "wps: docer 推荐/Banner 对象被删除": async (a, h) => {
    const s = await h.runScript("Scripts/WPS.js", h.createSandbox({
      request: { url: "https://docer.wps.cn/api/recommend", method: "GET" },
      response: RESP({
        data: { banner: { img: "x" }, promo: { url: "y" }, recommend: [{ id: 1 }], promotion: "z", title: "保留" },
      }),
    }));
    a.noScriptError(s);
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    for (const k of ["banner", "promo", "recommend", "promotion"]) {
      a.ok(!(k in out.data), `${k} 应被删除`);
    }
    a.equal(out.data.title, "保留", "推广字段旁的正常字段应保留");
  },
  "wps: 未知 URL 原样放行": async (a, h) => {
    const body = { data: { ads: [1], banner: { x: 1 }, title: "保留" } };
    const s = await h.runScript("Scripts/WPS.js", h.createSandbox({
      request: { url: "https://other.wps.cn/api", method: "GET" },
      response: RESP(body),
    }));
    a.noScriptError(s);
    a.doneCalled(s);
    a.equal(s.doneCalls[0].body, JSON.stringify(body), "未知 URL 应原样放行");
  },
};
