/**
 * 京东去广告 Pro v1.0
 * 作者：3kaiu (移植 iKeLee/RuCu6 JD_remove_ads.js + fmz200/wool_scripts jingdong.js)
 *
 * 覆盖京东主 App 的开屏 + 功能广告通道 (api.m.jd.com/client.action?functionId=...):
 *   start              开屏广告     → images=[] / showTimesDaily=0
 *   welcomeHome        首页配置     → 底部通栏/悬浮圆图/顶部动图/右上角券/左上角logo/下拉二楼
 *   personinfoBusiness 我的         → 大促楼层/常买常逛/快讯/顶部横幅/我的推荐 + 全局弹窗
 *   myOrderInfo        我的订单     → banner/动态/PLUS 楼层 + 服务中心「精选特惠」+ 客服引导
 *   getTabHomeInfo     新品页       → 悬浮动图 / 下拉二楼
 *   deliverLayer       物流         → bannerInfo / 运费八折楼层
 *   orderTrackBusiness 物流         → 同上
 *
 * 为什么不把 start 交给 startup-adblock-pro 的 reject-200:
 *   `start` 不是纯广告接口 (与 queryMaterialAdverts 下发的是启动配置 + 开屏两部分),
 *   整条 reject-200 会让京东丢失启动配置 → 白屏/卡启动。本脚本只清 images/showTimesDaily,
 *   保留其余字段。startup 层已通过 YIELDED_TO_OWNER 放弃该条 (见 tools/build-startup-plugin.mjs)。
 *
 * 守卫策略 (对齐 Zhihu v1.3 审计标准): 每个字段访问前精确判定形状 + 顶层 try/catch。
 *   任何异常 → $done({}) 原样放行。脚本抛错而不调 $done 会让 Loon 请求挂死。
 */

// $request 守卫: cron / 误挂 request 阶段时裸访问抛 ReferenceError
if (typeof $request === "undefined") { $done(); return; }
if (typeof $response === "undefined") { $done(); return; }
if (!$response.body) { $done({}); return; }

const $ = new Env("京东去广告");
const url: string = $request.url;

/** 取 functionId 查询参数 (京东主 App 所有广告通道都走 client.action?functionId=) */
function functionIdOf(u: string): string {
  const m = /[?&]functionId=([^&]+)/.exec(u);
  return m ? decodeURIComponent(m[1]) : "";
}

// ── 形状守卫 ──────────────────────────────────────────────────────────────
// 京东客户端版本迭代频繁, 字段可能缺失 / 换名 / 类型变化。任何一处假设失败都必须
// 静默跳过而非抛错, 否则整条请求挂死 (Zhihu v1.3 审计实证的同型故障)。

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** 删除 record 上的若干键 (缺键时静默跳过) */
function dropKeys(rec: Record<string, unknown>, keys: string[]): void {
  for (const k of keys) delete rec[k];
}

/** 从 floor 数组中滤除指定 mId; 非数组时原样返回 */
function dropFloors(floors: unknown, dropIds: string[]): unknown {
  if (!Array.isArray(floors)) return floors;
  return asArray(floors).filter((f) => {
    const r = asRecord(f);
    return !r || dropIds.indexOf(String(r.mId)) === -1;
  });
}

/** 我的页面: 顶层弹窗/横幅类字段清空 (commonPopup/commonWindows/commonTips/floatLayer) */
function scrubBaseInfo(floors: unknown): void {
  for (const f of asArray(floors)) {
    const r = asRecord(f);
    if (!r) continue;
    if (r.mId === "basefloorinfo") {
      const d = asRecord(r.data);
      if (!d) continue;
      dropKeys(d, ["commonPopup", "commonPopup_dynamic", "floatLayer"]);
      d.commonTips = [];
      d.commonWindows = [];
    } else if (r.mId === "orderIdFloor") {
      // 发布评价提醒 (orderIdFloor.data.commentRemindInfo.infos 三层都需守卫)
      const d = asRecord(r.data);
      const remind = asRecord(d && d.commentRemindInfo);
      if (remind) remind.infos = [];
    } else if (r.mId === "userinfo") {
      // 底部 PLUS 开通/续费卡片
      const d = asRecord(r.data);
      if (d) delete d.newPlusBlackCard;
    }
  }
}

const fid = functionIdOf(url);
let obj: Record<string, unknown> | null = null;

