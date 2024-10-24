if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>> init初始化");
  try {
    const body = JSON.parse(data);
    body.Data.Items = [];

    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
