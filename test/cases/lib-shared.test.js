/**
 * 共享模块 (src/lib/*) 行为回归 (2026-09-11 审计, CODE-01)
 *
 * src/lib/ 的模块经 esbuild --inject 注入, 不作为独立产物存在, 因此无法直接
 * import — 一律**通过消费者脚本**验证, 这也正是真正需要保证的东西:
 * 注入后每个脚本仍拿到正确的实现。
 *
 * 重点覆盖 isHost 的子域语义: 它从 6 份副本收敛为 1 份, 且是安全相关判定
 * (决定是否对某域名做净化/拦截), 必须保证 `evil-<domain>` 不被误判为子域。
 */
"use strict";

const RESP = (o) => ({ status: 200, body: JSON.stringify(o) });

exports.tests = {
  // ── net.ts: hostOf / isHost ──
  "lib/net: isHost 精确匹配与真子域匹配 (经 Youku 消费者验证)": async (a, h) => {
    // Youku 的 api.youku.com 分支会 cleanAdArrays → ads 清空
    for (const url of ["https://api.youku.com/x", "https://sub.api.youku.com/x", "https://a.b.api.youku.com/x"]) {
      const s = await h.runScript("Scripts/Youku.js", h.createSandbox({
        request: { url }, response: RESP({ ads: [1] }),
      }));
      a.doneCalled(s);
      a.equal(JSON.parse(s.doneCalls[0].body).ads, [], `${url} 应命中 api.youku.com 分支`);
    }
  },
  "lib/net: isHost 不得把 evil-<domain> 当子域 (安全边界)": async (a, h) => {
    // endsWith("." + d) 而非 endsWith(d) 才能挡住这三类伪子域
    for (const url of ["https://evil-youku.com/x", "https://notyouku.com/x", "https://youku.com.evil.com/x"]) {
      const s = await h.runScript("Scripts/Youku.js", h.createSandbox({
        request: { url }, response: RESP({ ads: [1] }),
      }));
      a.doneCalled(s);
      a.equal(JSON.parse(s.doneCalls[0].body).ads, [1], `${url} 不应命中 api.youku.com 分支`);
    }
  },
  "lib/net: hostOf 对非法 URL 返回空串而非抛错": async (a, h) => {
    const s = await h.runScript("Scripts/Youku.js", h.createSandbox({
      request: { url: "not-a-url" }, response: RESP({ ads: [1] }),
    }));
    a.doneCalled(s, "非法 URL 也必须 $done");
    a.equal(JSON.parse(s.doneCalls[0].body).ads, [1], "非法 URL 不应命中任何分支");
  },
  "lib/net: isHost 注入到全部 6 个消费者 (不再有本地副本)": async (a, h) => {
    // 每个消费者各跑一次, 断言都仍能正常分流 (注入失败的脚本会直接抛 ReferenceError)
    const cases = [
      ["Scripts/Fanqie.js", "https://log.snssdk.com/x"],
      ["Scripts/Kugou.js", "https://mobilead.kugou.com/x"],
      ["Scripts/Douyin.js", "https://log.snssdk.com/x"],
      ["Scripts/Meituan.js", "https://api.meituan.com/x"],
      ["Scripts/Dianping.js", "https://mapi.dianping.com/x"],
    ];
    for (const [f, url] of cases) {
      const s = await h.runScript(f, h.createSandbox({ request: { url }, response: RESP({ a: 1 }) }));
      a.noScriptError(s, `${f} 注入 isHost 后不应抛错`);
      a.doneCalled(s, `${f} 应正常收尾`);
    }
  },

  // ── ad.ts: isAdKey / cleanAdArrays / stripKeys ──
  "lib/ad: isAdKey 分段匹配 (经 Kugou 消费者验证)": async (a, h) => {
    const s = await h.runScript("Scripts/Kugou.js", h.createSandbox({
      request: { url: "https://mobilead.kugou.com/x" },
      response: RESP({ ad: [1], ads: [1], ad_list: [1], adData: [1], advertBanner: [1], header: [1], loading: [1], badge: [1] }),
    }));
    a.doneCalled(s);
    const out = JSON.parse(s.doneCalls[0].body);
    for (const k of ["ad", "ads", "ad_list", "adData", "advertBanner"]) a.equal(out[k], [], `${k} 应清空`);
    for (const k of ["header", "loading", "badge"]) a.equal(out[k], [1], `${k} 应保留`);
  },
  "lib/ad: cleanAdArrays/stripKeys 递归到嵌套层": async (a, h) => {
    const s = await h.runScript("Scripts/Kugou.js", h.createSandbox({
      request: { url: "https://mobilead.kugou.com/x" },
      response: RESP({ outer: { inner: { ads: [1], header: [1] } } }),
    }));
    a.doneCalled(s);
    const inner = JSON.parse(s.doneCalls[0].body).outer.inner;
    a.equal(inner.ads, [], "嵌套层的 ads 应清空");
    a.equal(inner.header, [1], "嵌套层的 header 应保留");
  },

  // ── notify.ts: barkPush / telegramPush / doNotify ──
  "lib/notify: doNotify 同时发本地通知与 Bark/Telegram (经 traffic-notify 验证)": async (a, h) => {
    const s = await h.runScript("Scripts/traffic-notify.js", h.createSandbox({
      store: { Bark_Key: "K", TG_BOT_TOKEN: "T", TG_USER_ID: "U" },
    }));
    a.doneCalled(s);
    a.equal(s.notifications.length, 1, "应有 1 条本地通知");
    // doNotify(title, body) → $notification.post(title, body, '')
    // 即 title 为标题、body 落在 subtitle 位、第三位为空串
    a.equal(s.notifications[0].title, "📊 Loon 流量统计", "本地通知标题");
    a.includes(s.notifications[0].subtitle, "Loon 正常运行中", "body 应落在 subtitle 位");
    a.equal(s.notifications[0].body, "", "第三位应为空串");
    const urls = s.httpCalls.map((c) => c.url);
    a.ok(urls.some((u) => u.startsWith("https://api.day.app/K/")), "应请求 Bark");
    a.ok(urls.some((u) => u.startsWith("https://api.telegram.org/botT/sendMessage")), "应请求 Telegram");
  },
  "lib/notify: 未配置渠道时静默跳过, 不影响 $done": async (a, h) => {
    const s = await h.runScript("Scripts/traffic-notify.js", h.createSandbox({ store: {} }));
    a.doneCalled(s, "无任何渠道配置时也必须收尾");
    a.equal(s.notifications.length, 1, "本地通知仍应发出");
    a.equal(s.httpCalls.length, 0, "未配置渠道不应发 HTTP");
  },

  // ── argument.ts: readFlag (2026-09-11 分模块审计 MOD-02/03) ──
  // 背景: 三个脚本此前各写各的 `$argument.includes("KEY=true")`, 但**没有任何插件
  // 按该格式传参** —— 三处 debug 分支永不可达。收敛为 readFlag 后必须保证:
  // 两种传参形态都认, 且**不把 "false" 当真**(否则关掉的开关会被读成开)。
  "lib/argument: readFlag 认现代对象形态 (AlipayMini 消费者)": async (a, h) => {
    const mk = (argument) => h.createSandbox({
      request: { url: "https://mapi.alipay.com/gateway", method: "POST" },
      response: RESP({ data: [{ is_ad: true }], normal: 1 }),
      argument,
    });
    const on = await h.runScript("Scripts/AlipayMini.js", mk({ DEBUG_ENABLE: "true" }));
    a.noScriptError(on, "对象形态不应抛错");
    a.doneCalled(on);
    a.ok(on.logs.length > 0, "DEBUG_ENABLE=true 时应输出诊断日志");
  },
  "lib/argument: readFlag 不得把 \"false\" 当真 (保守真值判定)": async (a, h) => {
    // 这是本模块最容易写错的点: "false" 是**非空字符串**, 用真值判定会读成开。
    const s = await h.runScript("Scripts/AlipayMini.js", h.createSandbox({
      request: { url: "https://mapi.alipay.com/gateway", method: "POST" },
      response: RESP({ data: [{ is_ad: true }] }),
      argument: { DEBUG_ENABLE: "false" },
    }));
    a.doneCalled(s, "关掉调试也必须正常收尾");
    a.equal(s.logs.length, 0, 'DEBUG_ENABLE="false" 必须视为关');
  },
  "lib/argument: readFlag 向后兼容传统字符串形态": async (a, h) => {
    // Loon 旧语法 argument="KEY=true&OTHER=false" — 老配置不能因改形态而静默失效
    const s = await h.runScript("Scripts/AlipayMini.js", h.createSandbox({
      request: { url: "https://mapi.alipay.com/gateway", method: "POST" },
      response: RESP({ data: [{ is_ad: true }] }),
      argument: "DEBUG_ENABLE=true&OTHER=false",
    }));
    a.noScriptError(s, "字符串形态不应抛错");
    a.ok(s.logs.length > 0, '传统形态 "DEBUG_ENABLE=true" 也应被识别');
  },
  "lib/argument: 未传 argument 时视为关且不抛错": async (a, h) => {
    const s = await h.runScript("Scripts/AlipayMini.js", h.createSandbox({
      request: { url: "https://mapi.alipay.com/gateway", method: "POST" },
      response: RESP({ data: [{ is_ad: true }] }),
    }));
    a.noScriptError(s, "$argument 为 undefined 不应抛错");
    a.doneCalled(s);
    a.equal(s.logs.length, 0, "未传参数时调试应为关");
  },
  "lib/argument: 六个脚本的 debug 契约全部接通 (MOD-02/03 回归)": async (a, h) => {
    // 每个脚本一份 (插件参数键 → 消费者)。此前全部为死接线:
    //   Bilibili/AlipayMini 期望的键从没被传过; Weibo 硬编码 false; Zhihu 从不读; Twitter/LinkedIn 零日志
    const cases = [
      ["Scripts/Bilibili.js", "BILI_DEBUG_ENABLE", {
        httpHandler: () => ({ body: JSON.stringify({ code: 0, data: { text: "ok" } }) }),
      }],
      ["Scripts/AlipayMini.js", "DEBUG_ENABLE", {
        request: { url: "https://mapi.alipay.com/gateway", method: "POST" },
        response: RESP({ data: [{ is_ad: true }] }),
      }],
      ["Scripts/Twitter.js", "DEBUG_ENABLE", {
        request: { url: "https://api.twitter.com/x", method: "GET" },
        response: RESP({ ad: 1, header: 2 }),
      }],
      ["Scripts/LinkedIn.js", "DEBUG_ENABLE", {
        request: { url: "https://www.linkedin.com/x", method: "GET" },
        response: RESP({ ad: 1, header: 2 }),
      }],
      ["Scripts/Weibo.js", "WEIBO_DEBUG_ENABLE", {
        request: { url: "https://api.weibo.cn/2/statuses/friends/timeline", method: "GET" },
        response: RESP({ statuses: [], ad: [1] }),
      }],
      ["Scripts/Zhihu.js", "ZHIHU_DEBUG_ENABLE", {
        request: { url: "https://appcloud2.zhihu.com/v3/config", method: "GET" },
        response: RESP({ data: { ZHBackUpIP_Switch_Open: 1 } }),
      }],
    ];
    for (const [file, key, base] of cases) {
      const off = await h.runScript(file, h.createSandbox({ ...base }));
      a.noScriptError(off, `${file} 关闭调试时不应抛错`);
      a.doneCalled(off, `${file} 关闭调试时必须收尾`);
      a.equal(off.logs.length, 0, `${file} 关闭调试时不应有日志`);

      const on = await h.runScript(file, h.createSandbox({ ...base, argument: { [key]: "true" } }));
      a.noScriptError(on, `${file} 打开调试时不应抛错`);
      a.doneCalled(on, `${file} 打开调试时必须收尾`);
      a.ok(on.logs.length > 0, `${file} 传 {${key}:"true"} 后必须产出日志 (否则契约未接通)`);
    }
  },
  "lib/argument: 调试开关不得改变净化结果 (Twitter/LinkedIn)": async (a, h) => {
    for (const file of ["Scripts/Twitter.js", "Scripts/LinkedIn.js"]) {
      const mk = (argument) => h.createSandbox({
        request: { url: "https://api.twitter.com/x", method: "GET" },
        response: RESP({ ad: 1, header: 2, nested: { sponsor: 1, keep: 3 } }),
        argument,
      });
      const off = await h.runScript(file, mk(undefined));
      const on = await h.runScript(file, mk({ DEBUG_ENABLE: "true" }));
      a.equal(on.doneCalls[0].body, off.doneCalls[0].body, `${file} 开关只应影响日志, 不应改变 body`);
      const out = JSON.parse(on.doneCalls[0].body);
      a.equal(out.header, 2, `${file} header 必须保留`);
      a.equal(out.nested.keep, 3, `${file} 嵌套正常字段必须保留`);
    }
  },
};
