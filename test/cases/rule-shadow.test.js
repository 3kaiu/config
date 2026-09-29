"use strict";
// 规则顺序遮蔽的静态回归。
//
// 背景: tools/rule-shadow-check.mjs 曾随 Mirror 精简一并删除, 理由是"无远程列表后该失效面不存在"。
// 对抗审计推翻了这个断言 —— **远程列表**这一数据源没了, 但**问题类别**还在:
//   域名类规则按配置顺序首次命中即停, 于是一条早出现的 DOMAIN-SUFFIX 会罩住所有子域,
//   使后面更精确的 DOMAIN 永不生效(实测 apple.com → Apple 曾罩住 tv.apple.com → Streaming)。
// 因此以本地规则为输入重建该门禁, 放进既有测试套件以免新增 tools/*.mjs 与 workflow 接线。
const fs = require("fs");
const path = require("path");

const TPL = path.join(__dirname, "..", "..", "template");

// 与 surgio 展开一致: 递归展开 {% include %} 后取 [Rule] 段
function expand(file, seen = new Set()) {
  const raw = fs.readFileSync(file, "utf8");
  return raw.replace(/\{%\s*include\s+"([^"]+)"\s*%\}/g, (_, rel) => {
    const abs = path.join(TPL, rel);
    if (seen.has(abs)) return "";
    seen.add(abs);
    return expand(abs, seen);
  });
}

function ruleRows() {
  const tpl = expand(path.join(TPL, "loon.tpl"));
  const m = tpl.match(/^\[Rule\]\n([\s\S]*?)(?=^\[[A-Za-z ]+\]$)/m);
  if (!m) throw new Error("loon.tpl 未找到 [Rule] 段");
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(",").map((x) => x.trim()))
    .filter((f) => f.length >= 2);
}

