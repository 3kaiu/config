/**
 * MITM 证书管理器 v3.0 (Secure Certificate Manager)
 * @description 自动化证书生成、验证和更新
 * @version 3.0.0
 */

// ════════════════════════════════════════════════════════
// 🔐 配置与常量
// ════════════════════════════════════════════════════════

const CERT_CONFIG = {
  // 证书有效期（天）
  CERT_VALIDITY_DAYS: 365,
  
  // 密钥强度（RSA bits）
  KEY_SIZE: 2048,
  
  // CA 证书信息
  CA_INFO: {
    C: "CN",                                    // 国家代码
    ST: "Beijing",                              // 省份
    L: "Beijing",                               // 城市
    O: "Loon MITM CA",                          // 组织名称
    OU: "Security Team",                        // 组织单位
    CN: "Loon MitmCA"                           // 通用名称
  },
  
  // 安全白名单（分级）
  WHITELIST_TIERS: {
    TIER_1_BANKING: [                             // 银行金融（最高级别）
      'icbc.com.cn', 'cmbchina.com', 'ccb.com',
      'boc.cn', 'abchina.com', 'pingan.com.cn',
      'spdb.com.cn', 'cebcbank.com', 'hxb.com.cn',
      'cgbchina.com.cn', 'alipay.com', 'tenpay.com'
    ],
    
    TIER_2_APPLE: [                                // Apple Services
      'apple.com', 'icloud.com', 'cdn-apple.com',
      'weatherkit.apple.com', 'news-edge.apple.com'
    ],
    
    TIER_3_ECOMMERCE: [                            // 电商支付
      'taobao.com', 'tmall.com', 'jd.com',
      'mybank.icbc.com.cn', 'jf365.boc.cn'
    ],
    
    TIER_4_CONTENT: [                              // 内容社交
      'weibo.com', 'zhihu.com', 'bilibili.com',
      'youtube.com', 'wechat.com'
    ]
  }
};

// ════════════════════════════════════════════════════════
// 🏗️ 证书管理类
// ════════════════════════════════════════════════════════

class CertificateManager {
  constructor() {
    this.certificateStore = null;
    this.keyPair = null;
    this.caCertificate = null;
  }

  /**
   * 初始化证书系统
   */
  async initialize() {
    console.log('🔐 Initializing MITM Certificate System...');
    
    try {
      // 1. 检查现有证书存储
      await this.loadCertificateStore();
      
      // 2. 验证当前证书有效性
      const isValid = await this.validateCurrentCertificate();
      
      if (!isValid) {
        console.log('⚠️ Current certificate invalid or expired');
        await this.generateNewCertificate();
      }
      
      // 3. 加载白名单
      await this.loadWhitelist();
      
      console.log('✅ Certificate system initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize certificate system:', error);
      return false;
    }
  }

  /**
   * 加载证书存储
   */
  async loadCertificateStore() {
    if (typeof $persistentStore === 'undefined') {
      console.log('⚠️ Persistent store not available');
      return;
    }

    try {
      const stored = $persistentStore.read('mitm_cert_store');
      this.certificateStore = stored ? JSON.parse(stored) : null;
      
      if (this.certificateStore) {
        console.log('📦 Loaded certificate store from persistent storage');
      }
      
    } catch (error) {
      console.error('Failed to load certificate store:', error);
      this.certificateStore = {};
    }
  }

  /**
   * 验证当前证书有效性
   */
  async validateCurrentCertificate() {
    if (!this.certificateStore) {
      return false;
    }

    const now = Date.now();
    const expirationTime = this.certificateStore.expiration || 0;
    
    // 预留 7 天缓冲期
    const bufferDays = 7 * 24 * 60 * 60 * 1000;
    
    if (now + bufferDays > expirationTime) {
      console.log('⚠️ Certificate expiring soon or expired');
      return false;
    }

    console.log('✅ Certificate valid until:', new Date(expirationTime).toISOString());
    return true;
  }

  /**
   * 生成新证书
   */
  async generateNewCertificate() {
    console.log('🔑 Generating new MITM certificate...');
    
    try {
      const now = Date.now();
      const validityMs = CERT_CONFIG.CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
      const expiration = now + validityMs;

      // 生成密钥对
      const keyPair = await this.generateKeyPair(CERT_CONFIG.KEY_SIZE);
      
      // 生成自签名 CA 证书
      const caCert = await this.generateSelfSignedCA(keyPair);
      
      // 保存证书数据
      this.certificateStore = {
        created: now,
        expiration: expiration,
        keyPair: keyPair,
        caCertificate: caCert,
        version: '3.0',
        algorithms: ['RSA', 'SHA256']
      };

      // 持久化存储
      await this.saveCertificateStore();
      
      console.log(`✅ New certificate generated (${CERT_CONFIG.CERT_VALIDITY_DAYS} days validity)`);
      console.log(`   Expiration: ${new Date(expiration).toISOString()}`);
      
      // 发送通知
      await this.notifyCertificateUpdate();
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to generate certificate:', error);
      return false;
    }
  }

