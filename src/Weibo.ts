/**
 * 微博去广告 Pro v2.0
 * 作者：3kaiu (基于 ddgksf2013/weibo_json.js 忠实移植, 上游 zmqcherish)
 *
 * $response.body 为 JSON, 按 URL 路径分发到 30+ handler 函数:
 *   modifyCardsUrls     → removeCards (卡片列表)
 *   modifyStatusesUrls  → removeTimeLine (信息流)
 *   otherUrls           → 20+ 路径映射到具体 handler
 *
 * mainConfig 控制各功能开关 (全部默认 true/按上游默认值)
 * itemMenusConfig 控制微博详情页菜单项
 *
 * 核心清洗:
 *   isAd               判断广告 (mblogtypename/promotion/page_info/content_auth)
 *   removeTimeLine      过滤 statuses, 删除 ad/advertises/trends/headers
 *   removeHome          个人页: 去 vipIcon/CreatorTask, 保留 profileme_mine 等
 *   removeSearch/Main   搜索页: 去广告/推广/搜索窗/热词
 *   removeCards         卡片列表: 去广告 card_group
 *   removeAdPreload     开屏时间戳过期 (start=2681574400)
 *   removeLua/PhpScreenAds 开屏广告
 *   itemExtendHandler   详情页: 去相关推荐/好物/关注/打赏 + 菜单裁剪
 */

// ════════════════════════════════════════
// ⚙️ 配置
// ════════════════════════════════════════
const mainConfig: any = {
  isDebug: false, author: "ddgksf2013",
  removeHomeVip: true, removeHomeCreatorTask: true,
  removeRelate: true, removeGood: true, removeFollow: true, modifyMenus: true,
  removeRelateItem: false, removeRecommendItem: true, removeRewardItem: true,
  removeLiveMedia: true, removeNextVideo: false, removePinedTrending: true,
  removeInterestFriendInTopic: false, removeInterestTopic: false,
  removeInterestUser: true, removeLvZhou: true, removeSearchWindow: true,
  profileSkin1: null, profileSkin2: null, tabIconVersion: 0, tabIconPath: "",
};

const itemMenusConfig: Record<string, boolean> = {
  creator_task: false, mblog_menus_custom: false,
  mblog_menus_video_later: true, mblog_menus_comment_manager: true,
  mblog_menus_avatar_widget: false, mblog_menus_card_bg: false,
  mblog_menus_long_picture: true, mblog_menus_delete: true,
  mblog_menus_edit: true, mblog_menus_edit_history: true,
  mblog_menus_edit_video: true, mblog_menus_sticking: true,
  mblog_menus_open_reward: true, mblog_menus_novelty: false,
  mblog_menus_favorite: true, mblog_menus_promote: true,
  mblog_menus_modify_visible: true, mblog_menus_copy_url: true,
  mblog_menus_follow: true, mblog_menus_video_feedback: true,
  mblog_menus_shield: true, mblog_menus_report: true,
  mblog_menus_apeal: true, mblog_menus_home: true,
};

