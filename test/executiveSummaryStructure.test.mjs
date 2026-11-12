import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAccountPlanExecutiveSummary } from '../src/lib/export/accountPlanExecutiveSummary.js';

const summaryData = {
  home: {
    account: { name: 'Mock Cancer Center', eid: '998877' },
    plan: {
      accountName: 'Mock Cancer Center',
      territoryDescription: 'US - North Region 4',
      lastMpdApprovalDate: '2026-04-15',
    },
    header: {
      atcSegment: 'Inpatient and Outpatient',
      atcCohort: 'Cohort 4',
      mmAtcPriority: 'P1',
      kltSprintAccount: true,
      marketAccessPrioritizedAccount: 'Yes',
      kadTargetList: true,
      referralVolume: '24',
      secondLinePlusVolume: '8',
    },
    customerGoals: 'Lift DLBCL share in outpatient setting.',
    strategies: {
      dlbcl: ['Expand Class Share', 'Lead/Grow Brand Share'],
      mm: ['Defend Market Share'],
    },
  },
  barriersDrivers: {
    barriers: [
      {
        id: 'bd-open-barrier',
        type: 'Barrier',
        name: 'OP infusion capacity capped',
        category: 'Operational',
        status: 'Open',
        indication: 'DLBCL',
        strategy: 'Expand Class Share',
        businessImpact: 'High',
        comments: 'Capacity limits are slowing referral conversion.',
      },
      {
        id: 'bd-closed-barrier',
        type: 'Barrier',
        name: 'Closed legacy access gap',
        category: 'Access',
        status: 'Closed',
        indication: 'MM',
        strategy: 'Defend Market Share',
        businessImpact: 'Low',
        comments: 'This should not appear in the open comments section.',
      },
    ],
    drivers: [
      {
        id: 'bd-open-driver',
        type: 'Driver',
        name: 'Lymphoma champion',
        category: 'Clinical',
        status: 'Open',
        indication: 'MM',
        strategy: 'Lead/Grow Brand Share',
        businessImpact: 'Medium',
        comments: 'Champion can accelerate aligned follow-up.',
      },
    ],
    openActivityCountByBarrier: {
      'bd-open-barrier': 2,
      'bd-closed-barrier': 1,
      'bd-open-driver': 0,
    },
  },
  criticalActivities: {
    activities: [
      {
        id: 'act-planned',
        name: 'Capacity workshop',
        parentName: 'OP infusion capacity capped',
        indication: 'DLBCL',
        status: 'Planned',
        ownerLabel: 'Priya Kumar',
        dueDate: '2026-06-10',
        lastModifiedDate: '2026-06-01',
      },
      {
        id: 'act-in-progress',
        name: 'Champion briefing',
        parentName: 'Lymphoma champion',
        indication: 'MM',
        status: 'In Progress',
        ownerLabel: 'James Chen',
        dueDate: '2026-06-12',
        lastModifiedDate: '2026-05-29',
      },
      {
        id: 'act-recent-closed',
        name: 'Recent closeout',
        parentName: 'Lymphoma champion',
        indication: 'MM',
        status: 'Closed',
        ownerLabel: 'Maria Lopez',
        dueDate: '2026-05-20',
        completedDate: '2026-05-25',
        lastModifiedDate: '2026-05-25',
      },
      {
        id: 'act-old-closed',
        name: 'Old closeout',
        parentName: 'OP infusion capacity capped',
        indication: 'DLBCL',
        status: 'Complete',
        ownerLabel: 'Maria Lopez',
        dueDate: '2026-03-01',
        completedDate: '2026-03-15',
        lastModifiedDate: '2026-03-15',
      },
    ],
  },
  poa: {
    blocks: [
      { indication: 'DLBCL', functionName: 'Customer Engagement', content: 'Quarterly referral cadence.' },
      { indication: 'DLBCL', functionName: 'Market Access', content: 'P&T re-review packet.' },
      { indication: 'MM', functionName: 'Customer Engagement', content: 'MM clinician update.' },
      { indication: 'MM', functionName: 'Market Access', content: 'MM access follow-up.' },
    ],
  },
  stakeholders: {
    stakeholders: [
      {
        name: 'Anita Rao',
        role: 'Lymphoma Lead',
        dlbclPriority: 'P1',
        dlbclClinicalInfluence: 'High',
        dlbclOperationalInfluence: 'Medium',
        dlbclFinancialInfluence: 'Low',
        mmClinicalInfluence: 'Medium',
        mmOperationalInfluence: 'High',
        mmFinancialInfluence: 'Low',
        participation: 'Core',
        nonMmDrivers: 'Sequencing data interest',
        nonMmBarriers: 'Capacity concerns',
        mmDrivers: 'MM launch interest',
        mmBarriers: 'MM referral leakage',
      },
      {
        name: 'Low Influence',
        role: 'Observer',
        dlbclPriority: 'P3',
        dlbclClinicalInfluence: 'Low',
        dlbclOperationalInfluence: 'Medium',
        dlbclFinancialInfluence: 'Low',
      },
      {
        name: 'MM Specialist',
        role: 'Myeloma Lead',
        dlbclPriority: '',
        mmPriority: 'P1',
        dlbclClinicalInfluence: 'Low',
        dlbclOperationalInfluence: 'Low',
        dlbclFinancialInfluence: 'Low',
        mmClinicalInfluence: 'High',
        mmOperationalInfluence: 'Medium',
        mmFinancialInfluence: 'Low',
        mmDrivers: 'MM pathway momentum',
        mmBarriers: 'MM access delay',
      },
    ],
  },
  teamMembers: {
    teamMembers: [
      { name: 'Priya Kumar', role: 'Sr Cell Therapy Account Manager', isPrimary: { value: true }, participation: 'Core' },
      { name: 'James Chen', role: 'Market Access', isPrimary: false, participation: 'Extended' },
      { name: 'Maria Lopez', role: 'TLL', status: 'Active', participation: 'Lead' },
    ],
  },
};

