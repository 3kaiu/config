if ($response) {
  const data = $response.body;
  console.log("🚀🚀->>>>>>>>>>>", data);
  try {
    const body = JSON.parse(data);
    body.Data.BenefitButtonList = [body.Data.BenefitButtonList[0]];
    body.Data.FunctionButtonList = [];
    body.Data.BottomButtonList = [];
    body.Data.Member = {};
    body.Data.SchoolText = "";
    body.Data.SchoolUrl = "";
    body.Data.SchoolImage = "";
    body.Data.AccountBalance.QdFreeBalance = 10000;
    body.Data.AccountBalance.QdBalance = 10002;
    body.Data.AccountBalance.YdFreeBalance = 10001;
    body.Data.AccountBalance.YdBalance = 10003;
    body.Data.AccountBalance.QdWorthBalance = 10004;

    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log("JSON Parse error:", error);
  }
} else {
  console.error("Response is undefined⚠️警告->>>>>>>>>>>>>>>>");
}
