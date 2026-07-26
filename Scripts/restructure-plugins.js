#!/usr/bin/env node
/**
 * Plugin Directory Restructuring Script
 * @description 自动重组插件目录结构
 * @author 3kaiu
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════
// 🎯 配置定义
// ════════════════════════════════════════

const DRY_RUN = process.argv.includes('--dry-run');
const BACKUP_ENABLED = !process.argv.includes('--no-backup');

const CATEGORY_MAPPINGS = {
  // Social/Messaging Apps
  social: [/wechat/i, /alipay.*mini/i, /dingtalk/i, /qq.*music/i, /im/i, /messaging/i, /qqmusic/i],
  
  // Entertainment/Video
  entertainment_video: [/tencent/i, /iqiyi/i, /bilibili/i, /youku/i, /video/i, /streaming/i, /bilicomics/i],
  
  // Entertainment/Music
  entertainment_music: [/netease/i, /spotify/i, /music/i, /audio/i, /qishui/i],
  
  // Shopping/E-commerce
  shopping: [/taobao/i, /tmall/i, /jd/i, /pinduoduo/i, /xiaohongshu/i, /shopping/i, /ecommerce/i, /goofish/i],
  
  // Finance/Banking
  finance: [/alipay/i, /bank/i, /finance/i, /payment/i, /sunshufu/i, /cloud.*storage/i],
  
  // Tools
  tools: [/baidu.*pan/i, /bdpan/i, /cloud.*storage/i, /productivity/i, /tool/i, /startup.*adblock/i],
  
  // Navigation/Travel
  navigation: [/amap/i, /didi/i, /travel/i, /navigation/i, /map/i],
  
  // Reading/News
  reading: [/zhihu/i, /tieba/i, /weibo/i, /news/i, /reading/i, /article/i, /reddit/i, /qidian/i],
  
  // Overseas
  overseas_social: [/instagram/i, /facebook/i, /twitter/i, /x\.com/i, /linkedin/i, /overseas/i, /apple.*services/i],
  
  // Utilities
  utilities: [/safari/i, /browser/i, /web/i, /utility/i, /monitor/i, /quicksearch/i],
  
  // Core/System
  core: [/ai/i, /life/i, /notify/i, /sub-store/i, /core/i],
  
  // Experimental
  experimental: [/experimental/i, /beta/i]
};

// ════════════════════════════════════════
// 🔧 核心函数
// ═══════════════════════════════════════===

/**
 * 获取文件所属分类
 */
function getPluginCategory(filename) {
  const basename = filename.replace('.plugin', '');
  
  for (const [category, patterns] of Object.entries(CATEGORY_MAPPINGS)) {
    for (const pattern of patterns) {
      if (pattern.test(basename)) {
        return category;
      }
    }
  }
  
  return null; // 未匹配到分类
}

/**
 * 创建目标目录
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`📁 Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 备份文件
 */
function backupFile(filePath) {
  const backupPath = filePath + '.backup';
  fs.copyFileSync(filePath, backupPath);
  console.log(`💾 Backup created: ${backupPath}`);
  return backupPath;
}

/**
 * 移动文件
 */
