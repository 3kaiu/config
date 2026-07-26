/**
 * Test Suite for Overseas Plugin Enhancements v8.3
 * 覆盖海外社交、流媒体、购物应用增强插件
 */

const { runScript, createSandbox } = require('../harness');

describe('Overseas Social Tools', () => {
  const sandbox = createSandbox('loon');

  describe('Instagram Feed Clean', () => {
    it('should clean Instagram feed ads', async (assert) => {
      const input = {
        url: 'https://api.instagram.com/v1/feed',
        method: 'GET'
      };

      const result = await runScript(sandbox, `
        if (typeof $response !== 'undefined') {
          const obj = JSON.parse($response.body);
          if (obj.data && Array.isArray(obj.data)) {
            obj.data = obj.data.filter(item => item.ad_type === undefined);
          }
          $done({ body: JSON.stringify(obj) });
        }
      `, { response: { body: JSON.stringify({ data: [{ ad_type: 'sponsored' }, { type: 'normal' }] }) } });

      assert.equal(result.doneCalls.length, 1, 'Should call $done once');
    });
  });

  describe('Facebook News Feed Clean', () => {
    it('should clean sponsored posts from Facebook news feed', async (assert) => {
      const result = await runScript(sandbox, `
        if (typeof $response !== 'undefined') {
          const obj = JSON.parse($response.body);
          if (obj.data && Array.isArray(obj.data)) {
            obj.data = obj.data.filter(item => !item.is_sponsored);
          }
          $done({ body: JSON.stringify(obj) });
        }
      `, { response: { body: JSON.stringify({ data: [{ is_sponsored: true }, { is_sponsored: false }] }) } });

      assert.ok(result.logs.some(log => log.includes('News Feed Clean')), 'Should log cleanup message');
    });
  });
});

describe('Netflix Enhancement', () => {
  const sandbox = createSandbox('loon');

  it('should unlock video quality for Netflix', async (assert) => {
    const result = await runScript(sandbox, `
      if (typeof $response !== 'undefined') {
        const obj = JSON.parse($response.body);
        if (obj.available_versions) {
          const maxQuality = Math.max(...obj.available_versions.map(v => v.quality));
          obj.current_quality = maxQuality;
        }
        $done({ body: JSON.stringify(obj) });
      }
    `, { response: { body: JSON.stringify({ available_versions: [{ quality: 1080 }, { quality: 4000 }] }) } });

    const parsed = JSON.parse(result.state.httpCalls[0].body);
    assert.equal(parsed.current_quality, 4000, 'Should use maximum quality');
  });

  it('should remove Netflix ads', async (assert) => {
    const result = await runScript(sandbox, `
      if (typeof $response !== 'undefined') {
        const obj = JSON.parse($response.body);
        if (obj.ads && Array.isArray(obj.ads)) {
          obj.ads = [];
        }
        $done({ body: JSON.stringify(obj) });
      }
    `, { response: { body: JSON.stringify({ ads: [{ ad: 'pre-roll' }, { ad: 'mid-roll' }] }) } });

    const parsed = JSON.parse(result.state.httpCalls[0].body);
    assert.equal(parsed.ads.length, 0, 'Should remove all ads');
  });
});

describe('Disney+ Region Unlock', () => {
  const sandbox = createSandbox('loon');

  it('should unlock Disney+ content for different regions', async (assert) => {
    const result = await runScript(sandbox, `
      if (typeof $response !== 'undefined') {
        const obj = JSON.parse($response.body);
        if (obj.catalog && obj.catalog.items) {
          obj.catalog.items = obj.catalog.items.filter(item => item.available_in_region === true);
        }
        $done({ body: JSON.stringify(obj) });
      }
    `, { response: { body: JSON.stringify({ catalog: { items: [{ available_in_region: true }, { available_in_region: false }] } }) } });

    const parsed = JSON.parse(result.state.httpCalls[0].body);
    assert.equal(parsed.catalog.items.length, 1, 'Should filter by region availability');
  });
});

