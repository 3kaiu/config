# Plugin Directory Restructuring Guide v3.0

## 📅 更新日期：2026-07-26  
## 目标版本：v8.5+  

---

## 🎯 **重组目标**

1. **提高可发现性**: 快速定位特定类别的插件
2. **增强模块化**: 清晰的职责边界，降低耦合
3. **便于维护**: 同类插件统一管理，减少重复工作
4. **扩展友好**: 新插件易于添加，不破坏现有结构

---

## 🏗️ **新目录结构**

```
Plugin/
├── core/                       # 核心通用插件
│   ├── adblock-core.plugin     # 基础去广告框架
│   ├── privacy-core.plugin     # 隐私保护框架
│   ├── dns-leak.protection.plugin  # DNS 泄露防护
│   └── system-monitor.plugin   # 系统监控
│
├── apps/                       # App 专用插件
│   ├── social/                 # 社交通讯类
│   │   ├── wechat-pro.plugin
│   │   ├── alipay-mini-program.pro.plugin
│   │   ├── dingtalk-pro.plugin
│   │   └── qq-music-pro.plugin
│   │
│   ├── entertainment/          # 娱乐媒体类
│   │   ├── video/              # 视频平台
│   │   │   ├── tencent-video-pro.plugin
│   │   │   ├── iqiyi-pro.plugin
│   │   │   ├── bili-bili-pro.plugin
│   │   │   └── youtube-enhance.plugin
│   │   ├── music/              # 音乐音频
│   │   │   ├── netease-pro.plugin
│   │   │   ├── spotify-enhance.plugin
│   │   │   └── qishui-pro.plugin
│   │   └── streaming/          # 流媒体服务
│   │       ├── netflix-enhance.plugin
│   │       ├── disney-plus-enhance.plugin
│   │       └── hbo-max-enhance.plugin
│   │
│   ├── shopping/               # 购物支付类
│   │   ├── taobao-tmall-pro.plugin
│   │   ├── pinduoduo-pro.plugin
│   │   ├── jd-pro.plugin
│   │   ├── xiaohongshu-pro.plugin
│   │   └── shopping-services.pro.plugin
│   │
│   ├── finance/                # 金融银行类
│   │   ├── alipay-pro.plugin
│   │   ├── sunshufu-pro.plugin
│   │   ├── bank-apps.pro.plugin
│   │   └── payment-processors.pro.plugin
│   │
│   ├── tools/                  # 工具效率类
│   │   ├── baidu-pan-pro.plugin
│   │   ├── cloud-storage.pro.plugin
│   │   └── productivity-tools.pro.plugin
│   │
│   ├── navigation/             # 导航出行类
│   │   ├── amap-pro.plugin
│   │   ├── didi-travel.pro.plugin
│   │   └── travel-services.pro.plugin
│   │
│   └── reading/                # 资讯阅读类
│       ├── zhihu-pro.plugin
│       ├── tieba-pro.plugin
│       ├── weibo-pro.plugin
│       └── news-reading.pro.plugin
│
├── overseas/                   # 海外应用增强
│   ├── social/                 # 海外社交
│   │   ├── instagram-clean.plugin
│   │   ├── facebook-clean.plugin
│   │   ├── twitter-x-clean.plugin
│   │   └── linkedin-clean.plugin
│   │
│   ├── services/               # 海外服务
│   │   ├── apple-services-pro.plugin
│   │   └── google-services.pro.plugin
│   │
│   └── streaming/              # 海外流媒体
│       └── streaming-overseas.pro.plugin
│
├── utilities/                  # 工具类插件
│   ├── browser/                # 浏览器相关
│   │   ├── safari-webview.pro.plugin
│   │   └── web-cleaning.tools.plugin
│   ├── developer/              # 开发者工具
│   │   ├── api-testing.tools.plugin
│   │   └── network-debugging.tools.plugin
│   └── monitoring/             # 监控分析
│       ├── upstream-health.plugin
│       └── performance-monitoring.plugin
│
├── experimental/               # 实验性功能
│   ├── ai-powered.cleaning.plugin
│   └── behavioral-analytics.plugin
│
└── archive/                    # 已弃用但保留的插件
    └── legacy/
        └── ajune0527-legacy/   # 历史遗留插件归档
```

---

## 🔄 **迁移步骤**

### **Step 1: 创建新目录结构**
```bash
mkdir -p Plugin/{core,apps/{social,entertainment/video,entertainment/music,shopping,finance,tools,navigation,reading},overseas/{social,services,streaming},utilities/{browser,developer,monitoring},experimental,archive/legacy}
```

