import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAccountPlanPptSlides } from './accountPlanPptSections.js';

const baseData = {
  home: {
    account: { name: 'Mock Cancer Center' },
    plan: { territoryDescription: 'US - North Region 4', lastMpdApprovalDate: '2026-04-15' },
    header: {
      atcCohort: 'Cohort 4',
      atcSegment: 'Inpatient and Outpatient',
      mmAtcPriority: 'P1',
      kltSprintAccount: true,
      marketAccessPrioritizedAccount: 'Yes',
      kadTargetList: true,
      referralVolume: '24',
      secondLinePlusVolume: '8',
    },
    customerGoals: 'Grow CART adoption while improving outpatient referral coverage.',
    strategies: { dlbcl: ['Expand Class Share', 'Lead/Grow Brand Share'], mm: ['Defend Market Share'] },
  },
  barriersDrivers: {
    barriers: [
      {
        id: 'b1',
        type: 'Barrier',
        name: 'Capacity constraint',
        category: 'Capacity',
        status: 'Open',
        indication: 'DLBCL',
        strategy: 'Expand Class Share',
        businessImpact: 'High',
      },
    ],
    drivers: [
      {
        id: 'd1',
        type: 'Driver',
        name: 'Clinical champion',
        category: 'Clinical',
        status: 'Open',
        indication: 'DLBCL',
        strategy: 'Lead/Grow Brand Share',
        businessImpact: 'Medium',
      },
    ],
    openActivityCountByBarrier: { b1: 2, d1: 0 },
  },
  criticalActivities: {
    activities: Array.from({ length: 7 }, (_, index) => ({
      id: `a${index}`,
      name: `Activity ${index + 1}`,
      parentName: 'Capacity constraint',
      indication: 'DLBCL',
      status: 'Planned',
      ownerLabel: 'Priya Kumar',
      dueDate: '2026-05-20',
      lastModifiedDate: '2026-05-01',
    })),
  },
  poa: {
    blocks: [
      {
        heading: 'DLBCL Customer Engagement Plan of Action',
        indication: 'DLBCL',
        functionName: 'Customer Engagement',
        content: 'Coordinate quarterly referral cadence.',
      },
      {
        heading: 'MM Customer Engagement Plan of Action',
        indication: 'MM',
        functionName: 'Customer Engagement',
        content: 'Prepare MM access follow-up.',
      },
      {
        heading: 'DLBCL Market Access Plan of Action',
        indication: 'DLBCL',
        functionName: 'Market Access',
        content: 'Prepare P&T re-review packet.',
      },
    ],
  },
  accountProfile: {
    accountAttributeRows: [{ label: 'ATC Cohort', value: 'Cohort 4' }],
    reimbursementRows: [{ label: 'Payer Mix', value: '50% Commercial / 40% Medicare' }],
    profileQuestionColumns: [
      [{ label: 'Is capacity having an impact on CART?', value: 'Yes' }],
      [{ label: 'Does ATC prefer CART administration in OP?', value: 'Outpatient' }],
    ],
    referralAccounts: [{ name: 'Northern Oncology', hcoClassification: 'Community', hcpTargetCount: 6, referralPriority: true, indication: 'DLBCL' }],
    healthcareNetworks: [{ accountName: 'Northern Network', kiteAccountable: 'James Chen' }],
    regionalDynamics: { DLBCL: 'Capacity is tightening.', MM: 'Access is widening.' },
    accountInsights: [{ insightText: 'Strong OP interest.', insightDate: '2026-05-18', createdBy: 'Maria Lopez' }],
  },
  stakeholders: {
    stakeholders: [{
      name: 'Anita Rao',
      role: 'Lymphoma Lead',
      dlbclPriority: 'P1',
      mmPriority: 'P2',
      dlbclClinicalInfluence: 'High',
      dlbclOperationalInfluence: 'High',
      dlbclFinancialInfluence: 'Medium',
      mmClinicalInfluence: 'Medium',
      mmOperationalInfluence: 'High',
      mmFinancialInfluence: 'Low',
      primaryParent: 'Mock Cancer Center',
    }],
  },
  teamMembers: {
    teamMembers: [
      { name: 'Priya Kumar', role: 'Sr Cell Therapy Account Manager', isPrimary: { value: true }, participation: 'Core' },
      { name: 'James Chen', role: 'Market Access', isPrimary: false, participation: 'Extended' },
      { name: 'Maria Lopez', role: 'TLL', status: 'Active', participation: 'Lead' },
    ],
  },
};

