"use strict";
/**
 * REJECT 域名的 DNS 存活性门禁 (2026-09-29 对抗审计)
 *
 * 缘由 —— 一次真实的静默失效: 规则写的是 `DOMAIN-SUFFIX, alisc1.zijieapi.com`,
 * 而同段注释里记的真实 host 是 `tnc3-alisc1.zijieapi.com`。前者四解析器一致
 * NXDOMAIN(**永不命中**), 后者存活(CNAME → w.kunluncan.com)。即"该拦的没拦住,
 * 还白占一条"。语法完全合法, 现有门禁一条都抓不到 —— 遮蔽检查只管顺序,
 * external-deps 只管第三方引用, 没有一条问"这个域还在吗"。
 *
 * ⚠️ 关键陷阱 (本门禁设计时踩过, 记录在此):
 *   ① **裸域 NXDOMAIN ≠ 死规则**。`DOMAIN-SUFFIX, imtmp.net` 的裸域 NXDOMAIN,
 *      但 www/log/stat/ads/track/sdk/data-cdn 七个子域全部存活 —— SUFFIX 匹配的是
 *      子域, 规则完全有效。删掉就是误伤正在生效的拦截。判据必须落到**子域**。
 *   ② **单解析器结论不可信**。首版探针报文畸形(漏 arcount)导致 104/121 个假
 *      SERVFAIL, 含 adjust.com 这类全球域名。对照已知正常域才发现是探针的错。
 *      故必须多解析器交叉, 且探针自身要先自检。
 *
 * 判据: 裸域与若干常见功能子域**在全部探针解析器上一致 NXDOMAIN** 才判死。
 * 网络不可用时全部跳过(不得因探测失败而误删规则)。
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = path.join(__dirname, "..", "..");
const TPL = path.join(REPO, "template", "loon.tpl");

// 多解析器: 国内 + 海外各一, 避免单一上游的污染视图
const RESOLVERS = ["1.1.1.1", "8.8.8.8", "223.5.5.5", "119.29.29.29"];

// 裸域之外还要探的子域 —— 覆盖 SDK 常见功能前缀
const SUBDOMAINS = ["www", "api", "log", "stat", "ads", "track", "sdk", "m", "open", "data"];

/**
 * 模板里已显式登记的 host —— **权威判据**。
 *
 * 踩坑记录: 固定子域表把 `pangolin-sdk-toutiao.com` 误判为死亡域, 但它的真实 host 是
 * `api-access` / `log-api` / `gromore`(穿山甲三个接口, 模板已逐条显式列出), 三者全部
 * 存活且 CNAME 到 bytedns1。任何固定前缀表都会漏掉这类非通用命名。
 * 故判据集合 = 固定前缀 ∪ 模板显式登记过的 host。
 */
function registeredHosts() {
  const txt = fs.readFileSync(TPL, "utf8");
  const out = new Set();
  for (const m of txt.matchAll(/^\s*(?:DOMAIN|DOMAIN-SUFFIX),\s*([\w.-]+\.[a-z]{2,}),\s*REJECT/gim)) {
    out.add(m[1].toLowerCase());
  }
  return out;
}

/**
 * 返回三态: "exists" / "gone" / null(不可达)。
 *
 * ⚠️ 踩坑记录: 首版只判"有 A 记录", 于是把 NOERROR 但无 A 的域全判成死亡 ——
 * `apns.apple.com`(Apple 推送核心) 与 `stun.playstation.net` 双双误报。二者 rcode 均为
 * NOERROR(域确实存在), 只是自身不带 A 记录: apns 处于 CNAME 链末端
 * (push.apple.com → apns.apple.com), 记录在上一跳。
 * 三态判定才能区分"域不存在(NXDOMAIN)"与"域存在但无自身记录(NOERROR)"。
 */
function digStatus(name, resolver, type = "A") {
  try {
    const out = execFileSync(
      "dig",
      ["+time=3", "+tries=1", `@${resolver}`, name, type],
      { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "ignore"] }
    );
    const m = out.match(/status:\s*([A-Z]+)/);
    if (!m) return null;
    if (m[1] === "NXDOMAIN") return "gone";
    if (m[1] !== "NOERROR") return null; // SERVFAIL/REFUSED 等 → 不可达, 不得判死
    return "exists";
  } catch {
    return null; // 解析器不可达 —— 不得据此判死
  }
}

/**
 * 区分「确定死」与「暂时下线」—— 这是本门禁最关键的判据。
 *
 * 踩坑记录: 66mobi.com / adkwai.com / pangle.io 三条全被判红, 但它们 NS 仍活跃
 * (vip3.alidns.com / ns3.dnsv4.com / a7-65.akam.net), 只是当前无 A 记录 ——
 * 属"服务下线、域名仍在", 随时可能恢复。adkwai 的真实 host p1/p2/p3.adkwai.com
 * 甚至仍然存活(CNAME 到 ks-cdn.com), 说明 SUFFIX 规则**现在就在生效**。
 * 而真正该删的 alisc1.zijieapi.com 连 NS 都没了 —— 域名已注销。
 *
 * 故: NS 仍在 → 只报告不判红(业务下线可随时反转, 删除是不可逆的误伤)。
 *     NS 亦无 → 判红(域名已注销, 规则永远不可能命中)。
 */
function nsAlive(base) {
  for (const r of RESOLVERS) {
    const st = digStatus(base, r, "NS");
    if (st === "exists") return true;
  }
  return false;
}

