/**
 * Loon 新语法 Rewrite 行 → 旧语法 逆向转换（兼容 Loon 3.5.0 及以下）
 *
 * 与 rewriteConverter.mjs（旧→新）互逆，用于将 v8.0 迁移后的配置回退为
 * 旧语法，使老版本 Loon 可正常解析：
 *
 *   request  if ${url} ~= /^pat/i && ${ARG} == true then reject_dict(200)
 *     → ^pat reject-dict enable={ARG}
 *
 *   response if ${url} ~= /(x).+/i as urlMatch then redirect(302, "https://h/${urlMatch.1}")
 *     → ^(x).+ 302 https://h/$1
 *
 *   response if ${url} ~= /^pat/i then response.json.jq(".data = {}")
 *     → ^pat response-body-json-jq '.data = {}'
 *
 * 非新语法行（旧语法行、注释、脚本行）原样保留。
 */
const ACTION_TABLE = [
  {
    name: 'reject',
    map: (args) => {
      const status = args[0]?.value;
      if (status === '200') {
        return {tokens: ['reject-200'], consumed: 1};
      }
      return {tokens: ['reject'], consumed: 1};
    },
  },
  {
    name: 'reject_img',
    map: (args) => ({tokens: ['reject-img'], consumed: args.length}),
  },
  {
    name: 'reject_dict',
    map: (args) => ({tokens: ['reject-dict'], consumed: args.length}),
  },
  {
    name: 'reject_array',
    map: (args) => ({tokens: ['reject-array'], consumed: args.length}),
  },
  {
    name: 'reject_video',
    map: (args) => ({tokens: ['reject-video'], consumed: args.length}),
  },
  {
    name: 'redirect',
    map: (args) => {
      const code = args[0];
      const url = args[1];
      return {tokens: [code, url], consumed: 2};
    },
  },
  {
    name: 'url.replace',
    map: (args) => ({tokens: ['header', args[0]], consumed: 1}),
  },
  {
    name: 'request.header.add',
    map: (args) => ({tokens: ['header-add', args[0], args[1]], consumed: 2}),
  },
  {
    name: 'request.header.set',
    map: (args) => ({tokens: ['header-replace', args[0], args[1]], consumed: 2}),
  },
  {
    name: 'request.header.del',
    map: (args) => ({tokens: ['header-del', args[0]], consumed: 1}),
  },
  {
    name: 'request.header.replace',
    map: (args) => ({tokens: ['header-replace-regex', args[0], args[1], args[2]], consumed: 3}),
  },
  {
    name: 'response.header.add',
    map: (args) => ({tokens: ['response-header-add', args[0], args[1]], consumed: 2}),
  },
  {
    name: 'response.header.set',
    map: (args) => ({tokens: ['response-header-replace', args[0], args[1]], consumed: 2}),
  },
  {
    name: 'response.header.del',
    map: (args) => ({tokens: ['response-header-del', args[0]], consumed: 1}),
  },
  {
    name: 'response.header.replace',
    map: (args) => ({tokens: ['response-header-replace-regex', args[0], args[1], args[2]], consumed: 3}),
  },
  {
    name: 'request.body.replace',
    map: (args) => ({tokens: ['request-body-replace-regex', args[0], args[1]], consumed: 2}),
  },
  {
    name: 'response.body.replace',
    map: (args) => ({tokens: ['response-body-replace-regex', args[0], args[1]], consumed: 2}),
  },
  {
    name: 'request.json.add',
    map: (args) => ({tokens: ['request-body-json-add', args[0], args[1]], consumed: 2}),
  },
  {
    name: 'request.json.replace',
    map: (args) => ({tokens: ['request-body-json-replace', args[0], args[1]], consumed: 2}),
  },
  {
    name: 'request.json.delete',
    map: (args) => ({tokens: ['request-body-json-del', args[0]], consumed: 1}),
  },
  {
    name: 'response.json.add',
    map: (args) => ({tokens: ['response-body-json-add', args[0], args[1]], consumed: 2}),
  },
  {
    name: 'response.json.replace',
    map: (args) => ({tokens: ['response-body-json-replace', args[0], args[1]], consumed: 2}),
  },
  {
    name: 'response.json.delete',
    map: (args) => ({tokens: ['response-body-json-del', args[0]], consumed: 1}),
  },
  {
    name: 'request.json.jq',
    map: (args) => ({tokens: ['request-body-json-jq', `'${args[0].value}'`], consumed: 1}),
  },
  {
    name: 'response.json.jq',
    map: (args) => ({tokens: ['response-body-json-jq', `'${args[0].value}'`], consumed: 1}),
  },
  {
    name: 'request.body.mock',
    map: (args) => {
      const tokens = [`data-type=${args[0].value}`, `data=${args[1].value}`];
      if (args[2] !== undefined) {
        tokens.push(`status-code=${args[2].value}`);
      }
      if (args[3] !== undefined) {
        tokens.push(`mock-data-is-base64=${args[3].value}`);
      }
      return {tokens, consumed: args.length};
    },
  },
  {
    name: 'response.body.mock',
    map: (args) => {
      const tokens = [`data-type=${args[0].value}`, `data=${args[1].value}`];
      if (args[2] !== undefined) {
        tokens.push(`status-code=${args[2].value}`);
      }
      if (args[3] !== undefined) {
        tokens.push(`mock-data-is-base64=${args[3].value}`);
      }
      return {tokens, consumed: args.length};
    },
  },
  {
    name: 'request.body.mock_file',
    map: (args) => {
      const tokens = [`data-type=${args[0].value}`, `data-path=${args[1].value}`];
      if (args[2] !== undefined) {
        tokens.push(`status-code=${args[2].value}`);
      }
      return {tokens, consumed: args.length};
    },
  },
  {
    name: 'response.body.mock_file',
    map: (args) => {
      const tokens = [`data-type=${args[0].value}`, `data-path=${args[1].value}`];
      if (args[2] !== undefined) {
        tokens.push(`status-code=${args[2].value}`);
      }
      return {tokens, consumed: args.length};
    },
  },
];

