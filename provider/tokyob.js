const url = process.env.SURGIO_SUBSCRIPTION_URL_2 || process.env.SURGIO_SUBSCRIPTION_URL_BAK;

module.exports = url
  ? { type: 'shadowsocks_subscription', url }
  : { type: 'custom', nodeList: [] };