const modifyCardsUrls = ["/cardlist", "video/community_tab", "searchall"];
const modifyStatusesUrls = [
  "statuses/friends/timeline", "statuses_unread_hot_timeline",
  "statuses/unread_friends_timeline", "statuses/unread_hot_timeline",
  "groups/timeline", "statuses/friends_timeline",
];
const otherUrls: Record<string, string> = {
  "/profile/me": "removeHome",
  "/statuses/extend": "itemExtendHandler",
  "/video/remind_info": "removeVideoRemind",
  "/checkin/show": "removeCheckin",
  "/live/media_homelist": "removeMediaHomelist",
  "/container_detail": "removeComments",
  "/container/get_item": "containerHandler",
  "/profile/container_timeline": "userHandler",
  "/video/tiny_stream_video_list": "nextVideoHandler",
  "/2/statuses/video_mixtimeline": "nextVideoHandler",
  "video/tiny_stream_mid_detail": "nextVideoHandler",
  "/!/client/light_skin": "tabSkinHandler",
  "/littleskin/preview": "skinPreviewHandler",
  "/search/finder": "removeSearchMain",
  "/search/container_timeline": "removeSearch",
  "/search/container_discover": "removeSearch",
  "/2/flowpage": "removeMsgAd",
  "/2/page?": "removePage",
  "/statuses/unread_topic_timeline": "topicHandler",
  "/square&pageDataType/": "squareHandler",
  "/statuses/container_timeline_topic": "removeMain",
  "/statuses/container_timeline": "removeMainTab",
  "wbapplua/wbpullad.lua": "removeLuaScreenAds",
  "interface/sdk/sdkad.php": "removePhpScreenAds",
  "a=trends": "removeTopics",
  "user_center": "modifiedUserCenter",
  "a=get_coopen_ads": "removeIntlOpenAds",
  "php?a=search_topic": "removeSearchTopic",
  "ad/realtime": "removeRealtimeAd",
  "ad/preload": "removeAdPreload",
  "php?a=open_app": "removeAdBanner",
};

// ════════════════════════════════════════
// 🔍 方法查找
// ════════════════════════════════════════
function getModifyMethod(url: string): string | null {
  for (const u of modifyCardsUrls) if (url.indexOf(u) !== -1) return "removeCards";
  for (const u of modifyStatusesUrls) if (url.indexOf(u) !== -1) return "removeTimeLine";
  for (const [k, v] of Object.entries(otherUrls)) if (url.indexOf(k) !== -1) return v;
  return null;
}

// ════════════════════════════════════════
// 🧹 核心函数
// ════════════════════════════════════════
function isAd(obj: any): boolean {
  if (!obj) return false;
  return (
    obj.mblogtypename === "广告" ||
    obj.mblogtypename === "热推" ||
    obj.promotion?.type === "ad" ||
    obj.page_info?.actionlog?.source === "ad" ||
    obj.content_auth_info?.content_auth_title === "广告"
  );
}

function log(msg: string): void {
  if (mainConfig.isDebug) console.log(msg);
}

function isBlock(obj: any): boolean {
  const blockIds: any[] = mainConfig.blockIds || [];
  if (blockIds.length === 0) return false;
  const id = obj.user.id;
  for (const bid of blockIds) if (bid == id) return true;
  return false;
}

// ── 信息流 ──
function lvZhouHandler(obj: any): void {
  if (mainConfig.removeLvZhou && obj && obj.common_struct) {
    const arr: any[] = [];
    for (const o of obj.common_struct) if (o.name !== "绿洲") arr.push(o);
    obj.common_struct = arr;
  }
}

function removeTimeLine(data: any): void {
  for (const k of ["ad", "advertises", "trends", "headers"]) if (data[k]) delete data[k];
  if (data.statuses) {
    const t: any[] = [];
    for (const o of data.statuses) {
      if (isAd(o)) continue;
      lvZhouHandler(o);
      if (o.common_struct) delete o.common_struct;
      if (o.category && o.category === "group") continue;
      t.push(o);
    }
    data.statuses = t;
  }
}

// ── 个人页 ──
function removeHomeVip(item: any): any {
  if (item.header && item.header.vipView) item.header.vipView = null;
  return item;
}

function updateFollowOrder(item: any): void {
  try {
    for (const t of item.items) {
      if (t.itemId === "mainnums_friends") {
        const a = t.click.modules[0].scheme;
        t.click.modules[0].scheme = a.replace("231093_-_selfrecomm", "231093_-_selffollowed");
        log("updateFollowOrder success");
        return;
      }
    }
  } catch (e) { console.log("updateFollowOrder fail"); }
}

function updateProfileSkin(data: any, key: string): void {
  try {
    const skin = mainConfig[key];
    if (skin) {
      let idx = 0;
      for (const item of data.items) {
        if (item.image) {
          try {
            if (item.image.style.darkMode !== "alpha") item.image.style.darkMode = "alpha";
            item.image.iconUrl = skin[idx++];
            if (item.dot) item.dot = [];
          } catch (e) { /* skip */ }
        }
      }
      log("updateProfileSkin success");
    }
  } catch (e) { console.log("updateProfileSkin fail"); }
}

