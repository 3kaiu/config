/*
 * Template Script for Universal Library
 * Use this as a starting point for new scripts.
 */

// 1. 初始化环境 
// 复制本目录下最新的 Env.js 压缩版代码置于文件底部。
const $ = new Env("新脚本名称");

// 2. 逻辑处理
!(async () => {
  $.log("脚本开始执行");
  
  // 演示：持久化数据读取
  const myData = $.get("my_key") || "默认值";
  $.log(`读取到数据: ${myData}`);
  
  // 演示：现代风格网络请求
  /*
  const res = await $.fetch({
    url: "https://httpbin.org/get",
    method: "GET"
  });

  if (res && res.statusCode === 200) {
    $.log("请求成功");
    $.notify("执行成功", "", "查看日志了解详情");
  } else {
    $.log("请求失败或超时");
  }
  */

})()
  .catch((e) => $.log(`执行出错: ${e}`))
  .finally(() => $.done());

// --- 以下粘贴 Env.js 极简压缩版代码以保证脚本独立运行 ---
function Env(n){this.name=n;this.startTime=Date.now();this.log=(...m)=>console.log(`[${this.name}] [${new Date().toLocaleTimeString()}] ${m.join(" ")}`);this.wait=(ms)=>new Promise(r=>setTimeout(r,ms));this.done=(v={})=>$done(v);this.get=(k)=>{let v=$prefs.valueForKey(k);try{return JSON.parse(v)}catch(e){return v}};this.set=(v,k)=>{let val=typeof v==="object"?JSON.stringify(v):v;$prefs.setValueForKey(val,k)};this.fetch=async(o)=>{try{return await $task.fetch(o)}catch(e){return null}};this.clean=(obj,ps)=>{if(!obj||!ps)return obj;ps.forEach(p=>{let ks=p.split("."),c=obj;for(let i=0;i<ks.length-1;i++){let k=ks[i];if(k.includes("[")&&k.includes("]")){let[ak,f]=k.split(/[\[\]]/),[fk,fv]=f.split("=");if(c[ak]){c[ak]=c[ak].filter(item=>item[fk]!==fv);return}}c=c[k];if(!c)break}if(c)delete c[ks[ks.length-1]]});return obj};this.notify=(t,s,b)=>$notify(t,s,b)}
