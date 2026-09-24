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
 *   4. hijack-dns 的 `*:0` + IP 列表为官方语义 ("所有目标和端口" + 指定 IP 的
 *      所有查询), 上游 DNS 全部走加密通道时, 被劫持的明文查询回落明文 DNS 无收益
 *      但也无害 (官方 DNS 页: 加密优先)。
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
