/**
 * 零依赖测试运行器: node test/run-tests.js
 * 发现 test/cases/*.test.js:
 *   - 导出 { tests: { "<name>": async fn(assert, h) } }
 *   - 或使用 describe/it (polyfill 自动转换为 tests 格式)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const harness = require("./harness");

function makeAssert() {
  const fails = [];
  return {
    fails,
    equal(actual, expected, msg) {
      const a = JSON.stringify(actual), e = JSON.stringify(expected);
      if (a !== e) fails.push(`${msg || "equal"}: 期望 ${e}, 实际 ${a}`);
    },
    ok(cond, msg) { if (!cond) fails.push(msg || "期望为真"); },
    includes(haystack, needle, msg) {
      const h = typeof haystack === "string" ? haystack : JSON.stringify(haystack);
      if (!h.includes(needle)) fails.push(`${msg || "includes"}: ${JSON.stringify(needle)} 未出现在 ${h.slice(0, 200)}`);
    },
    notIncludes(haystack, needle, msg) {
      const h = typeof haystack === "string" ? haystack : JSON.stringify(haystack);
      if (h.includes(needle)) fails.push(`${msg || "notIncludes"}: ${JSON.stringify(needle)} 不应出现`);
    },
  };
}

const _collected = {};

globalThis.describe = (label, fn) => {
  const prev = _collected._group;
  _collected._group = label;
  fn();
  _collected._group = prev;
};

globalThis.it = (label, fn) => {
  const group = _collected._group;
  const name = group ? `${group} > ${label}` : label;
  _collected[name] = fn;
};

async function runTests(file, tests) {
  const entries = Object.entries(tests).filter(([k]) => k !== "_group");
  let pass = 0, fail = 0;
  const failures = [];

  for (const [name, fn] of entries) {
    const assert = makeAssert();
    try {
      await fn(assert, harness);
      if (assert.fails.length) throw new Error(assert.fails.join("; "));
      pass++;
      console.log(`  ✅ ${file} :: ${name}`);
    } catch (e) {
      fail++;
      failures.push(`${file} :: ${name} — ${e.message}`);
      console.log(`  ❌ ${file} :: ${name}`);
      console.log(`     ${String(e.message).split("\n").join("\n     ")}`);
    }
  }

  return { pass, fail, failures };
}

async function main() {
  const dir = path.join(__dirname, "cases");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).sort();
  let totalPass = 0, totalFail = 0;
  const allFailures = [];

  for (const f of files) {
    Object.keys(_collected).forEach(k => delete _collected[k]);

    const mod = require(path.join(dir, f));

    const tests = Object.keys(_collected).length > 0 ? { ..._collected } : (mod.tests || {});

    const { pass, fail, failures } = await runTests(f, tests);
    totalPass += pass;
    totalFail += fail;
    allFailures.push(...failures);
  }

  console.log("");
  console.log(`结果: ${totalPass} 通过, ${totalFail} 失败 (共 ${totalPass + totalFail})`);
  if (totalFail) {
    console.log("\n失败明细:");
    allFailures.forEach((x) => console.log("  - " + x));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