  /**
   * 生成 RSA 密钥对（模拟实现）
   */
  async generateKeyPair(bits) {
    // Loon/QX 不提供原生 RSA 生成 API，这里使用模拟
    // 实际部署时应在服务器端生成并传输
    
    return {
      public: `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n模拟公钥内容...\n-----END PUBLIC KEY-----`,
      private: `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCAl8wggJbAgEAAoIBAQC\n模拟私钥内容...\n-----END PRIVATE KEY-----`,
      bits: bits,
      algorithm: 'RSA'
    };
  }

  /**
   * 生成自签名 CA 证书
   */
  async generateSelfSignedCA(keyPair) {
    // 构造证书主题
    const subject = CERT_CONFIG.CA_INFO;
    
    // 构造证书扩展
    const extensions = {
      basicConstraints: 'CA:TRUE',
      keyUsage: 'digitalSignature, keyCertSign, cRLSign',
      subjectKeyIdentifier: 'hash',
      authorityKeyIdentifier: 'keyid:always'
    };

    return {
      subject: subject,
      issuer: subject,                                 // 自签名
      serial: this.generateSerialNumber(),
      notBefore: new Date().toISOString(),
      notAfter: new Date(Date.now() + CERT_CONFIG.CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      publicKey: keyPair.public,
      extensions: extensions,
      signatureAlgorithm: 'sha256WithRSAEncryption'
    };
  }

  /**
   * 生成唯一序列号
   */
  generateSerialNumber() {
    const randomBytes = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now().toString(16);
    return `${randomBytes}${timestamp}`;
  }

  /**
   * 保存证书到存储
   */
  async saveCertificateStore() {
    if (typeof $persistentStore === 'undefined') {
      return false;
    }

    try {
      // 仅保存必要信息（不保存私钥）
      const safeData = {
        expiration: this.certificateStore.expiration,
        version: this.certificateStore.version,
        lastUpdated: Date.now()
      };

      $persistentStore.write(JSON.stringify(safeData));
      console.log('✅ Certificate store saved');
      return true;
      
    } catch (error) {
      console.error('Failed to save certificate store:', error);
      return false;
    }
  }

  /**
   * 加载域名白名单
   */
  async loadWhitelist() {
    console.log('📋 Loading domain whitelist...');
    
    const allDomains = Object.values(CERT_CONFIG.WHITELIST_TIERS)
      .flat()
      .map(domain => `*.${domain}`);
    
    console.log(`✅ Loaded ${allDomains.length} domains into whitelist`);
    
    // 写入 Hostname 配置
    if (typeof $persistentStore !== 'undefined') {
      $persistentStore.write(`MITM Whitelist: ${allDomains.length} domains loaded`);
    }
    
    return allDomains;
  }

  /**
   * 通知证书更新
   */
  async notifyCertificateUpdate() {
    const title = '🛡️ MITM 证书已更新';
    const message = `有效期至：${new Date(this.certificateStore.expiration).toLocaleDateString()}\n版本：v3.0`;
    const subtitle = '下次自动更新将在到期前 7 天';

    if (typeof $notification !== 'undefined') {
      $notification.post(title, message, subtitle);
    } else if (typeof $notify !== 'undefined') {
      $notify(title, message, subtitle);
    }
  }

  /**
   * 检查域名是否在白名单中
   */
  isDomainWhitelisted(hostname) {
    for (const tier of Object.values(CERT_CONFIG.WHITELIST_TIERS)) {
      for (const domain of tier) {
        const pattern = domain.startsWith('*.') ? domain.substring(1) : domain;
        if (hostname.includes(pattern)) {
          return { whitelisted: true, tier: this.getTierName(tier) };
        }
      }
    }
    return { whitelisted: false };
  }

  /**
   * 获取白名单层级名称
   */
  getTierName(tierArray) {
    if (tierArray === CERT_CONFIG.WHITELIST_TIERS.TIER_1_BANKING) return 'Tier 1 - Banking';
    if (tierArray === CERT_CONFIG.WHITELIST_TIERS.TIER_2_APPLE) return 'Tier 2 - Apple';
    if (tierArray === CERT_CONFIG.WHITELIST_TIERS.TIER_3_ECOMMERCE) return 'Tier 3 - E-commerce';
    if (tierArray === CERT_CONFIG.WHITELIST_TIERS.TIER_4_CONTENT) return 'Tier 4 - Content';
    return 'Unknown';
  }

  /**
   * 获取证书统计信息
   */
  getStats() {
    if (!this.certificateStore) {
      return null;
    }

    const now = Date.now();
    const daysUntilExpiration = Math.ceil((this.certificateStore.expiration - now) / (24 * 60 * 60 * 1000));
    
    return {
      version: this.certificateStore.version,
      created: new Date(this.certificateStore.created).toISOString(),
      expiration: new Date(this.certificateStore.expiration).toISOString(),
      daysRemaining: daysUntilExpiration,
      daysTotal: CERT_CONFIG.CERT_VALIDITY_DAYS,
      utilizationRate: ((CERT_CONFIG.CERT_VALIDITY_DAYS - daysUntilExpiration) / CERT_CONFIG.CERT_VALIDITY_DAYS * 100).toFixed(2) + '%'
    };
  }

  /**
   * 导出证书信息（供调试使用）
   */
  exportCertificateInfo() {
    const stats = this.getStats();
    if (!stats) return null;

    return {
      ...stats,
      whitelistedDomains: Object.entries(CERT_CONFIG.WHITELIST_TIERS)
        .reduce((sum, [, domains]) => sum + domains.length, 0),
      tiers: Object.keys(CERT_CONFIG.WHITELIST_TIERS)
    };
  }
}

// ════════════════════════════════════════════════════════
// 🧪 测试工具类
// ════════════════════════════════════════════════════════

class CertificateTester {
  constructor(manager) {
    this.manager = manager;
    this.results = [];
  }

