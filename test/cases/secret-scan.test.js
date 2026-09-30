"use strict";
/**
 * 密钥/凭据扫描门禁的行为回归 (2026-09-30)
 *
 * 这道门禁的价值全在"提交前 3 秒拦住": 本仓发布面是公开 GitHub + 自建 CDN, 凭据一旦提交
 * 即公开, 删历史也挽不回。因此两件事必须被用例钉死 ——
 *   ① **能抓到**(阳性): 已知形状的真实密钥前缀必须命中, 否则门禁是摆设;
 *   ② **不误报**(阴性): 占位符/环境变量引用/sha256 摘要/域名 必须**不**命中,
 *      否则门禁会被绕过(误报让人加豁免, 豁免多了等于没有门禁)。
 */
const fs = require("fs");
const path = require("path");

let mod = null;
const load = async () => (mod ??= await import("../../tools/secret-scan.mjs"));

exports.tests = {
  "secrets: 真实形状的密钥必须命中 (阳性)": async (a) => {
    const { scanText } = await load();
    // 夹具一律**拼接构造**, 不在文件里留下密钥形状的字面量 —— 否则本文件自己就会
    // 被真仓库用例抓出来(实测过: 第一版就是这么红的)。这条约束同时是给后人的示范。
    const B = (ch, n) => ch.repeat(n);
    const cases = [
      ['const t = "' + "ghp_" + B("A", 36) + '";', "github-token"],
      ['token: "' + "github_pat_" + B("B", 30) + '"', "github-pat-fine"],
      ["AWS_KEY=" + "AKIA" + B("C", 16), "aws-access-key-id"],
      ['const s = "' + ["xox", "b-", "1234567890-", "abcdefghij"].join("") + '";', "slack-token"],
      ['apiKey: "' + "AIza" + B("D", 35) + '"', "google-api-key"],
      ['key = "' + "sk-" + B("e", 30) + '"', "openai-style-key"],
      ["-----BEGIN RSA " + "PRIVATE KEY-----", "private-key-block"],
      ["Authorization: Bearer " + ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "abcdefghijklmnop"].join("."), "jwt"],
      ["https://example.com/sub?token=" + B("f", 24), "url-credential-param"],
      ["https://user:" + "supersecret" + "pw@example.com/sub", "basic-auth-url"],
    ];
    for (const [text, want] of cases) {
      const hits = scanText(text, "probe.js");
      a.ok(
        hits.some((h) => h.pattern === want),
        `未命中 ${want}: ${text.slice(0, 60)} —— 阳性漏检等于门禁失效`
      );
    }
  },

  "secrets: 占位符/摘要/域名不得误报 (阴性)": async (a) => {
    const { scanText } = await load();
    const clean = [
      // 环境变量与 Actions secret 引用
      "token: ${{ secrets.MIRROR_TOKEN }}",
      "const key = process.env.API_KEY;",
      "password = ${PASSWORD}",
      // 占位符
      "uuid = <your-uuid-here>",
      "secret = REPLACED_AT_RUNTIME",
      // 本仓文档里满是 sha256 摘要与域名 —— 泛化熵检测会把这些全打成密钥
      "sha256 3b81e1deaede4d0d9b3c0f0f5d5a2b1c8e7f6a5d4c3b2a190817263544332211",
      "https://ws.wenn.in/main/Plugin/ad-block.plugin",
      "DOMAIN, httpdns-api.aliyuncs.com, REJECT",
      "README: 把 token=<你的订阅 token> 填进去即可",
    ];
    for (const text of clean) {
      const hits = scanText(text, "doc.md");
      a.equal(hits.length, 0, `误报: ${text.slice(0, 60)} → ${hits.map((h) => h.pattern).join(",")}`);
    }
  },

  "secrets: 豁免面只允许扫描器自身 (防豁免扩大化)": async (a) => {
    const { SELF_SKIP } = await load();
    a.equal(
      SELF_SKIP.join(","),
      "tools/secret-scan.mjs",
      "豁免名单只能有扫描器自身(它内嵌模式字符串, 扫自己必自噬); 扩大豁免 = 给密钥留后门"
    );
  },

  "secrets: 真仓库零命中 (含未跟踪未忽略文件)": async (a) => {
    const { scanRepo } = await load();
    const { hits, scanned } = scanRepo();
    a.ok(scanned >= 100, `扫描面过小(${scanned} 个文件) —— 解析/遍历失效会让门禁静默转绿`);
    a.equal(
      hits.length,
      0,
      `发现 ${hits.length} 处疑似凭据:\n` + hits.map((h) => `  ${h.file}:${h.line} [${h.pattern}]`).join("\n")
    );
  },
};
