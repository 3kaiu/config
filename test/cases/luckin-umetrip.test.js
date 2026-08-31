/**
 * 瑞幸咖啡 (AES-128-ECB 加密报文净化) / 航旅纵横 (protobuf 字节级净化) 回归测试
 * 样本由脚本自身 module.exports 的 encrypt/parse/encode 往返构造
 */
"use strict";

const LK = require("../../Scripts/Luckin.js");
const UM = require("../../Scripts/Umetrip.js");

const LKU = "https://capi.lkcoffee.com";

// ── Luckin 辅助: 加密样本 → 跑脚本 → 解密结果 ──
async function runLuckin(h, url, payload) {
  const enc = LK.encryptBody(JSON.stringify(payload));
  const sb = h.createSandbox({ request: { url }, response: { status: 200, body: enc } });
  const s = await h.runScript("Scripts/Luckin.js", sb);
  return { state: s, out: JSON.parse(LK.decryptBody(s.doneCalls[0].body)) };
}

// ── Umetrip protobuf 构造辅助 ──
const varint = (n) => { const o = []; while (n >= 128) { o.push(n % 128 | 128); n = Math.floor(n / 128); } o.push(n); return o; };
const fld = (num, wire, data) => [...varint(num * 8 + wire), ...varint(data.length), ...data];
const fld0 = (num, val) => [...varint(num * 8), ...varint(val)]; // wire0 varint 无长度前缀
const fldU = (num, s) => fld(num, 2, [...Buffer.from(s, "utf8")]);
const jsonFld = (num, obj) => fld(num, 2, [...Buffer.from(JSON.stringify(obj), "utf8")]);

async function runUmetrip(h, bytes, rpid) {
  const sb = h.createSandbox({
    request: { url: "https://appmsg.umetrip.com/gateway/api/umetrip/native", headers: rpid ? { rpid } : {} },
    response: { status: 200, bodyBytes: Uint8Array.from(bytes).buffer },
  });
  const s = await h.runScript("Scripts/Umetrip.js", sb);
  return s.doneCalls[0];
}
const outBytes = (done) => (done.bodyBytes ? [...new Uint8Array(done.bodyBytes)] : null);

