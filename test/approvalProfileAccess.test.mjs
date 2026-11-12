import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CTAM_MANAGER_PROFILE,
  isCtamManagerProfile,
  isMpdApprovalRestrictedProfile,
  MPD_APPROVAL_RESTRICTED_PROFILES,
} from '../src/lib/approvalProfileAccess.js';

test('MPD approval is restricted for the requested profiles', () => {
  assert.deepEqual(MPD_APPROVAL_RESTRICTED_PROFILES, [
    'KPH-Key Account Director',
    'KPH-CTAM Manager',
  ]);
  assert.equal(isMpdApprovalRestrictedProfile('KPH-Key Account Director'), true);
  assert.equal(isMpdApprovalRestrictedProfile('KPH-CTAM Manager'), true);
});

test('MPD approval profile matching is whitespace and case insensitive', () => {
  assert.equal(isMpdApprovalRestrictedProfile('  kph-key   account director  '), true);
  assert.equal(isMpdApprovalRestrictedProfile('kph-ctam manager'), true);
  assert.equal(isMpdApprovalRestrictedProfile('Commercial Profile'), false);
  assert.equal(isMpdApprovalRestrictedProfile(null), false);
});

test('CTAM manager launcher access only matches the exact normalized manager profile', () => {
  assert.equal(CTAM_MANAGER_PROFILE, 'KPH-CTAM Manager');
  assert.equal(isCtamManagerProfile('KPH-CTAM Manager'), true);
  assert.equal(isCtamManagerProfile('  kph-ctam   manager  '), true);
  assert.equal(isCtamManagerProfile('KPH-Key Account Director'), false);
  assert.equal(isCtamManagerProfile('CTAM Manager'), false);
  assert.equal(isCtamManagerProfile(null), false);
});
