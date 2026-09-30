/**
 * 京东 App 广告净化 (M2 广告治理, L4 字段级)。
 *
 * ## 为什么必须字段级, 不能整条 reject
 *
 * 京东 `api.m.jd.com/client.action?functionId=start` 同时下发**启动配置与开屏图**。
 * 整条 `reject` / `reject-array` 会致白屏 —— 这是本仓已犯过的错, 且有独立上游
 * 佐证: zqzess/rule_for_quantumultX 对同一接口用 `reject-array` 整条拒, 而
 * fmz200/wool_scripts 用 `obj.images = []` 只清开屏图字段。
 * 两个独立上游在同一接口上分叉, 方向与本仓教训一致 ⇒ 字段级是正解。
 *
 * 官方《广告面治理纪律》: 「一个接口既下发业务数据又下发广告, 就不能整条拒」。
 * 本文件对**所有** functionId 一律走 delete / filter / 字段改值, 无一例外。
 *
 * ## 取证来源 (2026-09-30 扩面)
 *
 * - fmz200/wool_scripts `Scripts/jingdong/jingdong.js` —— 主实现(字段口径基准):
 *   `personinfoBusiness` 的**完整**楼层清单、`basefloorinfo`/`orderIdFloor`/`userinfo`
 *   楼层内字段、以及**新版把楼层挪到 `obj.others.floors`** 这条路径(本文件此前完全没有覆盖)。
 * - zbsdsb/loon-adblock-plugins `JD_remove_ads_v2.js` —— **新协议证据**: 京东 App
 *   **15.9.50+ 响应体 base64 化**(该插件 2026-08-12 标注"已验证"), 且 functionId 藏进
 *   base64 POST body ⇒ URL 上取不到 functionId, 必须走"解码 → 按内容特征清洗 → 按原格式回写"。
 *   单来源, 但采纳它是**防御性加法**: 解析失败时行为与改动前逐字节一致(原样放行), 无回归面。
 * - aoconch/jd-simplify-loon `CAPTURE.md` —— 抓包方法学与 JD 域清单(其 `ccfjma.m.c.m.jd.com`
 *   一类主机 2026-09-30 实测已是 nginx 默认页, 未采纳为规则, 见插件头注释)。
 *
 * ## 处置面台账
 *
 * | functionId        | 处置   | 状态    | 说明 |
 * |-------------------|--------|---------|------|
 * | start             | purged | covered | 开屏图 images 置空 + showTimesDaily 归零, 业务配置保留 |
 * | welcomeHome       | purged | covered | 首页 floorList 过滤推广层, webViewFloorList 去推广 |
 * | myOrderInfo       | purged | covered | 订单 floors 过滤 bannerFloor/bpDynamicFloor/plusFloor |
 * | deliverLayer      | purged | covered | 物流 bannerInfo 删除 + 运费八折楼层过滤 |
 * | orderTrackBusiness| purged | covered | 同 deliverLayer (上游合并处理) |
 * | getTabHomeInfo    | purged | covered | 新品页 iconInfo / roofTop 删除 |
 * | personinfoBusiness| purged | covered | 我的页 floors **与 others.floors** 双路径: 8 类推广楼层 +
 * |                   |        |         | basefloorinfo 弹窗/横幅/动图 + orderIdFloor 评价提醒 + userinfo plus 卡 |
 * | (base64 响应)     | purged | covered | 15.9.50+ 新协议: 解码后按同一套字段特征清洗, 再按原格式回写 |
 *
 * 未列入台账的 functionId 且**响应内不含任何已知广告字段** ⇒ 原样放行(不猜、不改写)。
 */

/** 取 $request.url; 上游注入 */
const URL: string = $request.url;

/** 响应体超过此长度直接放行: 京东 basicConfig 一类大响应无清洗点, 解析它是纯浪费 */
const MAX_BODY = 2000000;

/** functionId 查询参数; 不含 query 的请求返回空串 */
function functionIdOf(url: string): string {
  const q = url.indexOf("?");
  if (q < 0) return "";
  const hit = /[?&]functionId=([^&]+)/.exec(url.slice(q));
  return hit ? hit[1] : "";
}

