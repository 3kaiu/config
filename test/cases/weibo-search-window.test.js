/**
 * 微博「搜索窗」广告卡片判定精准度 (不误杀 / 不遗漏)
 *
 * checkSearchWindow 的补盲启发式: card_type/itemid 白名单之外, 靠
 * actionlog.source 与 pic 的**值级**标记识别广告卡片。
 *
 * 2026-09-21 修复: 值级判定原为裸子串 `source.includes("ad")` / `pic.includes("ads")`
 *   — `source === "android"` 含 "ad"、图片 URL 含 "padstation"/"xada" 都会被误判。
 *   改为 lib/ad 注入的 hasKeySegment **词段**判定: 整段等于 "ad"/"ads" 才命中,
 *   "head_ad"/"feed_ad_click" 这类复合标记仍命中, 覆盖不缩、误杀消除。
 *   判定口径与信息流 isAd 的精确 source === "ad" 一致。
 */
"use strict";

const W = require("../../Scripts/Weibo.js");

function card(overrides) {
  return { category: "card", data: { card_type: 0, ...overrides } };
}

exports.tests = {
  "weibo search-window: source='android' 不误杀 (含 ad 子串)": async (a) => {
    W.mainConfig.removeSearchWindow = true;
    const item = card({ mblog: { page_info: { actionlog: { source: "android" } } } });
    a.equal(W.checkSearchWindow(item), false, "android 是正常设备来源, 不得判为广告");
  },
  "weibo search-window: source='addon' 不误杀 (非词段)": async (a) => {
    W.mainConfig.removeSearchWindow = true;
    const item = card({ mblog: { page_info: { actionlog: { source: "addon" } } } });
    a.equal(W.checkSearchWindow(item), false, "addon 正常字段不得判为广告");
  },
  "weibo search-window: pic URL 含 padstation/xada 不误杀 (ad 子串但非词段)": async (a) => {
    W.mainConfig.removeSearchWindow = true;
    const item = card({ pic: "https://wx1.sinaimg.cn/orj360/padstation/img.jpg" });
    const item2 = card({ pic: "https://wx1.sinaimg.cn/orj360/xada/img.jpg" });
    a.equal(W.checkSearchWindow(item), false, "padstation 是图片 CDN 路径, 不得误杀");
    a.equal(W.checkSearchWindow(item2), false, "xada 是图片 CDN 路径, 不得误杀");
  },
  "weibo search-window: source='ad' 命中 (核心广告标记)": async (a) => {
    W.mainConfig.removeSearchWindow = true;
    const item = card({ mblog: { page_info: { actionlog: { source: "ad" } } } });
    a.equal(W.checkSearchWindow(item), true, "source=ad 是广告卡");
  },
  "weibo search-window: 复合标记 head_ad / feed_ad_click 仍命中 (不缩覆盖)": async (a) => {
    W.mainConfig.removeSearchWindow = true;
    a.equal(W.checkSearchWindow(card({ mblog: { page_info: { actionlog: { source: "head_ad" } } } })), true);
    a.equal(W.checkSearchWindow(card({ mblog: { page_info: { actionlog: { source: "feed_ad_click" } } } })), true);
  },
  "weibo search-window: pic URL 含 /ads/ 路径词段 命中": async (a) => {
    W.mainConfig.removeSearchWindow = true;
    const item = card({ pic: "https://wx1.sinaimg.cn/orj360/ads/g1.jpg" });
    a.equal(W.checkSearchWindow(item), true, "/ads/ 是广告图片路径段");
  },
  "weibo search-window: itemid finder_window / card_type 208 白名单路径仍工作": async (a) => {
    W.mainConfig.removeSearchWindow = true;
    a.equal(W.checkSearchWindow(card({ itemid: "finder_window" })), true);
    a.equal(W.checkSearchWindow(card({ card_type: 208 })), true);
  },
  "weibo search-window: removeSearchWindow=false 时短路, 不判广告": async (a) => {
    W.mainConfig.removeSearchWindow = false;
    const item = card({ mblog: { page_info: { actionlog: { source: "ad" } } } });
    a.equal(W.checkSearchWindow(item), false, "功能关闭时不判广告");
    W.mainConfig.removeSearchWindow = true;
  },
};