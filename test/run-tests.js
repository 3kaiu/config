/**
 * 零依赖测试运行器: node test/run-tests.js
 * 发现 test/cases/*.test.js, 每个文件导出 { tests: { "<name>": async fn(assert, h) } }
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

async function main() {
  const dir = path.join(__dirname, "cases");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).sort();
  let pass = 0, fail = 0;
  const failures = [];

  for (const f of files) {
    const mod = require(path.join(dir, f));
    const tests = mod.tests || {};
    for (const [name, fn] of Object.entries(tests)) {
      const assert = makeAssert();
      try {
        await fn(assert, harness);
        if (assert.fails.length) throw new Error(assert.fails.join("; "));
        pass++;
        console.log(`  ✅ ${f} :: ${name}`);
      } catch (e) {
        fail++;
        failures.push(`${f} :: ${name} — ${e.message}`);
        console.log(`  ❌ ${f} :: ${name}`);
        console.log(`     ${String(e.message).split("\n").join("\n     ")}`);
      }
    }
  }

  console.log("");
  console.log(`结果: ${pass} 通过, ${fail} 失败 (共 ${pass + fail})`);
  if (fail) {
    console.log("\n失败明细:");
    failures.forEach((x) => console.log("  - " + x));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
