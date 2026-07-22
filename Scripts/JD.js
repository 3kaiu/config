/**
 * 京东去广告 v1.1
 * 作者：3kaiu (规则来源: RuCu6)
 *
 * 对京东首页/我的/订单/启动页等广告接口统一清空 data 字段。
 * 覆盖: deliverLayer / getTabHomeInfo / myOrderInfo / orderTrackBusiness /
 *        personinfoBusiness / start / welcomeHome
 *
 * ⚠️ 修复(v1.1): 添加 $response 守卫, 防止 AllInOne 全局 MitM 误触 request 阶段
 * ⚠️ 修复(v7.7): 用 $done() 替换 $.done(), 消除 ReferenceError
 */

// $response 守卫
if (typeof $response === "undefined") { $done(); }

try {
  const obj = JSON.parse($response.body);
  if (obj && obj.data) {
    obj.data = {};
  }
  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done();
}