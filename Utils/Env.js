/*
 * Universal Environment for Quantumult X / Surge / Loon
 * Standardizes common functions like notify, storage, and networking.
 */
function Env(name) {
  this.name = name;
  this.logs = [];
  this.isQX = typeof $task !== "undefined";
  this.isSurge = typeof $network !== "undefined" && typeof $script !== "undefined";
  this.isLoon = typeof $loon !== "undefined";
  
  this.log = (...msg) => {
    msg.forEach(m => console.log(`[${this.name}] ${m}`));
  };
  
  this.getdata = (key) => {
    if (this.isQX) return $prefs.valueForKey(key);
    return null;
  };
  
  this.setdata = (val, key) => {
    if (this.isQX) return $prefs.setValueForKey(val, key);
    return null;
  };
  
  this.notify = (title, subtitle, body) => {
    if (this.isQX) $notify(title, subtitle, body);
    this.log(`---通知---\n${title}\n${subtitle}\n${body}`);
  };
  
  this.get = (options, callback) => {
    if (this.isQX) {
      options.method = "GET";
      $task.fetch(options).then(res => callback(null, res, res.body), err => callback(err));
    }
  };
  
  this.post = (options, callback) => {
    if (this.isQX) {
      options.method = "POST";
      $task.fetch(options).then(res => callback(null, res, res.body), err => callback(err));
    }
  };
  
  this.done = (val = {}) => {
    $done(val);
  };
}
