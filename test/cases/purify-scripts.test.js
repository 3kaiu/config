/**
 * Tieba / Reddit — 响应净化类脚本回归测试
 * （Amap / JD 已改为 response-body-json-jq 兜底，脚本方案移除）
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });

exports.tests = {
  // ── Tieba ──
  "tieba: 递归删除广告字段与 ad_ 前缀字段": async (a, h) => {
    const body = {
      error: { errno: 0 },
      data: {
        ad: "x", banner_list: ["y"], recommend: { nested: 1 }, ad_callback: "z", ads_extra: "w",
        thread_list: [{ title: "正常帖", ad_info: "del", sub: { ad_meta: 1, keep: 2 } }, { title: "帖2" }],
      },
    };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://tiebac.baidu.com/c/s/sync" } });
    const s = await h.runScript("Scripts/Tieba.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.ok(!("ad" in out.data), "ad 应删除");
    a.ok(!("banner_list" in out.data), "banner_list 应删除");
    a.ok(!("recommend" in out.data), "recommend 应删除");
    a.ok(!("ad_callback" in out.data), "ad_callback 应删除");
    a.ok(!("ads_extra" in out.data), "ads_ 前缀应删除");
    a.ok(!("ad_info" in out.data.thread_list[0]), "嵌套 ad_info 应删除");
    a.ok(!("ad_meta" in out.data.thread_list[0].sub), "深层 ad_meta 应删除");
    a.equal(out.data.thread_list[0].title, "正常帖", "正常内容保留");
    a.equal(out.data.thread_list[0].sub.keep, 2, "正常字段保留");
  },
  "tieba: Proto (非 JSON) 原样放行": async (a, h) => {
    const sb = h.createSandbox({ response: { status: 200, body: "\x08\x01\x12\x02proto" }, request: { url: "https://tieba.baidu.com/c/s?cmd=1" } });
    const s = await h.runScript("Scripts/Tieba.js", sb);
    a.equal(s.doneCalls[0].body, undefined, "proto 应无参放行");
  },
  // 2026-09-22 app2smile 交叉移植 (P0/P1 机制开关类)
  "tieba: 开屏 error_code 置非零 + data 置空": async (a, h) => {
    const sb = h.createSandbox({
      response: RESP({ error_code: 0, data: { ad: 1 } }),
      request: { url: "https://tieba.baidu.com/c/f/ad/getSplashAd" },
    });
    const s = await h.runScript("Scripts/Tieba.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.error_code, 2230209, "error_code 应置非零");
    a.equal(out.data, null, "data 应置空");
  },
  "tieba: c/s/sync 开关类覆写 (SDK 初始化/开屏/AB 实验)": async (a, h) => {
    const sb = h.createSandbox({
      response: RESP({
        floating_icon: { homepage: { icon_url: "x" } },
        advertisement_config: { advertisement_str: "ad" },
        config: { switch: [{ name: "platform_csj_init", type: "1" }, { name: "unrelated", type: "1" }] },
        screen_fill_data_result: { screen_fill_advertisement_bear_switch: "1", other: "k" },
        cloud_control_data_info: { common_config: { external_abtest_switch: "on", keep: 1 } },
        keep: 2,
      }),
      request: { url: "https://tiebac.baidu.com/c/s/sync" },
    });
    const s = await h.runScript("Scripts/Tieba.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.floating_icon, null, "悬浮 icon 应清空");
    a.equal(out.advertisement_config, null, "回帖栏广告配置应清空");
    a.equal(out.config.switch[0].type, "0", "SDK 初始化应关闭");
    a.equal(out.config.switch[1].type, "1", "无关开关保留");
    a.equal(out.screen_fill_data_result.screen_fill_advertisement_bear_switch, "0", "开屏小熊应关闭");
    a.equal(out.cloud_control_data_info.common_config.external_abtest_switch, null, "AB 实验总闸应关闭");
    a.equal(out.keep, 2, "正常字段保留");
  },

  // ── TencentNews (2026-09-22 app2smile 交叉移植) ──
  "tencentnews: event_detail 过滤 ad_list widget": async (a, h) => {
    const sb = h.createSandbox({
      response: RESP({ data: { widget_list: [{ widget_type: "ad_list", x: 1 }, { widget_type: "news", y: 2 }] } }),
      request: { url: "https://r.inews.qq.com/gw/page/event_detail" },
    });
    const s = await h.runScript("Scripts/TencentNews.js", sb);
    const wl = JSON.parse(s.doneCalls[0].body).data.widget_list;
    a.equal(wl.length, 1, "应只剩非广告 widget");
    a.equal(wl[0].widget_type, "news", "正常内容保留");
  },
  "tencentnews: 开屏/精选 adList 置空, 无则不动": async (a, h) => {
    const sb = h.createSandbox({
      response: RESP({ adList: [{ id: 1 }], keep: 1 }),
      request: { url: "https://news.ssp.qq.com/app" },
    });
    const s = await h.runScript("Scripts/TencentNews.js", sb);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.adList, null, "adList 应置空");
    a.equal(out.keep, 1, "正常字段保留");
    const sb2 = h.createSandbox({
      response: RESP({ adList: [{ id: 1 }] }),
      request: { url: "https://r.inews.qq.com/getTagFeedList" },
    });
    const s2 = await h.runScript("Scripts/TencentNews.js", sb2);
    a.equal(JSON.parse(s2.doneCalls[0].body).adList, null, "getTagFeedList 同理");
    const sb3 = h.createSandbox({
      response: RESP({ data: { x: 1 } }),
      request: { url: "https://r.inews.qq.com/gw/page/event_detail" },
    });
    const s3 = await h.runScript("Scripts/TencentNews.js", sb3);
    a.equal(JSON.parse(s3.doneCalls[0].body).data.x, 1, "无广告字段原样保留");
  },

  // ── Reddit ──
  "reddit: 移除 AdPost 节点, 保留普通帖": async (a, h) => {
    const body = {
      data: { children: { edges: [
        { node: { __typename: "Post", title: "normal" } },
        { node: { __typename: "AdPost", title: "ad" } },
        { node: { __typename: "Post", title: "normal2" } },
      ] } },
    };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://gql.reddit.com/" } });
    const s = await h.runScript("Scripts/Reddit.js", sb);
    const edges = JSON.parse(s.doneCalls[0].body).data.children.edges;
    a.equal(edges.length, 2, "应只剩 2 个节点");
    a.ok(edges.every((e) => e.node.__typename === "Post"), "应无 AdPost");
  },
  "reddit: 深层嵌套 AdPost 也被移除": async (a, h) => {
    const body = { a: { b: [{ node: { __typename: "AdPost" } }, { node: { __typename: "Post" } }] } };
    const sb = h.createSandbox({ response: RESP(body), request: { url: "https://gql.reddit.com/" } });
    const s = await h.runScript("Scripts/Reddit.js", sb);
    a.equal(JSON.parse(s.doneCalls[0].body).a.b.length, 1, "深层 AdPost 应被移除");
  },
};
