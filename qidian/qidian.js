[rewrite local]
# 精确匹配需要处理的三个API路径
^https?:\/\/(rmonitor\.qq\.com|magev6\.if\.qidian\.com)\/argus\/api\/v1\/video\/adv\/(finishWatch|mainPage) url script-request-body https://github.com/3kaiu/config/raw/main/qidian/universal_script.js
^https?:\/\/h5\.if\.qidian\.com\/argus\/api\/v3\/user\/getaccountpage url script-response-body https://github.com/3kaiu/config/raw/main/qidian/universal_script.js
# 广告请求直接拒绝
^https?:\/\/magev6\.if\.qidian\.com\/argus\/api\/v1\/adv\/getadvlistbatch url reject-200

[MITM]
hostname = rmonitor.qq.com, magev6.if.qidian.com, h5.if.qidian.com
