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

  // 自定义模板变量
  customParams: {
    dns_primary: '180.184.11.11',
    dns_fallback: '223.5.5.5',
    doh_primary: 'https://dns.alidns.com/dns-query',
    doh_fallback: 'https://doh.pub/dns-query',
    doh3_primary: 'h3://dns.alidns.com/dns-query',
    doh3_fallback: 'h3://doh.pub/dns-query',
    doq_server: 'quic://dns.alidns.com:853',
    // (已移除) surge_node_policy_path: 死参数, 模板从未引用; 原注释指向 Sub-Store
    // 集合的 Surge 节点列表 URL, 随 Sub-Store 一并移除 (2026-09-11)。
  },
});
