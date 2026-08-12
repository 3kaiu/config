/**
 * Plugin [Rewrite] 语法批量迁移
 *
 * 默认模式（旧语法 → 新语法，Loon 3.5.1 (978)+）：
 *   基于 nsloon.app 官方 Rewrite 转换器逻辑（rewriteConverter.mjs，已修复：
 *   1) 支持插件参数 enable={ARG}&{ARG2} 后缀 → ${ARG} == true 条件
 *   2) enable=!{ARG} → ${ARG} == false
 *   3) 修正连续 // 斜杠只转义一半的 bug）
 *   额外支持历史遗留的无效 action 别名：
 *     "<url> url reject-200" / "<url> list reject-200" → reject-200
 *   （Loon 旧语法不存在 url/list action，这些行长期未生效，意图为 reject-200）
 *
 * --revert 模式（新语法 → 旧语法，兼容 Loon 3.5.0 及以下）：
 *   request if ${url} ~= /pat/i && ${ARG} == true then reject_dict(200)
 *     → ^pat reject-dict enable={ARG}
 *   同时将 #!loon_version = 3.5.1(978) 回退为 #!loon_version = 3.2.4(787)
 *
 * 用法：
 *   node tools/rewrite-migrate/index.mjs            # dry-run，仅报告
 *   node tools/rewrite-migrate/index.mjs --write    # 写回插件文件
 *   node tools/rewrite-migrate/index.mjs --revert          # dry-run 回退
 *   node tools/rewrite-migrate/index.mjs --revert --write  # 写回回退
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {convertLegacyRewrite} from './rewriteConverter.mjs';
import {convertNewRewrite} from './revertConverter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pluginDir = path.join(root, 'Plugin');
const write = process.argv.includes('--write');
const revert = process.argv.includes('--revert');

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
  const apply = (pattern, replacement) => {
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

function migrateForward(file, filePath, lines) {
  const rewrite = sectionRange(lines, 'rewrite');
  if (!rewrite) {
    return {converted: 0, failed: 0, aliased: 0, issues: [], changed: false};
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
      const after = normalizeLegacyLine(line);
      if (after !== line) {
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

  const issues = result.issues.map((issue) => ({
    file,
    line: rewrite.start + issue.line - argumentLines.length,
    message: issue.message,
  }));

  const outputLines = result.output.split('\n');
  const migratedSection = outputLines.slice(
    argumentLines.length,
    outputLines.length,
  );

  let changed = false;
  if (write) {
    const next = [
      ...lines.slice(0, rewrite.start),
      ...migratedSection,
      ...lines.slice(rewrite.end),
    ];
    if (next.join('\n') !== lines.join('\n')) {
      fs.writeFileSync(filePath, next.join('\n'));
      changed = true;
    }
  }

  return {
    converted: result.stats.converted,
    failed: result.stats.failed,
    aliased,
    issues,
    changed,
  };
}

function migrateBackward(file, filePath, lines) {
  const rewrite = sectionRange(lines, 'rewrite');
  const stats = {converted: 0, failed: 0, issues: [], headers: 0};

  if (rewrite) {
    const rewriteLines = lines.slice(rewrite.start, rewrite.end);
    const result = convertNewRewrite(rewriteLines.join('\n'));
    stats.converted += result.stats.converted;
    stats.failed += result.stats.failed;
    for (const issue of result.issues) {
      stats.issues.push({
        file,
        line: rewrite.start + issue.line,
        message: issue.message,
      });
    }
    if (result.stats.converted > 0 && write) {
      const migratedSection = result.output.split('\n');
      const next = [
        ...lines.slice(0, rewrite.start),
        ...migratedSection,
        ...lines.slice(rewrite.end),
      ];
      fs.writeFileSync(filePath, next.join('\n'));
      lines = next;
    }
  }

  const header = lines.findIndex(
    (line) => line.trim() === '#!loon_version = 3.5.1(978)',
  );
  if (header !== -1) {
    stats.headers += 1;
    if (write) {
      lines[header] = '#!loon_version = 3.2.4(787)';
      fs.writeFileSync(filePath, lines.join('\n'));
    }
  }

  return stats;
}

const files = fs
  .readdirSync(pluginDir)
  .filter((name) => name.endsWith('.plugin'))
  .sort();

const totals = {converted: 0, failed: 0, aliased: 0, headers: 0};
const problems = [];

for (const file of files) {
  const filePath = path.join(pluginDir, file);
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  if (revert) {
    const stats = migrateBackward(file, filePath, lines);
    totals.converted += stats.converted;
    totals.failed += stats.failed;
    totals.headers += stats.headers;
    problems.push(...stats.issues);
    const status = stats.failed
      ? `⚠ ${stats.failed} 行需检查`
      : stats.converted
        ? `✓ ${stats.converted} 行`
        : '—';
    console.log(`${status.padEnd(22)} ${file}${stats.headers ? `（版本头 ${stats.headers}）` : ''}`);
    continue;
  }

  const result = migrateForward(file, filePath, lines);
  totals.converted += result.converted;
  totals.failed += result.failed;
  totals.aliased += result.aliased;
  problems.push(...result.issues);
  const status = result.failed
    ? `⚠ ${result.failed} 行需检查`
    : `✓ ${result.converted} 行`;
  console.log(`${status.padEnd(22)} ${file}${result.aliased ? `（别名 ${result.aliased}）` : ''}`);
}

const summary = revert
  ? `合计：回退 ${totals.converted} 行，版本头 ${totals.headers} 个，待检查 ${totals.failed} 行`
  : `合计：转换 ${totals.converted} 行，别名 ${totals.aliased} 行，待检查 ${totals.failed} 行`;
console.log(`\n${summary}`);
for (const p of problems) {
  console.log(`  ✗ ${p.file}:${p.line} ${p.message}`);
}
if (!write) {
  console.log('\n（dry-run，未写回；加 --write 执行）');
}
