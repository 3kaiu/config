/**
 * tools/geonode-sync.mjs 行为回归 (2026-09-11 审计, SEC-03)
 *
 * 本文件是 tools/ 下第一个单测。此前 tools/*.mjs 完全没有测试覆盖。
 *
 * 重点覆盖:
 *   1. `cc` (国家码) 来自**不可信上游**且会拼进节点名 — 必须严格限定为 2 位大写字母,
 *      否则非法值会污染 Profile/geonode.loon.txt 的节点名。
 *   2. 入口守卫: import 本模块不得触发真实网络探测 (此前 main() 在顶层无条件调用,
 *      实测 require 后立即并发探测 234 个候选)。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "Profile", "geonode.loon.txt");

// 用动态 import() 而非 require(esm): 后者需 Node ≥22.12 (未加 --experimental-require-module),
// 会把 package.json 的 engines 下限无谓地抬到 22.12。动态 import 在 CJS 中通用。
let mod = null;
const load = async () => (mod ??= await import("../../tools/geonode-sync.mjs"));

/** 构造一个最小可用的上游条目 (默认全部字段合法) */
const entry = (over = {}) => ({
  anonymityLevel: "elite",
  country: "IN",
  ip: "1.2.3.4",
  port: "8080",
  protocols: ["socks5"],
  ...over,
});

/** 从生成行中取出 cc 段: geonode-<proto>-<cc>-<ip>-<port> (proto 含数字, 如 socks5) */
const ccOf = (line) => {
  const m = /^geonode-[a-z0-9]+-([^-]+)-\d/.exec(line);
  return m ? m[1] : null;
};

