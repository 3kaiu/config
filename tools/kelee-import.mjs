#!/usr/bin/env node
// kelee-import: 将 kelee.one 上游 .lpx 转写为仓库风格 Kelee/*.plugin
// 用法: node tools/kelee-import.mjs [文件名1 文件名2 ...]  (缺省: 全部无脚本 A 类)
// 输入: /tmp/kelee-lpx/*.lpx  (上游全量拉取目录)
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = '/tmp/kelee-lpx';
const DST = 'Kelee';

const TPL = `#!name={NAME}
#!desc={DESC}
#!version=1.0
#!author=3kaiu (基于可莉 iKeLee 插件转写, CC BY-NC-SA)
#!homepage=https://github.com/3kaiu/config
#!icon={ICON}
#!system = iOS,iPadOS,macOS
#!loon_version = 3.2.4(787)
`;

function toPluginName(f) {
  return f.replace(/\.lpx$/, '').replace(/_/g, '-') + '.plugin';
}

function transform(lines) {
  const out = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = line.match(/^\[(Rule|Rewrite|MitM|Host|Script|Argument)\]$/);
    if (m) {
      // 自维护模式: 丢弃外部脚本段 (Script/Argument), 仅保留规则主体
      if (['Script', 'Argument'].includes(m[1])) { cur = 'SKIP'; continue; }
      cur = m[1]; out.push(line);
      continue;
    }
    if (!cur || cur === 'SKIP' || !line.trim() || line.startsWith('#')) continue;
    if (cur === 'Rule') {
      const rm = line.match(/^(DOMAIN-KEYWORD|DOMAIN-SUFFIX|DOMAIN),([^,]+),(REJECT|DIRECT|Proxy)/);
      if (rm && rm[3] === 'REJECT') {
        out.push(`DOMAIN,${rm[2]},REJECT,extended-matching,pre-matching`);
      } else if (rm) {
        out.push(line);
      } else {
        out.push(line);
      }
    } else if (cur === 'Rewrite') {
      out.push(line);
    } else if (cur === 'MitM') {
      out.push(line);
    } else {
      out.push(line);
    }
  }
  return out;
}

const want = process.argv.slice(2);
const includeScript = process.argv.includes('--include-script');
const files = (want.length ? want.filter(a => !a.startsWith('--')) : readdirSync(SRC).filter(f => f.endsWith('.lpx'))).map(f => f.endsWith('.lpx') ? f : f + '.lpx');

let made = 0, skipped = 0, skippedScript = 0, failed = [];
for (const f of files) {
  const src = join(SRC, f);
  if (!existsSync(src)) { failed.push(`${f} 不存在`); continue; }
  const text = readFileSync(src, 'utf8');
  const lines = text.split(/\r?\n/);
  const hdr = {};
  for (const l of lines) {
    if (l.startsWith('#!')) { const [k, v] = l.slice(2).split(/=(.*)/s); hdr[k] = v; }
  }
  const hasScript = text.includes('\n[Script]');
  if (hasScript && !includeScript) { skippedScript++; continue; }
  const name = toPluginName(f);
  const dst = join(DST, name);
  if (existsSync(dst)) { skipped++; continue; }
  const body = transform(lines);
  const desc = (hdr.desc || '').replace(/\n/g, ' ').slice(0, 100);
  const suffix = hasScript ? ' (规则版: 已去除原版外部脚本, 自维护)' : '';
  const plugin = TPL
    .replace('{NAME}', hdr.name || name)
    .replace('{DESC}', desc ? `${desc}${suffix}` : '')
    .replace('{ICON}', hdr.icon || '')
    .replace('{NAME}', hdr.name || name)
    + body.join('\n') + '\n';
  writeFileSync(dst, plugin);
  made++;
}
console.log(`生成 ${made} 个, 跳过已存在 ${skipped} 个, 跳过含脚本 ${skippedScript} 个, 失败 ${failed.length}`);
if (failed.length) console.log(failed.join('\n'));
