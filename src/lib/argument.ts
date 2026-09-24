/**
 * 共享工具 — 插件参数 ($argument) 读取。
 *
 * Loon 现代形态 `argument=[{KEY}]` 会传入对象，传统形态会传入字符串；
 * 本模块兼容两者，并只把 true / "true" 视为开启。
 *
 * 经 esbuild `--inject` 注入，导出名在消费者中直接作为全局标识符使用。
 */

/** 取插件传入的原始 $argument; 未传返回 undefined */
function rawArgument(): unknown {
  return typeof $argument === "undefined" ? undefined : $argument;
}

/**
 * 读取一个开关型插件参数。
 *
 * 真值判定刻意保守: 只有 `true` / `"true"` 视为开。Loon 的 switch 控件值就是
 * 这两个字面量, 因此不需要也不应该把任意非空值当真 (`"false"` 非空, 若用
 * 真值判定会把关掉的开关读成开)。
 */
export function readFlag(name: string): boolean {
  const a = rawArgument();
  if (a === undefined || a === null) return false;
  if (typeof a === "object") {
    const v = (a as Record<string, unknown>)[name];
    return v === true || v === "true";
  }
  if (typeof a === "string") {
    // 传统形态: 多参数为 "KEY=true" / "KEY=true&OTHER=false"; 单参数插件可能只传 "true"
    return a === "true" || a.includes(name + "=true");
  }
  return false;
}

/*
 * 2026-09-18 优化审计: 此处原有 `readText(name)` (读 input/select 文本型参数)。
 * 实测零消费者 —— 全仓 (src/、test/、Scripts/ 产物) 命中 0 次, 属死导出:
 * 所有插件参数都是开关型 (readFlag 的 7 处调用点), 没有任何脚本读文本型参数。
 * 按仓库"不留看起来有用其实没有的代码"原则删除 (git 历史保留实现)。
 * 将来确有文本型参数时再补, 并同时补行为级用例。
 */
