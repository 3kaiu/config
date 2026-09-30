"use strict";
/**
 * Profile 发布完整性门禁的回归 (2026-09-30)
 *
 * 旁文件 `Profile/Loon.lcf.sha256` 是**用户侧**唯一的验真入口(`shasum -a 256 -c`)。
 * 它有两个必须被用例钉死的性质:
 *   ① 格式必须是 sha256sum -c 兼容的 `<64hex>  <相对路径>` —— 格式错了用户验不了;
 *   ② 必须能双向判红(产物改了 / 旁文件改了), 否则它只是装饰。
 * 用临时目录驱动, 不碰真仓库产物。
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

let mod = null;
const load = async () => (mod ??= await import("../../tools/profile-hash.mjs"));

const mkroot = (profileText, sidecarText) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "profile-hash-"));
  fs.mkdirSync(path.join(root, "Profile"), { recursive: true });
  fs.writeFileSync(path.join(root, "Profile", "Loon.lcf"), profileText);
  if (sidecarText !== null) fs.writeFileSync(path.join(root, "Profile", "Loon.lcf.sha256"), sidecarText);
  return root;
};

exports.tests = {
  "profile-hash: 旁文件是 sha256sum -c 兼容格式": async (a) => {
    const { renderSidecar, sha256 } = await load();
    const line = renderSidecar("[General]\nfoo = bar\n");
    a.ok(/^[0-9a-f]{64} {2}Profile\/Loon\.lcf\n$/.test(line), `格式不是 sha256sum -c 兼容行: ${JSON.stringify(line)}`);
    a.equal(line.split(" ")[0], sha256("[General]\nfoo = bar\n"), "首列必须是产物的 sha256");
  },

  "profile-hash: 一致/缺失/篡改 三种状态都要判对": async (a) => {
    const { check, renderSidecar } = await load();
    const text = "[General]\nip-mode = ipv4-only\n";
    const ok = check(mkroot(text, renderSidecar(text)));
    a.ok(ok.ok, `一致时应通过, 实为: ${ok.reason}`);

    const missing = check(mkroot(text, null));
    a.ok(!missing.ok && /缺失/.test(missing.reason), "旁文件缺失必须判红(而不是静默通过)");

    const tampered = check(mkroot(text + "# tamper\n", renderSidecar(text)));
    a.ok(!tampered.ok && /不一致/.test(tampered.reason), "产物被改必须判红");

    const badPath = check(mkroot(text, `${"a".repeat(64)}  Profile/Other.lcf\n`));
    a.ok(!badPath.ok && /路径/.test(badPath.reason), "旁文件路径写错必须判红(否则 shasum -c 校验的是别的文件)");

    const badFormat = check(mkroot(text, "not-a-hash\n"));
    a.ok(!badFormat.ok && /格式非法/.test(badFormat.reason), "非 sha256 行必须判红");
  },

  "profile-hash: 真仓库旁文件与产物一致": async (a) => {
    const { check } = await load();
    const r = check();
    a.ok(
      r.ok,
      `真仓库不一致: ${r.reason} —— 改完模板要 \`npm run generate\` 再 \`node tools/profile-hash.mjs --write\``
    );
  },
};
