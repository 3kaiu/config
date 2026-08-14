export interface EnvInstance {
  name: string
  isL: boolean
  log(...args: unknown[]): void
  wait(ms: number): Promise<void>
  done(result?: { body?: string; headers?: Record<string, string>; status?: number }): void
  get(key: string): string | undefined
  set(value: string | Record<string, unknown>, key: string): void
  fetch(options: { url: string; method?: string; headers?: Record<string, string>; body?: string; timeout?: number }): Promise<{ statusCode?: number; status?: number; headers?: Record<string, string>; body?: string }>
  notify(title: string, subtitle: string, body: string): void
  barkPush(title: string, body: string): Promise<void>
  telegramPush(title: string, body: string): Promise<void>
  doNotify(title: string, body: string): Promise<PromiseSettledResult<unknown>[]>
}

export function Env(this: EnvInstance, n: string) {
  this.name = n;
  this.isL = typeof $loon !== "undefined";
  this.log = (...a: unknown[]) => console.log(`[${this.name}] ` + a.join(" "));
  this.wait = (m: number) => new Promise(r => setTimeout(r, m));
  this.done = (o = {}) => $done(o);
  this.get = (k: string) => {
    const v = $persistentStore.read(k);
    try { return v === undefined ? undefined : JSON.parse(v); } catch { return v; }
  };
  this.set = (v: string | Record<string, unknown>, k: string) => {
    const s = typeof v === "object" ? JSON.stringify(v) : v;
    $persistentStore.write(s, k);
  };
  this.fetch = async (o) => new Promise((resolve, reject) => {
    const m = (o.method || "GET").toLowerCase();
    $httpClient[m](o, (err, res, b) => {
      if (err) reject(err);
      else {
        res.body = b;
        if (res.statusCode === undefined) {
          res.statusCode = res.status !== undefined ? res.status : (res.response ? res.response.statusCode : 200);
        }
        resolve(res);
      }
    });
  });
  this.barkPush = (title: string, body: string) => {
    const key = this.get("Bark_Key") || this.get("barkKey");
    if (!key) return Promise.resolve();
    return this.fetch({
      url: `https://api.day.app/${key}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`,
      method: "GET"
    }).then(() => {}).catch(() => {});
  };
  this.telegramPush = (title: string, body: string) => {
    const token = this.get("TG_BOT_TOKEN") || this.get("tgToken");
    const chatId = this.get("TG_USER_ID") || this.get("tgChatId");
    if (!token || !chatId) return Promise.resolve();
    return this.fetch({
      url: `https://api.telegram.org/bot${token}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: String(chatId), text: `${title}\n${body}` })
    }).then(() => {}).catch(() => {});
  };
  this.notify = (t: string, s: string, b: string) => {
    $notification.post(t, s, b);
  };
  this.doNotify = (title: string, body: string) => {
    this.notify(title, "", body);
    const pushes: Promise<unknown>[] = [this.barkPush(title, body), this.telegramPush(title, body)];
    const pushplusToken = this.get("PUSHPLUS_TOKEN") || this.get("pushplusToken");
    if (pushplusToken) {
      pushes.push(this.fetch({
        url: "https://www.pushplus.plus/send",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: String(pushplusToken), title, content: body })
      }).then(() => this.log("PushPlus 推送成功")).catch(e => this.log("PushPlus 推送失败: " + e)));
    }
    return Promise.allSettled(pushes);
  };
}
