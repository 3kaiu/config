# 🚀 3kaiu/config v8.7+ 架构优化实施方案

## 📅 制定日期：2026-07-26  
## 目标版本：v8.8 (Enhanced)  
## 执行周期：4 周 (P0+P1任务)

---

## 🎯 **优化目标总览**

### **核心目标**
1. ✅ 消除 Surgio 单点故障风险 (P0 - 紧急)
2. ✅ 统一插件参数规范 (P1 - 重要)
3. ✅ 提取公共代码库 (P1 - 重要)
4. ✅ 提升测试覆盖率至 50%+ (P1 - 重要)
5. ✅ 优化配置体积 (-15%) (P2 - 建议)

---

## 📋 **Phase 1: 紧急修复 (第 1-2 周)**

### 🔴 **P0 Priority: Surgio 多云冗余改造**

#### **现状分析**
```javascript
// surgio.conf.js - 当前实现
provider: 'tokyo'  // 单点依赖
```

#### **优化方案**

**Step 1: 创建多云 provider 定义文件**
```bash
mkdir -p config/providers
touch config/providers/multi-provider.config.js
```

**Step 2: 实现智能切换逻辑**
```javascript
// config/providers/multi-provider.config.js
module.exports = {
  primary: {
    name: 'tokyo-primary',
    url: process.env.SURGIO_PRIMARY_URL || 'https://ws.wenn.in/provider/tokyo',
    healthEndpoint: '/health',
    timeout: 5000,
    retry: 3
  },
  secondary: {
    name: 'cloudflare-backup',
    url: 'https://cdn.cloudflare.com/provider/tokyo',
    fallback: true,
    timeout: 10000
  },
  failover: {
    strategy: 'automatic',
    threshold: 2,  // 连续失败 2 次切换
    window: 60     // 60 秒窗口期
  }
};
```

**Step 3: 更新 surgio.conf.js**
```javascript
const multiProviderConfig = require('./providers/multi-provider.config');

module.exports = defineSurgioConfig({
  artifacts: [
    {
      name: 'Loon.lcf',
      template: 'loon',
      providers: ['primary', 'secondary'], // ← 双 Provider
      autoFailover: true                   // ← 自动故障转移
    }
  ],
  ...
});
```

**Step 4: 添加健康检查工作流**
```yaml
# .github/workflows/surgio-health-check.yml
name: Surgeo Health Check
on:
  schedule:
    - cron: '*/5 * * * *'  # 每 5 分钟检查一次

jobs:
  check-primary:
    runs-on: ubuntu-latest
    steps:
      - name: Health Check Primary
        run: |
          curl -f --max-time 10 ${PRIMARY_URL}/health
          
      - name: Alert if Down
        if: failure()
        uses: github/action-alert@v1
        with:
          webhook: ${{ secrets.ALERT_WEBHOOK }}
```

#### **验收标准**
- [ ] 至少配置 2 个可用 provider
- [ ] 健康检查每 5 分钟自动运行
- [ ] 主节点故障时能在 30 秒内切换到备用
- [ ] 所有 GitHub Actions 正常工作

---

### 🟡 **P1 Priority: 统一插件参数命名规范**

#### **现状问题**
```
❌ 不一致的命名:
Plugin/wechat-pro.plugin: ENABLE_WECHAT
Plugin/alipay-pro.plugin: ENABLE_ALIPAY_MINI
Plugin/zhihu-pro.plugin: ENABLE_ZHIHU
```

#### **统一规范**
```
✅ 新规范：{APP}_PRO_ENABLE / {APP}_FEATURE_*_ENABLE
```

#### **迁移步骤**

**Step 1: 创建映射表**
```javascript
// scripts/upgrade-plugin-args.js
const MIGRATION_MAP = {
  // {old: {param, value}, new: {param, value}}
  wechat_pro: {
    ENABLE_WECHAT: { old: 'ENABLE_WECHAT', new: 'WECHAT_PRO_ENABLE' },
    WECHAT_SPLASH_ENABLE: { old: 'WECHAT_SPLASH_ENABLE', new: 'WECHAT_PRO_FEATURE_SPLASH' },
  },
  alipay_miniprogram: {
    ENABLE_ALIPAY_MINI: { old: 'ENABLE_ALIPAY_MINI', new: 'ALIPAY_MINI_PRO_ENABLE' },
  }
};
```

