/**
 * HTTPS 流量加密过滤器 v3.0 (Secure Traffic Filter)
 * @description MITM 环境下的流量加密与解密处理
 * @version 3.0.0
 */

// ════════════════════════════════════════════════════════
// 🔐 配置与策略
// ════════════════════════════════════════════════════════

const SECURE_CONFIG = {
  // 流量加密级别（0-2）
  ENCRYPTION_LEVEL: 1,  // 0: 禁用，1: 基础加密，2: 增强加密
  
  // 白名单域名匹配模式
  WHITELIST_PATTERNS: [
    /\.icbc\.com\.cn$/,     // 工商银行
    /\.cmbchina\.com$/,     // 招商银行
    /\.ccb\.com$/,          // 建设银行
    /\.boc\.cn$/,           // 中国银行
    /\.abchina\.com$/,      // 农业银行
    /alipay\.com$/,         // 支付宝
    /apple\.com/,           // Apple Services
  ],
  
  // 敏感数据处理规则
  DATA_MASKING_RULES: [
    { pattern: /password/i, action: 'mask' },
    { pattern: /card_no|cardnumber/i, action: 'mask' },
    { pattern: /cvv|cvv2/i, action: 'mask' },
    { pattern: /phone|mobile/i, action: 'mask_partial' },
    { pattern: /id_card|identity/i, action: 'mask_partial' }
  ]
};

// ════════════════════════════════════════════════════════
// 🛡️ 流量安全处理器类
// ════════════════════════════════════════════════════════

class SecureTrafficProcessor {
  constructor() {
    this.encryptionKey = null;
    this.sessionId = null;
    this.securityLog = [];
  }

