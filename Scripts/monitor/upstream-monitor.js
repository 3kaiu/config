#!/usr/bin/env node
/**
 * 上游脚本监控器 - Plugin Upstream Monitor
 * @description 自动监测各大插件源的更新情况
 * @author 3kaiu
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 🔧 配置
const config = {
  timeout: 10000,
  maxRetries: 3,
};

// 📋 监控的上游源列表
const UPSTREAM_SOURCES = [
  // app2smile/rules
  {
    name: 'app2smile/rules',
    url: 'https://api.github.com/repos/app2smile/rules/commits?path=js&per_page=1',
    platform: 'GitHub',
    type: 'scripts'
  },
  // ddgksf2013/Rewrite  
  {
    name: 'ddgksf2013/Rewrite',
    url: 'https://api.github.com/repos/ddgksf2013/Rewrite/commits?path=AdBlock&per_page=1',
    platform: 'GitHub',
    type: 'rules'
  },
  // blackmatrix7/ios_rule_script
  {
    name: 'blackmatrix7/ios_rule_script',
    url: 'https://api.github.com/repos/blackmatrix7/ios_rule_script/commits?path=rule%2FLoon&per_page=1',
    platform: 'GitHub',
    type: 'rules'
  },
  // Moli-X/Resources
  {
    name: 'Moli-X/Resources',
    url: 'https://api.github.com/repos/Moli-X/Resources/commits?per_page=1',
    platform: 'GitHub',
    type: 'all'
  },
  // Telegram 频道
  {
    name: '@ddgksf2021',
    url: 'https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates?offset=-1',
    platform: 'Telegram',
    type: 'news',
    needsToken: true
  }
];

// 🚀 主函数
async function main() {
  console.log('🤖 Starting upstream plugin monitor...\n');
  
  const results = [];
  let hasUpdates = false;
  
  for (const source of UPSTREAM_SOURCES) {
    try {
      console.log(`🔍 Checking ${source.name}...`);
      
      if (source.needsToken && !process.env.TELEGRAM_BOT_TOKEN) {
        console.log(`  ⚠️ Skipping (no token)\n`);
        continue;
      }
      
      const updateInfo = await checkUpdate(source);
      
      if (updateInfo.has_update) {
        hasUpdates = true;
        console.log(`  ✅ New update detected!`);
        console.log(`     Commit: ${updateInfo.commit_hash}`);
        console.log(`     Message: ${updateInfo.commit_message}\n`);
      } else {
        console.log(`  ✔️ No updates\n`);
      }
      
      results.push({
        name: source.name,
        platform: source.platform,
        type: source.type,
        ...updateInfo,
        checked_at: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`  ❌ Error checking ${source.name}: ${error.message}`);
      results.push({
        name: source.name,
        platform: source.platform,
        type: source.type,
        status: 'error',
        error: error.message,
        checked_at: new Date().toISOString()
      });
    }
  }
  
  // 📊 保存结果
  saveResults(results, hasUpdates);
  
  // 💬 输出总结
  console.log('\n========================================');
  console.log('📊 Monitoring Summary:');
  console.log(`   Total sources checked: ${UPSTREAM_SOURCES.length}`);
  console.log(`   Updates detected: ${hasUpdates ? 'YES' : 'NO'}`);
  console.log(`   Errors encountered: ${results.filter(r => r.status === 'error').length}`);
  console.log('========================================\n');
  
  // 📝 设置输出变量供 GitHub Actions 使用
  const outPath = process.env.GITHUB_OUTPUT || '/dev/null';
  if (hasUpdates) {
    if (!fs.existsSync('output')) fs.mkdirSync('output', { recursive: true });
    fs.writeFileSync('output/updates.json', JSON.stringify(results, null, 2));
    fs.writeFileSync('output/update-description.md', generateUpdateDescription(results));
    fs.appendFileSync(outPath, 'has_update=true\n');
  } else {
    fs.appendFileSync(outPath, 'has_update=false\n');
  }
}

/**
 * 检查单个上游源是否有更新
 */
