/**
 * @name 起点读书福利中心全自动重放
 * @description 激励视频任务(看1次=3次) & 福利任务(看1次=9次)
 * @author Antigravity
 * @version 1.0.0
 * 
 * [rewrite_local]
 * ^https:\/\/h5\.if\.qidian\.com\/argus\/api\/v1\/video\/adv\/finishWatch url script-request-header qidian_auto_replay.js
 * 
 * [mitm]
 * hostname = h5.if.qidian.com
 */

const $ = new Env("起点视频重放");

if (typeof $request !== "undefined") {
    autoReplay().finally(() => $done({}));
}

async function autoReplay() {
    const url = $request.url;
    const method = $request.method;
    const headers = $request.headers;
    const body = $request.body || "";

    $.log(`捕获到请求: ${url}`);
    
    let totalReplay = 0;
    let taskName = "";

    // === 智能识别逻辑 ===
    // 系列 1: taskId 结尾为 384 (激励视频 3次)
    if (body.indexOf("taskId=1218712929269776384") !== -1) {
        totalReplay = 2;
        taskName = "激励视频(系列1)";
    } 
    // 系列 2: taskId 结尾为 388 (福利任务 9次)
    else if (body.indexOf("taskId=1218712929269776388") !== -1) {
        totalReplay = 8;
        taskName = "福利任务(系列2)";
    } 
    else {
        $.log("未匹配到已知任务 ID，跳过自动重放");
        return;
    }

    $.msg($.name, `识别到 ${taskName}`, `正在后台自动重放 ${totalReplay} 次，请稍候...`);
    $.log(`准备重放 ${totalReplay} 次`);

    // 为了安全，延迟 2 秒开始第一轮重放
    await sleep(2000);

    let successCount = 0;
    for (let i = 1; i <= totalReplay; i++) {
        // 随机间隔 3-6 秒，模拟人类真实操作频率
        const delay = Math.floor(Math.random() * 3000) + 3000;
        await sleep(delay);

        try {
            const response = await httpPost(url, headers, body);
            const resData = JSON.parse(response.body);
            
            if (resData.code === 0) {
                successCount++;
                $.log(`[${taskName}] 第 ${i} 次重放成功`);
            } else {
                $.log(`[${taskName}] 第 ${i} 次重放失败: ${resData.msg}`);
                // 如果服务器返回“重复”错误，提前终止防止风险
                if (resData.msg && resData.msg.indexOf("重复") !== -1) break;
            }
        } catch (e) {
            $.log(`请求异常: ${e}`);
        }
    }

    if (successCount > 0) {
        $.msg($.name, `✅ ${taskName} 重放完成`, `已成功在后台补全 ${successCount} 次任务。`);
    }
}

// ========== 工具函数 ==========
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function httpPost(url, headers, body) {
    return new Promise((resolve, reject) => {
        const opts = { url, method: "POST", headers, body };
        $task.fetch(opts).then(
            resp => resolve(resp),
            err => reject(err)
        );
    });
}

function Env(name) {
    this.name = name;
    this.log = (msg) => console.log(`[${this.name}] ${msg}`);
    this.msg = (title, sub, body) => $notify(title, sub, body);
}
