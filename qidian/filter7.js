if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>> filter7");
  console.log("filter7: " + data);

  try {
    const body = JSON.parse(data);

    // 设置 ReadingCoupons 的值
    body.Data.ReadingCoupons = 2000;

    // 设置 TopUpConsumeStrategy 的属性，使用英文分号
    body.Data.TopUpConsumeStrategy.IsAutoOpenTopUpPopUp = 0;
    body.Data.TopUpConsumeStrategy.TopUpCouponStrategy = 20;
    body.Data.TopUpConsumeStrategy.SubscribeCouponStrategy = 20;
    body.Data.TopUpConsumeStrategy.ConfigSource = 0;

    // 确保 dataArray 是定义并且有效的
    const dataArray = body.Data.Chapter; // 请根据实际路径调整
    if (Array.isArray(dataArray) && dataArray.length >= 2) {
      let totalPrice = 0;
      const lastTwoItems = dataArray.slice(-2);

      lastTwoItems.forEach((item) => {
        totalPrice += item.Price;

        // 将价格相关的属性设置为 0
        item.NPrice = 0;
        item.PriceInfo.DiscountPointPrice = 0;
        item.PriceInfo.OriginPrice = 0;
        item.PriceInfo.DiscountPrice = 0;
        item.PriceInfo.OriginPointPrice = 0;
        item.JuniorPrice = 0;
        item.Price = 0;
      });

      // 更新 ReadingCouponsPrice
      body.Data.ReadingCouponsPrice -= totalPrice; // 使用 -= 进行减少
      body.Data.IsMemberBook = 1;
      body.Data.FreeBalance = 2000;
      body.Data.WordsBalance = 2000;
      body.Data.DQBalance = 2000;
      body.Data.EnableBookUnitBuy = 1;
      body.Data.Balance = 2000;
      body.Data.NewWordBalance = 2000;
      boday.Data.ChapterCardV2 = {
        TotalAmount: 100,
        ABRule: 1,
        Hint: "可选择章节卡，大额章节卡建议批量订阅使用",
        TotalCount: 10,
        CanUseChapterCard: 0,
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
        ],
      };
    } else {
      console.error("dataArray is not valid or has fewer than 2 items.");
    }

    // 发送修改后的 body
    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