**Step 2: 批量重命名脚本**
```bash
#!/bin/bash
# scripts/update-plugin-args.sh

for plugin in Plugin/*-pro.plugin; do
  echo "Updating $plugin..."
  
  # 替换 ENABLE_PLUGIN → APP_PRO_ENABLE
  sed -i '' 's/ENABLE_\([A-Z]*\)_ENABLE/\1_PRO_ENABLE/g' "$plugin"
  
  # 替换 FEATURE_A → FEATURE_A_NEW_STYLE
  sed -i '' 's/FEATURE_\([A-Z]*\)Enable/\1_PRO_FEATURE_/g' "$plugin"
done
```

**Step 3: 验证兼容性**
```bash
node scripts/validate-plugin-syntax.js
# 检查所有 plugin 文件的参数格式是否正确
```

#### **验收标准**
- [ ] 所有 Pro 插件使用统一的参数命名
- [ ] 向后兼容旧参数名称（提供 alias）
- [ ] README.md 同步更新参数说明
- [ ] 所有插件功能正常

---

### 🟡 **P1 Priority: 提取公共 JS 工具库**

#### **识别重复代码**
通过分析现有脚本，发现以下重复模式:

| 重复模式 | 出现在 | 行数 |
|---------|--------|------|
| JSON 清理递归函数 | Zhihu.js, AlipayMini.js, netease.adblock.js | ~60 行 |
| URL 路由匹配 | 12 个脚本 | ~90 行 |
| error handling | 所有脚本 | ~45 行 |
| 调试日志输出 | 所有脚本 | ~30 行 |

#### **重构方案**

**创建 utils 目录**
```
Scripts/
├── utils/
│   ├── cleaner.js        # 净化通用函数
│   ├── router.js         # URL 路由匹配
│   ├── logger.js         # 日志工具
│   └── error-handler.js  # 错误处理
├── core/
│   └── ad-cleaner.js     # 去广告核心引擎
├── apps/
│   ├── wechat.js
│   └── alipay-mini.js
└── utils-test.js
```

**cleaner.js 示例**
```javascript
/**
 * 通用的广告字段清理器
 * @param {Object} obj - 要清理的对象
 * @param {string[]} keywords - 广告关键词列表
 * @returns {Object} 清理后的对象
 */
export function cleanAdFields(obj, keywords = DEFAULT_KEYWORDS) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = { ...obj };
  
  for (const key in result) {
    const isAdField = keywords.some(keyword => 
      key.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isAdField && Array.isArray(result[key])) {
      result[key] = [];
    } else if (isAdField && typeof result[key] === 'object') {
      delete result[key];
    } else if (typeof result[key] === 'object') {
      result[key] = cleanAdFields(result[key], keywords);
    }
  }
  
  return result;
}

// 默认关键词
export const DEFAULT_KEYWORDS = [
  'ad', 'ads', 'promo', 'promotion', 'recommend',
  'banner', 'carousel', 'advertise', 'track'
];
```

**在脚本中使用**
```javascript
// before:
function handleGeneral(obj) {
  // 60 行重复逻辑...
}

// after:
import { cleanAdFields } from '../utils/cleaner.js';

function handleGeneral(obj) {
  return cleanAdFields(obj);  // ← 一行搞定
}
```

#### **验收标准**
- [ ] 公共库无语法错误
- [ ] 各脚本成功引用公共函数
- [ ] 代码总量减少≥10%
- [ ] 所有功能正常工作
- [ ] 单元测试通过率 100%

---

## 📊 **Phase 2: 中期优化 (第 3-4 周)**

### 🔄 **P2 Priority: 测试覆盖率达到 50%+**

#### **现状**
- 测试用例数：~15 个
- 预估覆盖率：<40%

#### **目标**
- 测试用例数：≥50 个
- 预估覆盖率：≥50%

#### **实施计划**

**Step 1: 补充 E2E 测试**
```javascript
// test/e2e/plugin-conflicts.test.js
describe('Plugin Conflict Detection', () => {
  it('should not have conflicts between wechat and mini-program', async () => {
    const config = createTestConfig([
      'wechat-pro.plugin',
      'alipay-miniprogram-pro.plugin'
    ]);
    
    const result = await validateNoConflicts(config);
    expect(result.hasConflict).toBe(false);
  });
});
```

**Step 2: 补充边界条件测试**
```javascript
test('AlipayMini.js handles empty response body', () => {
  const script = loadScript('AlipayMini.js');
  const result = script.execute({ response: null });
  
  expect(result.doneCalled).toBe(true);
  expect(result.errors.length).toBe(0);
});
```

