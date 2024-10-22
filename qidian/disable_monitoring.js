// disable_monitoring.js

let body = JSON.parse($response.body);

// 遍历 features，将所有 enabled 设为 false，sample_ratio 设为 0
body.Data.features.forEach((feature) => {
  feature.enabled = false; // 关闭监控
  feature.sample_ratio = 0; // 设置采样率为0
});

// 返回修改后的 body
$done({ body: JSON.stringify(body) });
