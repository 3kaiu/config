# ⚠️ 与 Loon.lcf [Rule] 同步维护
# 交通银行
DOMAIN, creditcard.bankcomm.com, REJECT
DOMAIN, creditcard.bankcomm.cn, REJECT
DOMAIN-SUFFIX, track.bankcomm.com, REJECT
# 农业银行
DOMAIN, midc.cdn-static.abchina.com.cn, REJECT
DOMAIN, enjoy.cdn-static.abchina.com, REJECT
DOMAIN, firefly.abchina.com.cn, REJECT
DOMAIN, msmp.abchina.com.cn, REJECT
# 中国银行
DOMAIN, cdn1.mbs.boc.cn, REJECT
# 云闪付
DOMAIN, ads.95516.com, REJECT
DOMAIN, switch.cup.com.cn, REJECT
DOMAIN, tysdk.95516.com, REJECT
DOMAIN, ads.cup.com.cn, REJECT
# 浦发 (lban 系为纯广告列表接口, Moli-X/ddgksf 双源印证; 模板 MitM 否决 spdb 系,
# Rewrite 层解密面存疑, DNS 层兜底 — Rule 无需解密故不受影响)
DOMAIN-SUFFIX, lban.spdb.com.cn, REJECT
# 广发 (static 广告素材 CDN + mps 营销推送, Moli-X 路径实证, DoH 存活)
DOMAIN-SUFFIX, static.95508.com, REJECT
DOMAIN-SUFFIX, mps.95508.com, REJECT
# 建行生活 (阿里 ad-log 网关, fmz200 同源; 纯日志上报)
DOMAIN-SUFFIX, o2o-ad-log-gateway.alibaba.com, REJECT
