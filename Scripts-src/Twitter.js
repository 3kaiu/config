if (typeof $response === "undefined") { $done(); return; }
try {
  let body = JSON.parse($response.body);
  function clean(obj) {
    if (!obj || typeof obj !== "object") return;
    for (const key of Object.keys(obj)) {
      if (/^ad|sponsor|promot|recommend|trend/i.test(key)) {
        delete obj[key];
      } else {
        clean(obj[key]);
      }
    }
  }
  clean(body);
  $done({ body: JSON.stringify(body) });
} catch (e) {
  $done();
}
