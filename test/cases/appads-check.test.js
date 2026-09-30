/**
 * tools/appads-check.mjs 行为回归 (2026-09-29 首版; 2026-09-30 扩参考清单层与平台层取证)
 *
 * 背景: 插件里那批域级 REJECT 首版自称"基准取自广告主 App 的 AdMob app-ads.txt", 文件没入库、
 * URL 没记 —— 属"作者说是就是"。2026-09-30 溯源(SOURCE.json baseline.provenance_audit):
 * 该叙述**不成立** —— 首版 21 条全是子域, 而 IAB app-ads.txt 声明的是 ad system 根域。
 *
 * 由此定下两把钥匙, 本用例分别守:
 *   ① 平台层: 被拦平台必须有一手声明(attestation) —— 或显式台账记账且**每次运行可见**;
 *   ② 端点层: 具体主机要有 DoH + HTTPS 证据(见 test/cases/dns-liveness.test.js)。
 *
 * 本用例全部离线: 断言打在合成夹具(app-ads.sample.txt)、已入库的语料派生文件与纯函数上。
 */
"use strict";

const fs = require("fs");
const path = require("path");

let mod = null;
const load = async () => (mod ??= await import("../../tools/appads-check.mjs"));
const FIXTURE = path.join(__dirname, "..", "fixtures", "appads", "app-ads.sample.txt");
const fixtureText = () => fs.readFileSync(FIXTURE, "utf8");