  /**
   * 运行完整测试套件
   */
  async runFullTestSuite() {
    console.log('🧪 Starting MITM Certificate Test Suite...\n');

    // 测试 1: 初始化检查
    await this.testInitialization();
    
    // 测试 2: 证书有效性验证
    await this.testCertificateValidity();
    
    // 测试 3: 白名单匹配
    await this.testWhitelistMatching();
    
    // 测试 4: 到期时间计算
    await this.testExpirationCalculation();

    // 生成报告
    const report = this.generateReport();
    console.log(report);

    return report;
  }

  /**
   * 测试初始化
   */
  async testInitialization() {
    console.log('Test 1: Certificate System Initialization');
    const success = await this.manager.initialize();
    this.results.push({
      name: 'Initialization',
      passed: success,
      timestamp: Date.now()
    });
    console.log(`  Status: ${success ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * 测试证书有效性
   */
  async testCertificateValidity() {
    console.log('Test 2: Certificate Validity Check');
    const isValid = await this.manager.validateCurrentCertificate();
    this.results.push({
      name: 'CertificateValidity',
      passed: isValid,
      timestamp: Date.now()
    });
    console.log(`  Status: ${isValid ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * 测试白名单匹配
   */
  async testWhitelistMatching() {
    console.log('Test 3: Domain Whitelist Matching');
    
    const testCases = [
      { domain: 'www.icbc.com.cn', expected: true },
      { domain: 'www.alipay.com', expected: true },
      { domain: 'weatherkit.apple.com', expected: true },
      { domain: 'www.baidu.com', expected: false },
      { domain: 'ads.google.com', expected: false }
    ];

    let passCount = 0;
    for (const tc of testCases) {
      const result = this.manager.isDomainWhitelisted(tc.domain);
      const passed = result.whitelisted === tc.expected;
      if (passed) passCount++;
      
      console.log(`  ${tc.domain}: ${result.whitelisted ? '✅' : '❌'} ${result.tier || 'N/A'}`);
    }

    this.results.push({
      name: 'WhitelistMatching',
      passed: passCount === testCases.length,
      accurate: `${passCount}/${testCases.length}`,
      timestamp: Date.now()
    });
    console.log('');
  }

  /**
   * 测试到期计算
   */
  async testExpirationCalculation() {
    console.log('Test 4: Expiration Time Calculation');
    
    const stats = this.manager.getStats();
    const expectedDays = CERT_CONFIG.CERT_VALIDITY_DAYS;
    
    const withinRange = stats.daysRemaining >= expectedDays - 10 && 
                       stats.daysRemaining <= expectedDays;
    
    console.log(`  Expected: ${expectedDays} days`);
    console.log(`  Actual: ${stats.daysRemaining} days`);
    console.log(`  Status: ${withinRange ? '✅ PASS' : '❌ FAIL'}\n`);

    this.results.push({
      name: 'ExpirationCalculation',
      passed: withinRange,
      timestamp: Date.now()
    });
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    
    let report = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    report += '📊 MITM CERTIFICATE TEST REPORT\n';
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    for (const result of this.results) {
      report += `${result.name.padEnd(30)}: ${result.passed ? '✅ PASS' : '❌ FAIL'}`;
      if (result.accurate) {
        report += ` (${result.accurate})`;
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
  console.log('🛡️  Loon MITM Security Module v3.0');
  console.log('===================================\n');

  const certManager = new CertificateManager();
  const certTester = new CertificateTester(certManager);

  // 执行测试套件
  const report = await certTester.runFullTestSuite();

  // 显示当前状态
  console.log('\n📈 Current Certificate Status:');
  const stats = certManager.getStats();
  if (stats) {
    console.log(`Version: ${stats.version}`);
    console.log(`Created: ${stats.created.split('T')[0]}`);
    console.log(`Expires: ${stats.expiration.split('T')[0]}`);
    console.log(`Days Remaining: ${stats.daysRemaining}`);
    console.log(`Utilization: ${stats.utilizationRate}`);
  }

  return report;
}

// 启动程序
main().then(() => {
  console.log('\n🎉 MITM Certificate management completed!');
}).catch(error => {
  console.error('❌ Error:', error);
});
