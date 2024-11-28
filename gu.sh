#!/bin/bash

# 默认配置
BASE_URL=${ATM_OPENAI_API_BASE_URL:-"https://api.chatanywhere.tech"}
MODEL=${ATM_OPENAI_API_MODEL:-"gpt-3.5-turbo"}
TOKEN=${ATM_OPENAI_API_TOKEN:-"sk-rbBT6BNQU9YzrRsu6xHfsfGtCjmup02otxX8f77y66psfxCP"}

# 提示语
PROMPT="Take a deep breath and work on this problem step-by-step. Summarize the provided diff into a clear and concise written commit message. Follow these rules:
1. Start the message with an appropriate emoji that represents the type of change.
2. Use the imperative style for the subject.
3. Limit the subject line to 50 characters or less (excluding the emoji).
4. Optionally, use a scope in parentheses after the emoji.
5. If needed, add a brief description in the body, separated by a blank line.
6. Be as descriptive as possible while keeping it concise.
7. Return the commit message ready to be pasted into commit edits without further editing.
8. Always reply in English.


Here are some common emojis for reference:
✨ New feature
🐛 Bug fix
📚 Documentation
🎨 Style/UI
♻️ Refactor
🚀 Performance
🧪 Test
🔧 Configuration
🔒 Security

Provide only the commit message, without any additional explanations or formatting."

# 获取git diff
DIFF=$(git diff --cached)
USE_STAGED=true

# 如果没有暂存区更改，检查工作区更改
if [ -z "$DIFF" ]; then
  echo "暂存区没有更改，检查工作区的更改..."
  DIFF=$(git diff HEAD || git diff)
  USE_STAGED=false

  # 如果没有更改
  if [ -z "$DIFF" ]; then
    echo "工作区也没有更改,请先执行git add"
    exit 1
  fi
fi

# 请求数据
REQUEST_DATA=$(jq -n \
                  --arg model "$MODEL" \
                  --arg prompt "$PROMPT\n\n$DIFF" \
                  --arg max_tokens "2048" \
                  --arg temperature "0.5" \
                  '{
                    model: $model,
                    messages: [
                      {role: "user", content: $prompt}
                    ],
                    temperature: $temperature|tonumber
                  }')

# 发送API请求并返回响应
send_api_request() {
  local response
  local http_code
  local body

  # 确保 jq 可用
  if ! command -v jq &> /dev/null; then
    echo "错误：jq 工具未安装"
    return 1
  fi

  response=$(curl -s -w "\n%{http_code}" -X POST "https://api.chatanywhere.tech/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    --data-raw "$REQUEST_DATA")

  # 提取HTTP响应和状态码
  body=$(echo "$response" | sed '$d')
  http_code=$(echo "$response" | tail -n1)

  # 错误处理
  if [ "$http_code" != "200" ]; then
    echo "错误：API请求失败，HTTP状态码：$http_code"
    echo "响应内容：$body"
    return 1
  fi

  if ! echo "$body" | jq . >/dev/null 2>&1; then
    echo "错误：API返回的不是有效的JSON格式"
    return 1
  fi

  echo "$body"
}

# 调用API并生成提交信息
generate_commit_message() {
  RESPONSE=$(send_api_request)
  if [ $? -ne 0 ]; then
    echo "生成提交信息失败，请检查网络连接或API配置。"
    exit 1
  fi
  COMMIT_MSG=$(echo "$RESPONSE" | jq -r '.choices[0].message.content' | sed 's/^```//; s/```$//' | tr -s '\n' ' ')
  if [ -z "$COMMIT_MSG" ]; then
    echo "错误：无法从API响应中提取提交信息"
    exit 1
  fi
}

# 主执行流程
generate_commit_message
echo "生成的提交信息：$COMMIT_MSG"

# 用户确认提交信息
while true; do
  read -p "您想使用这个提交信息吗？(yes/no/regenerate/custom) default-yes: " CONFIRM
  CONFIRM=${CONFIRM:-yes}

  case $CONFIRM in
    yes|y)
      if [ "$USE_STAGED" = true ]; then
        git commit -m "$COMMIT_MSG"
      else
        git add -A
        git commit -m "$COMMIT_MSG"
      fi
      echo "提交成功创建。"
      break
      ;;
    no|n)
      echo "提交已取消。"
      break
      ;;
    regenerate|r)
      echo "重新生成提交信息..."
      generate_commit_message
      echo -e "\n新生成的提交信息：\n$COMMIT_MSG\n"
      ;;
    custom|c)
      echo "请输入您的自定义提交信息（输入完成后，在新行输入 'EOF' 并按回车结束）："
      CUSTOM_MSG=""
      while IFS= read -r line; do
        if [ "$line" = "EOF" ]; then
          break
        fi
        CUSTOM_MSG+="$line"$'\n'
      done
      if [ -n "$CUSTOM_MSG" ]; then
        git commit -m "$CUSTOM_MSG"
        echo "使用自定义信息创建提交成功。"
        break
      else
        echo "提交信息不能为空，请重新选择。"
      fi
      ;;
    *)
      echo "无效的输入，请输入 yes、no、regenerate 或 custom。"
      ;;
  esac
done