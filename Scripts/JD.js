/**
 * 京东去广告 v1.0
 * 作者：3kaiu (规则来源: RuCu6)
 *
 * 对京东首页/我的/订单/启动页等广告接口统一清空 data 字段。
 * 覆盖: deliverLayer / getTabHomeInfo / myOrderInfo / orderTrackBusiness /
 *        personinfoBusiness / start / welcomeHome
 */

try {
  const obj = JSON.parse($response.body);
  if (obj && obj.data) {
    obj.data = {};
  }
  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.done();
}
