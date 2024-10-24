if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>> init初始化2");
  try {
    const body = JSON.parse(data);
    body.Data.PushDialogFrequency = Number.MAX_SAFE_INTEGER;
    body.Data.FreshmanCarryOnPlatSwitch = 0;
    body.Data.NotificationPageBackPushNoticeFrequency = "360";
    body.Data.EnableMonitorLog = 0;
    body.Data.UGCPushNoticeFrequency = "360";
    body.Data.PushDialogScenes = [];
    body.Data.PushNoticeFrequency = 0;
    body.Data.GDT.Account.Enable = 1;
    body.Data.GDT.Popup.Enable = 1;
    body.Data.ActivityPageBackPushNoticeFrequency = "360";
    body.Data.Member.IsMember = 1;
    body.Data.Member.MemberType = 1;
    body.Data.CheckInCaseSub = "1";
    body.Data.EnablePresent = 1;
    body.Data.IsFreeReadingUser = true;

    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