function movePlugin(srcPath, destDir) {
  const filename = path.basename(srcPath);
  const destPath = path.join(destDir, filename);
  
  if (DRY_RUN) {
    console.log(`  ✏️ Would move: ${filename} → ${destDir}/`);
    return true;
  }
  
  try {
    fs.renameSync(srcPath, destPath);
    console.log(`  ✅ Moved: ${filename} → ${destDir}/`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error moving ${filename}:`, error.message);
    return false;
  }
}

/**
 * 生成新的目录结构
 */
function buildNewStructure() {
  console.log('🏗️ Building new directory structure...');
  
  const baseDirs = [
    'Plugin/core',
    'Plugin/apps/social',
    'Plugin/apps/entertainment/video',
    'Plugin/apps/entertainment/music',
    'Plugin/apps/shopping',
    'Plugin/apps/finance',
    'Plugin/apps/tools',
    'Plugin/apps/navigation',
    'Plugin/apps/reading',
    'Plugin/overseas/social',
    'Plugin/overseas/services',
    'Plugin/utilities/browser',
    'Plugin/utilities/developer',
    'Plugin/utilities/monitoring',
    'Plugin/experimental',
    'Plugin/archive/legacy'
  ];
  
  baseDirs.forEach(dir => {
    ensureDirectory(dir);
  });
  
  console.log('✅ Directory structure ready\n');
}

/**
 * 处理插件迁移
 */
function migratePlugins(pluginFiles) {
  let successCount = 0;
  let skipCount = 0;
  
  console.log('🔍 Analyzing and migrating plugins...\n');
  
  for (const file of pluginFiles) {
    const filename = path.basename(file);
    const category = getPluginCategory(filename);
    
    if (!category) {
      console.log(`⚠️  Skipped (uncategorized): ${filename}`);
      skipCount++;
      continue;
    }
    
    // 确定目标目录
    let destDir;
    switch (category) {
      case 'social':
        destDir = 'Plugin/apps/social';
        break;
      case 'entertainment_video':
        destDir = 'Plugin/apps/entertainment/video';
        break;
      case 'entertainment_music':
        destDir = 'Plugin/apps/entertainment/music';
        break;
      case 'shopping':
        destDir = 'Plugin/apps/shopping';
        break;
      case 'finance':
        destDir = 'Plugin/apps/finance';
        break;
      case 'tools':
        destDir = 'Plugin/apps/tools';
        break;
      case 'navigation':
        destDir = 'Plugin/apps/navigation';
        break;
      case 'reading':
        destDir = 'Plugin/apps/reading';
        break;
      case 'overseas_social':
        destDir = 'Plugin/overseas/social';
        break;
      case 'utilities':
        destDir = 'Plugin/utilities/browser';
        break;
      case 'experimental':
        destDir = 'Plugin/experimental';
        break;
      default:
        destDir = 'Plugin/core';
    }
    
    if (BACKUP_ENABLED && !DRY_RUN) {
      backupFile(file);
    }
    
    if (movePlugin(file, destDir)) {
      successCount++;
    }
    
    console.log(); // Empty line for readability
  }
  
  console.log('\n==================================');
  console.log(`✨ Migration Summary:`);
  console.log(`   Total files processed: ${pluginFiles.length}`);
  console.log(`   Successfully moved: ${successCount}`);
  console.log(`   Skipped (uncategorized): ${skipCount}`);
  console.log(`   Dry run mode: ${DRY_RUN ? 'YES' : 'NO'}`);
  console.log('==================================\n');
}

/**
 * 更新配置文件中的引用路径
 */
async function updateConfigReferences() {
  if (DRY_RUN) {
    console.log('⚙️ Skipping config updates in dry-run mode');
    return;
  }
  
  console.log('⚙️ Updating configuration references...');
  
  const configFiles = ['Profile/Loon.lcf', 'Profile/QX.conf'];
  
  for (const configFile of configFiles) {
    if (!fs.existsSync(configFile)) {
      console.log(`⚠️  Config file not found: ${configFile}`);
      continue;
    }
    
    let content = fs.readFileSync(configFile, 'utf8');
    let updated = false;
    
    // 构建旧路径到新路径的映射
    const pathMappings = [
      [/\/Plugin\/netease\.pro\.plugin/g, '/Plugin/apps/entertainment/music/netease-pro.plugin'],
      [/\/Plugin\/jd\.pro\.plugin/g, '/Plugin/apps/shopping/jd-pro.plugin'],
      [/\/Plugin\/bilibili\.pro\.plugin/g, '/Plugin/apps/entertainment/video/bili-bili-pro.plugin'],
      // Add more mappings as needed
    ];
    
    for (const [oldPattern, newPath] of pathMappings) {
      if (content.match(oldPattern)) {
        content = content.replace(oldPattern, newPath);
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(configFile, content);
      console.log(`  ✅ Updated: ${configFile}`);
    } else {
      console.log(`  ⚠️  No changes needed: ${configFile}`);
    }
  }
  
  console.log('✅ Configuration references updated\n');
}

/**
 * 主函数
 */
async function main() {
  console.log('🔧 Plugin Directory Restructuring Tool v1.0');
  console.log('===========================================\n');
  
  // 检查参数
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node scripts/restructure-plugins.js [options]');
    console.log('\nOptions:');
    console.log('  --dry-run          Preview changes without making modifications');
    console.log('  --no-backup        Skip creating backups');
    console.log('  --help, -h         Show this help message');
    process.exit(0);
  }
  
  // 收集所有 .plugin 文件
  const pluginFiles = [];
  const pluginDir = 'Plugin';
  
  if (fs.existsSync(pluginDir)) {
    const files = fs.readdirSync(pluginDir);
    for (const file of files) {
      if (file.endsWith('.plugin') && !file.startsWith('.')) {
        pluginFiles.push(path.join(pluginDir, file));
      }
    }
  }
  
  if (pluginFiles.length === 0) {
    console.log('❌ No plugin files found in Plugin/ directory');
    process.exit(1);
  }
  
  console.log(`📦 Found ${pluginFiles.length} plugin files to process\n`);
  
  // Step 1: Build new directory structure
  buildNewStructure();
  
  // Step 2: Migrate plugins
  migratePlugins(pluginFiles);
  
  // Step 3: Update config references
  updateConfigReferences();
  
  console.log('🎉 Restructuring complete!');
  console.log('Please review the changes and test thoroughly.\n');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
