/**
 * rewrite-script-mutex-check 用例 (2026-09-30 官方《Script 新语法》互斥语义落地)。
 *
 * 官方语义 (nsloon.app/docs/Script/script_v2 "Rewrite 与 Script"):
 *   Request Body Rewrite/Mock 命中 → Request Script 不执行;
 *   Response Body Rewrite 命中 → Response Script 不执行;
 *   Request 阶段终止响应 → 两侧脚本均不执行。
 * 覆盖: v2/旧语法复写分类 (body/json/reject 族 suppressor, header 族不算)、
 * 旧/v2 脚本行分类与开关提取、R1 (无条件 suppressor × 同侧脚本)、
 * R2 (同开关共激活 + 前缀重叠)、仓库现状 (qidian 开关编排合法)。
 */
"use strict";

const path = require("path");
const { pathToFileURL } = require("url");

// 路径写成含 `tools/` 的字面量: wiring-check 按字面量检索 tools/*.mjs 有没有被引用,
// 若拆成 path.join(__dirname, "..", "..", "tools", "x.mjs") 则文件里只剩文件名 → 误判"死代码"。
const TOOL = pathToFileURL(path.join(__dirname, "..", "..", "tools/rewrite-script-mutex-check.mjs")).href;

exports.tests = {
    "classifyRewriteLine v2: json/reject 族判 suppressor, 开关条件被识别, header 族不算": async (a) => {
      const { classifyRewriteLine } = await import(TOOL);
      // 用普通字符串而非模板字面量: 保证 \/ 等转义与配置文件逐字一致。
      const v2Json = classifyRewriteLine(
        'response if ${CAPTURE_ENABLE} == true && ${url} ~= /https:\\/\\/magev6\\.if\\.qidian\\.com\\/argus\\/api\\/v1\\/client\\/getconf$/ then response.json.replace(["Data.WolfEye"], [0])'
      );
      a.ok(v2Json, "v2 json 行应解析为 suppressor (json 族按官方旧语法同名 body 家族从严归类)");
      a.equal(v2Json.side, "response", "v2 前缀决定作用侧");
      a.equal(v2Json.kills.join(","), "response", "json 改写吞同侧脚本");
      a.equal(v2Json.gated, true, "${CAPTURE_ENABLE} == true 是开关编排");
      a.equal(v2Json.switches.join(","), "CAPTURE_ENABLE");

      const v2Reject = classifyRewriteLine(
        "response if ${url} ~= /https:\\/\\/a\\.com\\/splash/ then reject_dict(200)"
      );
      a.ok(v2Reject, "v2 reject_dict 是 suppressor");
      a.equal(v2Reject.gated, false, "条件里没有参数比较 → 无条件");
      a.equal(v2Reject.kills.join(","), "response");

      const v2ReqRedirect = classifyRewriteLine(
        'request if ${url} ~= /https:\\/\\/a\\.com\\/x/ then redirect(302, "https://b.example.com")'
      );
      a.ok(v2ReqRedirect, "v2 redirect 是 suppressor");
      a.equal(v2ReqRedirect.kills.join(","), "request,response", "request 阶段终止响应: 两侧脚本全灭 (官方明文)");

      const header = classifyRewriteLine(
        'request if ${url} ~= /https:\\/\\/a\\.com\\// then request.header.set("X-A", "1")'
      );
      a.equal(header, null, "header 类复写不改 body/不终止, 不是 suppressor");
    },

    "classifyRewriteLine 旧语法: response-body-* 归 response 侧, reject/302 双杀, header 类不算": async (a) => {
      const { classifyRewriteLine } = await import(TOOL);
      const oldBody = classifyRewriteLine(
        '^https:\\/\\/a\\.com\\/x response-body-replace-regex "a" "b" enable={EN}'
      );
      a.ok(oldBody, "旧语法 response-body-replace-regex 是 suppressor");
      a.equal(oldBody.side, "response");
      a.equal(oldBody.kills.join(","), "response");
      a.equal(oldBody.gated, true, "enable={EN} 是开关编排");
      a.equal(oldBody.switches.join(","), "EN");

      a.equal(
        classifyRewriteLine("^https:\\/\\/a\\.com\\/y header-del Cookie"),
        null,
        "旧 header 类不是 suppressor"
      );

      const oldReject = classifyRewriteLine("^https:\\/\\/a\\.com\\/z reject-200");
      a.ok(oldReject, "旧 reject-200 是 suppressor");
      a.equal(oldReject.kills.join(","), "request,response", "旧 reject 在请求转发阶段终止 → 双杀");
      a.equal(oldReject.gated, false);

      const old302 = classifyRewriteLine("^https:\\/\\/a\\.com\\/w 302 https:\\/\\/b\\.example\\.com");
      a.ok(old302, "旧 302 应能解析为 suppressor");
      a.equal(old302.kills.join(","), "request,response");
    },

    "classifyScriptLine: 旧语法 enable={X} / v2 URL Guard 与 enable=${X} 都能提取, cron/generic 不参与": async (a) => {
      const { classifyScriptLine } = await import(TOOL);
      const jdLine = classifyScriptLine(
        "http-response ^https:\\/\\/api\\.m\\.jd\\.com\\/client\\.action script-path=https://ws.wenn.in/main/Scripts/jingdong.js, requires-body=true, timeout=10, enable={JINGDONG_ENABLE}"
      );
      a.ok(jdLine, "jd 旧语法脚本行");
      a.equal(jdLine.side, "response");
      a.equal(jdLine.switches.join(","), "JINGDONG_ENABLE");
      a.equal(jdLine.v2, false);

      const v2Script = classifyScriptLine(
        'response if ${url} ~= /\\/api\\/v1\\/user$/ && ${response.status} == 200 then script("a.js") with enable=${EN}, timeout=20'
      );
      a.ok(v2Script, "v2 script 行");
      a.equal(v2Script.side, "response");
      a.equal(v2Script.v2, true);
      a.ok(v2Script.regex && v2Script.regex.includes("api"), "URL Guard 正则被抽出");
      a.equal(v2Script.switches.join(","), "EN", "条件参数与 with enable= 参数都算编排开关");

      a.equal(classifyScriptLine("cron {CRONEXP} script-path=x.js, tag=t"), null, "cron 不参与互斥");
      a.equal(classifyScriptLine("# 注释"), null, "注释跳过");
    },

    "R1: 无条件 suppressing 复写 × 同侧脚本判红; 带开关编排放行": async (a) => {
      const { checkMutex } = await import(TOOL);
      const surfaces = [
        {
          file: "bad.plugin",
          text: "[Script]\nhttp-response ^https:\\/\\/a\\.com\\/api script-path=x.js, requires-body=true\n"
            + "[Rewrite]\nresponse if ${url} ~= /https:\\/\\/a\\.com\\/api/ then reject_dict(200)\n",
        },
        {
          file: "good.plugin",
          text: "[Script]\nhttp-response ^https:\\/\\/a\\.com\\/api script-path=x.js, requires-body=true\n"
            + "[Rewrite]\nresponse if ${EN} == true && ${url} ~= /https:\\/\\/a\\.com\\/api/ then reject_dict(200)\n",
        },
      ];
      const { fails } = checkMutex(surfaces);
      a.equal(fails.length, 1, "只判红无条件那条");
      a.equal(fails[0].rule, "R1");
      a.equal(fails[0].file, "bad.plugin");
    },

    "R2: 复写与脚本共用开关且 URL 前缀重叠判红; 开关不同放行": async (a) => {
      const { checkMutex } = await import(TOOL);
      const mk = (scriptSwitch) =>
        "[Script]\nhttp-response ^https:\\/\\/a\\.com\\/ads\\/v\\d script-path=x.js, enable={" + scriptSwitch + "}\n"
        + "[Rewrite]\nresponse if ${EN} == true && ${url} ~= /https:\\/\\/a\\.com\\/ads/ then reject_dict(200)\n";
      const surfaces = [
        { file: "same-switch.plugin", text: mk("EN") },
        { file: "diff-switch.plugin", text: mk("OTHER") },
      ];
      const { fails } = checkMutex(surfaces);
      a.equal(fails.length, 1, "只判红同开关共激活那条 (前缀: ads 是 ads\\/v\\d 的前缀)");
      a.equal(fails[0].rule, "R2");
      a.equal(fails[0].file, "same-switch.plugin");
    },

    "analyze(): 仓库现状全绿 — qidian 开关编排合法, 模板/jd/13 个 L2 插件无冲突": async (a) => {
      const { analyze } = await import(TOOL);
      const { fails, rows } = analyze();
      a.equal(fails.length, 0, "无确定性互斥冲突");
      const qd = rows.find((r) => r.file === "Plugin/qidian.plugin");
      a.ok(qd, "qidian 被扫描");
      a.ok(qd.rewrites >= 9, `qidian v2 复写应识别 ≥9 条, 实测 ${qd.rewrites}`);
      a.ok(qd.scripts >= 4, `qidian 脚本应识别 ≥4 条, 实测 ${qd.scripts}`);
      const tpl = rows.find((r) => r.file === "template/loon.tpl");
      a.ok(tpl && tpl.scripts === 0 && tpl.rewrites === 0, "模板 [Script] 不存在 / [Rewrite] 为空");
    },
};
