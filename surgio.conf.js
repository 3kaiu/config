const { defineSurgioConfig } = require('surgio');

// Surgio 按约定加载 provider/<name>.js；主源与备用源由 artifact.combineProviders 合并。
// 两个订阅环境变量均为空时产物确定，不把订阅凭据写入仓库。
module.exports = defineSurgioConfig({
  artifacts: [
    {
      name: 'Loon.lcf',
      template: 'loon',
      provider: 'tokyo',
      combineProviders: ['tokyob'],
      destDir: 'Profile',
    },
  ],

  // 每个键都必须被 template/** 以 {{ customParams.<键> }} 消费。
  // dns-server 是模板中的静态真值，不在这里重复声明。
  customParams: {
    doh_primary: 'https://dns.alidns.com/dns-query',
    doh_fallback: 'https://doh.pub/dns-query',
    doh3_primary: 'h3://dns.alidns.com/dns-query',
    doh3_fallback: 'h3://doh.pub/dns-query',
    doq_server: 'quic://dns.alidns.com:853',
  },
});
