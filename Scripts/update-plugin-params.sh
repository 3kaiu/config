#!/bin/bash
# Plugin Parameter Naming Convention Migration Script
# @description 批量迁移插件参数到统一的命名规范
# @author 3kaiu
# @version 1.0.0

set -e

PLUGIN_DIR="./Plugin"
BACKUP_ENABLED=false
DRY_RUN=true

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔧 Plugin Parameter Migration Tool v1.0"
echo "======================================"
echo ""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --execute)
      DRY_RUN=false
      BACKUP_ENABLED=true
      shift
      ;;
    --plugin|-p)
      PLUGIN_SPEC="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --dry-run          Run without making changes (default)"
      echo "  --execute          Actually perform the migration"
      echo "  --backup           Create backups before migration"
      echo "  --plugin, -p NAME  Migrate specific plugin"
      echo "  --help, -h         Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Define migration mapping
declare -A MIGRATION_MAP=(
  ["ENABLE_WECHAT"]="WECHAT_PRO_ENABLE"
  ["ENABLE_ALIPAY_MINI"]="ALIPAY_MINI_PRO_ENABLE"
  ["ENABLE_ALIPAY"]="ALIPAY_PRO_ENABLE"
  ["MINI_SPLASH_ENABLE"]="ALIPAY_MINI_FEATURE_SPLASH"
  ["MINI_FEED_ENABLE"]="ALIPAY_MINI_FEATURE_FEED"
  ["MINI_POPUP_ENABLE"]="ALIPAY_MINI_FEATURE_POPUP"
  ["MINI_SEARCH_ENABLE"]="ALIPAY_MINI_FEATURE_SEARCH"
  ["MINI_TRAFFIC_ENABLE"]="ALIPAY_MINI_FEATURE_TRAFFIC"
  ["ENABLE_TENCENT_VIDEO"]="TENCENT_VIDEO_PRO_ENABLE"
  ["TVP_SPLASH_ENABLE"]="TENCENT_VIDEO_FEATURE_SPLASH"
  ["TVP_HOME_ENABLE"]="TENCENT_VIDEO_FEATURE_HOME"
  ["ENABLE_IQIYI"]="IQIYI_PRO_ENABLE"
  ["IQIYI_SPLASH_ENABLE"]="IQIYI_FEATURE_SPLASH"
  ["IQIYI_HOME_ENABLE"]="IQIYI_FEATURE_HOME"
  ["BILI_SPLASH_ENABLE"]="BILIBILI_PRO_FEATURE_SPLASH"
  ["BILI_LIVE_ENABLE"]="BILIBILI_PRO_FEATURE_LIVE"
  ["BILI_1080P_ENABLE"]="BILIBILI_PRO_FEATURE_1080P"
  ["ENABLE_ZHIHU"]="ZHIHU_PRO_ENABLE"
  ["ZHIHU_SPLASH_ENABLE"]="ZHIHU_FEATURE_SPLASH"
  ["ZHIHU_FEED_ENABLE"]="ZHIHU_FEATURE_FEED"
  ["ZHIHU_FLOAT_ENABLE"]="ZHIHU_FEATURE_FLOAT"
  ["ENABLE_PDD"]="PDD_PRO_ENABLE"
  ["PDD_SPLASH_ENABLE"]="PDD_FEATURE_SPLASH"
  ["PDD_HOME_ENABLE"]="PDD_FEATURE_HOME"
  ["ENABLE_TAOBAO"]="TAOBAO_PRO_ENABLE"
  ["TAOBAO_SPLASH_ENABLE"]="TAOBAO_FEATURE_SPLASH"
  ["TAOBAO_CART_ENABLE"]="TAOBAO_FEATURE_CART"
  ["ENABLE_JD"]="JD_PRO_ENABLE"
  ["JD_SIGNIN_ENABLE"]="JD_FEATURE_SIGNIN"
  ["JD_MALL_ENABLE"]="JD_FEATURE_MALL"
  ["ENABLE_NETEASE"]="NETEASE_PRO_ENABLE"
  ["NEMUSIC_SIGNIN_ENABLE"]="NETEASE_FEATURE_SIGNIN"
  ["NEMUSIC_ADBLOCK_ENABLE"]="NETEASE_FEATURE_ADBLOCK"
  ["ENABLE_XIAOHONGSHU"]="XIAOHONGSHU_PRO_ENABLE"
  ["XHS_SPLASH_ENABLE"]="XHS_FEATURE_SPLASH"
  ["XHS_FEED_ENABLE"]="XHS_FEATURE_FEED"
  ["XHS_WATERMARK_ENABLE"]="XHS_FEATURE_WATERMARK"
  ["ENABLE_OVERSEAS"]="OVERSEAS_SOCIAL_PRO_ENABLE"
  ["INSTAGRAM_ENABLE"]="OS_INSTAGRAM_ENABLE"
  ["FACEBOOK_ENABLE"]="OS_FACEBOOK_ENABLE"
  ["TWITTER_X_ENABLE"]="OS_TWITTER_X_ENABLE"
  ["LINKEDIN_ENABLE"]="OS_LINKEDIN_ENABLE"
  ["ENABLE_APPLE"]="APPLE_SERVICES_PRO_ENABLE"
  ["APPSTORE_ENABLE"]="APPLE_APP_STORE_ENABLE"
  ["MUSIC_ENABLE"]="APPLE_MUSIC_ENABLE"
  ["MAPS_ENABLE"]="APPLE_MAPS_ENABLE"
  ["NEWS_ENABLE"]="APPLE_NEWS_ENABLE"
  ["SIRI_ENABLE"]="APPLE_SIRI_ENABLE"
  ["ENABLE_STREAMING"]="STREAMING_SERVICES_PRO_ENABLE"
  ["NETFLIX_ENABLE"]="SF_NETFLIX_ENABLE"
  ["DISNEY_ENABLE"]="SF_DISNEY_ENABLE"
  ["HBO_ENABLE"]="SF_HBO_ENABLE"
  ["SPOTIFY_ENABLE"]="SF_SPOTIFY_ENABLE"
  ["YOUTUBE_ENABLE"]="SF_YOUTUBE_ENABLE"
  ["ENABLE_SHOPPING"]="SHOPPING_SERVICES_PRO_ENABLE"
  ["AMAZON_ENABLE"]="SS_AMAZON_ENABLE"
  ["EBAY_ENABLE"]="SS_EBAY_ENABLE"
  ["PAYPAL_ENABLE"]="SS_PAYPAL_ENABLE"
)

