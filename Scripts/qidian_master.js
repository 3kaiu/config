/**
 * @name 起点读书增强插件 (智能重放 + 页面净化)
 * @author 用户 & Antigravity
 * @version 2.1.0
 * 
 * [rewrite_local]
 * # 拦截请求头进行自动重放
 * ^https:\/\/h5\.if\.qidian\.com\/argus\/api\/v1\/video\/adv\/finishWatch url script-request-header qidian_master.js
 * # 拦截响应体进行页面净化
 * ^https:\/\/h5\.if\.qidian\.com\/argus\/api\/(v1\/video\/adv\/mainPage|v3\/user\/getaccountpage) url script-response-body qidian_master.js
 * 
 * [mitm]
 * hostname = h5.if.qidian.com
 */

const $ = new Env("起点全能助手");

// URL 处理映射表 (已移除余额伪装)
const URL_HANDLERS = {
    "/argus/api/v1/video/adv/finishWatch": handleAdFinishWatch,
    "/argus/api/v1/video/adv/mainPage": filterMainPage,
    "/argus/api/v3/user/getaccountpage": rewriteAccountPage,
};

!(async () => {
    const url = $request.url;
    const path = extractPath(url);
    const handler = URL_HANDLERS[path];

    if (handler) {
        $.log(`命中处理器: ${path}`);
        await handler();
    } else {
        $done({});
    }
})().catch((e) => {
    $.log(`脚本执行异常: ${e}`);
    $done({});
});

// --- 1. 智能广告重放逻辑 ---
async function handleAdFinishWatch() {
    const body = $request.body || "";
    let totalReplay = 0;
    let taskName = "";

    if (body.indexOf("taskId=1218712929269776384") !== -1) {
        totalReplay = 2; taskName = "激励视频(系列1)";
    } else if (body.indexOf("taskId=1218712929269776388") !== -1) {
        totalReplay = 8; taskName = "福利任务(系列2)";
    }

    if (totalReplay > 0) {
        $.msg($.name, `识别到 ${taskName}`, `正在后台自动重放 ${totalReplay} 次...`);
        await sleep(2000);
        for (let i = 1; i <= totalReplay; i++) {
            await sleep(Math.floor(Math.random() * 3000) + 3000);
            await $task.fetch({ ...$request });
            $.log(`[${taskName}] 第 ${i} 次自动重放完成`);
        }
        $.msg($.name, `✅ ${taskName} 重放完成`, `已成功补全任务。`);
    }
    $done({});
}

// --- 2. 福利中心页面净化 ---
function filterMainPage() {
    try {
        let body = JSON.parse($response.body);
        const cleanModules = ["EntranceTabItems", "MonthBenefitModule", "BaizeModule"];
        cleanModules.forEach(key => {
            if (body.Data[key]) body.Data[key] = Array.isArray(body.Data[key]) ? [] : {};
        });
        if (body.Data.CountdownBenefitModule?.TaskList?.length >= 2) {
            body.Data.CountdownBenefitModule.TaskList = body.Data.CountdownBenefitModule.TaskList.slice(0, 2);
        }
        $done({ body: JSON.stringify(body) });
    } catch (e) { $done({}); }
}

// --- 3. 个人中心页面净化 ---
function rewriteAccountPage() {
    try {
        let body = JSON.parse($response.body);
        const cleanConfig = {
            PursueBookCard: { ShowTab: 1, Url: "" },
            BenefitButtonList: [], FunctionButtonList: [], BottomButtonList: [],
            Member: {}, SchoolText: "", SchoolUrl: "", SchoolImage: ""
        };
        Object.assign(body.Data, cleanConfig);
        $done({ body: JSON.stringify(body) });
    } catch (e) { $done({}); }
}

// --- 工具函数 ---
function extractPath(url) {
    try { return url.split(".com")[1].split("?")[0]; } catch (e) { return ""; }
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function Env(n) {
    this.name = n;
    this.log = (m) => console.log(`[${this.name}] ${m}`);
    this.msg = (t, s, b) => $notify(t, s, b);
}
