/**
 * Keep (JSON 清洗) / 喜马拉雅 (JSON 清洗) / 微博 (JSON 清洗) 回归测试
 * 样本由脚本自身 module.exports 的 clean/handlers 构造
 */
"use strict";

const KEEP = require("../../Scripts/Keep.js");
const XIMA = require("../../Scripts/Ximalaya.js");
const WEIBO = require("../../Scripts/Weibo.js");

// ── Keep 辅助: 构造请求 → 跑脚本 → 解析结果 ──
async function runKeep(h, url, payload) {
  const sb = h.createSandbox({ request: { url }, response: { status: 200, body: JSON.stringify(payload) } });
  const s = await h.runScript("Scripts/Keep.js", sb);
  return s.doneCalls[0];
}

// ── Ximalaya 辅助 ──
async function runXimalaya(h, url, payload) {
  const sb = h.createSandbox({ request: { url }, response: { status: 200, body: JSON.stringify(payload) } });
  const s = await h.runScript("Scripts/Ximalaya.js", sb);
  return s.doneCalls[0];
}

// ── Weibo 辅助 ──
async function runWeibo(h, url, payload) {
  const sb = h.createSandbox({ request: { url }, response: { status: 200, body: JSON.stringify(payload) } });
  const s = await h.runScript("Scripts/Weibo.js", sb);
  return s.doneCalls[0];
}

