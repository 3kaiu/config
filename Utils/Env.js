/**
 * 🚀 QX-Pro Environment Library (v2.0)
 * Optimized exclusively for Quantumult X.
 * Focus: Performance, JSON Manipulation, and Advanced Networking.
 */

class Env {
  constructor(name) {
    this.name = name;
    this.startTime = Date.now();
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
    $done(val);
  }

  // --- 持久化存储 ---
  get(key) {
    let val = $prefs.valueForKey(key);
    try { return JSON.parse(val); } catch (e) { return val; }
  }

  set(val, key) {
    let value = typeof val === "object" ? JSON.stringify(val) : val;
    $prefs.setValueForKey(value, key);
  }

  // --- 高级网络请求 ---
  async fetch(options) {
    try {
      return await $task.fetch(options);
    } catch (e) {
      return null;
    }
  }

  // --- JSON 深度清理算法 ---
  clean(obj, paths) {
    if (!obj || !paths) return obj;
    paths.forEach(path => {
      const keys = path.split(".");
      let current = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        let key = keys[i];
        if (key.includes("[") && key.includes("]")) {
          let [arrKey, filter] = key.split(/[\[\]]/);
          let [fKey, fVal] = filter.split("=");
          if (current[arrKey]) {
            current[arrKey] = current[arrKey].filter(item => item[fKey] !== fVal);
            return;
          }
        }
        current = current[key];
        if (!current) break;
      }
      if (current) {
        delete current[keys[keys.length - 1]];
      }
    });
    return obj;
  }

  notify(title = this.name, subtitle = "", body = "") {
    $notify(title, subtitle, body);
  }
}

// 供业务脚本直接使用的极简压缩版 Env
// function Env(n){this.name=n;this.startTime=Date.now();this.log=(...m)=>console.log(`[${this.name}] [${new Date().toLocaleTimeString()}] ${m.join(" ")}`);this.wait=(ms)=>new Promise(r=>setTimeout(r,ms));this.done=(v={})=>$done(v);this.get=(k)=>{let v=$prefs.valueForKey(k);try{return JSON.parse(v)}catch(e){return v}};this.set=(v,k)=>{let val=typeof v==="object"?JSON.stringify(v):v;$prefs.setValueForKey(val,k)};this.fetch=async(o)=>{try{return await $task.fetch(o)}catch(e){return null}};this.clean=(obj,ps)=>{if(!obj||!ps)return obj;ps.forEach(p=>{let ks=p.split("."),c=obj;for(let i=0;i<ks.length-1;i++){let k=ks[i];if(k.includes("[")&&k.includes("]")){let[ak,f]=k.split(/[\[\]]/),[fk,fv]=f.split("=");if(c[ak]){c[ak]=c[ak].filter(item=>item[fk]!==fv);return}}c=c[k];if(!c)break}if(c)delete c[ks[ks.length-1]]});return obj};this.notify=(t,s,b)=>$notify(t,s,b)}
