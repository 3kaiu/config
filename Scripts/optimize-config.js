#!/usr/bin/env node
/**
 * Configuration Optimization Script
 * @description 优化配置文件体积和内容
 * @author 3kaiu
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════
// 🎯 优化目标
// ════════════════════════════════════════

const OPTIMIZATION_TARGETS = {
  // 配置文件压缩目标
  files: {
    'Profile/Loon.lcf': { maxSizeKB: 45, currentSizeKB: 55 },
    'Profile/QX.conf': { maxSizeKB: 42, currentSizeKB: 50 }
  },
  
  // 需要移除的冗余注释模式
  redundantCommentPatterns: [
    /^#\s*═+\s+.*\s+═+$/,  // 装饰性分隔线
    /^#─*\s+[A-Z]+\s+[─]*$/, // 标题式注释
    /^#\s*$/  // 空行注释
  ],
  
  // 可以合并的重复规则
  mergeableRulePatterns: [
    { pattern: /(DOMAIN-SUFFIX,\s*[^,]+,\s*(DIRECT|REJECT))\n\s*\1/g, action: 'dedupe' }
  ]
};

// ════════════════════════════════════════
// 🔧 优化函数
// ═══════════════════════════════════════===

/**
 * 简化注释文本
 */
function simplifyComments(content) {
  console.log('📝 Simplifying comments...');
  
  const lines = content.split('\n');
  let changed = false;
  
  const optimizedLines = lines.map(line => {
    // 移除装饰性分隔线
    if (/^#\s*═+\s+.*\s+═+$/.test(line)) {
      changed = true;
      return ''; // 删除空行
    }
    
    // 简化长注释
    if (/^#\s{2,}[A-Z]{2,}\s+/.test(line)) {
      changed = true;
      return line.replace(/^#\s{2,}([A-Z]{2,})\s+(.*)$/, '# $1: $2');
    }
    
    // 移除多余的空行注释
    if (/^#\s*$/.test(line) && lines[lines.indexOf(line) - 1]?.match(/^#\s/) !== null) {
      changed = true;
      return '';
    }
    
    return line || null; // Return null for empty lines to filter later
  });
  
  return {
    content: optimizedLines.filter(l => l !== null && l !== '').join('\n'),
    changed
  };
}

/**
 * 去除重复规则
 */
function removeDuplicateRules(content) {
  console.log('🔄 Removing duplicate rules...');
  
  const lines = content.split('\n');
  const seenRules = new Set();
  const uniqueRules = [];
  let removedCount = 0;
  
  for (const line of lines) {
    // 提取规则关键字段 (忽略 tag 部分)
    const baseRule = line.replace(/\s*,\s*tag=\S+/g, '').trim();
    
    if (!seenRules.has(baseRule)) {
      seenRules.add(baseRule);
      uniqueRules.push(line);
    } else {
      removedCount++;
    }
  }
  
  return {
    content: uniqueRules.join('\n'),
    removedCount
  };
}

/**
 * 统一格式化
 */
function unifyFormatting(content) {
  console.log('✨ Unifying formatting...');
  
  return content
    // 统一缩进为 2 个空格
    .replace(/^\t+/g, match => ' '.repeat(match.length * 2))
    // 移除行首尾空白
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    // 确保每段之间有单个空行
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * 压缩 JSON-like 字符串
 */
function compactJSONStrings(content) {
  console.log('🗜️ Compacting JSON strings...');
  
  // 匹配 script-path 中的 long paths and replace with aliases
  const pathAliases = {
    'https://ws.wenn.in/main/Mirror/amdc.js': '@amd',
    'https://ws.wenn.in/main/Mirror/netease.adblock.js': '@netease',
    'https://ws.wenn.in/main/Mirror/applet.js': '@applet'
  };
  
  let changed = false;
  let result = content;
  
  Object.entries(pathAliases).forEach(([longPath, alias]) => {
    if (content.includes(longPath)) {
      changed = true;
      result = result.split(longPath).join(alias);
    }
  });
  
  return { content: result, changed };
}

/**
 * 主优化流程
 */
async function optimizeConfiguration(filePath) {
  console.log(`\n🔍 Optimizing ${filePath}...`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }
  
  // 读取原始文件
  const originalContent = fs.readFileSync(filePath, 'utf8');
  const originalSize = Buffer.byteLength(originalContent, 'utf8');
  
  console.log(`  Original size: ${(originalSize / 1024).toFixed(2)} KB`);
  
  // Step 1: Simplify comments
  let processed = simplifyComments(originalContent);
  
  // Step 2: Remove duplicates
  processed = removeDuplicateRules(processed.content).content;
  
  // Step 3: Unify formatting
  processed = unifyFormatting(processed.content);
  
  // Step 4: Compact JSON strings
  processed = compactJSONStrings(processed).content;
  
  const finalSize = Buffer.byteLength(processed, 'utf8');
  const reductionPercent = ((originalSize - finalSize) / originalSize * 100).toFixed(2);
  
  console.log(`  Final size: ${(finalSize / 1024).toFixed(2)} KB`);
  console.log(`  Reduction: ${reductionPercent}% ⬇️`);
  
  // Write optimized file
  const backupPath = filePath + '.bak';
  fs.copyFileSync(filePath, backupPath);
  fs.writeFileSync(filePath, processed);
  
  console.log(`  ✅ Optimized! Backup saved at ${backupPath}`);
  
  return reductionPercent > 10; // Return true if optimization achieved
}

// ════════════════════════════════════════
// 🚀 主入口
// ═══════════════════════════════════════===

async function main() {
  console.log('🚀 Configuration Optimizer v1.0');
  console.log('================================\n');
  
  const dryRun = process.argv.includes('--dry-run');
  const optimizeFiles = [
    'Profile/Loon.lcf',
    'Profile/QX.conf'
  ];
  
  for (const file of optimizeFiles) {
    if (dryRun) {
      console.log(`🔍 Dry run for ${file}:`);
      const content = fs.readFileSync(file, 'utf8');
      const reduced = await optimizeConfiguration(file);
      console.log(`  Would be optimized: ${reduced}\n`);
    } else {
      const success = await optimizeConfiguration(file);
      console.log(success ? '✅ Success!' : '⚠️ Limited optimization\n');
    }
  }
  
  console.log('\n================================');
  console.log('✨ Optimization complete!');
  console.log('Review changes and commit if satisfied.');
}

main().catch(console.error);
