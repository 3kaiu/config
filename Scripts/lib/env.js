/**
 * env.js - Canonical Env 兼容层模板 (Loon / Quantumult X / Surge)
 *
 * ⚠️ Loon/QX 脚本运行在隔离 JS 上下文中, 不支持 require()/import。
 * 本文件是"源真理"(single source of truth)模板 —— 新脚本应从此文件
 * 复制 Env 函数粘贴到自身文件底部, 而非引用此文件。
 *
 * 用法:
 *   1. 将下方 Env 函数复制到脚本末尾
 *   2. 在脚本顶部调用:  const $ = new Env("脚本名称");
 *
 * API:
 *   $.name            脚本名称
 *   $.isL             是否 Loon 环境 (typeof $loon !== "undefined")
 *   $.isQ             是否 Quantumult X 环境 (typeof $task !== "undefined")
 *   $.log(...a)       日志输出, 自动添加 [名称] 前缀
 *   $.wait(ms)        Promise 延时 (毫秒)
 *   $.done(o)         结束脚本, 等价 $done(o)
 *   $.get(key)        读取持久化存储, 自动尝试 JSON.parse
 *   $.set(val, key)   写入持久化存储, 对象自动 JSON.stringify
 *   $.fetch(opts)     Promise 化 HTTP 请求 (兼容 QX $task.fetch / Loon $httpClient)
 *   $.notify(t, s, b) 本地通知 (仅本地; 远程推送见 notify.js)
 *
 * 持久化存储 Key 约定 (跨脚本统一):
 *   Bark_Key          Bark 推送 Key
 *   TG_BOT_TOKEN      Telegram Bot Token
 *   TG_USER_ID        Telegram Chat ID
 *
 * 变更历史:
 *   - 从 Zhihuifangdong.js / Qidian.js 的 Env 层提取统一
 *   - fetch: 修复 Loon response.statusCode 兼容 (不同版本可能是 status 或 statusCode)
 */

// ==========================================
// 🌍 Env 兼容层 (Loon / Quantumult X / Surge)
// 模板源: Scripts/lib/env.js — 修改请同步更新此文件及所有使用脚本
// ==========================================
function Env(n) {
  this.name = n;
  this.isL = typeof $loon !== "undefined";
  this.isQ = typeof $task !== "undefined";
  this.log = (...a) => console.log(`[${this.name}] ` + a.join(" "));
  this.wait = (m) => new Promise(r => setTimeout(r, m));
  this.done = (o = {}) => $done(o);
  this.get = (k) => {
    let v = this.isL ? $persistentStore.read(k) : $prefs.valueForKey(k);
    try { return JSON.parse(v); } catch (e) { return v; }
  };
  this.set = (v, k) => {
    let s = typeof v === "object" ? JSON.stringify(v) : v;
    this.isL ? $persistentStore.write(s, k) : $prefs.setValueForKey(s, k);
  };
  this.fetch = async (o) => new Promise((r, e) => {
    if (this.isQ) $task.fetch(o).then(r, e);
    else {
      let m = (o.method || "GET").toLowerCase();
      $httpClient[m](o, (err, res, b) => {
        if (err) e(err);
        else {
          res.body = b;
          // Loon response 字段名在不同版本可能是 status 或 statusCode
          if (res.statusCode === undefined) {
            res.statusCode = res.status !== undefined ? res.status : (res.response ? res.response.statusCode : 200);
          }
          r(res);
        }
      });
    }
  });
  this.notify = (t, s, b) => this.isL ? $notification.post(t, s, b) : $notify(t, s, b);
}
