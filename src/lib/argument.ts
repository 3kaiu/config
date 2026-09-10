/**
 * 共享工具 — 插件参数 ($argument) 读取
 *
 * 为什么单独成模块 (2026-09-11 分模块审计 MOD-02):
 * 三个脚本各自用 `$argument.includes("KEY=true")` 判断调试开关, 但**没有任何插件
 * 按这个格式传参** — 实测:
 *   src/Bilibili.ts:7    $argument.includes("BILI_DEBUG_ENABLE=true")  ← bilibili-pro:48 无 argument=
 *   src/AlipayMini.ts:29 $argument.includes("DEBUG_MODE=true")         ← 13 行传的是动作名 ad-splash-filter 等
 *   src/Zhihu.ts         从不读取 $argument                            ← zhihu-pro:115 却传了 argument=[{ZHIHU_DEBUG_ENABLE}]
 * 三处 debug 分支因此**永远不可达**, 且各自发明了不同键名。
 *
 * Loon 的两种传参形态 (官方文档 nsloon.app/docs/Plugin/):
 *   现代: `argument=[{KEY}]`  → $argument 为**对象**, 读 $argument.KEY
 *   传统: `argument=<字符串>` → $argument 为**字符串**, 按字面量匹配
 * 本模块两种都兼容, 因此插件侧改用现代形态后老写法不会静默失效。
 *
 * 分发方式: 经 esbuild `--inject` 注入, 导出名在脚本中直接以全局标识符使用
 * (与 src/env.ts 的 Env、src/lib/net.ts 的 isHost 同一机制)。
 * 见 package.json 的 build 脚本与 AGENTS.md。
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

/**
 * 读取一个文本型插件参数 (input / select)。
 * 未传或类型不符返回空串 — 调用方无需再做 undefined 守卫。
 */
export function readText(name: string): string {
  const a = rawArgument();
  if (a === undefined || a === null) return "";
  if (typeof a === "object") {
    const v = (a as Record<string, unknown>)[name];
    return typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);
  }
  if (typeof a === "string") {
    // 传统形态 "KEY=value" — 取该键的值, 而非整串
    const m = a.match(new RegExp("(?:^|[&;])\\s*" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^&;]*)"));
    return m ? m[1] : "";
  }
  return "";
}
