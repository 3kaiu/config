#!/usr/bin/env node
/**
 * Kelee 插件 → 功能域总集聚合器 (复用 a45b55d 聚合模式)。
 * 每个总集: 总开关 + 各 App 独立子开关; 规则逐行保真合并, enable={总}&{子} 组合;
 * [MitM] hostname 并集; 源 Kelee 插件删除 (同 App 不多文件, 复用已有合集)。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const GROUPS = [
  {
    key: "transport-purify",
    name: "出行外卖净化",
    desc: "聚合: 12306/两步路/车来了/行者/向日葵/萝卜快跑/顺丰/小桔充电/航旅纵横 — 单插件统一总开关, 各 App 独立子开关",
    tag: "🚕 出行外卖净化",
    icon: "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Car.png",
    members: ["2bulu-remove-ads", "Chelaile-remove-ads", "OnTheWay-remove-ads", "OraySunlogin-remove-ads", "RoboTaxi-remove-ads", "SF-Express-remove-ads", "XiaojukejiCharge-remove-ads"],
  },
  {
    key: "news-purify",
    name: "资讯阅读净化",
    desc: "聚合: 36氪/财新/彩云/豆瓣/豆瓣阅读/虎嗅/IT之家/墨迹/网易新闻/雪球/值得买/什么值得买 — 单插件统一总开关, 各 App 独立子开关",
    tag: "📰 资讯阅读净化",
    icon: "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/News.png",
    members: ["36Kr-remove-ads", "CaixinMedia-remove-ads", "ColorfulClouds-remove-ads", "DouBan-remove-ads", "DoubanRead-remove-ads", "Huxiu-remove-ads", "IThome-remove-ads", "MojiWeather-remove-ads", "NeteaseNews-remove-ads", "Snowball-remove-ads"],
  },
  {
    key: "social-netdisk-purify",
    name: "社交网盘工具净化",
    desc: "聚合: 网盘/文档/词典/社交/工具类 — 单插件统一总开关, 各 App 独立子开关",
    tag: "⚙️ 社交网盘工具净化",
    icon: "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Settings.png",
    members: ["AliYunDrive-remove-ads", "BaiduPhoto-remove-ads", "BaiduTranslate-remove-ads", "BaiduWenku-remove-ads", "CoolApk-remove-ads", "HUPU-remove-ads", "Jump-remove-ads", "LOL-Bible-remove-ads", "MaiMai-remove-ads", "MailMaster-remove-ads", "NetEaseGodlike-remove-ads", "PICC-Insurance-remove-ads", "QuarkBrowser-remove-ads", "QuarkScanking-remove-ads", "TXDocs-remove-ads", "ValorantBible-remove-ads", "WPForum-remove-ads", "WPS-Documents-remove-ads", "Weibo-intl-remove-ads", "XiaoHeiHe-remove-ads", "XiaomiSpeaker-remove-ads", "YoudaoDict-remove-ads", "YoudaoNote-remove-ads", "YoudaoTrans-remove-ads", "WexinMiniPrograms-Remove-ads"],
  },
];

const EXISTING_EXPAND = [
  { key: "shopping-purify", members: ["Beike-remove-ads", "BooHee-remove-ads", "Damai-remove-ads", "DingdongMaicai-remove-ads", "EasyCharge-remove-ads", "FC-Box-remove-ads", "FlyerTea-remove-ads", "HantingHotels-remove-ads", "JDWaimai-remove-ads", "KuaiDi100-remove-ads", "LuckinCoffee-remove-ads", "MaFengWo-remove-ads", "MrHema-remove-ads", "PuPuMall-remove-ads", "TaobaoTravel-remove-ads", "TmallCampus-remove-ads", "iMaiCai-remove-ads"] },
  { key: "video-community-purify", members: ["555DY-remove-ads", "CCLive-remove-ads", "Douyu-remove-ads", "MangoTV-remove-ads", "MoeGirlWiki-remove-ads", "XunLei-remove-ads", "YY-Voice-remove-ads", "YYVoiceTool-remove-ads"] },
  { key: "media-reading-purify", members: ["BodianMusic-remove-ads", "KuGouYouth-remove-ads", "Spotify-remove-ads"] },
];

// 已被已有合集覆盖的 Kelee 插件 → 直接删除 (复用合集, 同 App 不多文件)
const DEDUP_DELETE = ["FleaMarket-remove-ads", "Cainiao-remove-ads", "Tieba-remove-ads", "KuaiShou-remove-ads", "Reddit-remove-ads", "KuGou-remove-ads", "Kuwo-remove-ads", "YouKu-Video-remove-ads"];

const MAIN_SWITCH = {
  "shopping-purify": "SHOPPING_ENABLE",
  "video-community-purify": "VIDEO_ENABLE",
  "media-reading-purify": "MEDIA_ENABLE",
};

function slugOf(name) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}
function readPlugin(name) {
  const src = path.join(ROOT, "Kelee", `${name}.plugin`);
  if (!fs.existsSync(src)) return null;
  return fs.readFileSync(src, "utf8");
}
function parseSegments(txt) {
  const segs = { Rule: [], Rewrite: [], MitM: [], Script: [], Argument: [], Host: [] };
  let cur = null;
  for (const line of txt.split("\n")) {
    const m = line.match(/^\[([A-Za-z ]+)\]/);
    if (m) { cur = m[1]; continue; }
    const t = line.trim();
    if (cur && t && !t.startsWith("#") && !t.startsWith("!")) segs[cur]?.push(t);
  }
  return segs;
}
function stripAction(t) {
  return t.replace(/\s+enable=\{[^}]*\}(&\{[^}]*\})?\s*$/, "").trim();
}
function withEnable(line, expr, ruleType) {
  const base = line.replace(/enable=\{[^}]*\}(&\{[^}]*\})?\s*$/, "").trim();
  return ruleType === "Rule" ? `${base},enable={${expr}}` : `${base} enable={${expr}}`;
}
function mitmHosts(segs) {
  const out = new Set();
  for (const l of segs.MitM) {
    for (const h of l.replace(/^hostname\s*=\s*%APPEND%?\s*,?\s*/, "").split(",")) {
      const hh = h.trim();
      if (hh && !hh.startsWith("-")) out.add(hh);
    }
  }
  return out;
}

