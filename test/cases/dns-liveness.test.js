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
 *
 * 2026-09-29 扩面: 原先只覆盖 template/loon.tpl。13 个广告平台与探针通道插件(ad- 与
 * probe- 前缀)的 97 条域级
 * REJECT(全是精确 DOMAIN)此前**没有任何存活门禁** —— 域写错或平台下线子域时静默失效。
 * 插件层判据按精确 host 收紧(无 A 记录 = 规则空转), 但保留「NS 活跃只报告」同一姿态。
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

// ── 插件层扫描 (2026-09-29 新增) ──────────────────────────────────────────
// 本文件此前只 readFileSync(template/loon.tpl) —— 13 个 ad-*/probe-* 插件的 97 条
// 域级 REJECT 完全没有存活门禁。插件域是**精确 DOMAIN**(109 条里 108 条), 判据随之
// 不同: 精确 host 无 A 记录即"无连接可建、规则空转", 不能沿用「裸域 NXDOMAIN 不代
// 表死规则」那条 —— 它只对 SUFFIX 成立(imtmp.net 的 7 个存活子域)。
const PLUGIN_DIR = path.join(REPO, "Plugin");

/** 插件 [Rule] 段里可探针的条目; AND/KEYWORD 类无法探针, 由调用方单独计数 */
function pluginRuleEntries() {
  const out = [];
  for (const f of fs.readdirSync(PLUGIN_DIR).filter((x) => x.endsWith(".plugin")).sort()) {
    const lines = fs.readFileSync(path.join(PLUGIN_DIR, f), "utf8").split("\n");
    // 生成块里的规则**不在这里探活**: 它们是覆盖管线在生成时逐条实测过的(证据带日期写在
    // test/fixtures/ad-coverage/ledger.json), 由 coverage-refresh 定期重跑自动增删。
    // 在 PR 时重复探 443 个域 = 把测试从 1 分钟拖到 4 分钟, 却换不来新的信息
    // (生成式规则"死掉"的正确处置是重跑管线, 不是红一条 PR)。新鲜度由下方专门用例守。
    let inGenerated = false;
    let sec = null;
    for (const l of lines) {
      const t = l.trim();
      if (/^# >>> GENERATED:/.test(t)) { inGenerated = true; continue; }
      if (/^# <<< GENERATED:/.test(t)) { inGenerated = false; continue; }
      if (/^\[[A-Za-z ]+\]$/.test(t)) { sec = t; continue; }
      if (inGenerated) continue; // 交给覆盖管线与新鲜度用例
      if (sec !== "[Rule]" || !t || t.startsWith("#")) continue;
      const m = t.match(/^(DOMAIN|DOMAIN-SUFFIX),\s*([\w.-]+),\s*(REJECT|DIRECT)\b/i);
      if (m) out.push({ file: f, type: m[1].toUpperCase(), host: m[2].toLowerCase(), policy: m[3].toUpperCase() });
    }
  }
  return out;
}

/** 精确 host 是否有 A 记录 (dig +short 会同时打印 CNAME, 故只认 IPv4 行); null = 解析器不可达 */
function hasAddress(name, resolver) {
  try {
    const out = execFileSync(
      "dig",
      ["+time=3", "+tries=1", `@${resolver}`, name, "A", "+short"],
      { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "ignore"] }
    );
    return out.split("\n").some((l) => /^\d{1,3}(\.\d{1,3}){3}$/.test(l.trim()));
  } catch {
    return null;
  }
}

/** 逐级回退查 NS: host 本身 → 末三段 → 末两段, 任一有 NS 即认为域名仍注册 */
function zoneRegistered(host) {
  const parts = host.split(".");
  const candidates = [...new Set([host, parts.slice(-3).join("."), parts.slice(-2).join(".")])].filter((c) => c.includes("."));
  for (const c of candidates) if (nsAlive(c)) return true;
  return false;
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

  // ── 插件层 (2026-09-29) ────────────────────────────────────────────────
  // 与主配置同源的风险, 此前完全没有门禁覆盖。姿态与上一条一致, 但判据按精确 host 收紧。
    "dns-live: 生成式规则必须有台账证据, 且台账不过期": async (a) => {
    // 为什么用"证据 + 新鲜度"替代"每次重探": 生成块里的规则是覆盖管线在生成时逐条实测过的,
    // 443 条域全部在 PR 时重探只换来 3 分钟耗时; 真正要守的是两件事 ——
    //   ① 条条有据: 每条生成规则在 ledger 里都有 verdict=block 且 live 的记录(不是凭空写的);
    //   ② 证据不过期: 超过 45 天未重跑即判红, 提醒跑 coverage-refresh(广告端点churn 极快)。
    const ledgerPath = path.join(REPO, "test", "fixtures", "ad-coverage", "ledger.json");
    a.ok(fs.existsSync(ledgerPath), "缺少覆盖台账 test/fixtures/ad-coverage/ledger.json —— 生成块就是无据之词");
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    const evidence = new Map();
    for (const e of ledger.entries || []) if (e.verdict === "block") evidence.set(e.host.toLowerCase(), e);
    const generated = [];
    for (const f of fs.readdirSync(PLUGIN_DIR).filter((x) => x.endsWith(".plugin")).sort()) {
      const txt = fs.readFileSync(path.join(PLUGIN_DIR, f), "utf8");
      for (const m of txt.matchAll(/^# >>> GENERATED:(\w+)[^\n]*\n([\s\S]*?)^# <<< GENERATED:\1 <<</gm)) {
        for (const line of m[2].split("\n")) {
          const d = /^DOMAIN,\s*([\w.-]+),\s*REJECT$/.exec(line.trim());
          if (d) generated.push({ file: f, host: d[1].toLowerCase() });
        }
      }
    }
    a.ok(generated.length > 0, "未发现任何生成式规则 —— 覆盖管线产物缺失或标记被改");
    const noEvidence = generated.filter((g) => {
      const e = evidence.get(g.host);
      return !e || !(e.a || []).some((n) => n > 0);
    });
    a.equal(
      noEvidence.length,
      0,
      `${noEvidence.length} 条生成规则没有"存活"证据: ${noEvidence.slice(0, 5).map((g) => g.host).join(", ")}`
    );
    const ageDays = (Date.now() - Date.parse(ledger.generated_at)) / 86400000;
    a.ok(
      ageDays <= 45,
      `覆盖台账已过期 ${Math.round(ageDays)} 天(阈值 45) —— 跑 \`node tools/ad-coverage.mjs --run\` 刷新: ` +
        `广告端点上下线极快, 过期证据等于没有证据`
    );
  },

  "dns-live: 插件域不得是域名已注销的残留 (插件层此前无覆盖)": async (a) => {
    if (!probeSelfCheck()) {
      a.ok(true, "跳过: 公共 DNS 不可达");
      return;
    }
    const entries = pluginRuleEntries();
    // 覆盖地板: 解析正则一旦失效、把扫描集缩到 0, 本门禁会**静默转绿** —— 这正是本仓
    // 反复踩过的「看起来有门禁其实没有」(见 APP-ONBOARDING.md 的 indexOf 段陷阱)。
    a.ok(
      entries.length >= 100,
      `插件层可探针条目 ${entries.length} 条 (期望 ≥100) —— 少于 100 说明 ad-*/probe-* 插件已被删/改, ` +
        `或解析正则漂移, 门禁可能已在空转`
    );
    // SUFFIX 条目要额外探「别处显式登记过的同后缀 host」, 沿用主配置那条的权威判据
    const known = new Set([...registeredHosts(), ...entries.map((e) => e.host)]);
    const dead = [];
    const dormant = [];
    for (const e of entries) {
      const names = new Set([e.host]);
      if (e.type === "DOMAIN-SUFFIX") {
        for (const s of SUBDOMAINS) names.add(`${s}.${e.host}`);
        for (const h of known) if (h.endsWith(`.${e.host}`)) names.add(h);
      }
      let anyAlive = false;
      let reachable = false;
      for (const n of names) {
        for (const r of RESOLVERS) {
          const has = hasAddress(n, r);
          if (has === null) continue; // 该解析器不可达
          reachable = true;
          if (has) { anyAlive = true; break; }
        }
        if (anyAlive) break;
      }
      if (anyAlive || !reachable) continue;
      // NS 仍活跃 = 平台下线了子域但域名还在, 随发版可能回来 → 只报告
      if (zoneRegistered(e.host)) dormant.push(`${e.file}: ${e.type} ${e.host} → ${e.policy}`);
      else dead.push(`${e.file}: ${e.type} ${e.host} → ${e.policy}`);
    }
    if (dormant.length) {
      console.log(
        `ℹ️  ${dormant.length} 条插件域当前无 A 记录但域名仍注册(NS 活跃, 随时可能恢复, 保留):\n     ` +
          dormant.join("\n     ")
      );
    }
    a.equal(
      dead.length,
      0,
      `${dead.length} 条插件域在全部解析器上无 A 记录且 NS 亦已注销 —— ` +
        `精确 DOMAIN 规则永不命中, 白占一条:\n  ${dead.join("\n  ")}\n` +
        `处置: 平台确已下线该子域则从插件删除(并同步 MODULE-MANIFEST 的域数); ` +
        `若只是主机名写错, 改为正确 host。\n` +
        `⚠️ ad SDK 子域上下线频繁(appads.txt 基准实测 24 个候选子域 DoH 解析 0 条), ` +
        `故「无 A 但 NS 活跃」只报告不判红 —— 删除是不可逆误伤。`
    );
  },
};