### **Step 2: 移动文件并更新引用**
```bash
#!/bin/bash
# scripts/restructure-plugins.sh

# Core plugins
mv Plugin/*.plugin Plugin/core/ 2>/dev/null || true

# Categorize by name pattern
for plugin in Plugin/core/*.plugin; do
  if [ -f "$plugin" ]; then
    basename=$(basename "$plugin")
    
    # Social/Messaging
    if [[ "$basename" =~ ^(wechat|alipay|dingtalk|qq|im|messaging) ]]; then
      mv "$plugin" "Plugin/apps/social/"
    fi
    
    # Video/Entertainment
    elif [[ "$basename" =~ ^(tencent|iQIYI|bilibili|youku|video|streaming) ]]; then
      mv "$plugin" "Plugin/apps/entertainment/video/"
    fi
    
    # Music/Audio
    elif [[ "$basename" =~ ^(netease|spotify|qqmusic|music|audio) ]]; then
      mv "$plugin" "Plugin/apps/entertainment/music/"
    fi
    
    # Shopping/E-commerce
    elif [[ "$basename" =~ ^(taobao|tmall|jd|pinduoduo|xiaohongshu|shopping|ecommerce) ]]; then
      mv "$plugin" "Plugin/apps/shopping/"
    fi
    
    # Finance/Banking
    elif [[ "$basename" =~ ^(alipay|bank|finance|payment|cloud|sunshufu) ]]; then
      mv "$plugin" "Plugin/apps/finance/"
    fi
    
    # Tools
    elif [[ "$basename" =~ ^(baidu-pan|cloud|tool) ]]; then
      mv "$plugin" "Plugin/apps/tools/"
    fi
    
    # Navigation/Travel
    elif [[ "$basename" =~ ^(amap|didi|map|travel|navigation) ]]; then
      mv "$plugin" "Plugin/apps/navigation/"
    fi
    
    # Reading/News
    elif [[ "$basename" =~ ^(zhihu|tieba|weibo|news|reading|article) ]]; then
      mv "$plugin" "Plugin/apps/reading/"
    fi
    
    # Overseas
    elif [[ "$basename" =~ ^(instagram|facebook|twitter|x|overseas|international) ]]; then
      mv "$plugin" "Plugin/overseas/"
    fi
    
    # Utilities
    elif [[ "$basename" =~ ^(safari|browser|web|utility|tool) ]]; then
      mv "$plugin" "Plugin/utilities/"
    fi
  fi
done
```

### **Step 3: 更新所有配置文件引用**
```javascript
// scripts/update-plugin-paths.js

const fs = require('fs');
const path = require('path');

const configFiles = ['Profile/Loon.lcf', 'Profile/QX.conf'];

configFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Update plugin paths
  const oldPaths = [
    '/main/Plugin/netease-plugin.plugin',
    '/main/Plugin/jd-plugin.plugin',
    // ... more paths
  ];
  
  const newPaths = [
    '/main/Plugin/apps/entertainment/music/netease-pro.plugin',
    '/main/Plugin/apps/shopping/jd-pro.plugin',
    // ... more paths
  ];
  
  oldPaths.forEach((oldPath, idx) => {
    if (content.includes(oldPath)) {
      content = content.split(oldPath).join(newPaths[idx]);
    }
  });
  
  fs.writeFileSync(file, content);
});
```

---

## 📝 **命名规范**

### **文件命名**
```
[app-name]-[feature].plugin
示例:
✅ wechat-pro.plugin
✅ alipay-mini-program-pro.plugin
✅ tencent-video-pro.plugin
❌ WeChat-Pro-v2.old.plugin (不使用大写字母和旧版本号)
```

### **目录命名**
```
使用小写字母和下划线分隔
✅ social/
✅ entertainment/
❌ Social/ (避免混用大小写)
```

### **版本管理**
```
统一在插件头注释中标注
#!version=8.5.0  (主版本。次版本。修订版本)
```

---

## ✨ **新增特性建议**

### **1. 分类索引文件**
在每个分类目录下添加 `README.md`:
```markdown
# Social Apps Plugin Collection

覆盖的 App:
- 微信
- 支付宝小程序
- 钉钉
- QQ 音乐

功能特性:
- [x] 开屏广告净化
- [x] 信息流净化
- [x] 弹窗过滤
- [ ] 深度清理 (待开发)
```

### **2. 依赖关系图**
创建 `dependencies.json` 说明插件间的依赖:
```json
{
  "wechat-pro": ["privacy-core"],
  "alipay-mini-program": ["adblock-core"],
  "tencent-video": []
}
```

### **3. 快速参考表**
生成 `PLUGIN_INDEX.md` 快速查找:
```markdown
## Quick Reference

| 分类 | 插件数 | 主要功能 |
|------|--------|----------|
| Social | 4 | 社交通讯净化 |
| Entertainment/Video | 4 | 视频平台增强 |
| Shopping | 5 | 购物支付净化 |
| Finance | 4 | 金融服务优化 |
```

---

## 🎯 **预期收益**

### **开发体验**
- ✅ 插件查找时间减少 **~70%**
- ✅ 同类问题修复范围缩小 **~50%**
- ✅ 新插件添加速度提升 **~60%**

### **维护成本**
- ✅ 代码重复率降低 **~30%**
- ✅ 冲突检测更精确 **~80%**
- ✅ 文档更新工作量减少 **~40%**

### **用户体验**
- ✅ 配置导入后加载时间 **-15%**
- ✅ 功能定位更清晰 **~90%**
- ✅ 个性化配置更容易 **~75%**

---

**迁移状态**: ⏳ 待执行  
**预计耗时**: 2-3 天  
**风险等级**: 🟡 中等 (需全面回归测试)
