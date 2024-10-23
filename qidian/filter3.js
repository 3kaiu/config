let body = JSON.parse($response.body);

body.Data.EntranceTabItems = [];
body.Data.CountdownBenefitModule.TaskList = [
  body.Data.CountdownBenefitModule.TaskList[0],
  bodyData.CountdownBenefitModule.TaskList[1],
];
body.Data.MonthBenefitModule = {};
body.Data.BaizeModule = {};

// 返回修改后的 body
$done({ body: JSON.stringify(body) });
