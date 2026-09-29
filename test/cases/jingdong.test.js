/**
 * jingdong.js 行为回归 (2026-09-29 新增)
 *
 * 核心不变量, 每条都对应一次真实踩坑或治理纪律:
 *   ① functionId=start 绝不清空整个响应 —— 只清 images/showTimesDaily,
 *      启动配置必须保留 (整条 reject 致白屏, 本仓已犯错; zqzess 上游是反例)。
 *   ② 未取证 functionId 原样放行 (不猜、不因同域批量照搬)。
 *   ③ 异常/非 JSON 一律放行, 绝不因脚本异常打断 App。
 *   ④ 每条响应脚本路径都必须调用 $done (未调用 = Loon 请求悬挂)。
 *   ⑤ 台账自洽: 已处置面全部有代码落地。
 */
"use strict";

const JD = "https://api.m.jd.com/client.action";
const url = (fid) => `${JD}?functionId=${fid}`;

/** 跑一次并断言 $done 被调用 */
async function run(a, h, fid, body) {
  const sb = h.createSandbox({
    request: { method: "POST", url: url(fid), headers: {} },
    response: { status: 200, headers: {}, body: typeof body === "string" ? body : JSON.stringify(body) },
  });
  const s = await h.runScript("Scripts/jingdong.js", sb);
  a.equal(s.scriptError, null, `functionId=${fid} 脚本抛错: ${s.scriptError && s.scriptError.message}`);
  a.equal(s.doneCalls.length, 1, `functionId=${fid} 必须恰好调用一次 $done (0 次 = Loon 请求悬挂)`);
  return s;
};

/** 取唯一一次 $done 的参数; body 缺失表示未改写 */
const doneArg = (s) => s.doneCalls[0];
const parsed = (s) => JSON.parse(doneArg(s).body);

