/**
 * 代理脚本测试 harness — 用 vm 沙箱模拟 Loon / QX 运行时
 *
 * 用法:
 *   const { createSandbox, runScript } = require("./harness");
 *   const sb = createSandbox({ mode: "loon", request: {...}, response: { body: "..." } });
 *   const state = await runScript("Scripts/Amap.js", sb);
 *   // state.doneCalls / state.notifications / state.httpCalls / state.store / state.logs
 */
"use strict";

const vm = require("vm");
const fs = require("fs");
const path = require("path");

function createSandbox(opts = {}) {
  const {
    mode = "loon",          // "loon" | "qx"
    request,                // $request 对象 (不传 = request 阶段未定义)
    response,               // $response 对象 (不传 = $response undefined, 触发守卫)
    argument,               // $argument (Loon 插件参数)
    httpHandler,            // (req) => ({ err, res, body }) 自定义 $httpClient/$task.fetch 响应
    fastTimers = true,      // setTimeout 立即触发 (加速重放类测试)
  } = opts;

  const state = { doneCalls: [], notifications: [], logs: [], httpCalls: [], store: {} };
  const timers = fastTimers
    ? { setTimeout: (fn) => { setImmediate(fn); return 0; }, clearTimeout: () => {} }
    : { setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a) };

  const ctx = {
    console: { log: (...a) => state.logs.push(a.join(" ")) },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setImmediate: (fn) => setImmediate(fn),
    // JS 内建 (vm 上下文需要显式注入)
    Promise, URL, JSON, Math, Date, parseInt, parseFloat, isNaN,
    encodeURIComponent, decodeURIComponent, escape, unescape,
    String, Number, Boolean, Array, Object, RegExp, Error, TypeError, Symbol, Map, Set,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, DataView, ArrayBuffer,
    atob: (b) => Buffer.from(b, "base64").toString("binary"),
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    $done: (v) => state.doneCalls.push(v === undefined ? {} : v),
  };

  if (request !== undefined) ctx.$request = request;
  if (response !== undefined) ctx.$response = response;
  if (argument !== undefined) ctx.$argument = argument;

  if (mode === "loon") {
    ctx.$loon = { version: "3.3.9" };
    ctx.$environment = { surgeVersion: "Loon 3.3.9" };
    ctx.$notification = { post: (t, s, b) => state.notifications.push({ title: t, subtitle: s, body: b }) };
    ctx.$persistentStore = {
      read: (k) => (k in state.store ? state.store[k] : null),
      write: (v, k) => { state.store[k] = String(v); return true; },
    };
    const makeHttp = (method) => (o, cb) => {
      state.httpCalls.push({ method, url: o.url, body: o.body, headers: o.headers });
      let out = { err: null, res: { statusCode: 200 }, body: "{}" };
      if (httpHandler) out = Object.assign(out, httpHandler({ method, ...o }));
      setImmediate(() => cb(out.err, out.res, out.body));
    };
    ctx.$httpClient = { get: makeHttp("GET"), post: makeHttp("POST"), put: makeHttp("PUT"), head: makeHttp("HEAD"), delete: makeHttp("DELETE") };
  } else {
    ctx.$task = {
      fetch: async (o) => {
        state.httpCalls.push({ method: o.method || "GET", url: o.url, body: o.body, headers: o.headers });
        let out = { res: { statusCode: 200 }, body: "{}" };
        if (httpHandler) out = Object.assign(out, httpHandler(o));
        return { statusCode: out.res.statusCode, body: out.body, headers: {} };
      },
    };
    ctx.$prefs = {
      valueForKey: (k) => (k in state.store ? state.store[k] : null),
      setValueForKey: (v, k) => { state.store[k] = String(v); return true; },
    };
    ctx.$notify = (t, s, b) => state.notifications.push({ title: t, subtitle: s, body: b });
  }

  ctx.globalThis = ctx;
  return { context: vm.createContext(ctx), state, ctx };
}

/**
 * 在沙箱中执行脚本文件, 返回 state。
 * 脚本顶层允许 return (守卫语句), 故包一层 async function。
 */
async function runScript(scriptPath, sandbox) {
  const abs = path.isAbsolute(scriptPath) ? scriptPath : path.join(__dirname, "..", scriptPath);
  const src = fs.readFileSync(abs, "utf8");
  const wrapped = `(async function __proxyScript__() {\n${src}\n})()`;
  const p = vm.runInContext(wrapped, sandbox.context, { filename: path.basename(abs) });
  await Promise.resolve(p).catch(() => {});
  // 冲刷微任务与 setImmediate 回调 (fire-and-forget 的 http 回调等)
  await new Promise((r) => setTimeout(r, 30));
  return sandbox.state;
}

module.exports = { createSandbox, runScript };
