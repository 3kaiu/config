/**
 * Plugin Type Definitions
 * @description TypeScript types for plugin system
 * @author 3kaiu
 * @version 1.0.0
 */

export interface PluginMetadata {
  name: string;
  desc: string;
  version: string;
  author: string;
  homepage?: string;
  icon?: string;
}

export interface PluginArgument {
  key: string;
  type: 'switch' | 'input' | 'select';
  defaultValue: string | number | boolean;
  options?: { value: string; label: string }[];
  tag?: string;
  description?: string;
}

export interface PluginConfig {
  metadata: PluginMetadata;
  arguments: PluginArgument[];
  scriptRules: ScriptRule[];
  rewriteRules: RewriteRule[];
  ruleBlocks?: RuleBlock[];
  mitmHostnames?: string[];
}

export interface ScriptRule {
  type: 'http-request' | 'http-response' | 'script';
  pattern: string;
  scriptPath: string;
  timeout?: number;
  requiresBody?: boolean;
  binaryBodyMode?: boolean;
  tags?: string[];
  enabledBy?: string[]; // Feature flags that enable this rule
}

export interface RewriteRule {
  pattern: string;
  action: string;
  rewriteType: 'reject-200' | 'reject-dict' | 'url-302' | 'redirect';
  enabledBy?: string[];
}

export interface RuleBlock {
  type: 'DOMAIN' | 'IP-CIDR' | 'IP-CIDR6' | 'GEOIP';
  domain: string;
  policy: string;
  noResolve?: boolean;
}

/**
 * Core Cleaner Functions (from utils/cleaner.js)
 */
export interface CleanAdFieldsOptions {
  keywords?: string[];
  depthLimit?: number;
  debug?: boolean;
}

export interface FilterAdItemsOptions {
  filterFn?: (item: any, index: number) => boolean;
  removeAdsOnly?: boolean;
}

export interface UrlRouteMatch {
  routeName: string;
  pattern: RegExp;
}

export interface RouteHandlers {
  [routeName: string]: (obj: object) => object;
  default?: (obj: object) => object;
}

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  executionTimeMs: number;
  memoryUsageBytes: number;
  httpCallCount: number;
  errors: ErrorInfo[];
  warnings: WarningInfo[];
}

export interface ErrorInfo {
  message: string;
  code: string;
  location?: string;
  stack?: string;
}

export interface WarningInfo {
  message: string;
  code: string;
}

/**
 * Test Harness Types
 */
export interface TestRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface TestResponse {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
}

export interface TestState {
  doneCalls: number;
  notifications: Notification[];
  httpCalls: HttpCall[];
  store: Record<string, unknown>;
  logs: string[];
}

export interface Notification {
  title: string;
  subtitle: string;
  content: string;
}

export interface HttpCall {
  url: string;
  method: string;
  status: number;
  body: string;
  headers: Record<string, string>;
}

/**
 * Plugin Features Flags
 */
export interface FeatureFlags {
  ENABLE_PLUGIN: boolean;
  DEBUG_MODE?: boolean;
  
  // Example feature flags for different apps
  SPLASH_ENABLE?: boolean;
  FEED_ENABLE?: boolean;
  POPUP_ENABLE?: boolean;
  SEARCH_ENABLE?: boolean;
  PAYMENT_ENABLE?: boolean;
  
  // Platform-specific features
  LOSSLESS_AUDIO?: boolean;
  BACKGROUND_PLAY?: boolean;
  PIP_ENABLED?: boolean;
  REGION_UNLOCK?: boolean;
  PRIVACY_PROTECTION?: boolean;
}

/**
 * Multi-Provider Configuration
 */
export interface ProviderConfig {
  primary: {
    name: string;
    url: string;
    healthEndpoint: string;
    timeout: number;
    retryAttempts: number;
    priority: number;
    enabled: boolean;
  };
  secondary: {
    name: string;
    url: string;
    healthEndpoint: string;
    timeout: number;
    retryAttempts: number;
    priority: number;
    fallback: boolean;
    enabled: boolean;
  };
  failover: {
    strategy: 'automatic' | 'manual' | 'round-robin';
    threshold: number;
    window: number;
    recoveryThreshold: number;
    recoveryWindow: number;
  };
  healthCheck: {
    interval: number;
    timeout: number;
    expectedStatus: number;
  };
  request: {
    maxConcurrent: number;
    retryOnFailure: boolean;
    backoffStrategy: 'linear' | 'exponential';
    maxRetryDelay: number;
  };
}

/**
 * Plugin Category
 */
export type PluginCategory = 
  | 'core'
  | 'apps.social'
  | 'apps.entertainment.video'
  | 'apps.entertainment.music'
  | 'apps.shopping'
  | 'apps.finance'
  | 'apps.tools'
  | 'apps.navigation'
  | 'apps.reading'
  | 'overseas.social'
  | 'overseas.services'
  | 'utilities.browser'
  | 'utilities.developer'
  | 'utilities.monitoring'
  | 'experimental';

/**
 * Utility Function Signatures
 */
export interface AdCleaner {
  cleanAdFields(
    obj: object,
    keywords?: string[],
    depth?: number
  ): object;
  
  matchUrlRoute(url: string, routes: Record<string, RegExp>): string | null;
  
  dispatchByRoute(
    url: string,
    bodyObj: object,
    handlers: RouteHandlers
  ): object;
  
  filterAdItems<T>(
    array: T[],
    filterFn: (item: T, index: number) => boolean
  ): T[];
  
  parseResponse(responseBody: string): object | null;
  
  validateStructure(
    obj: object,
    requiredKeys: string[]
  ): { valid: boolean; missingKeys: string[]; extraKeys: string[] };
  
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: object): void;
  
  performanceTrack<T extends (...args: any[]) => any>(
    fn: T,
    functionName: string
  ): T;
  
  safeStringify(obj: any, replacer?: any, space?: any): string;
  
  getSafeValue<T = unknown>(obj: any, path: string, defaultValue?: T): T;
}

/**
 * Export all types for use in other modules
 */
export {
  PluginMetadata,
  PluginArgument,
  PluginConfig,
  ScriptRule,
  RewriteRule,
  RuleBlock,
  CleanAdFieldsOptions,
  FilterAdItemsOptions,
  UrlRouteMatch,
  RouteHandlers,
  PerformanceMetrics,
  ErrorInfo,
  WarningInfo,
  TestRequest,
  TestResponse,
  TestState,
  Notification,
  HttpCall,
  FeatureFlags,
  ProviderConfig,
  PluginCategory,
  AdCleaner
};