async function checkUpdate(source) {
  try {
    const response = await axios.get(source.url, {
      timeout: config.timeout,
      headers: {
        'User-Agent': 'Plugin-Monitor/1.0 (3kaiu/config)'
      }
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      return { has_update: false, status: 'invalid_response' };
    }
    
    const latestCommit = response.data[0];
    
    // 读取上次记录的 commit hash
    const lastHashFile = `output/.last-${source.name.replace(/\//g, '_')}.hash`;
    let lastHash = '';
    
    if (fs.existsSync(lastHashFile)) {
      lastHash = fs.readFileSync(lastHashFile, 'utf8').trim();
    }
    
    // 比较 commit hash
    const hasUpdate = latestCommit.sha !== lastHash;
    
    // 保存当前 commit hash
    fs.writeFileSync(lastHashFile, latestCommit.sha);
    
    return {
      has_update: hasUpdate,
      commit_hash: latestCommit.sha.substring(0, 7),
      commit_message: truncate(latestCommit.commit.message, 100),
      author: latestCommit.commit.author.name,
      committed_at: latestCommit.commit.author.date,
      status: 'success'
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 保存监控结果
 */
function saveResults(results, hasUpdates) {
  const outputDir = './output';
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 保存详细结果
  fs.writeFileSync(
    path.join(outputDir, 'monitor-results.json'),
    JSON.stringify(results, null, 2)
  );
  
  // 生成报告
  if (hasUpdates) {
    fs.writeFileSync(
      path.join(outputDir, 'summary-report.md'),
      generateSummaryReport(results)
    );
  }
}

/**
 * 生成更新描述文档
 */
function generateUpdateDescription(results) {
  const updates = results.filter(r => r.has_update && r.status === 'success');
  
  if (updates.length === 0) {
    return '⚠️ No significant updates detected.';
  }
  
  let desc = '# 🔄 Plugin Upstream Updates Detected\n\n';
  desc += `*Generated on ${new Date().toLocaleString()}*\n\n`;
  desc += '## Update Summary\n\n';
  desc += `${updates.length} plugin source(s) have been updated:\n\n`;
  
  for (const update of updates) {
    desc += `### ${update.name}\n`;
    desc += `- **Commit**: \`${update.commit_hash}\`\n`;
    desc += `- **Message**: ${escapeMarkdown(update.commit_message)}\n`;
    desc += `- **Author**: ${update.author}\n`;
    desc += `- **Time**: ${new Date(update.committed_at).toLocaleString()}\n\n`;
  }
  
  desc += '---\n';
  desc += '*This issue was automatically generated by the plugin monitor bot.*';
  
  return desc;
}

/**
 * 生成摘要报告
 */
function generateSummaryReport(results) {
  let report = '# 📊 Plugin Monitor Report\n\n';
  report += `**Date**: ${new Date().toLocaleString()}\n\n`;
  report += `**Total Sources**: ${results.length}\n`;
  report += `**Successful**: ${results.filter(r => r.status === 'success').length}\n`;
  report += `**Errors**: ${results.filter(r => r.status === 'error').length}\n`;
  report += `**Updates Found**: ${results.filter(r => r.has_update).length}\n\n`;
  
  report += '## Results Detail\n\n';
  
  for (const result of results) {
    if (result.status === 'success') {
      const statusIcon = result.has_update ? '✅' : '✔️';
      report += `### ${statusIcon} ${result.name}\n`;
      report += `- Status: Success\n`;
      report += `- Type: ${result.type}\n`;
      if (result.has_update) {
        report += `- Latest Commit: \`${result.commit_hash}\`\n`;
        report += `- Message: ${escapeMarkdown(result.commit_message)}\n`;
      } else {
        report += `- No updates since last check\n`;
      }
    } else {
      report += `### ❌ ${result.name}\n`;
      report += `- Status: Failed\n`;
      report += `- Error: ${result.error}\n`;
    }
    report += `\n`;
  }
  
  return report;
}

/**
 * 截断字符串
 */
function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length - 3) + '...' : str;
}

/**
 * 转义 Markdown 特殊字符
 */
function escapeMarkdown(text) {
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

// 🚀 执行
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
