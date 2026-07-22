/**
 * 知乎去广告 v1.1
 * 作者：3kaiu (规则来源: RuCu6/blackmatrix7)
 *
 * 对知乎各类广告接口统一清空 data 或替换为空的推荐关键词。
 * 覆盖: 首页/回答/搜索/会员/外链/横幅/商业API 等
 *
 * ⚠️ 修复(v1.1): 添加 $response 守卫, 防止 AllInOne 全局 MitM 误触 request 阶段
 */

// $response 守卫
if (typeof $response === "undefined") { $done(); }

const url = $request.url;

// 搜索预设词: 清空推荐查询
if (url.includes("search/preset_words")) {
  try {
    const obj = JSON.parse($response.body);
    if (obj && obj.recommend_queries) {
      obj.recommend_queries = {};
    }
    $.done({ body: JSON.stringify(obj) });
  } catch (e) { $.done(); }
  return; // 提前返回, 不进入下面的通用处理
}

// 通用: 清空 data 字段
try {
  const obj = JSON.parse($response.body);
  if (obj && obj.data) {
    obj.data = {};
  }
  $.done({ body: JSON.stringify(obj) });
} catch (e) {
  $.done();
}