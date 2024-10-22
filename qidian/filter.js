let body = JSON.parse($response.body);

body.Data.Items = [];

// 返回修改后的 body
$done({ body: JSON.stringify(body) });
