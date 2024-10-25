if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>> filter7");
  console.log('filter7' + data)
  try {
    const body = JSON.parse(data);
    body.Data.ReadingCoupons = 2000;
    body.Data.TopUpConsumeStrategy.IsAutoOpenTopUpPopUp = 0；
    body.Data.TopUpConsumeStrategy.TopUpCouponStrategy = 20；
    body.Data.TopUpConsumeStrategy.SubscribeCouponStrategy = 20；
    body.Data.TopUpConsumeStrategy.ConfigSource = 0；
    let totalPrice = 0;
    const lastTwoItems = dataArray.slice(-2);
    lastTwoItems.forEach(item => {
      totalPrice += item.Price;
      item.NPrice = 0;
      item.PriceInfo.DiscountPointPrice = 0;
      item.PriceInfo.OriginPrice = 0;
      item.PriceInfo.DiscountPrice = 0;
      item.PriceInfo.OriginPointPrice = 0;
      item.JuniorPrice = 0;
      item.Price = 0;
    });
    body.Data.ReadingCouponsPrice = body.Data.ReadingCouponsPrice - totalPrice;


    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
