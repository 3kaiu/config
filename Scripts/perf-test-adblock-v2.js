/**
 * 去广告性能测试套件 v2.0
 * @description 全面测试去广告模块的性能指标
 * @version 2.0.0
 */

// ════════════════════════════════════════════════════════
// 🔬 测试配置
// ════════════════════════════════════════════════════════

const TEST_CONFIG = {
  // 测试场景
  SCENARIOS: [
    'ad_filter',      // 广告拦截
    'dns_blocking',   // DNS 拦截
    'rewrite_clean',  // Rewrite 清理
    'script_performance' // 脚本性能
  ],
  
  // 重试次数
  RETRIES: 3,
  
  // 超时时间（毫秒）
  TIMEOUT: 5000,
};

// ════════════════════════════════════════════════════════
// 📊 性能测试器
// ════════════════════════════════════════════════════════

class PerformanceTester {
  constructor(testName) {
    this.testName = testName;
    this.results = [];
  }

  /**
   * 执行单次测试
   */
  async runTest() {
    const startTime = Date.now();
    let memoryUsage = 0;

    try {
      // 模拟广告过滤操作
      const testData = this.generateTestData();
      const cleanedData = this.cleanAdResponse(testData);

      const duration = Date.now() - startTime;
      
      // 估算内存使用（简化版）
      const stringSize = JSON.stringify(cleanedData).length;
      memoryUsage = Math.round(stringSize / 1024); // KB

      return {
        success: true,
        duration,
        memoryUsage,
        data: cleanedData
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 生成测试数据
   */
  generateTestData() {
    return {
      items: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        content: `item_${i}`,
        ...(i % 3 === 0 ? { ad: { banner: 'ad_banner', sponsor: 'sponsored' } } : {}),
        ...(i % 5 === 0 ? { track: { analytics: 'analytics_data' } } : {})
      })),
      meta: {
        total: 50,
        ad_count: 17,
        track_count: 10
      }
    };
  }

  /**
   * 广告清理函数（与 adfilter-engine 一致）
   */
  cleanAdResponse(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.filter(item => !this.isAdItem(item));
    }

    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.isAdField(key, value)) {
        continue;
      }
      result[key] = this.cleanAdResponse(value);
    }
    return result;
  }

  isAdItem(item) {
    if (!item || typeof item !== 'object') return false;
    
    const patterns = [/^ad_/, /ads?$/, /^(banner|splash)/i];
    for (const value of Object.values(item)) {
      if (typeof value === 'string') {
        for (const pattern of patterns) {
          if (pattern.test(value)) return true;
        }
      }
    }
    return false;
  }

  isAdField(key) {
    const keywords = ['ad', 'ads', 'sponsor', 'track', 'analytics'];
    const lowerKey = key.toLowerCase();
    return keywords.some(k => lowerKey.includes(k));
  }

  /**
   * 运行多次测试取平均值
   */
  async runMultipleTests(times = TEST_CONFIG.RETRIES) {
    console.log(`🧪 Starting ${this.testName} test (${times} runs)...`);
    
    const results = [];
    for (let i = 0; i < times; i++) {
      const result = await this.runTest();
      results.push(result);
      console.log(`Run ${i + 1}: ${result.success ? '✅' : '❌'} ${result.duration}ms, ${result.memoryUsage}KB`);
    }

    // 计算统计信息
    const validResults = results.filter(r => r.success);
    if (validResults.length === 0) {
      console.error('⚠️ All tests failed!');
      return null;
    }

    const avgDuration = validResults.reduce((sum, r) => sum + r.duration, 0) / validResults.length;
    const avgMemory = validResults.reduce((sum, r) => sum + r.memoryUsage, 0) / validResults.length;
    const maxDuration = Math.max(...validResults.map(r => r.duration));
    const minDuration = Math.min(...validResults.map(r => r.duration));

    return {
      testName: this.testName,
      totalRuns: times,
      successfulRuns: validResults.length,
      avgDuration: Math.round(avgDuration * 100) / 100,
      avgMemory: Math.round(avgMemory),
      maxDuration,
      minDuration,
      details: results
    };
  }
}

// ════════════════════════════════════════════════════════
// 🚀 执行测试
// ════════════════════════════════════════════════════════

async function runPerformanceTests() {
  console.log('🎯 Starting Ad-Blocking Performance Tests...\n');

  const tester = new PerformanceTester('ad_filter_v8.1');
  const result = await tester.runMultipleTests(TEST_CONFIG.RETRIES);

  if (result) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PERFORMANCE RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Test Name: ${result.testName}`);
    console.log(`Successful Runs: ${result.successfulRuns}/${result.totalRuns}`);
    console.log(`Average Duration: ${result.avgDuration}ms`);
    console.log(`Average Memory: ${result.avgMemory}KB`);
    console.log(`Duration Range: ${result.minDuration}ms - ${result.maxDuration}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 保存测试结果
    if (typeof $persistentStore !== 'undefined') {
      try {
        $persistentStore.write(JSON.stringify(result));
        console.log('✅ Results saved to persistent store');
      } catch (e) {
        console.error('Failed to save results:', e);
      }
    }
  } else {
    console.error('❌ Performance tests failed!');
  }

  return result;
}

// ════════════════════════════════════════════════════════
// 💡 提示与通知
// ════════════════════════════════════════════════════════

if (typeof $notification !== 'undefined') {
  $notification.post(
    '🎯 去广告性能测试',
    '开始运行性能测试，请稍候...',
    '查看控制台输出详细信息'
  );
} else if (typeof $notify !== 'undefined') {
  $notify(
    '🎯 去广告性能测试',
    '开始运行性能测试，请稍候...',
    '查看控制台输出详细信息'
  );
}

// 执行测试
runPerformanceTests().then(result => {
  if (result && result.successfulRuns > 0) {
    console.log('🎉 Performance tests completed successfully!');
  } else {
    console.log('⚠️ Performance tests encountered issues.');
  }
});
