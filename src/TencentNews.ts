if (typeof $response === "undefined") { $done(); return; }

const reqUrl: string = (typeof $request !== "undefined" && $request && typeof ($request as any).url === "string")
  ? ($request as any).url as string
  : "";

try {
  const obj: any = JSON.parse($response.body);

  // ── 腾讯新闻 feed 去广告 (2026-09-22 app2smile/js/qq-news.js 交叉移植) ──
  // 只搬两类无歧义动作 (形态不对静默跳过): ① widget_list 按 widget_type==='ad_list'
  // 精确过滤 (event_detail/channel_feed); ② adList 置空 (开屏/精选 feed)。
  // 上游标记"弃用/待验证"的端点 (gw/event/list、getTwentyFourHourNews、
  // getQQNewsListItems、getQQNewsUnreadList) 一律不搬 — 需真机确认生死。
  if (reqUrl.indexOf("r.inews.qq.com/gw/page/event_detail") >= 0 ||
      reqUrl.indexOf("r.inews.qq.com/gw/page/channel_feed") >= 0) {
    const wl = obj && obj.data && obj.data.widget_list;
    if (Array.isArray(wl)) {
      obj.data.widget_list = wl.filter((w: any) => !w || w.widget_type !== "ad_list");
    }
  } else if (reqUrl.indexOf("news.ssp.qq.com/app") >= 0 ||
             reqUrl.indexOf("r.inews.qq.com/news_feed/hot_module_list") >= 0 ||
             reqUrl.indexOf("r.inews.qq.com/getTagFeedList") >= 0) {
    if (obj && "adList" in obj && obj.adList) {
      obj.adList = null;
    }
  }

  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done();
}
