import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccountPlanPdfDocument, PDF_MIME } from './accountPlanPdfRenderer.js';
import { buildAccountPlanExecutiveSummary } from './accountPlanExecutiveSummary.js';

const exportData = {
  home: {
    account: { name: 'Mock Cancer Center', eid: 'EID-12345' },
    plan: { territoryDescription: 'US - North Region 4', lastMpdApprovalDate: '2026-05-11' },
    header: {
      atcCohort: 'Cohort 4',
      atcSegment: 'Inpatient and Outpatient',
      kltSprintAccount: true,
      kadTargetList: true,
      referralVolume: '24',
      secondLinePlusVolume: '8',
    },
    customerGoals: 'Grow CART adoption while improving outpatient referral coverage.',
    strategies: { dlbcl: ['Expand Class Share', 'Lead and grow brand share'] },
  },
  barriersDrivers: {
    barriers: [{
      id: 'b1',
      name: 'Capacity constraint',
      category: 'Capacity',
      status: 'Open',
      indication: 'DLBCL',
      strategy: 'Expand Class Share',
      businessImpact: 'High',
      comments: 'No comment',
    }],
    drivers: [{
      id: 'd1',
      name: 'Clinical champion',
      category: 'Clinical',
      status: 'Open',
      indication: 'DLBCL',
      strategy: 'Lead and grow brand share',
      businessImpact: 'Medium',
    }],
    openActivityCountByBarrier: { b1: 2, d1: 0 },
  },
  criticalActivities: {
    activities: Array.from({ length: 5 }, (_, index) => ({
      id: `a${index}`,
      name: `Activity ${index + 1}`,
      parentName: index % 2 ? 'Clinical champion' : 'Capacity constraint',
      indication: 'DLBCL',
      status: 'Planned',
      ownerLabel: 'Priya Kumar',
      dueDate: '2026-05-20',
      lastModifiedDate: '2026-05-01',
    })),
  },
  poa: {
    blocks: [
      { indication: 'DLBCL', functionName: 'Customer Engagement', content: 'Coordinate quarterly referral cadence.' },
      { indication: 'MM', functionName: 'Market Access', content: 'Prepare MM access follow-up.' },
    ],
  },
  accountProfile: {
    accountAttributeRows: [{ label: 'ATC Cohort', value: 'Cohort 4' }],
    reimbursementRows: [{ label: 'Payer Mix', value: '50% Commercial / 40% Medicare' }],
    profileQuestionColumns: [[{ label: 'Is capacity having an impact on CART?', value: 'Yes' }]],
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
      dlbclClinicalInfluence: 'High',
      dlbclOperationalInfluence: 'High',
      dlbclFinancialInfluence: 'Medium',
      primaryParent: 'Mock Cancer Center',
    }],
  },
  teamMembers: {
    teamMembers: [{ name: 'Priya Kumar', role: 'Sr Cell Therapy Account Manager', isPrimary: true, participation: 'Core' }],
  },
};

const blobText = async (blob) => new TextDecoder().decode(await blob.arrayBuffer());

test('renders a real A4 executive-summary PDF with every requested section', async () => {
  const summary = buildAccountPlanExecutiveSummary(exportData, {
    today: new Date('2026-06-02T00:00:00Z'),
  });
  const blob = createAccountPlanPdfDocument(summary, {
    title: 'Mock Cancer Center Account Plan',
  });
  const pdf = await blobText(blob);

  assert.equal(blob.type, PDF_MIME);
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.ok([...pdf.matchAll(/\/Type \/Page\b/g)].length >= 2);
  [
    'Mock Cancer Center Account Plan',
    'Executive Summary',
    'ATC Account Name',
    'Territory',
    'US - North Region 4',
    'Last MPD Review Date',
    '05/11/2026',
    'Customer Goals for CAR T Service Line',
    'Grow CART adoption',
    'Kite Strategy - DLBCL',
    'Capacity constraint',
    'Clinical champion',
    'Activity 5',
    'Top Stakeholders',
    'DLBCL Influence',
    'Anita Rao',
    'Priya Kumar',
    'KITE',
  ].forEach((text) => assert.match(pdf, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.doesNotMatch(pdf, /ATC Priority \(MM\)/);
  assert.doesNotMatch(pdf, /MM plan of action/);
  assert.doesNotMatch(pdf, /Kite Strategy - MM \/ DLBCL/);
});

test('renders the account plan PDF as a report, not PPT slide pages', async () => {
  const summary = buildAccountPlanExecutiveSummary(exportData, {
    today: new Date('2026-06-02T00:00:00Z'),
  });
  const blob = createAccountPlanPdfDocument(summary, {
    title: 'Mock Cancer Center Account Plan',
  });
  const pdf = await blobText(blob);

  assert.match(pdf, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.doesNotMatch(pdf, /\/MediaBox \[0 0 960 540\]/);
  assert.match(pdf, /ATC Segment DLBCL/);
  assert.match(pdf, /ATC Cohort DLBCL/);
  assert.doesNotMatch(pdf, /0\.00 831\.89 595\.28 10\.00 re/);
  assert.match(pdf, /0\.00 0\.00 6\.00 841\.89 re/);
  assert.doesNotMatch(pdf, /AE Safety/);
  assert.doesNotMatch(pdf, /Trials/);
  assert.doesNotMatch(pdf, /ATC flag/);
  assert.match(pdf, /Customer Goals for CAR T Service Line/);
  assert.match(pdf, /Barriers with Open Critical Activities/);
  assert.match(pdf, /Drivers with Open Critical Activities/);
  assert.equal([...pdf.matchAll(/Mock Cancer Center \\\(EID: EID-12345\\\)/g)].length, 1);
  assert.match(pdf, /\(EID: EID-12345\)/);
  assert.doesNotMatch(
    pdf,
    /1\.000 1\.000 1\.000 rg\s+BT \/F2 8\.40 Tf [^\n]+ \(Barriers with Open Critical Activities\)/
  );
  assert.match(
    pdf,
    /0\.027 0\.188 0\.278 rg\s+BT \/F2 8\.80 Tf [^\n]+ \(Barriers with Open Critical Activities\)/
  );
  assert.doesNotMatch(pdf, /235\.64 42\.00 re/);
  assert.doesNotMatch(pdf, /235\.64 52\.00 re/);
  assert.match(pdf, /235\.64 60\.00 re/);
  assert.match(pdf, /Open Barriers \/ Drivers/);
  assert.doesNotMatch(pdf, /Open Barriers \/ Drivers with Comments/);
  assert.doesNotMatch(pdf, /BT \/F1 6\.90 Tf 353\.85 [\d.]+ Td \(No comment\)/);
  assert.match(pdf, /BT \/F1 6\.90 Tf 359\.85 [\d.]+ Td \(No comment\)/);
  assert.doesNotMatch(pdf, /\(Barrie\)\s*Tj[\s\S]{0,120}\(r\)\s*Tj/);
  assert.match(pdf, /Critical Activities/);
});
