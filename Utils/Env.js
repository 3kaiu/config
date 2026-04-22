/**
 * 🚀 QX-Pro Environment Library (v2.0)
 * Optimized exclusively for Quantumult X.
 * Focus: Performance, JSON Manipulation, and Advanced Networking.
 */

class Env {
  constructor(name) {
    this.name = name;
    this.startTime = Date.now();
    this.log(`🔔 初始化成功`);
  }

  // --- 基础工具 ---
  log(...msg) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${this.name}] [${time}] ${msg.join(" ")}`);
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  done(val = {}) {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    this.log(`🏁 执行结束 (耗时: ${duration}s)`);
    $done(val);
  }

  // --- 持久化存储 (自动 JSON 处理) ---
  get(key) {
    let val = $prefs.valueForKey(key);
    try { return JSON.parse(val); } catch (e) { return val; }
  }

  set(val, key) {
    let value = typeof val === "object" ? JSON.stringify(val) : val;
    return $prefs.setValueForKey(value, key);
  }

  remove(key) {
    return $prefs.removeValueForKey(key);
  }

  // --- 高级网络请求 ---
  // 支持自动超时和简化响应处理
  async fetch(options) {
    options.timeout = options.timeout || 5000;
    try {
      const res = await $task.fetch(options);
      res.json = () => JSON.parse(res.body);
      return res;
    } catch (e) {
      this.log(`❌ 请求失败: ${options.url}, 错误: ${e}`);
      return null;
    }
  }

  // --- JSON 深度清理算法 ---
  // 根据路径删除对象中的多余字段
  // path: "data.modules[name=我的福利]" 或 "data.navigation[0]"
  clean(obj, paths) {
    if (!obj || !paths) return obj;
    paths.forEach(path => {
      const keys = path.split(".");
      let current = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        let key = keys[i];
        if (key.includes("[") && key.includes("]")) {
          // 处理数组过滤逻辑，例如 modules[name=广告]
          let [arrKey, filter] = key.split(/[\[\]]/);
          let [fKey, fVal] = filter.split("=");
          if (current[arrKey]) {
            current[arrKey] = current[arrKey].filter(item => item[fKey] !== fVal);
            return; // 过滤后直接返回
          }
        }
        current = current[key];
        if (!current) break;
      }
      if (current) {
        const lastKey = keys[keys.length - 1];
        delete current[lastKey];
      }
    });
    return obj;
  }

  notify(title = this.name, subtitle = "", body = "") {
    $notify(title, subtitle, body);
  }
}