function removeHome(data: any): any {
  if (data.items) {
    const kept: any[] = [];
    for (const item of data.items) {
      const id = item.itemId;
      if (id === "profileme_mine") {
        if (mainConfig.removeHomeVip) removeHomeVip(item);
        if (item.header?.vipIcon) delete item.header.vipIcon;
        updateFollowOrder(item);
        kept.push(item);
      } else if (id === "100505_-_top8") {
        updateProfileSkin(item, "profileSkin1");
        kept.push(item);
      } else if (id === "100505_-_newcreator") {
        if (item.type === "grid") {
          updateProfileSkin(item, "profileSkin2");
          kept.push(item);
        } else if (!mainConfig.removeHomeCreatorTask) {
          kept.push(item);
        }
      } else if (id === "100505_-_chaohua" || id === "100505_-_manage" || id === "100505_-_recentlyuser") {
        if (item.images?.length > 0) {
          item.images = item.images.filter(
            (e: any) => e.itemId === "100505_-_chaohua" || e.itemId === "100505_-_recentlyuser"
          );
        }
        kept.push(item);
      }
    }
    data.items = kept;
  }
  return data;
}

// ── 搜索 ──
function checkSearchWindow(item: any): boolean {
  if (!mainConfig.removeSearchWindow) return false;
  if (item.category !== "card") return false;
  const d = item.data || {};
  return (
    d.itemid === "finder_window" || d.itemid === "discover_gallery" || d.itemid === "more_frame" ||
    d.card_type === 208 || d.card_type === 236 || d.card_type === 247 ||
    d.card_type === 217 || d.card_type === 101 || d.card_type === 19 ||
    d.mblog?.page_info?.actionlog?.source?.includes("ad") ||
    d.pic?.includes("ads")
  );
}

function removeHeader(headerData: any): any {
  if (headerData.items) {
    const kept: any[] = [];
    for (const item of headerData.items) {
      if (item.category === "group") {
        item.items = item.items
          .filter((e: any) => e.data?.card_type === undefined || e.data?.card_type === 101 || e.data?.card_type === 17)
          .map((e: any) => { if (e.data?.card_type === 17) e.data.col = 1; return e; });
        if (item.items.length > 0) kept.push(item);
      }
    }
    log("remove Header success");
    headerData.items = kept;
  }
  return headerData;
}

function removeSearch(data: any): any {
  if (data.items) {
    const kept: any[] = [];
    for (const item of data.items) {
      if (item.category === "feed") {
        if (!isAd(item.data)) {
          if (item.data?.page_info?.video_limit) delete item.data.page_info.video_limit;
          kept.push(item);
        }
      } else if (item.category === "group") {
        if (item.header?.type === "guess" && item.itemExt?.filterType !== "search") continue;
        item.items = item.items
          .filter((e: any) =>
            (e.data?.card_type === undefined || e.data?.card_type === 17 || e.data?.card_type === 10) &&
            e.data?.content_auth_info?.content_auth_title !== "广告"
          )
          .map((e: any) => { if (e.data?.card_type === 17) e.data.col = 1; return e; });
        if (item.items.length > 0) kept.push(item);
      } else if (!checkSearchWindow(item)) {
        kept.push(item);
      }
    }
    data.items = kept;
    if (data.loadedInfo) {
      data.loadedInfo.searchBarContent = [];
      if (data.loadedInfo.headerBack) data.loadedInfo.headerBack.channelStyleMap = {};
    }
    log("remove_search success");
  }
  return data;
}

