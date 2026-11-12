import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SALESFORCE_PRODUCTION_HOST,
  SALESFORCE_SANDBOX_HOST,
  isKiteFullSandboxUsername,
  salesforceRecordBaseUrl,
  salesforceRecordHostForPage,
} from '../src/lib/salesforceRecordLinks.js';

test('Salesforce record links use sandbox when the current page address contains sandbox', () => {
  const pageUrl = 'https://kitepharma--kitefull.sandbox.lightning.force.com/lightning/page/home';

  assert.equal(salesforceRecordHostForPage(pageUrl), SALESFORCE_SANDBOX_HOST);
  assert.equal(
    salesforceRecordBaseUrl('User', pageUrl),
    `${SALESFORCE_SANDBOX_HOST}/lightning/r/User`
  );
});

test('iPad current User Username ending in kitefull selects sandbox', () => {
  const username = 'medical.user@kitepharma.com.kitefull';

  assert.equal(isKiteFullSandboxUsername(username), true);
  assert.equal(
    salesforceRecordHostForPage('file:///ipad/myinsights/index.html', username),
    SALESFORCE_SANDBOX_HOST
  );
});

test('iPad current User Username without kitefull selects production', () => {
  const username = 'medical.user@kitepharma.com';

  assert.equal(isKiteFullSandboxUsername(username), false);
  assert.equal(
    salesforceRecordHostForPage('file:///ipad/myinsights/index.html', username),
    SALESFORCE_PRODUCTION_HOST
  );
});

test('App resolves the CRM username once and supplies it to both record-link surfaces', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(source, /Promise\.all\(\[getCurrentUserProfileName\(\), getCurrentUserUsername\(\)\]\)/);
  assert.equal((source.match(/currentUserUsername=\{currentUserUsername\}/g) || []).length, 2);
});

test('Salesforce record links remove sandbox when the current page is not sandbox', () => {
  const pageUrl = 'https://kitepharma.lightning.force.com/lightning/page/home';

  assert.equal(salesforceRecordHostForPage(pageUrl), SALESFORCE_PRODUCTION_HOST);
  assert.equal(
    salesforceRecordBaseUrl('Account_Plan_vod__c', pageUrl),
    `${SALESFORCE_PRODUCTION_HOST}/lightning/r/Account_Plan_vod__c`
  );
});
