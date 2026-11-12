import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('vendored MyInsights message listener ignores non-Veeva browser messages', async () => {
  const source = await readFile(new URL('../public/static/MyInsightsLibrary.js', import.meta.url), 'utf8');

  assert.match(source, /try\s*\{\s*data = JSON\.parse\(event\.data\);\s*\}\s*catch\(error\)\s*\{\s*return;\s*\}/);
  assert.match(source, /const messageId = data && data\.messageId;/);
  assert.match(source, /if\(!messageId\)\s*\{\s*return;\s*\}/);
});
