import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modalPath = new URL('../src/pages/AccountProfile/ReferralAccountEditModal.jsx', import.meta.url);

test('Referral Mapping add/edit modal exposes field-level info guidance for SME fields', async () => {
  const modalSource = await readFile(modalPath, 'utf8');

  assert.match(modalSource, /from '@\/components\/EditModalField'/);
  assert.match(modalSource, /const REFERRAL_MAPPING_HELP = \{/);

  assert.match(modalSource, /<Field label="Referral Priority" help=\{REFERRAL_MAPPING_HELP\.referralPriority\}>/);
  assert.match(modalSource, /<Field label="Indication" help=\{REFERRAL_MAPPING_HELP\.indication\}>/);
  assert.match(modalSource, /<Field label="Comments" help=\{REFERRAL_MAPPING_HELP\.comments\} className="is-textarea">/);

  assert.match(modalSource, /Identifies whether the site is a prioritizes Kite/);
  assert.match(modalSource, /Specifies the disease area or indication relevant to the site/);
  assert.match(modalSource, /DLBCL only or broader portfolio/);
  assert.match(modalSource, /Capture key context on referral behavior/);
  assert.match(modalSource, /any relevant observations that may impact referral flow or account strategy/);

  assert.doesNotMatch(modalSource, /<Field label="Site Name" help=/);
  assert.doesNotMatch(modalSource, /<Field label="HCO Classification" help=/);
  assert.doesNotMatch(modalSource, /<Field label="# of HCP Targets within site" help=/);
});
