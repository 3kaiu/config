// (2026-09-11 分模块审计 MOD-02/03) 同 Twitter.ts — 接线 overseas-social-pro 的 DEBUG_ENABLE 开关。
const DEBUG = readFlag("DEBUG_ENABLE");

if (typeof $response === "undefined") { $done(); return; }
try {
  let body: Record<string, unknown> = JSON.parse($response.body);
  function clean(obj: unknown, depth = 0): void {
    if (!obj || typeof obj !== "object") return;
    if (depth > 10) return;
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      if (/^(?:ad|sponsor|promot|recommend)/i.test(key)) {
        if (DEBUG) console.log(`[LinkedIn] 清理键: ${key} (depth=${depth})`);
        delete (obj as Record<string, unknown>)[key];
      } else {
        clean((obj as Record<string, unknown>)[key], depth + 1);
      }
    }
  }
  clean(body);
  $done({ body: JSON.stringify(body) });
} catch (e) {
  $done();
}
