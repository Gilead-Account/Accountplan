import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const regionalModalPath = new URL('../src/pages/AccountProfile/RegionalDynamicsEditModal.jsx', import.meta.url);
const healthcareModalPath = new URL('../src/pages/AccountProfile/HealthcareNetworkEditModal.jsx', import.meta.url);

test('Regional Dynamics modal exposes subheader info guidance', async () => {
  const modalSource = await readFile(regionalModalPath, 'utf8');

  assert.match(modalSource, /from '@\/components\/EditModalField'/);
  assert.match(modalSource, /const REGIONAL_DYNAMICS_HELP = \{/);
  assert.match(modalSource, /FieldHelpButton/);
  assert.match(modalSource, /text=\{REGIONAL_DYNAMICS_HELP\.subheader\}/);
  assert.match(modalSource, /DLBCL Regional Dynamics to be aware of/);
  assert.match(modalSource, /Capture observations on broader market dynamics that may impact the ATC ecosystem/);
  assert.match(modalSource, /competitive shifts, payer changes, system expansions/);
  assert.match(modalSource, /Update as new information becomes available/);
});

test('Healthcare Network modal exposes subheader and Kite Accountable info guidance', async () => {
  const modalSource = await readFile(healthcareModalPath, 'utf8');

  assert.match(modalSource, /from '@\/components\/EditModalField'/);
  assert.match(modalSource, /const HEALTHCARE_NETWORK_HELP = \{/);
  assert.match(modalSource, /FieldHelpButton/);
  assert.match(modalSource, /text=\{HEALTHCARE_NETWORK_HELP\.subheader\}/);
  assert.match(modalSource, /<Field label="Kite Accountable" help=\{HEALTHCARE_NETWORK_HELP\.kiteAccountable\}>/);
  assert.match(modalSource, /Other Healthcare Networks in Region\/Influence out of Region Networks/);
  assert.match(modalSource, /Identify key healthcare systems within the geography/);
  assert.match(modalSource, /those influencing the ATC ecosystem/);
  assert.match(modalSource, /Indicate the corresponding CTAM\/KAD aligned to each system/);
  assert.doesNotMatch(modalSource, /<Field label="Account Name" help=/);
});