test('keeps title page first and starts Home edits on the next slide', () => {
  const slides = buildAccountPlanPptSlides(baseData, { maxRowsPerSlide: 5 });
  const titleSlide = slides[0];
  const homeSlide = slides.find((slide) => slide.key === 'home');

  assert.equal(titleSlide.type, 'title');
  assert.equal(titleSlide.key, 'title');
  assert.equal(titleSlide.title, 'Mock Cancer Center Account Plan');
  assert.equal(slides[1], homeSlide);
  assert.equal(homeSlide.type, 'cards');
  assert.deepEqual(homeSlide.summaryCards.map((card) => card.label), [
    'ATC Cohort DLBCL',
    'ATC Segment DLBCL',
    'LT Focus/ Sprint Account',
    'MM ATC Priority',
    'Market Access Prioritized Account',
    'Territory',
    'Last MPD Review Date',
  ]);
  assert.equal(homeSlide.summaryCards.find((card) => card.label === 'Territory')?.value, 'US - North Region 4');
  assert.equal(homeSlide.summaryCards.find((card) => card.label === 'Last MPD Review Date')?.value, '04/15/2026');
  assert.deepEqual(homeSlide.summaryCards.map((card) => card.value), [
    'Cohort 4',
    'Inpatient and Outpatient',
    'Yes',
    'P1',
    'Yes',
    'US - North Region 4',
    '04/15/2026',
  ]);
  assert.deepEqual(homeSlide.cards.map((card) => card.title), [
    'Customer Goals for CAR T Service Line',
    'Kite Strategy',
    'Kite Strategy',
  ]);
  assert.deepEqual(homeSlide.cards.map((card) => card.label), [
    'Customer Goals',
    'DLBCL Strategy',
    'MM Strategy',
  ]);
  // MM strategy now flows into the export.
  assert.equal(homeSlide.cards.find((card) => card.label === 'MM Strategy').body, 'Defend Market Share');
  assert.equal(homeSlide.cards.length, 3);
});

test('PPT stakeholder and team member sections use executive-summary field mapping', () => {
  const slides = buildAccountPlanPptSlides(baseData, { maxRowsPerSlide: 5 });
  const stakeholderSlide = slides.find((slide) => slide.key === 'stakeholders');
  const teamMemberSlide = slides.find((slide) => slide.key === 'team-members');

  assert.deepEqual(stakeholderSlide.headers, [
    'Name',
    'Role',
    'DLBCL Influence',
    'MM Influence',
    'Target Priority',
    'Primary Parent',
  ]);
  assert.deepEqual(stakeholderSlide.rows[0], [
    'Anita Rao',
    'Lymphoma Lead',
    'High / High / Medium',
    'Medium / High / Low',
    'P1 / P2',
    'Mock Cancer Center',
  ]);

  assert.deepEqual(teamMemberSlide.headers, ['Name', 'Role', 'Status', 'Participation']);
  assert.deepEqual(teamMemberSlide.rows.map((row) => row[2]), ['Active', 'Inactive', 'Active']);
  assert.deepEqual(teamMemberSlide.rows.map((row) => row[3]), ['Core', 'Extended', 'Lead']);
});

test('puts barriers and drivers on separate table slides', () => {
  const slides = buildAccountPlanPptSlides(baseData, { maxRowsPerSlide: 5 });
  const barrierSlide = slides.find((slide) => slide.key === 'barriers');
  const driverSlide = slides.find((slide) => slide.key === 'drivers');
  const combinedSlide = slides.find((slide) => slide.key === 'barriers-drivers');

  assert.equal(combinedSlide, undefined);
  assert.equal(barrierSlide.title, 'Barriers');
  assert.equal(driverSlide.title, 'Drivers');
  assert.deepEqual(barrierSlide.rows.map((row) => row[0]), ['Capacity constraint']);
  assert.deepEqual(driverSlide.rows.map((row) => row[0]), ['Clinical champion']);
});

test('keeps POA as a single DLBCL box (no MM plan of action)', () => {
  const slides = buildAccountPlanPptSlides(baseData, { maxRowsPerSlide: 5 });
  const poaSlide = slides.find((slide) => slide.key === 'poa');

  assert.equal(poaSlide.type, 'boxes');
  assert.deepEqual(poaSlide.boxes.map((box) => box.title), [
    'DLBCL plan of action for CE team',
    'DLBCL plan of action for MAx team',
  ]);
  assert.match(poaSlide.boxes[0].body, /Coordinate quarterly referral cadence\./);
  assert.match(poaSlide.boxes[1].body, /Prepare P&T re-review packet\./);
});

test('splits long tables across multiple slides', () => {
  const slides = buildAccountPlanPptSlides(baseData, { maxRowsPerSlide: 3 });
  const activitySlides = slides.filter((slide) => slide.key.startsWith('critical-activities'));

  assert.equal(activitySlides.length, 3);
  assert.deepEqual(activitySlides.map((slide) => slide.rows.length), [3, 3, 1]);
  assert.equal(activitySlides[0].chunkLabel, '1 of 3');
});
