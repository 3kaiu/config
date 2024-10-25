if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>> filter8");
  console.log("filter8" + data);
  try {
    const body = JSON.parse(data);

    body.Data.CouponPrice = 0;
    body.Data.CouponPrice = 0;
    body.Data.ReadingCouponsPrice = 0;
    body.Data.Price = 0;
    body.Data.CouponPointPrice = 0;
    body.Data.EnableBookUnitBuy = 1;
    body.Data.ReadingCoupons = 1001;
    body.Data.PriceInfo.DiscountPrice = 0;
    body.Data.PriceInfo.DiscountPointPrice = 0;
    body.Data.PriceInfo.OriginPrice = 0;
    body.Data.PriceInfo.CanUnlock = 0;
    body.Data.Balance = 999;
    body.Data.QDBalance = 999;
    body.Data.FreeBalance = 999;
    body.Data.WordBalance = 999;
    body.Data.PriceInfo.OriginPointPrice = -1;
    body.Data.PriceInfo.PointDiscountType = -1;
    body.Data.PriceInfo.ChapterType = 0;
    body.Data.PriceInfo.OriginPointPrice = 0;

    body.Data.ChapterCardV2 = {
      TotalAmount: 120,
      ABRule: 1,
      Hint: "可选择章节卡，大额章节卡建议批量订阅使用",
      TotalCount: 11,
      CanUseChapterCard: 1,
      Detail: [
        {
          Amount: 100,
          RuleId: 0,
          Tip: "2024年11月02日过期",
          LimitType: 0,
          Count: 10,
          Desc: "*全场通用，以章节卡说明为准",
          DiscountId: "10_0",
          Name: "10点章节卡",
        },
        {
          Amount: 20,
          RuleId: 1,
          Tip: "2024年11月02日过期",
          LimitType: 0,
          Count: 1,
          Desc: "*全场通用，以章节卡说明为准",
          DiscountId: "20_0",
          Name: "20点章节卡",
        },
      ],
    };

    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
