# AI 服务分流
# OpenAI / Anthropic / Google AI / AI 编程工具 / 新兴 AI (v7.8)

# OpenAI
DOMAIN-SUFFIX, openai.com, AI
DOMAIN-SUFFIX, ai.com, AI
DOMAIN-SUFFIX, chatgpt.com, AI
DOMAIN-SUFFIX, oaiusercontent.com, AI
DOMAIN-SUFFIX, oaistatic.com, AI
# (2026-09-21 精准去广告) 删 `DOMAIN-KEYWORD, openai, AI` — 本地 [Rule] 先于 [Remote Rule]
# 求值, 任何含 openai 子串的域 (钓鱼 openai-ads.evil.com / notopenai-tracker.com)
# 都会被提前送 AI(Proxy) 而永不到达 Advertising REJECT; 4 个真实 OpenAI 族已有
# SUFFIX 精确覆盖 (openai.com + 2 azure), 同 qreport "可枚举即不用宽匹配" 纪律。
DOMAIN-SUFFIX, openaiapi-site.azureedge.net, AI
DOMAIN-SUFFIX, openaicom-api-bdcpf8c6d2e9b8.azurefd.net, AI
# (2026-09-18 精简审计) 删 `DOMAIN, auth0.openai.com` — 被 L9 DOMAIN-SUFFIX, openai.com
# 同策略覆盖 (子域命中父域规则, 策略同为 AI), 纯死规则。
# Anthropic
DOMAIN-SUFFIX, anthropic.com, AI
DOMAIN-SUFFIX, claude.ai, AI
# Google AI
DOMAIN-SUFFIX, gemini.google.com, AI
DOMAIN-SUFFIX, aistudio.google.com, AI
DOMAIN-SUFFIX, deepmind.google, AI
DOMAIN-SUFFIX, bard.google.com, AI
DOMAIN-SUFFIX, makersuite.google.com, AI
DOMAIN-SUFFIX, generativelanguage.googleapis.com, AI
DOMAIN-SUFFIX, alkalimakersuite-pa.googleapis.com, AI
DOMAIN-SUFFIX, deepmind.com, AI
# DeepSeek
DOMAIN-SUFFIX, deepseek.com, AI
# Grok (xAI)
DOMAIN-SUFFIX, x.ai, AI
DOMAIN-SUFFIX, grok.com, AI
# AI 图像/视频
DOMAIN-SUFFIX, midjourney.com, AI
DOMAIN-SUFFIX, runwayml.com, AI
DOMAIN-SUFFIX, lumalabs.ai, AI
# AI 音视频
DOMAIN-SUFFIX, suno.ai, AI
DOMAIN-SUFFIX, elevenlabs.io, AI
DOMAIN-SUFFIX, elevenlabs.com, AI
# AI 搜索/问答
DOMAIN-SUFFIX, perplexity.ai, AI
DOMAIN-SUFFIX, openrouter.ai, AI
DOMAIN-SUFFIX, poe.com, AI
# AI 基础设施
DOMAIN-SUFFIX, groq.com, AI
DOMAIN-SUFFIX, huggingface.co, AI
# 新增 AI 服务
DOMAIN-SUFFIX, mistral.ai, AI
DOMAIN-SUFFIX, cohere.com, AI
DOMAIN-SUFFIX, replicate.com, AI
DOMAIN-SUFFIX, together.ai, AI
DOMAIN-SUFFIX, fireworks.ai, AI
# AI 编程工具
DOMAIN-SUFFIX, cursor.sh, AI
DOMAIN-SUFFIX, cursor.com, AI
DOMAIN-SUFFIX, cursor-api.com, AI
# (2026-09-21 精准去广告) 删 `DOMAIN, github.copilot.com` — 死规则。实测
# api.githubcopilot.com 存活 (404=有主机缺路径), github.copilot.com 传输层失败
# (不解析, 域名写反)。同文件 :13-14 `auth0.openai.com` 同例。
DOMAIN-SUFFIX, copilot-proxy.githubusercontent.com, AI
DOMAIN-SUFFIX, codeium.com, AI
DOMAIN-SUFFIX, codeiumserver.com, AI
DOMAIN-SUFFIX, windsurf.ai, AI
DOMAIN-SUFFIX, supermaven.com, AI
DOMAIN-SUFFIX, copilot.microsoft.com, AI
# Meta AI
DOMAIN-SUFFIX, meta.ai, AI
DOMAIN-SUFFIX, llama.com, AI
# Google AI 实验室
DOMAIN, notebooklm.google.com, AI
DOMAIN, labs.google.com, AI