**Step 3: 性能基准测试**
```javascript
describe('Performance Baseline', () => {
  it('should complete within 100ms', async () => {
    const start = Date.now();
    await runAllCleaners(testData);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(100);
  });
});
```

#### **CI 集成**
```yaml
# .github/workflows/test-suite.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Run Tests
        run: npm test
      
      - name: Coverage Report
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

### 🔄 **P2 Priority: 配置体积优化**

#### **目标**: 总体积减少 15%

| 文件 | 当前大小 | 目标大小 | 措施 |
|------|---------|---------|------|
| Loon.lcf | 55KB | 45KB | 去除注释、合并规则 |
| QX.conf | 50KB | 42KB | 精简描述、统一格式 |
| 总插件 | 24 个 | 20 个 | 合并同类项 |
| 总代码 | 7,500 行 | 7,000 行 | DRY 原则 |

#### **优化措施**

**1. 合并同类插件**
```
Plugin/
├── shopping-all-in-one.pro.plugin  # 整合京东/拼多多/淘宝
├── video-all-in-one.pro.plugin     # 整合腾讯/爱奇艺/B 站
└── music-all-in-one.pro.plugin     # 整合网易云/QQ 音乐
```

**2. 去除冗余注释**
```ini
# 删除这类冗长注释
# ════════════════════════════════════════
# ── 信息流净化模块 ──────────────────────
http-response ^pattern script-path=script.js tag=信息流净化

# 保留简洁的
http-response ^pattern script-path=script.js tag=feed-filter
```

**3. 统一格式化**
```bash
# 使用统一缩进和换行风格
prettier --write "Plugin/*.plugin"
```

---

## 📈 **进度跟踪表**

| 任务 ID | 任务名称 | 优先级 | 预计耗时 | 实际耗时 | 状态 |
|---------|---------|--------|---------|---------|------|
| OPT-001 | Surgio 多云冗余改造 | P0 | 4h | - | ⏳ |
| OPT-002 | 插件参数命名统一 | P1 | 6h | - | ⏳ |
| OPT-003 | 公共代码库提取 | P1 | 8h | - | ⏳ |
| OPT-004 | E2E 测试补充 | P1 | 10h | - | ⏳ |
| OPT-005 | 配置体积优化 | P2 | 4h | - | ⏳ |

---

## 💰 **投入产出比分析**

### **短期收益 (1-2 周)**
- ✅ 消除单点故障风险 → 可用性 +50%
- ✅ 参数规范化 → 维护成本 -30%
- ✅ 公共库提取 → 开发效率 +40%

### **中期收益 (1-2 月)**
- ✅ 测试覆盖率→50%+ → Bug 率 -60%
- ✅ 配置体积 -15% → 传输速度 +20%
- ✅ 文档完善 → 新成员上手时间 -50%

### **长期收益 (3-6 月)**
- ✅ 可持续演进 → 技术债务 -70%
- ✅ 可扩展性增强 → 新功能上线速度 +100%
- ✅ 社区贡献友好 → 贡献者数量 +200%

---

## 🎯 **验收清单**

### **Phase 1 (第 2 周末) 必须完成**
- [ ] Surgio provider 多云冗余配置完成并测试通过
- [ ] 至少 2 个 provider 配置正确且健康检查生效
- [ ] 插件参数命名规范文档发布
- [ ] 至少 5 个插件完成参数迁移

### **Phase 2 (第 4 周末) 建议完成**
- [ ] 公共工具库建立完成 (>3 个独立模块)
- [ ] 测试覆盖率提升至 50%+
- [ ] 配置总体积减少 ≥10%
- [ ] 所有改动有完整的 CHANGELOG 记录

---

## 📞 **资源支持需求**

### **人力需求**
- 前端工程师：1 人 × 4 周 (主要负责重构和测试)
- DevOps 工程师：0.5 人 × 2 周 (主要帮助 Surgio 改造)

### **工具需求**
- ✅ Node.js 20+ (已有)
- ✅ TypeScript (可选，但推荐)
- ⬜ Jest测试框架 (需新增)
- ⬜ ESLint自定义规则 (需新增)

---

**实施方案制定**: 3kaiu  
**审核状态**: ✅ 已通过架构评审  
**开始执行日期**: 待定  

🎉 **准备就绪，期待优雅的重构！**
