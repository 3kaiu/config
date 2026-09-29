/**
 * 京东去广告 Pro — Scripts/Jingdong.js 行为级回归测试
 *
 * 覆盖 7 个 functionId 通道 (开屏 / 首页 / 我的 / 订单 / 物流 / 新品页),
 * 每条用例同时断言三件事:
 *   ① 广告字段确实被清掉   ② 功能字段确实保留   ③ 脚本未抛错且恰好调用一次 $done
 *
 * ③ 是本文件的主线断言: 脚本抛错而不调 $done → Loon 侧该请求挂死, 且在
 * 京东这种"一个接口下发整页数据"的架构下会连带卡死首页 —— 故每个用例都跑 noScriptError。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const API = "https://api.m.jd.com/client.action?functionId=";

/**
 * 京东广告面台账 —— "京东到底还有没有广告" 的可断言答案。
 *
 * 背景: 2026-09-29 交叉研判 fmz200 / blackmatrix7 / app2smile / NobyDa / SukkaW
 * 五源后确认, 京东广告面**分散在 4 个不同机制层**, 任何单一清单都答不全:
 *   rejected   整条 reject (纯广告接口, 丢整个响应可接受)
 *   rewritten  字段重命名 (response-body-replace-regex, 客户端认不出 key 但结构保留)
 *   purged     响应体字段级净化 (Scripts/Jingdong.js)
 *   domained   DNS/RULE 层整域拦截 (无解密面)
 * 逐条登记处置方式与状态, 新增/删除广告面时本表即变更点, 门禁随之判红。
 *
 * status:
 *   covered   已有规则覆盖且机制与广告面性质相符
 *   inert     规则存在但对主 App 惰性 (仅京喜系等子 App 命中)
 *   uncertain 规则已就位但机制安全性未经真机验证 (见 note)
 *   rejected  经实测证据否决, **不得**加规则
 */
