/**
 * 共享工具 — URL / 主机名判定
 *
 * 为什么单独成模块: 这两个函数此前在 6 个脚本里各有一份**逐字符相同**的副本
 * (Fanqie / Youku / Kugou / Douyin / Meituan / Dianping)。isHost 的语义是
 * **子域后缀匹配**(`isHost(u,'youku.com')` 必须匹配 `api.youku.com` 但**不得**
 * 匹配 `evil-youku.com`), 属安全相关判定 — 6 份副本意味着一次修正要改 6 处,
 * 漏一处就是静默的域名误判。
 *
 * 分发方式: 本文件不作为入口打包, 而是经 esbuild `--inject` 注入 —
 * 其导出名在脚本中直接以全局标识符使用 (与 src/env.ts 的 Env 同一机制)。
 * 见 package.json 的 build 脚本与 AGENTS.md。
 */

/** 取 URL 的 hostname; 解析失败返回空串 (而非抛错) */
export function hostOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
}

/**
 * 判定 u 的主机名是否等于 d 或为 d 的子域。
 * 注意: 用 `h.endsWith("." + d)` 而非 `h.endsWith(d)` — 后者会让
 * `evil-youku.com` 误判为 youku.com 的子域。
 */
export function isHost(u: string, d: string): boolean {
  const h = hostOf(u);
  return h === d || h.endsWith("." + d);
}