test('executive summary follows updated DOCX section division and skips yellow fields', () => {
  const summary = buildAccountPlanExecutiveSummary(summaryData, {
    today: new Date('2026-06-02T00:00:00Z'),
  });

  assert.equal(summary.title, 'Mock Cancer Center Account Plan');
  assert.equal(summary.accountLine, 'Mock Cancer Center (EID: 998877)');
  assert.deepEqual(summary.keyInfo.map((item) => item.label), [
    'ATC Cohort DLBCL',
    'ATC Segment DLBCL',
    'LT Focus/ Sprint Account',
    'MM ATC Priority',
    'Market Access Prioritized Account',
    'Territory',
    'Last MPD Review Date',
  ]);
  assert.equal(summary.keyInfo.find((item) => item.label === 'MM ATC Priority')?.value, 'P1');
  assert.equal(summary.keyInfo.find((item) => item.label === 'Market Access Prioritized Account')?.value, 'Yes');
  assert.equal(summary.keyInfo.find((item) => item.label === 'Territory')?.value, 'US - North Region 4');
  assert.equal(summary.keyInfo.find((item) => item.label === 'Last MPD Review Date')?.value, '04/15/2026');
  assert.equal(summary.keyInfo.some((item) => /AE Safety|Trials|ATC flag|Referral Volume|2L\+|KLT Sprint/i.test(item.label)), false);
  assert.deepEqual(summary.goalsAndStrategy.map((item) => item.title), [
    'Customer Goals for CAR T Service Line',
    'Kite Strategy - DLBCL',
    'Kite Strategy - MM',
  ]);
  // MM strategy now flows into the summary.
  assert.equal(summary.goalsAndStrategy.find((item) => item.title === 'Kite Strategy - MM')?.body, 'Defend Market Share');
  // Plan of Action stays DLBCL-only (no MM plan of action).
  assert.deepEqual(summary.planOfAction.map((item) => item.title), [
    'DLBCL plan of action for CE team',
    'DLBCL plan of action for MAx team',
  ]);
  assert.equal(summary.planOfAction.some((item) => /\bMM\b/i.test(`${item.title} ${item.body}`)), false);
  // Barriers and drivers now include MM (no indication filtering).
  assert.deepEqual(summary.barrierDriverCounts.barriers.map((row) => row.title), [
    'OP infusion capacity capped',
    'Closed legacy access gap',
  ]);
  assert.deepEqual(summary.barrierDriverCounts.drivers.map((row) => row.title), ['Lymphoma champion']);
  assert.deepEqual(summary.topStakeholders.map((row) => row.name), ['Anita Rao', 'MM Specialist']);
  assert.equal(Object.hasOwn(summary.topStakeholders[0], 'participation'), false);
  assert.deepEqual(summary.topStakeholders.map((row) => row.dlbclInfluence), ['H/M/L', 'L/L/L']);
  assert.deepEqual(summary.topStakeholders.map((row) => row.mmInfluence), ['M/H/L', 'H/M/L']);
  assert.match(summary.topStakeholders[0].driversBarriers, /DLBCL Drivers: Sequencing data interest/);
  assert.match(summary.topStakeholders[0].driversBarriers, /MM Drivers: MM launch interest/);
  assert.match(summary.topStakeholders[0].driversBarriers, /MM Barriers: MM referral leakage/);
  assert.equal(Object.hasOwn(summary.topStakeholders[0], 'indication'), false);
  assert.equal(Object.hasOwn(summary.topStakeholders[0], 'influence'), false);
  // MM critical activities now flow (active or closed within 30 days).
  assert.deepEqual(summary.criticalActivities.map((row) => row.title), [
    'Capacity workshop',
    'Champion briefing',
    'Recent closeout',
  ]);
  assert.equal(summary.criticalActivities.some((row) => row.indication === 'MM'), true);
  assert.deepEqual(summary.openBarrierDrivers.map((row) => row.title), [
    'OP infusion capacity capped',
    'Lymphoma champion',
  ]);
  assert.equal(summary.openBarrierDrivers.some((row) => row.indication === 'MM'), true);
  assert.equal(Object.hasOwn(summary.openBarrierDrivers[0], 'status'), false);
  assert.deepEqual(summary.teamMembers.map((row) => row.name), ['Priya Kumar', 'James Chen', 'Maria Lopez']);
  assert.deepEqual(summary.teamMembers.map((row) => row.status), ['Active', 'Inactive', 'Active']);
});