exports.tests = {
  // ── SEC-03: cc 严格校验 ──
  "geonode: 合法 2 位大写国家码原样保留": async (a) => {
    const g = await load();
    for (const cc of ["IN", "DE", "BD", "US", "JP", "XX"]) {
      const lines = g.toNodeLines([entry({ country: cc })]);
      a.equal(lines.length, 1, `${cc} 应产出 1 个节点`);
      a.equal(ccOf(g.nodeLine(lines[0])), cc, `${cc} 应原样保留`);
    }
  },
  "geonode: 非法国家码一律归一为 XX (不污染节点名)": async (a) => {
    const g = await load();
    // 敌意/畸形取值: 长度不符、非字母、含分隔符/空白/换行、注入尝试
    const bad = [
      "USA", "C", "", "123", "A1", "a1", "A B", "A.B", "A-B", "A,B", "A=B",
      "中国", "A\nB", "  ", "ABCDEF", "x", "AA1", "A_A", "A/B", "A\\B",
    ];
    for (const cc of bad) {
      const lines = g.toNodeLines([entry({ country: cc })]);
      a.equal(lines.length, 1, `${JSON.stringify(cc)} 应仍产出 1 个节点`);
      a.equal(ccOf(g.nodeLine(lines[0])), "XX", `${JSON.stringify(cc)} 应归一为 XX`);
    }
  },
  "geonode: country 缺失/非字符串也归一为 XX": async (a) => {
    const g = await load();
    for (const cc of [undefined, null, 0, false, {}, []]) {
      const lines = g.toNodeLines([entry({ country: cc })]);
      a.equal(ccOf(g.nodeLine(lines[0])), "XX", `country=${JSON.stringify(cc)} 应归一为 XX`);
    }
  },
  "geonode: CN 排除仍然生效 (含小写, 归一后再判定)": async (a) => {
    const g = await load();
    for (const cc of ["CN", "cn", "Cn"]) {
      a.equal(g.toNodeLines([entry({ country: cc })]).length, 0, `${cc} 应被排除`);
    }
    // 归一为 XX 的非法值不应被误当作 CN 排除
    a.equal(g.toNodeLines([entry({ country: "C" })]).length, 1, "非法值归一 XX 后应保留");
  },
  "geonode: 生成行恒满足 NODE_LINE_RE 形状 (纵深防御)": async (a) => {
    const g = await load();
    // 与脚本内 NODE_LINE_RE 同源的形状断言: 任意敌意 cc 都不得破坏行结构
    const LINE_RE = /^[\w.-]+ = (http|https|socks5),\d{1,3}(\.\d{1,3}){3},\d{2,5}$/;
    const cases = ["IN", "USA", "A B", "A,B", "A=B", "A\nB", "", "中国", "A.B"];
    for (const cc of cases) {
      const lines = g.toNodeLines([entry({ country: cc })]);
      for (const l of lines) {
        a.ok(LINE_RE.test(g.nodeLine(l)), `cc=${JSON.stringify(cc)} 生成行应合法: ${g.nodeLine(l)}`);
      }
    }
  },

  // ── 既有过滤语义 (回归保护) ──
  "geonode: 透明代理 / 非法 ip / 非法 port / 非对象 均被过滤": async (a) => {
    const g = await load();
    a.equal(g.toNodeLines([entry({ anonymityLevel: "transparent" })]).length, 0, "透明代理应排除");
    for (const ip of ["", "999.1.1.1.1", "abc", "1.2.3", "1.2.3.4.5"]) {
      a.equal(g.toNodeLines([entry({ ip })]).length, 0, `非法 ip ${JSON.stringify(ip)} 应排除`);
    }
    for (const port of ["", "1", "123456", "80a"]) {
      a.equal(g.toNodeLines([entry({ port })]).length, 0, `非法 port ${JSON.stringify(port)} 应排除`);
    }
    a.equal(g.toNodeLines([null, undefined, "str", 42]).length, 0, "非对象条目应排除");
  },
  "geonode: ip:port 去重 + 协议按上游数组顺序取首个受支持项": async (a) => {
    const g = await load();
    const dup = g.toNodeLines([entry(), entry()]);
    a.equal(dup.length, 1, "同 ip:port 应去重");
    // 语义是"上游 protocols 数组中首个受支持项"(尊重上游顺序), **不是**优先级挑选。
    // 两者在多协议条目上结果不同: 此处 socks5 在数组首位 → 选 socks5。
    const multi = g.toNodeLines([entry({ protocols: ["socks5", "https", "http"] })]);
    a.equal(multi[0].proto, "socks5", "应取上游数组首个受支持项 (尊重上游顺序)");
    const multi2 = g.toNodeLines([entry({ protocols: ["https", "socks5"] })]);
    a.equal(multi2[0].proto, "https", "顺序改变则选择随之改变");
    // 数组中的不受支持项被跳过, 取其后首个受支持项
    const skip = g.toNodeLines([entry({ protocols: ["ftp", "socks5"] })]);
    a.equal(skip[0].proto, "socks5", "应跳过不受支持项");
    a.equal(g.toNodeLines([entry({ protocols: ["ftp", "quic"] })]).length, 0, "无可映射协议应排除");
  },
  "geonode: nodeLine 格式稳定": async (a) => {
    const g = await load();
    const [n] = g.toNodeLines([entry({ country: "DE", ip: "5.6.7.8", port: "1080", protocols: ["socks5"] })]);
    a.equal(g.nodeLine(n), "geonode-socks5-DE-5.6.7.8-1080 = socks5,5.6.7.8,1080", "节点行格式");
  },

  // ── 入口守卫 ──
  "geonode: import 不触发探测 / 不改写产物 (入口守卫生效)": async (a) => {
    // 若 main() 在顶层被调用, 子进程会打印 "🔍 探测 …" 或 "❌ geonode-sync 失败"
    const before = fs.existsSync(OUT) ? fs.statSync(OUT).mtimeMs : null;
    const out = execFileSync(
      process.execPath,
      ["-e", 'import("./tools/geonode-sync.mjs").then(() => console.log("IMPORT_OK"));'],
      { cwd: ROOT, encoding: "utf8", timeout: 20000 }
    );
    const after = fs.existsSync(OUT) ? fs.statSync(OUT).mtimeMs : null;
    a.equal(out.trim(), "IMPORT_OK", "import 应只输出 IMPORT_OK, 无任何 main() 副作用");
    a.equal(after, before, "import 不应改写 Profile/geonode.loon.txt");
  },
};
