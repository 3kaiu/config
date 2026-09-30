"use strict";
/**
 * L0 覆盖管线 (tools/ad-coverage.mjs) 的行为回归 (2026-09-30)
 *
 * 这条管线会把**几百条**规则一次写进 L0 插件, 所以判据次序必须被用例钉死 ——
 * 任何一道判据被改松, 都会在无人察觉的情况下把"功能域"或"泛解析假信号"变成 REJECT。
 * 本文件按**判据优先级**逐条断言, 顺序本身就是设计的一部分:
 *   无 A → 泛解析 → 多业务大厂 → 功能即产品 → 才允许 block
 */
const fs = require("fs");
const path = require("path");

let mod = null;
const load = async () => (mod ??= await import("../../tools/ad-coverage.mjs"));
const ROOT = path.join(__dirname, "..", "..");
const live = (a = 2) => ({ a: [a, a], live: a > 0, https: "ECONNREFUSED" });

exports.tests = {
  "社区清单: 解析只取 DOMAIN/SUFFIX, 其余形态计数留档 (不静默丢弃)": async (a) => {
    const { parseCommunity } = await load();
    const src = [
      "#!name=x",
      "[Rule]",
      "DOMAIN, a.example.com, REJECT",
      "DOMAIN, a.example.com, REJECT",
      "DOMAIN-SUFFIX, b.example.com, REJECT",
      "DOMAIN-KEYWORD, adstrategy, REJECT",
      "AND, ((DOMAIN-KEYWORD, x), (DOMAIN-SUFFIX, y)), DIRECT",
      "IP-CIDR, 1.2.3.4/32, REJECT, no-resolve",
      "USER-AGENT, \"httpdns*\", REJECT",
    ].join("\n");
    const p = parseCommunity(src);
    a.equal(p.domains.join(","), "a.example.com", "精确域去重");
    a.equal(p.suffixes.join(","), "b.example.com");
    a.equal(p.skipped.keyword, 1, "裸关键词要计数(本仓不采纳, 但必须可见)");
    a.equal(p.skipped.and + p.skipped.ip + p.skipped.userAgent, 3, "其余形态都要计数");
  },

  "社区清单: 支付/Apple/推送红线一律不进候选, 归因类转 M3 台账": async (a) => {
    const { communityCandidates } = await load();
    const community = {
      slug: "t",
      domains: ["ads.cup.com.cn", "app-analytics-services.com", "api.push.jpush.cn", "adjust.com", "ads.example.net"],
      suffixes: ["alipay.com", "appsflyersdk.com", "adscope.cn"],
    };
    const cands = communityCandidates(community, []);
    const hosts = cands.map((c) => c.host);
    for (const bad of ["ads.cup.com.cn", "app-analytics-services.com", "api.push.jpush.cn", "alipay.com"]) {
      a.ok(!hosts.includes(bad), `红线域不得进候选: ${bad}`);
    }
    a.equal(cands.find((c) => c.host === "adjust.com")?.kind, "m3-defer", "归因 SDK 归 M3, 不进 M2 广告块");
    a.equal(cands.find((c) => c.host === "appsflyersdk.com")?.kind, "m3-defer", "后缀形态的归因域同样归 M3");
    a.ok(hosts.includes("ads.example.net") && hosts.includes("adscope.cn"), "非红线广告域正常进候选");
  },

  "社区后缀域: apex 像网站(200/HTML)不整域拦, apex 是端点才允许": async (a) => {
    const { verdictOf } = await load();
    const e = { source: "kelee", host: "x.example.com", kind: "suffix-apex" };
    a.equal(verdictOf(e, { live: true, a: 2, https: "200" }).verdict, "expand", "apex 200 ⇒ 降级枚举");
    a.equal(verdictOf(e, { live: true, a: 2, https: "302+html" }).verdict, "expand", "apex HTML ⇒ 降级枚举");
    a.equal(verdictOf(e, { live: true, a: 2, https: "ECONNREFUSED" }).verdict, "block", "端点型 apex ⇒ 允许整域拦");
    a.equal(verdictOf(e, { live: false }).verdict, "expand", "apex 无 A ⇒ 降级枚举(不是丢弃)");
  },


  "社区清单 fixture: sha256/来源/新鲜度三要素齐备 (基准未钉死即红)": async (a) => {
    const fs = require("fs");
    const p = "test/fixtures/ad-coverage/community/kelee-advertisers.json";
    a.ok(fs.existsSync(p), "缺社区清单 fixture —— 跑 node tools/ad-coverage.mjs --fetch-community");
    const c = JSON.parse(fs.readFileSync(p, "utf8"));
    a.ok(/^[0-9a-f]{64}$/.test(c.sha256), "sha256 必须是 64 位十六进制(漂移检测的锚)");
    a.ok(c.url && c.origin, "必须同时记镜像 URL 与原始来源(kelee.one 有 Turnstile, 溯源要写清)");
    a.ok(c.counts && c.counts.domain > 0 && c.counts.suffix > 0, "计数要留档");
    const days = (Date.now() - Date.parse(c.fetched_at)) / 86400000;
    a.ok(days <= 90, `社区清单 ${c.fetched_at} 已 ${Math.round(days)} 天未复核(>90 天判红: 上游会变)`);
  },

  "真仓库: 生成规则零重复 (跨来源不得各生成一遍)": async (a) => {
    const fs = require("fs");
    const txt = fs.readFileSync("Plugin/ad-block.plugin", "utf8");
    const rules = txt.split("\n").map((l) => l.trim()).filter((l) => /^DOMAIN(-SUFFIX)?,/.test(l));
    const dup = rules.filter((r, i) => rules.indexOf(r) !== i);
    a.equal(dup.length, 0, `重复规则: ${[...new Set(dup)].slice(0, 5).join(" | ")}`);
    // 后缀整域拦只允许出现在生成块内(手写 SUFFIX 会误伤同域功能)
    const outside = txt
      .replace(/# >>> GENERATED:[\s\S]*?# <<< GENERATED:\w+/g, "")
      .split("\n")
      .filter((l) => /^DOMAIN-SUFFIX,/.test(l.trim()));
    a.equal(outside.length, 0, `生成块外出现整域拦: ${outside.slice(0, 3).join(" | ")}`);
  },

  "coverage: 判据次序 (无 A → 泛解析 → 大厂 → 功能即产品 → block)": async (a) => {
    const { verdictOf } = await load();
    const adOnly = { source: "ad", host: "api.example-adnet.com", platform: "example-adnet.com" };
    a.equal(verdictOf(adOnly, { live: false, a: [0, 0], https: null }).reason, "no-a-record", "无 A 必须最先被排除");
    a.equal(
      verdictOf(adOnly, live(), { panResolution: true }).reason,
      "pan-resolution-wildcard-not-a-real-endpoint",
      "泛解析根域必须转人工复核 —— 本仓教训: A 记录存在 ≠ 端点存在"
    );
    a.equal(
      verdictOf({ ...adOnly, diversified: true }, live()).reason,
      "diversified-vendor-needs-manual-judgment",
      "多业务大厂(google/facebook/unity…) 必须转人工 —— 实测差点生成 api.google.com / static.facebook.com"
    );
    a.equal(
      verdictOf({ ...adOnly, functionalProduct: true }, live()).reason,
      "functional-product-needs-manual-judgment",
      "功能即产品(播放器/评论组件/App 后端) 必须转人工 —— 拦了是破功能不是去广告"
    );
    a.equal(verdictOf(adOnly, live()).verdict, "block", "五道判据全过才允许生成规则");
    a.equal(
      verdictOf(adOnly, { a: [2, 2], live: true, https: "200+html" }).verdict,
      "review",
      "HTTPS 根路径 200+HTML = 疑似真实站点 ⇒ 不自动拦"
    );
  },

  "coverage: 硬红线 (推送/商店/系统) 永不进候选": async (a) => {
    const { hardDenied } = await load();
    for (const h of ["api-push.meizu.com", "xmpush.xiaomi.com", "ad.apk.vivo.com.cn", "msg.umeng.com"]) {
      a.ok(hardDenied(h), `${h} 属硬红线, 必须被拒(断推送/商店 = 真功能损失)`);
    }
    a.ok(!hardDenied("api.example-adnet.com"), "普通广告域不该被红线误伤");
  },

  "coverage: 生成块标记读写往返一致 (产物漂移可检出)": async (a) => {
    const { renderBlock, applyBlock, readBlock } = await load();
    const tmp = path.join(require("os").tmpdir(), `cov-${process.pid}.plugin`);
    fs.writeFileSync(tmp, "#!name=test\n[Rule]\nDOMAIN, keep.me, REJECT\n");
    const entries = [{ host: "api.a.com" }, { host: "sdk.b.com" }];
    const block = renderBlock(entries, { source: "ad", generatedAt: "2026-09-30", policy: "p" });
    fs.writeFileSync(tmp, applyBlock(tmp, "ad", block));
    const got = readBlock(tmp, "ad");
    a.equal(got.trim(), block.trim(), "写入后读回必须逐字节一致");
    const text = fs.readFileSync(tmp, "utf8");
    a.ok(text.includes("DOMAIN, keep.me, REJECT"), "生成块不得吞掉人工策展的内容");
    a.ok(text.includes("DOMAIN, api.a.com, REJECT"), "生成块必须含台账条目");
    // 再次写入(幂等)不得叠加第二块
    fs.writeFileSync(tmp, applyBlock(tmp, "ad", block));
    a.equal(fs.readFileSync(tmp, "utf8").split(">>> GENERATED:ad").length - 1, 1, "重复写入必须原地替换而不是追加");
    fs.unlinkSync(tmp);
  },

  "coverage: 真仓库生成块与台账一致, 且只出现在 L0 三插件": async (a) => {
    const { check, readLedger, entriesFor, PLUGIN_FOR } = await load();
    const r = check();
    a.ok(r.ok, `产物漂移: ${r.problems.join("; ")}`);
    const ledger = readLedger();
    a.ok(ledger && Array.isArray(ledger.entries) && ledger.entries.length > 100, "台账应包含全部候选(含被跳过的), 不只是生成项");
    const adEntries = entriesFor(ledger, "ad");
    a.ok(adEntries.length >= 100, `广告层生成规则应 ≥100 条, 实为 ${adEntries.length}`);
    // 生成块只允许出现在 L0 三插件
    for (const f of fs.readdirSync(path.join(ROOT, "Plugin"))) {
      if (!f.endsWith(".plugin")) continue;
      const txt = fs.readFileSync(path.join(ROOT, "Plugin", f), "utf8");
      if (/>>> GENERATED:/.test(txt)) {
        a.ok(Object.values(PLUGIN_FOR).includes(`Plugin/${f}`), `Plugin/${f} 出现生成块, 但它不属 L0 三插件`);
      }
    }
  },
};
