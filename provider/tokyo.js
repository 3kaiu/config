const url = process.env.SURGIO_SUBSCRIPTION_URL;

module.exports = url
  ? { type: 'shadowsocks_subscription', url }
  : { type: 'custom', nodeList: [] };