/** 安全取嵌套字段 */
function pick(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

/** 安全删字段: 父级不存在时静默跳过, 绝不抛。返回是否真的改了 */
function drop(obj: any, path: string): boolean {
  const keys = path.split(".");
  const last = keys.pop() as string;
  const parent = keys.length ? pick(obj, keys.join(".")) : obj;
  if (parent && typeof parent === "object" && last in parent) {
    delete parent[last];
    return true;
  }
  return false;
}

/** 数组按 mId/type 过滤; 非数组静默跳过。返回是否真的改了 */
function rejectList(obj: any, path: string, bad: readonly string[]): boolean {
  const arr = pick(obj, path);
  if (!Array.isArray(arr)) return false;
  const parentPath = path.split(".").slice(0, -1).join(".");
  const key = path.split(".").pop() as string;
  const parent = parentPath ? pick(obj, parentPath) : obj;
  const kept = arr.filter((it: any) => !bad.includes(it?.mId ?? it?.type));
  if (kept.length === arr.length) return false;
  parent[key] = kept;
  return true;
}

/** 首页推广层类型 (fmz200 同款口径; "recommend" 上游自己注释掉, 保留业务推荐) */
const HOME_AD_TYPES = [
  "bottomXview", // 底部悬浮通栏推广
  "float", // 悬浮推广小圆图
  "photoCeiling", // 顶部通栏动图推广
  "ruleFloat", // 资质与规则
  "searchIcon", // 右上角消费券
  "topRotate", // 左上角 logo
  "tabBarAtmosphere", // 底部悬浮通栏推广
];

/** 订单页推广楼层 (满意度评分 / 专属权益 / 开通会员 —— 会员入口属商业位非广告) */
const ORDER_AD_FLOORS = ["bannerFloor", "bpDynamicFloor", "plusFloor"];

/**
 * 我的页推广楼层 (fmz200 完整清单)。
 * 上游注释掉的 iconToolFloor(底部工具栏)/keyToolsFloor(浏览记录)/newWalletIdFloor(我的钱包)
 * /orderIdFloor(我的订单) **不在**黑名单里 —— 它们是功能入口不是广告, 删了就是破功能。
 */
const PERSON_AD_FLOORS = [
  "bigSaleFloor", // 双十一
  "buyOften", // 常买常逛
  "newAttentionCard", // 关注的频道
  "newBigSaleFloor", // 双十一
  "newStyleAttentionCard", // 新版关注的频道
  "newsFloor", // 京东快讯
  "noticeFloor", // 顶部横幅
  "recommendfloor", // 我的推荐
];

/** 我的页楼层内的广告字段(按 mId 定位, 避免误伤同名业务字段) */
function cleanPersonFloor(floor: any): boolean {
  const d = floor?.data;
  if (!d || typeof d !== "object") return false;
  let ch = false;
  switch (floor.mId) {
    case "basefloorinfo": // 弹窗 / 底部会员续费横幅 / 右下角动图
      ch = drop(d, "commonPopup") || ch;
      ch = drop(d, "commonPopup_dynamic") || ch;
      if (Array.isArray(d.commonTips) && d.commonTips.length) {
        d.commonTips = [];
        ch = true;
      }
      if (Array.isArray(d.commonWindows) && d.commonWindows.length) {
        d.commonWindows = [];
        ch = true;
      }
      ch = drop(d, "floatLayer") || ch;
      break;
    case "orderIdFloor": // 发布评价提醒
      if (Array.isArray(d?.commentRemindInfo?.infos) && d.commentRemindInfo.infos.length) {
        d.commentRemindInfo.infos = [];
        ch = true;
      }
      break;
    case "userinfo": // 开通 plus 会员卡片
      ch = drop(d, "newPlusBlackCard") || ch;
      break;
    default:
      break;
  }
  return ch;
}

/** 我的页楼层数组清洗(floors 与 others.floors 是两代结构, 都要过) */
function cleanPersonFloors(o: any): boolean {
  let ch = false;
  for (const path of ["floors", "others.floors"]) {
    const arr = pick(o, path);
    if (!Array.isArray(arr) || !arr.length) continue;
    const kept: any[] = [];
    for (const floor of arr) {
      if (floor && PERSON_AD_FLOORS.includes(floor.mId)) {
        ch = true; // 该楼层整层是推广 ⇒ 直接丢
        continue;
      }
      if (cleanPersonFloor(floor)) ch = true;
      kept.push(floor);
    }
    if (kept.length !== arr.length || ch) {
      const parentPath = path.split(".").slice(0, -1).join(".");
      const key = path.split(".").pop() as string;
      const parent = parentPath ? pick(o, parentPath) : o;
      if (parent) parent[key] = kept;
    }
  }
  return ch;
}

/**
 * 按 functionId 处置(老协议: functionId 在 URL 上)。
 * 每个 case 的判据与取舍见上方台账; 返回是否发生了实际改动(没改就不回写, 少一次序列化风险)。
 */
function handle(o: any): boolean {
  let ch = false;
  switch (functionIdOf(URL)) {
    // 开屏: 只清广告字段, 启动配置(images 之外的同响应字段)全部保留。
    // images 存在但不是数组 ⇒ 响应结构已不符合预期, 此时**整条放行**: 半改比不改更危险
    // (客户端拿不到 images 却又看到 showTimesDaily=0, 行为不可预期)。
    case "start": {
      if (o?.images !== undefined && !Array.isArray(o.images)) return false;
      if (Array.isArray(o?.images) && o.images.length) {
        o.images = [];
        ch = true;
      }
      if (o?.showTimesDaily) {
        o.showTimesDaily = 0;
        ch = true;
      }
      return ch;
    }

    // 首页配置: 按 type 过滤推广图层
    case "welcomeHome": {
      ch = rejectList(o, "floorList", HOME_AD_TYPES) || ch;
      ch = drop(o, "topBgImgBig") || ch;
      // 下拉二楼内的推广 webView
      const wv = o?.webViewFloorList;
      if (Array.isArray(wv)) {
        const kept = wv.filter((it: any) => !HOME_AD_TYPES.includes(it?.type) && it?.type !== "ad");
        if (kept.length !== wv.length) {
          o.webViewFloorList = kept;
          ch = true;
        }
      }
      return ch;
    }

    // 订单页: 过滤推广楼层
    case "myOrderInfo":
      return rejectList(o, "floors", ORDER_AD_FLOORS);

    // 物流页: 寄快递八折横幅 + 运费八折楼层
    case "deliverLayer":
    case "orderTrackBusiness":
      ch = drop(o, "bannerInfo") || ch;
      ch = rejectList(o, "floors", ["banner", "jdDeliveryBanner"]) || ch;
      return ch;

    // 新品页: 悬浮动图 / 下拉二楼
    case "getTabHomeInfo":
      ch = drop(o, "result.iconInfo") || ch;
      ch = drop(o, "result.roofTop") || ch;
      return ch;

    // 我的页: 推广楼层 + 楼层内广告字段 (floors 与 others.floors 两代结构)
    case "personinfoBusiness":
      return cleanPersonFloors(o);

    // 未取证接口: 原样放行 (不猜)
    default:
      return false;
  }
}

/**
 * 新协议 (京东 15.9.50+): functionId 藏进 base64 POST body, URL 上取不到 ⇒ 只能按
 * **内容特征**清洗。比 functionId 派发更保守的做法: 每个字段都要求"广告专有形状"才动
 * (mId 名单 / type 名单 / showTimesDaily 与 images 同时出现), 一处不符即原样放行。
 */
function handleByContent(o: any): boolean {
  let ch = false;

  // 开屏配置: 以 showTimesDaily 为形状标记 —— 只有开屏配置同时带 images 与展示次数,
  // 单独见到 images 数组不能动(商品图集也是 images, 清了就是破功能)
  if (o?.showTimesDaily !== undefined) {
    if (Array.isArray(o.images) && o.images.length) {
      o.images = [];
      ch = true;
    }
    if (o.showTimesDaily) {
      o.showTimesDaily = 0;
      ch = true;
    }
  }

  ch = rejectList(o, "floorList", HOME_AD_TYPES) || ch;
  const wv = o?.webViewFloorList;
  if (Array.isArray(wv)) {
    const kept = wv.filter((it: any) => !HOME_AD_TYPES.includes(it?.type) && it?.type !== "ad");
    if (kept.length !== wv.length) {
      o.webViewFloorList = kept;
      ch = true;
    }
  }

  // 订单/物流/我的页的 floors 结构: mId 名单本身就是形状标记(这些 mId 只出现在这些页面)
  ch = rejectList(o, "floors", [...ORDER_AD_FLOORS, ...PERSON_AD_FLOORS, "banner", "jdDeliveryBanner"]) || ch;
  ch = cleanPersonFloors(o) || ch;

  // 订单/物流页的横幅: 要求同响应里存在 floors(这些页面的共同形状), 避免误伤同名业务字段
  if (Array.isArray(o?.floors) && "bannerInfo" in (o ?? {})) ch = drop(o, "bannerInfo") || ch;

  ch = drop(o, "result.iconInfo") || ch;
  ch = drop(o, "result.roofTop") || ch;

  return ch;
}

// ── base64 工具 (纯 JS, 不依赖 atob/btoa/TextDecoder —— Loon 运行时里它们不一定存在) ──
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function b64DecodeBytes(str: string): number[] {
  const s = str.replace(/\s+/g, "").replace(/=+$/, "");
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const c = B64.indexOf(s[i]);
    if (c === -1) continue;
    buf = (buf << 6) | c;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return out;
}

function bytesToUtf8(bytes: number[]): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode.apply(null, bytes.slice(i, i + 8192) as any);
  }
  try {
    return decodeURIComponent(escape(s));
  } catch {
    return s;
  }
}

