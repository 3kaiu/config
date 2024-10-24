console.log('进来了->>>>>>>>>>>>>>>>>>>>>>>>>>>')

let body = JSON.parse($response.body);

// 清空 EntranceTabItems 数组
body.Data.EntranceTabItems = [];

// 确保从 CountdownBenefitModule 中提取 TaskList 的正确元素
body.Data.CountdownBenefitModule.TaskList = [
  body.Data.CountdownBenefitModule.TaskList[0],
  body.Data.CountdownBenefitModule.TaskList[1]];

// 清空 MonthBenefitModule 和 BaizeModule
// body.Data.MonthBenefitModule = {};
// body.Data.BaizeModule = {};

// 返回修改后的 body
$done({ body: JSON.stringify(body) });
