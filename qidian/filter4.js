if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>> filter4");
  console.log(JSON.stringify($request.headers));
  console.log(JSON.stringify($request));
  console.log("🚀🚀->>>🚀🚀>>>>>🚀🚀>>> request");
  try {
    const body = JSON.parse(data);
    body.Data = {};

    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