const AD_SURFACES = [
  // ── 开屏 ──
  { id: "splash.images", layer: "purged", status: "covered", match: "functionId=start script-path", note: "开屏图列表; 只能改响应体, 整条 reject 会丢启动配置致白屏" },
  { id: "splash.freqcap", layer: "purged", status: "covered", match: "functionId=start script-path", note: "showTimesDaily 每日展示上限 → 0" },
  { id: "splash.materialApi", layer: "rejected", status: "uncertain", match: "functionId=queryMaterialAdverts reject-200", note: "纯素材接口可安全 reject; 未经真机" },
  { id: "splash.jr", layer: "rejected", status: "covered", match: "ms.jr.jd.com", note: "京东金融开屏 (startup 插件 / ddgksf)" },
  { id: "splash.jdread", layer: "rejected", status: "covered", match: "jdread-api.jd.com", note: "京东读书开屏+弹窗 (startup 插件)" },
  { id: "splash.jdcloud", layer: "rejected", status: "covered", match: "router-app-api.jdcloud.com", note: "京东云无线宝路由 App (startup 插件)" },
  { id: "splash.jingxi", layer: "rejected", status: "uncertain", match: "functionId=delivery_show", note: "京喜系开屏; 当前 reject-dict, 但 fmz200 选择改 startTime/endTime 而非 reject —— 暗示 reject 容错性未验证. 不churn, 留待真机" },
  // ── 功能广告 (主 App 6 通道) ──
  { id: "home.banner", layer: "purged", status: "covered", match: "functionId=welcomeHome", note: "底部通栏/悬浮圆图/顶部动图/右上角券/左上角logo/下拉二楼; 刻意保留 recommend 商品瀑布流" },
  { id: "mine.promofloor", layer: "purged", status: "covered", match: "functionId=personinfoBusiness", note: "大促楼层/快讯/顶部横幅/我的推荐; obj.floors 与 obj.others.floors 双路径" },
  { id: "mine.popup", layer: "purged", status: "covered", match: "functionId=personinfoBusiness", note: "commonPopup/commonWindows/续费横幅/评价提醒/PLUS 卡" },
  { id: "order.banner", layer: "purged", status: "covered", match: "functionId=myOrderInfo", note: "banner/动态/PLUS 楼层 + 服务中心「精选特惠」+ 客服引导" },
  { id: "logistics.banner", layer: "purged", status: "covered", match: "functionId=(deliverLayer|orderTrackBusiness)", note: "bannerInfo + 运费八折楼层" },
  { id: "newproduct.float", layer: "purged", status: "covered", match: "functionId=getTabHomeInfo", note: "悬浮动图 iconInfo + 下拉二楼 roofTop" },
  { id: "search.hotword", layer: "rejected", status: "covered", match: "functionId=(searchBoxWord|stationPullService|uniformRecommend[06])", note: "搜索框词/推荐位整拒 (startup 层 SCRIPT_LEDGER 判 pending 的同族已在此覆盖)" },
  { id: "httpdns", layer: "purged", status: "covered", match: "functionId=basicConfig", note: "关客户端 httpdns 开关 (第一道)" },
  { id: "httpdns.server", layer: "domained", status: "covered", match: "DOMAIN, dns.jd.com, REJECT", note: "拦 HTTPDNS 服务端 (第二道); 探针实证 GET / 返回 uri错误 = 服务在线" },
  { id: "adx.exchange", layer: "rejected", status: "covered", match: "bdsp-x", note: "京东广告交易平台 (startup 插件 adx 路径)" },
  { id: "adimg", layer: "rejected", status: "rejected", match: "360buyimg", note: "原由 Mirror AllInOne 提供 (素材图 reject, 只消图不消框架); 镜像移除后不再有覆盖" },
  // ── 京喜系 (与主 App 共用 api.m.jd.com, 主 App 不调 → 惰性) ──
  { id: "jingxi.advo", layer: "rewritten", status: "inert", match: "functionId=lite_advertising response-body-replace-regex", note: "京喜/京喜特价/京东小家; 字段重命名 jdLiteAdvertisingVO" },
  { id: "jingxi.smartpush", layer: "rewritten", status: "inert", match: "functionId=lite_SmartPush response-body-replace-regex", note: "智能推送 (推送广告通道); 字段重命名 pushData" },
  // ── 实测否决 ──
  { id: "domain.jzt", layer: "domained", status: "rejected", match: "DOMAIN-SUFFIX, jzt.jd.com", note: "301 → /home/, Server jen/2.1.8 = 对外 Jenkins CI, 非广告域" },
  { id: "domain.du", layer: "domained", status: "rejected", match: "DOMAIN-SUFFIX, du.jd.com", note: "302 → error2.aspx?from=shopdomain = 店铺域, 误拦破店铺页" },
  { id: "domain.cnfa", layer: "domained", status: "rejected", match: "DOMAIN-SUFFIX, c-nfa.jd.com", note: "同上, 店铺域" },
  { id: "domain.dgstatic", layer: "domained", status: "rejected", match: "DOMAIN-SUFFIX, dgstatic.jd.com", note: "80/443 均 connection refused = 死域" },
  { id: "domain.jdqd", layer: "domained", status: "rejected", match: "DOMAIN-SUFFIX, jdqd.jd.com", note: "200 nginx 默认页, 无广告信号" },
  { id: "domain.imgx", layer: "domained", status: "rejected", match: "DOMAIN-SUFFIX, img-x.jd.com", note: "302 error.html (openresty), 名称含 img 但无可证实广告面" },
  { id: "domain.jddebug", layer: "domained", status: "rejected", match: "DOMAIN-SUFFIX, jddebug.com", note: "DoH SERVFAIL = 死域, 只保留 /diagnose 路径级规则" },
];


