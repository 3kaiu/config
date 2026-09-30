"use strict";
/**
 * 智慧房东(施王物联)接入台账门禁 — test/cases/zhifu-fangdong.test.js
 *
 * 背景: 本 App 的取证结构与本仓其它单 App 插件**都不同**, 因此它的失效方式也不同:
 *   · 广告平台层证据是 **App 自家隐私政策的一手声明**(41 个 SDK / 22 个广告 SDK), 不是
 *     app-ads.txt 语料、也不是上游去广告规则 —— 没有任何社区配置可交叉验证。
 *   · 唯一处置面是 **SaaS 自营活动位**(运营侧「活动设置」CRUD 的 BANNER / POP_UP_BOX),
 *     判定"纯广告"靠的是"实体零业务字段", 而非"接口名字像广告"。
 *   · 响应体形状**未取证**(探针拿不到 token), 故只能整条转空, 不能字段级。
 * 于是本文件把四类静默失效固化:
 *   ① 自营活动位被漏掉或被误当成"业务接口"整条拒 → 白屏(京东 functionId=start 同源教训的反面:
 *      本仓已犯过"凭名字像广告就整条拒"的错, 也犯过"该拒的不拒");
 *   ② 把 `/core/web/activity/*`(后台管理 CRUD)或 `/core/app/activity/clickAdd`(写操作)
 *     也整条拒 —— 前者破运营后台, 后者无广告内容可拒;
 *   ③ 第三方广告 SDK 域被塞进本插件 —— 那是**跨 App 广告平台**, 归 L0 ad-block(模块纪律);
 *   ④ 解密面写成 `*.zhihuifangdong.net` 通配 → 官网/后台 SPA/开放平台文档全进证书信任面。
 *
 * 台账与 Plugin/zhifu-fangdong.plugin 的注释互为正本 —— 改一处不改另一处就判红。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const PLUGIN = path.join(ROOT, "Plugin", "zhifu-fangdong.plugin");
const TPL = path.join(ROOT, "template", "loon.tpl");

const text = fs.readFileSync(PLUGIN, "utf8");
const tpl = fs.readFileSync(TPL, "utf8");

/** 取某段的正条目(去注释与空行) */
const section = (name) => {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim() === `[${name}]`);
  if (i < 0) return [];
  const out = [];
  for (let k = i + 1; k < lines.length; k++) {
    if (/^\[[A-Za-z ]+\]\s*$/.test(lines[k])) break;
    out.push(lines[k]);
  }
  return out;
};

const rewrites = section("Rewrite").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const rules = section("Rule").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const mitm = section("MitM").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

/**
 * 处置台账 —— 与插件 [Rewrite] 逐条对应。
 *   mode reject = 纯广告实体(零业务字段) ⇒ reject_dict(200) 整条转空
 *   sources     同一处置的证据来源(一手声明 / 后台实体取证 / 端点探针), 不靠"看起来像"
 */
const LANDED = [
  {
    needle: "bannerPic",
    mode: "reject",
    sources: ["隐私政策SDK声明", "后台Advertisement实体零业务字段", "401 TOKEN_EMPTY 路由探针"],
  },
];

/**
 * 明确**不处置**的面 —— 必须不存在对应规则(防后人"顺手补一条"破功能)。
 * 每条给出**为什么不处置**, 而不是"暂不需要"。
 */
const NOT_HANDLED = [
  { needle: "clickAdd", why: "POST 写操作(广告点击上报), 响应无广告内容; 拦它是断上报不是去广告" },
  { needle: "/core/web/activity/", why: "后台运营侧活动 CRUD, 拦了破运营后台(本仓已犯过误拦功能面的错)" },
  { needle: "/standard/Advertisement/", why: "后台「活动设置」页面路由, 非数据接口" },
  { needle: "OnlinePromotion", why: "「线上推广/智租推广」是租户自费的房源推广功能, 属业务不是广告" },
  { needle: "promotionRecord", why: "同上, 推广记录台账" },
];

