/**
 * NEW-14 收敛守卫 (2026-09-29): Mirror 插件运行时 URL 的收敛不变量
 *
 * 背景: mirror-scripts.yml 的旧门禁用 `grep -e mock.js -e NSNanoCat...latest` 两个
 * 字面量断言"传递依赖已收敛" —— 上游换一个字符串就绕过。实测 Enhanced v0.6.0 新增
 * 8 处 biliverse.github.io 引用 (settings 目录/ index.mjs/ theme.css/ 5 张主题 PNG)
 * 与 3 处 NSNanoCat index.html|index.mjs|navigation.mjs, 旧门禁**全绿**。
 * 门禁已改为属性断言, 但它跑在镜像步骤里且按设计只 `mark_fail` 软告警 (未过门禁
 * 保留旧版, 不 exit 1 —— 见 mirror-scripts.yml 118 行注释), 故**没有硬红灯**守住
 * 仓库当前状态。本用例补上硬红灯: 仓库里已收敛的, 上游一动就判红。
 *
 * 断言三件事:
 *   1. 全部 Mirror/**\/*.plugin|*.lpx 的运行时 URL (script-path= 与 mock_file 第二参,
 *      跳过 # 注释行) 必须命中白名单: 自建 CDN 前缀 或 固定 tag 的 releases/download;
 *      白名单外必须**逐字登记**为例外 (不许静默放行)
 *   2. 登记的例外必须仍在对应文件里真实出现 (防陈旧条目长期免责 —— 修好了还留着)
 *   3. 插件引用的每个 https://ws.wenn.in/main/Mirror/X 必须**落盘且进 MANIFEST**
 *      (防"引用了没镜像 / 镜像被删但引用还在", 即 issue #45 那类上游 404)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const MIRROR = path.join(REPO, "Mirror");
const CDN_PREFIX = "https://ws.wenn.in/main/Mirror/";

/**
 * 白名单外的显式例外登记。
 * 每一项都是"已知的可变引用", 必须给出确切 URL —— 上游一旦改动这些 URL,
 * 用例 2 会判红, 提醒人工复核而不是让免责条目默默继续有效。
 */
const KNOWN_UNCONVERGED = {
  // 2026-09-29 登记: Auraflare 的 script-path 指向 raw.githubusercontent 的可变
  // `main` 分支 (域名在 mirror-scripts.yml 门禁 4 白名单内, 故镜像步骤不会拦)。
  // 与 BiliUniverse 同类暴露, 属"靠上游仓库不可变性兜底"而非收敛;
  // 待办见 issue #48。
  "auraflare/Cloudflare.1.1.1.1.plugin": [
    "https://raw.githubusercontent.com/VirgilClyne/Cloudflare/main/js/1.1.1.1.panel.js",
    "https://raw.githubusercontent.com/VirgilClyne/Cloudflare/main/js/1.1.1.1.request.js",
    "https://raw.githubusercontent.com/VirgilClyne/Cloudflare/main/js/1.1.1.1.response.js",
  ],
};

function walkPlugins(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkPlugins(p, acc);
    else if (e.name.endsWith(".plugin") || e.name.endsWith(".lpx")) acc.push(p);
  }
  return acc;
}

/** 提取运行时 URL: 只取 script-path= 与 mock_file 的第二参, 跳过 # 注释行 */
function runtimeUrls(file) {
  const txt = fs.readFileSync(file, "utf8");
  const urls = [];
  for (const line of txt.split("\n")) {
    if (line.trim().startsWith("#")) continue;
    for (const m of line.matchAll(/script-path\s*=\s*(https?:\/\/[^\s,")]+)/gi)) urls.push(m[1]);
    for (const m of line.matchAll(/mock_file\s*\(\s*"[^"]+"\s*,\s*"(https?:\/\/[^"]+)"/g)) urls.push(m[1]);
  }
  return urls;
}

/** 自建 CDN 前缀, 或 releases/download/<固定tag>/ (显式排除 latest) */
function isConverged(url) {
  if (url.startsWith(CDN_PREFIX)) return true;
  const pin = url.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/([^/]+)\//);
  return Boolean(pin) && pin[1] !== "latest";
}

function relKey(file) {
  return path.relative(MIRROR, file).split(path.sep).join("/");
}

exports.tests = {
  "NEW-14: 运行时 URL 全部收敛 (CDN 或固定 tag), 白名单外必须逐字登记": async (a) => {
    const files = walkPlugins(MIRROR);
    a.ok(files.length > 0, "Mirror/ 下应至少有一个插件");
    const unconverged = new Map();
    for (const f of files) {
      const bad = [...new Set(runtimeUrls(f))].filter((u) => !isConverged(u));
      if (bad.length) unconverged.set(relKey(f), bad);
    }
    const unregistered = [];
    for (const [key, urls] of unconverged) {
      const allowed = KNOWN_UNCONVERGED[key];
      for (const u of urls) {
        if (!allowed || !allowed.includes(u)) unregistered.push(`${key} -> ${u}`);
      }
    }
    a.equal(
      unregistered,
      [],
      `未登记的可变运行时 URL (须收敛到自建 CDN / 固定 tag, 或补进 KNOWN_UNCONVERGED 并说明理由): ${unregistered.join("; ")}`
    );
  },

  "NEW-14: 登记的例外必须仍真实存在 (防陈旧免责条目)": async (a) => {
    const stale = [];
    for (const [key, urls] of Object.entries(KNOWN_UNCONVERGED)) {
      const file = path.join(MIRROR, key);
      if (!fs.existsSync(file)) {
        stale.push(`${key} 文件已不存在, 应删除该例外登记`);
        continue;
      }
      const txt = fs.readFileSync(file, "utf8");
      for (const u of urls) {
        if (!txt.includes(u)) stale.push(`${key} 不再引用 ${u}, 应删除该例外登记`);
      }
    }
    a.equal(stale, [], `陈旧例外登记: ${stale.join("; ")}`);
  },

  "NEW-14: 插件引用的 CDN 镜像必须落盘且进 MANIFEST (防 issue #45 复发)": async (a) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(MIRROR, "MANIFEST.json"), "utf8"));
    const problems = [];
    for (const f of walkPlugins(MIRROR)) {
      const txt = fs.readFileSync(f, "utf8");
      const refs = new Set();
      for (const m of txt.matchAll(/https:\/\/ws\.wenn\.in\/main\/Mirror\/([^"',),\s]+)/g)) refs.add(m[1]);
      for (const ref of refs) {
        const disk = path.join(MIRROR, ref);
        if (!fs.existsSync(disk)) {
          problems.push(`${relKey(f)} 引用的 ${ref} 未落盘`);
        } else if (!manifest.files[ref]) {
          problems.push(`${relKey(f)} 引用的 ${ref} 不在 MANIFEST (缺哈希门禁)`);
        }
      }
    }
    a.equal(problems, [], `CDN 引用解析失败: ${problems.join("; ")}`);
  },
};
