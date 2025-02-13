[rewrite local]
https?:\/\/magev6\.if\.qidian\.com\/argus\/api\/v1\/adv\/getadvlistbatch url reject-200
https?:\/\/(rmonitor\.qq\.com|magev6\.if\.qidian\.com|h5\.if\.qidian\.com)\/.* url script-request-body https://github.com/3kaiu/config/raw/main/qidian/universal_script.js
https?:\/\/(rmonitor\.qq\.com|magev6\.if\.qidian\.com|h5\.if\.qidian\.com)\/.* url script-response-body https://github.com/3kaiu/config/raw/main/qidian/universal_script.js

[MITM]
hostname = rmonitor.qq.com, magev6.if.qidian.com, h5.if.qidian.com
