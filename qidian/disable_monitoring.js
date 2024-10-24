if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>> disable初始化");
  try {
    const body = JSON.parse(data);
    body.Data.features.forEach((feature) => {
      feature.enabled = false; // 关闭监控
      feature.sample_ratio = 0; // 设置采样率为0
    });

    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
