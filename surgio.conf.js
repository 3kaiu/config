const { defineSurgioConfig } = require('surgio');

module.exports = defineSurgioConfig({
  artifacts: [
    {
      name: 'Loon.lcf',
      template: 'loon',
      provider: 'tokyo',
      // Loon.lcf 输出到 Profile/ 目录
      destDir: 'Profile',
    },
    {
      name: 'QX.conf',
      template: 'quantumultx',
      provider: 'tokyo',
      destDir: 'Profile',
    },
    {
      // 第三端冗余: Surge 配置 (v1 覆盖范围见模板头部注释)
      name: 'Surge.conf',
      template: 'surge',
      provider: 'tokyo',
      destDir: 'Profile',
    },
  ],

  // 远程规则片段 (blackmatrix7 + ddgksf2013)
  remoteSnippets: [
    {
      url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Advertising/Advertising.list',
      name: 'blackmatrix7-advertising',
    },
    {
      url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Hijacking/Hijacking.list',
      name: 'blackmatrix7-hijacking',
    },
    {
      url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Privacy/Privacy.list',
      name: 'blackmatrix7-privacy',
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
    // Surge 节点 policy-path (Sub-Store 集合的 Surge 节点列表 URL); 留空时 Proxy 组降级为 select DIRECT
    surge_node_policy_path: '',
  },
});
