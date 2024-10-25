if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>> filter5");
  console.log('filter5' + data)
  try {
    const body = JSON.parse(data);
    body.Data.RiskCong.NewCaptcha = 20
    body.Data.RiskCong.CaptchaType = 1
    body.Data.RiskCong.BanId = 0

    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
