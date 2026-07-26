# Plugin Monitor - 自动化监控框架

## 🎯 功能概述

本项目实现了完整的**上游插件源自动化监控体系**，能够自动检测各大开源项目（GitHub/Telegram）的更新情况，并及时通知用户。

---

## 📋 架构组成

### 1. **核心组件**

```
scripts/monitor/
├── upstream-monitor.js      # 主监控程序
├── check-updates.js         # 更新检查器 (待扩展)
└── config.js                # 配置文件 (待创建)

.github/workflows/
└── plugin-monitor.yml       # GitHub Actions 工作流

output/                       # 输出目录
├── monitor-results.json     # 详细结果
├── summary-report.md        # 摘要报告
└── .last-*.hash            # 记录上次 commit hash
```

---

## 🔧 配置说明

### GitHub Actions Secrets

需要在仓库设置中添加以下 Secrets：

```bash
TELEGRAM_BOT_TOKEN    # Telegram 机器人 Token
TELEGRAM_CHAT_ID      # 接收通知的 Chat ID
```

### 监控的上游源列表

在 `upstream-monitor.js` 中定义：

```javascript
const UPSTREAM_SOURCES = [
  {
    name: 'app2smile/rules',           // 源名称
    url: 'https://api.github.com/...', // GitHub API URL
    platform: 'GitHub',                 // 平台类型
    type: 'scripts',                    // 内容类型
    needsToken: false                   // 是否需要 Token
  },
  // ... 其他源
];
```

---

## 🚀 使用方法

### 方式 A: 定时自动监控

工作流默认配置为**每日 UTC+8 凌晨 2:00 执行**:

```yaml
on:
  schedule:
    - cron: '0 18 * * *'  # UTC+8 凌晨 2 点
```

### 方式 B: 手动触发

使用 GitHub Actions 页面手动触发：

1. 打开 Repository → Actions
2. 选择 "Plugin Monitor & Auto-Update"
3. 点击 "Run workflow"
4. 可选参数:
   - `plugin_name`: 指定监测特定插件
   - `update_type`: 更新类型筛选

---

## 📊 输出结果

### 1. **控制台输出**

```
🤖 Starting upstream plugin monitor...

🔍 Checking app2smile/rules...
  ✅ New update detected!
     Commit: a1b2c3d
     Message: Update BilibiliAds.conf
     
✔️ No updates

📊 Monitoring Summary:
   Total sources checked: 5
   Updates detected: YES
   Errors encountered: 0
```

### 2. **GitHub Steps Summary**

在 Workflow Run 页面显示：

```
=== Plugin Updates Detected ===

{
  "name": "app2smile/rules",
  "has_update": true,
  "commit_hash": "a1b2c3d",
  "commit_message": "Update BilibiliAds.conf",
  ...
}
```

### 3. **GitHub Issue 自动创建**

当发现新更新时，自动创建 Issue：

**标题**: `⚠️ 上游脚本更新通知 - app2smile/rules`

**内容**: 
- Commit Hash
- 更新消息
- 作者信息
- 更新时间

### 4. **Telegram 通知**

发送到配置的 Telegram 频道：

```
🤖 自动监控报告

✅ 监控时间：2026-07-26 02:00:00
📊 监控状态：success
🔔 更新检测：发现新更新!

查看详细报告：链接...
```

---

## 🛠️ 扩展维护

### 添加新的监控源

1. **编辑 `upstream-monitor.js`**:

```javascript
{
  name: 'new-source/repo',
  url: 'https://api.github.com/repos/new-source/repo/commits?per_page=1',
  platform: 'GitHub',
  type: 'scripts|rules|all|news'
},
```

2. **如果是 Telegram 频道**:

```javascript
{
  name: '@channel-name',
  url: 'https://api.telegram.org/botTOKEN/getUpdates',
  platform: 'Telegram',
  type: 'news',
  needsToken: true  // 需要 Token
}
```

### 自定义过滤规则

修改 `check-updates.js` (待创建):

```javascript
function shouldNotify(commit) {
  // 只通知包含特定关键词的更新
  const keywords = ['fix:', 'feat:', 'Update', '新增'];
  return keywords.some(k => commit.message.includes(k));
}
```

---

## 🔒 安全注意事项

### 1. **Token 管理**

- 所有敏感信息通过 GitHub Secrets 存储
- 不要将 Token 直接提交到代码库
- 定期轮换 Token

### 2. **API 限流**

GitHub API 有速率限制：
- 未认证：60 requests/hour
- 已认证：5000 requests/hour

建议措施:
- 实现重试机制
- 合理设置监控频率
- 批量处理请求

### 3. **错误处理**

完善的错误捕获:
- 网络超时重试
- API 错误降级
- 异常日志记录

---

## 📈 性能优化

### 1. **并发控制**

```javascript
const MAX_CONCURRENT = 3;  // 最大并发数
```

避免同时发起过多请求导致限流。

### 2. **缓存策略**

保存上次 commit hash 避免重复通知：

```javascript
const lastHashFile = `output/.last-${source.name}.hash`;
```

### 3. **增量更新**

只检查最新的 commit，而非全量历史：

```javascript
url: '.../commits?per_page=1'
```

---

## 🎯 未来规划

### Phase 1: 基础监控 ✅ (已完成)
- [x] GitHub API 监控
- [x] 基本告警系统
- [x] Telegram 通知

### Phase 2: 智能分析 ⏳
- [ ] 更新模式识别
- [ ] 重要程度评分
- [ ] 更新趋势预测

### Phase 3: 自动同步 ⏳
- [ ] 自动拉取更新
- [ ] PR 自动创建
- [ ] 变更差异对比

### Phase 4: 多平台支持 ⏳
- [ ] GitLab/Gitee 监控
- [ ] Docker Hub 监控
- [ ] npm/NuGet 监控

---

## 💡 最佳实践

### 1. **监控频率**

根据项目规模调整:
- 高频更新源：每日 1-2 次
- 低频更新源：每周 1-2 次
- 关键项目：实时监控 + 手动触发

### 2. **通知分级**

不同级别的通知策略:
- 🔴 严重问题：立即电话/短信通知
- 🟡 重要更新：Telegram + Email
- 🟢 常规更新：仅日志记录

### 3. **数据保留**

建议保留最近 30 天的详细日志：
```javascript
// 清理旧数据
fs.readdirSync(outputDir)
  .filter(file => file.endsWith('.json'))
  .forEach(file => {
    const stats = fs.statSync(file);
    if (Date.now() - stats.mtime > 30*24*60*60*1000) {
      fs.unlinkSync(file);
    }
  });
```

---

## 📞 技术支持

- **问题反馈**: https://github.com/3kaiu/config/issues
- **贡献代码**: Pull Requests Welcome
- **文档完善**: 持续改进中

---

**版本**: v1.0.0  
**作者**: 3kaiu  
**日期**: 2026-07-26

🎉 让插件更新监控变得智能化、自动化！