try {
  const parsed: unknown = JSON.parse($response.body);
  obj = asRecord(parsed);
  if (!obj) { $.done({}); return; }

  switch (fid) {
    // ── 开屏广告 ──────────────────────────────────────────────────────────
    // images = 开屏图列表; showTimesDaily = 每日展示次数上限。
    // 置 0 而非删 key: 客户端读不到 images 会走异常分支, 空数组才是"有配置但无广告"。
    case "start": {
      if (Array.isArray(obj.images)) obj.images = [];
      if (obj.showTimesDaily !== undefined) obj.showTimesDaily = 0;
      break;
    }

    // ── 首页配置 ──────────────────────────────────────────────────────────
    // floorList[].type 判型; 刻意保留 recommend ("为你推荐") —— 它是商品瀑布流主体,
    // 删掉首页就空了。webViewFloorList = 下拉二楼 (整块清空)。
    case "welcomeHome": {
      const delTypes = [
        "bottomXview",       // 底部悬浮通栏推广
        "float",             // 悬浮推广小圆图
        "photoCeiling",      // 顶部通栏动图推广
        "ruleFloat",         // 资质与规则
        "searchIcon",        // 右上角消费券
        "topRotate",         // 左上角 logo
        "tabBarAtmosphere",  // 底部悬浮通栏推广 (新版)
      ];
      if (Array.isArray(obj.floorList)) {
        obj.floorList = asArray(obj.floorList).filter((f) => {
          const r = asRecord(f);
          return !r || delTypes.indexOf(String(r.type)) === -1;
        });
      }
      if (Array.isArray(obj.webViewFloorList)) obj.webViewFloorList = [];
      break;
    }

    // ── 我的 ──────────────────────────────────────────────────────────────
    // 2024-04 起京东把「我的」楼层搬到 obj.others.floors, obj.floors 是旧路径 ——
    // 两条路径都要处理, 否则新版客户端净化完全失效。
    case "personinfoBusiness": {
      const delIds = [
        "bigSaleFloor",          // 大促楼层
        "buyOften",              // 常买常逛
        "newAttentionCard",      // 关注的频道
        "newBigSaleFloor",       // 大促楼层 (新版)
        "newStyleAttentionCard", // 关注的频道 (新版)
        "newsFloor",             // 京东快讯
        "noticeFloor",           // 顶部横幅
        "recommendfloor",        // 我的推荐
      ];
      for (const p of [obj.floors, asRecord(obj.others) ? (obj.others as Record<string, unknown>).floors : undefined]) {
        const next = dropFloors(p, delIds);
        if (next !== p) {
          if (p === obj.floors) obj.floors = next;
          else (obj.others as Record<string, unknown>).floors = next;
        }
        scrubBaseInfo(next);
      }
      break;
    }

    // ── 我的订单 ──────────────────────────────────────────────────────────
    case "myOrderInfo": {
      const delIds = [
        "bannerFloor",        // 满意度评分横幅
        "bpDynamicFloor",     // 专属权益
        "plusFloor",          // 开通会员
      ];
      if (Array.isArray(obj.floors)) {
        const kept = [];
        for (const f of asArray(obj.floors)) {
          const r = asRecord(f);
          if (!r || delIds.indexOf(String(r.mId)) === -1) {
            // 服务中心: 「精选特惠」是广告位, 其余服务入口保留
            if (r && r.mId === "virtualServiceCenter") {
              const d = asRecord(r.data);
              if (d && Array.isArray(d.virtualServiceCenters)) {
                for (const c of asArray(d.virtualServiceCenters)) {
                  const cr = asRecord(c);
                  const list = cr && Array.isArray(cr.serviceList) ? cr.serviceList : null;
                  if (!cr || !list) continue;
                  cr.serviceList = list.filter((s) => {
                    const sr = asRecord(s);
                    return !sr || sr.serviceTitle !== "精选特惠";
                  });
                }
              }
            }
            // 客户服务: 「点此获得更多服务」引导
            if (r && r.mId === "customerServiceFloor") {
              const d = asRecord(r.data);
              if (d && d.moreText !== undefined) {
                dropKeys(d, ["moreIcon", "moreIcon_dark"]);
                d.moreText = " ";
              }
            }
            kept.push(f);
          }
        }
        obj.floors = kept;
      }
      break;
    }

    // ── 新品页 ────────────────────────────────────────────────────────────
    case "getTabHomeInfo": {
      const result = asRecord(obj.result);
      if (result) dropKeys(result, ["iconInfo", "roofTop"]);
      break;
    }

    // ── 物流 (deliverLayer / orderTrackBusiness 共用一套结构) ─────────────
    case "deliverLayer":
    case "orderTrackBusiness": {
      delete obj.bannerInfo;
      obj.floors = dropFloors(obj.floors, ["banner", "jdDeliveryBanner"]);
      break;
    }

    default:
      // 未登记的 functionId: 不改写, 原样放行
      $.done({});
      return;
  }

  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  // 任何异常一律原样放行 —— 抛错而不 $done 会让该请求在 Loon 侧挂死
  console.log("京东去广告异常, 原样放行: " + String(e));
  $done({});
}