exports.tests = {
  "start: 只清开屏图, 启动配置必须保留 (白屏回归)": async (a, h) => {
    const s = await run(a, h, "start", {
      images: [{ url: "https://ad.example/splash.jpg" }],
      showTimesDaily: 3,
      // 与开屏图同处一个响应的业务配置 —— 任何整条 reject 都会清掉这些
      launchConfig: { appName: "京东", version: "1.0" },
      privacyAgreed: true,
    });
    const o = parsed(s);
    a.ok(Array.isArray(o.images) && o.images.length === 0, "images 应置空数组");
    a.equal(o.showTimesDaily, 0, "showTimesDaily 应归零 (不再弹开屏)");
    a.ok(o.launchConfig, "❌ 启动配置被清掉 = 白屏, 整条 reject 的等价后果");
    a.equal(o.privacyAgreed, true, "❌ 业务字段被清掉 = 白屏");
  },

  "start: images 非数组/缺失时不抛": async (a, h) => {
    const s1 = await run(a, h, "start", { showTimesDaily: 1 });
    a.equal(parsed(s1).showTimesDaily, 0, "images 缺失时仍应处理 showTimesDaily");
    // images 存在但类型异常 ⇒ 响应结构已不符合预期, 整条放行 (不半改)
    const s2 = await run(a, h, "start", { images: "not-array", showTimesDaily: 2 });
    a.equal(parsed(s2), { images: "not-array", showTimesDaily: 2 }, "images 结构异常时应整条放行, 不半改");
  },

  "welcomeHome: 过滤 7 类推广层, 保留业务层": async (a, h) => {
    const s = await run(a, h, "welcomeHome", {
      floorList: [
        { type: "bottomXview", id: 1 },
        { type: "float", id: 2 },
        { type: "photoCeiling", id: 3 },
        { type: "ruleFloat", id: 4 },
        { type: "searchIcon", id: 5 },
        { type: "topRotate", id: 6 },
        { type: "tabBarAtmosphere", id: 7 },
        { type: "recommend", id: 8 }, // 业务推荐 (上游特意保留)
        { type: "goods", id: 9 }, // 商品楼层
      ],
      topBgImgBig: "https://cdn.example/bg.jpg",
    });
    const o = parsed(s);
    const types = o.floorList.map((i) => i.type);
    for (const ad of ["bottomXview", "float", "photoCeiling", "ruleFloat", "searchIcon", "topRotate", "tabBarAtmosphere"])
      a.ok(!types.includes(ad), `推广层 ${ad} 应被过滤`);
    a.ok(types.includes("recommend"), "业务推荐层 recommend 必须保留 (上游刻意保留)");
    a.ok(types.includes("goods"), "商品楼层必须保留");
    a.ok(!("topBgImgBig" in o), "首页顶部推广背景图应删除");
  },

  "myOrderInfo: 过滤 3 类商业位楼层": async (a, h) => {
    const s = await run(a, h, "myOrderInfo", {
      floors: [
        { mId: "bannerFloor" },
        { mId: "bpDynamicFloor" },
        { mId: "plusFloor" },
        { mId: "virtualServiceCenter", data: {} },
      ],
    });
    const ids = parsed(s).floors.map((i) => i.mId);
    for (const ad of ["bannerFloor", "bpDynamicFloor", "plusFloor"]) a.ok(!ids.includes(ad), `${ad} 应过滤`);
    a.ok(ids.includes("virtualServiceCenter"), "服务中心必须保留");
  },

  "deliverLayer / orderTrackBusiness: 删横幅 + 滤运费楼层": async (a, h) => {
    for (const fid of ["deliverLayer", "orderTrackBusiness"]) {
      const s = await run(a, h, fid, {
        bannerInfo: { title: "寄快递享八折" },
        floors: [{ mId: "banner" }, { mId: "jdDeliveryBanner" }, { mId: "expressInfo" }],
        logistics: { name: "圆通" },
      });
      const o = parsed(s);
      a.ok(!("bannerInfo" in o), `${fid}: bannerInfo 应删除`);
      const ids = o.floors.map((i) => i.mId);
      a.ok(!ids.includes("banner") && !ids.includes("jdDeliveryBanner"), `${fid}: 运费八折楼层应过滤`);
      a.ok(ids.includes("expressInfo"), `${fid}: 快递信息楼层必须保留`);
      a.ok(o.logistics, `${fid}: 物流信息必须保留`);
    }
  },

  "getTabHomeInfo: 删悬浮动图与下拉二楼": async (a, h) => {
    const s = await run(a, h, "getTabHomeInfo", {
      result: { iconInfo: { url: "x" }, roofTop: { id: 1 }, goods: [1, 2] },
    });
    const o = parsed(s);
    a.ok(!("iconInfo" in o.result), "iconInfo 应删除");
    a.ok(!("roofTop" in o.result), "roofTop 应删除");
    a.equal(o.result.goods.length, 2, "商品数据必须保留");
  },

  "未取证 functionId 原样放行 (不猜)": async (a, h) => {
    const raw = { foo: "bar", images: [{ url: "keep" }] };
    for (const fid of ["someNewThing", "lite_advertising", "unknown"]) {
      const s = await run(a, h, fid, raw);
      a.equal(parsed(s), raw, `未取证接口 ${fid} 必须原样放行, 不得凭猜测清理`);
    }
  },

  "异常与非法输入一律放行, 绝不打断 App": async (a, h) => {
    const bad = await run(a, h, "start", "not-json-at-all");
    a.equal(bad.doneCalls.length, 1, "非 JSON 也要 $done");
    a.ok(!doneArg(bad).body, "非 JSON 不应改写 body");

    const nullish = await run(a, h, "welcomeHome", { floorList: null });
    a.equal(nullish.doneCalls.length, 1, "floorList 为 null 也要 $done");

    const arr = await run(a, h, "myOrderInfo", [1, 2, 3]);
    a.equal(arr.doneCalls.length, 1, "顶层是数组也要 $done");
  },

  "无 functionId 的请求原样放行": async (a, h) => {
    const sb = h.createSandbox({
      request: { method: "POST", url: JD, headers: {} },
      response: { status: 200, headers: {}, body: JSON.stringify({ images: [{ u: 1 }] }) },
    });
    const s = await h.runScript("Scripts/jingdong.js", sb);
    a.equal(s.doneCalls.length, 1, "无 query 也必须 $done");
    a.equal(parsed(s).images.length, 1, "无 functionId 时不得清理任何字段");
  },

  "台账自洽: 已登记 functionId 全部有代码落地": async (a) => {
    const fs = require("fs");
    const src = fs.readFileSync("src/jingdong.ts", "utf8");
    // 台账表里 "covered" 状态的 functionId 必须能在 switch 里找到 case
    const ledger = [...src.matchAll(/\|\s*`?(\w+)`?\s*\|\s*purged\s*\|\s*covered/g)].map((m) => m[1]);
    a.ok(ledger.length >= 7, `台账应登记至少 7 个处置面, 实际 ${ledger.length}`);
    for (const fid of ledger) {
      const body = src.slice(src.indexOf("function handle"));
      a.ok(body.includes(`"${fid}"`), `台账登记的 ${fid} 在 handle() 里没有对应 case —— 声明与实现漂移`);
    }
  },
};
