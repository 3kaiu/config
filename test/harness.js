/**
 * 代理脚本测试 harness — 用 vm 沙箱模拟 Loon 运行时
 *
 * 用法:
 *   const { createSandbox, runScript } = require("./harness");
 *   const sb = createSandbox({ request: {...}, response: { body: "..." } });
 *   const state = await runScript("Scripts/Zhihu.js", sb);
 *   // state.doneCalls / state.notifications / state.httpCalls / state.store / state.logs
 *   // state.scriptError — 脚本顶层抛出的错误 (null 表示未抛错)
 *
 * 测 http 相关脚本:
 *   createSandbox({ httpHandler: ({ url }) => ({ body: "..." }) })
 *     — 响应经微任务投递, 必定先于脚本自设的超时到达;
 *       返回 { hang: true } 可模拟无响应以测超时分支。
 */
"use strict";

const vm = require("vm");
const fs = require("fs");
const path = require("path");

function createSandbox(opts = {}) {
  const {
    request,
    response,
    argument,
    store: initStore = {},
    httpHandler,
    fastTimers = true,
  } = opts;

  const state = {
    doneCalls: [],
    notifications: [],
    logs: [],
    httpCalls: [],
    store: { ...initStore },
    // 脚本顶层抛出且未被捕获时的错误 (2026-09-11 审计新增)。
    // 此前 runScript 用 .catch(() => {}) 静默吞掉, 导致"脚本抛错 → $done 永不调用
    // → Loon 请求挂死"这类缺陷在 108 个绿灯用例下完全不可见。
    scriptError: null,
  };
  const timers = fastTimers
    ? { setTimeout: (fn) => { setImmediate(fn); return 0; }, clearTimeout: () => {} }
    : { setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a) };

  const ctx = {
    console: { log: (...a) => state.logs.push(a.join(" ")), error: (...a) => state.logs.push("[ERROR] " + a.join(" ")) },
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

  ctx.$loon = { version: "3.3.9" };
  ctx.$environment = { surgeVersion: "Loon 3.3.9" };
  ctx.$notification = { post: (t, s, b) => state.notifications.push({ title: t, subtitle: s, body: b }) };
  ctx.$persistentStore = {
    read: (k) => (k in state.store ? state.store[k] : null),
    write: (v, k) => { state.store[k] = String(v); return true; },
  };
  // 响应投递走微任务: 微任务队列先于宏任务排空, 而 fastTimers 把 setTimeout
  // 映射为 setImmediate (宏任务) — 因此"已配置响应"时响应必定先于脚本自设的
  // 超时到达。修正此前的保真缺陷: 原实现用 setImmediate 投递, 与 fake 超时同队列,
  // 而脚本普遍先 setTimeout 再发请求 → 超时永远先触发, mock 响应永不投递
  // (2026-09-11 审计实证: Bilibili httpGet 恒得 "请求失败: timeout")。
  // 要测超时分支, 让 httpHandler 返回 { hang: true } 即不投递。
  const makeHttp = (method) => (o, cb) => {
    state.httpCalls.push({ method, url: o.url, body: o.body, headers: o.headers });
    let out = { err: null, res: { status: 200 }, body: "{}" };
    if (httpHandler) out = Object.assign(out, httpHandler({ method, ...o }));
    if (out && out.hang) return;
    Promise.resolve().then(() => cb(out.err, out.res, out.body));
  };
  ctx.$httpClient = { get: makeHttp("GET"), post: makeHttp("POST"), put: makeHttp("PUT"), head: makeHttp("HEAD"), delete: makeHttp("DELETE") };

  ctx.globalThis = ctx;
  return { context: vm.createContext(ctx), state, ctx, fastTimers };
}

/**
 * 在沙箱中执行脚本, 返回 state。
 * 两种调用方式:
 *   runScript(path, sandbox)        — 从文件读取脚本
 *   runScript(sandbox, src, opts)   — 直接传入脚本源码 (opts 可选, 兼容旧用例)
 * 脚本顶层允许 return (守卫语句), 故包一层 async function。
 *
 * 脚本顶层抛错不再被吞掉: 记入 state.scriptError (配合 assert.doneCalled 断言)。
 */
async function runScript(scriptPathOrSandbox, sandboxOrSrc, opts) {
  let sandbox, src, filename;
  if (typeof scriptPathOrSandbox === "string") {
    const abs = path.isAbsolute(scriptPathOrSandbox) ? scriptPathOrSandbox : path.join(__dirname, "..", scriptPathOrSandbox);
    src = fs.readFileSync(abs, "utf8");
    sandbox = sandboxOrSrc;
    filename = path.basename(abs);
  } else {
    sandbox = scriptPathOrSandbox;
    src = sandboxOrSrc;
    filename = "inline.js";
  }
  const wrapped = `(async function __proxyScript__() {\n${src}\n})()`;
  const p = vm.runInContext(wrapped, sandbox.context, { filename });
  try {
    await Promise.resolve(p);
  } catch (e) {
    sandbox.state.scriptError = e;
  }
  // 排空回调队列: fastTimers 下 setTimeout 是宏任务(setImmediate), 链式回调需多轮
  // flush。改轮询后既比固定 sleep 更快, 也去掉了"30ms 内必须跑完"的时序脆弱性。
  for (let i = 0; i < 64; i++) await new Promise((r) => setImmediate(r));
  // 非 fastTimers 模式用的是真实定时器, 仍需少量真实时间让短延时回调跑完
  if (sandbox.fastTimers === false) await new Promise((r) => setTimeout(r, 30));
  return sandbox.state;
}

module.exports = { createSandbox, runScript };
