/**
 * 航旅纵横去广告 Pro v1.0
 * 作者：3kaiu (基于 ddgksf2013/umetrip.ads.js 忠实移植)
 *
 * $response.bodyBytes 为 protobuf 报文, 按 rpid (请求头 rpid 或 protobuf field5) 分发:
 *   EMPTY_RPIDS {1000019,1420002,1120000} → 顶层 field7 替换为 EMPTY_PAYLOAD
 *   1000002 首页 cleanHomePayload      1000029 瀑布流 cleanWaterfallPayload
 *   1370126 行程 banner                1370279 家庭守护 cleanFamilyMessage
 *   1011058 历史 cleanHistoryPayload   1100001 我的 cleanMinePayload
 *   1060060 航班 cleanFlightPayload
 * 无改动或异常 → $done() 原样放行
 */

const EMPTY_RPIDS = new Set(["1000019", "1420002", "1120000"]);
const HOME_RPID = "1000002";
const WATERFALL_RPID = "1000029";
const TRIP_BANNER_RPID = "1370126";
const FAMILY_RPID = "1370279";
const HISTORY_RPID = "1011058";
const MINE_RPID = "1100001";
const FLIGHT_RPID = "1060060";
const EMPTY_PAYLOAD = new Uint8Array([10, 0, 16, 0, 32, 0]);

// ════════════════════════════════════════
// 🧬 protobuf  wire 级读写
// ════════════════════════════════════════
interface PbField { field: number; wire: number; raw: Uint8Array; data?: Uint8Array; dirty?: boolean }