exports.tests = {
  // ══ Luckin ══
  "luckin: encrypt/decrypt 与上游编码约定往返一致 (base64url 含填充)": async (a) => {
    const plain = JSON.stringify({ code: 200, msg: "成功☕", content: { list: [1, 2] } });
    const enc = LK.encryptBody(plain);
    a.ok(/^[A-Za-z0-9\-_]+={0,2}$/.test(enc), "应为 base64url 字符集");
    a.equal(LK.decryptBody(enc), plain, "往返应还原");
  },
  "luckin: config/value — banner 双开关置 0, ios.flash flashSwitch=false": async (a, h) => {
    const { out } = await runLuckin(h, LKU + "/resource/m/sys/config/value", {
      content: {
        "luckyfe.luckincoffee.banner.config": '{"flashSwitch":1,"personal_middlebanner_scrollbroadcast_switch":1,"x":1}',
        "luckyfe.luckincoffee.ios.flash.config": '{"flashSwitch":true,"y":2}',
        "other": "not json {",
      },
    });
    const banner = JSON.parse(out.content["luckyfe.luckincoffee.banner.config"]);
    a.equal(banner.personal_middlebanner_scrollbroadcast_switch, 0, "personal 开关应置 0");
    a.equal(banner.home_middlebanner_scrollbroadcast_switch, 0, "home_middlebanner 应置 0");
    a.equal(banner.x, 1, "无关字段保留");
    const ios = JSON.parse(out.content["luckyfe.luckincoffee.ios.flash.config"]);
    a.equal(ios.flashSwitch, false, "ios flashSwitch 应为 false");
    a.equal(out.content.other, "not json {", "非 JSON 配置原样保留");
  },
  "luckin: common/modules — F104 清空, F101 过滤 F101001/F101005 且 F101003 去福利中心": async (a, h) => {
    const f104 = await runLuckin(h, LKU + "/resource/m/sys/common/modules", { content: { positionCode: "F104", tacticList: [{ a: 1 }] } });
    a.equal(f104.out.content.tacticList, [], "F104 tacticList 应清空");
    const f101 = await runLuckin(h, LKU + "/resource/m/sys/common/modules", {
      content: {
        positionCode: "F101",
        tacticList: [
          { positionCode: "F101001" },
          { positionCode: "F101005" },
          { positionCode: "F101003", moduleInfos: [{ moduleTitle: "福利中心" }, { moduleTitle: "签到" }] },
          { positionCode: "F101002" },
        ],
      },
    });
    const list = f101.out.content.tacticList;
    a.equal(list.length, 2, "F101001/F101005 应被过滤");
    a.equal(list[0].moduleInfos.length, 1, "F101003 福利中心 moduleInfo 应被过滤");
    a.equal(list[0].moduleInfos[0].moduleTitle, "签到", "正常 moduleInfo 保留");
  },
  "luckin: homePage/common/modules tacticList 清空 + adposNew/visual content 清空": async (a, h) => {
    const home = await runLuckin(h, LKU + "/resource/m/sys/homePage/common/modules", { content: { tacticList: [{ a: 1 }], keep: 1 } });
    a.equal(home.out.content.tacticList, [], "homePage tacticList 应清空");
    a.equal(home.out.content.keep, 1, "其他字段保留");
    const adpos = await runLuckin(h, LKU + "/resource/m/sys/app/adposNew", { content: [1, 2] });
    a.equal(adpos.out.content, [], "adposNew content 应清空");
    const visual = await runLuckin(h, LKU + "/resource/m/sys/visual/effect/modules", { content: [1] });
    a.equal(visual.out.content, [], "visual/effect content 应清空");
  },
  "luckin: myPageSectionShow/newUI 按 title 黑名单过滤": async (a, h) => {
    const { out } = await runLuckin(h, LKU + "/resource/m/sys/base/myPageSectionShow/newUI", {
      content: [{ title: "招商加盟" }, { title: "企业充赠" }, { title: "优惠联盟" }, { title: "我的钱包" }],
    });
    a.equal(out.content.length, 1, "应只剩 1 项");
    a.equal(out.content[0].title, "我的钱包", "正常入口保留");
  },
  "luckin: contactor 弹窗/tactic 清空 + carousel imgUrl/notifyInfos 清空": async (a, h) => {
    const contactor = await runLuckin(h, LKU + "/resource/m/sys/homePage/contactor/modules", {
      content: { isPop: 1, popupLinkUrl: "https://ad", tactic: { moduleInfos: [1], link: "l", headPic: "h" } },
    });
    a.equal(contactor.out.content.isPop, 0, "isPop 应置 0");
    a.equal(contactor.out.content.popupLinkUrl, "", "popupLinkUrl 应清空");
    a.equal(contactor.out.content.tactic.moduleInfos, [], "tactic.moduleInfos 应清空");
    a.equal(contactor.out.content.tactic.headPic, "", "tactic.headPic 应清空");
    const carousel = await runLuckin(h, LKU + "/resource/m/sys/app/carousel", { content: { mainVisualPic: "m", notifyInfos: [1] } });
    a.equal(carousel.out.content.imgUrl, "", "carousel imgUrl 应清空");
    a.equal(carousel.out.content.notifyInfos, [], "notifyInfos 应清空");
  },
  "luckin: aigc AI 入口字段清空 + seckill AR 字段置空": async (a, h) => {
    const aigc = await runLuckin(h, LKU + "/resource/m/aigc/showAIButton", {
      content: { bubbleData: {}, bubbleScheme: {}, bubbleType: 1, iconUrl: "i", showButton: true, showAISearch: true, headPic: "KEEP" },
    });
    a.equal(aigc.out.content.bubbleData, null, "bubbleData 应置 null");
    a.equal(aigc.out.content.showButton, false, "showButton 应为 false");
    a.equal(aigc.out.content.iconUrl, "", "iconUrl 应清空");
    a.equal(aigc.out.content.headPic, "KEEP", "headPic 不在清洗清单, 应保留");
    const seckill = await runLuckin(h, LKU + "/resource/seckill/ar/campaignBaseInfo", {
      content: { status: 3, arBtnPic: "a", arIcon: "b", wxShareTitle: "w", iconUrl: "KEEP" },
    });
    a.equal(seckill.out.content.status, 0, "status 应置 0");
    a.equal(seckill.out.content.arBtnPic, "", "arBtnPic 应清空");
    a.equal(seckill.out.content.wxShareTitle, "", "wxShareTitle 应清空");
    a.equal(seckill.out.content.iconUrl, "KEEP", "iconUrl 不在清洗清单, 应保留");
  },
  "luckin: 非法密文/坏 padding → 原样返回原始 body": async (a, h) => {
    for (const bad of ["!!!not-base64!!!", "QUJDQUJDQUJDQUJDQUJDQUJDQUJD"]) {
      const sb = h.createSandbox({ request: { url: LKU + "/resource/m/sys/app/adposNew" }, response: { status: 200, body: bad } });
      const s = await h.runScript("Scripts/Luckin.js", sb);
      a.equal(s.doneCalls[0].body, bad, "出错应原样返回原始 body");
    }
  },

  // ══ Umetrip ══
  "umetrip: EMPTY_RPIDS 顶层 field7 替换为 EMPTY_PAYLOAD": async (a, h) => {
    const done = await runUmetrip(h, [...fld0(1, 1), ...fld(7, 2, [9, 9, 9])], "1000019");
    const bytes = outBytes(done);
    a.ok(bytes, "应有改写输出");
    const fields = UM.parseMessage(Uint8Array.from(bytes));
    const f7 = fields.find((f) => f.field === 7);
    a.equal([...f7.data], [...UM.EMPTY_PAYLOAD], "field7 应替换为 EMPTY_PAYLOAD");
    a.ok(fields.some((f) => f.field === 1), "其他字段保留");
  },
  "umetrip: 瀑布流 (1000029) 移除命中关键词的 field8 节点": async (a, h) => {
    const done = await runUmetrip(h, [...fld(7, 2, fldU(8, "瀑布流_酒店")), ...fld(7, 2, fldU(8, "正常卡片"))], "1000029");
    const bytes = outBytes(done);
    a.ok(bytes, "应有改写输出");
    const top = UM.parseMessage(Uint8Array.from(bytes));
    const f7s = top.filter((f) => f.field === 7);
    a.equal(f7s.length, 2, "field7 外壳保留 (清内层节点)");
    a.equal(UM.parseMessage(f7s[0].data).length, 0, "命中关键词的 field8 移除后内层应为空报文");
    a.includes(Buffer.from(f7s[1].data).toString("utf8"), "正常卡片", "正常卡片保留");
  },
  "umetrip: 首页 (1000002) field5 ADVERT 子节点移除": async (a, h) => {
    const done = await runUmetrip(h, fld(7, 2, fld(5, 2, fldU(37, "ADVERT"))), "1000002");
    const bytes = outBytes(done);
    a.ok(bytes, "ADVERT 节点应被移除产生输出");
    const top = UM.parseMessage(Uint8Array.from(bytes));
    const f7 = top.find((f) => f.field === 7);
    a.ok(f7, "field7 外壳保留");
    a.equal(UM.parseMessage(f7.data).length, 0, "field7 内 ADVERT 节点应被清空");
  },
  "umetrip: 我的 (1100001) JSON groupId=111403 PRODUCT 卡片过滤并刷新 childrenIndex": async (a, h) => {
    const payload = {
      groupId: 111403,
      children: [{ cardType: "PRODUCT", cardId: 9 }, { cardType: "NORMAL", cardId: 8 }],
      childrenIndex: { "9": 0, "8": 1 },
    };
    // 真实报文结构: field7 为子报文, 其 field1 承载 JSON 字符串
    const done = await runUmetrip(h, fld(7, 2, jsonFld(1, payload)), "1100001");
    const bytes = outBytes(done);
    a.ok(bytes, "应有改写输出");
    const top = UM.parseMessage(Uint8Array.from(bytes));
    const inner = UM.parseMessage(top.find((f) => f.field === 7).data);
    const obj = JSON.parse(Buffer.from(inner.find((f) => f.field === 1).data).toString("utf8"));
    a.equal(obj.children.length, 1, "PRODUCT 卡片应被过滤");
    a.equal(obj.children[0].cardId, 8, "普通卡片保留");
    a.equal(obj.childrenIndex, { "8": 0 }, "childrenIndex 应刷新");
  },
  "umetrip: 家庭守护 (1370279) 试用+守护双命中时成对移除": async (a, h) => {
    const bytes = fld(7, 2, [...fldU(1, "可免费试用30天 付费会员"), ...fldU(2, "添加家人并开启守护 付费会员"), ...fldU(3, "keep")]);
    const done = await runUmetrip(h, bytes, "1370279");
    const out = outBytes(done);
    a.ok(out, "双命中应产生改写输出");
    const inner = UM.parseMessage(UM.parseMessage(Uint8Array.from(out)).find((f) => f.field === 7).data);
    a.equal(inner.length, 1, "应只剩 keep 字段");
    a.equal(inner[0].field, 3, "保留 field3");
  },
  "umetrip: 未知 rpid 原样放行 ($done 无参)": async (a, h) => {
    const done = await runUmetrip(h, fld(7, 2, fldU(8, "瀑布流_酒店")), "9999999");
    a.equal(done.bodyBytes, undefined, "未知 rpid 不应改写");
  },
  "umetrip: 无 rpid 头时回退 protobuf field5 分发": async (a, h) => {
    const done = await runUmetrip(h, [...fldU(5, "1060060"), ...fld(7, 2, fldU(12, "付费会员"))], null);
    a.ok(outBytes(done), "field5=1060060 应触发航班清洗");
  },
  "umetrip: 无 bodyBytes 时直接放行": async (a, h) => {
    const sb = h.createSandbox({
      request: { url: "https://sns.umetrip.com/gateway/api/umetrip/native", headers: { rpid: "1000019" } },
      response: { status: 200 },
    });
    const s = await h.runScript("Scripts/Umetrip.js", sb);
    a.equal(s.doneCalls[0].bodyBytes, undefined, "无 bodyBytes 应原样放行");
  },
};