function removeSearchMain(data: any): any {
  const channels = data.channelInfo?.channels;
  if (channels) {
    const kept: any[] = [];
    for (const ch of channels) {
      if (ch.payload) {
        if (ch.payload.items) ch.payload.items = [];
        if (ch.payload.loadedInfo?.searchBarContent) ch.payload.loadedInfo.searchBarContent = [{}];
        if (ch.payload.loadedInfo?.headerBack) ch.payload.loadedInfo.headerBack.channelStyleMap = {};
        delete ch.titleInfoAbsorb;
        delete ch.titleInfo;
        delete ch.title;
      }
      kept.push(ch);
    }
    data.channelInfo.channels = kept;
    if (data.header?.data) removeHeader(data.header.data);
    if (data.channelInfo?.moreChannels) {
      delete data.channelInfo.moreChannels;
      delete data.channelInfo.channelConfig;
    }
    log("remove_search main success");
  }
  return data;
}

// ── 卡片 ──
function removeCards(data: any): void {
  if (data.hotwords) data.hotwords = [];
  if (data.cards) {
    const kept: any[] = [];
    for (const card of data.cards) {
      if (data.cardlistInfo?.containerid === "232082type=1" && card.card_type !== 17 && card.card_type !== 58 && card.card_type !== 11) {
        // pass through
      }
      const cardGroup = card.card_group;
      if (cardGroup && cardGroup.length > 0) {
        const items: any[] = [];
        for (const n of cardGroup) {
          if (n.card_type === 118 || isAd(n.mblog)) continue;
          if (JSON.stringify(n).indexOf("res_from:ads") !== -1) continue;
          items.push(n);
        }
        card.card_group = items;
        kept.push(card);
      } else {
        const ct = card.card_type;
        if ([9, 165].indexOf(ct) !== -1) {
          if (!isAd(card.mblog)) kept.push(card);
        } else if ([1007, 180].indexOf(ct) === -1) {
          kept.push(card);
        }
      }
    }
    data.cards = kept;
  }
  if (data.items) {
    log("data.items");
    removeSearch(data);
  }
}

// ── 详情页 ──
function itemExtendHandler(data: any): void {
  if ((mainConfig.removeRelate || mainConfig.removeGood) && data.trend?.titles) {
    const title = data.trend.titles.title;
    if ((mainConfig.removeRelate && title === "相关推荐") || (mainConfig.removeGood && title === "博主好物种草")) {
      delete data.trend;
    }
  }
  if (mainConfig.removeFollow && data.follow_data) data.follow_data = null;
  if (mainConfig.removeRewardItem && data.reward_info) data.reward_info = null;
  if (data.head_cards) delete data.head_cards;
  if (data.page_alerts) data.page_alerts = null;
  try {
    if (data.trend.extra_struct.extBtnInfo.btn_picurl.indexOf("timeline_icon_ad_delete") !== -1) {
      delete data.trend;
    }
  } catch (e) { /* skip */ }
  if (mainConfig.modifyMenus && data.custom_action_list) {
    const arr: any[] = [];
    for (const action of data.custom_action_list) {
      const type = action.type;
      const val = itemMenusConfig[type];
      if (val === undefined) { arr.push(action); }
      else if (type === "mblog_menus_copy_url") { arr.unshift(action); }
      else if (val) { arr.push(action); }
    }
    data.custom_action_list = arr;
  }
}

// ── 超话 ──
function topicHandler(data: any): any {
  const cards = data.cards;
  if (cards && ((mainConfig as any).removeUnfollowTopic || (mainConfig as any).removeUnusedPart)) {
    const kept: any[] = [];
    for (const card of cards) {
      let keep = true;
      if (card.mblog) {
        const buttons = card.mblog.buttons;
        if ((mainConfig as any).removeUnfollowTopic && buttons && buttons[0].type === "follow") keep = false;
      } else {
        if (!(mainConfig as any).removeUnusedPart) continue;
        if (card.itemid === "bottom_mix_activity") keep = false;
        else if (card.top?.title === "正在活跃") keep = false;
        else if (card.card_type === 200 && card.group) keep = false;
        else {
          const cg = card.card_group;
          if (!cg) continue;
          const first = cg[0];
          if (["guess_like_title", "cats_top_title", "chaohua_home_readpost_samecity_title"].indexOf(first.itemid) !== -1) keep = false;
          else if (cg.length > 1) {
            const filtered: any[] = [];
            for (const n of cg) {
              if (["chaohua_discovery_banner_1", "bottom_mix_activity"].indexOf(n.itemid) === -1) filtered.push(n);
            }
            card.card_group = filtered;
          }
        }
      }
      if (keep) kept.push(card);
    }
    data.cards = kept;
    log("topicHandler success");
  }
  return data;
}

