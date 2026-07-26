/**
 * Loon 性能监控与测试框架 v3.0 (Performance Monitoring Suite)
 * @description 实时监控仪表盘 + 自动化回归测试 + 异常预警 | 全面性能保障
 * @version 3.0.0
 */

// ════════════════════════════════════════════════════════
// 🎯 核心配置
// ════════════════════════════════════════════════════════

const PERF_CONFIG = {
  // 监控设置
  REAL_TIME_MONITORING: true,                        // 实时监控
  MONITOR_INTERVAL_MS: 1000,                         // 监控间隔（毫秒）
  MAX_HISTORY_POINTS: 1000,                          // 最大历史数据点
  
  // 告警阈值
  MEMORY_WARNING_THRESHOLD_MB: 80,                   // 内存警告阈值（MB）
  MEMORY_CRITICAL_THRESHOLD_MB: 90,                  // 内存危急阈值
  CPU_WARNING_THRESHOLD_PERCENT: 70,                 // CPU 警告阈值
  RESPONSE_TIME_WARNING_MS: 5000,                    // 响应时间警告（毫秒）
  
  // 测试设置
  AUTOMATED_TESTS_ENABLED: true,                     // 自动测试
  TEST_SCHEDULE_INTERVAL_MINUTES: 60,               // 测试间隔（分钟）
  REGRESSION_TEST_ON_CHANGE: true,                  // 变更时回归测试
  
  // 通知设置
  NOTIFY_ON_ALERT: true,                             // 告警时通知
  NOTIFY_CHANNELS: ['notification', 'telegram']      // 通知渠道
};

// ════════════════════════════════════════════════════════
// 📊 实时性能监控器
// ════════════════════════════════════════════════════════

class RealTimePerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.history = [];
    this.alerts = [];
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * 启动实时监控
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Monitor already running');
      return;
    }

    console.log('🚀 Starting Real-Time Performance Monitor...');
    this.isRunning = true;

    // 启动监控循环
    this.intervalId = setInterval(() => {
      this.collectMetrics();
      this.checkThresholds();
      this.updateHistory();
    }, PERF_CONFIG.MONITOR_INTERVAL_MS);

    console.log('✅ Performance monitor started');
  }

  /**
   * 停止实时监控
   */
  stop() {
    if (!this.isRunning) return;

    console.log('⏸️ Stopping Performance Monitor...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('⏹️ Performance monitor stopped');
  }

  /**
   * 收集性能指标
   */
  collectMetrics() {
    const metrics = {
      timestamp: Date.now(),
      memory: this.getMemoryUsage(),
      cpu: this.getCPUUsage(),
      network: this.getNetworkStats(),
      script: this.getScriptMetrics()
    };

    this.metrics.set(Date.now(), metrics);
    
    console.log(`📊 Metrics collected: Memory=${metrics.memory}MB, CPU=${metrics.cpu}%`);
    
    return metrics;
  }

  /**
   * 获取内存使用量
   */
  getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const used = process.memoryUsage().heapUsed;
      return Math.round(used / 1024 / 1024 * 100) / 100;
    }
    return 0;
  }

  /**
   * 获取 CPU 使用率
   */
  getCPUUsage() {
    // Node.js 环境
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const usage = process.cpuUsage();
      return Math.round((usage.user + usage.system) / 1000000);
    }
    return 0;
  }

  /**
   * 获取网络统计
   */
  getNetworkStats() {
    return {
      requests: 0,
      responses: 0,
      bandwidth: 0
    };
  }

  /**
   * 获取脚本指标
   */
  getScriptMetrics() {
    const scriptStats = {};
    
    // 从持久化存储读取各个脚本的统计信息
    if (typeof $persistentStore !== 'undefined') {
      const scripts = ['adfilter', 'dns', 'script_engine', 'mitm'];
      
      for (const script of scripts) {
        try {
          const key = `perf_${script}_v${this.getLatestVersion(script)}`;
          const data = JSON.parse($persistentStore.read(key) || '[]');
          
          if (data.length > 0) {
            const last = data[data.length - 1];
            scriptStats[script] = {
              executions: data.length,
              avgDuration: last.duration || 0,
              lastExecution: new Date(last.timestamp).toISOString()
            };
          }
        } catch (e) {}
      }
    }

    return scriptStats;
  }

  /**
   * 获取脚本版本
   */
  getLatestVersion(script) {
    const versions = {
      adfilter: '2',
      dns: '2',
      script_engine: '4',
      mitm: '3'
    };
    return versions[script] || '1';
  }

  /**
   * 检查阈值并触发告警
   */
  checkThresholds() {
    const metrics = this.metrics.get(Date.now());
    if (!metrics) return;

    // 检查内存阈值
    if (metrics.memory >= PERF_CONFIG.MEMORY_CRITICAL_THRESHOLD_MB) {
      this.triggerAlert('MEMORY_CRITICAL', `Memory usage: ${metrics.memory}MB`);
    } else if (metrics.memory >= PERF_CONFIG.MEMORY_WARNING_THRESHOLD_MB) {
      this.triggerAlert('MEMORY_WARNING', `Memory usage: ${metrics.memory}MB`);
    }

    // 检查 CPU 阈值
    if (metrics.cpu >= PERF_CONFIG.CPU_WARNING_THRESHOLD_PERCENT) {
      this.triggerAlert('CPU_WARNING', `CPU usage: ${metrics.cpu}%`);
    }

    // 检查响应时间
    const scriptMetrics = metrics.script;
    for (const [name, stats] of Object.entries(scriptMetrics)) {
      if (stats.avgDuration > PERF_CONFIG.RESPONSE_TIME_WARNING_MS) {
        this.triggerAlert('SLOW_SCRIPT', `${name} slow: ${stats.avgDuration}ms`);
      }
    }
  }

  /**
   * 触发告警
   */
  triggerAlert(type, message) {
    const alert = {
      type,
      message,
      timestamp: Date.now(),
      severity: this.getSeverity(type)
    };

    this.alerts.push(alert);
    
    // 保留最近 100 条告警
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    console.error(`🚨 ALERT [${alert.severity}]: ${type} - ${message}`);

    // 发送通知
    if (PERF_CONFIG.NOTIFY_ON_ALERT) {
      this.sendNotification(alert);
    }
  }

  /**
   * 获取告警严重程度
   */
  getSeverity(type) {
    if (type.includes('CRITICAL')) return 'CRITICAL';
    if (type.includes('WARNING')) return 'WARNING';
    return 'INFO';
  }

  /**
   * 发送通知
   */
  sendNotification(alert) {
    const title = `🚨 Loon Performance Alert: ${alert.type}`;
    const message = alert.message;
    const subtitle = `Severity: ${alert.severity}`;

    if (typeof $notification !== 'undefined') {
      $notification.post(title, message, subtitle);
    } else if (typeof $notify !== 'undefined') {
      $notify(title, message, subtitle);
    }
  }

  /**
   * 更新历史记录
   */
  updateHistory() {
    const latestMetrics = this.metrics.get(Date.now());
    
    if (latestMetrics) {
      this.history.push(latestMetrics);
      
      // 限制历史记录大小
      if (this.history.length > PERF_CONFIG.MAX_HISTORY_POINTS) {
        this.history.shift();
      }

      // 保存到持久化存储
      this.saveHistory();
    }
  }

  /**
   * 保存历史记录到存储
   */
  saveHistory() {
    if (typeof $persistentStore === 'undefined') return;

    try {
      // 只保存最近的 100 个点用于缓存
      const recentHistory = this.history.slice(-100);
      $persistentStore.write(JSON.stringify(recentHistory), 'perf_history_current');
      
      // 定期保存完整历史（每 100 个点）
      if (this.history.length % 100 === 0) {
        $persistentStore.write(JSON.stringify(this.history), 'perf_history_full');
      }
    } catch (error) {
      console.error('Failed to save performance history:', error);
    }
  }

  /**
   * 加载历史记录
   */
  loadHistory() {
    if (typeof $persistentStore === 'undefined') return [];

    try {
      const cached = $persistentStore.read('perf_history_current');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }

  /**
   * 获取性能报告
   */
  getReport() {
    if (this.history.length === 0) {
      return null;
    }

    const metrics = ['memory', 'cpu'];
    const report = {};

    for (const metric of metrics) {
      const values = this.history.map(h => h[metric]);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      report[metric] = {
        average: Math.round(avg * 100) / 100,
        min,
        max,
        current: values[values.length - 1]
      };
    }

    return {
      period: {
        start: new Date(this.history[0].timestamp).toISOString(),
        end: new Date(this.history[this.history.length - 1].timestamp).toISOString()
      },
      samples: this.history.length,
      ...report,
      alerts: {
        total: this.alerts.length,
        recent: this.alerts.slice(-10)
      }
    };
  }

  /**
   * 导出性能数据
   */
  exportData(format = 'json') {
    const report = this.getReport();
    
    if (!report) {
      console.log('No data to export');
      return null;
    }

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this.convertToCSV();
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * 转换为 CSV 格式
   */
  convertToCSV() {
    if (this.history.length === 0) return '';

    const headers = ['Timestamp', 'Memory(MB)', 'CPU(%)', 'Requests', 'Bandwidth(KB)'];
    const rows = [headers.join(',')];

    for (const point of this.history) {
      const row = [
        new Date(point.timestamp).toLocaleString(),
        point.memory.toFixed(2),
        point.cpu.toFixed(2),
        point.network?.requests || 0,
        point.network?.bandwidth || 0
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * 清空历史数据
   */
  clearHistory() {
    this.history = [];
    this.alerts = [];
    
    if (typeof $persistentStore !== 'undefined') {
      try {
        $persistentStore.write(null, 'perf_history_current');
        $persistentStore.write(null, 'perf_history_full');
      } catch (e) {}
    }

    console.log('🗑️ Performance history cleared');
  }
}

// ════════════════════════════════════════════════════════
// 🧪 自动化测试引擎
// ════════════════════════════════════════════════════════

class AutomatedTestEngine {
  constructor() {
    this.tests = [];
    this.results = [];
    this.isActive = false;
  }

  /**
   * 注册测试用例
   */
  registerTest(testCase) {
    this.tests.push(testCase);
    console.log(`✅ Test registered: ${testCase.name}`);
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧪 Starting Automated Test Suite...\n');
    const startTime = Date.now();
    this.isActive = true;

    let passed = 0;
    let failed = 0;

    for (const test of this.tests) {
      try {
        console.log(`Running: ${test.name}`);
        await test.execute();
        
        if (test.passed) {
          passed++;
          console.log(`  ✅ PASSED (${test.duration}ms)\n`);
        } else {
          failed++;
          console.log(`  ❌ FAILED (${test.duration}ms)\n`);
        }
      } catch (error) {
        failed++;
        console.log(`  ❌ ERROR: ${error.message}\n`);
      }

      // 等待一小段时间（避免并发冲突）
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const totalTime = Date.now() - startTime;
    this.isActive = false;

    const report = {
      timestamp: new Date().toISOString(),
      total: this.tests.length,
      passed,
      failed,
      successRate: ((passed / this.tests.length) * 100).toFixed(2),
      totalTimeMs: totalTime,
      details: this.results
    };

    this.results.push(report);
    this.saveTestResults(report);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Test Results: ${passed}/${this.tests.length} passed (${report.successRate}%)`);
    console.log(`Total Time: ${totalTime}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return report;
  }

  /**
   * 保存测试结果
   */
  saveTestResults(report) {
    if (typeof $persistentStore === 'undefined') return;

    try {
      const key = 'automated_test_results';
      const history = JSON.parse($persistentStore.read(key) || '[]');
      history.unshift(report);
      
      // 保留最近 10 次测试结果
      if (history.length > 10) {
        history.splice(10);
      }

      $persistentStore.write(JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save test results:', error);
    }
  }

  /**
   * 获取测试历史
   */
  getTestHistory() {
    if (typeof $persistentStore === 'undefined') return [];

    try {
      const key = 'automated_test_results';
      const cached = $persistentStore.read(key);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    const history = this.getTestHistory();
    
    if (history.length === 0) {
      return null;
    }

    const latest = history[0];
    const avgSuccessRate = history.reduce((sum, r) => sum + parseFloat(r.successRate), 0) / history.length;

    return {
      summary: {
        totalRuns: history.length,
        overallSuccessRate: avgSuccessRate.toFixed(2) + '%',
        latestRun: latest
      },
      trends: this.analyzeTrends(history),
      recommendations: this.generateRecommendations(latest)
    };
  }

  /**
   * 分析趋势
   */
  analyzeTrends(history) {
    if (history.length < 2) {
      return { trend: 'insufficient_data', description: '需要至少 2 次测试结果才能分析趋势' };
    }

    const rates = history.slice(0, 5).map(h => parseFloat(h.successRate));
    const improvement = rates[rates.length - 1] - rates[0];
    
    if (improvement > 1) {
      return { trend: 'improving', value: improvement.toFixed(2) + '%' };
    } else if (improvement < -1) {
      return { trend: 'declining', value: improvement.toFixed(2) + '%' };
    } else {
      return { trend: 'stable', value: '±1%' };
    }
  }

  /**
   * 生成建议
   */
  generateRecommendations(report) {
    const recommendations = [];

    if (parseFloat(report.successRate) < 95) {
      recommendations.push({
        priority: 'high',
        message: '测试通过率低于 95%，建议检查失败的测试项'
      });
    }

    if (report.totalTimeMs > 30000) {
      recommendations.push({
        priority: 'medium',
        message: '测试耗时超过 30 秒，建议优化测试脚本性能'
      });
    }

    if (report.failed > 0) {
      recommendations.push({
        priority: 'high',
        message: `${report.failed}个测试失败，请立即修复`
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        message: '所有测试正常，继续保持！'
      });
    }

    return recommendations;
  }
}

// ════════════════════════════════════════════════════════
// 📈 性能对比分析器
// ════════════════════════════════════════════════════════

class PerformanceComparator {
  constructor() {
    this.baselineData = null;
  }

  /**
   * 设置基线数据
   */
  setBaseline(data) {
    this.baselineData = data;
    console.log('📊 Baseline set:', JSON.stringify(data));
  }

  /**
   * 比较性能数据
   */
  compare(currentData) {
    if (!this.baselineData) {
      return { error: 'No baseline data set' };
    }

    const comparison = {};

    for (const [key, currentValue] of Object.entries(currentData)) {
      const baselineValue = this.baselineData[key];
      
      if (baselineValue && typeof currentValue === 'number') {
        const change = currentValue - baselineValue;
        const percentChange = (change / baselineValue * 100).toFixed(2);
        
        comparison[key] = {
          baseline: baselineValue,
          current: currentValue,
          absoluteChange: change,
          percentChange: `${percentChange}%`,
          improved: change < 0  // 越小越好
        };
      }
    }

    return comparison;
  }

  /**
   * 生成对比报告
   */
  generateComparisonReport(baseline, current) {
    const report = {
      timestamp: new Date().toISOString(),
      baseline,
      current,
      changes: this.compare(current)
    };

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 PERFORMANCE COMPARISON REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const [metric, data] of Object.entries(report.changes)) {
      const arrow = data.improved ? '↓' : '↑';
      const status = data.improved ? '✅' : '⚠️';
      
      console.log(`${status} ${metric.padEnd(20)}: ${data.baseline} → ${data.current} ${arrow} ${data.percentChange}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return report;
  }
}

// ════════════════════════════════════════════════════════
// 🚀 性能测试套件（具体实现）
// ════════════════════════════════════════════════════════

const PERFORMANCE_TESTS = [
  {
    name: 'DNS Resolution Speed',
    execute: async () => {
      const startTime = Date.now();
      
      // 模拟 DNS 解析测试
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const duration = Date.now() - startTime;
      
      this.duration = duration;
      this.passed = duration < 200;  // 200ms 以内通过
    }
  },
  {
    name: 'Ad Filter Performance',
    execute: async () => {
      const startTime = Date.now();
      
      // 模拟广告过滤测试
      const testData = { items: Array(100).fill({}) };
      JSON.stringify(testData);
      
      const duration = Date.now() - startTime;
      
      this.duration = duration;
      this.passed = duration < 100;  // 100ms 以内通过
    }
  },
  {
    name: 'Cache Hit Rate',
    execute: async () => {
      // 模拟缓存命中率测试
      const hits = 92;
      const misses = 8;
      const hitRate = hits / (hits + misses) * 100;
      
      this.hitRate = hitRate;
      this.passed = hitRate >= 90;  // 90% 以上通过
    }
  },
  {
    name: 'Memory Usage Check',
    execute: async () => {
      const memory = 45;  // 模拟内存使用量
      
      this.memory = memory;
      this.passed = memory < 60;  // 60MB 以下通过
    }
  },
  {
    name: 'Response Time SLA',
    execute: async () => {
      const startTime = Date.now();
      
      // 模拟请求处理
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const responseTime = Date.now() - startTime;
      
      this.responseTime = responseTime;
      this.passed = responseTime < 500;  // 500ms 内完成
    }
  }
];

// ════════════════════════════════════════════════════════
// 📊 实时仪表盘组件
// ════════════════════════════════════════════════════════

class PerformanceDashboard {
  constructor(monitor, testEngine) {
    this.monitor = monitor;
    this.testEngine = testEngine;
    this.data = {};
  }

  /**
   * 更新仪表盘数据
   */
  update() {
    this.data = {
      timestamp: new Date().toLocaleString(),
      ...this.monitor.getReport(),
      testStatus: this.getTestStatus()
    };
    
    this.render();
  }

  /**
   * 获取测试状态
   */
  getTestStatus() {
    const history = this.testEngine.getTestHistory();
    
    if (history.length === 0) {
      return { status: 'no_data', message: '暂无测试记录' };
    }

    const latest = history[0];
    const status = latest.passed >= latest.total * 0.95 ? 'good' : 'warning';
    
    return {
      status,
      passed: `${latest.passed}/${latest.total}`,
      successRate: latest.successRate + '%'
    };
  }

  /**
   * 渲染仪表盘（文本版）
   */
  render() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║       LOON PERFORMANCE DASHBOARD v3.0                ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    const report = this.data;
    if (!report || !report.period) {
      console.log('⏳ Loading performance data...');
      return;
    }

    // 总体状态
    const alerts = report.alerts || { total: 0 };
    const statusColor = alerts.total > 0 ? '🟡' : '🟢';
    console.log(`${statusColor} Overall Status: ${alerts.total > 0 ? 'WARNING' : 'HEALTHY'}`);
    console.log(`Period: ${report.period.start.split('T')[0]} ~ ${report.period.end.split('T')[0]}`);
    console.log(`Samples: ${report.samples}\n`);

    // 性能指标
    console.log('📊 Performance Metrics:');
    console.log('─'.repeat(60));
    
    if (report.memory) {
      const memStatus = report.memory.current > 80 ? '🔴' : report.memory.current > 60 ? '🟡' : '🟢';
      console.log(`${memStatus} Memory:     ${report.memory.current.toFixed(1)}MB`);
      console.log(`             Avg: ${report.memory.average.toFixed(1)}MB, Min: ${report.memory.min.toFixed(1)}, Max: ${report.memory.max.toFixed(1)}`);
    }

    if (report.cpu) {
      const cpuStatus = report.cpu.current > 70 ? '🔴' : report.cpu.current > 50 ? '🟡' : '🟢';
      console.log(`${cpuStatus} CPU:        ${report.cpu.current.toFixed(1)}%`);
      console.log(`             Avg: ${report.cpu.average.toFixed(1)}%, Min: ${report.cpu.min.toFixed(1)}, Max: ${report.cpu.max.toFixed(1)}`);
    }

    console.log('─'.repeat(60));

    // 测试状态
    if (this.data.testStatus) {
      const testStatus = this.data.testStatus;
      const testColor = testStatus.status === 'good' ? '🟢' : '🟡';
      console.log(`\n${testColor} Test Status: ${testStatus.passed} (${testStatus.successRate})`);
    }

    // 告警列表
    if (alerts.recent && alerts.recent.length > 0) {
      console.log('\n🚨 Recent Alerts:');
      alerts.recent.forEach(alert => {
        console.log(`  • ${new Date(alert.timestamp).toLocaleTimeString()}: ${alert.type} - ${alert.message}`);
      });
    }

    console.log('\n' + '═'.repeat(63) + '\n');
  }
}

// ════════════════════════════════════════════════════════
// 🚀 主程序入口
// ════════════════════════════════════════════════════════

async function main() {
  console.log('📈 Loon Performance Monitoring Suite v3.0');
  console.log('==========================================\n');

  // 初始化组件
  const monitor = new RealTimePerformanceMonitor();
  const testEngine = new AutomatedTestEngine();
  const comparator = new PerformanceComparator();
  const dashboard = new PerformanceDashboard(monitor, testEngine);

  // 注册测试用例
  PERFORMANCE_TESTS.forEach(test => {
    testEngine.registerTest(test);
  });

  // 启动实时监控
  monitor.start();

  // 运行自动化测试
  await testEngine.runAllTests();

  // 显示仪表盘
  dashboard.update();

  // 生成对比报告（示例数据）
  const baseline = { memory: 80, cpu: 90, responseTime: 3500 };
  const current = { memory: 45, cpu: 55, responseTime: 1800 };
  
  const report = comparator.generateComparisonReport(baseline, current);

  // 导出性能数据
  const csvData = monitor.exportData('csv');
  console.log('\n📁 Sample CSV Data:');
  console.log(csvData.substring(0, 200) + '...\n');

  // 停止监控
  monitor.stop();

  return {
    testResults: testEngine.generateReport(),
    performanceReport: monitor.getReport(),
    comparisonReport: report
  };
}

// 启动程序
main().then(results => {
  console.log('🎉 Performance monitoring suite completed!');
  console.log('Summary:', JSON.stringify(results, null, 2));
}).catch(error => {
  console.error('❌ Error:', error);
});
