// (2026-09-11 分模块审计 MOD-02/03) overseas-social-pro 声明了 DEBUG_ENABLE 开关,
// 但脚本此前**零日志、也不读参数** —— 开关无效。现接线: 打开后输出被清理的键名,
// 便于定位"净化过度/不足"。
const DEBUG = readFlag("DEBUG_ENABLE");

if (typeof $response === "undefined") { $done(); return; }
try {
  let body: Record<string, unknown> = JSON.parse($response.body);
  function clean(obj: unknown, depth = 0): void {
    if (!obj || typeof obj !== "object") return;
    if (depth > 10) return;
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      if (/^(?:ad|sponsor|promot|recommend|trend)/i.test(key)) {
        if (DEBUG) console.log(`[Twitter] 清理键: ${key} (depth=${depth})`);
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