exports.tests = {
  // ══ Keep ══
  "keep: people/my — floatingInfo 清空, memberInfo 删除": async (a, h) => {
    const done = await runKeep(h, "https://api.gotokeep.com/people/my", {
      data: { floatingInfo: { text: "ad" }, memberInfo: { vip: true }, name: "test" },
    });
    const out = JSON.parse(done.body);
    a.equal(out.data.floatingInfo, {}, "floatingInfo 应清空");
    a.equal(out.data.memberInfo, undefined, "memberInfo 应删除");
    a.equal(out.data.name, "test", "其他字段保留");
  },
  "keep: start — data.status 置 true": async (a, h) => {
    const done = await runKeep(h, "https://api.gotokeep.com/start", { data: { status: false } });
    const out = JSON.parse(done.body);
    a.equal(out.data.status, true, "status 应置 true");
  },
  "keep: preview — detailSections 过滤 recommendation, extendInfo 改写": async (a, h) => {
    const done = await runKeep(h, "https://api.gotokeep.com/preview", {
      data: {
        detailSections: [
          { sectionType: "normal", content: "keep" },
          { sectionType: "recommendation", content: "ad" },
        ],
        extendInfo: { startEnable: false, hasPaid: false },
      },
    });
    const out = JSON.parse(done.body);
    a.equal(out.data.detailSections.length, 1, "recommendation 应被过滤");
    a.equal(out.data.detailSections[0].sectionType, "normal", "normal 保留");
    a.equal(out.data.extendInfo.startEnable, true, "startEnable 应置 true");
    a.equal(out.data.extendInfo.hasPaid, true, "hasPaid 应置 true");
  },
  "keep: twins/v4/feed/course — modules 过滤 homepageCommonContainer/homepageLive": async (a, h) => {
    const done = await runKeep(h, "https://api.gotokeep.com/twins/v4/feed/course", {
      data: {
        modules: [
          { code: "normal", name: "keep" },
          { code: "homepageCommonContainer", name: "ad1" },
          { code: "homepageLive", name: "ad2" },
        ],
      },
    });
    const out = JSON.parse(done.body);
    a.equal(out.data.modules.length, 1, "应只剩 1 个 module");
    a.equal(out.data.modules[0].code, "normal", "normal 保留");
  },
  "keep: config/v3/basic — defaultTab 改写, tabs 过滤, homeTabs 硬编码": async (a, h) => {
    const done = await runKeep(h, "https://api.gotokeep.com/config/v3/basic", {
      data: {
        bottomBarControl: {
          defaultTab: "discover",
          tabs: [
            { tabType: "home", name: "首页" },
            { tabType: "discover", name: "发现" },
            { tabType: "dynamic_sports", name: "运动" },
            { tabType: "personal", name: "我的" },
          ],
        },
        homeTabs: [{ type: "old" }],
      },
    });
    const out = JSON.parse(done.body);
    a.equal(out.data.bottomBarControl.defaultTab, "home", "defaultTab 应改为 home");
    a.equal(out.data.bottomBarControl.tabs.length, 3, "应保留 3 个 tab");
    a.equal(out.data.homeTabs.length, 2, "homeTabs 应硬编码为 2 项");
    a.equal(out.data.homeTabs[0].name, "推荐", "第一项应为推荐");
    a.equal(out.data.homeTabs[1].name, "会员", "第二项应为会员");
  },
  "keep: 未匹配 URL → $done() 无参放行": async (a, h) => {
    const done = await runKeep(h, "https://api.gotokeep.com/other/path", { data: "keep" });
    a.equal(done.body, undefined, "未匹配 URL 应无 body 返回");
  },

  // ══ Ximalaya ══
  "ximalaya: customCategories — 过滤 itemType 和 categoryId=1005": async (a, h) => {
    const done = await runXimalaya(h, "https://www.ximalaya.com/discovery-category/customCategories", {
      customCategoryList: [
        { itemType: "recommend", categoryId: 100, name: "推荐" },
        { itemType: "template_category", categoryId: 200, name: "模板" },
        { itemType: "single_category", categoryId: 300, name: "单项" },
        { itemType: "other", categoryId: 400, name: "其他" },
        { itemType: "recommend", categoryId: 1005, name: "广告" },
      ],
      defaultTabList: [
        { itemType: "recommend", categoryId: 100, name: "推荐" },
        { itemType: "other", categoryId: 1005, name: "广告" },
      ],
    });
    const out = JSON.parse(done.body);
    a.equal(out.customCategoryList.length, 3, "customCategoryList 应保留 3 项");
    a.equal(out.defaultTabList.length, 1, "defaultTabList 应保留 1 项");
    a.equal(out.defaultTabList[0].name, "推荐", "推荐保留");
  },
  "ximalaya: category — focusImages.data 过滤 isAd 和 realLink": async (a, h) => {
    const done = await runXimalaya(h, "https://www.ximalaya.com/discovery-category/v3/category", {
      focusImages: {
        data: [
          { realLink: "open://detail", isAd: false, name: "正常" },
          { realLink: "open://ad", isAd: true, name: "广告" },
          { realLink: "close://link", isAd: false, name: "关闭" },
        ],
      },
    });
    const out = JSON.parse(done.body);
    a.equal(out.focusImages.data.length, 1, "应只保留 1 项");
    a.equal(out.focusImages.data[0].name, "正常", "正常项保留");
  },
  "ximalaya: focusPic — header[0].item.list[0].data 过滤": async (a, h) => {
    const done = await runXimalaya(h, "https://www.ximalaya.com/focus-mobile/focusPic", {
      header: [{ item: { list: [{ data: [
        { realLink: "open://detail", isAd: false, name: "正常" },
        { realLink: "open://ad", isAd: true, name: "广告" },
      ] }] } }],
    });
    const out = JSON.parse(done.body);
    a.equal(out.header[0].item.list[0].data.length, 1, "应只保留 1 项");
    a.equal(out.header[0].item.list[0].data[0].name, "正常", "正常项保留");
  },
  "ximalaya: mix — header 长度 2 删 header[0], body 过滤广告/bigCard": async (a, h) => {
    const done = await runXimalaya(h, "https://www.ximalaya.com/discovery-feed/v3/mix", {
      header: [{ name: "删我" }, { name: "保留" }],
      body: [
        { item: { name: "正常" }, displayClass: "normal" },
        { item: { adInfo: {} }, displayClass: "normal" },
        { item: { moduleType: "mix_ad" }, displayClass: "normal" },
        { item: { name: "大卡" }, displayClass: "bigCard" },
      ],
    });
    const out = JSON.parse(done.body);
    a.equal(out.header.length, 2, "header 长度不变 (delete 置 undefined)");
    a.equal(out.header[0], null, "header[0] 应被 delete, JSON 序列化为 null");
    a.equal(out.header[1].name, "保留", "header[1] 保留");
    a.equal(out.body.length, 1, "body 应只剩 1 项");
    a.equal(out.body[0].item.name, "正常", "正常项保留");
  },
  "ximalaya: homePage — entrances 过滤保留 id∈{210,213,215}": async (a, h) => {
    const done = await runXimalaya(h, "https://www.ximalaya.com/mobile-user/v2/homePage", {
      data: { serviceModule: { entrances: [
        { id: 210, name: "历史" },
        { id: 213, name: "收藏" },
        { id: 215, name: "下载" },
        { id: 999, name: "广告" },
      ] } },
    });
    const out = JSON.parse(done.body);
    a.equal(out.data.serviceModule.entrances.length, 3, "应保留 3 项");
  },
  "ximalaya: 未匹配 URL → $done({}) 原样放行": async (a, h) => {
    const done = await runXimalaya(h, "https://www.ximalaya.com/other/path", { data: "keep" });
    a.equal(done.body, undefined, "未匹配 URL 应无 body 返回");
  },

  // ══ Weibo ══
  "weibo: isAd — 判断广告 (mblogtypename/promotion/page_info/content_auth)": async (a) => {
    a.equal(WEIBO.isAd({ mblogtypename: "广告" }), true, "mblogtypename=广告");
    a.equal(WEIBO.isAd({ mblogtypename: "热推" }), true, "mblogtypename=热推");
    a.equal(WEIBO.isAd({ promotion: { type: "ad" } }), true, "promotion.type=ad");
    a.equal(WEIBO.isAd({ page_info: { actionlog: { source: "ad" } } }), true, "page_info.actionlog.source=ad");
    a.equal(WEIBO.isAd({ content_auth_info: { content_auth_title: "广告" } }), true, "content_auth_title=广告");
    a.equal(WEIBO.isAd({ mblogtypename: "正常" }), false, "正常微博");
    a.equal(WEIBO.isAd(null), false, "null");
  },
  "weibo: removeTimeLine — 过滤 statuses, 删除 ad/advertises/trends/headers": async (a) => {
    const data = {
      ad: [{ id: 1 }],
      advertises: [{ id: 2 }],
      trends: [{ id: 3 }],
      headers: [{ id: 4 }],
      statuses: [
        { id: 10, text: "正常" },
        { id: 11, mblogtypename: "广告" },
        { id: 12, text: "另一条" },
        { id: 13, category: "group" },
      ],
    };
    WEIBO.handlers.removeTimeLine(data);
    a.equal(data.ad, undefined, "ad 应删除");
    a.equal(data.advertises, undefined, "advertises 应删除");
    a.equal(data.trends, undefined, "trends 应删除");
    a.equal(data.headers, undefined, "headers 应删除");
    a.equal(data.statuses.length, 2, "statuses 应保留 2 条");
    a.equal(data.statuses[0].id, 10, "正常微博保留");
    a.equal(data.statuses[1].id, 12, "另一条正常微博保留");
  },
  "weibo: removeHome — 个人页净化 (vipIcon/CreatorTask)": async (a) => {
    const data = {
      items: [
        { itemId: "profileme_mine", header: { vipIcon: "icon", vipView: "view" } },
        { itemId: "100505_-_newcreator", type: "list" },
        { itemId: "100505_-_chaohua", images: [{ itemId: "100505_-_chaohua" }, { itemId: "100505_-_manage" }] },
        { itemId: "other" },
      ],
    };
    const result = WEIBO.handlers.removeHome(data);
    a.equal(result.items.length, 2, "应保留 2 项");
    a.equal(result.items[0].itemId, "profileme_mine", "profileme_mine 保留");
    a.equal(result.items[0].header.vipIcon, undefined, "vipIcon 应删除");
    a.equal(result.items[0].header.vipView, null, "vipView 应置 null");
    a.equal(result.items[1].itemId, "100505_-_chaohua", "超话保留");
    a.equal(result.items[1].images.length, 1, "images 应过滤");
  },
  "weibo: removeSearch — 搜索页净化 (广告/推广/搜索窗)": async (a) => {
    const data = {
      items: [
        { category: "feed", data: { text: "正常" } },
        { category: "feed", data: { mblogtypename: "广告" } },
        { category: "group", header: { type: "normal" }, items: [
          { data: { card_type: 17, text: "卡片" } },
          { data: { card_type: 999, text: "过滤" } },
        ] },
        { category: "card", data: { itemid: "finder_window" } },
      ],
      loadedInfo: { searchBarContent: [1], headerBack: { channelStyleMap: { a: 1 } } },
    };
    const result = WEIBO.handlers.removeSearch(data);
    a.equal(result.items.length, 2, "应保留 2 项");
    a.equal(result.items[0].category, "feed", "正常 feed 保留");
    a.equal(result.items[1].category, "group", "group 保留");
    a.equal(result.items[1].items.length, 1, "group 内只保留 card_type=17");
    a.equal(result.loadedInfo.searchBarContent, [], "searchBarContent 应清空");
    a.equal(result.loadedInfo.headerBack.channelStyleMap, {}, "channelStyleMap 应清空");
  },
  "weibo: removeCards — 卡片列表净化 (card_group 过滤)": async (a) => {
    const data = {
      hotwords: [{ word: "热搜" }],
      cards: [
        { card_type: 9, mblog: { text: "正常" } },
        { card_type: 9, mblog: { mblogtypename: "广告" } },
        { card_type: 1007, text: "过滤" },
        { card_type: 1, card_group: [
          { card_type: 118, text: "过滤" },
          { card_type: 1, mblog: { text: "正常" } },
          { card_type: 1, mblog: { mblogtypename: "广告" } },
        ] },
      ],
    };
    WEIBO.handlers.removeCards(data);
    a.equal(data.hotwords, [], "hotwords 应清空");
    a.equal(data.cards.length, 2, "cards 应保留 2 项");
    a.equal(data.cards[0].card_type, 9, "正常 card_type=9 保留");
    a.equal(data.cards[1].card_group.length, 1, "card_group 应只保留 1 项");
    a.equal(data.cards[1].card_group[0].mblog.text, "正常", "正常项保留");
  },
  "weibo: removeAdPreload — 开屏时间戳过期": async (a) => {
    const data = {
      ads: [{ id: 1, start_time: 1000, end_time: 2000, display_duration: 10, daily_display_cnt: 5, total_display_cnt: 100 }],
      last_ad_show_interval: 100,
    };
    const result = WEIBO.handlers.removeAdPreload(data);
    a.equal(result.last_ad_show_interval, 86400, "last_ad_show_interval 应置 86400");
    a.equal(result.ads[0].start_time, 2681574400, "start_time 应过期");
    a.equal(result.ads[0].end_time, 2681660799, "end_time 应过期");
    a.equal(result.ads[0].display_duration, 0, "display_duration 应置 0");
    a.equal(result.ads[0].daily_display_cnt, 0, "daily_display_cnt 应置 0");
    a.equal(result.ads[0].total_display_cnt, 0, "total_display_cnt 应置 0");
  },
  "weibo: removeLuaScreenAds — Lua 开屏广告过期": async (a) => {
    const data = { cached_ad: { ads: [{ start_date: 1000, show_count: 5, duration: 10, end_date: 2000 }] } };
    const result = WEIBO.handlers.removeLuaScreenAds(data);
    a.equal(result.cached_ad.ads[0].start_date, 1893254400, "start_date 应过期");
    a.equal(result.cached_ad.ads[0].show_count, 0, "show_count 应置 0");
    a.equal(result.cached_ad.ads[0].duration, 0, "duration 应置 0");
    a.equal(result.cached_ad.ads[0].end_date, 1893340799, "end_date 应过期");
  },
  "weibo: removeRealtimeAd — 实时广告删除": async (a) => {
    const data = { ads: [{ id: 1 }], code: 200 };
    const result = WEIBO.handlers.removeRealtimeAd(data);
    a.equal(result.ads, undefined, "ads 应删除");
    a.equal(result.code, 4016, "code 应置 4016");
  },
  "weibo: getModifyMethod — URL 路由": async (a) => {
    a.equal(WEIBO.getModifyMethod("https://api.weibo.cn/2/statuses/friends/timeline"), "removeTimeLine", "时间线路由");
    a.equal(WEIBO.getModifyMethod("https://api.weibo.cn/2/cardlist"), "removeCards", "卡片路由");
    a.equal(WEIBO.getModifyMethod("https://api.weibo.cn/2/profile/me"), "removeHome", "个人页路由");
    a.equal(WEIBO.getModifyMethod("https://api.weibo.cn/2/other/path"), null, "未匹配返回 null");
  },
  "weibo: 完整请求 — 时间线净化": async (a, h) => {
    const done = await runWeibo(h, "https://api.weibo.cn/2/statuses/friends/timeline", {
      ad: [{ id: 1 }],
      statuses: [
        { id: 10, text: "正常" },
        { id: 11, mblogtypename: "广告" },
      ],
    });
    const out = JSON.parse(done.body);
    a.equal(out.ad, undefined, "ad 应删除");
    a.equal(out.statuses.length, 1, "statuses 应保留 1 条");
    a.equal(out.statuses[0].id, 10, "正常微博保留");
  },
};
