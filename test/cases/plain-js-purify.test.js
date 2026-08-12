/**
 * 纯 JS 净化脚本 (无 src/TS 源码) 回归测试
 * 覆盖 10 个手写净化脚本的核心净化行为 + $response 守卫 + 正常内容保留
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });

exports.tests = {
  // ── Meituan ──
  "meituan: 广告条目删除 + banner/popup 清空 + 正常项保留": async (a, h) => {
    const body = {
      data: {
        feed: [
          { id: 1, is_ad: true },
          { id: 2, promotion: "x" },
          { id: 3, title: "正常" },
        ],
        banner: ["ad1"], ad_list: ["x"], popup: { t: 1 },
      },
    };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://api.meituan.com/feed" } });
    const s = await h.runScript("Scripts/Meituan.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data.feed.length, 1, "广告条目应删除, 剩 1 条正常");
    a.equal(out.data.feed[0].id, 3, "正常项保留");
    a.equal(out.data.banner.length, 0, "banner 应清空");
    a.equal(out.data.ad_list.length, 0, "ad_list 应置空");
  },

  // ── Douyin ──
  "douyin: is_ad 条目过滤 + advertisement 字段删除 + ad_data 清空 + 正常 aweme 保留": async (a, h) => {
    const body = {
      aweme_list: [
        { aweme_type: 0, desc: "正常" },
        { aweme_type: 2, desc: "广告" },
        { is_ad: true, desc: "广告2" },
      ],
      advertisement_data: { x: 1 }, ad_data: { y: 2 },
    };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://api.amemv.com/aweme/v1/feed" } });
    const s = await h.runScript("Scripts/Douyin.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.aweme_list.length, 1, "广告条目应过滤");
    a.equal(out.aweme_list[0].desc, "正常", "正常 aweme 保留");
    a.ok(!("advertisement_data" in out), "advertisement* 字段应删除");
    a.equal(JSON.stringify(out.ad_data), "{}", "ad_data 应清空为 {}");
  },
  "douyin: 非 JSON 响应守卫放行": async (a, h) => {
    const sb = h.createSandbox({ response: { status: 200, body: "not-json" }, request: { url: "https://api.amemv.com/aweme/v1/feed" } });
    const s = await h.runScript("Scripts/Douyin.js", sb);
    a.equal(s.doneCalls.length, 1, "应有 done 调用");
    a.ok(!s.doneCalls[0].body, "非 JSON 无 body 放行");
  },

  // ── Kuaishou ──
  "kuaishou: ad_type 条目删除 + 正常 feed 保留": async (a, h) => {
    const body = { data: { feed: [
      { id: 1, ad_type: 1 },
      { id: 2, photoId: "正常" },
    ] } };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://graphql.kuaishou.com/graphql" } });
    const s = await h.runScript("Scripts/Kuaishou.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data.feed.length, 1, "ad_type 条目应删除");
    a.equal(out.data.feed[0].photoId, "正常", "正常保留");
  },

  // ── Youku ──
  "youku: api 分支清空 ad 数组 + 正常保留": async (a, h) => {
    const body = { data: { adList: [1, 2], video: { title: "正常" } } };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://api.youku.com/playlist" } });
    const s = await h.runScript("Scripts/Youku.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data.adList.length, 0, "adList 应清空");
    a.equal(out.data.video.title, "正常", "正常内容保留");
  },
  "youku: iyes 分支移除 banner/promo": async (a, h) => {
    const body = { banner: [1], promo: [2], vlist: { title: "正常" } };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://iyes.youku.com/api" } });
    const s = await h.runScript("Scripts/Youku.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.ok(!("banner" in out), "banner 应移除");
    a.ok(!("promo" in out), "promo 应移除");
    a.equal(out.vlist.title, "正常", "正常保留");
  },

  // ── Fanqie ──
  "fanqie: ad_data 清空 + 正常章节保留": async (a, h) => {
    const body = { data: { bookshelf: [{ bookId: 1, ad_data: { x: 1 } }, { bookId: 2 }] } };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://api5-normal-snkmer.fqnovel.com/bookshelf" } });
    const s = await h.runScript("Scripts/Fanqie.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data.bookshelf.length, 2, "所有条目保留");
    a.equal(JSON.stringify(out.data.bookshelf[0].ad_data || {}), "{}", "ad_data 应清空");
  },

  // ── Feishu ──
  "feishu: 推广项过滤 + 正常项保留": async (a, h) => {
    const body = { data: { items: [
      { id: 1, is_promoted: true },
      { id: 2, type: "promotion" },
      { id: 3, type: "message", text: "正常" },
    ] } };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://internal-api.feishu.cn/feed" } });
    const s = await h.runScript("Scripts/Feishu.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data.items.length, 1, "推广项应过滤");
    a.equal(out.data.items[0].id, 3, "正常保留");
  },

  // ── Dianping ──
  "dianping: 广告项过滤 + banner 清空": async (a, h) => {
    const body = { data: { list: [{ id: 1, is_ad: true }, { id: 2, title: "正常" }], banner: ["a"] } };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://mapi.dianping.com/feed" } });
    const s = await h.runScript("Scripts/Dianping.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data.list.length, 1, "广告应过滤");
    a.equal(out.data.banner.length, 0, "banner 清空");
  },

  // ── WPS ──
  "wps: adservice 分支清空广告数组 + 正常元数据保留": async (a, h) => {
    const body = { data: { ads: [1, 2], list: ["文本"], banners: [1], doc_count: 3 } };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://adservice.wps.cn/ads" } });
    const s = await h.runScript("Scripts/WPS.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data.ads.length, 0, "ads 应清空");
    a.equal(out.data.list.length, 0, "list 应清空");
    a.equal(out.data.banners.length, 0, "banners 应清空");
    a.equal(out.data.doc_count, 3, "正常元数据保留");
  },

  // ── Kugou ──
  "kugou: gateway 分支移除 banner/promo + 正常保留": async (a, h) => {
    const body = { banner: { t: 1 }, promo: [1], song: "正常" };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://gateway.kugou.com/api" } });
    const s = await h.runScript("Scripts/Kugou.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.ok(!("banner" in out), "banner 应移除");
    a.ok(!("promo" in out), "promo 应移除");
    a.equal(out.song, "正常", "正常保留");
  },
  "kugou: 非 gateway 分支清空 ad 数组": async (a, h) => {
    const body = { ads: [1, 2], song: "正常" };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://ads.kugou.com/api" } });
    const s = await h.runScript("Scripts/Kugou.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.ads.length, 0, "ads 应清空");
    a.equal(out.song, "正常", "正常保留");
  },

  // ── Kuwo ──
  "kuwo: 顶层+data 广告字段清空/移除": async (a, h) => {
    const body = { list: [1], adlist: [2], banner: [3], data: { adlist: [4], song: "正常" } };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://rich.kuwo.cn/api" } });
    const s = await h.runScript("Scripts/Kuwo.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.list.length, 0, "顶层 list 应清空");
    a.equal(out.adlist.length, 0, "顶层 adlist 应清空");
    a.ok(!("banner" in out), "顶层 banner 应移除");
    a.ok(!("adlist" in out.data), "data.adlist 应移除");
  },
};