function utf8ToBytes(s: string): string {
  return unescape(encodeURIComponent(s));
}

function b64EncodeStr(str: string): string {
  const bytes = utf8ToBytes(str);
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const c1 = bytes.charCodeAt(i++) & 0xff;
    const c2 = i < bytes.length ? bytes.charCodeAt(i++) & 0xff : NaN;
    const c3 = i < bytes.length ? bytes.charCodeAt(i++) & 0xff : NaN;
    out += B64[c1 >> 2];
    out += B64[((c1 & 3) << 4) | ((isNaN(c2) ? 0 : c2) >> 4)];
    out += isNaN(c2) ? "=" : B64[((c2 & 15) << 2) | ((isNaN(c3) ? 0 : c3) >> 6)];
    out += isNaN(c3) ? "=" : B64[c3 & 63];
  }
  return out;
}

/** 形似 base64 才尝试解码: 纯 base64 字符集 + 长度 4 的倍数(社区 v2 同判据) */
function looksBase64(s: string): boolean {
  return /^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0;
}

/** 入口: 任何异常一律原样放行, 绝不因脚本问题打断 App */
try {
  const body: string = $response.body;
  if (!body || typeof body !== "string" || body.length > MAX_BODY) {
    $done({});
  } else {
    let obj: any = null;
    let isB64 = false;

    try {
      obj = JSON.parse(body);
    } catch {
      // 新协议: 响应体整体 base64
      if (looksBase64(body)) {
        try {
          obj = JSON.parse(bytesToUtf8(b64DecodeBytes(body)));
          isB64 = true;
        } catch {
          obj = null;
        }
      }
    }

    if (!obj || typeof obj !== "object") {
      $done({});
    } else {
      const fid = functionIdOf(URL);
      let changed = false;
      let target = obj;

      if (isB64) {
        // 新协议: 解一层 {code,data:{}}(社区 v2 口径), 再按内容特征清洗
        if (!Array.isArray(obj) && obj.data && typeof obj.data === "object") target = obj.data;
        changed = handleByContent(target);
      } else {
        changed = handle(obj);
      }

      if (!changed) $done({});
      else $done({ body: isB64 ? b64EncodeStr(JSON.stringify(obj)) : JSON.stringify(obj) });
    }
  }
} catch {
  $done({});
}
