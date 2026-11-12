import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mmInfluenceTriplet,
  stakeholderHasDlbclInfluenceLevel,
  stakeholderMatchesFilters,
} from '../src/lib/helper/utils.js';

const target = {
  role: 'Physician',
  dlbclPriority: 'P1',
  mmPriority: '',
};

const mmTarget = {
  role: 'Pharmacist',
  dlbclPriority: '',
  mmPriority: 'P2',
};

const nonTarget = {
  role: 'Nurse',
  dlbclPriority: null,
  mmPriority: '   ',
};

const mixedTargetWithNonTargetPriority = {
  role: 'Physician',
  dlbclPriority: 'P1',
  mmPriority: 'Non-Target',
};

const explicitCurrentTargetWithBlankPriorities = {
  role: 'Physician',
  dlbclPriority: '',
  mmPriority: '',
  dlbclCurrentTarget: 'Yes',
};

const literalNonTargetPriority = {
  role: 'Nurse',
  dlbclPriority: 'Non-Target',
  mmPriority: '',
};

test('stakeholder target priority filter treats Non-Target as blank DLBCL priority', () => {
  assert.equal(stakeholderMatchesFilters(nonTarget, { priority: 'Non-Target' }), true);
  assert.equal(stakeholderMatchesFilters(target, { priority: 'Non-Target' }), false);
  assert.equal(stakeholderMatchesFilters(mmTarget, { priority: 'Non-Target' }), true);
  assert.equal(stakeholderMatchesFilters(mixedTargetWithNonTargetPriority, { priority: 'Non-Target' }), false);
  assert.equal(stakeholderMatchesFilters(explicitCurrentTargetWithBlankPriorities, { priority: 'Non-Target' }), true);
  assert.equal(stakeholderMatchesFilters(literalNonTargetPriority, { priority: 'Non-Target' }), false);
});

test('stakeholder target priority filter matches the visible DLBCL priority column', () => {
  assert.equal(stakeholderMatchesFilters(target, { priority: 'P1' }), true);
  assert.equal(stakeholderMatchesFilters(mixedTargetWithNonTargetPriority, { priority: 'P1' }), true);
  assert.equal(stakeholderMatchesFilters(mmTarget, { priority: 'P2' }), false);
  assert.equal(stakeholderMatchesFilters(nonTarget, { priority: 'P1' }), false);
});

test('stakeholder DLBCL influence filter matches any High influence category', () => {
  const highClinicalLowFinancial = {
    dlbclClinicalInfluence: 'High',
    dlbclOperationalInfluence: 'Low',
    dlbclFinancialInfluence: 'Low',
  };
  const highFinanceOnly = {
    dlbclClinicalInfluence: 'Low',
    dlbclOperationalInfluence: 'Medium',
    dlbclFinancialInfluence: 'High',
  };
  const noHigh = {
    dlbclClinicalInfluence: 'Medium',
    dlbclOperationalInfluence: 'Low',
    dlbclFinancialInfluence: 'Low',
  };

  assert.equal(stakeholderHasDlbclInfluenceLevel(highClinicalLowFinancial, 'High'), true);
  assert.equal(stakeholderMatchesFilters(highClinicalLowFinancial, { dlbclInfluence: 'High' }), true);
  assert.equal(stakeholderMatchesFilters(highFinanceOnly, { dlbclInfluence: 'High' }), true);
  assert.equal(stakeholderMatchesFilters(noHigh, { dlbclInfluence: 'High' }), false);
  assert.equal(
    stakeholderMatchesFilters({ dlbclInfluence: 'High' }, { dlbclInfluence: 'High' }),
    false
  );
});

test('stakeholder MM influence display only uses CRM-backed influence fields', () => {
  assert.equal(
    mmInfluenceTriplet({
      id: 'stakeholder-without-mm-values',
      name: 'Blank MM Influence',
    }),
    '-/-/-'
  );

  assert.equal(
    mmInfluenceTriplet({
      mmClinicalInfluence: 'High',
      mmOperationalInfluence: '',
      mmFinancialInfluence: null,
    }),
    'H/-/-'
  );

  assert.equal(
    mmInfluenceTriplet({
      mmClinicalInfluence: 'High',
      mmOperationalInfluence: 'Low',
      mmFinancialInfluence: 'Medium',
    }),
    'H/L/M'
  );

  assert.equal(
    stakeholderMatchesFilters({ mmInfluence: 'High' }, { influence: 'High' }),
    false
  );
  assert.equal(
    stakeholderMatchesFilters(
      { mmClinicalInfluence: 'High', mmOperationalInfluence: 'Low', mmFinancialInfluence: 'Medium' },
      { influence: 'High' }
    ),
    true
  );
});
