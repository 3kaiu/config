[rewrite local]
# 通用规则，匹配所有需要处理的 URL
https?:\/\/(rmonitor\.qq\.com|magev6\.if\.qidian\.com|h5\.if\.qidian\.com)\/.* url script-request-body https://raw.githubusercontent.com/your-repo/main/qidian/universal_script.js
https?:\/\/(rmonitor\.qq\.com|magev6\.if\.qidian\.com|h5\.if\.qidian\.com)\/.* url script-response-body https://raw.githubusercontent.com/your-repo/main/qidian/universal_script.js

[MITM]
hostname = rmonitor.qq.com, magev6.if.qidian.com, h5.if.qidian.com