test('executive summary modal and PDF keep comments readable without redundant open status', async () => {
  const modalSource = await readFile(
    new URL('../src/components/ExecutiveSummaryModal.jsx', import.meta.url),
    'utf8'
  );
  const modalCss = await readFile(
    new URL('../src/components/ExecutiveSummaryModal.css', import.meta.url),
    'utf8'
  );

  assert.match(modalSource, /summary-open-bd-table/);
  assert.match(modalSource, /Open Barriers \/ Drivers/);
  assert.doesNotMatch(modalSource, /Open Barriers \/ Drivers with Comments/);
  const stakeholderTableBlock =
    modalSource.match(/title="Top Stakeholders"[\s\S]*?title="Critical Activities"/)?.[0] || '';
  assert.match(modalSource, /headers=\{\['Name', 'DLBCL Influence', 'MM Influence', 'Stakeholder Drivers \/ Barriers'\]\}/);
  assert.doesNotMatch(stakeholderTableBlock, /Participation: row\.participation/);
  assert.doesNotMatch(modalSource, /headers=\{\['Name', 'Indication', 'Stakeholder Drivers \/ Barriers', 'Influence'\]\}/);
  assert.match(
    modalCss,
    /\.executive-summary-stakeholder-table \.executive-summary-table-head,[\s\S]*?grid-template-columns:\s*minmax\(124px,\s*1fr\)\s*116px\s*116px\s*minmax\(280px,\s*2\.8fr\)/
  );
  assert.match(modalSource, /const headers = \['Type', 'Title', 'Indication', 'Strategy', 'Category', 'Business Impact', 'Comments'\]/);
  assert.doesNotMatch(modalSource, /const headers = \['Type', 'Title', 'Status', 'Indication'/);
  assert.match(modalCss, /\.modal-scrim\.executive-summary-overlay[\s\S]*?z-index:\s*240/);
  assert.match(modalCss, /Executive summary barrier-driver comment width pass/);
  assert.match(
    modalCss,
    /grid-template-columns:\s*minmax\(56px,\s*0\.52fr\)\s*minmax\(110px,\s*1fr\)\s*minmax\(64px,\s*0\.58fr\)\s*minmax\(90px,\s*0\.82fr\)\s*minmax\(76px,\s*0\.7fr\)\s*minmax\(62px,\s*0\.56fr\)\s*minmax\(250px,\s*2\.7fr\)/
  );
  assert.match(modalCss, /\.executive-summary-modal-body[\s\S]*?overflow-y:\s*auto/);
  assert.match(modalCss, /\.executive-summary-pdf-button[\s\S]*?position:\s*sticky/);
  assert.match(modalCss, /Executive summary count columns stay top-aligned on iPad/);
  assert.match(
    modalCss,
    /\.modal-scrim\.executive-summary-overlay\s+\.executive-summary-count-grid[\s\S]*?align-items:\s*start\s*!important/
  );
  assert.match(
    modalCss,
    /\.modal-scrim\.executive-summary-overlay\s+\.executive-summary-count-column[\s\S]*?align-content:\s*start\s*!important[\s\S]*?grid-template-rows:\s*auto\s+auto/
  );
});
