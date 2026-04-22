/*
 * Template Script for Universal Library
 * Use this as a starting point for new scripts.
 */

// 1. 初始化环境 (引入库文件内容或使用远程加载)
// 注意：在 QX 中由于无法 require 外部文件，通常建议将 Env.js 内容贴在脚本末尾，或者使用通用模板
const $ = new Env("新脚本名称");

// 2. 逻辑处理
!(async () => {
  $.log("脚本开始执行");
  
  const myData = $.getdata("my_key") || "默认值";
  $.log(`读取到数据: ${myData}`);
  
  // 示例网络请求
  // $.get({ url: "https://httpbin.org/get" }, (err, res, body) => {
  //   $.log(body);
  //   $.notify("请求成功", "", "查看日志了解详情");
  // });

})()
  .catch((e) => $.log(`执行出错: ${e}`))
  .finally(() => $.done());

// --- 以下粘贴 Env.js 内容以保证脚本独立运行 ---
function Env(n){/*...*/}
