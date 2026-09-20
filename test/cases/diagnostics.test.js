/**
 * Scripts/Diagnostics.js 行为回归 (2026-09-19 官方文档对齐 P2-1)
 *
 * generic 脚本的官方契约 (nsloon.app/docs/Script/ → generic, 官方 generic_example.js):
 *   - 上下文经 $environment.params 传入 (node / nodeInfo)
 *   - 请求可钉在指定节点上 ($httpClient.get({url, node}, cb))
 *   - 结果经 $done({title, htmlMessage}) 富文本回显
 * 覆盖: 双链路判定四分支 / 节点钉住 / 回调缺失兜底 / $done 恰好一次。
 */
"use strict";

const CLOUDFLARE = "cp.cloudflare.com";
const BAIDU = "baidu.com";

exports.tests = {
  "diagnostics: 双链路正常 — 判定 + 两项耗时 + $done 一次": async (a, h) => {
    const sb = h.createSandbox({ httpHandler: () => ({ res: { status: 204 }, body: "" }) });
    const s = await h.runScript("Scripts/Diagnostics.js", sb);
    a.doneCalledTimes(s, 1);
    const done = s.doneCalls[0];
    a.includes(JSON.stringify(done), "双链路正常", "双通应判为正常");
    a.includes(done.htmlMessage, "代理链路", "应含代理链路行");
    a.includes(done.htmlMessage, "直连链路", "应含直连链路行");
    a.includes(done.htmlMessage, "ms", "应含耗时");
    a.equal(s.httpCalls.length, 2, "应发两次探活请求");
    a.ok(s.httpCalls.some((c) => c.url.includes(CLOUDFLARE)), "代理探活打 cloudflare");
    a.ok(s.httpCalls.some((c) => c.url.includes(BAIDU)), "直连探活打 baidu (China→DIRECT)");
  },
  "diagnostics: 节点上下文 — 上下文经 $environment.params 注入并钉住探活": async (a, h) => {
    const sb = h.createSandbox({ httpHandler: () => ({ res: { status: 204 }, body: "" }) });
    sb.ctx.$environment = {
      surgeVersion: "Loon 3.5.1",
      buildVersion: "978",
      params: { node: "HK-01", nodeInfo: { type: "Vmess", address: "a.example.com", port: 443 } },
    };
    const s = await h.runScript("Scripts/Diagnostics.js", sb);
    a.doneCalledTimes(s, 1);
    const proxyCall = s.httpCalls.find((c) => c.url.includes(CLOUDFLARE));
    a.equal(proxyCall.node, "HK-01", "代理探活应钉在上下文节点上");
    const directCall = s.httpCalls.find((c) => c.url.includes(BAIDU));
    a.equal(directCall.node, undefined, "直连探活不应钉节点");
    a.includes(s.doneCalls[0].htmlMessage, "HK-01", "结果应包含节点名");
    a.includes(s.doneCalls[0].htmlMessage, "Vmess", "结果应包含节点信息");
  },
  "diagnostics: 代理侧失败 — 判定为代理链路故障且 $done 仍一次": async (a, h) => {
    const sb = h.createSandbox({
      httpHandler: ({ url }) =>
        url.includes(CLOUDFLARE) ? { err: new Error("connection reset") } : { res: { status: 200 }, body: "ok" },
    });
    const s = await h.runScript("Scripts/Diagnostics.js", sb);
    a.doneCalledTimes(s, 1);
    a.includes(s.doneCalls[0].htmlMessage, "代理链路故障", "应判为代理故障");
    a.includes(s.doneCalls[0].htmlMessage, "connection reset", "应回显错误摘要");
  },
  "diagnostics: 回调丢失 — 兜底超时收尾, $done 恰好一次 (报告不挂死 UI)": async (a, h) => {
    const sb = h.createSandbox({ httpHandler: () => ({ hang: true }) });
    const s = await h.runScript("Scripts/Diagnostics.js", sb);
    a.doneCalledTimes(s, 1);
    a.includes(s.doneCalls[0].htmlMessage, "timeout", "超时兜底应生效");
  },
};
