// 东京节点 Provider
// 模式 1: SURGIO_SUBSCRIPTION_URL → 从机场订阅加载
// 模式 2: 通过 Secrets 传入节点参数
// 不设置任何变量时 → 空节点列表 (Surgio 仅生成模板，不含节点)

module.exports = (() => {
  const url = process.env.SURGIO_SUBSCRIPTION_URL;

  if (url) {
    return { type: 'shadowsocks_subscription', url };
  }

  const nodes = [];

  if (process.env.HY2_HOST && process.env.HY2_PASSWORD) {
    nodes.push({
      type: 'hysteria2',
      nodeName: '🇯🇵 Hysteria2',
      hostname: process.env.HY2_HOST,
      port: parseInt(process.env.HY2_PORT || '443', 10),
      password: process.env.HY2_PASSWORD,
      sni: process.env.HY2_SNI || process.env.HY2_HOST,
      udpRelay: true,
    });
  }

  if (process.env.VLESS_HOST && process.env.VLESS_UUID && process.env.VLESS_PUBKEY) {
    nodes.push({
      type: 'vless',
      nodeName: '🇯🇵 VLESS-Reality',
      hostname: process.env.VLESS_HOST,
      port: parseInt(process.env.VLESS_PORT || '443', 10),
      uuid: process.env.VLESS_UUID,
      flow: 'xtls-rprx-vision',
      method: 'none',
      udpRelay: true,
      realityOpts: {
        'public-key': process.env.VLESS_PUBKEY,
        'short-id': process.env.VLESS_SHORTID || '',
      },
    });
  }

  return { type: 'custom', nodeList: nodes };
})();
