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
      "no-cond-assign": "off",
      "no-fallthrough": "off",
      // 保留能抓到真实问题的规则
      "no-undef": "error",
      "no-redeclare": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
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
];
