审查 `Mirror/` 变更时：

- 核对每个文件在 `Mirror/MANIFEST.json` 中的 `sha256`、`bytes` 与 `source_url`；人工抽查至少 2–3 个。
- 仅接受可信上游：blackmatrix7、ddgksf2013、app2smile、Maasea、GOODBYEADS、ifflagged/Romeo、NSRingo、DualSubs、Auraflare、Biliverse、NSNanoCat。
- 新增上游默认锁定具体版本或 commit。仓库已批准的 `latest` 策略仅适用于现有镜像清单中的指定上游，并必须同时受 workflow 声明、MANIFEST、PR 人审和 `check:drift` 约束。
- `.plugin`/`.lpx` 内 `script-path` 仅允许 github.com、raw.githubusercontent.com、gist.githubusercontent.com、ws.wenn.in、kelee.one；jsdelivr/unpkg 或其他域必须先单独审查。
- 所有 `ws.wenn.in/main/Mirror/...` 引用必须有对应仓库文件和 MANIFEST 条目。
- `startup-adblock-pro.plugin` 的 hostname 必须含点，且不能是日期或纯数字。
- `*.js` 必须通过 `node --check`，体积不少于 200B，且不能是 HTML 错误页。
- key 与 URL scheme 大小写不豁免，统一按小写归一后判定。