exports.tests = {
  "zhifu-fangdong: 台账处置逐条在 [Rewrite] 落地 (且 mode 与 Action 一致)": async (a) => {
    a.ok(rewrites.length >= LANDED.length, `[Rewrite] 正条目 ${rewrites.length} 条, 少于台账 ${LANDED.length} 条`);
    for (const row of LANDED) {
      const hit = rewrites.filter((l) => l.includes(row.needle));
      a.ok(hit.length > 0, `台账里的 ${row.needle} 在 [Rewrite] 无对应规则 (文档与规则脱节)`);
      for (const l of hit) {
        if (row.mode === "reject") {
          a.ok(/reject_dict\(200\)$/.test(l), `${row.needle} 判定为纯广告实体, 应整条 reject_dict(200); 实际: ${l}`);
        }
      }
    }
  },

  "zhifu-fangdong: 每条处置都留了证据来源 (不许只靠接口名像广告)": async (a) => {
    // AGENTS.md 反复强调的错: 凭域名字义/接口名字义加规则(du.jd.com / jzt.jd.com 两笔学费)。
    // 本 App 的判据是"运营实体零业务字段", 必须能在插件注释里找到该判据与一手声明出处。
    a.ok(/活动设置/.test(text) && /picType/.test(text), "未记录判据来源: 运营侧「活动设置」实体 + picType 字段");
    a.ok(/BANNER/.test(text) && /POP_UP_BOX/.test(text), "未记录两种展示形式(BANNER / POP_UP_BOX)—— 那是'一条规则同清两形态'的依据");
    a.ok(/零业务字段|没有一个业务字段/.test(text), "未写明'该实体零业务字段'—— 整条 reject 的前提就是这句");
    a.ok(/zhfd_privacy\.html/.test(text), "未记录一手声明的取证 URL(隐私政策是本 App 唯一的平台层证据)");
    a.ok(/41/.test(text) && /22/.test(text), "未记录一手声明的规模(41 个 SDK / 22 个广告 SDK)—— 数字是结论的可核对锚");
    a.ok(/TOKEN_EMPTY/.test(text), "未记录端点探针结果(401 TOKEN_EMPTY 证明路由通)—— 无它则端点是否存在无据");
  },

  "zhifu-fangdong: 不处置项必须真的没有规则 (防后人顺手补一条破功能)": async (a) => {
    for (const u of NOT_HANDLED) {
      const hit = rewrites.filter((l) => l.includes(u.needle));
      a.equal(
        hit.length,
        0,
        `${u.needle} 已被写进 [Rewrite] —— ${u.why}; 要落地须先取证并更新本台账`
      );
    }
  },

  "zhifu-fangdong: 第三方广告 SDK 域不得塞进本插件 (归 L0 ad-block 的模块纪律)": async (a) => {
    a.equal(rules.length, 0, `本插件不应有 [Rule] 域级条目(实为 ${rules.length} 条): ${rules.join(" | ")}`);
    // 域级 REJECT 只可能出现在 [Rule] 段 ⇒ 上面已断言为空; 这里守第二处泄漏面:
    // 有人把广告域写进 [MitM] 借解密面"顺手处理"(那既产生证书成本又不生效, 见 APP-ONBOARDING §3)。
    a.ok(!mitm.join(" ").includes("qttunion"), "趣盟端点域出现在 [MitM] —— 广告域归 L2 REJECT, 进解密面是净损失");
    // 反面锚点: 声明过的广告 SDK 里唯一的新增域落在 L0, 且已登记结构性排除
    const adblock = fs.readFileSync(path.join(ROOT, "Plugin", "ad-block.plugin"), "utf8");
    a.ok(/api\.qttunion\.com/.test(adblock), "趣盟端点域应由 L0 ad-block.plugin 承担(跨 App 广告平台), 未找到");
    const map = fs.readFileSync(path.join(ROOT, "tools", "lib", "ad-platform-map.mjs"), "utf8");
    a.ok(/root:\s*"qttunion\.com"/.test(map), "趣盟根域未登记进 OUT_OF_CORPUS_ROOTS —— 平台层门禁会判红(语料 0 声明)");
  },

  "zhifu-fangdong: 每条 Rewrite 必须带开关 (新语法无全局 enable=)": async (a) => {
    const missing = rewrites.filter((l) => !/\$\{ZHIFUFANGDONG_ENABLE\} == true/.test(l));
    a.equal(
      missing,
      [],
      `${missing.length} 条 [Rewrite] 漏写 \${ZHIFUFANGDONG_ENABLE} == true —— 新语法没有全局 enable=, 漏写等于该条永久打开:\n  ` +
        missing.join("\n  ")
    );
    const arg = section("Argument").filter((l) => l.trim() && !l.trim().startsWith("#"));
    a.ok(
      arg.some((l) => /^ZHIFUFANGDONG_ENABLE=switch,"true","false",/.test(l.trim())),
      '[Argument] 缺少 ZHIFUFANGDONG_ENABLE=switch,"true","false" (app-index 只认带引号形式)'
    );
  },

  "zhifu-fangdong: 解密面最小化 (只 api. 一条, 不通配, 且被规则消费)": async (a) => {
    a.equal(mitm.length, 1, "[MitM] 应恰好一条 hostname= 行");
    const hosts = mitm[0]
      .replace(/^hostname\s*=\s*%APPEND%\s*/, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    a.equal(hosts.length, 1, `解密面应只有 api.zhihuifangdong.net 一个 host, 实为: ${hosts.join(", ")}`);
    for (const h of hosts) {
      a.ok(!h.includes("*"), `解密面出现通配 ${h} —— 会把 20+ 同集群子域(官网/后台 SPA/开放平台文档)全拉进证书信任面`);
      const root = h.split(".").slice(-2).join(".");
      a.ok(
        rewrites.some((l) => l.includes(root.replace(".", "\\."))),
        `解密面 ${h} 没有任何 [Rewrite] 消费 (mitm-orphan 会判孤儿)`
      );
      // 反面: 整注册域或兄弟子域进解密面 = 把企业站/后台/文档站一起签上证书
      a.equal(h, "api.zhihuifangdong.net", `解密面只该有 api. 一个具体 host, 实为 ${h}`);
    }
  },

  "zhifu-fangdong: 已知未验证风险必须留档 (reject_dict 丢封套的后果与处置路径)": async (a) => {
    // reject_dict(200) 会丢响应封套的 code/success。本仓没有真机, 后果只能登记不能假装已解决。
    // 若后人静默删掉这段注释, 下一个维护者会以为这条规则"已验证没问题"。
    a.ok(/未经真机验证/.test(text), "未登记 reject_dict 的未验证风险");
    a.ok(/toast|错误提示/.test(text), "未写明该风险的可观测症状(首页偶发提示)");
    a.ok(/字段级/.test(text), "未给出风险发生时的处置方向(改字段级而非放行)");
  },

  "zhifu-fangdong: 必须登记进 template [Plugin] 段 (唯一分发渠道)": async (a) => {
    a.ok(
      /https:\/\/ws\.wenn\.in\/main\/Plugin\/zhifu-fangdong\.plugin,\s*enabled=true/.test(tpl),
      "插件未登记进 template/loon.tpl 的 [Plugin] 段 —— 用户导入 Loon.lcf 拿不到它(wiring-check 也会判红)"
    );
  },
};