const report = [];

// ── 1. 扩展现有总集 ──
for (const { key, members } of EXISTING_EXPAND) {
  const dst = path.join(ROOT, "Plugin", `${key}.plugin`);
  // 幂等重建: 从 git HEAD 取基础内容, 避免重复追加
  let txt;
  const base = execSync(`git show HEAD:Plugin/${key}.plugin`, { encoding: "utf8" }).trim();
  txt = base;
  if (!txt) throw new Error(`扩展现有总集但 HEAD 无文件: ${key}`);
  const mainSw = MAIN_SWITCH[key];
  const seen = new Set();
  for (const seg of ["Rewrite", "Rule"]) for (const l of parseSegments(txt)[seg]) seen.add(stripAction(l));
  const args = [], allRw = [], allRu = [], allMitm = new Set();
  for (const m of members) {
    const mtxt = readPlugin(m);
    if (!mtxt) { console.log(`⚠️ 跳过缺失: ${m}`); continue; }
    const segs = parseSegments(mtxt);
    const sw = `${slugOf(m.replace(/-remove-ads$/, "").replace(/-ads$/, ""))}_ENABLE`;
    const cn = mtxt.match(/^#!name=(.*)$/m)?.[1] || m;
    args.push(`${sw}=switch,"true","false",tag=是否开启${cn.replace(/去广告|增强|净化.*$/, "")}净化,desc=${cn}`);
    for (const l of segs.Rewrite) { const k = stripAction(l); if (seen.has(k)) continue; seen.add(k); allRw.push(withEnable(l, `${mainSw}&{${sw}}`, "Rewrite")); }
    for (const l of segs.Rule) { const k = stripAction(l); if (seen.has(k)) continue; seen.add(k); allRu.push(withEnable(l, `${mainSw}&{${sw}}`, "Rule")); }
    for (const h of mitmHosts(segs)) allMitm.add(h);
  }
  // 总开关行之后插入子开关
  txt = txt.replace(/(^\[Argument\]\n(?:[^\n]+\n)*?)(?=^\[[A-Za-z ]+\]|$)/m, (m, head) => {
    const firstNewline = head.indexOf("\n");
    return head.slice(0, firstNewline + 1) + args.join("\n") + "\n" + head.slice(firstNewline + 1);
  });
  // 追加 Rewrite (无段则创建, 插到 [Script] 前)
  const insBefore = txt.match(/\n\[Script\]/) ? "\n[Script]" : (txt.match(/\n\[MitM\]/) ? "\n[MitM]" : null);
  const rwRe = /(\n\[Rewrite\])([\s\S]*?)(?=\n\[[A-Za-z ]+\]|$)/;
  if (rwRe.test(txt)) txt = txt.replace(rwRe, (m, head, body) => head + body.replace(/\n*\s*$/, "\n") + allRw.join("\n") + "\n");
  else if (allRw.length && insBefore) txt = txt.replace(insBefore, "\n[Rewrite]\n" + allRw.join("\n") + "\n" + insBefore);
  // 追加 Rule
  const ruRe = /(\n\[Rule\])([\s\S]*?)(?=\n\[[A-Za-z ]+\]|$)/;
  if (ruRe.test(txt)) txt = txt.replace(ruRe, (m, head, body) => head + body.replace(/\n*\s*$/, "\n") + allRu.join("\n") + "\n");
  else if (allRu.length && insBefore) txt = txt.replace(insBefore, "\n[Rule]\n" + allRu.join("\n") + "\n" + insBefore);
  // MitM 并集
  const mitmRe = /^(hostname\s*=\s*%APPEND%[^\n]*)$/m;
  if (mitmRe.test(txt)) {
    const cur = txt.match(mitmRe)[1];
    const have = new Set(cur.split(",").map(s => s.trim()).filter(Boolean));
    const add = [...allMitm].filter(h => !have.has(h) && !have.has("*." + h));
    if (add.length) txt = txt.replace(cur, cur.replace(/\s*$/, "") + ", " + add.join(", "));
  } else if (allMitm.size) {
    txt += `\n[MitM]\nhostname = %APPEND% ${[...allMitm].join(", ")}\n`;
  }
  fs.writeFileSync(dst, txt);
  report.push(`${key}: 扩 ${members.length} App (args +${args.length}, Rw +${allRw.length}, Ru +${allRu.length}, MitM +${allMitm.size})`);
}

// ── 2. 新建总集 ──
for (const g of GROUPS) {
  const dst = path.join(ROOT, "Plugin", `${g.key}.plugin`);
  const mainSw = `${slugOf(g.key)}_ENABLE`;
  const lines = [];
  lines.push(`#!name=${g.name}`, `#!desc=${g.desc}`, `#!version=1.0`, `#!author=3kaiu (聚合器生成)`, `#!homepage=https://github.com/3kaiu/config`, `#!icon=${g.icon}`, `#!system = iOS,iPadOS,macOS`, `#!loon_version = 3.2.4(787)`, `#!tag=${g.tag}`, ``);
  lines.push(`[Argument]`, `${mainSw}=switch,"true","false",tag=总开关,desc=关闭后整组净化全部停用`);
  const args = [], allRw = [], allRu = [], allMitm = new Set();
  const seen = new Set();
  for (const m of g.members) {
    const mtxt = readPlugin(m);
    if (!mtxt) { console.log(`⚠️ 跳过缺失: ${m}`); continue; }
    const segs = parseSegments(mtxt);
    const sw = `${slugOf(m.replace(/-remove-ads$/, "").replace(/-ads$/, ""))}_ENABLE`;
    const cn = mtxt.match(/^#!name=(.*)$/m)?.[1] || m;
    args.push(`${sw}=switch,"true","false",tag=是否开启${cn.replace(/去广告|增强|净化.*$/, "")}净化,desc=${cn}`);
    for (const l of segs.Rewrite) { const k = stripAction(l); if (seen.has(k)) continue; seen.add(k); allRw.push(withEnable(l, `${mainSw}&{${sw}}`, "Rewrite")); }
    for (const l of segs.Rule) { const k = stripAction(l); if (seen.has(k)) continue; seen.add(k); allRu.push(withEnable(l, `${mainSw}&{${sw}}`, "Rule")); }
    for (const h of mitmHosts(segs)) allMitm.add(h);
  }
  for (const a of args) lines.push(a);
  if (allRw.length) lines.push(``, `[Rewrite]`, ...allRw);
  if (allRu.length) lines.push(``, `[Rule]`, ...allRu);
  if (allMitm.size) lines.push(``, `[MitM]`, `hostname = %APPEND% ${[...allMitm].join(", ")}`);
  fs.writeFileSync(dst, lines.join("\n") + "\n");
  report.push(`${g.key}: 新建 (${g.members.length} App, Rw ${allRw.length} Ru ${allRu.length} MitM ${allMitm.size})`);
}

// ── 3. 删除源 Kelee 插件 (聚合成员 + 去重覆盖) ──
const toDelete = new Set(DEDUP_DELETE);
for (const g of [...GROUPS, ...EXISTING_EXPAND]) for (const m of g.members) toDelete.add(m);
let del = 0;
for (const m of toDelete) {
  const p = path.join(ROOT, "Kelee", `${m}.plugin`);
  if (fs.existsSync(p)) { fs.rmSync(p); del++; }
}
report.push(`删除源 Kelee: ${del} 个`);
console.log(report.join("\n"));