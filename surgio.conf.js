const { defineSurgioConfig } = require('surgio');

// 注意: provider 由 surgio 按约定加载 provider/<name>.js (artifact.js 内
// path.resolve(providerDir, `${name}.js`)), 本文件不再重复定义 provider 对象。
// 因此 tokyo provider 的唯一来源是 provider/tokyo.js — 改节点来源请改那个文件。
// (历史: 此处曾有一份内联 tokyoProvider 定义, 经实测为死代码 — surgio 从不读取
//  config.providers, 且 SurgioConfigValidator 无该字段。已于 2026-09-11 移除。)

module.exports = defineSurgioConfig({
  artifacts: [
    {
      name: 'Loon.lcf',
      template: 'loon',
      provider: 'tokyo',
      // Loon.lcf 输出到 Profile/ 目录
      destDir: 'Profile',
    },
  ],

  // 节点测试配置
  proxyTestUrl: 'http://cp.cloudflare.com/generate_204',
  proxyTestInterval: 300,

  // 自定义过滤器 (按协议分流)
  customFilters: {
    hysteriaFilter: (node) => node.nodeName.toLowerCase().includes('hysteria'),
    vlessFilter: (node) => node.nodeName.toLowerCase().includes('vless'),
  },

  // 自定义模板变量 — 约束: 这里的每个键都必须在 template/** 中有对应的
  // `{{ customParams.<键> }}` 引用。声明了却没人消费 = 死参数: 改它不生效,
  // 还会与模板里的硬编码值形成**双源**(改一处看起来生效、实际另一处才是真值)。
  // 该约束由 tools/tpl-sync-check.mjs 的双向契约断言机械把关 (2026-09-11 深度审计 NEW-13)。
  customParams: {
    // (已移除 2026-09-11) dns_primary / dns_fallback —— 死参数。dns-server 列表硬编码在
    //   template/loon.tpl:11 (4 台: 180.184.11.11, 180.184.22.22, 119.29.29.29, 223.5.5.5),
    //   这两个键从未被模板引用; 二者取值恰好是该列表的首尾两台, 极易被误当成"真源"去改。
    // (已移除) surge_node_policy_path: 死参数, 模板从未引用; 原注释指向 Sub-Store
    //   集合的 Surge 节点列表 URL, 随 Sub-Store 一并移除 (2026-09-11)。
    doh_primary: 'https://dns.alidns.com/dns-query',
    doh_fallback: 'https://doh.pub/dns-query',
    doh3_primary: 'h3://dns.alidns.com/dns-query',
    doh3_fallback: 'h3://doh.pub/dns-query',
    doq_server: 'quic://dns.alidns.com:853',
  },
});
