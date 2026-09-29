/**
 * [General] 官方文档语义探针 (2026-09-20 审计)
 *
 * 依据 loon0x00.github.io/docs/General/ (Loon 官方, 2026-09 实抓) 与 wiki.repcz.link:
 *   1. `ip-mode` 的官方枚举 = ipv4-only / dual / ipv4-preferred / ipv6-preferred。
 *      `fake-ip` 不是 ip-mode 的取值 —— Fake IP 由 fake-ip-filter 控制排除名单,
 *      IP 协议族选择由 ip-mode 控制, 二者是正交概念。历史遗留值恰好与官方某个
 *      非法拼写同形, 属配置语义漂移, 官方文档三处 (ip-mode 表格 / hijack-dns /
 *      real-ip) 均无 "fake-ip 作为 ip-mode 取值" 的表述。
 *   2. `interface-mode = Performace` 是官方文档**原样拼写** (官方即少一个 r),
 *      wiki.repcz.link 转载同样写作 Performace —— 不得"纠正"拼写, 否则识别失败。
 *   3. 断网判定链: internet-test-url 必须不在 real-ip 排除名单内 (real-ip 域名
 *      绕过 Fake IP, 若探活域在其中则 TUN 下探活可能失真)。
 *   4. hijack-dns 官方语义 = "劫持指定目标的 UDP DNS 查询, 并**返回 Fake IP**"
 *      (General 页原文), 官方示例给的三种形态为 `*:53` / `*:0` / `8.8.8.8`。
 *      由此推出的形态判据 (2026-09-29 修正上一轮的反向推理):
 *      被劫持的查询由 Loon 应答 Fake IP, 应用**不再联系那个解析器**。故
 *      列举式 ("只劫持几个公开 IP") 是**反效果** —— 未列举的解析器明文 UDP 直出,
 *      既绕过 domain-reject-mode = DNS 的拒绝面, 又吃污染风险; 而 `*:0`
 *      虽方向对却过宽 (劫持所有端口, 含非 53 流量)。正解是官方首例 `*:53`。
 *   5. Loon 节点由外部订阅提供，订阅策略组“东京”必须由 Proxy 组直接聚合。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const TPL = path.join(REPO, "template", "loon.tpl");

function generalLines() {
  const lines = fs.readFileSync(TPL, "utf8").split("\n");
  const out = [];
  let inGeneral = false;
  for (const l of lines) {
    if (/^\[/.test(l)) inGeneral = l.trim() === "[General]";
    else if (inGeneral && /=/.test(l) && !l.startsWith("#")) out.push(l);
  }
  return out;
}
const value = (key) => {
  const line = generalLines().find((l) => l.startsWith(key + " ="));
  return line ? line.split("=").slice(1).join("=").trim() : null;
};

exports.tests = {
  "[General] ip-mode 必须取官方四枚举之一 (fake-ip 非 ip-mode 取值)": async (a) => {
    const v = value("ip-mode");
    a.ok(v, "模板应有 ip-mode 行");
    a.ok(
      ["ipv4-only", "dual", "ipv4-preferred", "ipv6-preferred"].includes(v),
      `ip-mode=${v} 不在官方枚举 (ipv4-only/dual/ipv4-preferred/ipv6-preferred); fake-ip 是 Fake IP 体系的概念, 不是 IP 模式取值`
    );
  },
  // 2026-09-29 对抗审计新增: ip-mode 与 ipv6-vif 的**一致性**。
  // 两者单独看都合法, 并置才出问题: ip-mode = dual 会把 AAAA 结果交给 App, 而
  // ipv6-vif = off 不接管 TUN 的 IPv6 转发 —— 官方未说明"不处理"是丢包还是绕过,
  // 但两种解释都不可接受 (丢包=连不通, 绕过=泄漏)。
  // 判据: 一切「会把 IPv6 地址交给 App」的 ip-mode, 必须配一个接管 IPv6 的 ipv6-vif。
  "[General] ip-mode 与 ipv6-vif 必须自洽 (否则 IPv6 要么泄漏要么连不通)": async (a) => {
    const ipMode = value("ip-mode");
    const v6vif = value("ipv6-vif");
    a.ok(v6vif, "模板应有 ipv6-vif 行");
    a.ok(
      ["off", "auto", "always"].includes(v6vif),
      `ipv6-vif=${v6vif} 不在官方枚举 (off/auto/always)`
    );
    const handsOutIPv6 = ipMode !== "ipv4-only";
    const takesOverIPv6 = v6vif !== "off";
    if (handsOutIPv6 && !takesOverIPv6) {
      a.ok(
        false,
        `ip-mode=${ipMode} 会把 AAAA 结果交给 App, 但 ipv6-vif=${v6vif} 不接管 TUN 的 IPv6 —— ` +
          `IPv6 或被丢包(App 连不通) 或绕过隧道(静默泄漏)。二者须同向: ` +
          `要么 ip-mode=ipv4-only, 要么 ipv6-vif=auto/always`
      );
    }
    a.ok(true, `ip-mode=${ipMode} / ipv6-vif=${v6vif} 自洽`);
  },

  // 前向保障: 启用 IPv6 后, 局域网 IPv6 段必须在 bypass-tun/skip-proxy 里,
  // 否则 mDNS(ff02::/16) / ULA / 链路本地流量会被卷进隧道, 必坏。
  "[General] bypass-tun / skip-proxy 须含 IPv6 局域网段 (为 dual 预留)": async (a) => {
    const need = { "::1/128": "回环", "fc00::/7": "ULA 私有", "fe80::/10": "链路本地", "ff00::/8": "组播/mDNS" };
    for (const key of ["bypass-tun", "skip-proxy"]) {
      const v = value(key) || "";
      const missing = Object.keys(need).filter((seg) => !v.includes(seg));
      a.equal(
        missing.join(","),
        "",
        `[General] ${key} 缺 IPv6 局域网段: ${missing.map((m) => `${m}(${need[m]})`).join(", ")} —— ` +
          `一旦 ip-mode 切到 dual, 这些流量会被卷入隧道`
      );
    }
  },

  // 2026-09-29 对抗审计: 探活端点必须**一主一备**。
  // 配置注释自称"internet 与 proxy 用不同上游", 但 4 个策略组都写死了
  // url=cp.cloudflare.com, 而 cp.cloudflare.com 恰是 internet-test-url 的端点 ——
  // 于是全部探活压在同一下游上。该端点故障时"本机断网"与"代理链失效"同时报红,
  // 恰好是这条注释要避免的情形。
  "[General] 探活端点须一主一备 (组 url= 不得与 internet-test-url 同源)": async (a) => {
    const tpl = fs.readFileSync(TPL, "utf8");
    const internet = value("internet-test-url") || "";
    const internetHost = new URL(internet).hostname;
    const groupUrls = [...tpl.matchAll(/^\s*\w+\s*=\s*url-test[^\n]*?url=(\S+)/gm)].map((m) => m[1]);
    const same = groupUrls.filter((u) => new URL(u).hostname === internetHost);
    a.equal(
      same.length,
      0,
      `${same.length} 个 url-test 组把测速端点设为 ${internetHost}, 与 internet-test-url 同源 —— ` +
        `该端点故障时无法区分"本机断网"与"代理链失效"。组应改用 proxy-test-url 的端点`
    );
    a.ok(
      new URL(value("proxy-test-url") || "").hostname !== internetHost,
      "proxy-test-url 与 internet-test-url 指向同一端点, 一主一备失效"
    );
  },

  "[General] interface-mode = Performace 为官方原样拼写, 不得改写": async (a) => {
    const v = value("interface-mode");
    a.ok(v, "模板应有 interface-mode 行");
    a.equal(v, "Performace", "官方文档枚举即 'Performace' (少 r), 改成 Performance 反而识别失败");
  },
  "[General] internet-test-url 不得落在 real-ip 排除名单内 (断网判定链)": async (a) => {
    const realIp = (value("real-ip") || "").split(",").map((s) => s.trim());
    const probe = value("internet-test-url") || "";
    const host = (new URL(probe)).hostname;
    const hit = realIp.find((p) => {
      const re = new RegExp("^" + p.replace(/[.]/g, "\\.").replace(/\*/g, "[^.]+") + "$");
      return re.test(host);
    });
    a.equal(hit, undefined, `internet-test-url (${host}) 命中 real-ip 排除项 ${hit}, TUN 下探活可能失真`);
  },
  "[General] hijack-dns 必须是 *:53 全端口 53 形态 (列举式是反效果)": async (a) => {
    const v = value("hijack-dns");
    a.ok(v, "模板应有 hijack-dns 行");
    a.equal(
      v,
      "*:53",
      `hijack-dns=${v}。官方语义是"劫持 UDP DNS 并返回 Fake IP"(应用不再联系原解析器), ` +
        `故列举式会让未列举的解析器明文 UDP 直出 (绕过 domain-reject-mode=DNS 且吃污染), ` +
        `*:0 又过宽 (劫持所有端口); 官方首例 *:53 才是正解。需 Loon >= 3.2.5(789)`
    );
  },
  // 2026-09-29 对抗审计新增: UDP 回落不得为 DIRECT。
  // 官方: udp-fallback-mode 是"节点不支持 UDP 或未启用 UDP 转发时使用的策略"。
  // 取 DIRECT 则节点一旦无 UDP, 全部 UDP(QUIC/游戏/通话)从本机真实 IP 直连漏出 ——
  // 与本配置已用 PROTOCOL,STUN,REJECT 封 STUN 的 posture 自相矛盾。
  // REJECT = 失败可见: 节点开了 udp=true 时本键永不触发, 零影响。
  "[General] udp-fallback-mode 须为 REJECT (DIRECT 会让 UDP 从真实 IP 漏出)": async (a) => {
    const v = value("udp-fallback-mode");
    a.equal(
      v,
      "REJECT",
      `udp-fallback-mode=${v} —— 节点无 UDP 时 ${v === "DIRECT" ? "全部 UDP 从本机真实 IP 直连漏出" : "回落行为不符合预期"}。` +
        `应取 REJECT: 失败可见而非静默泄露。前置条件: 东京组节点需启用 UDP`
    );
  },

  "[General] dns-reject-mode / domain-reject-mode / udp-fallback-mode 取值在官方枚举内": async (a) => {
    a.ok(["LOOPBACKIP", "NOANSWER", "NXDOMAIN"].includes(value("dns-reject-mode")), "dns-reject-mode 官方枚举");
    a.ok(["DNS", "Request"].includes(value("domain-reject-mode")), "domain-reject-mode 官方枚举");
    a.ok(["DIRECT", "REJECT"].includes(value("udp-fallback-mode")), "udp-fallback-mode 官方枚举");
  },
  "[Proxy Group] Proxy 必须聚合 Loon 外部订阅策略组“东京”": async (a) => {
    const text = fs.readFileSync(TPL, "utf8");
    const line = text.split("\n").find((item) => /^Proxy\s*=/.test(item));
    a.ok(line, "模板应有 Proxy 策略组");
    a.ok(/^Proxy\s*=\s*url-test\s*,\s*东京\s*,/m.test(text), "Proxy 必须直接引用外部订阅策略组“东京”");
  },
};