describe('Spotify Lossless Audio', () => {
  const sandbox = createSandbox('loon');

  it('should enable lossless audio quality', async (assert) => {
    const result = await runScript(sandbox, `
      if (typeof $response !== 'undefined') {
        const obj = JSON.parse($response.body);
        if (obj.preferences) {
          obj.preferences.audio_quality = 'lossless';
        }
        $done({ body: JSON.stringify(obj) });
      }
    `, { response: { body: JSON.stringify({ preferences: { audio_quality: 'high' } }) } });

    const parsed = JSON.parse(result.state.httpCalls[0].body);
    assert.equal(parsed.preferences.audio_quality, 'lossless', 'Should set to lossless');
  });
});

describe('YouTube Ad Blocking', () => {
  const sandbox = createSandbox('loon');

  it('should block YouTube ads in player response', async (assert) => {
    const result = await runScript(sandbox, `
      if (typeof $response !== 'undefined') {
        const obj = JSON.parse($response.body);
        if (obj.playerAds && Array.isArray(obj.playerAds)) {
          obj.playerAds = [];
        }
        $done({ body: JSON.stringify(obj) });
      }
    `, { response: { body: JSON.stringify({ playerAds: [{ ad: 'pre-roll' }] }) } });

    const parsed = JSON.parse(result.state.httpCalls[0].body);
    assert.equal(parsed.playerAds.length, 0, 'Should remove player ads');
  });

  it('should enable background play and PiP', async (assert) => {
    const result = await runScript(sandbox, `
      if (typeof $response !== 'undefined') {
        const obj = JSON.parse($response.body);
        if (!obj.backgroundPlayEnabled) {
          obj.backgroundPlayEnabled = true;
        }
        if (!obj.pipEnabled) {
          obj.pipEnabled = true;
        }
        $done({ body: JSON.stringify(obj) });
      }
    `, { response: { body: JSON.stringify({}) } });

    const parsed = JSON.parse(result.state.httpCalls[0].body);
    assert.equal(parsed.backgroundPlayEnabled, true, 'Should enable background play');
    assert.equal(parsed.pipEnabled, true, 'Should enable PiP');
  });
});

describe('Amazon Product Recommendations', () => {
  const sandbox = createSandbox('loon');

  it('should clean Amazon product recommendations', async (assert) => {
    const result = await runScript(sandbox, `
      if (typeof $response !== 'undefined') {
        const obj = JSON.parse($response.body);
        if (obj.recommendations && Array.isArray(obj.recommendations)) {
          obj.recommendations = obj.recommendations.filter(r => r.type !== 'sponsored');
        }
        $done({ body: JSON.stringify(obj) });
      }
    `, { response: { body: JSON.stringify({ recommendations: [{ type: 'sponsored' }, { type: 'organic' }] }) } });

    const parsed = JSON.parse(result.state.httpCalls[0].body);
    assert.equal(parsed.recommendations.length, 1, 'Should remove sponsored recommendations');
  });
});

describe('eBay Sponsored Products', () => {
  const sandbox = createSandbox('loon');

  it('should filter sponsored products from eBay search results', async (assert) => {
    const result = await runScript(sandbox, `
      if (typeof $response !== 'undefined') {
        const obj = JSON.parse($response.body);
        if (obj.results && Array.isArray(obj.results)) {
          obj.results = obj.results.filter(r => !r.is_sponsored);
        }
        $done({ body: JSON.stringify(obj) });
      }
    `, { response: { body: JSON.stringify({ results: [{ is_sponsored: true }, { is_sponsored: false }] }) } });

    const parsed = JSON.parse(result.state.httpCalls[0].body);
    assert.equal(parsed.results.length, 1, 'Should filter sponsored products');
  });
});

describe('Privacy Protection', () => {
  const sandbox = createSandbox('loon');

  it('should block Facebook pixel tracking', async (assert) => {
    const request = {
      url: 'https://www.facebook.com/tr?events=pixel_data'
    };

    const result = await runScript(sandbox, `
      if (url.includes('facebook.com/tr')) {
        $done({ status: 403 });
      } else {
        $done();
      }
    `, {}, { request });

    assert.equal(result.state.httpCalls[0].status, 403, 'Should block Facebook pixel');
  });

  it('should block Google Analytics', async (assert) => {
    const request = {
      url: 'https://www.google-analytics.com/collect?v=1'
    };

    const result = await runScript(sandbox, `
      if (url.includes('google-analytics.com/collect')) {
        $done({ status: 403 });
      } else {
        $done();
      }
    `, {}, { request });

    assert.equal(result.state.httpCalls[0].status, 403, 'Should block Google Analytics');
  });
});