exports.tests = {
  "appads: 解析 IAB 格式 (变量行/注释/畸形行/去重/DIRECT|RESELLER/认证机构)": async (a) => {
    const { parseAppAds } = await load();
    const { entries, malformed } = parseAppAds(fixtureText());
    a.equal(entries.length, 10, `ad system 数应为 10 (去重后), 实为 ${entries.length}`);
    a.equal(malformed.length, 1, "畸形行必须计入 malformed —— 静默丢弃会让'没被识别的域'变成不可见缺口");
    a.ok(entries.every((e) => !/^[A-Z_]+=/.test(e.domain)), "变量行(CONTACT=/SUBDOMAIN=…)不得被当成条目");
    a.ok(!entries.some((e) => e.domain.startsWith("#")), "注释不得被当成条目");
    const cb = entries.find((e) => e.domain === "chartboost.com");
    a.equal(cb.relation, "RESELLER", "DIRECT|RESELLER 必须保真");
    a.equal(cb.certAuthority, "f08c47fec0942fa0", "认证机构 ID 必须保真");
    a.equal(entries.filter((e) => e.domain === "applovin.com").length, 1, "同一 ad system 重复声明须去重");
  },

  "appads: 双向比对四桶 (真仓库规则 + 真台账)": async (a) => {
    const { parseAppAds, classify } = await load();
    const { collectRules, ROOT } = await import("../../tools/lib/rule-scan.mjs");
    const { entries } = parseAppAds(fixtureText());
    const { buckets, undeclared, declared } = classify(entries, collectRules(ROOT));
    const doms = (x) => x.map((e) => e.domain).sort();
    a.equal(
      doms(buckets.covered).join(","),
      "applovin.com,chartboost.com,ironsrc.com,smaato.com,supersonicads.com,unity3d.com,vungle.com",
      "covered = 清单声明且本仓有规则命中 (2026-09-30 社区清单复核后 supersonicads 由 gap 转入)"
    );
    a.equal(doms(buckets.excluded).join(","), "mopub.com,streamkey.tv", "excluded 取台账, 不重复报为 gap");
    a.equal(
      doms(buckets.gap).join(","),
      "ads.example.net",
      "gap = 声明了但既没拦也没排除(发现项) —— 生成式覆盖转走 ironsrc/smaato, 社区复核转走 supersonicads"
    );
    a.equal(declared.length, 10, "声明域去重后 10 个");
    a.ok(undeclared.includes("umeng.com"), "undeclared 方向要能报出本仓拦了但清单没声明的根域");
    a.ok(!undeclared.includes("applovin.com") && !undeclared.includes("smaato.com"), "已声明/已排除的不得出现在 undeclared");
    a.ok(!undeclared.includes("com.cn"), "公共后缀碎片(com.cn)不是平台根域, 不得混入");
  },

  "appads: 快照漂移必须被检出 (基准过期不许静默)": async (a) => {
    const { sha256, driftNotice } = await load();
    const text = fixtureText();
    const baseline = { pinned: true, url: "https://example.com/app-ads.txt", sha256: sha256(text) };
    a.equal(driftNotice(sha256(text), baseline), null, "一致时无漂移");
    const drifted = driftNotice(sha256(`${text}\nsmaato.com, 999, DIRECT\n`), baseline);
    a.ok(drifted && /快照漂移/.test(drifted), "上游变了必须判红");
    a.ok(/复核差异后更新 snapshot/.test(drifted), "报错须给出处置动作");
    a.equal(driftNotice(sha256(text), { pinned: false, sha256: null }), null, "未钉死时不做漂移判定(缺口另行可见)");
  },

  "appads: 基准钉死与缺口可见性 (两种缺口都不许静默)": async (a) => {
    const { readSource, sourceNotice, run, render } = await load();
    const src = readSource();
    const baseline = src.baseline;
    // 现在的基准是**多份一手声明语料**(kind=first-party-attestation), 钉死判据是"pinned + 语料可复核"。
    a.equal(baseline.kind, "first-party-attestation", "基准必须是多源一手声明语料");
    a.equal(baseline.pinned, true, "语料已入库 ⇒ 钉死");
    a.ok(sourceNotice(baseline) === null, "钉死后不再报'基准源缺失'");
    // 但"未钉死"这条纪律本身不能丢: 合成一个未钉死的 baseline, 缺口仍须显性。
    const unpinned = { pinned: false, reason: "合成: 源缺失", ruled_out: [], unblocks: "给一个 URL" };
    const notice = sourceNotice(unpinned);
    a.ok(notice && /证据缺口/.test(notice), "未钉死必须显性报出缺口");
    a.ok(/解除条件/.test(notice), "缺口说明必须给出解除条件(要什么才能做)");
    a.ok((baseline.ruled_out || []).length >= 2, "必须记录已排除的替代源及实测理由 —— 否则后人会把 sellers.json 再试一遍");
    a.ok(
      baseline.ruled_out.some((x) => /sellers\.json/.test(x.candidate) && /2399|PUBLISHER/.test(x.measured)),
      "sellers.json 的实测证据(全 PUBLISHER/无自身域)必须留档"
    );
    a.ok(
      baseline.ruled_out.some((x) => /某一份 App/.test(x.candidate)),
      "「单文件基准」本身也必须作为已否决源留档(它是首版做法)"
    );
    const r = run({ file: FIXTURE });
    a.ok(/gap/.test(render(r.result)), "渲染输出必须给出 gap 桶");
    a.ok(/DoH \+ HTTPS 取证/.test(render(r.result)), "gap 旁边必须写明变成规则前的取证要求");
  },

  "appads: 溯源结论必须留档 (单文件基准被证伪的四条硬证据)": async (a) => {
    const { readSource } = await load();
    const audit = readSource().baseline.provenance_audit;
    a.ok(audit, "必须有 provenance_audit —— 否则'基准取自某份 app-ads.txt'这类叙述还会回流");
    a.ok(/不成立/.test(audit.verdict), "结论必须写明原叙述不成立");
    const ev = audit.evidence.join("\n");
    a.ok(/子域/.test(ev) && /根域/.test(ev), "必须记录『app-ads.txt 声明根域, 首版 21 条是子域』这条决定性证据");
    a.ok(/200005|20 万/.test(ev), "必须记录语料规模(44 份 / 200005 行)");
    a.ok(/4d4b8f7/.test(ev), "必须留下本仓自己的物证(git 历史里的社区清单镜像 commit)");
    a.ok(/goodbyeads/i.test(ev), "必须点名社区清单 GOODBYEADS(含 d.applovin.com 的那份)");
    a.ok(/api\.chartboost\.com|api\.fyber\.com/.test(ev), "必须列出查不到出处的端点域, 说明它们是枚举+探针产物");
    a.ok(/supersonicads\.com/.test(ev), "必须记录 0 声明的反向证据");
    a.ok(audit.lesson && /两把钥匙|端点/.test(audit.lesson), "必须留下可复用教训(平台声明 ≠ 端点存在)");
    // 21 条子域不许再被当成"清单声明过的域": 入库语料里必须一条都查不到(离线可复跑)。
    const { readReferences } = await load();
    const refs = readReferences();
    const declared = new Set(refs.flatMap((r) => (r.systems || []).map((s) => s.domain)));
    const first21 = [
      "d.applovin.com", "ads.applovin.com", "api.applovin.com", "ads.api.vungle.com", "events.api.vungle.com",
      "config.ads.vungle.com", "adx-cn.ads.vungle.com", "api.chartboost.com", "api.fyber.com", "api.mintegral.com",
      "api.tapjoy.com", "api.ogury.com", "ads.adcolony.com", "api.admost.com", "init.startappservice.com",
      "req.startappservice.com", "images.startappservice.com", "init.startappexchange.com", "cdn1.smartadserver.com",
      "ww251.smartadserver.com", "www6.smartadserver.com",
    ];
    const leaked = first21.filter((d) => declared.has(d));
    a.equal(leaked.length, 0, `这 21 条是端点主机, 不该出现在任何 app-ads.txt 的声明里, 实测漏进语料: ${leaked.join(",")}`);
  },

  "appads: 平台层取证门禁 (被拦平台必须有一手声明或有台账理由)": async (a) => {
    const { platformGate, readReferences, runAttestation, renderPlatformGate } = await load();
    const { collectRules } = await import("../../tools/lib/rule-scan.mjs");
    const refs = readReferences();
    const rules = collectRules();
    const gate = platformGate(rules, refs, { threshold: 3 });
    a.ok(gate.rows.length >= 10, `国际插件的平台归属行应 ≥10, 实为 ${gate.rows.length}`);
    a.equal(gate.fails.length, 0, `真仓库不该有'无归属无声明'的规则: ${gate.fails.map((f) => f.domain).join(",")}`);
    // 合成违规: 一个既不在语料里、也不在台账里的域必须判红(纯函数, 不起仓库)。
    const fake = platformGate(
      [{ source: "Plugin/ad-intl-fake.plugin", line: 7, text: "DOMAIN, api.evil-ads-not-declared.example, REJECT" }],
      refs,
      { threshold: 3 }
    );
    a.equal(fake.fails.length, 1, "无声明且无台账归属 ⇒ 必须判红");
    a.ok(/类别误标|补归属证据/.test(fake.fails[0].reason), "判红理由必须点明'端点活着不能代替平台声明'");
    // 有台账的别名域(adview.cn → adview.com)不许判红, 且必须归到真平台。
    const alias = platformGate(
      [{ source: "Plugin/ad-intl-fake.plugin", line: 8, text: "DOMAIN, bid.adview.cn, REJECT" }],
      refs,
      { threshold: 3 }
    );
    a.equal(alias.rows[0].platform, "adview.com", "adview.cn 必须归到 ad system 域 adview.com");
    a.equal(alias.fails.length, 0, "台账记账过的别名域不判红");
    // 真仓库: gated 输出必须把"声明数 + 归属 + 待裁决项"都打出来。
    const real = runAttestation();
    const text = renderPlatformGate(real.gate);
    a.ok(/平台层取证/.test(text) && /dns-liveness/.test(text), "输出必须标明判据与另一把钥匙的去处");
    a.ok(/份声明/.test(text), "每行必须给声明份数");
    a.ok(real.platformGaps.length > 0, "平台缺口(有声明未拦)必须非空 —— 这是缺域在平台粒度的形态");
  },

  "appads: 端点域归属台账自洽 (别名必须显式, 不许后缀猜)": async (a) => {
    const { AD_PLATFORM_MAP, ALLOWED_KINDS, attributionOf } = await import("../../tools/lib/ad-platform-map.mjs");
    a.ok(AD_PLATFORM_MAP.length >= 4, "台账至少要有 startapp 两条别名 + adview 跨国站 + admost 本体");
    const seen = new Set();
    for (const e of AD_PLATFORM_MAP) {
      a.ok(!seen.has(e.domain), `域不得重复: ${e.domain}`);
      seen.add(e.domain);
      a.ok(ALLOWED_KINDS.has(e.kind), `kind 必须取闭集内值: ${e.domain}`);
      a.ok(e.platform && e.reason && e.evidence, `每条都要有 platform/reason/evidence: ${e.domain}`);
      a.ok(!/看起来像|大概|可能/.test(e.reason + e.evidence), `理由不许含推测措辞: ${e.domain}`);
      if (e.kind === "endpoint-of") a.ok(e.platform !== e.domain, "endpoint-of 必须指向另一个平台域");
    }
    a.ok(
      AD_PLATFORM_MAP.some((e) => e.declaration_gap),
      "必须至少有一条 declaration_gap(无一手声明却保留) —— 它每次运行可见, 是待裁决项"
    );
    // 最长后缀优先: api.admost.com 归 admost.com, 而不是被 com 或别的条目吃掉。
    a.equal(attributionOf("api.admost.com").domain, "admost.com");
    a.equal(attributionOf("init.startappservice.com").platform, "startapp.com");
    a.ok(attributionOf("example.com") === null, "未登记的域必须返回 null(否则门禁失去判红能力)");
  },

  "appads: 抽查表与入库语料自洽 (committed ⊆ survey, 计数单调)": async (a) => {
    const { readSource, readReferences } = await load();
    const survey = readSource().baseline.survey;
    a.equal(survey.files, 44, "抽查规模 44 份要留档(它是首版 21 条子域 0 命中的分母)");
    a.equal(survey.declared_lines, 200005, "声明行数要留档(类别不符的量化证据)");
    a.equal(survey.attested.length, 20, "逐平台声明表要留档");
    const refs = readReferences();
    const committed = new Map();
    for (const r of refs) for (const s of r.systems || []) committed.set(s.domain, (committed.get(s.domain) || 0) + 1);
    for (const e of survey.attested) {
      const got = committed.get(e.domain) || 0;
      a.ok(got <= e.files, `入库语料是抽查的子集 ⇒ ${e.domain} 的入库计数 ${got} 不得大于抽查 ${e.files}`);
    }
    const zero = survey.attested.filter((e) => e.files === 0).map((e) => e.domain).sort().join(",");
    a.equal(
      zero,
      "admost.com,startappexchange.com,startappservice.com,supersonicads.com",
      "0 声明的平台集合必须精确留档 —— 它是'未决'与'待裁决'的正面证据"
    );
  },

  "appads: 插件注释不得再自称 app-ads.txt 基准 (叙述偏差不许回流)": async (a) => {
    const text = fs.readFileSync(path.join(__dirname, "..", "..", "Plugin", "ad-block.plugin"), "utf8");
    const claims = text
      .split("\n")
      .filter((l) => /app-ads\.txt/.test(l) && /基准/.test(l) && !/不是|不成立|不再|不\*\*/.test(l));
    a.equal(claims.length, 0, `提到"基准"与"app-ads.txt"的行必须是更正/否定句, 实为: ${claims.join(" / ")}`);
    a.ok(/不成立/.test(text), "必须写明首版叙述已被证伪");
    a.ok(/两把钥匙/.test(text) && /端点活着不能代替平台声明/.test(text), "必须写明两把钥匙判据");
    a.ok(/ad-platform-map\.mjs/.test(text) && /declaration_gap/.test(text), "必须指向归属台账与待裁决项");
    a.ok(/4d4b8f7/.test(text) && /goodbyeads/i.test(text), "必须留下真实来源的物证(社区清单镜像 commit)");
  },

  "appads: 候选流水线 (两把钥匙; 只报告不写规则)": async (a) => {
    const { triage, runTriage, readReferences } = await load();
    const { collectRules } = await import("../../tools/lib/rule-scan.mjs");
    const refs = readReferences();
    const rules = collectRules();
    const rows = triage(refs, rules, { top: 5 });
    a.ok(rows.length > 0, "应产出候选平台行");
    // 钥匙① 地板: 低于 threshold 的平台不得进候选(候选表的语义 = 已有一手声明)
    for (const r of rows) a.ok(r.files >= 3, `${r.platform} 只有 ${r.files} 份声明, 不该进候选(阈值 3)`);
    // 已拦平台不得进候选(否则候选表变成噪声)
    a.ok(!rows.some((r) => r.platform === "applovin.com"), "已拦平台 applovin.com 不该出现在候选里");
    // 候选 host = 平台 × 前缀, 且默认不带实测结果(离线路径绝不联网)
    const flat = rows.flatMap((r) => r.hosts);
    a.ok(flat.length >= rows.length * 10, "每个平台应展开 10 个前缀候选");
    a.ok(flat.every((h) => h.probe === null), "离线 triage 不得带实测结果(联网只发生在 --probe)");
    // 注入式实测: 只改标记, 不改候选集
    const injected = triage(refs, rules, { top: 5, probes: { [flat[0].host]: { a: 2, status: "0/0", mismatch: false } } });
    a.equal(injected[0].hosts[0].probe?.a, 2, "注入的实测结果应被采用");
    a.equal(injected.length, rows.length, "注入实测不得改变候选集");
    // 只报告: 输出里不得出现可直接落地的规则行(枚举产物 ≠ 规则)
    const { text } = await runTriage({ top: 3 });
    a.ok(!/^DOMAIN,/m.test(text), "候选输出不得包含 DOMAIN 规则行 —— 自动写规则正是首版 21 域的坑");
    a.ok(/不写任何规则/.test(text) && /第 1 节/.test(text), "输出必须声明只报告, 且把第三问交回人");
  },

  "appads: 解析面地板 (夹具域数 + 畸形行都要对得上)": async (a) => {
    const { parseAppAds } = await load();
    const { entries, malformed } = parseAppAds(fixtureText());
    a.ok(entries.length >= 8, `域数 ${entries.length} (期望 ≥8) —— 过低说明解析器已漂移`);
    a.equal(malformed.map((m) => m.line).join(","), "24", "畸形行行号必须可定位(夹具第 24 行)");
  },

  // ── 参考清单层 (第三方发行商公开清单, 只用于发现) ────────────────────
  "appads-ref: 派生文件自洽 (URL/sha256/域集齐备, 且与源列表一一对应)": async (a) => {
    const { readSource, readReferences } = await load();
    const src = readSource();
    const refs = readReferences();
    const sources = src.references.sources;
    a.ok(refs.length >= 5, `参考清单 ${refs.length} 份 (期望 ≥5) —— 过少说明派生文件缺失`);
    a.equal(
      refs.map((r) => r.slug).join(","),
      sources.map((s) => s.slug).sort().join(","),
      "派生文件与 SOURCE.json.references.sources 必须一一对应(不许有孤儿文件)"
    );
    for (const r of refs) {
      a.ok(/^https:\/\//.test(r.url), `${r.slug} 必须留 URL —— 原始文件不入库, 全靠它重抓核对`);
      a.ok(/^[0-9a-f]{64}$/.test(r.sha256), `${r.slug} sha256 形态合法`);
      a.ok(r.bytes > 1000, `${r.slug} bytes 记录真实(实测 ${r.bytes})`);
      a.ok((r.systems || []).length >= 100, `${r.slug} 派生域集 ${(r.systems || []).length} 个 (期望 ≥100) —— 过低说明抓取被截断`);
      a.ok(/不得直接当规则/.test(r._warning || ""), `${r.slug} 必须自带"不得直接当规则"标记, 防被直接抄成规则`);
    }
  },

  "appads-ref: 共识聚合 (出现份数 / DIRECT / RESELLER 计数与排序)": async (a) => {
    const { readReferences, consensus } = await load();
    const refs = readReferences();
    const cons = consensus(refs);
    a.ok(cons.length >= 300, `共识域 ${cons.length} 个 (期望 ≥300) —— 过低说明派生文件内容异常`);
    for (const c of cons.slice(0, 50)) {
      a.ok(c.refs >= 1 && c.refs <= refs.length, `${c.domain} refs 计数在范围内`);
      a.ok(c.direct + c.reseller >= c.refs, `${c.domain} direct+reseller 应≥ refs(同域可被不同发行商按不同关系声明)`);
    }
    const sorted = cons.every((c, i) => i === 0 || cons[i - 1].direct >= c.direct);
    a.ok(sorted, "共识必须按 DIRECT 声明数降序 —— 直接关系比 reseller 链条证据强");
  },

  "appads-ref: 缺域发现 + 反向核对 (两个方向都要出结果)": async (a) => {
    const { readReferences, discovery, reverseAudit } = await load();
    const { collectRules, ROOT } = await import("../../tools/lib/rule-scan.mjs");
    const refs = readReferences();
    const rules = collectRules(ROOT);
    const { rows, gaps } = discovery(refs, rules);
    a.ok(gaps.length > 100, `缺域候选 ${gaps.length} 个 (期望 >100) —— 为空说明规则面扫描或比对失效`);
    a.ok(
      gaps.every((g) => g.state === "gap"),
      "gap 桶不得混入 covered/excluded"
    );
    a.ok(
      rows.some((r) => r.state === "covered" && r.hits > 0),
      "covered 必须至少有一个(否则说明本仓规则面没被读到)"
    );

    const audit = reverseAudit(rules.filter((r) => /^Plugin\/ad-/.test(r.source)), refs);
    a.ok(audit.rows.length >= 20, `反向核对覆盖 ${audit.rows.length} 个广告根域 (期望 ≥20)`);
    a.ok(
      audit.attested.some((r) => r.domain === "vungle.com" && r.refs === refs.length),
      "vungle.com 应被全部参考清单背书 —— 反向核对失效时这条会红"
    );
    a.ok(
      audit.unattested.some((r) => r.domain === "snssdk.com"),
      "国内 SDK 根域(snssdk.com)不该出现在西方发行商清单里 —— 无背书桶要能如实报出"
    );
    // 台账域不排除: 首版把台账域滤掉, 把"我们拦 unity3d.com 而 7/7 声明 unity.com"这个
    // 域迁移信号静默吞掉了。台账域必须出现在核对结果里(带 ledger 标注)。
    a.ok(audit.rows.some((r) => r.domain === "unity3d.com"), "台账域必须参与反向核对, 不许被过滤掉");
    a.ok(
      audit.attested.some((r) => r.domain === "applovin.com" && r.ledger === "apex"),
      "台账域在核对结果里要带 ledger 标注, 便于区分'有背书但只拦子域'"
    );
  },

  "appads-ref: 渲染必须把「发现」与「基准」分开说, 并给出候选处置": async (a) => {
    const { runDiscovery } = await load();
    const { refs, rows, gaps, audit, text } = runDiscovery({ top: 5 });
    a.ok(refs.length >= 5 && rows.length >= 300, "取自入库派生文件");
    a.ok(/平台层基准/.test(text) && /不回答/.test(text), "渲染必须声明: 语料是平台层基准, 但不回答该拦哪个子域");
    a.ok(/取证/.test(text) && /不取证就写规则/.test(text), "候选旁边必须写明取证要求(本仓已犯过的错)");
    a.ok(/反向核对/.test(text), "两个方向都要渲染(缺域 + 背书)");
    a.ok(text.split("\n").length > 15, "输出要有实质内容, 不是空壳");
    a.ok(audit.rows.length > 0, "反向核对结果要一并返回, 供调用方判断");
    a.ok(gaps.length >= 5, "top 5 候选要真的取得到");
  },
};
