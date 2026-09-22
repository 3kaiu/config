if (typeof $response === "undefined") { $done(); return; }

const reqUrl: string = (typeof $request !== "undefined" && $request && typeof ($request as any).url === "string")
  ? ($request as any).url as string
  : "";

const AD_KEYS: string[] = [
  "ad", "adlist", "ad_info", "ad_cont", "activity",
  "banner", "banner_list", "recommend", "promotion",
  "ad_callback", "ad_extra", "ad_ext", "ad_meta"
];

try {
  const obj: Record<string, unknown> = JSON.parse($response.body);

  // ── 端点特化净化 (2026-09-22 app2smile/js/tieba-json.js 交叉移植, P0/P1) ──
  // 移植原则: 只搬"广告机制开关类" (SDK 初始化/开屏协议/上报开关), 动作均为
  // 关开关/清空广告数组; 形态不对 (无字段/类型不符) 则静默跳过, 永不抛错。
  // P2 内容判断类 (outer_item/pb_banner/goods_info/直播帖过滤) 不搬 — 需真机定形。
  // lcs_strategy.conn_conf 不搬 — 那是传输通道切换 (socket vs HTTP), 非去广告。
  if (reqUrl.indexOf("c/f/ad/getSplashAd") >= 0) {
    // 开屏协议: error_code 置非零 + data 置空, 客户端跳过开屏
    if ((obj as any).error_code === 0 && "data" in obj) {
      (obj as any).error_code = 2230209;
      (obj as any).data = null;
    }
  } else if (reqUrl.indexOf("c/s/sync") >= 0) {
    // 右下角悬浮 icon (推广位)
    const floating = (obj as any).floating_icon;
    if (floating && typeof floating === "object") {
      (obj as any).floating_icon = null;
    }
    // 回帖栏广告配置
    const advCfg = (obj as any).advertisement_config;
    if (advCfg && typeof advCfg.advertisement_str === "string" && advCfg.advertisement_str) {
      (obj as any).advertisement_config = null;
    }
    // 广告 SDK 初始化总闸: 穿山甲/广点通/快手/百度百青藤/聚楹/Ubix/华为 + 百川开屏
    const switches = (obj as any).config && (obj as any).config.switch;
    if (Array.isArray(switches)) {
      const SDK_INITS = [
        "platform_csj_init", "platform_ks_init", "platform_gdt_init",
        "platform_baidu_bqt_init", "platform_jy_init", "platform_ubix_init",
        "platform_hw_init", "ad_baichuan_open",
      ];
      for (const item of switches) {
        if (item && typeof item === "object" && SDK_INITS.indexOf((item as any).name) >= 0 && (item as any).type !== "0") {
          (item as any).type = "0";
        }
      }
    }
    // 开屏小熊/序章/CPC 开关 (注: ad_stlog_switch 以 ad_ 开头, 通用 cleaner 已删, 无需单列)
    const sfd = (obj as any).screen_fill_data_result;
    if (sfd && typeof sfd === "object") {
      for (const k of ["screen_fill_advertisement_bear_switch", "screen_fill_advertisement_plj_cpc_switch", "screen_fill_advertisement_plj_switch"]) {
        if ((sfd as any)[k] === "1") (sfd as any)[k] = "0";
      }
    }
    // 广告 AB 实验总闸
    const abtest = (obj as any).cloud_control_data_info && (obj as any).cloud_control_data_info.common_config;
    if (abtest && typeof abtest.external_abtest_switch !== "undefined" && abtest.external_abtest_switch !== null) {
      abtest.external_abtest_switch = null;
    }
  }

  function clean(data: unknown, depth = 0): void {
    if (!data || typeof data !== "object") return;
    if (depth > 10) return;
    if (Array.isArray(data)) {
      for (const item of data) clean(item, depth + 1);
      return;
    }
    for (const key of Object.keys(data as Record<string, unknown>)) {
      if (AD_KEYS.includes(key)) {
        delete (data as Record<string, unknown>)[key];
      } else if (key.startsWith("ad_") || key.startsWith("ads_")) {
        delete (data as Record<string, unknown>)[key];
      } else {
        clean((data as Record<string, unknown>)[key], depth + 1);
      }
    }
  }

  clean(obj);
  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done();
}