exports.tests = {
  "分流: 规则顺序遮蔽 (域名类首次命中即停)": async (a) => {
  const rows = ruleRows();
  const DOM = new Set(["DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD"]);
  const hits = [];
  for (let i = 0; i < rows.length; i++) {
    const [kind, val, policy = ""] = rows[i];
    if (!DOM.has(kind)) continue;
    for (let j = i + 1; j < rows.length; j++) {
      const [k2, v2, p2 = ""] = rows[j];
      if (!DOM.has(k2)) continue;
      // ⚠️ 同策略遮蔽同样是死规则(该行永不执行), 只是不改变**行为**。
      // 早期版本 `p2 === policy` 直接 continue, 于是
      //   DOMAIN-SUFFIX googleadservices.com → REJECT
      // 被前面的 DOMAIN-KEYWORD googleads → REJECT 完全覆盖(googleadservices 含
      // "googleads")却长期判绿 —— "看起来有门禁"的典型缺口。改为不豁免, 同策略遮蔽
      // 需与异策略遮蔽一并清掉 (清掉不改变任何请求的最终策略, 纯死代码消除)。
      const shadowed =
        (kind === "DOMAIN" && val === v2) ||
        (kind === "DOMAIN-SUFFIX" && (v2 === val || v2.endsWith(`.${val}`))) ||
        (kind === "DOMAIN-KEYWORD" && v2.includes(val));
      if (shadowed)
        hits.push(`第 ${j + 1} 条 ${k2} ${v2} → ${p2} 被第 ${i + 1} 条 ${kind} ${val} → ${policy} 罩住`);
    }
  }
  a.equal(
    hits.length,
    0,
    `${hits.length} 处遮蔽(后写的规则永不生效, 域名类首次命中即停):\n  ${hits.join("\n  ")}`
  );

  // REJECT 规则不得遮蔽其它策略的域名。
  // STUN 块是**合法例外**且依赖顺序: 白名单规则(#39-45)排在 REJECT(#47)之前才生效,
  // 故必须逐条按位置判断, 不能只做集合比较 —— 早期审计脚本在此产出过 7 条假阳性。
  const rej = rows.map((f, i) => ({ f, i })).filter((r) => r.f[2]?.startsWith("REJECT"));
  const cross = [];
  for (const r of rej) {
    for (let j = r.i + 1; j < rows.length; j++) {
      const b = rows[j];
      if (b[2]?.startsWith("REJECT")) continue;
      const shadowed =
        (r.f[0] === "DOMAIN" && b[1] === r.f[1]) ||
        (r.f[0] === "DOMAIN-SUFFIX" && (b[1] === r.f[1] || b[1].endsWith(`.${r.f[1]}`))) ||
        (r.f[0] === "DOMAIN-KEYWORD" && b[1].includes(r.f[1]));
      if (shadowed) cross.push(`第 ${j + 1} 条 ${b[0]} ${b[1]} → ${b[2]} 被第 ${r.i + 1} 条 ${r.f[0]} ${r.f[1]} → ${r.f[2]} 罩住`);
    }
  }
  a.equal(cross.length, 0, `${cross.length} 处 REJECT 误伤:\n  ${cross.join("\n  ")}`);

  // 粗粒度后缀是本仓已犯过的错 (京东 du.jd.com/c-nfa.jd.com 店铺域被 REJECT 破店页)。
  // 现有后缀均有 DoH 交叉 + 协议探测实证, 故登记白名单; 新增后缀须先取证再登记。
  const suffixREJECT = rej.filter((r) => r.f[0] === "DOMAIN-SUFFIX").map((r) => r.f[1]).sort();
  // [类别] 域 —— 每条均经 DoH 双解析器 (1.1.1.1 / 8.8.8.8) 交叉 + 协议探针取证。
  // 分析 SDK 一类为**功能依赖**域: 它们承载归因/埋点而非广告, 但被拦即丢失归因数据,
  // 故与纯广告域分开登记, 便于将来若需放开时精准摘除。
  const EVIDENCED = {
    "广告/联盟": [
      // 2026-09-29 三源研判新增 3 条纯广告联盟 SDK (无功能页, SUFFIX 拦安全):
      //   tradplusad / anythinktech / gromore —— 探针 tradplusad 200, 后两者裸域无 A
      //   记录但子域有(故用 SUFFIX); 三者与任何 DIRECT/Proxy 零重叠。
      //   明确排除的平台主域(整域拦会破 App)不登记在此: kuaishou / snssdk /
      //   e.qq / gdt.qq / union.baidu / miui / ads.union.jd。
      "1rtb.net", "66mobi.com", "adkwai.com", "anythinktech.com", "beizi.biz", "cloooud.com",
      "doubleclick.net", "gd-stats.jpush.cn", "gdfp.gifshow.com", "gromore.com",
      "googlesyndication.com", "googletagmanager.com", "googletagservices.com", "hubcloud.com.cn",
      "imtmp.net", "mmstat.com", "pangle.io", "pangolin-sdk-toutiao.com", "sigmob.cn",
      "stats.jpush.cn", "tradplusad.com", "ugdtimg.com",
    ],
    "分析/归因 SDK": [
      "adjust.com", "amplitude.com", "analytics.google.com", "app-measurement.com", "appsflyer.com",
      "branch.io", "crashlytics.googleapis.com", "google-analytics.com", "kochava.com", "mixpanel.com",
      "segment.io", "sentry.io",
    ],
    "银行/支付广告面": ["lban.spdb.com.cn", "mps.95508.com", "o2o-ad-log-gateway.alibaba.com", "static.95508.com", "track.bankcomm.com"],
    "国内平台广告面": ["adservice.google.com", "h-adashx.ut.taobao.com", "tnc3-alisc1.zijieapi.com"],
  };
  const flat = Object.values(EVIDENCED).flat().sort();
  a.equal(
    suffixREJECT.join(","),
    flat.join(","),
    `DOMAIN-SUFFIX 形态的 REJECT 集合漂移。新增后缀必须先做 DoH 双解析器交叉 + 协议探针取证 —— ` +
      `凭域名字义加 REJECT 已犯过 (京东店铺域), 细则见 AGENTS.md 广告面治理纪律`
  );
  a.equal(flat.length, new Set(flat).size, "EVIDENCED 分类之间有重复登记");

  // tv.apple.com 的例外只登记在 loon.tpl 的 Apple 块(snippet 侧已改为注释)。
  // 故必须断言"最终生效策略是 Streaming", 不能只断言无遮蔽 ——
  // 否则把例外整条删掉(回到 tv.apple.com → Apple 的原缺陷)会漏报。
  const tv = rows.filter((f) => f[1] === "tv.apple.com");
  a.equal(tv.length, 1, `tv.apple.com 应恰好登记 1 条例外规则, 实得 ${tv.length}`);
  // 上面 length 已保证非空; 此处仍用可选链, 避免断言失败前先抛 TypeError 掩盖真实信息
  a.equal(tv[0]?.[2], "Streaming", `tv.apple.com 应路由到 Streaming, 实得 ${tv[0]?.[2]}`);
  },

  "分流: 策略组成员与非文档参数": async (a) => {
  const tpl = expand(path.join(TPL, "loon.tpl"));
  const sec = tpl.match(/^\[Proxy Group\]\n([\s\S]*?)(?=^\[[A-Za-z ]+\]$)/m)[1];
  const groups = {};
  for (const l of sec.split("\n")) {
    const line = l.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    const name = line.slice(0, eq).trim();
    const body = line
      .slice(eq + 1)
      .split(",")
      .map((x) => x.trim());
    groups[name] = { type: body[0], members: body.slice(1).filter((x) => !x.includes("=")) };
  }
  // 10 个组, 全部有类型与成员
  a.equal(Object.keys(groups).length, 10, `策略组数量漂移: ${Object.keys(groups).join(",")}`);
  for (const [name, g] of Object.entries(groups))
    a.ok(g.members.length > 0, `策略组 ${name} (${g.type}) 无成员 —— 无法在成员间做决策`);

  // fallback/url-test 组必须带测速 url; 超时参数文档名为 max-timeout
  for (const [name, g] of Object.entries(groups)) {
    if (g.type !== "fallback" && g.type !== "url-test") continue;
    a.ok(/[,\s]url=/.test(sec.match(new RegExp(`^${name} =.*$`, "m"))[0]), `${name} (${g.type}) 缺测速 url`);
    const line = sec.match(new RegExp(`^${name} =.*$`, "m"))[0];
    a.ok(
      !/(^|[,\s])timeout=/.test(line),
      `${name} 使用非文档参数 timeout=, Loon 文档为 max-timeout=(毫秒)`
    );
  }

  // Fallback 必须在 [Rule] 与 AGENTS 宣称的"双节点容灾"里真正可达
  a.ok(/^Fallback = fallback,/m.test(sec), "Fallback 组类型应为 fallback");
  a.ok(
    /Fallback\s*=\s*fallback,\s*东京/.test(sec),
    "Fallback 成员应直接聚合外部订阅组“东京”"
  );
  },

  // 2026-09-29 对抗审计新增。
  // 官方《策略组》: url-test「定期测试所有节点, 并选择延迟最低的节点」。DIRECT
  // 参与比延迟时, 只要直连更快它就会被自动选中 —— 对流媒体/AI 这类依赖**非本地区
  // IP** 的服务, 自动切到 DIRECT 等于静默击穿分区限制 (Netflix/ChatGPT 报地区错)。
  // select 组不受影响 (用户显式选择, DIRECT 作为选项是合理的逃生口), 故只约束 url-test。
  "分流: url-test 组不得含 DIRECT (会被自动选中而击穿分区限制)": async (a) => {
    const tpl = expand(path.join(TPL, "loon.tpl"));
    const sec = tpl.match(/^\[Proxy Group\]\n([\s\S]*?)(?=^\[[A-Za-z ]+\]$)/m)[1];
    const bad = [];
    for (const l of sec.split("\n")) {
      const line = l.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      const name = line.slice(0, eq).trim();
      const body = line.slice(eq + 1).split(",").map((x) => x.trim());
      if (body[0] !== "url-test") continue;
      if (body.slice(1).includes("DIRECT"))
        bad.push(`${name}: 成员含 DIRECT, 直连延迟更低时会被自动选中`);
    }
    a.equal(
      bad.length,
      0,
      `${bad.length} 个 url-test 组含 DIRECT:\n  ${bad.join("\n  ")}\n` +
        `需分区锁定的服务(流媒体/AI)应只保留代理成员; 若确需 DIRECT 逃生口, 改成 select 组`
    );
  },
};
