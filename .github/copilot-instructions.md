当审查 Mirror/ 目录下的 PR 时：
- 检查每个变更文件的 sha256 是否与 MANIFEST.json 记录一致（`config-validate` 8b 门禁自动验，人工抽查 2-3 个）
- 确认源 URL 是当前可信上游：blackmatrix7、ddgksf2013、app2smile、Maasea、Sub-Store 官方、GOODBYEADS、ifflagged/Romeo、NSRingo、DualSubs、Auraflare、BiliUniverse（注意：KOP-XIAO 已下架，不再是源）
- 上游 `.plugin` 内 script-path 白名单（与 mirror 门禁 4 对齐，大小写不敏感）：github.com、raw.githubusercontent.com、gist.githubusercontent.com、ws.wenn.in、3kaiu.github.io、kelee.one —— 注意上游文件不含 jsdelivr/unpkg（那是本地壳的白名单，不要混用）
- 确认无新增高危 URL/域名（防投毒）；`startup-adblock-pro.plugin` 的 host 须含点且非日期/纯数字
- *.js 文件应有合法 JS 语法（`node --check`），文件体积 ≥ 200B 且非 HTML 错误页
- 大小写 key（如 `SCRIPT-PATH`）与 scheme 大小写不豁免，一律按小写归一后判定
