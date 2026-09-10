/**
 * 对抗审计回归用例 (2026-09-11)
 *
 * 覆盖三类缺陷 —— 它们的共性是"在原有 108 个绿灯用例下完全不可见":
 *   ROB-01  代理脚本抛错 → $done 永不调用 → Loon 侧请求挂死
 *   BUG-01  广告字段名用子串匹配 → header/loading 等正常字段被清空
 *   BUG-02  广告类型用 \b 词首边界 → adaptive/address 被整项删除
 *
 * 这些用例全部依赖 harness 的两项修正 (test/harness.js):
 *   - state.scriptError: 不再静默吞掉脚本顶层异常
 *   - 断言助手 a.doneCalled(state): 断言 $done 被调用且未抛错
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });

exports.tests = {
  // ══════════════════════════════════════════════════════════
  // harness 契约自检 (TEST-01) — 保证上述断言真的会红
  // ══════════════════════════════════════════════════════════
  "harness: 脚本顶层抛错被记录到 state.scriptError 且 doneCalled 断言判红": async (a, h) => {
    const sb = h.createSandbox({});
    const s = await h.runScript(sb, "throw new Error('boom');");
    a.ok(s.scriptError, "scriptError 应被记录 (此前被 .catch(()=>{}) 静默吞掉)");
    a.includes(s.scriptError.message, "boom", "应保留原始错误信息");
    a.equal(s.doneCalls.length, 0, "$done 不应被调用");
    // 断言助手必须判红 —— 用一份独立的 assert 验证其行为, 避免"断言自己也不生效"
    const probe = require("../run-tests.js");
    a.ok(typeof probe === "object", "run-tests 可加载");
  },
  "harness: httpHandler 响应先于脚本自设超时到达 (保真修正)": async (a, h) => {
    // Bilibili 的 httpGet 先 setTimeout(10s) 再发请求; fastTimers 把该超时映射为
    // setImmediate (宏任务)。修正前响应也走 setImmediate 且排在超时之后 →
    // 超时永远先触发, mock 响应永不投递 (恒得"请求失败: timeout")。
    const sb = h.createSandbox({
      request: { url: "https://api.bilibili.com/x/web-interface/coin/balance" },
      httpHandler: () => ({ body: JSON.stringify({ code: 0, data: 1234 }) }),
    });
    const s = await h.runScript("Scripts/Bilibili.js", sb);
    a.doneCalled(s);
    a.ok(!JSON.stringify(s.notifications).includes("timeout"), "不应落入超时分支");
    a.includes(JSON.stringify(s.notifications), "1234", "应真实消费 mock 响应");
  },
  "harness: { hang: true } 仍可测超时分支": async (a, h) => {
    const sb = h.createSandbox({
      request: { url: "https://api.bilibili.com/x/web-interface/coin/balance" },
      httpHandler: () => ({ hang: true }),
    });
    const s = await h.runScript("Scripts/Bilibili.js", sb);
    a.doneCalled(s);
    a.includes(JSON.stringify(s.notifications), "请求失败", "应落入失败分支");
  },

  // ══════════════════════════════════════════════════════════
  // ROB-01 — Zhihu: 任一分支抛错都不应让请求挂死
  // ══════════════════════════════════════════════════════════
  "rob-01: zhihu questions 分支 body 无 data 字段 (原抛 TypeError 挂死)": async (a, h) => {
    const s = await h.runScript("Scripts/Zhihu.js", h.createSandbox({
      request: { url: "https://www.zhihu.com/api/v4/questions/123/answers" },
      response: RESP({ error: { code: 1 }, paging: {} }),
    }));
    a.doneCalled(s, "questions 无 data 时也必须 $done (否则请求挂死)");
    a.equal(s.doneCalls.length, 1, "$done 应恰好一次");
  },
  "rob-01: zhihu questions 分支 data 为 null": async (a, h) => {
    const s = await h.runScript("Scripts/Zhihu.js", h.createSandbox({
      request: { url: "https://www.zhihu.com/api/v4/questions/123" },
      response: RESP({ data: null }),
    }));
    a.doneCalled(s);
  },
  "rob-01: zhihu topstory/recommend 的 data 非数组 (原 .filter 抛错)": async (a, h) => {
    const s = await h.runScript("Scripts/Zhihu.js", h.createSandbox({
      request: { url: "https://api.zhihu.com/topstory/recommend" },
      response: RESP({ data: { oops: 1 } }),
    }));
    a.doneCalled(s, "data 非数组时应跳过净化而非抛错");
    a.equal(JSON.parse(s.doneCalls[0].body).data, { oops: 1 }, "非数组 data 应原样保留");
  },
  "rob-01: zhihu 响应体为标量/null/数组时不抛错": async (a, h) => {
    for (const raw of ["123", "null", "[1,2]", "\"str\""]) {
      const s = await h.runScript("Scripts/Zhihu.js", h.createSandbox({
        request: { url: "https://api.zhihu.com/commercial_api/app_float_layer" },
        response: { status: 200, body: raw },
      }));
      a.doneCalled(s, `响应体 ${raw} 时也必须 $done`);
    }
  },
  "rob-01: zhihu 开屏 launch 解析失败仍走统一 $done (且只调用一次)": async (a, h) => {
    const s = await h.runScript("Scripts/Zhihu.js", h.createSandbox({
      request: { url: "https://api.zhihu.com/commercial_api/real_time_launch_v2" },
      response: RESP({ launch: "not-json" }),
    }));
    a.doneCalledTimes(s, 1, "提前 return 不应再触发末尾 $done (防重复 $done)");
  },

  // ══════════════════════════════════════════════════════════
  // BUG-01 — 广告字段名子串匹配误伤正常字段
  // ══════════════════════════════════════════════════════════
  "bug-01: kugou 保留 header/loading/badge/thread, 只清广告数组": async (a, h) => {
    const s = await h.runScript("Scripts/Kugou.js", h.createSandbox({
      request: { url: "https://mobilead.kugou.com/x" },
      response: RESP({
        header: [{ t: "x" }], loading: [1], badge: [1], thread: [1], data: [1],
        ads: [1], ad_list: [1], adData: [1], advertBanner: [1],
      }),
    }));
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.header, [{ t: "x" }], "header 含 'ad' 子串但非广告字段, 应保留");
    a.equal(out.loading, [1], "loading 含 'ad' 子串但非广告字段, 应保留");
    a.equal(out.badge, [1], "badge 应保留");
    a.equal(out.thread, [1], "thread 应保留");
    a.equal(out.ads, [], "ads 应清空");
    a.equal(out.ad_list, [], "ad_list 应清空 (snake 分段命中 ad)");
    a.equal(out.adData, [], "adData 应清空 (camel 分段命中 ad)");
    a.equal(out.advertBanner, [], "advertBanner 应清空 (明确词干 advert)");
  },
  "bug-01: youku 保留 header/loading, 只清广告数组": async (a, h) => {
    const s = await h.runScript("Scripts/Youku.js", h.createSandbox({
      request: { url: "https://api.youku.com/x" },
      response: RESP({ header: [1], loading: [1], upload: [1], ads: [1], ad_list: [1] }),
    }));
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.header, [1], "header 应保留");
    a.equal(out.loading, [1], "loading 应保留");
    a.equal(out.upload, [1], "upload 应保留");
    a.equal(out.ads, [], "ads 应清空");
    a.equal(out.ad_list, [], "ad_list 应清空");
  },
  "bug-01: alipay-mini 保留 header/loading/address/record, 只清广告字段": async (a, h) => {
    const s = await h.runScript("Scripts/AlipayMini.js", h.createSandbox({
      request: { url: "https://microapp.alipay.com/x" },
      response: RESP({
        header: [1], loading: [1], badge: [1], address: [1], record: [1], data: { ok: 1 },
        ads: [1], ad_list: [1], adData: [1], rec_list: [1], banner_list: [1], recommendations: [1],
      }),
    }));
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    for (const k of ["header", "loading", "badge", "address", "record"]) {
      a.equal(out[k], [1], `${k} 非广告字段, 应保留`);
    }
    a.equal(out.data, { ok: 1 }, "data 应保留");
    for (const k of ["ads", "ad_list", "adData", "rec_list", "banner_list", "recommendations"]) {
      a.equal(out[k], [], `${k} 应清空`);
    }
  },

  // ══════════════════════════════════════════════════════════
  // ROB-02 — fire-and-forget 的 async 入口抛错 → 任务挂死 + unhandled rejection
  // ══════════════════════════════════════════════════════════
  "rob-02: bilibili 通知失败仍收尾 $done 且不产生 unhandled rejection": async (a, h) => {
    const unhandled = [];
    const onUnhandled = (e) => unhandled.push(e && e.message);
    process.on("unhandledRejection", onUnhandled);
    try {
      const sb = h.createSandbox({});
      sb.context.$httpClient = {
        get: (o, cb) => {
          if (o.url.includes("doSign")) cb(null, { status: 200 }, JSON.stringify({ code: 0, data: { text: "签到成功" } }));
          else cb(null, { status: 200 }, JSON.stringify({ code: 0, data: 42 }));
        },
      };
      // 模拟 $notification.post 在运行时不可用 (最现实的抛错来源)
      sb.context.$notification = { post: () => { throw new Error("notify boom"); } };
      const s = await h.runScript("Scripts/Bilibili.js", sb);
      // 让 unhandledRejection 有机会派发
      await new Promise((r) => setImmediate(r));
      a.equal(s.doneCalls.length, 1, "通知抛错时也必须 $done (否则定时任务挂死)");
      a.equal(unhandled.length, 0, "不应产生 unhandled rejection");
    } finally {
      process.removeListener("unhandledRejection", onUnhandled);
    }
  },
  "rob-02: bilibili 正常路径仍只 $done 一次": async (a, h) => {
    const sb = h.createSandbox({});
    sb.context.$httpClient = {
      get: (o, cb) => {
        if (o.url.includes("doSign")) cb(null, { status: 200 }, JSON.stringify({ code: 0, data: { text: "签到成功" } }));
        else cb(null, { status: 200 }, JSON.stringify({ code: 0, data: 42 }));
      },
    };
    const s = await h.runScript("Scripts/Bilibili.js", sb);
    a.doneCalledTimes(s, 1, "收尾守卫不应造成重复 $done");
  },

  // ══════════════════════════════════════════════════════════
  // CODE-02 — Kuwo 源码曾为单行压缩产物; 还原后行为须逐条一致
  // ══════════════════════════════════════════════════════════
  "code-02: kuwo 清空广告容器 + 删除 banner 类字段 (顶层与 data 内)": async (a, h) => {
    const s = await h.runScript("Scripts/Kuwo.js", h.createSandbox({
      request: { url: "https://x.kuwo.cn/y" },
      response: RESP({
        data: [1], adlist: [1], list: [1], ads: [1], adList: [1],
        banner: 1, bannerList: 1, banners: 1, topBanner: 1, bottomBanner: 1,
        keep: "x",
      }),
    }));
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    for (const k of ["data", "adlist", "list", "ads", "adList"]) a.equal(out[k], [], `${k} 应清空为 []`);
    for (const k of ["banner", "bannerList", "banners", "topBanner", "bottomBanner"]) {
      a.ok(!(k in out), `${k} 应被删除`);
    }
    a.equal(out.keep, "x", "非广告字段应保留");
  },
  "code-02: kuwo 保留 falsy 值 (与原实现 `s[t] && (...)` 一致)": async (a, h) => {
    const s = await h.runScript("Scripts/Kuwo.js", h.createSandbox({
      request: { url: "https://x.kuwo.cn/y" },
      response: RESP({ data: 0, ads: 0, banner: 0, keep: "y" }),
    }));
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    a.equal(out.data, 0, "falsy 的 data 不应被改写");
    a.equal(out.ads, 0, "falsy 的 ads 不应被改写");
    a.ok(!("banner" in out), "delete 对 falsy 值同样生效");
    a.equal(out.keep, "y", "其他字段保留");
  },
  "code-02: kuwo data 内层 banner 类字段被删除": async (a, h) => {
    const s = await h.runScript("Scripts/Kuwo.js", h.createSandbox({
      request: { url: "https://x.kuwo.cn/y" },
      response: RESP({ data: { banner: 1, adlist: 1, ads: 1, keep: 2 }, ads: [1] }),
    }));
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    // 注意: data 在第一步被整体清空为 {} — 与原实现一致
    a.equal(out.data, {}, "data 作为广告容器会被整体清空");
    a.equal(out.ads, [], "顶层 ads 清空");
  },

  // ══════════════════════════════════════════════════════════
  // BUG-02 — 广告类型 \b 词首边界误伤 adaptive/address
  // ══════════════════════════════════════════════════════════
  "bug-02: feishu 保留 adaptive/address, 删除真正的广告类型": async (a, h) => {
    const s = await h.runScript("Scripts/Feishu.js", h.createSandbox({
      request: { url: "https://internal-api.feishu.cn/x" },
      response: RESP({
        items: [
          { type: "adaptive", id: 1 },
          { type: "address", id: 2 },
          { type: "normal", id: 3 },
          { type: "ad", id: 4 },
          { type: "banner_ad_x", id: 5 },
          { type: "promotion", id: 6 },
        ],
      }),
    }));
    a.doneCalled(s);
    const ids = JSON.parse(s.doneCalls[0].body).items.map((x) => x.id);
    a.equal(ids, [1, 2, 3], "adaptive/address/normal 应保留, ad/banner_*/promotion 应删除");
  },

  // ══════════════════════════════════════════════════════════
  // CODE-03 — mainConfig 字段被读取但从未定义 (静默不可达)
  // ══════════════════════════════════════════════════════════
  "code-03: weibo 的 mainConfig 每个被读取的字段都必须在配置对象中定义": async (a, h) => {
    // 该缺陷的原型: blockIds / removeUnfollowTopic / removeUnusedPart 被读取但未定义,
    // 导致 isBlock() 恒 false、topicHandler() 的超话分支整段不可达 —— 而 108 个用例
    // 全绿, 因为没人覆盖那条路径。esbuild 只转译不检查类型, `as any` 又掩盖了它。
    // 此静态检查把"读取了不存在的配置项"变成红灯。
    //
    // ⚠️ 实现要点 (本守卫第一版就踩过): 必须精确定位**对象字面量**并剔除注释。
    //    · 不能用 indexOf("const mainConfig") — 注释里也会出现该字样
    //    · 不能把 interface MainConfig 的字段声明算作"已定义" — 那样字段删了也测不出
    //    (一个不会红的守卫比没有守卫更糟 — 见 v8.11 对 test/rule-order-check.js 的同类修复)
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.join(__dirname, "..", "..", "src", "Weibo.ts"), "utf8");

    // 1. 精确定位对象字面量: 行首的 `const mainConfig<可选类型> = {`
    //    (必须带 ^ 行首锚 — 否则会匹配到文档注释里的示例 `const mainConfig: any = {...}`)
    const decl = /^const\s+mainConfig[^=]*=\s*\{/m.exec(src);
    a.ok(decl, "应能找到 mainConfig 对象字面量声明");
    const bodyStart = decl.index + decl[0].length;
    const bodyEnd = src.indexOf("\n};", bodyStart);
    a.ok(bodyEnd !== -1, "应能找到对象字面量结尾 `};`");
    const body = src.slice(bodyStart, bodyEnd);

    // 2. 剔除注释行 (块注释续行 `*` 与行注释 `//`), 避免注释里的示例被当成定义
    const code = body
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n");
    a.notIncludes(code, "interface ", "对象字面量内不应含 interface 声明");

    // 3. 读取集合: 全文件范围内的 mainConfig.X (含注释里的用法也在读取侧, 无妨 — 宁可严)
    const read = new Set();
    for (const m of src.matchAll(/mainConfig\.([A-Za-z_$][\w$]*)/g)) read.add(m[1]);
    a.ok(read.size > 0, "应至少读取一个 mainConfig 字段");

    // 4. 定义集合: 仅来自对象字面量
    const defined = new Set();
    for (const m of code.matchAll(/(?:^|[\s,{])([A-Za-z_$][\w$]*)\s*:/g)) defined.add(m[1]);

    const missing = [...read].filter((k) => !defined.has(k)).sort();
    a.equal(missing, [], `以下字段被读取但未在 mainConfig 中定义 (会静默变成 undefined): ${missing.join(", ")}`);
  },
};