// ── 消息流 ──
function removeMsgAd(data: any): any {
  if (data.items) {
    const kept: any[] = [];
    for (const item of data.items) {
      if (item.itemId === "hotword") {
        item.items = item.items.filter((e: any) => e?.data?.pic?.includes("com/wb_search"));
        kept.push(item);
      } else if (item.type === "text" && item?.text?.content?.includes("实时热点")) {
        kept.push(item);
      }
    }
    data.items = kept;
    if (data.channelInfo) delete data.channelInfo;
    log("remove_search success");
  }
  return data;
}

// ── 页面 ──
function removePage(data: any): any {
  removeCards(data);
  if (mainConfig.removePinedTrending && data.cards && data.cards.length > 0 && data.cards[0].card_group) {
    data.cards[0].card_group = data.cards[0].card_group.filter(
      (e: any) => !(e?.actionlog?.ext?.includes("ads_word") || e?.itemid?.includes("t:51") || e?.itemid?.includes("ads_word"))
    );
  }
  return data;
}

// ── 容器/用户/视频 ──
function removeComments(data: any): void {
  const blockList = ["广告", "廣告", "相关内容", "推荐", "热推", "推薦", "荐读"];
  if (data.pageHeader) {
    data.pageHeader.data.items = data.pageHeader.data.items.filter((e: any) => e.category === "detail");
  }
  const items = data.items || [];
  if (items.length !== 0) {
    const kept: any[] = [];
    for (const item of items) {
      const adType = item.data.adType || "";
      if (blockList.indexOf(adType) === -1 && item.data.card_type !== 6 && item.data.card_type !== 236) {
        kept.push(item);
      }
    }
    log("remove 评论区相关和推荐内容");
    data.items = kept;
    if (data.tip_msg) delete data.tip_msg;
  }
}

function containerHandler(data: any): void {
  if (mainConfig.removeInterestFriendInTopic && data.card_type_name === "超话里的好友") {
    log("remove 超话里的好友");
    data.card_group = [];
  }
  if (mainConfig.removeInterestTopic && data.itemid) {
    if (data.itemid.indexOf("infeed_may_interest_in") !== -1) {
      log("remove 感兴趣的超话");
      data.card_group = [];
    } else if (data.itemid.indexOf("infeed_friends_recommend") !== -1) {
      log("remove 超话好友关注");
      data.card_group = [];
    }
  }
}

function userHandler(data: any): any {
  data = removeMainTab(data);
  if (mainConfig.removeInterestUser && data.items) {
    const kept: any[] = [];
    for (const item of data.items) {
      let keep = true;
      if (item.category === "group") {
        try {
          if (item.items[0].data.desc === "可能感兴趣的人") keep = false;
        } catch (e) { /* skip */ }
      }
      if (keep) {
        if (item.data?.common_struct) delete item.data.common_struct;
        kept.push(item);
      }
    }
    data.items = kept;
    log("removeMain sub success");
  }
  return data;
}

function nextVideoHandler(data: any): any {
  if (data.statuses) {
    const kept: any[] = [];
    for (const item of data.statuses) {
      if (isAd(item)) continue;
      for (const k of ["forward_redpacket_info", "shopping", "float_info", "tags"]) {
        if (item.video_info?.[k]) delete item.video_info[k];
      }
      kept.push(item);
    }
    data.statuses = kept;
    log("removeMainTab Success");
  }
  return data;
}

