/**
 * 瑞幸咖啡去广告 Pro v1.0
 * 作者：3kaiu (基于 ddgksf2013/luckincoffee.ads.js 反混淆移植)
 *
 * $response.body 是 AES-128-ECB (key=lqiQnStb3CMmDJXk, PKCS7, base64url 含填充)
 * 加密的 JSON: 解密 → 按 URL 路径清洗 content → 重新加密。
 * 清洗规则经差分探测与上游逐字段对齐:
 *   config/value              banner.config: home_middlebanner_scrollbroadcast_switch=0
 *                             + personal_middlebanner_scrollbroadcast_switch=0;
 *                             ios.flash.config: flashSwitch=false
 *   homePage/common/modules   content.tacticList=[]
 *   common/modules            F104 → tacticList=[];
 *                             F101 → 过滤 positionCode∈{F101001,F101005},
 *                             F101003 项 moduleInfos 过滤 moduleTitle=福利中心
 *   base/myPageSectionShow/newUI  按 title 过滤 {招商加盟,租赁合作,加入我们,优惠联盟,活动周边,企业充赠}
 *   app/adposNew, visual/effect/modules  content=[]
 *   homePage/contactor/modules  isPop=0, popupLinkUrl='', tactic.{moduleInfos=[],headPic/showPicUrl/showPicUrl2/popupStyleTemplateJson=''}
 *   app/carousel              imgUrl='', notifyInfos=[]
 *   aigc/showAIButton         bubbleData/bubbleScheme=null, bubbleType=0,
 *                             enlargeIconUrl/iconUrl/link='', showAISearch/showButton=false
 *   seckill/ar/campaignBaseInfo  status=0, {arBtnPic,arIcon,mainVisualPic,popupPic,rulePic,wxSharePic,wxShareTitle} 置空(仅 string)
 * 任何异常 → $done({ body: 原始 body }) 原样放行
 */

// ════════════════════════════════════════
// 🔐 AES-128 (ECB, PKCS7) — 内联实现, 零依赖
// ════════════════════════════════════════
const LK_KEY = "lqiQnStb3CMmDJXk";
const SBOX = [0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x1,0x67,0x2b,0xfe,0xd7,0xab,0x76,0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,0x4,0xc7,0x23,0xc3,0x18,0x96,0x5,0x9a,0x7,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,0x9,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,0x53,0xd1,0x0,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x2,0x7f,0x50,0x3c,0x9f,0xa8,0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,0xcd,0xc,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0xb,0xdb,0xe0,0x32,0x3a,0xa,0x49,0x6,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x8,0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,0x70,0x3e,0xb5,0x66,0x48,0x3,0xf6,0xe,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,0x8c,0xa1,0x89,0xd,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0xf,0xb0,0x54,0xbb,0x16];
const INV_SBOX = new Array(256);
for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;
const RCON = [0x0, 0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function xtime(b: number): number { return ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff; }
function gmul(a: number, b: number): number {
  let r = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) r ^= a;
    a = xtime(a);
    b >>>= 1;
  }
  return r;
}

function expandKey(key: Uint8Array): Uint8Array {
  const rk = new Uint8Array(176);
  rk.set(key);
  let bytes = 16, r = 1;
  const t = [0, 0, 0, 0];
  while (bytes < 176) {
    for (let i = 0; i < 4; i++) t[i] = rk[bytes - 4 + i];
    if (bytes % 16 === 0) {
      const tmp = t[0];
      t[0] = SBOX[t[1]] ^ RCON[r++];
      t[1] = SBOX[t[2]];
      t[2] = SBOX[t[3]];
      t[3] = SBOX[tmp];
    }
    for (let i = 0; i < 4; i++) { rk[bytes] = rk[bytes - 16] ^ t[i]; bytes++; }
  }
  return rk;
}

