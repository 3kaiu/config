#!/usr/bin/env node
/**
 * workflow-bash-check — 校验 .github/workflows/*.yml 中每个 `run:` 块的 bash 语法。
 *
 * 动机: workflow 里的 bash 只有在 CI 真正执行到那一步时才会暴露语法错误。
 * 定时任务 (mirror-scripts 每日 / upstream-health 每日) 可能数天后才触发, 期间
 * "门禁"其实是坏的而无人知晓。本脚本把该检查提前到本地与 PR 阶段。
 *
 * 边界 (勿高估): 只做 `bash -n` — 即**纯语法**校验。它能抓漏引号、漏 fi/done、
 * 错误的分支语法; **抓不到**嵌在 run 块里的 node/python 代码错误 (例如 node -e 里
 * 的顶层 return), 也抓不到逻辑错误。后者需要行为级测试。
 *
 * 零依赖: 只用 node 内置模块 + 系统 bash, 不引入新 devDependency。
 */
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wfDir = path.join(root, '.github', 'workflows');

/**
 * 逐行扫描 YAML, 提取每个 `run:` 键的块内容。
 * 缩进判定: 块内容必须比 `run:` 所在行缩进更深; 首个缩进 <= 基准的行即为块结束。
 * 去掉最小公共缩进后交给 bash -n。
 */
function extractRunBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const baseIndent = m[1].length;
    const inline = m[2].trim();
    const isBlockScalar = inline === '' || inline.startsWith('|') || inline.startsWith('>');
    if (!isBlockScalar) {
      blocks.push({ startLine: i + 1, body: inline });
      continue;
    }
    const body = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === '') { body.push(''); continue; }
      const ind = l.length - l.replace(/^\s+/, '').length;
      if (ind <= baseIndent) break;
      body.push(l);
    }
    while (body.length && body[0].trim() === '') body.shift();
    while (body.length && body[body.length - 1].trim() === '') body.pop();
    const nonEmpty = body.filter((l) => l.trim() !== '');
    const minIndent = nonEmpty.length
      ? Math.min(...nonEmpty.map((l) => l.length - l.replace(/^\s+/, '').length))
      : 0;
    blocks.push({ startLine: i + 1, body: body.map((l) => l.slice(minIndent)).join('\n') });
    i = j - 1;
  }
  return blocks;
}

const tmp = mkdtempSync(path.join(tmpdir(), 'wf-bash-check-'));
let checked = 0;
let failed = 0;
let skipped = 0;

try {
  const files = readdirSync(wfDir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort();

  if (files.length === 0) {
    console.log('❌ 未找到任何 workflow 文件 — 检查前提不成立');
    process.exit(1);
  }

  for (const f of files) {
    const text = readFileSync(path.join(wfDir, f), 'utf8');
    const blocks = extractRunBlocks(text);
    for (let k = 0; k < blocks.length; k++) {
      const { startLine, body } = blocks[k];
      // 防御: 提取结果异常 (空块 / 明显不是 shell) 时跳过并告警, 不产生假红。
      if (body.trim() === '') {
        console.log(`⚠️  ${f}:${startLine} (block ${k}) 提取为空, 跳过`);
        skipped++;
        continue;
      }
      const tmpFile = path.join(tmp, `${f}.${k}.sh`);
      writeFileSync(tmpFile, body + '\n');
      checked++;
      try {
        execFileSync('bash', ['-n', tmpFile], { stdio: 'pipe' });
      } catch (e) {
        failed++;
        console.log(`❌ ${f}:${startLine} (block ${k}) bash -n 失败:`);
        console.log(String(e.stderr || e.message).trim().split('\n').map((l) => '   ' + l).join('\n'));
      }
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nworkflow run 块: ${checked} 个已校验, ${failed} 个语法错误${skipped ? `, ${skipped} 个跳过` : ''}`);
console.log('注: 仅校验 bash 语法; run 块内嵌的 node/python 代码错误与逻辑错误不在本检查范围。');
process.exit(failed ? 1 : 0);
