/**
 * 高德地图去广告 v1.0
 * 作者：3kaiu (规则来源: RuCu6/kokoryh)
 *
 * 对高德地图各类广告 DSP 接口统一返回空字典。
 * 覆盖: 导航详情页/首页/我的/附近/开屏/打车页
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
