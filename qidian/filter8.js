console.log($request,'----------------------request');
console.log($request.headers)
console.log("🚀🚀->>>🚀🚀>>>>>🚀🚀>>> request");
if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>> filter8");
    console.log("Request Headers:", JSON.stringify($request.headers));
  
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

    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
