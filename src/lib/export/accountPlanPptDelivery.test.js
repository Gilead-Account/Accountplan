import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatPptDeliveryDiagnostic,
  getPptDeliveryEnvironment,
  shouldBypassWebShare,
  shouldOfferManualPptOpen,
  shouldTryWebShare,
  shouldUsePreOpenedPptWindow,
} from './accountPlanPptDelivery.js';

test('marks iPad-like WebKit as manual-open capable when file sharing is unavailable', () => {
  const env = getPptDeliveryEnvironment({
    nav: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    },
    win: { isSecureContext: true, location: { protocol: 'https:' } },
    doc: {},
    anchorPrototype: { download: '' },
  });

  assert.equal(env.isAppleTouch, true);
  assert.equal(env.canShareFiles, false);
  assert.equal(shouldOfferManualPptOpen(env), true);
  assert.equal(shouldUsePreOpenedPptWindow(env), true);
  assert.equal(shouldBypassWebShare(env), false);
});

test('bypasses Web Share in Veeva iPad file views even when canShare reports support', () => {
  const env = getPptDeliveryEnvironment({
    nav: {
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      platform: 'iPad',
      maxTouchPoints: 5,
      share: () => {},
      canShare: () => true,
    },
    win: { isSecureContext: true, location: { protocol: 'file:' } },
    doc: {},
    anchorPrototype: { download: '' },
    file: {},
  });

  assert.equal(env.isAppleTouch, true);
  assert.equal(env.canShareFiles, true);
  assert.equal(shouldBypassWebShare(env), true);
  assert.equal(shouldTryWebShare(env), false);
  assert.equal(shouldTryWebShare(env, { directShare: true }), true);
  assert.equal(shouldUsePreOpenedPptWindow(env), false);
});

test('diagnostic includes share/download capability flags', () => {
  const env = getPptDeliveryEnvironment({
    nav: { userAgent: 'UnitTest', platform: 'Win32', maxTouchPoints: 0 },
    win: { isSecureContext: false, location: { protocol: 'http:' } },
    doc: {},
    anchorPrototype: {},
  });
  const diagnostic = formatPptDeliveryDiagnostic(env, new Error('blocked'));

  assert.match(diagnostic, /Browser: UnitTest/);
  assert.match(diagnostic, /Web Share: share=no, canShare=no, canShareFiles=no/);
  assert.match(diagnostic, /Anchor download: no/);
  assert.match(diagnostic, /Error: Error: blocked/);
});
