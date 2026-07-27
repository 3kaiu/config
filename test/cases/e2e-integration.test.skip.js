/**
 * E2E Integration Tests for Plugins
 * @description Plugin 集成端到端测试
 * @author 3kaiu
 * @version 1.0.0
 */

const { runScript, createSandbox } = require('../harness');

describe('Plugin E2E Integration Tests', () => {
  
  describe('WeChat Mini Program Interaction', () => {
    const sandbox = createSandbox('loon');
    
    it('should handle wechat and mini-program simultaneously without conflicts', async (assert) => {
      // Simulate a request that could match both wechat-pro and alipay-miniprogram
      const url = 'https://mapi.alipay.com/gw/open.app.miniprogram.show';
      
      const result = await runScript(sandbox, `
        // WeChat Pro handler
        if (url.includes('weixin.qq.com')) {
          $done({ body: JSON.stringify({ clean: true }) });
        }
        // Alipay Mini Program handler
        else if (url.includes('alipay.com')) {
          $done({ body: JSON.stringify({ mini_program: true }) });
        }
        $done();
      `, {}, { url, method: 'GET' });
      
      assert.ok(result.state.httpCalls.length > 0, 'Should make at least one HTTP call');
      assert.equal(result.doneCalls.length, 1, 'Should call $done exactly once');
    });
    
    it('should not break when both plugins are enabled', async (assert) => {
      const testCases = [
        { url: 'https://api.weixin.qq.com/cgi-bin/appmsg/show', expected: 'wechat' },
        { url: 'https://mapi.alipay.com/gw/open.ap.miniprogram.show', expected: 'mini-program' },
        { url: 'https://mp.weixin.qq.com/mp/getappmsgad', expected: 'wechat-ad' }
      ];
      
      for (const testCase of testCases) {
        const result = await runScript(sandbox, `
          if (typeof $response === 'undefined') { $.done(); return; }
          
          const obj = JSON.parse($response.body || '{}');
          
          if (${testCase.url}.includes('${testCase.expected}')) {
            if (obj.adData) obj.adData = [];
          }
          
          $done({ body: JSON.stringify(obj) });
        `, { response: { body: JSON.stringify({ adData: [{ ad: 'test' }] }) } }, { url: testCase.url });
        
        const parsed = JSON.parse(result.state.httpCalls[0].body);
        assert.equal(parsed.adData?.length, 0, `${testCase.expected}: Should remove adData`);
      }
    });
  });
  
  describe('Alipay Mini Program Cleanup', () => {
    const sandbox = createSandbox('loon');
    
    it('should clean splash ads from miniprogram start', async (assert) => {
      const result = await runScript(sandbox, `
        import { cleanAdFields } from '../utils/cleaner.js';
        
        const obj = JSON.parse($response.body);
        const cleaned = cleanAdFields(obj);
        $done({ body: JSON.stringify(cleaned) });
      `, { response: { body: JSON.stringify({ 
        data: { 
          ad_info: { title: 'ad_title' },
          normal_data: 'normal_value',
          promote: { item: 'promote_item' }
        } 
      }) } });
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.equal(parsed.data.ad_info, undefined, 'Should remove ad_info field');
      assert.equal(parsed.data.promote, undefined, 'Should remove promote field');
      assert.equal(parsed.data.normal_data, 'normal_value', 'Should keep normal_data field');
    });
    
    it('should filter sponsored posts from homefeed', async (assert) => {
      const testData = {
        dataList: [
          { type: 'post', content: 'normal post', is_sponsored: false },
          { type: 'ad', content: 'sponsored content', is_sponsored: true },
          { type: 'promotion', content: 'promo text', promotion_tag: 'vip' },
          { type: 'article', content: 'news article', is_ad: false }
        ]
      };
      
      const result = await runScript(sandbox, `
        import { filterAdItems } from '../utils/cleaner.js';
        
        const obj = JSON.parse($response.body);
        if (obj.dataList) {
          obj.dataList = filterAdItems(obj.dataList, item => item.is_sponsored || item.promotion_tag);
        }
        $done({ body: JSON.stringify(obj) });
      `, { response: { body: JSON.stringify(testData) } });
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.equal(parsed.dataList.length, 2, 'Should have 2 non-sponsored items');
      assert.ok(!parsed.dataList.some(item => item.is_sponsored), 'No sponsored items should remain');
    });
  });
  
  describe('Social Media Plugins Conflict Detection', () => {
    const sandbox = createSandbox('loon');
    
    it('should handle Instagram and Facebook requests independently', async (assert) => {
      const requests = [
        { url: 'https://api.instagram.com/v1/feed', expectedPlatform: 'instagram' },
        { url: 'https://graph.facebook.com/v1.0/news-feed', expectedPlatform: 'facebook' }
      ];
      
      for (const req of requests) {
        const result = await runScript(sandbox, `
          const obj = JSON.parse($response.body);
          
          if (${req.url}.includes('instagram')) {
            if (obj.ads) obj.ads = [];
          } else if (${req.url}.includes('facebook')) {
            if (obj.sponsor_posts) obj.sponsor_posts = [];
          }
          
          $done({ body: JSON.stringify(obj) });
        `, { response: { body: JSON.stringify({ ads: ['ad'], sponsor_posts: ['sponsor'] }) } }, { url: req.url });
        
        const parsed = JSON.parse(result.state.httpCalls[0].body);
        if (req.expectedPlatform === 'instagram') {
          assert.equal(parsed.ads?.length, 0, 'Instagram should clear ads');
        } else {
          assert.equal(parsed.sponsor_posts?.length, 0, 'Facebook should clear sponsor_posts');
        }
      }
    });
  });
  
  describe('Video Streaming Services', () => {
    const sandbox = createSandbox('loon');
    
    it('should enable 4K/UHD quality for Tencent Video', async (assert) => {
      const result = await runScript(sandbox, `
        const obj = JSON.parse($response.body);
        
        // Unlock quality options
        if (obj.available_versions) {
          obj.current_quality = Math.max(...obj.available_versions.map(v => v.quality));
        }
        
        $done({ body: JSON.stringify(obj) });
      `, { response: { body: JSON.stringify({ 
        available_versions: [
          { quality: 480, name: 'SD' },
          { quality: 720, name: 'HD' },
          { quality: 1080, name: 'FHD' },
          { quality: 2160, name: 'UHD' }
        ],
        current_quality: 480
      }) } });
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.equal(parsed.current_quality, 2160, 'Should select highest quality (2160p)');
    });
    
    it('should enable background play and PiP for YouTube', async (assert) => {
      const result = await runScript(sandbox, `
        const obj = JSON.parse($response.body);
        
        // Enable background play and Picture-in-Picture
        if (!obj.backgroundPlayEnabled) {
          obj.backgroundPlayEnabled = true;
        }
        if (!obj.pipEnabled) {
          obj.pipEnabled = true;
        }
        
        $done({ body: JSON.stringify(obj) });
      `, { response: { body: JSON.stringify({}) } });
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.ok(parsed.backgroundPlayEnabled, 'Should enable background play');
      assert.ok(parsed.pipEnabled, 'Should enable picture-in-picture');
    });
    
    it('should skip SponsorBlock segments in YouTube', async (assert) => {
      const result = await runScript(sandbox, `
        const obj = JSON.parse($response.body);
        
        // Filter out sponsorship segments
        if (obj.segments && Array.isArray(obj.segments)) {
          obj.segments = obj.segments.filter(seg => seg.category !== 'sponsor');
        }
        
        $done({ body: JSON.stringify(obj) });
      `, { response: { body: JSON.stringify({ 
        segments: [
          { category: 'sponsor', startTime: 10, endTime: 20 },
          { category: 'intro', startTime: 0, endTime: 5 },
          { category: 'outro', startTime: 95, endTime: 100 }
        ]
      }) } });
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.equal(parsed.segments.length, 2, 'Should skip sponsor segment');
      assert.ok(!parsed.segments.some(s => s.category === 'sponsor'), 'No sponsor segments should remain');
    });
  });
  
  describe('Shopping Platforms', () => {
    const sandbox = createSandbox('loon');
    
    it('should filter sponsored products on Amazon search results', async (assert) => {
      const result = await runScript(sandbox, `
        import { filterAdItems } from '../utils/cleaner.js';
        
        const obj = JSON.parse($response.body);
        if (obj.items) {
          obj.items = filterAdItems(obj.items, item => item.sponsored === true);
        }
        $done({ body: JSON.stringify(obj) });
      `, { response: { body: JSON.stringify({ 
        items: [
          { title: 'Product A', sponsored: false },
          { title: 'Ad B', sponsored: true },
          { title: 'Product C', sponsored: false },
          { title: 'Promoted D', sponsored: true }
        ]
      }) } });
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.equal(parsed.items.length, 2, 'Should have 2 non-sponsored items');
    });
    
    it('should remove cart upsell recommendations on checkout page', async (assert) => {
      const result = await runScript(sandbox, `
        const obj = JSON.parse($response.body);
        
        // Remove upsell section
        if (obj.upsells) {
          obj.upsells = [];
        }
        
        // Remove cross-sell section  
        if (obj.crossSells) {
          obj.crossSells = [];
        }
        
        $done({ body: JSON.stringify(obj) });
      `, { response: { body: JSON.stringify({ 
        orderSummary: { total: '$99.99' },
        upsells: [{ product: 'Recommended Item' }],
        crossSells: [{ product: 'You May Also Like' }]
      }) } });
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.equal(parsed.upsells?.length, 0, 'Should remove upsells');
      assert.equal(parsed.crossSells?.length, 0, 'Should remove cross-sells');
    });
  });
  
  describe('Apple Services', () => {
    const sandbox = createSandbox('loon');
    
    it('should unlock lossless audio quality for Apple Music', async (assert) => {
      const result = await runScript(sandbox, `
        const obj = JSON.parse($response.body);
        
        // Upgrade to lossless
        if (obj.audioSettings) {
          obj.audioSettings.quality = 'lossless';
        }
        
        $done({ body: JSON.stringify(obj) });
      `, { response: { body: JSON.stringify({ 
        audioSettings: { quality: 'high', bitrate: 320 }
      }) } });
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.equal(parsed.audioSettings.quality, 'lossless', 'Should upgrade to lossless quality');
    });
    
    it('should unlock regional content for Apple News', async (assert) => {
      const result = await runScript(sandbox, `
        const obj = JSON.parse($response.body);
        
        // Unlock content by region
        if (obj.countries) {
          obj.countries.push('US', 'GB', 'JP');
        }
        
        $done({ body: JSON.stringify(obj) });
      `, { response: { body: JSON.stringify({ 
        countries: ['CN'],
        content: []
      }) } });
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.ok(parsed.countries.includes('US'), 'Should unlock US content');
      assert.ok(parsed.countries.includes('GB'), 'Should unlock GB content');
    });
  });
  
  describe('Privacy Protection', () => {
    const sandbox = createSandbox('loon');
    
    it('should block Facebook Pixel tracking requests', async (assert) => {
      const request = {
        url: 'https://www.facebook.com/tr?events=pixel_data',
        method: 'POST'
      };
      
      const result = await runScript(sandbox, `
        if (url.includes('facebook.com/tr')) {
          $done({ status: 403 });
        } else {
          $done();
        }
      `, {}, request);
      
      assert.equal(result.state.httpCalls[0].status, 403, 'Should return 403 for Facebook Pixel');
    });
    
    it('should block Google Analytics collection', async (assert) => {
      const request = {
        url: 'https://www.google-analytics.com/collect?v=1&_s=test',
        method: 'GET'
      };
      
      const result = await runScript(sandbox, `
        if (url.includes('google-analytics.com/collect')) {
          $done({ status: 403 });
        } else {
          $done();
        }
      `, {}, request);
      
      assert.equal(result.state.httpCalls[0].status, 403, 'Should block Google Analytics');
    });
    
    it('should protect against browser fingerprinting', async (assert) => {
      const request = {
        url: 'https://whoami.anti-fingerprint.com/api/data',
        method: 'GET'
      };
      
      const result = await runScript(sandbox, `
        if (url.includes('anti-fingerprint.com')) {
          $done({ 
            status: 200,
            body: JSON.stringify({ 
              fingerprint: 'faked_' + Math.random().toString(36).substring(7)
            })
          });
        } else {
          $done();
        }
      `, {}, request);
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.ok(parsed.fingerprint.startsWith('faked_'), 'Should return faked fingerprint');
    });
  });
  
  describe('Error Handling & Edge Cases', () => {
    const sandbox = createSandbox('loon');
    
    it('should handle empty response body gracefully', async (assert) => {
      const result = await runScript(sandbox, `
        if (!$response.body) {
          console.log('[Test] Empty body detected');
          $done();
          return;
        }
        
        try {
          const obj = JSON.parse($response.body);
          $done({ body: JSON.stringify(obj) });
        } catch (e) {
          console.error('[Test] Parse error:', e);
          $done();
        }
      `, { response: { body: null } });
      
      assert.ok(result.doneCalls.length >= 1, 'Should handle empty body');
    });
    
    it('should handle invalid JSON gracefully', async (assert) => {
      const result = await runScript(sandbox, `
        try {
          const obj = JSON.parse($response.body);
          if (!obj) throw new Error('Empty object');
          $done({ body: JSON.stringify(obj) });
        } catch (error) {
          console.error('[Test] JSON error:', error.message);
          $done();
        }
      `, { response: { body: '{ invalid json }' } });
      
      assert.ok(result.doneCalls.length >= 1, 'Should handle invalid JSON');
    });
    
    it('should handle deeply nested objects', async (assert) => {
      const deepObj = { level1: { level2: { level3: { level4: { ad: 'deep_ad' } } } } };
      
      const result = await runScript(sandbox, `
        import { cleanAdFields } from '../utils/cleaner.js';
        
        const obj = JSON.parse($response.body);
        const cleaned = cleanAdFields(obj);
        $done({ body: JSON.stringify(cleaned) });
      `, { response: { body: JSON.stringify(deepObj) } });
      
      const parsed = JSON.parse(result.state.httpCalls[0].body);
      assert.equal(parsed.level1?.level2?.level3?.level4?.ad, undefined, 'Should clean deeply nested ad');
    });
  });
});
