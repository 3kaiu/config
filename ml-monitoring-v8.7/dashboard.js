#!/usr/bin/env node

/**
 * 📊 ML Monitoring Dashboard v1.0 (Alpha)
 * Phase 6: Real-time Performance Visualization
 * 
 * Features:
 * - CLI-based monitoring interface
 * - Anomaly detection visualization
 * - Historical metrics tracking
 * - Alert notification system
 *
 * Usage:
 *   node dashboard.js --watch          # Start live monitoring
 *   node dashboard.js --history 24h    # Show last 24h data
 *   node dashboard.js --alerts         # Display active alerts
 */

const fs = require('fs');
const path = require('path');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Core Dashboard Engine
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class MonitoringDashboard {
  constructor(options = {}) {
    this.config = {
      refreshInterval: 5000,       // 5s polling
      historyWindow: '1h',         // Default 1 hour window
      alertThresholds: {
        inferenceTime: 15,       // ms (P99)
        memoryUsage: 80,         // MB
        errorRate: 5,            // %
        blockRateDrop: 0.5       // percentage points
      },
      ...options
    };
    
    this.metricsHistory = [];
    this.activeAlerts = [];
    this.isRunning = false;
  }
  
  /**
   * Start real-time monitoring loop
   */
  async startWatch() {
    console.log('🚀 Starting ML Monitoring Dashboard...\n');
    console.log('═'.repeat(70));
    console.log('  Live Metrics Feed (Press Ctrl+C to stop)\n');
    console.log('─'.repeat(70));
    
    this.isRunning = true;
    
    while (this.isRunning) {
      try {
        const currentMetrics = await this.fetchMetrics();
        this.updateDisplay(currentMetrics);
        
        if (this.checkAlerts(currentMetrics)) {
          this.generateAlert(currentMetrics);
        }
        
        await this.sleep(this.config.refreshInterval);
        
      } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        await this.sleep(10000);
      }
    }
  }
  
  /**
   * Simulated metric fetcher (replace with actual implementation)
   */
  async fetchMetrics() {
    // In production: fetch from telemetry endpoint or metrics database
    return {
      timestamp: new Date().toISOString(),
      
      // ML Performance
      avgInferenceTime: 4.23,     // ms
      p50InferenceTime: 3.85,
      p99InferenceTime: 8.75,
      modelSizeMB: 2.5,
      
      // Resource Usage
      memoryUsageMB: 47.3,
      cpuUsage: 18.5,            // %
      activeConnections: 62,
      
      // Quality Metrics
      adBlockRate: 99.92,        // %
      falsePositiveRate: 0.08,   // %
      cacheHitRate: 67.4,        // %
      errorRate: 0.02,           // %
      
      // Load Metrics
      requestsPerSecond: 127,
      queueLength: 8,
      
      // Anomaly Scores
      anomalyScore: 0.42,
      severity: 'normal'
    };
  }
  
  /**
   * Render metrics to console
   */
  updateDisplay(metrics) {
    const clearScreen = '\x1B[2J\x1B[0;0H';
    process.stdout.write(clearScreen);
    
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🤖 ML MONITORING DASHBOARD v1.0-alpha                  ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    // Timestamp
    console.log(`🕐 Updated: ${new Date(metrics.timestamp).toLocaleString()}\n`);
    
    // ML Performance Grid
    console.log('┌──────────────────────────────────────────────┬──────────────────────┐');
    console.log('│ ML PERFORMANCE                               │ RESOURCE USAGE       │');
    console.log('├──────────────────────────────────────────────┼──────────────────────┤');
    console.log(`│ Inference Time (avg): ${metrics.avgInferenceTime.toFixed(2).padEnd(24)} │ Memory: ${metrics.memoryUsageMB.toFixed(1).padEnd(18)} MB │`);
    console.log(`│ P50 Latency:     ${metrics.p50InferenceTime.toFixed(2).padEnd(24)} │ CPU:     ${metrics.cpuUsage.toFixed(1).padEnd(18)} %  │`);
    console.log(`│ P99 Latency:     ${metrics.p99InferenceTime.toFixed(2).padEnd(24)} │ Conn:    ${metrics.activeConnections.toString().padEnd(18)}   │`);
    console.log(`│ Model Size:      ${metrics.modelSizeMB.toFixed(2).padEnd(24)} │ Queue:   ${metrics.queueLength.toString().padEnd(18)}   │`);
    console.log('└──────────────────────────────────────────────┴──────────────────────┘\n');
    
    // Quality Metrics
    console.log('┌──────────────────────────────────────────────┬──────────────────────┐');
    console.log('│ QUALITY METRICS                                │ LOAD METRICS         │');
    console.log('├──────────────────────────────────────────────┼──────────────────────┤');
    console.log(`│ Ad Block Rate:    ${metrics.adBlockRate.toFixed(2).padEnd(24)} % │ RPS:       ${metrics.requestsPerSecond.toString().padEnd(18)}   │`);
    console.log(`│ False Positive:   ${metrics.falsePositiveRate.toFixed(2).padEnd(24)} % │ Errors:    ${metrics.errorRate.toFixed(2).padEnd(18)} %   │`);
    console.log(`│ Cache Hit Rate:   ${metrics.cacheHitRate.toFixed(1).padEnd(24)} % │ Anomaly:   ${metrics.anomalyScore.toFixed(3).padEnd(18)}   │`);
    console.log('└──────────────────────────────────────────────┴──────────────────────┘\n');
    
    // Severity indicator
    const severityColors = {
      normal: '\x1B[32m',    // Green
      low: '\x1B[33m',      // Yellow
      medium: '\x1B[36m',   // Cyan
      high: '\x1B[31m',     // Red
      critical: '\x1B[31m\x1B[1m'  // Bold red
    };
    
    const reset = '\x1B[0m';
    console.log(`${severityColors[metrics.severity] || 'normal'}★ System Status: ${metrics.severity.toUpperCase()}${reset}\n`);
    
    // Active alerts
    if (this.activeAlerts.length > 0) {
      console.log('⚠️  ACTIVE ALERTS:\n');
      this.activeAlerts.forEach(alert => {
        console.log(`  🚨 [${alert.timestamp}] ${alert.message}`);
        console.log(`     Score: ${alert.score.toFixed(3)}, Action: ${alert.action}\n`);
      });
    }
    
    console.log('─'.repeat(70));
    console.log(`Polling in ${this.config.refreshInterval/1000}s... (Ctrl+C to exit)`);
  }
  
  /**
   * Check if any thresholds exceeded
   */
  checkAlerts(metrics) {
    const issues = [];
    
    if (metrics.p99InferenceTime > this.config.alertThresholds.inferenceTime) {
      issues.push({ metric: 'inferenceTime', value: metrics.p99InferenceTime, threshold: this.config.alertThresholds.inferenceTime });
    }
    
    if (metrics.memoryUsageMB > this.config.alertThresholds.memoryUsage) {
      issues.push({ metric: 'memoryUsage', value: metrics.memoryUsageMB, threshold: this.config.alertThresholds.memoryUsage });
    }
    
    if (metrics.errorRate > this.config.alertThresholds.errorRate) {
      issues.push({ metric: 'errorRate', value: metrics.errorRate, threshold: this.config.alertThresholds.errorRate });
    }
    
    return issues.length > 0;
  }
  
  /**
   * Generate alert for threshold breach
   */
  generateAlert(metrics) {
    const now = new Date().toISOString();
    
    if (metrics.p99InferenceTime > this.config.alertThresholds.inferenceTime) {
      this.activeAlerts.push({
        timestamp: now,
        message: `High inference latency detected (${metrics.p99InferenceTime.toFixed(2)}ms > ${this.config.alertThresholds.inferenceTime}ms)`,
        score: metrics.p99InferenceTime / 10,
        action: 'Monitor model performance'
      });
    }
    
    if (metrics.memoryUsageMB > this.config.alertThresholds.memoryUsage) {
      this.activeAlerts.push({
        timestamp: now,
        message: `Memory usage critical (${metrics.memoryUsageMB.toFixed(1)}MB > ${this.config.alertThresholds.memoryUsage}MB)`,
        score: metrics.memoryUsageMB / 10,
        action: 'Consider auto-restart'
      });
    }
    
    // Keep only last 5 alerts
    this.activeAlerts = this.activeAlerts.slice(-5);
  }
  
  /**
   * Utility: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Demo Mode
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function runDemoMode() {
  console.log('🎬 ML Monitoring Dashboard - Demo Mode\n');
  
  const dashboard = new MonitoringDashboard({
    refreshInterval: 2000,
    historyWindow: '10s'
  });
  
  // Show demo metrics without live polling
  const demoMetrics = await dashboard.fetchMetrics();
  dashboard.updateDisplay(demoMetrics);
  
  console.log('\n✨ Demo complete! For live monitoring, use:\n');
  console.log('   node dashboard.js --watch\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Entry Point
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--watch')) {
    const dashboard = new MonitoringDashboard();
    dashboard.startWatch().catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
  } else if (args.includes('--demo')) {
    runDemoMode();
  } else {
    // Default: show single snapshot
    const dashboard = new MonitoringDashboard();
    dashboard.fetchMetrics().then(metrics => {
      dashboard.updateDisplay(metrics);
    });
  }
}

module.exports = {
  MonitoringDashboard,
  runDemoMode
};
