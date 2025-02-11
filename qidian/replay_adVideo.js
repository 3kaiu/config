// 定义一个全局计数器
let replayCount = 0;

// 重放请求函数
function replayRequest(request) {
    // 检查是否已经重放 7 次
    if (replayCount >= 7) {
        console.log("重放 7 次已完成，结束重放。");
        $done();
        return;
    }

    // 标记重放的请求，防止其进入重写规则
    request.headers["X-Replayed"] = "true";

    // 发送重放请求
    $task.fetch({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
    }).then(response => {
        // 处理响应
        console.log(`重放次数: ${replayCount + 1}, Response:`, response);
        replayCount++;

        // 使用 setTimeout 避免递归调用导致的栈溢出
        setTimeout(() => replayRequest(request), 0);
    }, error => {
        // 处理错误
        console.error("重放失败:", error);
        $done();
    });
}

// 主函数
function main() {
    // 获取原始请求
    let request = $request;

    // 检查是否是重放请求（通过自定义请求头）
    if (request.headers["X-Replayed"] === "true") {
        console.log("当前请求为重放请求，跳过重写规则。");
        $done();
        return;
    }

    // 如果是第一次请求，开始重放
    console.log("捕获到第一次请求，开始重放。");
    replayRequest(request);
}

// 广告信息获取逻辑
const $ = new Env("起点读书");

!(async () => {
    console.log($request, "特殊🤔🤔");
    main(); // 调用重放逻辑
})()
    .catch((e) => $.logErr(e))
    .finally(() => $.done());

// Env 类（简化版）
function Env(t) {
    return new class {
        constructor(t) {
            this.name = t;
        }
        getdata(t) {
            return $prefs.valueForKey(t);
        }
        setdata(t, s) {
            return $prefs.setValueForKey(t, s);
        }
        log(...t) {
            console.log(...t);
        }
        msg(t, s, e) {
            $notify(t, s, e);
        }
        logErr(t) {
            console.error(t);
        }
        done() {
            $done();
        }
    }(t);
}
