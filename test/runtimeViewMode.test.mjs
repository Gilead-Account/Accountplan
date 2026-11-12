import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  detectRuntimeViewMode,
  runtimeViewModeSummary,
} from '../src/lib/runtime/viewMode.js';

const makeWindow = ({
  width,
  height,
  userAgent = 'UnitTest',
  platform = 'Win32',
  maxTouchPoints = 0,
  coarsePointer = false,
  finePointer = true,
  href = 'http://localhost:5173/',
  protocol = null,
  hostname = null,
} = {}) => ({
  innerWidth: width,
  innerHeight: height,
  location: {
    href,
    protocol: protocol || new URL(href).protocol,
    hostname: hostname || new URL(href).hostname,
  },
  navigator: {
    userAgent,
    platform,
    maxTouchPoints,
  },
  matchMedia: (query) => ({
    matches:
      (query.includes('pointer: coarse') && coarsePointer) ||
      (query.includes('pointer: fine') && finePointer) ||
      (query.includes('hover: hover') && finePointer),
  }),
});

test('detectRuntimeViewMode follows the app desktop and iPad breakpoint contract', () => {
  assert.equal(detectRuntimeViewMode(makeWindow({ width: 1600, height: 900 })).viewMode, 'desktop');

  const iPadView = detectRuntimeViewMode(makeWindow({
    width: 1024,
    height: 768,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    platform: 'iPad',
    maxTouchPoints: 5,
    coarsePointer: true,
    finePointer: false,
  }));
  assert.equal(iPadView.viewMode, 'ipad');
  assert.equal(iPadView.layoutMode, 'tablet');
  assert.equal(iPadView.isLikelyIPadDevice, true);

  const desktopWebInTabletRange = detectRuntimeViewMode(makeWindow({
    width: 1180,
    height: 720,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    href: 'https://cdnhtml.salesforce.com/kite/index.html',
  }));
  assert.equal(desktopWebInTabletRange.viewMode, 'desktop');
  assert.equal(desktopWebInTabletRange.layoutMode, 'tablet');
  assert.equal(desktopWebInTabletRange.isLikelyIPadDevice, false);
  assert.equal(desktopWebInTabletRange.isHostedWebLink, true);
  assert.equal(desktopWebInTabletRange.reason, 'hosted web link');
});

test('runtimeViewModeSummary includes the detected mode and useful debug signals', () => {
  const summary = runtimeViewModeSummary(detectRuntimeViewMode(makeWindow({
    width: 1366,
    height: 1024,
    platform: 'MacIntel',
    maxTouchPoints: 5,
    coarsePointer: true,
    finePointer: false,
  })));

  assert.match(summary, /Detected iPad view/);
  assert.match(summary, /1366x1024/);
  assert.match(summary, /touch: yes/);
  assert.match(summary, /device: likely iPad/);
});

test('App keeps runtime view mode detection without mounting the debug popup', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(appSource, /detectRuntimeViewMode/);
  assert.doesNotMatch(appSource, /RuntimeViewModeProbe/);
  assert.doesNotMatch(appSource, /<RuntimeViewModeProbe \/>/);
});
