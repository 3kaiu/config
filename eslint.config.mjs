// ESLint 9 flat config — 取代 legacy .eslintrc.json/.eslintignore
// (eslint 9 不再读取 legacy 配置, 此前 surgio 内嵌 eslint 因此无视 ignore
//  规则并对 Mirror/ 做了非预期修改 — 见 2026-07 审计)
//
// 范围: Scripts/ 与 test/ 受检; Mirror/ (第三方 minified) 与 Profile/ 排除。
import js from "@eslint/js";

// 代理运行时注入的全局变量 (Loon / QX / Surge) + 常用内建
const PROXY_GLOBALS = {
  $request: "readonly",
  $response: "writable",
  $done: "readonly",
  $loon: "readonly",
  $task: "readonly",
  $httpClient: "readonly",
  $persistentStore: "readonly",
  $prefs: "readonly",
  $notification: "readonly",
  $notify: "readonly",
  $argument: "readonly",
  $environment: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  Promise: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  JSON: "readonly",
  Math: "readonly",
  Date: "readonly",
  parseInt: "readonly",
  parseFloat: "readonly",
  isNaN: "readonly",
  encodeURIComponent: "readonly",
  decodeURIComponent: "readonly",
  escape: "readonly",
  unescape: "readonly",
  String: "readonly",
  Number: "readonly",
  Boolean: "readonly",
  Array: "readonly",
  Object: "readonly",
  RegExp: "readonly",
  Error: "readonly",
  TypeError: "readonly",
  Map: "readonly",
  Set: "readonly",
  Symbol: "readonly",
  Uint8Array: "readonly",
  Uint16Array: "readonly",
  Uint32Array: "readonly",
  Int8Array: "readonly",
  DataView: "readonly",
  ArrayBuffer: "readonly",
  atob: "readonly",
  btoa: "readonly",
  self: "readonly",
  window: "readonly",
  globalThis: "readonly",
  // 双入口脚本 (module.exports 供 Node 测试 / Loon 运行时分支) 与文本解码内建
  module: "writable",
  TextDecoder: "readonly",
  NaN: "readonly",
  Infinity: "readonly",
  undefined: "readonly",
};

export default [
  {
    ignores: ["Mirror/**", "Profile/**", "node_modules/**", "template/**"],
  },
  js.configs.recommended,
  {
    files: ["Scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      // 代理脚本顶层允许 return (守卫语句, 运行时由宿主包在函数上下文内执行)
      parserOptions: { ecmaFeatures: { globalReturn: true } },
      globals: PROXY_GLOBALS,
    },
    rules: {
      // 代理脚本常见且无害的模式, 降级或关闭
      "no-unused-vars": "off",
      "no-empty": "off",
      "no-control-regex": "off",
      "no-async-promise-executor": "off",
      "no-prototype-builtins": "off",
      // 保留能抓到真实问题的规则
      "no-undef": "error",
      "no-redeclare": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      // 2026-09-11 深度审计 NEW-12: 原先 no-cond-assign / no-fallthrough 也被关闭。
      // 这两条是控制流规则, **在压缩产物上依然有效** —— esbuild 不会凭空制造
      // 赋值条件或 case 穿透, 故开启不会误报 (实测 60 个产物全绿)。
      // 已实测生效: 注入 `if (x = 3)` 与无 break 的 case → 分别报
      // no-cond-assign / no-fallthrough。走 recommended 默认 (error), 不显式声明。
      // 注: 覆盖 src/ 需 @typescript-eslint/parser (src/*.ts 含真实 TS 语法:
      // interface/type/类型标注), 与"仅 3 个 devDependencies"的取舍冲突 → 不做;
      // src/ 的可机械判定部分改由 tools/src-antipattern-check.mjs 兜底。
    },
  },
  {
    files: ["test/**/*.js", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "writable",
        exports: "writable",
        process: "readonly",
        __dirname: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        setImmediate: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        URL: "readonly",
      },
    },
    rules: { "no-unused-vars": "off" },
  },
  {
    files: ["tools/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
      },
    },
    rules: { "no-unused-vars": "off" },
  },
];
