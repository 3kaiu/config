当审查 Mirror/ 目录下的 PR 时：
- 检查每个变更文件的 sha256 是否与 MANIFEST.json 记录一致
- 确认源 URL 是可信上游（blackmatrix7、ddgksf2013、app2smile、KOP-XIAO、NSRingo）
- 确认无新增高危 URL/域名（防投毒）
- *.js 文件应有合法 JS 语法
- 文件体积 ≥ 200B 且非 HTML 错误页