function addRoundKey(s: number[], rk: Uint8Array, round: number): void {
  for (let i = 0; i < 16; i++) s[i] ^= rk[round * 16 + i];
}
function subBytes(s: number[]): void { for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]]; }
function invSubBytes(s: number[]): void { for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]]; }
function shiftRows(s: number[]): void {
  let t: number;
  t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
  t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[3]; s[3] = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = t;
}
function invShiftRows(s: number[]): void {
  let t: number;
  t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
  t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
}
function mixColumns(s: number[]): void {
  for (let c = 0; c < 4; c++) {
    const i = c * 4, a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
    s[i]     = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
    s[i + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
    s[i + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
    s[i + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
  }
}
function invMixColumns(s: number[]): void {
  for (let c = 0; c < 4; c++) {
    const i = c * 4, a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
    s[i]     = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3, 9);
    s[i + 1] = gmul(a0, 9) ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13);
    s[i + 2] = gmul(a0, 13) ^ gmul(a1, 9) ^ gmul(a2, 14) ^ gmul(a3, 11);
    s[i + 3] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2, 9) ^ gmul(a3, 14);
  }
}

function aesEncryptBlock(block: Uint8Array, rk: Uint8Array): Uint8Array {
  const s = Array.from(block);
  addRoundKey(s, rk, 0);
  for (let r = 1; r < 10; r++) { subBytes(s); shiftRows(s); mixColumns(s); addRoundKey(s, rk, r); }
  subBytes(s); shiftRows(s); addRoundKey(s, rk, 10);
  return new Uint8Array(s);
}
function aesDecryptBlock(block: Uint8Array, rk: Uint8Array): Uint8Array {
  const s = Array.from(block);
  addRoundKey(s, rk, 10);
  for (let r = 9; r >= 1; r--) { invShiftRows(s); invSubBytes(s); addRoundKey(s, rk, r); invMixColumns(s); }
  invShiftRows(s); invSubBytes(s); addRoundKey(s, rk, 0);
  return new Uint8Array(s);
}

// ════════════════════════════════════════
// 🔤 UTF-8 / base64url 编解码 (无 TextEncoder 依赖)
// ════════════════════════════════════════
function utf8ToBytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const c2 = str.charCodeAt(++i);
      c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}
function bytesToUtf8(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++];
    if (b < 0x80) s += String.fromCharCode(b);
    else if (b < 0xe0) { s += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f)); }
    else if (b < 0xf0) { s += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)); }
    else {
      const cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      const u = cp - 0x10000;
      s += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    }
  }
  return s;
}
function b64ToBytes(b64: string): Uint8Array {
  const std = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_");
}

// ════════════════════════════════════════
// 🔄 报文加解密入口 (与上游 decryptBody/encryptBody 对齐)
// ════════════════════════════════════════
function decryptBody(b64: string): string {
  const cipher = b64ToBytes(b64.trim());
  if (cipher.length === 0 || cipher.length % 16 !== 0) throw new Error("cipher length");
  const rk = expandKey(new Uint8Array(utf8ToBytes(LK_KEY)));
  const plain = new Uint8Array(cipher.length);
  for (let i = 0; i < cipher.length; i += 16) plain.set(aesDecryptBlock(cipher.slice(i, i + 16), rk), i);
  const pad = plain[plain.length - 1];
  if (pad < 1 || pad > 16) throw new Error("bad padding");
  for (let i = plain.length - pad; i < plain.length; i++) if (plain[i] !== pad) throw new Error("bad padding");
  return bytesToUtf8(plain.slice(0, plain.length - pad));
}
function encryptBody(text: string): string {
  const data = utf8ToBytes(text);
  const pad = 16 - (data.length % 16);
  const rk = expandKey(new Uint8Array(utf8ToBytes(LK_KEY)));
  const out = new Uint8Array(data.length + pad);
  for (let i = 0; i < data.length + pad; i += 16) {
    const block = new Uint8Array(16);
    for (let j = 0; j < 16; j++) block[j] = i + j < data.length ? data[i + j] : pad;
    out.set(aesEncryptBlock(block, rk), i);
  }
  return bytesToB64url(out);
}

// ════════════════════════════════════════
// 🧹 按 URL 路径清洗 (与上游差分对齐)
// ════════════════════════════════════════
function parseJSONText(v: unknown): Record<string, unknown> | null {
  try { return typeof v === "string" ? JSON.parse(v) : null; } catch (e) { return null; }
}
function compactJSON(v: unknown): string { return JSON.stringify(v); }

const MYPAGE_BLOCK: Record<string, number> = { "招商加盟": 1, "租赁合作": 1, "加入我们": 1, "优惠联盟": 1, "活动周边": 1, "企业充赠": 1 };
function filterMyPage(list: Array<{ title?: string }>): Array<{ title?: string }> {
  return list.filter(item => !MYPAGE_BLOCK[item && item.title as string]);
}