function splitArgs(raw) {
  const parts = [];
  let cur = '';
  let quote = null;
  let escape = false;
  for (const ch of raw) {
    if (escape) {
      cur += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      cur += ch;
      escape = true;
      continue;
    }
    if (quote) {
      cur += ch;
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      cur += ch;
      quote = ch;
      continue;
    }
    if (ch === ',') {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur.trim());
  return parts.filter((p) => p.length > 0);
}

function parseArg(raw) {
  const token = raw.trim();
  if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
    return {kind: 'str', value: JSON.parse(token)};
  }
  if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
    return {kind: 'str', value: token.slice(1, -1).replace(/``/g, '`')};
  }
  if (/^\/.*\/[a-z]*$/s.test(token)) {
    return {kind: 'raw', value: token};
  }
  if (/^(true|false|\d+(?:\.\d+)?)$/.test(token)) {
    return {kind: 'raw', value: token};
  }
  throw new Error(`无法解析参数: ${token}`);
}

function replaceCaptures(value) {
  return value.replace(/\$\{(\w+)\.(\d+)\}/g, '$$$2');
}

function formatArg(arg) {
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg.kind === 'str') {
    const value = replaceCaptures(arg.value);
    return /\s/.test(value) ? `"${value}"` : value;
  }
  return replaceCaptures(arg.value);
}

function revertAction(action) {
  const match = action.match(/^([\w.]+)\((.*)\)$/s);
  if (!match) {
    throw new Error(`无法解析动作: ${action}`);
  }
  const [, name, argsRaw] = match;
  const entry = ACTION_TABLE.find((item) => item.name === name);
  if (!entry) {
    throw new Error(`未知动作: ${name}`);
  }
  const args = splitArgs(argsRaw).map(parseArg);
  const {tokens, consumed} = entry.map(args);
  if (args.length !== consumed) {
    throw new Error(`${name}: 参数数量不符（${args.length} != ${consumed}）`);
  }
  return tokens.map(formatArg).join(' ');
}

function revertLine(line) {
  const match = line.match(
    /^(request|response) if \$\{url\} ~= (\S+?)(?: as (\w+))?((?: && \$\{\w+\} == (?:true|false))*?)\s+then\s+(.+)$/,
  );
  if (!match) {
    throw new Error('无法解析新语法行');
  }
  const [, , regexToken, , conditionsRaw, actionsRaw] = match;

  const closingSlash = regexToken.lastIndexOf('/');
  if (closingSlash <= 0) {
    throw new Error(`无法解析正则: ${regexToken}`);
  }
  const pattern = regexToken.slice(1, closingSlash);

  const conditions = [];
  const conditionRe = /&& \$\{(\w+)\} == (true|false)/g;
  let conditionMatch;
  while ((conditionMatch = conditionRe.exec(conditionsRaw))) {
    conditions.push(conditionMatch[2] === 'false' ? `!{${conditionMatch[1]}}` : `{${conditionMatch[1]}}`);
  }

  const actions = actionsRaw.split(/\s\|\s/);
  const tokens = [pattern, ...actions.map(revertAction)];
  if (conditions.length > 0) {
    tokens.push(`enable=${conditions.join('&')}`);
  }
  return tokens.join(' ');
}

export function convertNewRewrite(source) {
  const lines = source.split('\n');
  let inRewrite = false;
  const stats = {converted: 0, failed: 0};
  const issues = [];
  const output = [];

  lines.forEach((raw, index) => {
    if (/^\s*\[[^\]]+\]\s*$/.test(raw)) {
      inRewrite = /^\s*\[rewrite\]\s*$/i.test(raw);
    }
    if (!inRewrite || !/^(request|response)\s+if\s+/.test(raw.trim())) {
      output.push(raw);
      return;
    }
    try {
      output.push(revertLine(raw.trim()));
      stats.converted += 1;
    } catch (error) {
      output.push(raw);
      stats.failed += 1;
      issues.push({line: index + 1, message: error.message});
    }
  });

  return {output: output.join('\n'), stats, issues};
}