function readVarint(buf: Uint8Array, pos: number): { value: number; pos: number } | null {
  let value = 0, shift = 0;
  while (pos < buf.length && shift <= 56) {
    const b = buf[pos++];
    value += (b & 127) * Math.pow(2, shift);
    if ((b & 128) === 0) return { value, pos };
    shift += 7;
  }
  return null;
}
function encodeVarint(value: number): Uint8Array {
  const out: number[] = [];
  let v = value;
  while (v >= 128) { out.push((v % 128) | 128); v = Math.floor(v / 128); }
  out.push(v);
  return new Uint8Array(out);
}
function concatBytes(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
function parseMessage(buf: Uint8Array): PbField[] | null {
  try {
    let pos = 0;
    const fields: PbField[] = [];
    while (pos < buf.length) {
      const start = pos;
      const key = readVarint(buf, pos);
      if (!key) return null;
      const kv = key.value;
      pos = key.pos;
      const field = Math.floor(kv / 8), wire = kv & 7;
      if (field === 0 || ![0, 1, 2, 5].includes(wire)) return null;
      if (wire === 0) {
        const v = readVarint(buf, pos);
        if (!v) return null;
        pos = v.pos;
        fields.push({ field, wire, raw: buf.slice(start, pos) });
        continue;
      }
      if (wire === 1) {
        if (pos + 8 > buf.length) return null;
        pos += 8;
        fields.push({ field, wire, raw: buf.slice(start, pos) });
        continue;
      }
      if (wire === 5) {
        if (pos + 4 > buf.length) return null;
        pos += 4;
        fields.push({ field, wire, raw: buf.slice(start, pos) });
        continue;
      }
      const lenV = readVarint(buf, pos);
      if (!lenV) return null;
      const len = lenV.value;
      pos = lenV.pos;
      if (len < 0 || pos + len > buf.length) return null;
      const data = buf.slice(pos, pos + len);
      pos += len;
      fields.push({ field, wire, raw: buf.slice(start, pos), data, dirty: false });
    }
    return fields;
  } catch (e) {
    return null;
  }
}
function encodeMessage(fields: PbField[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const f of fields) {
    if (f.wire === 2 && f.dirty) {
      parts.push(encodeVarint(f.field * 8 + 2));
      parts.push(encodeVarint(f.data!.length));
      parts.push(f.data!);
    } else {
      parts.push(f.raw);
    }
  }
  return concatBytes(parts);
}

// ════════════════════════════════════════
// 🔤 字节/字符串工具
// ════════════════════════════════════════
function utf8Bytes(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) out.push(c);
    else if (c < 2048) { out.push(0xc0 | (c >> 6)); out.push(0x80 | (c & 63)); }
    else if (c >= 55296 && c <= 56319 && i + 1 < str.length) {
      const c2 = str.charCodeAt(++i);
      c = 65536 + ((c - 55296) << 10) + (c2 - 56320);
      out.push(0xf0 | (c >> 18)); out.push(0x80 | ((c >> 12) & 63)); out.push(0x80 | ((c >> 6) & 63)); out.push(0x80 | (c & 63));
    } else {
      out.push(0xe0 | (c >> 12)); out.push(0x80 | ((c >> 6) & 63)); out.push(0x80 | (c & 63));
    }
  }
  return new Uint8Array(out);
}
function bytesToUtf8(bytes: Uint8Array): string | null {
  if (typeof TextDecoder !== "undefined") {
    try { return new TextDecoder("utf-8").decode(bytes); } catch (e) { /* fallback */ }
  }
  let s = "", i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 128) s += String.fromCharCode(b);
    else if ((b & 224) === 192) {
      if (i >= bytes.length) return null;
      const b2 = bytes[i++];
      s += String.fromCharCode(((b & 31) << 6) | (b2 & 63));
    } else if ((b & 240) === 224) {
      if (i + 1 >= bytes.length) return null;
      const b2 = bytes[i++], b3 = bytes[i++];
      s += String.fromCharCode(((b & 15) << 12) | ((b2 & 63) << 6) | (b3 & 63));
    } else {
      if ((b & 248) !== 240 || i + 2 >= bytes.length) return null;
      const b2 = bytes[i++], b3 = bytes[i++], b4 = bytes[i++];
      let cp = ((b & 7) << 18) | ((b2 & 63) << 12) | ((b3 & 63) << 6) | (b4 & 63);
      cp -= 65536;
      s += String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023));
    }
  }
  return s;
}
function bytesContains(haystack: Uint8Array, needle: Uint8Array | string): boolean {
  const n = typeof needle === "string" ? utf8Bytes(needle) : needle;
  if (!n.length || n.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (haystack[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}
function containsAny(haystack: Uint8Array, needles: string[]): boolean {
  for (const n of needles) if (bytesContains(haystack, n)) return true;
  return false;
}
function bytesEqualAscii(bytes: Uint8Array | undefined, ascii: string): boolean {
  if (!bytes || bytes.length !== ascii.length) return false;
  for (let i = 0; i < ascii.length; i++) if (bytes[i] !== ascii.charCodeAt(i)) return false;
  return true;
}
function directFieldEqualsAscii(fields: PbField[] | null, field: number, ascii: string): boolean {
  return !!fields && fields.some(f => f.field === field && f.wire === 2 && bytesEqualAscii(f.data, ascii));
}
function directFieldAscii(fields: PbField[] | null, field: number): string | null {
  if (!fields) return null;
  for (const f of fields) {
    if (f.field !== field || f.wire !== 2) continue;
    let s = "";
    for (const b of f.data!) {
      if (b < 32 || b > 126) return null;
      s += String.fromCharCode(b);
    }
    return s;
  }
  return null;
}

// ════════════════════════════════════════
// ✂️ 报文改写原语
// ════════════════════════════════════════
type CleanResult = { bytes: Uint8Array; count: number };
type Matcher = (field: number, data: Uint8Array, sub: PbField[] | null) => boolean;

function replaceTopField7(bytes: Uint8Array, payload: Uint8Array): CleanResult {
  const fields = parseMessage(bytes);
  if (!fields) return { bytes, count: 0 };
  let hit = false;
  for (const f of fields) {
    if (f.field === 7 && f.wire === 2) { f.data = payload; f.dirty = true; hit = true; }
  }
  return { bytes: hit ? encodeMessage(fields) : bytes, count: hit ? 1 : 0 };
}
function removeMatchingNodes(bytes: Uint8Array, match: Matcher, depth = 0): CleanResult {
  if (depth > 12) return { bytes, count: 0 };
  const fields = parseMessage(bytes);
  if (!fields) return { bytes, count: 0 };
  const out: PbField[] = [];
  let count = 0, changed = false;
  for (let f of fields) {
    if (f.wire === 2) {
      const sub = parseMessage(f.data!);
      if (match(f.field, f.data!, sub)) { count++; changed = true; continue; }
      if (sub) {
        const r = removeMatchingNodes(f.data!, match, depth + 1);
        if (r.count > 0) { f = { ...f, data: r.bytes, dirty: true }; count += r.count; changed = true; }
      }
    }
    out.push(f);
  }
  return { bytes: changed ? encodeMessage(out) : bytes, count };
}
function transformTopField7(bytes: Uint8Array, transform: (data: Uint8Array) => CleanResult): CleanResult {
  const fields = parseMessage(bytes);
  if (!fields) return { bytes, count: 0 };
  let changed = false, count = 0;
  for (const f of fields) {
    if (f.field !== 7 || f.wire !== 2) continue;
    const r = transform(f.data!);
    if (r.count > 0 || r.bytes !== f.data) { f.data = r.bytes; f.dirty = true; count += r.count; changed = true; }
  }
  return { bytes: changed ? encodeMessage(fields) : bytes, count };
}
function rewriteJsonFields(bytes: Uint8Array, rewrite: (obj: any) => boolean, depth = 0): CleanResult {
  if (depth > 12) return { bytes, count: 0 };
  const fields = parseMessage(bytes);
  if (!fields) return { bytes, count: 0 };
  let changed = false, count = 0;
  for (const f of fields) {
    if (f.wire !== 2) continue;
    let done = false;
    if (f.data!.length >= 2 && (f.data![0] === 123 || f.data![0] === 91)) {
      const text = bytesToUtf8(f.data!);
      if (text) {
        try {
          const obj = JSON.parse(text);
          if (rewrite(obj)) {
            f.data = utf8Bytes(JSON.stringify(obj));
            f.dirty = true; changed = true; count++; done = true;
          }
        } catch (e) { /* 非 JSON, 走嵌套报文 */ }
      }
    }
    if (!done && parseMessage(f.data!)) {
      const r = rewriteJsonFields(f.data!, rewrite, depth + 1);
      if (r.count > 0) { f.data = r.bytes; f.dirty = true; changed = true; count += r.count; }
    }
  }
  return { bytes: changed ? encodeMessage(fields) : bytes, count };
}

// ════════════════════════════════════════
// 🏠 各 rpid 清洗器 (字符串/阈值与上游一致)
// ════════════════════════════════════════
function cleanHomeJsonObject(obj: any): boolean {
  let changed = false;
  if (Array.isArray(obj)) {
    for (const item of obj) if (cleanHomeJsonObject(item)) changed = true;
    return changed;
  }
  if (!obj || typeof obj !== "object") return false;
  if (obj.groupId === 111357 && Array.isArray(obj.children)) {
    for (const child of obj.children) {
      if (!child || !Array.isArray(child.medias)) continue;
      const before = child.medias.length;
      child.medias = child.medias.filter((m: any) => {
        const caption = String((m && m.caption) || "");
        return caption === "推荐" || caption === "机场";
      });
      if (child.medias.length !== before) changed = true;
    }
  }
  for (const k of Object.keys(obj)) if (cleanHomeJsonObject(obj[k])) changed = true;
  return changed;
}
function cleanHomePayload(bytes: Uint8Array): CleanResult {
  const blockList = ["机上闭门购虚拟卡片", "里程积分兑换_首页右上角入口", "广告兜底服务2", "无行程机票直销卡片", "跟着电影去旅行", "回归礼包_无行程首页底部条", "解锁888元隐藏优惠"];
  const removed = removeMatchingNodes(bytes, (field, data, sub) =>
    field === 5 && ((sub && directFieldEqualsAscii(sub, 37, "ADVERT")) || containsAny(data, blockList)));
  const rewritten = rewriteJsonFields(removed.bytes, cleanHomeJsonObject);
  return { bytes: rewritten.bytes, count: removed.count + rewritten.count };
}
function cleanWaterfallPayload(bytes: Uint8Array): CleanResult {
  const blockList = ["瀑布流_特价机票", "瀑布流_酒店", "瀑布流_租车卡片", "瀑布流_权益", "瀑布流_今日热议", "瀑布流_城市攻略", "瀑布流_景点攻略", "瀑布流_附近底部跳转"];
  return removeMatchingNodes(bytes, (field, data) => field === 8 && containsAny(data, blockList));
}
function cleanTripBannerPayload(bytes: Uint8Array): CleanResult {
  return removeMatchingNodes(bytes, (field, data) =>
    field === 8 && (bytesContains(data, "付费会员") || bytesContains(data, "更早历史行程待解锁")));
}
function cleanHistoryPayload(bytes: Uint8Array): CleanResult {
  return removeMatchingNodes(bytes, (field, data) =>
    field === 11 && bytesContains(data, "历史行程容量剩余") && bytesContains(data, "付费会员"));
}
function cleanFlightPayload(bytes: Uint8Array): CleanResult {
  return removeMatchingNodes(bytes, (field, data) => field === 12 && bytesContains(data, "付费会员"));
}
function cleanFamilyMessage(bytes: Uint8Array, depth = 0): CleanResult {
  if (depth > 12) return { bytes, count: 0 };
  const fields = parseMessage(bytes);
  if (!fields) return { bytes, count: 0 };
  const hasTrial = fields.some(f => f.field === 1 && f.wire === 2 && bytesContains(f.data!, "可免费试用30天") && bytesContains(f.data!, "付费会员"));
  const hasGuard = fields.some(f => f.field === 2 && f.wire === 2 && bytesContains(f.data!, "添加家人并开启守护") && bytesContains(f.data!, "付费会员"));
  if (hasTrial && hasGuard) {
    const out: PbField[] = [];
    let count = 0;
    for (const f of fields) {
      const dropTrial = f.field === 1 && f.wire === 2 && bytesContains(f.data!, "可免费试用30天") && bytesContains(f.data!, "付费会员");
      const dropGuard = f.field === 2 && f.wire === 2 && bytesContains(f.data!, "添加家人并开启守护") && bytesContains(f.data!, "付费会员");
      if (dropTrial || dropGuard) { count++; continue; }
      out.push(f);
    }
    return { bytes: encodeMessage(out), count };
  }
  let changed = false, count = 0;
  for (const f of fields) {
    if (f.wire !== 2 || !parseMessage(f.data!)) continue;
    const r = cleanFamilyMessage(f.data!, depth + 1);
    if (r.count > 0) { f.data = r.bytes; f.dirty = true; count += r.count; changed = true; }
  }
  return { bytes: changed ? encodeMessage(fields) : bytes, count };
}
function refreshChildrenIndex(group: any): void {
  if (!group || !Array.isArray(group.children) || !group.childrenIndex) return;
  const index: Record<string, number> = {};
  group.children.forEach((child: any, i: number) => {
    if (child && child.cardId !== undefined && child.cardId !== null) index[String(child.cardId)] = i;
  });
  group.childrenIndex = index;
}
function cleanMineJsonObject(obj: any): boolean {
  let changed = false;
  if (Array.isArray(obj)) {
    for (const item of obj) if (cleanMineJsonObject(item)) changed = true;
    return changed;
  }
  if (!obj || typeof obj !== "object") return false;
  if (obj.groupId === 111402 && Array.isArray(obj.children)) {
    const before = obj.children.length;
    obj.children = obj.children.filter((child: any) => {
      if (!child || typeof child !== "object") return true;
      const sensor = child.sensorParam && typeof child.sensorParam === "object" ? child.sensorParam : {};
      const title = String(child.title || "");
      const serviceName = String(sensor.service_name || "");
      const serviceLabel = String(sensor.service_label || "");
      return !(title.includes("会员月卡") || serviceLabel.includes("会员月卡") || /^商品\d+$/.test(serviceName));
    });
    if (obj.children.length !== before) { refreshChildrenIndex(obj); changed = true; }
  }
  if (obj.groupId === 111403 && Array.isArray(obj.children)) {
    const before = obj.children.length;
    obj.children = obj.children.filter((child: any) =>
      !child || typeof child !== "object" || String(child.cardType || "") !== "PRODUCT");
    if (obj.children.length !== before) { refreshChildrenIndex(obj); changed = true; }
  }
  if (obj.groupId === 111404 && Array.isArray(obj.children)) {
    for (const child of obj.children) {
      if (!child || !Array.isArray(child.medias)) continue;
      const before = child.medias.length;
      child.medias = child.medias.filter((m: any) => {
        if (!m || typeof m !== "object") return true;
        const caption = String(m.caption || "");
        const subCaption = String(m.subCaption || "");
        return !(caption === "买三送一" || caption === "全民推荐官" || subCaption.includes("视频会员") || subCaption.includes("返现"));
      });
      if (child.medias.length !== before) changed = true;
    }
  }
  for (const k of Object.keys(obj)) if (cleanMineJsonObject(obj[k])) changed = true;
  return changed;
}
function rewriteMineJsonFields(bytes: Uint8Array, depth = 0): CleanResult {
  if (depth > 12) return { bytes, count: 0 };
  const fields = parseMessage(bytes);
  if (!fields) return { bytes, count: 0 };
  let changed = false, count = 0;
  for (const f of fields) {
    if (f.wire !== 2) continue;
    let done = false;
    if (f.data!.length >= 2 && (f.data![0] === 123 || f.data![0] === 91)) {
      const text = bytesToUtf8(f.data!);
      if (text) {
        try {
          const obj = JSON.parse(text);
          if (cleanMineJsonObject(obj)) {
            f.data = utf8Bytes(JSON.stringify(obj));
            f.dirty = true; changed = true; count++; done = true;
          }
        } catch (e) { /* 非 JSON, 走嵌套报文 */ }
      }
    }
    if (!done && parseMessage(f.data!)) {
      const r = rewriteMineJsonFields(f.data!, depth + 1);
      if (r.count > 0) { f.data = r.bytes; f.dirty = true; changed = true; count += r.count; }
    }
  }
  return { bytes: changed ? encodeMessage(fields) : bytes, count };
}
function cleanMinePayload(bytes: Uint8Array): CleanResult {
  const removed = removeMatchingNodes(bytes, (field, data) =>
    field === 5 && (bytesContains(data, "我的页面-会员卡片V3") || bytesContains(data, "机票-31-推荐管")));
  const rewritten = rewriteMineJsonFields(removed.bytes);
  return { bytes: rewritten.bytes, count: removed.count + rewritten.count };
}

// ════════════════════════════════════════
// 🚦 rpid 分发
// ════════════════════════════════════════
function processBody(bytes: Uint8Array, rpid: string | null): CleanResult {
  if (EMPTY_RPIDS.has(rpid!)) return replaceTopField7(bytes, EMPTY_PAYLOAD);
  if (rpid === HOME_RPID) return transformTopField7(bytes, cleanHomePayload);
  if (rpid === WATERFALL_RPID) return transformTopField7(bytes, cleanWaterfallPayload);
  if (rpid === TRIP_BANNER_RPID) return transformTopField7(bytes, cleanTripBannerPayload);
  if (rpid === FAMILY_RPID) return transformTopField7(bytes, cleanFamilyMessage);
  if (rpid === HISTORY_RPID) return transformTopField7(bytes, cleanHistoryPayload);
  if (rpid === MINE_RPID) return transformTopField7(bytes, cleanMinePayload);
  if (rpid === FLIGHT_RPID) return transformTopField7(bytes, cleanFlightPayload);
  return { bytes, count: 0 };
}

function getHeader(name: string): string | null {
  const headers = ($request && $request.headers) || {};
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) if (k.toLowerCase() === lower) return String(headers[k]);
  return null;
}
function getRpid(bytes: Uint8Array): string | null {
  const fromHeader = getHeader("rpid");
  return fromHeader || directFieldAscii(parseMessage(bytes), 5);
}

// ════════════════════════════════════════
// 🚪 入口: Node 测试导出 / Loon 运行时
// ════════════════════════════════════════
if (typeof module !== "undefined" && module.exports) {
  module.exports = { processBody, parseMessage, encodeMessage, utf8Bytes, directFieldAscii, EMPTY_PAYLOAD, EMPTY_RPIDS };
} else {
  try {
    if ($response && $response.bodyBytes) {
      const bytes = new Uint8Array($response.bodyBytes);
      const rpid = getRpid(bytes);
      const result = processBody(bytes, rpid);
      if (result.count > 0) console.log(`[UmetripAds] rpid=${rpid}, removed/rewritten=${result.count}`);
      if (result.bytes === bytes || result.count === 0) {
        $done();
      } else {
        const buf = result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength);
        $done({ bodyBytes: buf });
      }
    } else {
      $done();
    }
  } catch (e) {
    console.log(`[UmetripAds] error: ${e}`);
    $done();
  }
}
