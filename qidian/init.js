let body = JSON.parse($response.body);

// 遍历 features，将所有 enabled 设为 false，sample_ratio 设为 0
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

// 返回修改后的 body
$done({ body: JSON.stringify(body) });
