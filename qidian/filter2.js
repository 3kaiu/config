let body = JSON.parse($response.body);

console.log('匹配到了，输出----->',$response)

body.Data.BenefitButtonList = [body.Data.BenefitButtonList[0]];
body.Data.Data.DianNiangWorldSwitch = 0;
body.Data.FunctionButtonList = [];
body.Data.BottomButtonList = [];
body.Data.Member = {};
body.Data.SchoolText = "";
body.Data.SchoolUrl = "";
body.Data.SchoolImage = '';
body.Data.AccountBalance.QdFreeBalance = 10000;
body.Data.AccountBalance.QdBalance = 10002;
body.Data.AccountBalance.YdFreeBalance = 10001;
body.Data.AccountBalance.YdBalance = 10003;
body.Data.AccountBalance.QdWorthBalance = 10004;


// 返回修改后的 body
$done({ body: JSON.stringify(body) });
