if (typeof $response === "undefined") { $done(); return; }
try {
  const obj: Record<string, unknown> = JSON.parse($response.body);
  if (obj && obj.data) {
    obj.data = {};
  }
  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done();
}
