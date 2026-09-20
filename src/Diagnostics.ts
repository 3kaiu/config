/**
 * 诊断助手 (generic — App 内手动触发) — 2026-09-19 官方文档对齐 (P2-1)。
 *
 * 官方语义 (nsloon.app/docs/Script/ → generic): "在 App 中手动触发, 可将节点、策略组
 * 或规则作为上下文传给脚本"。上下文经 `$environment.params` 注入 (官方 generic_example.js:
 * `params.node` 节点名 / `params.nodeInfo` build 411+ 提供 address/name/port/tls/type),
 * 结果经 `$done({title, htmlMessage})` 以富文本回显; 请求可**钉在指定节点**上
 * (`$httpClient.get({url, node}, cb)`)。
 *
 * 本脚本零常驻影响 (无 [Rule]/[Rewrite]/[MitM] 段), 点一次跑一次:
 *   1. 代理链路探活: 请求 cp.cloudflare.com/generate_204, 记状态码 + 耗时
 *      (有节点上下文时钉在该节点上 — 直接验证"这个节点能不能用")
 *   2. 直连链路探活: 请求 www.baidu.com (命中 China→DIRECT), 记状态码 + 耗时
 *   3. 判定: 双通 = 链路正常; 仅直连通 = 代理侧故障; 仅代理通 = 直连侧/规则异常;
 *      双不通 = 本机断网或 Loon 未启用
 * 排障价值: 用户报障时点一下, 把"要日志"变成"贴结果"。
 */

type ProbeResult = { label: string; ok: boolean; code: number | string; ms: number; err?: string };

const PROXY_PROBE = 'http://cp.cloudflare.com/generate_204';
const DIRECT_PROBE = 'http://www.baidu.com';
const PROBE_FALLBACK_MS = 8000;

function envParams(): any {
  try {
    return ($environment && ($environment as any).params) || {};
  } catch (e) {
    return {};
  }
}

function envLabel(): string {
  try {
    const env: any = $environment || {};
    let s = env.surgeVersion || '';
    if (env.buildVersion) s += ' (build ' + env.buildVersion + ')';
    return s;
  } catch (e) {
    return '';
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function probe(label: string, url: string, node?: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let settled = false;
    const finish = (r: ProbeResult) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    // 兜底超时: 回调若丢失 (网络栈异常), 报告不能把 UI 挂死
    setTimeout(() => finish({ label, ok: false, code: 'timeout', ms: Date.now() - t0 }), PROBE_FALLBACK_MS);
    try {
      const opt: any = { url };
      if (node) opt.node = node;
      ($httpClient as any).get(opt, (err: any, resp: any, _data: any) => {
        const ms = Date.now() - t0;
        if (err) {
          finish({ label, ok: false, code: 'ERR', ms, err: String(err).slice(0, 60) });
          return;
        }
        const code = (resp && resp.status) || 0;
        finish({ label, ok: code >= 200 && code < 400, code, ms });
      });
    } catch (e) {
      finish({ label, ok: false, code: 'EXC', ms: Date.now() - t0, err: String(e).slice(0, 60) });
    }
  });
}

const ctx: any = envParams();
const node: string = ctx.node || ctx.nodeName || '';
const nodeInfo: any = ctx.nodeInfo || {};

Promise.all([probe('代理链路', PROXY_PROBE, node || undefined), probe('直连链路', DIRECT_PROBE)]).then(
  (rs) => {
    const proxy = rs[0];
    const direct = rs[1];
    let verdict: string;
    if (proxy.ok && direct.ok) verdict = '✅ 双链路正常';
    else if (!proxy.ok && direct.ok) verdict = '❌ 代理链路故障 (节点/订阅问题), 直连正常';
    else if (proxy.ok && !direct.ok) verdict = '⚠️ 代理通 / 直连异常 (检查直连规则或本机网络)';
    else verdict = '🛑 双链路不通 (本机断网或 Loon 未启用)';

    const row = (r: ProbeResult) =>
      `<b>${escapeHtml(r.label)}</b>: ${r.ok ? '✅' : '❌'} ${escapeHtml(String(r.code))} · ${r.ms}ms${r.err ? ' · ' + escapeHtml(r.err) : ''}`;
    const meta: string[] = [];
    if (node) meta.push(`节点: ${escapeHtml(node)}`);
    if (nodeInfo.type || nodeInfo.address) {
      const addr = [nodeInfo.address, nodeInfo.port].filter(Boolean).join(':');
      meta.push(`节点信息: ${escapeHtml([nodeInfo.type, addr].filter(Boolean).join(' · '))}`);
    }
    const ver = envLabel();
    if (ver) meta.push(`环境: ${escapeHtml(ver)}`);

    const html =
      `<p style="text-align:center;font-family:-apple-system;font-size:large;font-weight:bold">${verdict}</p>` +
      `<p style="font-family:-apple-system;font-size:medium">${row(proxy)}<br/>${row(direct)}</p>` +
      (meta.length ? `<p style="font-family:-apple-system;font-size:small">${meta.join('<br/>')}</p>` : '');

    $done({ title: '🩺 链路诊断', htmlMessage: html });
  },
  () => {
    // 理论上不可达 (probe 永不 reject); 仍兜底, 保证 $done 恰好一次
    $done({ title: '🩺 链路诊断', htmlMessage: '<p>诊断未完成</p>' });
  }
);
