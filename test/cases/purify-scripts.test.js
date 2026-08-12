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
