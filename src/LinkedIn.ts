// (2026-09-11 分模块审计 MOD-02/03) 同 Twitter.ts — 接线 overseas-social-pro 的 DEBUG_ENABLE 开关。
const DEBUG = readFlag("DEBUG_ENABLE");

if (typeof $response === "undefined") { $done(); return; }
try {
  let body: Record<string, unknown> = JSON.parse($response.body);
  function clean(obj: unknown, depth = 0): void {
    if (!obj || typeof obj !== "object") return;
    if (depth > 10) return;
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      // 2026-09-11 深度审计 NEW-06: 原为未锚定前缀正则 /^(?:ad|sponsor|promot|recommend)/i,
      // 会整键删除 address / adaptive / admin / advance 等正常字段。
      // 改用词段匹配 (isSocialAdKey, 见 src/lib/ad.ts), 删除面不变而消除误伤。
      if (isSocialAdKey(key)) {
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
