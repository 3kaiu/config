/**
 * Plugin [Rewrite] 旧语法 → 新语法（Loon 3.5.1 (978)+）批量迁移
 *
 * 基于 nsloon.app 官方 Rewrite 转换器逻辑（rewriteConverter.mjs，已修复：
 * 1) 支持插件参数 enable={ARG}&{ARG2} 后缀 → ${ARG} == true 条件
 * 2) enable=!{ARG} → ${ARG} == false
 * 3) 修正连续 // 斜杠只转义一半的 bug）
 *
 * 额外支持历史遗留的无效 action 别名：
 *   "<url> url reject-200" / "<url> list reject-200" → reject-200
 * （Loon 旧语法不存在 url/list action，这些行长期未生效，意图为 reject-200）
 *
 * 用法：
 *   node tools/rewrite-migrate/index.mjs            # dry-run，仅报告
 *   node tools/rewrite-migrate/index.mjs --write    # 写回插件文件
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {convertLegacyRewrite} from './rewriteConverter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pluginDir = path.join(root, 'Plugin');
const write = process.argv.includes('--write');

const LEGACY_ACTION_ALIASES = new Map([
  ['url', 'reject-200'],
  ['list', 'reject-200'],
]);

function sectionRange(lines, name) {
  const start = lines.findIndex(
    (line) => line.trim().toLowerCase() === `[${name}]`,
  );
  if (start === -1) {
    return null;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return {start, end};
}

function normalizeLegacyLine(line) {
  let next = line;
  let changed = false;
  const apply = (pattern, replacement, count = 1) => {
    const patched = next.replace(pattern, replacement);
    if (patched !== next) {
      next = patched;
      changed = true;
    }
  };

  apply(/^(?:http-request|http-response)\s+/, '');
  apply(
    /^(\S+)\s+(?:url|list)\s+(reject(?:-200|-img|-dict|-array|-video)?)\b/,
    '$1 $2',
  );
  apply(/^(\S+)\s+(?:url|list)\s+(302|307)\s+(.+)$/, '$1 $2 $3');
  apply(/^(\S+)\s+(\S+)\s+302,\s+/, '$1 302 $2, ');
  return changed ? next : line;
}

const files = fs
  .readdirSync(pluginDir)
  .filter((name) => name.endsWith('.plugin'))
  .sort();

let totalConverted = 0;
let totalFailed = 0;
let totalAliased = 0;
const problems = [];

for (const file of files) {
  const filePath = path.join(pluginDir, file);
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const rewrite = sectionRange(lines, 'rewrite');
  if (!rewrite) {
    continue;
  }

  const argument = sectionRange(lines, 'argument');
  const argumentLines = argument
    ? lines.slice(argument.start, argument.end)
    : [];
  const rewriteLines = lines.slice(rewrite.start, rewrite.end);

  let aliased = 0;
  const normalized = rewriteLines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('^http') || trimmed.startsWith('http-')) {
      const before = line;
      const after = normalizeLegacyLine(line);
      if (after !== before) {
        aliased += 1;
      }
      return after;
    }
    return line;
  });

  const result = convertLegacyRewrite(
    [...argumentLines, ...normalized].join('\n'),
    {includeSection: false},
  );

  totalConverted += result.stats.converted;
  totalFailed += result.stats.failed;
  totalAliased += aliased;
  for (const issue of result.issues) {
    problems.push({file, line: rewrite.start + issue.line - argumentLines.length, message: issue.message});
  }

  const outputLines = result.output.split('\n');
  const migratedSection = outputLines.slice(
    argumentLines.length,
    outputLines.length,
  );

  if (write) {
    const next = [
      ...lines.slice(0, rewrite.start),
      ...migratedSection,
      ...lines.slice(rewrite.end),
    ];
    fs.writeFileSync(filePath, next.join('\n'));
  }

  const status = result.stats.failed
    ? `⚠ ${result.stats.failed} 行需检查`
    : `✓ ${result.stats.converted} 行`;
  console.log(`${status.padEnd(22)} ${file}${aliased ? `（别名 ${aliased}）` : ''}`);
}

console.log(`\n合计：转换 ${totalConverted} 行，别名 ${totalAliased} 行，待检查 ${totalFailed} 行`);
for (const p of problems) {
  console.log(`  ✗ ${p.file}:${p.line} ${p.message}`);
}
if (!write) {
  console.log('\n（dry-run，未写回；加 --write 执行）');
}