// ── 主题/Tab ──
function removeMainTab(data: any): any {
  if (data.loadedInfo?.headers) delete data.loadedInfo.headers;
  if (data.items) {
    const kept: any[] = [];
    for (const item of data.items) {
      if (isAd(item.data)) continue;
      if (item.data?.page_info?.video_limit) delete item.data.page_info.video_limit;
      if (item.data?.common_struct) delete item.data.common_struct;
      if (item.category === "group" && JSON.stringify(item.items).indexOf("profile_top") === -1) continue;
      kept.push(item);
    }
    data.items = kept;
    log("removeMainTab success");
  }
  return data;
}

function removeMain(data: any): any {
  if (data.loadedInfo?.headers) delete data.loadedInfo.headers;
  if (data.items) {
    const kept: any[] = [];
    for (const item of data.items) {
      if (item.category === "feed") {
        if (!isAd(item.data)) kept.push(item);
      } else if (item.category === "group") {
        if (item.items.length > 0 && item.items[0].data?.itemid?.includes("search_input")) {
          item.items = item.items.filter(
            (e: any) => e?.data?.itemid?.includes("mine_topics") || e?.data?.itemid?.includes("search_input") || e?.data?.card_type === 202
          );
          item.items[0].data.hotwords = [{ word: "搜索超话", tip: "" }];
          kept.push(item);
        } else if (item.items.length > 0 && item.items[0].data?.itemid?.includes("top_title")) {
          // skip
        } else {
          if (item.items.length > 0) {
            item.items = Object.values(item.items).filter(
              (e: any) => e.category === "feed" || e.category === "card"
            );
          }
          kept.push(item);
        }
      } else if (item.data?.card_type && [202, 200].indexOf(item.data.card_type) !== -1) {
        // skip
      } else {
        kept.push(item);
      }
    }
    data.items = kept;
    log("removeMain success");
  }
  return data;
}

function squareHandler(data: any): any {
  return data.items;
}

// ── 小功能 ──
function removeCheckin(data: any): void {
  log("remove tab1签到");
  data.show = 0;
}

function removeMediaHomelist(data: any): void {
  if (mainConfig.removeLiveMedia) {
    log("remove 首页直播");
    data.data = {};
  }
}

function removeVideoRemind(data: any): void {
  data.bubble_dismiss_time = 0;
  data.exist_remind = false;
  data.image_dismiss_time = 0;
  data.image = "";
  data.tag_image_english = "";
  data.tag_image_english_dark = "";
  data.tag_image_normal = "";
  data.tag_image_normal_dark = "";
}

function tabSkinHandler(data: any): void {
  try {
    const ver = mainConfig.tabIconVersion;
    data.data.canUse = 1;
    if (ver && mainConfig.tabIconPath && ver >= 100) {
      for (const item of data.data.list) {
        item.version = ver;
        item.downloadlink = mainConfig.tabIconPath;
      }
      log("tabSkinHandler success");
    }
  } catch (e) { log("tabSkinHandler fail"); }
}

function skinPreviewHandler(data: any): void {
  data.data.skin_info.status = 1;
}

// ── 开屏广告 ──
function removeLuaScreenAds(data: any): any {
  if (data.cached_ad) {
    for (const ad of data.cached_ad.ads) {
      ad.start_date = 1893254400;
      ad.show_count = 0;
      ad.duration = 0;
      ad.end_date = 1893340799;
    }
  }
  return data;
}

function removePhpScreenAds(data: any): any {
  if (data.ads) {
    data.show_push_splash_ad = false;
    data.background_delay_display_time = 0;
    data.lastAdShow_delay_display_time = 0;
    data.realtime_ad_video_stall_time = 0;
    data.realtime_ad_timeout_duration = 0;
    for (const ad of data.ads) {
      ad.displaytime = 0;
      ad.displayintervel = 86400;
      ad.allowdaydisplaynum = 0;
      ad.displaynum = 0;
      ad.displaytime = 1;
      ad.begintime = "2029-12-30 00:00:00";
      ad.endtime = "2029-12-30 23:59:59";
    }
  }
  return data;
}