function clean(body: Record<string, any>, url: string): Record<string, any> {
  const content = body && body.content;
  if (/\/resource\/m\/sys\/config\/value/.test(url) && content && typeof content === "object" && !Array.isArray(content)) {
    let p = parseJSONText(content["luckyfe.luckincoffee.banner.config"]);
    if (p) {
      p["home_middlebanner_scrollbroadcast_switch"] = 0;
      p["personal_middlebanner_scrollbroadcast_switch"] = 0;
      content["luckyfe.luckincoffee.banner.config"] = compactJSON(p);
    }
    p = parseJSONText(content["luckyfe.luckincoffee.ios.flash.config"]);
    if (p) {
      p["flashSwitch"] = false;
      content["luckyfe.luckincoffee.ios.flash.config"] = compactJSON(p);
    }
  } else if (/\/resource\/m\/sys\/homePage\/common\/modules/.test(url) && content && Array.isArray(content["tacticList"])) {
    content["tacticList"] = [];
  } else if (/\/resource\/m\/sys\/common\/modules/.test(url) && content && Array.isArray(content["tacticList"])) {
    if (content["positionCode"] === "F104") content["tacticList"] = [];
    else if (content["positionCode"] === "F101") {
      content["tacticList"] = content["tacticList"].filter(
        (t: any) => t && t["positionCode"] !== "F101001" && t["positionCode"] !== "F101005"
      );
      content["tacticList"].forEach((t: any) => {
        if (t["positionCode"] === "F101003" && Array.isArray(t["moduleInfos"])) {
          t["moduleInfos"] = t["moduleInfos"].filter((mi: any) => mi && mi["moduleTitle"] !== "福利中心");
        }
      });
    }
  } else if (/\/resource\/m\/sys\/base\/myPageSectionShow\/newUI/.test(url) && Array.isArray(content)) {
    body["content"] = filterMyPage(content);
  } else if (/\/resource\/m\/sys\/app\/adposNew/.test(url) && Array.isArray(content)) {
    body["content"] = [];
  } else if (/\/resource\/m\/sys\/homePage\/contactor\/modules/.test(url) && content && typeof content === "object") {
    content["isPop"] = 0;
    content["popupLinkUrl"] = "";
    if (content["tactic"] && typeof content["tactic"] === "object") {
      content["tactic"]["moduleInfos"] = [];
      content["tactic"]["headPic"] = "";
      content["tactic"]["showPicUrl"] = "";
      content["tactic"]["showPicUrl2"] = "";
      content["tactic"]["popupStyleTemplateJson"] = "";
    }
  } else if (/\/resource\/m\/sys\/app\/carousel/.test(url) && content && typeof content === "object") {
    content["imgUrl"] = "";
    content["notifyInfos"] = [];
  } else if (/\/resource\/m\/sys\/visual\/effect\/modules/.test(url) && Array.isArray(content)) {
    body["content"] = [];
  } else if (/\/resource\/m\/aigc\/showAIButton/.test(url) && content && typeof content === "object") {
    content["bubbleData"] = null;
    content["bubbleScheme"] = null;
    content["bubbleType"] = 0;
    content["enlargeIconUrl"] = "";
    content["iconUrl"] = "";
    content["link"] = "";
    content["showAISearch"] = false;
    content["showButton"] = false;
  } else if (/\/resource\/seckill\/ar\/campaignBaseInfo/.test(url) && content && typeof content === "object") {
    content["status"] = 0;
    ["arBtnPic", "arIcon", "mainVisualPic", "popupPic", "rulePic", "wxSharePic", "wxShareTitle"].forEach(k => {
      if (typeof content[k] === "string") content[k] = "";
    });
  }
  return body;
}

function main(url: string, body: string): string {
  const text = decryptBody(body);
  const obj = JSON.parse(text);
  clean(obj, url);
  return encryptBody(JSON.stringify(obj));
}

// ════════════════════════════════════════
// 🚪 入口: Node 测试导出 / Loon 运行时
// ════════════════════════════════════════
if (typeof module !== "undefined" && module.exports) {
  module.exports = { decryptBody, encryptBody, clean, main };
} else {
  try {
    $done({ body: main($request.url, $response.body) });
  } catch (e) {
    console.log("[Luckin Clean] " + e);
    $done({ body: $response.body });
  }
}
