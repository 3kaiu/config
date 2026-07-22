/**
 * Reddit 去广告 v1.1
 * 作者：3kaiu (规则来源: xream)
 *
 * 从 GraphQL 响应中移除推广帖 (promoted posts) 节点。
 *
 * ⚠️ 修复(v1.1): 添加 $response 守卫, 防止 AllInOne 全局 MitM 误触 request 阶段
 */

// $response 守卫
if (typeof $response === "undefined") { $done(); return; }

try {
  const obj = JSON.parse($response.body);

  // 遍历所有 edges 节点，删除 node.__typename === "AdPost" 的 item
  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (let i = obj.length - 1; i >= 0; i--) {
        if (obj[i]?.node?.__typename === "AdPost") {
          obj.splice(i, 1);
        } else {
          walk(obj[i]);
        }
      }
    } else {
      for (const key of Object.keys(obj)) {
        walk(obj[key]);
      }
    }
  }

  walk(obj);
  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done();
}