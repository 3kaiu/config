/**
 * tools/mirror-drift-check.mjs 行为回归 (2026-09-11 深度审计 NEW-10)
 *
 * 背景: 该工具此前零接线 (无 npm script / 无 CI / 无测试) = "看起来有门禁其实没有"。
 * 接线前必须先修两处:
 *   ① 无法解析 `for n in …; do mirror …; done` 循环 —— 把 `rules/loon-$n.list` 当成
 *      字面 dest, 于是 6 个真实条目同时被报成"孤儿保留"与"从未抓到" (幻影)。
 *   ② 退出码语义 —— 旧实现在"从未抓到"时 exit 1, 但该状态**不等于缺陷**
 *      (镜像 PR 未合并时 main 上必然全部"从未抓到")。现拆为报告模式 / --strict 门禁。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const WF = path.join(ROOT, ".github/workflows/mirror-scripts.yml");

let mod = null;
const load = async () => (mod ??= await import("../../tools/mirror-drift-check.mjs"));

exports.tests = {
  // ── ① 循环展开 ──
  "mirror-drift: `for n in …; do mirror …; done` 循环被展开为具体 dest": async (a) => {
    const m = await load();
    const wf = [
      "          for n in Advertising Privacy Hijacking Epic China Global; do",
      '            mirror "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/$n/$n.list" \\',
      '              "rules/loon-$n.list" "blackmatrix7 Loon / $n.list"',
      "          done",
    ].join("\n");
    const d = m.parseDeclarations(wf);
    a.equal(d.size, 6, "应展开为 6 条声明");
    for (const n of ["Advertising", "Privacy", "Hijacking", "Epic", "China", "Global"]) {
      a.equal(
        d.get(`rules/loon-${n}.list`),
        `https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/${n}/${n}.list`,
        `${n} 的 URL 应完成变量替换`
      );
    }
    a.equal([...d.keys()].some((k) => k.includes("$")), false, "不得残留未展开的 $ 变量");
  },

  "mirror-drift: `${n}` 花括号写法同样展开": async (a) => {
    const m = await load();
    const wf = [
      "for n in A B; do",
      '  mirror "https://example.com/${n}/x.list" "rules/${n}.list" "x"',
      "done",
    ].join("\n");
    const d = m.parseDeclarations(wf);
    a.equal(d.size, 2, "应展开为 2 条");
    a.equal(d.get("rules/A.list"), "https://example.com/A/x.list", "A 展开");
    a.equal(d.get("rules/B.list"), "https://example.com/B/x.list", "B 展开");
  },

  "mirror-drift: 普通相邻两行 mirror 调用仍被解析 (含行内续行符)": async (a) => {
    const m = await load();
    const wf = [
      '          mirror "https://gist.githubusercontent.com/x/y/raw/a.js" \\',
      '            "a.js" "name"',
      '          mirror "https://raw.githubusercontent.com/x/y/master/b.js" \\',
      '            "b.js" "name"',
    ].join("\n");
    const d = m.parseDeclarations(wf);
    a.equal(d.size, 2, "应解析 2 条");
    a.equal(d.get("a.js"), "https://gist.githubusercontent.com/x/y/raw/a.js", "a.js URL");
    a.equal(d.get("b.js"), "https://raw.githubusercontent.com/x/y/master/b.js", "b.js URL");
  },

  "mirror-drift: 循环外的调用不受循环展开影响 (不重复/不丢失)": async (a) => {
    const m = await load();
    const wf = [
      'mirror "https://e.com/1.list" "r/1.list" "n"',
      "for n in A B; do",
      '  mirror "https://e.com/$n" "r/$n.list" "n"',
      "done",
      'mirror "https://e.com/9.list" "r/9.list" "n"',
    ].join("\n");
    const d = m.parseDeclarations(wf);
    a.equal(d.size, 4, "1 + 2 + 1 = 4 条");
    a.equal(d.has("r/1.list"), true, "循环前条目在场");
    a.equal(d.has("r/9.list"), true, "循环后条目在场");
  },

  // ── 分类 ──
  "mirror-drift: 三类差异分类正确 (漂移/从未抓到/孤儿)": async (a) => {
    const m = await load();
    const declared = new Map([
      ["same.js", "https://e.com/same.js"],
      ["drifted.js", "https://e.com/latest/drifted.js"],
      ["never.js", "https://e.com/never.js"],
    ]);
    const recorded = new Map([
      ["same.js", "https://e.com/same.js"],
      ["drifted.js", "https://e.com/v1.0.0/drifted.js"],
      ["orphan.js", "https://e.com/orphan.js"],
    ]);
    const { drift, missing, orphan } = m.diffDeclarations(declared, recorded);
    a.equal(drift.map((x) => x.dest), ["drifted.js"], "仅 drifted 判为漂移");
    a.equal(drift[0].declared, "https://e.com/latest/drifted.js", "带声明 URL");
    a.equal(drift[0].recorded, "https://e.com/v1.0.0/drifted.js", "带记录 URL");
    a.equal(missing.map((x) => x.dest), ["never.js"], "仅 never 判为从未抓到");
    a.equal(orphan.map((x) => x.dest), ["orphan.js"], "仅 orphan 判为孤儿");
  },

  "mirror-drift: collectRecorded 忽略无 source_url 的条目": async (a) => {
    const m = await load();
    const r = m.collectRecorded({ files: { "a.js": { source_url: "https://e.com/a" }, "b.js": { bytes: 1 }, "c.js": null } });
    a.equal(r.size, 1, "仅保留含 source_url 的条目");
    a.equal(r.get("a.js"), "https://e.com/a", "URL 正确");
  },

  // ── 真实仓库状态 ──
  "mirror-drift: 真实 workflow 展开后无残留 $ 变量 / 无幻影孤儿": async (a) => {
    const m = await load();
    const d = m.parseDeclarations(fs.readFileSync(WF, "utf8"));
    const phantom = [...d.keys()].filter((k) => k.includes("$"));
    a.equal(phantom, [], "不得有未展开的 dest");
    // 6 条 blackmatrix7 规则列表必须在声明集合内 (旧实现漏掉, 导致 6 条幻影孤儿)
    for (const n of ["Advertising", "Privacy", "Hijacking", "Epic", "China", "Global"]) {
      a.equal(d.has(`rules/loon-${n}.list`), true, `rules/loon-${n}.list 应在声明集合内`);
    }
    a.ok(d.size >= 48, `声明数应 ≥48, 实际 ${d.size}`);
  },

  "mirror-drift: 真实仓库 --strict 通过 (漂移/从未抓到均已登记)": async (a) => {
    const m = await load();
    a.equal(m.run(ROOT, { strict: true, quiet: true }), 0, "strict 模式应通过");
  },

  "mirror-drift: --strict 对未登记漂移判红 (ACCEPTED 表之外)": async (a) => {
    const m = await load();
    // 构造一个含未登记漂移的假 root: 声明 latest, 记录 v1
    const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "drift-"));
    fs.mkdirSync(path.join(tmp, ".github/workflows"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "Mirror"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, ".github/workflows/mirror-scripts.yml"),
      'mirror "https://e.com/latest/new.js" "new.js" "n"\n'
    );
    fs.writeFileSync(
      path.join(tmp, "Mirror/MANIFEST.json"),
      JSON.stringify({ files: { "new.js": { source_url: "https://e.com/v1/new.js" } } })
    );
    a.equal(m.run(tmp, { strict: true, quiet: true }), 1, "未登记漂移应判红");
    a.equal(m.run(tmp, { strict: false, quiet: true }), 0, "报告模式恒 exit 0");
    fs.rmSync(tmp, { recursive: true, force: true });
  },

  // ── 入口守卫 ──
  "mirror-drift: import 不触发 main (入口守卫生效)": async (a) => {
    const out = execFileSync(
      process.execPath,
      ["-e", 'import("./tools/mirror-drift-check.mjs").then(() => console.log("IMPORT_OK"));'],
      { cwd: ROOT, encoding: "utf8", timeout: 20000 }
    );
    a.equal(out.trim(), "IMPORT_OK", "import 应只输出 IMPORT_OK");
  },
};
