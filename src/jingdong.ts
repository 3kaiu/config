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
 * ## 取证来源 (三源交叉验证, 2026-09-29)
 *
 * - fmz200/wool_scripts `Scripts/jingdong/jingdong.js` (主实现, 本文件字段口径与其一致)
 * - chxm1023/Advertising `Loon/AppAD.plugin` (京喜/京东金融开屏, 独立佐证 start 类接口存在)
 * - zqzess/rule_for_quantumultX `Loon/Plugin/AdBlock.plugin` (反例: 整条 reject, 不采纳)
 *
 * ## 处置面台账
 *
 * | functionId        | 处置   | 状态    | 说明 |
 * |-------------------|--------|---------|------|
 * | start             | purged | covered | 开屏图 images 置空 + showTimesDaily 归零, 业务配置保留 |
 * | welcomeHome       | purged | covered | 首页 floorList 过滤 6 类推广层, webViewFloorList 去推广 |
 * | myOrderInfo       | purged | covered | 订单 floors 过滤 bannerFloor/bpDynamicFloor/plusFloor |
 * | deliverLayer      | purged | covered | 物流 bannerInfo 删除 + 运费八折楼层过滤 |
 * | orderTrackBusiness| purged | covered | 同 deliverLayer (上游合并处理) |
 * | getTabHomeInfo    | purged | covered | 新品页 iconInfo / roofTop 删除 |
 * | personinfoBusiness| purged | covered | 个人页推广楼层过滤 |
 *
 * 未列入台账的 functionId 一律**原样放行** —— 本仓纪律要求「新增处置须逐个取证」,
 * 不因同域而批量照搬。
 */

/** 取 $request.url; 上游注入 */
const URL: string = $request.url;

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

/** 安全删字段: 父级不存在时静默跳过, 绝不抛 */
function drop(obj: any, path: string): void {
  const keys = path.split(".");
  const last = keys.pop() as string;
  const parent = keys.length ? pick(obj, keys.join(".")) : obj;
  if (parent && typeof parent === "object") delete parent[last];
}

/** 数组按谓词过滤; 非数组静默跳过 */
function rejectList(obj: any, path: string, bad: readonly string[]): void {
  const arr = pick(obj, path);
  if (Array.isArray(arr)) {
    const parentPath = path.split(".").slice(0, -1).join(".");
    const key = path.split(".").pop() as string;
    const parent = parentPath ? pick(obj, parentPath) : obj;
    parent[key] = arr.filter((it: any) => !bad.includes(it?.mId ?? it?.type));
  }
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

function handle(o: any): void {
  switch (functionIdOf(URL)) {
    // 开屏: 只清广告字段, 启动配置(images 之外的同响应字段)全部保留。
    // images 存在但不是数组 ⇒ 响应结构已不符合预期, 此时**整条放行**: 半改比不改更危险
    // (客户端拿不到 images 却又看到 showTimesDaily=0, 行为不可预期)。
    case "start": {
      if (o?.images !== undefined && !Array.isArray(o.images)) return;
      if (Array.isArray(o?.images)) o.images = [];
      if (o?.showTimesDaily) o.showTimesDaily = 0;
      break;
    }

    // 首页配置: 按 type 过滤推广图层
    case "welcomeHome": {
      rejectList(o, "floorList", HOME_AD_TYPES);
      drop(o, "topBgImgBig");
      // 下拉二楼内的推广 webView
      const wv = o?.webViewFloorList;
      if (Array.isArray(wv)) {
        o.webViewFloorList = wv.filter(
          (it: any) => !HOME_AD_TYPES.includes(it?.type) && it?.type !== "ad"
        );
      }
      break;
    }

    // 订单页: 过滤推广楼层
    case "myOrderInfo": {
      rejectList(o, "floors", ORDER_AD_FLOORS);
      break;
    }

    // 物流页: 寄快递八折横幅 + 运费八折楼层
    case "deliverLayer":
    case "orderTrackBusiness": {
      drop(o, "bannerInfo");
      rejectList(o, "floors", ["banner", "jdDeliveryBanner"]);
      break;
    }

    // 新品页: 悬浮动图 / 下拉二楼
    case "getTabHomeInfo": {
      drop(o, "result.iconInfo");
      drop(o, "result.roofTop");
      break;
    }

    // 个人中心: 推广楼层
    case "personinfoBusiness": {
      rejectList(o, "floors", ["adFloor", "bannerFloor", "promotionFloor"]);
      break;
    }

    // 未取证接口: 原样放行 (不猜)
    default:
      break;
  }
}

/** 入口: 非 JSON 或解析失败一律原样放行, 绝不因异常打断 App */
try {
  const body = $response.body;
  if (body) {
    const obj = JSON.parse(body);
    handle(obj);
    $done({ body: JSON.stringify(obj) });
  } else {
    $done({});
  }
} catch {
  $done({});
}
