let body = JSON.parse($response.body);

body.Data.BenefitButtonList = body.Data.BenefitButtonList[0];

// 返回修改后的 body
$done({ body: JSON.stringify(body) });
