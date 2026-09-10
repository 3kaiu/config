/**
 * 酷我音乐去广告 v1.0
 * 作者：3kaiu
 *
 * 覆盖: 清空广告容器字段 (data/adlist/list/ads/adList) + 删除 banner 类字段
 * (顶层与 data 内各一层)。
 *
 * ⚠️ $response 守卫, 防止 AllInOne 全局 MitM 误触 request 阶段
 *
 * 2026-09-11 审计 (CODE-02): 本文件原为**单行 480 字节的压缩产物** — 与仓库里
 * 其余 26 个可读源文件不一致 (疑似把 build 产物回填成了源码)。此处仅还原可读性,
 * **行为逐条对齐原实现**; 产物由 `npm run build` 重新生成。
 */
const $ = new Env("酷我音乐");
if (typeof $response === "undefined") { $.done(); return; }

/** 清空为数组或对象: 数组→[], 其他真值→{} (保留字段本身, 避免客户端读到 undefined) */
const AD_CONTAINER_KEYS = ["data", "adlist", "list", "ads", "adList"];
/** 顶层直接删除的 banner 类字段 */
const BANNER_KEYS = ["banner", "bannerList", "banners", "topBanner", "bottomBanner"];
/** data 内层额外删除的字段 (含 adlist/ads, 与顶层口径不同 — 保持原语义) */
const DATA_BANNER_KEYS = ["banner", "bannerList", "banners", "adlist", "ads"];

try {
  const body = JSON.parse($response.body);

  // 原实现为 `s && (A, B, C)`, 即仅当 body 为真值时执行三步净化
  if (body) {
    // 1. 清空广告容器 (仅对真值生效 — 与原 `s[t] && (...)` 一致)
    for (const key of AD_CONTAINER_KEYS) {
      if (body[key]) body[key] = Array.isArray(body[key]) ? [] : {};
    }
    // 2. 删除顶层 banner 类字段
    for (const key of BANNER_KEYS) delete body[key];
    // 3. 删除 body.data 内的 banner 类字段 (仅当 data 为对象; 数组时 delete 命名属性为 no-op)
    if (body.data && typeof body.data === "object") {
      for (const key of DATA_BANNER_KEYS) delete body.data[key];
    }
  }

  $.done({ body: JSON.stringify(body) });
} catch (e) { $.done(); }