/** 探针自检: 已知一定存活的域必须解析成功, 否则本次探测不可信 */
function probeSelfCheck() {
  return digStatus("www.apple.com", "1.1.1.1") === "exists";
}

function rejSuffixes() {
  const txt = fs.readFileSync(TPL, "utf8");
  const sec = (txt.match(/^\[Rule\]\n([\s\S]*?)(?=^\[[A-Za-z ]+\]$)/m) || [])[1] || "";
  const out = new Set();
  for (const l of sec.split("\n")) {
    const s = l.trim();
    if (!s || s.startsWith("#")) continue;
    const f = s.split(",").map((x) => x.trim());
    if (f[0] === "DOMAIN-SUFFIX" && /^REJECT/.test(f[2] || "")) out.add(f[1]);
  }
  return [...out].sort();
}

exports.tests = {
  "dns-live: 探针自检通过 (解析器可用) 后才允许判死": async (a) => {
    if (!probeSelfCheck()) {
      a.ok(true, "跳过: 当前环境无法访问公共 DNS, 不做任何存活性判定(不得因探测失败误删规则)");
      return;
    }
    a.ok(true, "探针自检通过 (www.apple.com 解析成功)");
  },

  // real-ip 与 REJECT 是同类风险的另一面: 写错/已注销的条目静默失效。
  // 判据更保守 —— 追加"裸域之外探常见子域", 因为 real-ip 几乎全用 *. 通配, 真实
  // 主机是子域(银行/系统服务域的裸域本就没有 A 记录)。仅当裸域与子域**全部**无解、
  // 且 NS 亦无(域名已注销)时才判红。
  "dns-live: real-ip 条目不得是域名已注销的残留": async (a) => {
    if (!probeSelfCheck()) {
      a.ok(true, "跳过: 公共 DNS 不可达");
      return;
    }
    const txt = fs.readFileSync(TPL, "utf8");
    const sec = (txt.match(/^real-ip\s*=\s*(.*)$/m) || [])[1] || "";
    const entries = sec.split(",").map((s) => s.trim()).filter(Boolean);
    const dead = [];
    for (const e of entries) {
      // 通配与本地域跳过(其语义不由公网 DNS 判定)
      if (!/^[\w.-]+\.[a-z]{2,}$/i.test(e.replace(/^\*\./, ""))) continue;
      if (/^(local|lan|home\.arpa)$/i.test(e.replace(/^\*\./, ""))) continue;
      const base = e.replace(/^\*\./, "");
      const names = [base, ...SUBDOMAINS.map((s) => `${s}.${base}`)];
      let anyAlive = false;
      for (const n of names) {
        for (const r of RESOLVERS) {
          if (digStatus(n, r) === "exists") { anyAlive = true; break; }
        }
        if (anyAlive) break;
      }
      if (anyAlive) continue;
      if (nsAlive(base)) continue; // NS 活跃 = 业务下线, 可能恢复
      dead.push(e);
    }
    a.equal(
      dead.length,
      0,
      `${dead.length} 条 real-ip 条目域名已注销(裸域、子域、NS 全部无解) —— 静默失效, 白占一条:\n` +
        `  ${dead.join("\n  ")}`
    );
  },

  "dns-live: REJECT 后缀不得是全解析器一致 NXDOMAIN 的死亡域": async (a) => {
    if (!probeSelfCheck()) {
      a.ok(true, "跳过: 公共 DNS 不可达");
      return;
    }
    const dead = [];
    const dormant = [];
    const known = registeredHosts();
    for (const base of rejSuffixes()) {
      // 裸域 + 常见功能子域 + 模板显式登记过的同后缀 host, 任一存活即认为规则有效
      const names = new Set([base, ...SUBDOMAINS.map((s) => `${s}.${base}`)]);
      for (const h of known) if (h === base || h.endsWith(`.${base}`)) names.add(h);
      let anyAlive = false;
      let allDead = true;
      for (const n of names) {
        for (const r of RESOLVERS) {
          const st = digStatus(n, r);
          if (st === null) continue; // 该解析器不可达
          if (st === "exists") { anyAlive = true; allDead = false; break; }
        }
        if (anyAlive) break;
      }
      if (anyAlive || !allDead) continue;
      // NS 仍在 = 域名仍注册, 业务可随时恢复 → 只报告
      if (nsAlive(base)) dormant.push(base);
      else dead.push(base);
    }
    if (dormant.length) {
      console.log(
        `ℹ️  ${dormant.length} 条 REJECT 后缀当前无 A 记录但域名仍注册(NS 活跃, 随时可能恢复, 保留):\n     ` +
          dormant.join("\n     ")
      );
    }
    a.equal(
      dead.length,
      0,
      `${dead.length} 条 REJECT 后缀在全部解析器上一致 NXDOMAIN(裸域、${SUBDOMAINS.length} 个常见子域、` +
        `以及模板显式登记过的同后缀 host 均无解) —— ` +
        `规则永不命中, 白占一条:\n  ${dead.join("\n  ")}\n` +
        `处置: 删除该规则并从 rule-shadow 的 EVIDENCED 登记表移除。` +
        `⚠️ 若确知真实 host 写错了(参考 alisc1.zijieapi.com → tnc3-alisc1 那次), ` +
        `应改为正确 host 而非删除。判据须落到子域 —— 裸域 NXDOMAIN 不代表死规则(imtmp.net)。` +
        `⚠️ 只判 NS 亦无者: NS 仍活跃的域只是业务下线, 随时可能恢复, 删除属不可逆误伤`
    );
  },
};
