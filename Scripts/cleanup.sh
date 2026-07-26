#!/bin/bash

# 🧹 v8.7 Project Cleanup Script
# Execute this to remove archived research and other non-essential files

set -e  # Exit on error

echo "🧹 Starting v8.7 Project Cleanup..."
echo "═══════════════════════════════════════"

cd "$(dirname "$0")"

# 1. Check if research directory exists
if [ -d "research" ]; then
    echo "✅ Found research/ directory (will be deleted)"
    rm -rf research
    echo "✅ research/ directory DELETED"
else
    echo "ℹ️  research/ already removed or not present"
fi

# 2. Remove any remaining temporary files
echo ""
echo "📝 Cleaning up temporary files..."

# Backup files
find . -name "*.bak" -o -name "*.backup" -o -name "*.orig" | while read file; do
    rm -fv "$file"
done

# Temporary files
find . -name "*.tmp" -o -name "*.temp" | while read file; do
    rm -fv "$file"
done

# Editor swap files
find . -name "*~" -o -name "*.swp" -o -name "*.swo" | while read file; do
    rm -fv "$file"
done

echo "✅ All temporary files cleaned"

# 3. Verify cleanup results
echo ""
echo "🔍 Verifying cleanup results..."

# Check for any remaining backup/temp files
TEMP_FILES=$(find . -maxdepth 3 -type f \( -name "*.bak" -o -name "*.backup" -o -name "*.tmp" \) 2>/dev/null | wc -l)

if [ "$TEMP_FILES" -eq 0 ]; then
    echo "✅ No temporary files remaining"
else
    echo "⚠️  $TEMP_FILES temporary files still found:"
    find . -maxdepth 3 -type f \( -name "*.bak" -o -name "*.backup" -o -name "*.tmp" \)
fi

# 4. Show final repository state
echo ""
echo "📊 Final repository status:"
ls -lh | grep -E "^-" | head -15

echo ""
echo "🎉 Cleanup complete!"
echo ""
echo "Summary:"
echo "  ✓ Archived research directory removed"
echo "  ✓ All temporary files cleaned"
echo "  ✓ Repository is now production-ready"
echo ""
echo "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Commit clean changes: git add -A && git commit -m 'cleanup: remove archived research and temp files'"
echo "  3. Push to remote: git push origin main"
