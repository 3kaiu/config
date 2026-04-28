/**
 * 智慧房东广告屏蔽脚本
 * 基于 Loon http-response 拦截
 * 参数: appOpenAds — 开屏广告; bannerPicMore — Banner 广告
 */
const arg = typeof $argument !== "undefined" ? $argument : "";
const $ = new Env("智慧房东");

!(async () => {
  try {
    const obj = JSON.parse($response.body);

    if (arg === "appOpenAds") {
      if (obj && obj.data) {
        obj.data = [];
      }
      $.log("已屏蔽智慧房东开屏广告");
    }
    else if (arg === "bannerPicMore") {
      if (obj && obj.data && obj.data.data) {
        obj.data.data = [];
      }
      if (obj && obj.data) {
        obj.data = {};
      }
      $.log("已屏蔽智慧房东 Banner 广告");
    }

    $.done({ body: JSON.stringify(obj) });
  } catch (e) {
    $.log(`智慧房东去广告异常: ${e}`);
    $.done();
  }
})();

function Env(n) {
  this.name = n;
  this.log = (...a) => console.log(`[${this.name}] ` + a.join(" "));
  this.done = (o = {}) => $done(o);
}
