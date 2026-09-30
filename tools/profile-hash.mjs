/**
 * Profile 发布完整性: 校验和旁文件 (2026-09-30)
 *
 * 缺口: 本仓已有"内容哈希 = 不变量"的三处实践 —— 插件/脚本的 CDN 内容比对
 * (`upstream-health.yml`)、app-ads.txt 语料的 sha256 锚 (`reference/*.json`)、
 * 脚本产物 attestation。但**用户真正导入的那个文件** `Profile/Loon.lcf` 没有任何校验和:
 *   ① 用户无法验证"我导入的这份是否就是仓库里那份"(镜像/缓存/中间人投毒都看不出来);
 *   ② 仓库侧也无法证明"发布出去的就是生成出来的那一份"。
 * `check:sync` 只保证 模板 ↔ 产物 一致, 它证明不了**分发出去的那份**没被动过。
 *
 * 做法: 生成 `Profile/Loon.lcf.sha256`(sha256sum -c 兼容格式), 由 `check:all` 与 CI 守住
 * 同步 —— 产物变了而旁文件没变即判红, 与 `check:sync` 同一失效面纪律。
 * 用户侧验真(仓库根目录):
 *   shasum -a 256 -c Profile/Loon.lcf.sha256        # macOS/Linux
 *   sha256sum -c Profile/Loon.lcf.sha256            # Linux
 *
 * 用法:
 *   node tools/profile-hash.mjs            # --check (默认): 不一致/缺失即退出 1
 *   node tools/profile-hash.mjs --write    # 重新生成旁文件 (改完模板 + generate 之后)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, "..");
export const PROFILE_REL = "Profile/Loon.lcf";
export const SIDECAR_REL = "Profile/Loon.lcf.sha256";

export function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/** 旁文件内容: `<hash>  <相对路径>` —— 两个空格是 sha256sum -c 的格式要求 */
export function renderSidecar(text, rel = PROFILE_REL) {
  return `${sha256(text)}  ${rel}\n`;
}

/** 校验 (纯文件读, 不联网) → { ok, reason, expected, actual } */
export function check(root = ROOT) {
  const profileAbs = path.join(root, PROFILE_REL);
  const sideAbs = path.join(root, SIDECAR_REL);
  if (!fs.existsSync(profileAbs)) return { ok: false, reason: `${PROFILE_REL} 不存在 (先跑 npm run generate)` };
  if (!fs.existsSync(sideAbs)) {
    return { ok: false, reason: `${SIDECAR_REL} 缺失 —— 跑 \`node tools/profile-hash.mjs --write\` 生成` };
  }
  const actual = sha256(fs.readFileSync(profileAbs, "utf8"));
  const raw = fs.readFileSync(sideAbs, "utf8").trim();
  const expected = (raw.split(/\s+/)[0] || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) {
    return { ok: false, reason: `${SIDECAR_REL} 格式非法(应为 sha256sum -c 兼容行)`, expected, actual };
  }
  const declaredPath = raw.split(/\s+/)[1];
  if (declaredPath !== PROFILE_REL) {
    return { ok: false, reason: `旁文件里的路径是 ${declaredPath}, 应为 ${PROFILE_REL}`, expected, actual };
  }
  return { ok: expected === actual, reason: expected === actual ? "一致" : "产物与旁文件不一致(产物变过而旁文件没更新, 或反之)", expected, actual };
}

export function write(root = ROOT) {
  const text = fs.readFileSync(path.join(root, PROFILE_REL), "utf8");
  fs.writeFileSync(path.join(root, SIDECAR_REL), renderSidecar(text));
  return sha256(text);
}

function isMain() {
  const arg = process.argv[1] && path.resolve(process.argv[1]);
  return arg === fileURLToPath(import.meta.url);
}

if (isMain()) {
  if (process.argv.includes("--write")) {
    const h = write();
    console.log(`✅ 已写入 ${SIDECAR_REL}: ${h.slice(0, 16)}…`);
    process.exit(0);
  }
  const r = check();
  if (!r.ok) {
    console.log(`❌ ${SIDECAR_REL}: ${r.reason}`);
    if (r.expected) console.log(`   旁文件 ${String(r.expected).slice(0, 16)}… ≠ 产物 ${String(r.actual).slice(0, 16)}…`);
    console.log("   处置: 确认 Profile/Loon.lcf 是 `npm run generate` 的产物后, 跑 `node tools/profile-hash.mjs --write`。");
    process.exit(1);
  }
  console.log(`✅ Profile 校验和一致: ${r.actual.slice(0, 16)}… (用户可 \`shasum -a 256 -c ${SIDECAR_REL}\` 验真)`);
}
