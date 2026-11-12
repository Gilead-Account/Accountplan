import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { normalizeCrmBoolean } from '../src/lib/helper/utils.js';

const sharedSource = await readFile(
  new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url),
  'utf8'
);

test('CRM checkbox zero values normalize to false for consistent No display', () => {
  for (const value of [0, '0', false, 'false', 'No']) {
    assert.equal(normalizeCrmBoolean(value), false);
  }
});

test('CRM checkbox one values normalize to true while blanks stay blank', () => {
  for (const value of [1, '1', true, 'true', 'Yes']) {
    assert.equal(normalizeCrmBoolean(value), true);
  }
  assert.equal(normalizeCrmBoolean(null), null);
  assert.equal(normalizeCrmBoolean(undefined), undefined);
  assert.equal(normalizeCrmBoolean(''), '');
});

test('both LT Focus/Sprint Account mappings use the same CRM boolean normalization', () => {
  assert.equal(
    (sharedSource.match(/kltSprintAccount:\s*normalizeCrmBoolean\(r\.KPH_KLT_Sprint_Account__c\)/g) || []).length,
    2
  );
});
