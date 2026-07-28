/** Loon/QX 运行时全局类型声明 */

interface $httpClientOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
}

interface $httpClientResponse {
  status: number
  headers: Record<string, string>
  body: string
}

declare const $httpClient: {
  get(options: $httpClientOptions, cb: (err: Error | null, resp: $httpClientResponse, data: string) => void): void
  post(options: $httpClientOptions, cb: (err: Error | null, resp: $httpClientResponse, data: string) => void): void
  put(options: $httpClientOptions, cb: (err: Error | null, resp: $httpClientResponse, data: string) => void): void
  delete(options: $httpClientOptions, cb: (err: Error | null, resp: $httpClientResponse, data: string) => void): void
}

interface $notification {
  post(title: string, subtitle: string, body: string): void
}
declare const $notification: $notification

declare const $response: { status: number; headers: Record<string, string>; body: string } | undefined
declare const $request: { url: string; headers: Record<string, string>; body?: string } | undefined
declare const $argument: string | undefined

declare function $done(result?: { body?: string; headers?: Record<string, string>; status?: number }): void

declare const $persistentStore: {
  read(key: string): string | undefined
  write(key: string, value: string): boolean
}

declare const $environment: {
  platform: string
  version: string
}

interface Console {
  log(...args: unknown[]): void
  error(...args: unknown[]): void
  warn(...args: unknown[]): void
}
declare const console: Console
