/**
 * Multi-Provider Configuration for Surgio
 * @description 支持主备双 Provider 的智能故障转移配置
 * @author 3kaiu
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════
// 🌍 Provider 配置定义
// ════════════════════════════════════════

module.exports = {
  // 主 Provider (高优先级)
  primary: {
    name: 'tokyo-primary',
    url: process.env.SURGIO_PRIMARY_URL || 'https://ws.wenn.in/provider/tokyo',
    healthEndpoint: '/health',
    timeout: 5000,  // 5 秒超时
    retryAttempts: 3,
    priority: 1,  // 最高优先级
    enabled: true
  },

  // 备用 Provider (低优先级，故障时自动切换)
  secondary: {
    name: 'cloudflare-backup',
    url: 'https://cdn.cloudflare.com/provider/tokyo',
    healthEndpoint: '/health',
    timeout: 10000,  // 10 秒超时
    retryAttempts: 2,
    priority: 2,  // 第二优先级
    fallback: true,
    enabled: true
  },

  // 故障转移策略
  failover: {
    strategy: 'automatic',  // automatic / manual / round-robin
    threshold: 2,           // 连续失败 2 次触发切换
    window: 60,             // 60 秒内统计失败次数
    recoveryThreshold: 3,   // 恢复需要连续成功 3 次
    recoveryWindow: 120     // 120 秒窗口期
  },

  // 健康检查配置
  healthCheck: {
    interval: 300000,       // 每 5 分钟检查一次 (毫秒)
    timeout: 10000,         // 10 秒超时
    expectedStatus: 200,
    endpoints: [
      { provider: 'primary', url: '{{url}}{{healthEndpoint}}' },
      { provider: 'secondary', url: '{{url}}{{healthEndpoint}}' }
    ]
  },

  // 请求配置
  request: {
    maxConcurrent: 5,       // 最大并发数
    retryOnFailure: true,
    backoffStrategy: 'exponential', // linear / exponential
    maxRetryDelay: 30000    // 最大重试延迟 30s
  }
};

// ════════════════════════════════════════
// 🧪 验证函数
// ═══════════════════════════════════════===

async function validateConfiguration() {
  console.log('🔍 Validating multi-provider configuration...');
  
  const issues = [];
  
  // 检查主 provider
  if (!module.exports.primary.url) {
    issues.push('❌ Missing primary provider URL');
  }
  
  // 检查备用 provider
  if (!module.exports.secondary.url) {
    issues.push('⚠️ Missing secondary provider URL');
  }
  
  // 检查环境变量
  if (!process.env.SURGIO_PRIMARY_URL && !module.exports.primary.url) {
    issues.push('⚠️ No backup URL defined in config');
  }
  
  if (issues.length > 0) {
    console.error('❌ Configuration validation failed:');
    issues.forEach(issue => console.error('  ' + issue));
    return false;
  }
  
  console.log('✅ Configuration is valid!');
  return true;
}

// ════════════════════════════════════════
// 🔄 Provider 选择逻辑
// ═══════════════════════════════════════===

let currentProvider = 'primary';
let failureCount = 0;
let lastCheckTime = Date.now();

async function selectProvider() {
  // 检查是否需要进行健康检查和故障转移
  const timeSinceLastCheck = Date.now() - lastCheckTime;
  
  if (timeSinceLastCheck < module.exports.healthCheck.interval) {
    // 仍在健康检查窗口期内，不重复检查
    return currentProvider === 'primary' ? module.exports.primary : module.exports.secondary;
  }
  
  lastCheckTime = Date.now();
  
  try {
    // 优先尝试主 provider
    const success = await checkHealth(module.exports.primary);
    
    if (success) {
      if (currentProvider !== 'primary') {
        console.log('🔄 Failback to primary provider');
      }
      currentProvider = 'primary';
      failureCount = 0;
      return module.exports.primary;
    } else {
      // 主 provider 故障，切换到备用
      if (failureCount >= module.exports.failover.threshold - 1) {
        console.log('⚠️ Primary provider failed, switching to secondary');
        currentProvider = 'secondary';
      }
      failureCount++;
      return module.exports.secondary;
    }
  } catch (error) {
    console.error('❌ Error checking provider health:', error.message);
    failureCount++;
    return module.exports.secondary;
  }
}

async function checkHealth(provider) {
  try {
    const response = await fetch(`${provider.url}${provider.healthEndpoint}`, {
      method: 'GET',
      timeout: provider.timeout
    });
    
    return response.ok && response.status === provider.expectedStatus;
  } catch (error) {
    console.log(`ℹ️ Health check failed for ${provider.name}: ${error.message}`);
    return false;
  }
}

module.exports.validateConfiguration = validateConfiguration;
module.exports.selectProvider = selectProvider;
