if (typeof $response === "undefined") { $done(); return; }
try {
  let body: Record<string, unknown> = JSON.parse($response.body);
  function clean(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      if (/^ad|sponsor|promot|recommend/i.test(key)) {
        delete (obj as Record<string, unknown>)[key];
      } else {
        clean((obj as Record<string, unknown>)[key]);
      }
    }
  }
  clean(body);
  $done({ body: JSON.stringify(body) });
} catch (e) {
  $done();
}
