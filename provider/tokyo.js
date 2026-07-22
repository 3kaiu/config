// 东京节点 Provider
// 节点通过 ws.wenn.in 订阅 + Sub-Store parser 注入到 Loon/QX
// Surgio 仅用于模板生成，节点由外部订阅管理
// 如需要在 Surgio 中管理节点，设置 SURGIO_SUBSCRIPTION_URL 环境变量

module.exports = (() => {
  const url = process.env.SURGIO_SUBSCRIPTION_URL;
  if (url) {
    return { type: 'shadowsocks_subscription', url };
  }
  return { type: 'custom', nodeList: [] };
})();