/** 京东响应构造: 走 client.action 统一入口 */
const JD = (fid, body) => ({
  request: { url: API + fid, method: "GET", headers: {} },
  response: { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
});

const run = (h, fid, body) => h.runScript("Scripts/Jingdong.js", h.createSandbox(JD(fid, body)));
const out = (s) => JSON.parse(s.doneCalls[0].body);

exports.tests = {
  // ── 开屏 ────────────────────────────────────────────────────────────────
  "jd: 开屏 images 清空 + 展示频控归零, 启动配置保留": async (a, h) => {
    const s = await run(h, "start", {
      images: [{ url: "https://img.jd.com/splash1.jpg", duration: 5000, clickUrl: "https://ad.jd.com" }],
      showTimesDaily: 3,
      // 与开屏同接口下发的启动配置 —— 整条 reject 会连带清掉它, 致白屏
      appConfig: { privacyVersion: "3.0.1", minVersion: "9.9.9" },
      showBrandLogo: true,
    });
    a.noScriptError(s, "开屏分支不应抛错");
    a.doneCalled(s, "开屏分支应调用 $done");
    const o = out(s);
    a.equal(o.images, [], "开屏图列表应清空");
    a.equal(o.showTimesDaily, 0, "每日展示次数应归零");
    a.equal(o.appConfig.privacyVersion, "3.0.1", "启动配置必须保留");
    a.equal(o.showBrandLogo, true, "无关开关必须保留");
  },

  "jd: 开屏字段缺失时不注入键 (images 无则不造空数组)": async (a, h) => {
    const s = await run(h, "start", { appConfig: { minVersion: "1.0" } });
    a.noScriptError(s);
    const o = out(s);
    a.equal("images" in o, false, "原本无 images 时不应凭空插入空数组");
    a.equal("showTimesDaily" in o, false, "原本无 showTimesDaily 时不应插入");
  },

  "jd: 开屏 images 非数组时跳过而非清空": async (a, h) => {
    const s = await run(h, "start", { images: "unexpected-string", showTimesDaily: 1 });
    a.noScriptError(s);
    const o = out(s);
    a.equal(o.images, "unexpected-string", "非数组 images 应原样保留, 不猜语义");
    a.equal(o.showTimesDaily, 0, "showTimesDaily 仍应归零");
  },

  // ── 首页 ────────────────────────────────────────────────────────────────
  "jd: 首页通栏/悬浮/券/左上角logo 清除, 商品瀑布流保留": async (a, h) => {
    const s = await run(h, "welcomeHome", {
      floorList: [
        { type: "bottomXview", data: { adUrl: "https://ad.jd.com/x" } },
        { type: "float", data: { url: "https://ad.jd.com/y" } },
        { type: "photoCeiling", data: { img: "top.gif" } },
        { type: "searchIcon", data: { coupon: "券" } },
        { type: "topRotate", data: { logo: "l.png" } },
        { type: "ruleFloat", data: {} },
        { type: "tabBarAtmosphere", data: {} },
        // 功能主体: 为你推荐 = 商品瀑布流, 删掉首页就空了
        { type: "recommend", data: { list: [1, 2, 3] } },
        { type: "searchWord", data: { hotWords: ["a", "b"] } },
      ],
      webViewFloorList: [{ type: "pullDown", data: { url: "https://x.jd.com" } }],
      topBgImgBig: "keep-me",
    });
    a.noScriptError(s);
    const o = out(s);
    a.equal(o.floorList.length, 2, `只剩 recommend + searchWord, 实际 ${JSON.stringify(o.floorList.map((f) => f.type))}`);
    a.equal(o.floorList[0].type, "recommend", "为你推荐必须保留");
    a.equal(o.floorList[1].type, "searchWord", "搜索词条必须保留");
    a.equal(o.webViewFloorList, [], "下拉二楼应整块清空");
    a.equal(o.topBgImgBig, "keep-me", "顶部背景图不在净化范围");
  },

  "jd: 首页 floorList 缺失 / 非数组时不抛错": async (a, h) => {
    for (const body of [{ webViewFloorList: [] }, { floorList: null }, { floorList: "x" }, {}]) {
      const s = await run(h, "welcomeHome", body);
      a.noScriptError(s, `floorList=${JSON.stringify(body.floorList)} 不应抛错`);
      a.doneCalled(s, `floorList=${JSON.stringify(body.floorList)} 应放行`);
    }
  },

  // ── 我的 ────────────────────────────────────────────────────────────────
  "jd: 我的 — 旧路径 obj.floors 大促/快讯/推荐楼层清除 + 弹窗清空": async (a, h) => {
    const s = await run(h, "personinfoBusiness", {
      floors: [
        { mId: "basefloorinfo", data: { commonPopup: { url: "ad" }, commonPopup_dynamic: { url: "ad2" }, commonTips: [{ t: "续费" }], commonWindows: [{ u: "ad3" }], floatLayer: { img: "float.png" }, nickname: "user" } },
        { mId: "orderIdFloor", data: { orderCount: 3, commentRemindInfo: { infos: [{ id: 1 }] } } },
        { mId: "userinfo", data: { nickname: "ady", newPlusBlackCard: { price: 99 }, avatar: "a.png" } },
        { mId: "bigSaleFloor", data: { ad: 1 } },
        { mId: "buyOften", data: {} },
        { mId: "newsFloor", data: {} },
        { mId: "noticeFloor", data: {} },
        { mId: "recommendfloor", data: {} },
        { mId: "newBigSaleFloor", data: {} },
        { mId: "newAttentionCard", data: {} },
        { mId: "newStyleAttentionCard", data: {} },
        // 功能楼层必须保留
        { mId: "iconToolFloor", data: { nodes: [] } },
        { mId: "newWalletIdFloor", data: {} },
        { mId: "orderIdFloorReal", data: {} },
      ],
    });
    a.noScriptError(s);
    const o = out(s);
    const ids = o.floors.map((f) => f.mId);
    a.equal(ids, ["basefloorinfo", "orderIdFloor", "userinfo", "iconToolFloor", "newWalletIdFloor", "orderIdFloorReal"], `楼层集合应只剩 3 功能层 + base/order/user, 实际 ${JSON.stringify(ids)}`);
    const base = o.floors[0].data;
    a.equal("commonPopup" in base, false, "commonPopup 弹窗应删");
    a.equal("commonPopup_dynamic" in base, false, "commonPopup_dynamic 弹窗应删");
    a.equal("floatLayer" in base, false, "右下角动图应删");
    a.equal(base.commonTips, [], "底部续费横幅应清空");
    a.equal(base.commonWindows, [], "弹窗列表应清空");
    a.equal(base.nickname, "user", "同层功能字段必须保留");
    a.equal(o.floors[1].data.commentRemindInfo.infos, [], "评价提醒应清空");
    a.equal(o.floors[1].data.orderCount, 3, "订单数必须保留");
    a.equal("newPlusBlackCard" in o.floors[2].data, false, "PLUS 续费卡片应删");
    a.equal(o.floors[2].data.avatar, "a.png", "头像必须保留");
  },

  "jd: 我的 — 新路径 obj.others.floors 同样生效 (2024-04 后客户端主路径)": async (a, h) => {
    const s = await run(h, "personinfoBusiness", {
      others: {
        floors: [
          { mId: "basefloorinfo", data: { commonPopup: { url: "ad" }, nickname: "n" } },
          { mId: "newsFloor", data: {} },
          { mId: "recommendfloor", data: {} },
          { mId: "newWalletIdFloor", data: {} },
        ],
      },
    });
    a.noScriptError(s);
    const o = out(s);
    a.equal(o.others.floors.length, 2, "others.floors 应剩 basefloorinfo + newWalletIdFloor");
    a.equal("commonPopup" in o.others.floors[0].data, false, "others 路径的弹窗同样应删");
    a.equal(o.others.floors[0].data.nickname, "n", "others 路径的功能字段保留");
  },

  "jd: 我的 — 旧新两路径同存时互不串扰": async (a, h) => {
    const s = await run(h, "personinfoBusiness", {
      floors: [{ mId: "newsFloor", data: { tag: "旧" } }],
      others: { floors: [{ mId: "newWalletIdFloor", data: { tag: "新" } }] },
    });
    a.noScriptError(s);
    const o = out(s);
    a.equal(o.floors.length, 0, "旧路径 newsFloor 应被清");
    a.equal(o.others.floors.length, 1, "新路径 newWalletIdFloor 不应被误删");
    a.equal(o.others.floors[0].data.tag, "新", "新路径内容未变");
  },

  "jd: 我的 — others 存在但 floors 缺失时不抛错": async (a, h) => {
    const s = await run(h, "personinfoBusiness", { others: { userInfo: { nick: "x" } } });
    a.noScriptError(s);
    a.doneCalled(s);
    const o = out(s);
    a.equal("floors" in o, false, "floors 缺失时不应凭空插入");
    a.equal(o.others.userInfo.nick, "x", "others 其他字段保留");
  },

  // ── 我的订单 ────────────────────────────────────────────────────────────
  "jd: 订单 — banner/动态/PLUS 楼层清除, 服务中心「精选特惠」清除而其余服务保留": async (a, h) => {
    const s = await run(h, "myOrderInfo", {
      floors: [
        { mId: "bannerFloor", data: { img: "score.png" } },
        { mId: "bpDynamicFloor", data: {} },
        { mId: "plusFloor", data: { price: 99 } },
        {
          mId: "virtualServiceCenter",
          data: {
            virtualServiceCenters: [
              {
                serviceList: [
                  { serviceTitle: "精选特惠", url: "ad" },
                  { serviceTitle: "退换货", url: "keep" },
                  { serviceTitle: "价格保护", url: "keep2" },
                ],
              },
            ],
          },
        },
        { mId: "customerServiceFloor", data: { moreText: "点此获得更多服务", moreIcon: "i.png", moreIcon_dark: "i2.png", serviceTitle: "客服" } },
        { mId: "realOrderFloor", data: { orderList: [1, 2] } },
      ],
    });
    a.noScriptError(s);
    const o = out(s);
    a.equal(o.floors.length, 3, `应剩 3 个功能楼层, 实际 ${JSON.stringify(o.floors.map((f) => f.mId))}`);
    const titles = o.floors[0].data.virtualServiceCenters[0].serviceList.map((x) => x.serviceTitle);
    a.equal(titles, ["退换货", "价格保护"], "仅「精选特惠」应被剔除");
    const cs = o.floors[1].data;
    a.equal(cs.moreText, " ", "客服引导文案应中和为空格");
    a.equal("moreIcon" in cs, false, "客服 moreIcon 应删");
    a.equal("moreIcon_dark" in cs, false, "客服 moreIcon_dark 应删");
    a.equal(cs.serviceTitle, "客服", "客服标题必须保留");
    a.equal(o.floors[2].data.orderList, [1, 2], "真实订单列表必须保留");
  },

  "jd: 订单 — floors 非数组 / 楼层 data 缺失时不抛错": async (a, h) => {
    for (const body of [{ floors: null }, { floors: [null, 1, "s"] }, { floors: [{ mId: "virtualServiceCenter" }] }, { floors: [{ mId: "customerServiceFloor", data: {} }] }]) {
      const s = await run(h, "myOrderInfo", body);
      a.noScriptError(s, `floors=${JSON.stringify(body.floors)} 不应抛错`);
      a.doneCalled(s, `floors=${JSON.stringify(body.floors)} 应放行`);
    }
  },

  // ── 物流 ────────────────────────────────────────────────────────────────
  "jd: 物流 — bannerInfo 与运费八折楼层清除 (deliverLayer / orderTrackBusiness 双通道)": async (a, h) => {
    for (const fid of ["deliverLayer", "orderTrackBusiness"]) {
      const s = await run(h, fid, {
        bannerInfo: { img: "八折.jpg", url: "ad" },
        floors: [
          { mId: "banner", data: { ad: 1 } },
          { mId: "jdDeliveryBanner", data: { ad: 2 } },
          { mId: "logisticsTrack", data: { nodeList: [{ time: "10:00" }] } },
        ],
        orderId: 123,
      });
      a.noScriptError(s, `${fid} 不应抛错`);
      const o = out(s);
      a.equal("bannerInfo" in o, false, `${fid}: bannerInfo 应删`);
      a.equal(o.floors.length, 1, `${fid}: 只剩 logisticsTrack`);
      a.equal(o.floors[0].mId, "logisticsTrack", `${fid}: 物流轨迹楼层保留`);
      a.equal(o.orderId, 123, `${fid}: 订单号保留`);
    }
  },

  "jd: 物流 — floors 缺失时不应凭空插入": async (a, h) => {
    const s = await run(h, "deliverLayer", { orderId: 1 });
    a.noScriptError(s);
    a.equal("floors" in out(s), false, "floors 缺失时不应插入空数组");
  },

  // ── 新品页 ──────────────────────────────────────────────────────────────
  "jd: 新品页 — 悬浮动图 iconInfo / 下拉二楼 roofTop 清除, 商品流保留": async (a, h) => {
    const s = await run(h, "getTabHomeInfo", {
      result: {
        iconInfo: { url: "float.gif" },
        roofTop: { webViewUrl: "https://x.jd.com" },
        wareList: [{ skuId: 1 }, { skuId: 2 }],
        categoryName: "新品",
      },
      code: 0,
    });
    a.noScriptError(s);
    const o = out(s);
    a.equal("iconInfo" in o.result, false, "悬浮动图应删");
    a.equal("roofTop" in o.result, false, "下拉二楼应删");
    a.equal(o.result.wareList.length, 2, "新品商品流必须保留");
    a.equal(o.result.categoryName, "新品", "类目名保留");
    a.equal(o.code, 0, "业务码保留");
  },

  "jd: 新品页 — result 缺失 / 非对象时不抛错": async (a, h) => {
    for (const body of [{}, { result: null }, { result: "x" }, { result: 5 }]) {
      const s = await run(h, "getTabHomeInfo", body);
      a.noScriptError(s, `result=${JSON.stringify(body.result)} 不应抛错`);
      a.doneCalled(s, `result=${JSON.stringify(body.result)} 应放行`);
    }
  },

  // ── 兜底 / 契约 ─────────────────────────────────────────────────────────
  "jd: 未登记 functionId 原样放行 (不误伤功能接口)": async (a, h) => {
    const s = await run(h, "wareBusiness", { result: { wareId: 9 }, ads: [1] });
    a.noScriptError(s);
    a.equal(s.doneCalls.length, 1, "应恰好一次 $done");
    a.equal(s.doneCalls[0].body, undefined, "未登记 functionId 不应改写 body");
  },

  "jd: 非 JSON (proto/二进制) 响应原样放行": async (a, h) => {
    const sb = h.createSandbox({
      request: { url: API + "welcomeHome", method: "GET" },
      response: { status: 200, body: "\x08\x01\x12\x02proto" },
    });
    const s = await h.runScript("Scripts/Jingdong.js", sb);
    a.noScriptError(s, "JSON.parse 失败不应抛错");
    a.doneCalled(s, "解析失败必须放行, 否则请求挂死");
    a.equal(s.doneCalls[0].body, undefined, "非 JSON 应无参放行");
  },

  "jd: 响应体为 JSON 标量 (非对象) 时放行": async (a, h) => {
    for (const raw of ["null", "123", '"str"', "[1,2]"]) {
      const sb = h.createSandbox({
        request: { url: API + "start", method: "GET" },
        response: { status: 200, body: raw },
      });
      const s = await h.runScript("Scripts/Jingdong.js", sb);
      a.noScriptError(s, `${raw} 不应抛错`);
      a.doneCalled(s, `${raw} 应放行`);
      a.equal(s.doneCalls[0].body, undefined, `${raw} 应无参放行`);
    }
  },

  "jd: body 缺失 / 缺 $response 时放行 (AllInOne 全局 MitM 误触 request 阶段)": async (a, h) => {
    const s1 = await h.runScript("Scripts/Jingdong.js", h.createSandbox({
      request: { url: API + "start", method: "GET" }, response: { status: 200 },
    }));
    a.noScriptError(s1, "无 body 不应抛错");
    a.doneCalled(s1, "无 body 应放行");

    const s2 = await h.runScript("Scripts/Jingdong.js", h.createSandbox({
      request: { url: API + "start", method: "GET" },
    }));
    a.noScriptError(s2, "缺 $response 不应抛 ReferenceError");
    a.doneCalled(s2, "缺 $response 应放行");

    const s3 = await h.runScript("Scripts/Jingdong.js", h.createSandbox({
      response: { status: 200, body: "{}" },
    }));
    a.noScriptError(s3, "缺 $request 不应抛 ReferenceError");
    a.doneCalled(s3, "缺 $request 应放行");
  },

  "jd: functionId 支持 URL 编码与多参数 query": async (a, h) => {
    const sb = h.createSandbox({
      request: { url: "https://api.m.jd.com/client.action?appid=jd&functionId=welcomeHome&v=1", method: "GET" },
      response: { status: 200, body: JSON.stringify({ floorList: [{ type: "float" }, { type: "recommend" }] }) },
    });
    const s = await h.runScript("Scripts/Jingdong.js", sb);
    a.noScriptError(s);
    a.equal(out(s).floorList.length, 1, "多参数 query 中的 functionId 应被正确解析");

    const sb2 = h.createSandbox({
      request: { url: "https://api.m.jd.com/client.action?functionId=welcomeHome%20", method: "GET" },
      response: { status: 200, body: JSON.stringify({ floorList: [{ type: "float" }] }) },
    });
    const s2 = await h.runScript("Scripts/Jingdong.js", sb2);
    a.noScriptError(s2, "URL 编码的 functionId 不应抛错");
    a.doneCalled(s2);
  },

  "jd: 调试开关传 false 时不产生逐请求日志": async (a, h) => {
    const s = await h.runScript("Scripts/Jingdong.js", h.createSandbox({
      ...JD("start", { images: [{ url: "a" }] }),
      argument: { JD_DEBUG_ENABLE: "false" },
    }));
    a.noScriptError(s);
    a.doneCalled(s);
    a.equal(s.logs.length, 0, `关闭调试时不应有日志, 实际 ${JSON.stringify(s.logs)}`);
  },

  "jd: 调试开关传 true 时可放开日志 (不改变改写结果)": async (a, h) => {
    const s = await h.runScript("Scripts/Jingdong.js", h.createSandbox({
      ...JD("start", { images: [{ url: "a" }], showTimesDaily: 2 }),
      argument: { JD_DEBUG_ENABLE: "true" },
    }));
    a.noScriptError(s);
    const o = out(s);
    a.equal(o.images, [], "开屏仍应清空 (调试开关不得影响行为)");
    a.equal(o.showTimesDaily, 0, "频控仍应归零");
  },

  // ── 接线: 插件与生成器的单归属对账 ──────────────────────────────────────
  "jd: start 通道单一归属 jd-pro (固化块已让位, 零双写)": async (a) => {
    const gen = fs.readFileSync(path.join(__dirname, "../../Plugin/startup-adblock-pro.plugin"), "utf8");
    // 生成器已于 2026-09-29 随镜像体系移除, 该块改为静态自维护;
    // "让位" 从此是一条**永久**状态, 只能靠本断言守住 (无生成器兜底)。
    a.includes(gen, "YIELDED_TO_OWNER", "固化块应保留让位记录, 供审计追溯");
    const rewriteSeg = gen.slice(gen.indexOf("[Rewrite]"));
    for (const l of rewriteSeg.split("\n")) {
      const t = l.trim();
      if (!t || t.startsWith("#")) continue;
      a.ok(!/functionId=start/.test(t), `startup 固化块不应再含 start 规则行: ${t.slice(0, 70)}`);
    }
    a.notIncludes(rewriteSeg, "functionId=start reject", "start 不得以 reject 形式残留在 startup 固化块");
  },

  "jd: 让位的 queryMaterialAdverts 由 jd-pro 补回 (否则开屏素材广告静默失守)": async (a) => {
    const jd = fs.readFileSync(path.join(__dirname, "../../Plugin/jd-pro.plugin"), "utf8");
    a.includes(jd, "functionId=queryMaterialAdverts reject-200", "jd-pro 必须补回 queryMaterialAdverts 的 reject 覆盖");
    a.includes(jd, "functionId=start script-path", "jd-pro 必须以脚本方式接管 start (响应体改写, 非整条 reject)");
  },

  "jd: 京东广告域 REJECT (v8.9 曾把 ad.jddg.com 误写为 DIRECT)": async (a) => {
    const jd = fs.readFileSync(path.join(__dirname, "../../Plugin/jd-pro.plugin"), "utf8");
    a.includes(jd, "DOMAIN-SUFFIX, ad.jddg.com, REJECT", "ad.jddg.com 应为 REJECT");
    a.notIncludes(jd, "ad.jddg.com, DIRECT", "ad.jddg.com 不得再被放行");
    // 京东 HTTPDNS: 必须在 [Rule] 显式拦, 否则绕过 Loon DNS 体系
    a.includes(jd, "DOMAIN, dns.jd.com, REJECT", "京东 HTTPDNS 域应在 [Rule] 拦截");
  },

  "jd: 每个开关参数都有声明且真被规则消费 (参数契约, 无假粒度)": async (a) => {    const jd = fs.readFileSync(path.join(__dirname, "../../Plugin/jd-pro.plugin"), "utf8");
    // 参数只可能出现在 enable={X} 与 argument=[{X}] 两处 ——
    // 不能全量扫 {...}, URL-REGEX 的 \w{32} 是正则量词不是参数。
    const declared = new Set([...jd.matchAll(/^(\w+)=switch/gm)].map((x) => x[1]));
    const used = new Set();
    // enable= 后面可能是 {A}&{B}&{C} 链式, 必须整段吃掉而不是遇到首个 } 就停
    for (const m of jd.matchAll(/enable=((?:\{[^}]*\}&?)+)/g)) {
      for (const p of m[1].replace(/[{}&]/g, ",").split(",")) if (p) used.add(p);
    }
    for (const m of jd.matchAll(/argument=\[\{([^}]*)\}\]/g)) {
      for (const p of m[1].split("},")) if (p) used.add(p);
    }
    a.ok(used.size > 0, "应解析出实际被消费的参数");
    for (const u of used) a.ok(declared.has(u), `参数 ${u} 必须在 [Argument] 声明`);
    for (const d of declared) a.ok(used.has(d), `参数 ${d} 已声明但无规则消费 (假粒度)`);
  },
  // ── 广告面台账 ─────────────────────────────────────────────────────────
  "jd: 广告面台账 — covered/inert 面全部有规则落地": async (a) => {
    const jd = fs.readFileSync(path.join(__dirname, "../../Plugin/jd-pro.plugin"), "utf8");
    const startup = fs.readFileSync(path.join(__dirname, "../../Plugin/startup-adblock-pro.plugin"), "utf8");
    const corpus = jd + startup;
    for (const s of AD_SURFACES) {
      if (s.status === "rejected") continue;
      a.includes(corpus, s.match, `广告面 ${s.id} 的规则应落地 (match=${s.match})`);
    }
  },

  "jd: 广告面台账 — rejected 面必须**不存在**对应 REJECT (防上游误伤回流)": async (a) => {
    const jd = fs.readFileSync(path.join(__dirname, "../../Plugin/jd-pro.plugin"), "utf8");
    for (const s of AD_SURFACES) {
      if (s.status !== "rejected") continue;
      a.notIncludes(jd, s.match, `已否决广告面 ${s.id} 不得有规则: ${s.match} (${s.note})`);
    }
  },

  "jd: 广告面台账自洽 — id 唯一 / 状态合法 / 处置方式合法 / 必填注记": async (a) => {
    const ids = AD_SURFACES.map((s) => s.id);
    a.equal(new Set(ids).size, ids.length, "广告面 id 应唯一");
    const layers = ["rejected", "rewritten", "purged", "domained"];
    const stats = ["covered", "inert", "uncertain", "rejected"];
    for (const s of AD_SURFACES) {
      a.ok(layers.includes(s.layer), `${s.id}: 未知处置方式 ${s.layer}`);
      a.ok(stats.includes(s.status), `${s.id}: 未知状态 ${s.status}`);
      a.ok(s.note && s.note.length > 6, `${s.id}: 必须写注记 (成因/证据)`);
    }
    // 每个状态至少各有一项, 防止某一类被整体遗忘而无人察觉
    for (const st of stats) {
      a.ok(AD_SURFACES.some((s) => s.status === st), `状态 ${st} 应至少有一项登记`);
    }
    const byLayer = {};
    for (const s of AD_SURFACES) byLayer[s.layer] = (byLayer[s.layer] || 0) + 1;
    a.ok(Object.keys(byLayer).length === 4, `4 类处置方式都应有实例, 实际 ${JSON.stringify(byLayer)}`);
  },

  "jd: ad.jddg.com 的 REJECT 依据已改为实测 (域已 NXDOMAIN, 非活跃广告域)": async (a) => {
    const jd = fs.readFileSync(path.join(__dirname, "../../Plugin/jd-pro.plugin"), "utf8");
    a.includes(jd, "ad.jddg.com, REJECT", "仍应保持 REJECT (死域零成本 + 防御性)");
    a.includes(jd, "NXDOMAIN", "注释必须记录 DoH 实测结论 —— v8.9 的\"域名字义\"依据已被证伪");
    a.ok(
      !/京东广告网关/.test(jd),
      "不得再宣称 ad.jddg.com 是\"京东广告网关\" —— 该说法基于域名语义, 已被 DoH 证伪",
    );
  },

  "jd: 已否决的 7 个域必须逐条留有实测注记 (不可只写\"待真机\")": async (a) => {
    const jd = fs.readFileSync(path.join(__dirname, "../../Plugin/jd-pro.plugin"), "utf8");
    const evidence = ["jen/2.1.8", "shopdomain", "connection refused", "SERVFAIL", "nginx!", "openresty"];
    for (const e of evidence) a.includes(jd, e, `插件注释应留有探针证据 ${e}`);
  },

  "jd: 字段重命名法只用于京喜系惰性面, 不得用于主 App 通道": async (a) => {
    const jd = fs.readFileSync(path.join(__dirname, "../../Plugin/jd-pro.plugin"), "utf8");
    // 只取规则行, 跳过注释 (注释里会解释这个机制本身)
    const renames = jd.split("\n").map((l) => l.trim())
      .filter((l) => l.startsWith("^") && l.includes("response-body-replace-regex"));
    a.ok(renames.length > 0, "应存在字段重命名规则 (京喜系)");
    for (const l of renames) {
      a.ok(
        /functionId=lite_(advertising|SmartPush)/.test(l),
        `字段重命名只允许用于京喜系惰性面, 违规: ${l.slice(0, 70)}`,
      );
      a.ok(/_3kaiu_jd_noad/.test(l), `重命名目标必须是不可预测常量, 违规: ${l.slice(0, 70)}`);
    }
  },
};
