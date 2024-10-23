let body = JSON.parse($response.body);

body.Data.BenefitButtonList = [body.Data.BenefitButtonList[0]];
body.Data.FunctionButtonList = [];
body.Data.BottomButtonList = [];
body.Data.Member = {};
body.Data.SchoolText = "";
body.Data.SchoolUrl = "";
body.Data.AccountBalance.QdFreeBalance = 10000;

// 返回修改后的 body
$done({ body: JSON.stringify(body) });
