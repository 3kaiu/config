/**
 * dns-* 依赖层插件的**规则形状**白名单 (2026-09-30)
 *
 * 为什么要有这份共享原语: 形状知识原本散在三个用例里(plugin-layering 的形状断言、
 * ad-platform-plugins 的"一律 REJECT"断言、dns-geoip 的拦截面断言), 每加一种形态就要
 * 各改一遍 —— 2026-09-30 从 kelee HTTPDNS 吸纳三种新技法时就同时弄红了两个用例。
 * 收敛到一处后, "允许什么形状"只有一个定义, 用例只负责引用与断言不变量。
 *
 * 每种形状都必须带**独立判据**(不是放宽):
 *   ① 精确 DOMAIN REJECT —— 主力形态, 逐条探针(见各插件头部证据)
 *   ② AND 锚定关键词兜底 —— 插件内裸 DOMAIN-KEYWORD 被 plugin-lint-check 判红(官方记其耗时线性增长)
 *   ③ HTTPDNS SDK 的 UA —— 只对**明文 HTTP** 有意义(HTTPS 里 UA 在 TLS 内, 需 MitM);
 *      语义限定 httpdns/httpsdns, 避免变成通用 UA 拦截
 *   ④ IP 形态明文 HTTPDNS —— 域名规则够不着裸 IP; **必须 ^http://**, https 形态要 MitM
 *   ⑤ 定向放行(carve-out) —— ④ 会误伤正常使用 HTTPDNS 的出行类 App, 必须 AND 门控 + 精确 IP
 */
export const DNS_RULE_SHAPES = [
  { name: "精确 DOMAIN REJECT", re: /^DOMAIN,\s*[\w.-]+,\s*REJECT$/ },
  {
    name: "AND 锚定关键词兜底",
    re: /^AND,\s*\(\(DOMAIN-KEYWORD,[\w-]+\),\s*\(DOMAIN-SUFFIX,[\w.-]+\)\),\s*REJECT$/,
  },
  {
    name: "HTTPDNS SDK 的 UA(明文)",
    re: /^USER-AGENT,\s*"(?:https?dns|Httpdns|Httpsdns)[^"]*",\s*REJECT$/,
  },
  { name: "IP 形态明文 HTTPDNS", re: /^URL-REGEX,\s*"\^http:\\\/\\\/[^"]+",\s*REJECT$/ },
  {
    name: "IP 形态的定向放行",
    re: /^AND,\s*\(\(URL-REGEX,\s*\^http:\\\/\\\/[^)]+\),\s*\(USER-AGENT,\s*[^)]+\)\),\s*DIRECT$/,
  },
];

export function isAllowedDnsRule(line) {
  const t = String(line).trim();
  return DNS_RULE_SHAPES.some((s) => s.re.test(t));
}

/** URL-REGEX 必须是明文形态(https 形态要 MitM, 与本层零解密面冲突) */
export function isPlaintextOnlyRule(line) {
  const t = String(line).trim();
  if (!/^URL-REGEX,/.test(t)) return true;
  return /^URL-REGEX,\s*"\^http:\\\/\\\//.test(t);
}

/** 定向放行(DIRECT)只允许出现在 dns-* 层, 且必须 AND(URL-REGEX, USER-AGENT) 门控 */
export function isGatedDirectCarveOut(line) {
  const t = String(line).trim();
  return DNS_RULE_SHAPES[4].re.test(t);
}