function removeAdPreload(data: any): any {
  if (data.ads) {
    data.last_ad_show_interval = 86400;
    for (const ad of data.ads) {
      ad.start_time = 2681574400;
      ad.end_time = 2681660799;
      ad.display_duration = 0;
      ad.daily_display_cnt = 0;
      ad.total_display_cnt = 0;
    }
  }
  return data;
}

function removeRealtimeAd(data: any): any {
  delete data.ads;
  data.code = 4016;
  return data;
}

function removeAdBanner(data: any): any {
  if (data.data?.close_ad_setting) delete data.data.close_ad_setting;
  if (data.data?.detail_banner_ad) data.data.detail_banner_ad = [];
  return data;
}

function removeIntlOpenAds(data: any): any {
  if (data.data) data.data = { display_ad: 1 };
  return data;
}

function removeSearchTopic(data: any): any {
  if (data.data && data.data.search_topic?.cards?.length !== 0) {
    data.data.search_topic.cards = Object.values(data.data.search_topic.cards)
      .filter((e: any) => e.type !== "searchtop");
    if (data.data.trending_topic) delete data.data.trending_topic;
  }
  return data;
}

function modifiedUserCenter(data: any): any {
  if (data.data && data.data.length !== 0 && data.data.cards) {
    data.data.cards = Object.values(data.data.cards)
      .filter((e: any) => e.items[0].type !== "personal_vip");
  }
  return data;
}

function removeTopics(data: any): any {
  if (data.data) data.data.order = ["search_topic"];
  return data;
}

// ════════════════════════════════════════
// 📋 handler 调度表
// ════════════════════════════════════════
const handlers: Record<string, (data: any) => any> = {
  removeHome, itemExtendHandler, removeVideoRemind, removeCheckin,
  removeMediaHomelist, removeComments, containerHandler, userHandler,
  nextVideoHandler, tabSkinHandler, skinPreviewHandler, removeSearchMain,
  removeSearch, removeMsgAd, removePage, topicHandler, squareHandler,
  removeMain, removeMainTab, removeLuaScreenAds, removePhpScreenAds,
  removeTopics, modifiedUserCenter, removeIntlOpenAds, removeSearchTopic,
  removeRealtimeAd, removeAdPreload, removeAdBanner, removeCards, removeTimeLine,
};

// ════════════════════════════════════════
// 🚪 入口: Node 测试导出 / Loon 运行时
// ════════════════════════════════════════
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    mainConfig, itemMenusConfig, handlers, getModifyMethod,
    isAd, removeTimeLine, removeHome, removeSearch, removeSearchMain,
    removeCards, removeAdPreload, removeLuaScreenAds, removePhpScreenAds,
    removeRealtimeAd, removeIntlOpenAds, removeAdBanner, removeSearchTopic,
    modifiedUserCenter, removeTopics, removeMainTab, removeMain,
    squareHandler, removeMsgAd, removePage, topicHandler, removeComments,
    containerHandler, userHandler, nextVideoHandler, itemExtendHandler,
    removeCheckin, removeMediaHomelist, removeVideoRemind,
    tabSkinHandler, skinPreviewHandler, lvZhouHandler, checkSearchWindow,
    removeHomeVip, updateFollowOrder, updateProfileSkin,
    isBlock, log,
  };
} else {
  try {
    let body = $response.body;
    const url = $request.url;
    const method = getModifyMethod(url);
    if (method) {
      log(method);
      const func = handlers[method];
      let data = JSON.parse(body.match(/\{.*\}/)![0]);
      const result = func(data);
      if (result !== undefined) data = result;
      body = JSON.stringify(data);
      if (method === "removePhpScreenAds") body = JSON.stringify(data) + "OK";
    }
    $done({ body });
  } catch (e) {
    console.log("[Weibo Clean] " + e);
    $done({ body: $response.body });
  }
}
