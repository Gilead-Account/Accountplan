import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const criticalActivitiesSource = await readFile(
  new URL('../src/pages/CriticalActivities/index.jsx', import.meta.url),
  'utf8'
);
const mainCss = await readFile(new URL('../src/styles/main.css', import.meta.url), 'utf8');

test('Critical Activity title and related cells are vertically centered while staying left aligned', () => {
  assert.match(criticalActivitiesSource, /activity-title-cell[\s\S]*?activity-cell-clamp/);
  assert.match(criticalActivitiesSource, /activity-related-cell[\s\S]*?activity-cell-clamp/);
  assert.match(
    mainCss,
    /\.bd-record-row-flat > strong\.activity-title-cell,[\s\S]*?\.bd-record-row-flat > span\.activity-related-cell\s*\{[\s\S]*?display:\s*flex !important;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*flex-start;/
  );
  assert.match(
    mainCss,
    /\.activity-cell-clamp\s*\{[\s\S]*?display:\s*-webkit-box;[\s\S]*?-webkit-line-clamp:\s*2;[\s\S]*?text-align:\s*left;/
  );
});