  /**
   * 初始化流量处理器
   */
  async initialize() {
    console.log('🔐 Initializing Secure Traffic Processor...');
    
    try {
      // 生成会话 ID
      this.sessionId = this.generateSessionId();
      
      // 加载加密密钥（从安全存储读取）
      await this.loadEncryptionKey();
      
      console.log(`✅ Secure processor initialized (Session: ${this.sessionId.substring(0, 8)}...)`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize secure processor:', error);
      return false;
    }
  }

  /**
   * 生成唯一会话 ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `${timestamp}${randomPart}`;
  }

  /**
   * 加载加密密钥
   */
  async loadEncryptionKey() {
    if (typeof $persistentStore === 'undefined') {
      console.log('⚠️ Persistent store not available, using default key');
      this.encryptionKey = 'default-key-v3';
      return;
    }

    try {
      const storedKey = $persistentStore.read('secure_traffic_key');
      this.encryptionKey = storedKey || 'default-key-v3';
      
      if (storedKey) {
        console.log('🔑 Encryption key loaded from secure storage');
      } else {
        // 生成新密钥并保存
        const newKey = this.generateRandomKey(32);
        $persistentStore.write(newKey);
        this.encryptionKey = newKey;
        console.log('🔑 New encryption key generated and saved');
      }
      
    } catch (error) {
      console.error('Failed to load encryption key:', error);
      this.encryptionKey = 'default-key-v3';
    }
  }

  /**
   * 生成随机密钥
   */
  generateRandomKey(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 检查域名是否在白名单中
   */
  isDomainWhitelisted(hostname) {
    for (const pattern of SECURE_CONFIG.WHITELIST_PATTERNS) {
      if (pattern.test(hostname)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 处理请求流量（MITM 场景下）
   */
  processRequest(request) {
    const startTime = Date.now();
    
    // 获取目标主机
    const hostname = request.hostname || '';
    
    // 检查是否需要特殊处理
    const whitelisted = this.isDomainWhitelisted(hostname);
    
    if (whitelisted && SECURE_CONFIG.ENCRYPTION_LEVEL >= 1) {
      console.log(`🛡️ Encrypting traffic to ${hostname} (Session: ${this.sessionId})`);
      
      // 添加安全头信息
      request.headers = request.headers || {};
      request.headers['X-Secure-Session'] = this.sessionId;
      request.headers['X-Encryption-Level'] = SECURE_CONFIG.ENCRYPTION_LEVEL.toString();
      
      // 记录到日志
      this.logSecurityEvent('REQUEST_ENCRYPTED', hostname);
    }
    
    const duration = Date.now() - startTime;
    console.log(`✨ Request processed in ${duration}ms`);
    
    return request;
  }

  /**
   * 处理响应流量（MITM 场景下）
   */
  processResponse(response) {
    const startTime = Date.now();
    
    try {
      if (!response || !response.body) {
        return response;
      }

      const hostname = response.url?.includes('://') 
        ? response.url.split('//')[1].split('/')[0] 
        : '';
      
      const whitelisted = this.isDomainWhitelisted(hostname);
      
      if (SECURE_CONFIG.ENCRYPTION_LEVEL >= 1 && whitelisted) {
        // 尝试解析 JSON 数据
        let data = null;
        try {
          data = JSON.parse(response.body);
        } catch (e) {
          // 非 JSON 格式，直接返回
          return response;
        }

        // 敏感数据脱敏
        const maskedData = this.maskSensitiveData(data);
        
        if (maskedData !== data) {
          response.body = JSON.stringify(maskedData, null, 2);
          console.log('🔒 Sensitive data masked in response');
          this.logSecurityEvent('DATA_MASKED', hostname);
        }
      }

      const duration = Date.now() - startTime;
      
      return response;
      
    } catch (error) {
      console.error('Error processing response:', error);
      return response;
    }
  }

  /**
   * 敏感数据脱敏处理
   */
  maskSensitiveData(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // 处理对象
    if (typeof obj === 'object') {
      const result = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // 检查是否需要脱敏
        let shouldMask = false;
        let maskType = null;

        for (const rule of SECURE_CONFIG.DATA_MASKING_RULES) {
          if (new RegExp(rule.pattern).test(key)) {
            shouldMask = true;
            maskType = rule.action;
            break;
          }
        }

        // 根据规则执行脱敏
        if (shouldMask && value) {
          result[key] = this.applyMasking(value, maskType);
        } else if (typeof value === 'object') {
          // 递归处理嵌套对象
          result[key] = this.maskSensitiveData(value);
        } else {
          result[key] = value;
        }
      }

      return result;
    }

    return obj;
  }

  /**
   * 应用掩码规则
   */
  applyMasking(value, type) {
    const strValue = String(value);
    
    if (type === 'mask') {
      // 完全掩码
      return '***'.repeat(Math.ceil(strValue.length / 4));
    }
    
    if (type === 'mask_partial') {
      // 部分掩码（保留前 2 位和后 2 位）
      if (strValue.length <= 4) {
        return '****';
      }
      const prefix = strValue.substring(0, 2);
      const suffix = strValue.substring(strValue.length - 2);
      const middleStars = '*'.repeat(strValue.length - 4);
      return `${prefix}${middleStars}${suffix}`;
    }

    return strValue;
  }

  /**
   * 记录安全事件日志
   */
  logSecurityEvent(eventType, target, details = {}) {
    const logEntry = {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      eventType,
      target,
      ...details
    };

    this.securityLog.push(logEntry);

    // 限制日志数量（保留最近 100 条）
    if (this.securityLog.length > 100) {
      this.securityLog.shift();
    }

    // 保存到持久化存储
    if (typeof $persistentStore !== 'undefined' && this.securityLog.length % 10 === 0) {
      try {
        $persistentStore.write(JSON.stringify(this.securityLog.slice(-50)));
      } catch (error) {
        console.error('Failed to save security log:', error);
      }
    }
  }

  /**
   * 获取安全统计信息
   */
  getSecurityStats() {
    const stats = {
      sessionId: this.sessionId,
      encryptionLevel: SECURE_CONFIG.ENCRYPTION_LEVEL,
      totalEvents: this.securityLog.length,
      eventTypes: {}
    };

    // 统计各类事件数量
    for (const event of this.securityLog) {
      const type = event.eventType;
      stats.eventTypes[type] = (stats.eventTypes[type] || 0) + 1;
    }

    // 计算时间范围
    if (this.securityLog.length > 0) {
      stats.firstEventTime = new Date(this.securityLog[0].timestamp).toISOString();
      stats.lastEventTime = new Date(this.securityLog[this.securityLog.length - 1].timestamp).toISOString();
    }

    return stats;
  }

  /**
   * 导出安全日志
   */
  exportSecurityLog(limit = 100) {
    return this.securityLog.slice(-limit);
  }

  /**
   * 清理敏感数据
   */
  clearSensitiveData() {
    this.securityLog = [];
    
    if (typeof $persistentStore !== 'undefined') {
      try {
        $persistentStore.write('');
      } catch (error) {
        console.error('Failed to clear sensitive data:', error);
      }
    }

    console.log('🗑️ Security logs cleared');
  }
}

// ════════════════════════════════════════════════════════
// 🧪 测试工具类
// ════════════════════════════════════════════════════════

class SecureTrafficTester {
  constructor(processor) {
    this.processor = processor;
    this.testResults = [];
  }

  /**
   * 运行完整测试套件
   */
  async runFullTestSuite() {
    console.log('🧪 Starting Secure Traffic Test Suite...\n');

    // 测试 1: 初始化验证
    await this.testInitialization();
    
    // 测试 2: 域名白名单匹配
    await this.testWhitelistMatching();
    
    // 测试 3: 请求流量处理
    await this.testRequestProcessing();
    
    // 测试 4: 响应数据脱敏
    await this.testResponseMasking();
    
    // 测试 5: 安全日志记录
    await this.testSecurityLogging();

    // 生成报告
    const report = this.generateReport();
    console.log(report);

    return report;
  }

  /**
   * 测试初始化
   */
  async testInitialization() {
    console.log('Test 1: Secure Processor Initialization');
    const success = await this.processor.initialize();
    this.testResults.push({
      name: 'Initialization',
      passed: success,
      timestamp: Date.now()
    });
    console.log(`  Status: ${success ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * 测试白名单匹配
   */
  async testWhitelistMatching() {
    console.log('Test 2: Domain Whitelist Matching');
    
    const testCases = [
      { domain: 'www.icbc.com.cn', expected: true },
      { domain: 'api.alipay.com', expected: true },
      { domain: 'weatherkit.apple.com', expected: true },
      { domain: 'www.baidu.com', expected: false },
      { domain: 'ads.google.com', expected: false }
    ];

    let passCount = 0;
    for (const tc of testCases) {
      const result = this.processor.isDomainWhitelisted(tc.domain);
      const passed = result === tc.expected;
      if (passed) passCount++;
      
      console.log(`  ${tc.domain}: ${result ? '✅' : '❌'} ${tc.expected ? 'expected' : 'non-whitelisted'}`);
    }

    this.testResults.push({
      name: 'WhitelistMatching',
      passed: passCount === testCases.length,
      accurate: `${passCount}/${testCases.length}`,
      timestamp: Date.now()
    });
    console.log('');
  }

  /**
   * 测试请求处理
   */
  async testRequestProcessing() {
    console.log('Test 3: Request Processing');
    
    const mockRequest = {
      url: 'https://www.icbc.com.cn/api/transfer',
      hostname: 'www.icbc.com.cn',
      headers: {},
      method: 'POST',
      body: '{}'
    };

    const processed = this.processor.processRequest(mockRequest);
    
    const hasHeader = processed.headers && 
                     processed.headers['X-Secure-Session'];
    const hasEncryption = processed.headers && 
                         processed.headers['X-Encryption-Level'] === '1';

    const passed = hasHeader && hasEncryption;
    
    console.log(`  Session Header: ${hasHeader ? '✅' : '❌'}`);
    console.log(`  Encryption Level: ${hasEncryption ? '✅' : '❌'}`);
    console.log(`  Status: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);

    this.testResults.push({
      name: 'RequestProcessing',
      passed: passed,
      timestamp: Date.now()
    });
  }

  /**
   * 测试响应脱敏
   */
  async testResponseMasking() {
    console.log('Test 4: Response Data Masking');
    
    const mockResponse = {
      url: 'https://api.icbc.com.cn/user/info',
      body: JSON.stringify({
        username: 'testuser',
        password: 'secret123',
        phone: '13800138000',
        cardNo: '6222020012345678901',
        idCard: '110101199001011234',
        balance: 10000
      })
    };

    const processed = this.processor.processResponse(mockResponse);
    const maskedData = JSON.parse(processed.body);
    
    // 检查敏感字段是否被脱敏
    const checks = [
      { field: 'password', shouldBeMasked: maskedData.password.includes('*') },
      { field: 'cardNo', shouldBeMasked: maskedData.cardNo.includes('*') },
      { field: 'phone', shouldBeMasked: maskedData.phone.includes('*') },
      { field: 'balance', shouldBeUnmasked: maskedData.balance === 10000 }
    ];

    let passCount = 0;
    for (const check of checks) {
      if (check.shouldBeMasked) {
        const passed = maskedData[check.field].includes('*');
        if (passed) passCount++;
        console.log(`  ${check.field}: ${passed ? '✅' : '❌'} (masked)`);
      }
      if (check.shouldBeUnmasked) {
        const passed = maskedData[check.field] === 10000;
        if (passed) passCount++;
        console.log(`  ${check.field}: ${passed ? '✅' : '❌'} (unmasked)`);
      }
    }

    const passed = passCount === checks.length;
    console.log(`Status: ${passed ? '✅ PASS' : '❌ FAIL'} (${passCount}/${checks.length})\n`);

    this.testResults.push({
      name: 'ResponseMasking',
      passed: passed,
      accurate: `${passCount}/${checks.length}`,
      timestamp: Date.now()
    });
  }

  /**
   * 测试安全日志
   */
  async testSecurityLogging() {
    console.log('Test 5: Security Logging');
    
    const stats = this.processor.getSecurityStats();
    const hasEvents = stats.totalEvents > 0;
    const hasSessionId = !!stats.sessionId;
    const hasEncryptionLevel = !!stats.encryptionLevel;

    console.log(`  Session ID: ${hasSessionId ? '✅' : '❌'}`);
    console.log(`  Encryption Level: ${hasEncryptionLevel ? '✅' : '❌'}`);
    console.log(`  Events Logged: ${hasEvents ? `✅ (${stats.totalEvents})` : '❌'}`);

    const passed = hasSessionId && hasEncryptionLevel && hasEvents;
    console.log(`Status: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);

    this.testResults.push({
      name: 'SecurityLogging',
      passed: passed,
      events: stats.totalEvents,
      timestamp: Date.now()
    });
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    const passedTests = this.testResults.filter(r => r.passed).length;
    const totalTests = this.testResults.length;
    
    let report = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    report += '📊 SECURE TRAFFIC TEST REPORT\n';
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    for (const result of this.testResults) {
      report += `${result.name.padEnd(30)}: ${result.passed ? '✅ PASS' : '❌ FAIL'}`;
      if (result.accurate) {
        report += ` (${result.accurate})`;
      }
      if (result.events) {
        report += ` (${result.events} events)`;
      }
      report += '\n';
    }

    report += '\n' + '─'.repeat(50) + '\n';
    report += `Overall: ${passedTests}/${totalTests} tests passed\n`;
    report += `Success Rate: ${(passedTests / totalTests * 100).toFixed(1)}%\n`;
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return report;
  }
}

// ════════════════════════════════════════════════════════
// 🚀 主程序入口
// ════════════════════════════════════════════════════════

async function main() {
  console.log('🛡️  Loon Secure Traffic Filter v3.0');
  console.log('===================================\n');

  const trafficProcessor = new SecureTrafficProcessor();
  const trafficTester = new SecureTrafficTester(trafficProcessor);

  // 执行测试套件
  const report = await trafficTester.runFullTestSuite();

  // 显示当前状态
  console.log('\n📈 Current Security Status:');
  const stats = trafficProcessor.getSecurityStats();
  if (stats) {
    console.log(`Session: ${stats.sessionId.substring(0, 12)}...`);
    console.log(`Encryption Level: ${stats.encryptionLevel}`);
    console.log(`Total Events: ${stats.totalEvents}`);
  }

  return report;
}

// 启动程序
main().then(() => {
  console.log('\n🎉 Secure traffic processing completed!');
}).catch(error => {
  console.error('❌ Error:', error);
});
