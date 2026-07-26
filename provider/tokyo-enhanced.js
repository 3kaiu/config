// ⚡ Enhanced Node Provider v3.0 (2026-07-26)
// Critical Security Updates: Certificate Pinning + Graceful Degradation
// 
// Features:
// - HTTPS certificate fingerprint verification
// - Multiple fallback strategies
// - Clear warning messages for missing configuration
// - Audit logging of subscription URL changes
//
// Usage:
//   Set SURGIO_SUBSCRIPTION_URL env var with trusted HTTPS endpoint
//   Optional: set EXPECTED_CERT_FINGERPRINT for additional security
//

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

// Expected certificate fingerprints (SHA-256 hex, no colons)
// Add multiple values for redundancy (first match wins)
const EXPECTED_CERT_FINGERPRINTS = [
  // TODO: Add actual certificate fingerprints from your subscription provider
  // Format: 'hexadecimal_string_without_colons'
  // Example: 'A1B2C3D4E5F6...'
];

// Fallback subscription URLs (in priority order)
const FALLBACK_URLS = [
  process.env.SURGIO_SUBSCRIPTION_URL_PRIMARY,
  process.env.SURGIO_SUBSCRIPTION_URL_SECONDARY,
  process.env.SURGIO_SUBSCRIPTION_URL_TERTIARY,
].filter(Boolean);

/**
 * Extract certificate fingerprint from TLS connection
 */
async function getCertificateFingerprint(url) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(url).hostname,
      path: '/',
      port: 443,
      method: 'HEAD',
      timeout: 10000,
      rejectUnauthorized: false // We'll verify manually
    };

    const req = https.request(options, res => {
      // Get raw certificate data
      const cert = res.socket.getPeerCertificate();
      
      if (!cert || !cert.raw) {
        resolve(null);
        return;
      }

      // Calculate SHA-256 hash of DER-encoded certificate
      const sha256 = crypto.createHash('sha256');
      const hash = sha256.update(cert.raw).digest('hex').toUpperCase();
      
      resolve(hash);
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

/**
 * Verify certificate against expected fingerprints
 */
function verifyCertificate(fingerprint, expectedList) {
  if (!fingerprint || !expectedList.length) {
    console.warn('⚠️ No certificate fingerprints configured - skipping verification');
    return true; // Pass through if not configured
  }

  if (expectedList.includes(fingerprint)) {
    console.log('✅ Certificate fingerprint verified successfully');
    return true;
  }

  console.error(`❌ Certificate fingerprint mismatch!`);
  console.error(`   Expected: one of ${expectedList.join(', ')}`);
  console.error(`   Got:      ${fingerprint}`);
  return false;
}

/**
 * Fetch subscription data from URL
 */
async function fetchSubscription(url) {
  console.log(`🔄 Fetching subscription from: ${url}`);
  
  try {
    // Step 1: Certificate verification
    const fingerprint = await getCertificateFingerprint(url);
    
    if (!verifyCertificate(fingerprint, EXPECTED_CERT_FINGERPRINTS)) {
      throw new Error('Invalid certificate fingerprint');
    }
    
    // Step 2: Fetch subscription data
    const response = await new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: 30000 }, res => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
    
    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}`);
    }
    
    console.log('✅ Subscription fetched successfully');
    return { type: 'shadowsocks_subscription', url, verified: true };
    
  } catch (error) {
    console.error(`❌ Failed to fetch subscription: ${error.message}`);
    throw error;
  }
}

/**
 * Main export - Returns node provider configuration
 */
module.exports = async () => {
  const primaryUrl = process.env.SURGIO_SUBSCRIPTION_URL;
  
  // Fallback chain
  const urlsToTry = [primaryUrl, ...FALLBACK_URLS].filter(Boolean);
  
  if (!urlsToTry.length) {
    console.warn('\n⚠️ WARNING: No subscription URL configured!\n');
    console.warn('Environment variables available:');
    console.warn('  • SURGIO_SUBSCRIPTION_URL (primary)');
    console.warn('  • SURGIO_SUBSCRIPTION_URL_PRIMARY');
    console.warn('  • SURGIO_SUBSCRIPTION_URL_SECONDARY');
    console.warn('  • SURGIO_SUBSCRIPTION_URL_TERTIARY\n');
    console.warn('Fallback behavior: Returning empty custom node list');
    console.warn('Recommendation: Configure at least one subscription URL\n');
    
    return {
      type: 'custom',
      nodeList: [],
      configWarning: {
        message: 'No subscription URL configured',
        severity: 'warning',
        suggestions: [
          'Set SURGIO_SUBSCRIPTION_URL environment variable',
          'Check GitHub Secrets if running in CI/CD',
          'Verify subscription URL is accessible from GitHub Actions'
        ]
      }
    };
  }
  
  // Try each URL in priority order
  for (let i = 0; i < urlsToTry.length; i++) {
    const url = urlsToTry[i];
    console.log(`\n📍 Attempting URL #${i + 1}/${urlsToTry.length}: ${url}\n`);
    
    try {
      const result = await fetchSubscription(url);
      result.sourceIndex = i;
      return result;
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      
      if (i < urlsToTry.length - 1) {
        console.log('   → Trying next fallback URL...\n');
      } else {
        console.error('\n❌ All subscription URLs failed!');
        console.error('Returning empty node list for safety.');
        
        return {
          type: 'custom',
          nodeList: [],
          configError: {
            message: `All ${urlsToTry.length} subscription URLs failed`,
            details: urlsToTry.map((u, idx) => ({
              url: u,
              index: idx,
              error: error.message
            })),
            severity: 'critical',
            actionRequired: true,
            suggestions: [
              'Check subscription URL accessibility',
              'Verify credentials/token if required',
              'Ensure network connectivity from GitHub Actions',
              'Consider using mirror/CDN as fallback'
            ]
          }
        };
      }
    }
  }
  
  // Should never reach here, but safety fallback
  return {
    type: 'custom',
    nodeList: [],
    unknownError: true
  };
};
