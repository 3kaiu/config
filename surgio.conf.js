const { defineSurgioConfig } = require('surgio');

module.exports = defineSurgioConfig({
  artifacts: [
    {
      name: 'Loon.lcf',
      template: 'loon',
      provider: 'empty',
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
