# Surgio 迁移评估 (v7.7)

**日期**: 2026-07-22
**结论**: 可迁移，但部分保留手动维护

---

## 1. Surgio 能力矩阵

| 功能 | Surgio 支持 | 3kaiu/config 适用性 |
|------|-----------|-------------------|
| 节点生成 (Loon `[Proxy]`) | `getLoonNodes()` | ✅ 可替代手动维护 |
| 节点生成 (QX `server_local`) | `getQuantumultXNodes()` | ✅ 可替代手动维护 |
| 规则转换 (Surge→QX) | `\| quantumultx` filter | ⚠️ 当前无 Surge 规则 |
| 规则转换 (Surge→Loon) | `\| loon` filter | ⚠️ 当前无 Surge 规则 |
| 平台特化模板 | Nunjucks + `providerName` | ✅ 可分离双端差异 |
| 插件/模块生成 | ❌ 不支持 | 19 个 plugin + QX 模块 → **维持手动** |
| 图标/Icons | ❌ | 维持直接引用 |
| iRingo Apple 模块 | ❌ | 维持手动维护 |

## 2. 可迁移的部分

```
当前手动          → Surgio 生成
Profile/Loon.lcf    Profile/Loon.lcf.njk
├── [General]       ├── [General] (手动)
├── [Proxy]         ├── getLoonNodes()  ← 自动
├── [Proxy Group]   ├── [Proxy Group] (手动)
├── [Rule]          ├── 共享规则源 → 双端渲染
├── [Remote Rule]   ├── 共享远程引用
├── [Plugin]        ├── (手动 — Surgio 不支持)
├── [Rewrite]       ├── (手动)
└── [MitM]          └── (手动)

Profile/QX.conf     Profile/QX.conf.njk
├── [general]       ├── [general] (手动)
├── [dns]           ├── (手动)
├── [policy]        ├── 共享规则源 → | quantumultx filter
├── [server_remote] ├── getQuantumultXNodes()
├── [filter_remote] ├── 共享远程引用
├── [filter_local]  ├── 共享规则源过滤
├── [rewrite_remote]├── (手动)
├── [rewrite_local] ├── (手动)
├── [task_local]    ├── (手动)
└── [mitm]          └── (手动)
```

## 3. 迁移收益

| 维度 | 当前 | 迁移后 | 收益 |
|------|------|--------|------|
| 节点管理 | 手动 | 自动 | 低（节点通过订阅导入，非手动定义） |
| 规则维护 | 双端手动 | 单源双端 | **高** — 当前 ~150 条本地规则中有 ~60% 共享 |
| 远程引用 | 双端重复 | 单源 | 中 — Remote Rule 列表一致 |
| 格式转换 | 手动 | 自动 | 低 — 当前双端差异不大 |
| CI 集成 | 验证 | 生成+验证 | 中 — 增加自动生成阶段 |

## 4. 保留手动维护的部分

- **19 个 Plugin/*.plugin** — Surgio 不支持 Loon plugin 格式
- **5 个 QX/apple/*.conf** — NSRingo 模块手动转换
- **9 个 Scripts/*.js** — 独立脚本，与生成无关
- **Kelee/*.plugin** — 外部插件缓存
- **Mirror/** — 外部脚本缓存
- **[Rewrite]/[Script]/[MitM]** 段 — 高度平台特化
- **GitHub Workflows** — 维持现有

## 5. 实施步骤

```bash
# Step 1: 安装
npm init surgio-project ./surgio

# Step 2: 配置 surgio.conf.js
#   provider: 引用黑名单规则源 (blackmatrix7/ddgksf2013)

# Step 3: 编写模板
#   template/loon.tpl    → Loon.lcf.njk
#   template/quantumultx.tpl → QX.conf.njk

# Step 4: 编写共享规则源
#   snippets/shared-rules.tpl — 跨平台公共规则

# Step 5: CI 集成
#   .github/workflows/surgio-build.yml
#   npm run generate → 生成到 Profile/
```

## 6. 风险

| 风险 | 缓解 |
|------|------|
| Surgio 停更 | 生成结果是静态文件，可继续手动维护 |
| 学习曲线 | 模板语法 Nunjucks 与现有 Jinja2 相似 |
| 生成 vs 手写差异 | CI 中配置 git diff 检查保证覆盖一致性 |
| 插件不兼容 | 保持 Plugin/ 目录手动维护不变 |

## 7. 结论

推荐部分迁移：共享规则 + 节点生成使用 Surgio，19 个 Plugin + QX 模块 + Scripts 维持现状。
迁移后可消除 ~40% 的双端手动重复维护工作。