# Function to process a single plugin file
process_plugin() {
  local plugin_file="$1"
  local filename=$(basename "$plugin_file")
  
  echo -e "${YELLOW}Processing: $filename${NC}"
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "  🔍 Dry run mode - no changes will be made"
    
    # Show what would be changed
    for old_name in "${!MIGRATION_MAP[@]}"; do
      new_name="${MIGRATION_MAP[$old_name]}"
      
      if grep -q "$old_name" "$plugin_file" 2>/dev/null; then
        echo -e "  📝 Would change: ${old_name} → ${new_name}"
      fi
    done
  else
    echo -e "  ✏️ Applying changes..."
    
    # Create backup
    if [ "$BACKUP_ENABLED" = true ]; then
      cp "$plugin_file" "${plugin_file}.backup"
      echo -e "  💾 Backup created: ${plugin_file}.backup"
    fi
    
    # Apply replacements
    for old_name in "${!MIGRATION_MAP[@]}"; do
      new_name="${MIGRATION_MAP[$old_name]}"
      
      if grep -q "$old_name" "$plugin_file" 2>/dev/null; then
        sed -i.bak "s/${old_name}/${new_name}/g" "$plugin_file"
        rm -f "${plugin_file}.bak"
        echo -e "  ✅ Changed: ${old_name} → ${new_name}"
      fi
    done
  fi
  
  echo ""
}

# Find all .plugin files and process them
if [ -n "$PLUGIN_SPEC" ]; then
  # Process specific plugin
  if [ -f "${PLUGIN_DIR}/${PLUGIN_SPEC}.plugin" ]; then
    process_plugin "${PLUGIN_DIR}/${PLUGIN_SPEC}.plugin"
  elif [ -f "${PLUGIN_DIR}/${PLUGIN_SPEC}" ]; then
    process_plugin "${PLUGIN_DIR}/${PLUGIN_SPEC}"
  else
    echo -e "${RED}Error: Plugin not found: ${PLUGIN_SPEC}${NC}"
    exit 1
  fi
else
  # Process all plugins
  echo -e "${YELLOW}Scanning for plugin files...${NC}"
  echo ""
  
  for plugin_file in "${PLUGIN_DIR}"/*.plugin; do
    if [ -f "$plugin_file" ]; then
      process_plugin "$plugin_file"
    fi
  done
  
  echo -e "${GREEN}✓ Processed $(ls -1 ${PLUGIN_DIR}/*.plugin 2>/dev/null | wc -l) plugins${NC}"
fi

echo "======================================"
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}Dry run completed. Use --execute flag to apply changes.${NC}"
else
  echo -e "${GREEN}Migration completed successfully!${NC}"
  if [ "$BACKUP_ENABLED" = true ]; then
    echo -e "${YELLOW}Backups preserved with .backup extension${NC}"
  fi
fi
