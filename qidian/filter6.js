if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>> filter6");
  console.log('filter6' + data)
  try {
    const body = JSON.parse(data);
    body.Result = 0
    body.Message = ''


    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
