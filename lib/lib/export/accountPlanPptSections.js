const DEFAULT_MAX_ROWS_PER_SLIDE = 10;

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const toText = (value, fallback = '-') => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (!hasValue(value)) return fallback;
  return String(value).replace(/\s+/g, ' ').trim() || fallback;
};

const optionDisplay = (item) => {
  if (!item) return 'Not entered';
  const value = item.value;
  const valueKey = hasValue(value) ? String(value) : '';
  const option = Array.isArray(item.options)
    ? item.options.find((opt) => String(opt.value ?? '') === valueKey)
    : null;
  return option?.label || toText(value, 'Not entered');
};

const booleanDisplay = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return toText(value, 'Not entered');
};

const lastMpdReviewDisplay = (plan = {}) =>
  String(plan.approvalStatus || '').trim().toLowerCase() === 'submitted for approval'
    ? 'Submitted for Approval'
    : formatDate(plan.lastMpdApprovalDate, 'Not entered');

const buildHeaderCards = (header = {}, account = {}, plan = {}) => [
  { label: 'ATC Cohort DLBCL', value: toText(header.atcCohort, 'Not entered') },
  { label: 'ATC Segment DLBCL', value: toText(header.atcSegment, 'Not entered') },
  { label: 'LT Focus/ Sprint Account', value: booleanDisplay(header.kltSprintAccount) },
  { label: 'MM ATC Priority', value: toText(header.mmAtcPriority || account.mmAtcPriority, 'Not entered') },
  { label: 'Market Access Prioritized Account', value: toText(header.marketAccessPrioritizedAccount || account.marketAccessPrioritizedAccount, 'Not entered') },
  { label: 'Territory', value: toText(plan.territoryDescription || account.territory, 'Not entered') },
  { label: 'Last MPD Review Date', value: lastMpdReviewDisplay(plan) },
];

const formatDate = (value, fallback = 'Not entered') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
};

const chunkRows = (rows, size) => {
  const chunks = [];
  const source = rows && rows.length ? rows : [[]];
  for (let i = 0; i < source.length; i += size) {
    chunks.push(source.slice(i, i + size));
  }
  return chunks.length ? chunks : [[]];
};

// Smart chunking: estimate how many "row units" each row consumes based on the
// length of its wrap-heavy column (typically Comments). A row with a long
// comment counts as 2-5 units instead of 1, so a slide that's already near
// its budget will flush before pulling in another heavy row. Result: a
// barrier/driver with a long comment moves to the next slide whole rather
// than being clipped by the cell's row height.
const COMMENT_CHARS_PER_LINE = 24;
const MAX_UNITS_PER_ROW = 5;

const estimateRowUnits = (row, commentColumnIndex) => {
  if (!row || commentColumnIndex == null) return 1;
  const comment = String(row[commentColumnIndex] || '').trim();
  if (!comment || comment === '-') return 1;
  const lines = Math.ceil(comment.length / COMMENT_CHARS_PER_LINE);
  return Math.max(1, Math.min(lines, MAX_UNITS_PER_ROW));
};

const smartChunkRows = (rows, maxUnitsPerSlide, commentColumnIndex) => {
  if (!rows || !rows.length) return [[]];
  const chunks = [];
  let current = [];
  let currentUnits = 0;
  for (const row of rows) {
    const units = estimateRowUnits(row, commentColumnIndex);
    if (currentUnits + units > maxUnitsPerSlide && current.length > 0) {
      chunks.push(current);
      current = [];
      currentUnits = 0;
    }
    current.push(row);
    currentUnits += units;
  }
  if (current.length) chunks.push(current);
  return chunks.length ? chunks : [[]];
};

const addTableSlides = (slides, { key, title, label, headers, rows, colWidths, colLimits, commentColumnIndex }, maxRowsPerSlide) => {
  const chunks = commentColumnIndex != null
    ? smartChunkRows(rows || [], maxRowsPerSlide, commentColumnIndex)
    : chunkRows(rows || [], maxRowsPerSlide);
  chunks.forEach((chunk, index) => {
    slides.push({
      type: 'table',
      key: chunks.length > 1 ? `${key}-${index + 1}` : key,
      title,
      label,
      headers,
      rows: chunk[0]?.length ? chunk : [],
      colWidths,
      colLimits,
      chunkLabel: chunks.length > 1 ? `${index + 1} of ${chunks.length}` : '',
      emptyMessage: `No ${String(title || 'records').toLowerCase()} available.`,
    });
  });
};

const influenceTriplet = (row) =>
  [
    row?.dlbclClinicalInfluence,
    row?.dlbclOperationalInfluence,
    row?.dlbclFinancialInfluence,
  ].map((value) => toText(value, '-')).join(' / ');

const mmInfluenceTriplet = (row) =>
  [
    row?.mmClinicalInfluence,
    row?.mmOperationalInfluence,
    row?.mmFinancialInfluence,
  ].map((value) => toText(value, '-')).join(' / ');

const priorityCode = (value) => {
  const match = String(value || '').trim().match(/^P\s*\d+/i);
  return match ? match[0].replace(/\s+/g, '').toUpperCase() : '-';
};

const targetPriority = (row) =>
  `${priorityCode(row?.dlbclPriority)} / ${priorityCode(row?.mmPriority)}`;

const activeStatusFlag = (value) => {
  const raw = value && typeof value === 'object' && 'value' in value ? value.value : value;
  if (raw === true || raw === false) return raw;
  const key = String(raw ?? '').trim().toLowerCase();
  if (key === 'active' || key === 'true' || key === 'yes' || key === '1') return true;
  if (key === 'inactive' || key === 'false' || key === 'no' || key === '0') return false;
  return null;
};

const teamMemberStatus = (row) => {
  const activeFlag = activeStatusFlag(row?.isPrimary);
  if (activeFlag !== null) return activeFlag ? 'Active' : 'Inactive';
  const crmActiveFlag = activeStatusFlag(row?.Account_Team_Member_Active__c ?? row?.accountTeamMemberActive);
  if (crmActiveFlag !== null) return crmActiveFlag ? 'Active' : 'Inactive';
  return toText(row?.status, 'Inactive');
};

const barrierDriverRows = (records, openActivityCountByBarrier = {}) =>
  (records || []).map((record) => [
    toText(record.name || record.title, 'Untitled'),
    toText(record.category),
    toText(record.status, 'Open'),
    toText(record.indication),
    toText(record.strategyLabel || record.strategy),
    toText(record.businessImpact),
    toText(openActivityCountByBarrier[record.id] ?? record.openCount ?? 0),
    toText(record.comments, ''),
  ]);

// Comments is the last column; index = (other columns).length.
const BARRIER_DRIVER_COMMENT_INDEX = 7;

const poaFunctionMatches = (block, functionKey) => {
  const value = `${block?.functionName || ''} ${block?.heading || ''}`.toLowerCase();
  if (functionKey === 'ce') return value.includes('customer engagement') || /\bce\b/.test(value);
  return value.includes('market access') || value.includes('max');
};

const poaIndicationMatches = (block, indicationKey) => {
  const value = String(block?.indication || block?.heading || '').toLowerCase();
  if (indicationKey === 'mm') return value.includes('mm');
  return value.includes('dlbcl') || value.includes('lbcl') || !value.includes('mm');
};

const poaContent = (blocks, indicationKey, functionKey) =>
  (blocks || [])
    .filter((block) => poaIndicationMatches(block, indicationKey) && poaFunctionMatches(block, functionKey))
    .map((block) => toText(block?.content, ''))
    .filter(Boolean)
    .join('\n\n');

// Separate cards per function (mirrors the Executive Summary "Plan of Action"
// section) instead of collapsing every function into one concatenated block.
const buildPoaBoxes = (blocks) => [
  {
    title: 'DLBCL plan of action for CE team',
    body: poaContent(blocks, 'dlbcl', 'ce') || 'Not entered',
  },
  {
    title: 'DLBCL plan of action for MAx team',
    body: poaContent(blocks, 'dlbcl', 'max') || 'Not entered',
  },
];

export const buildAccountPlanPptSlides = (data, options = {}) => {
  const maxRowsPerSlide = options.maxRowsPerSlide || DEFAULT_MAX_ROWS_PER_SLIDE;
  const slides = [];
  const home = data?.home || {};
  const accountProfile = data?.accountProfile || {};
  const account = home.account || accountProfile.account || {};
  const plan = home.plan || accountProfile.plan || {};
  const header = home.header || accountProfile.header || {};
  const strategies = home.strategies || {};
  const homeCards = [
    {
      title: 'Customer Goals for CAR T Service Line',
      label: 'Customer Goals',
      body: toText(home.customerGoals, 'No CAR T service line customer goals captured.'),
    },
    {
      title: 'Kite Strategy',
      label: 'DLBCL Strategy',
      body: (strategies.dlbcl || []).length
        ? (strategies.dlbcl || []).join('\n')
        : 'Not entered',
    },
    {
      title: 'Kite Strategy',
      label: 'MM Strategy',
      body: (strategies.mm || []).length
        ? (strategies.mm || []).join('\n')
        : 'Not entered',
    },
  ];

  slides.push({
    type: 'title',
    key: 'title',
    title: buildAccountPlanExportTitle(data),
    label: 'MyInsights Export',
    accountName: toText(account.name || plan.accountName, 'Account Plan'),
    fields: [
      { label: 'EID', value: toText(account.eid || account.externalId || plan.eid, 'Not entered') },
      { label: 'Territory', value: toText(plan.territoryDescription || header.territory, 'Not entered') },
      { label: 'Last MPD Review Date', value: lastMpdReviewDisplay(plan) },
    ],
  });

  slides.push({
    type: 'cards',
    key: 'home',
    title: 'Home',
    label: 'Cards, Goals & Strategy',
    summaryCards: buildHeaderCards(header, account, plan),
    cards: homeCards,
  });

  const barriersDrivers = data?.barriersDrivers || {};
  const openActivityCountByBarrier = barriersDrivers.openActivityCountByBarrier || {};
  // Comments column added per user request — needs a wide column + a much
  // larger per-cell character limit (default 95 would truncate). Smart
  // chunking uses commentColumnIndex so a barrier/driver with a long
  // comment moves to the next slide whole instead of being clipped.
  const barrierDriverHeaders = [
    'Title', 'Category', 'Status', 'Indication', 'Strategy',
    'Impact', 'Open Activities', 'Comments',
  ];
  const barrierDriverColWidths = [2.0, 1.05, 0.8, 0.85, 1.4, 0.8, 1.05, 4.4];
  // Per-column character limits — bumps the Comments cell from the default
  // 95 chars up to 600 so long comments aren't ellipsized in the cell.
  const barrierDriverColLimits = [60, 32, 14, 18, 40, 18, 6, 600];

  addTableSlides(slides, {
    key: 'barriers',
    title: 'Barriers',
    label: 'Barriers & Drivers',
    headers: barrierDriverHeaders,
    rows: barrierDriverRows(barriersDrivers.barriers, openActivityCountByBarrier),
    colWidths: barrierDriverColWidths,
    colLimits: barrierDriverColLimits,
    commentColumnIndex: BARRIER_DRIVER_COMMENT_INDEX,
  }, maxRowsPerSlide);
  addTableSlides(slides, {
    key: 'drivers',
    title: 'Drivers',
    label: 'Barriers & Drivers',
    headers: barrierDriverHeaders,
    rows: barrierDriverRows(barriersDrivers.drivers, openActivityCountByBarrier),
    colWidths: barrierDriverColWidths,
    colLimits: barrierDriverColLimits,
    commentColumnIndex: BARRIER_DRIVER_COMMENT_INDEX,
  }, maxRowsPerSlide);

  const activities = data?.criticalActivities?.activities || barriersDrivers.activities || [];
  const activityRows = activities.map((activity) => [
    toText(activity.name, 'Untitled'),
    toText(activity.parentName, 'Plan-level'),
    toText(activity.indication),
    toText(activity.status, 'Planned'),
    toText(activity.ownerLabel, 'Unassigned'),
    formatDate(activity.dueDate),
    formatDate(activity.lastModifiedDate),
  ]);
  addTableSlides(slides, {
    key: 'critical-activities',
    title: 'Critical Activities',
    label: 'All activities',
    headers: ['Title', 'Related Barrier / Driver', 'Indication', 'Status', 'Accountable', 'Due Date', 'Last Modified'],
    rows: activityRows,
    colWidths: [2.1, 2.0, 0.9, 0.9, 1.25, 0.9, 0.95],
  }, maxRowsPerSlide);

  slides.push({
    type: 'boxes',
    key: 'poa',
    title: 'Cross Functional Plan of Action',
    label: 'Plan of Action',
    boxes: buildPoaBoxes(data?.poa?.blocks || []),
  });

  const profileRows = [
    ...(accountProfile.accountAttributeRows || []).map((row) => ['Account Attributes', toText(row.label), optionDisplay(row)]),
    ...(accountProfile.reimbursementRows || []).map((row) => ['DLBCL Reimbursement', toText(row.label), optionDisplay(row)]),
    ...(accountProfile.profileQuestionColumns || [])
      .flatMap((column) => column || [])
      .map((row) => ['DLBCL Profile', toText(row.label), optionDisplay(row)]),
  ];
  addTableSlides(slides, {
    key: 'account-profile',
    title: 'Account Profile',
    label: 'Profile fields',
    headers: ['Section', 'Field', 'Value'],
    rows: profileRows,
    colWidths: [1.4, 3.7, 4.4],
  }, maxRowsPerSlide);

  const referralRows = (accountProfile.referralAccounts || []).map((row) => [
    toText(row.name, 'Untitled'),
    toText(row.hcoClassification),
    toText(row.hcpTargetCount || 0),
    toText(row.referralPriority),
    toText(row.indication),
  ]);
  addTableSlides(slides, {
    key: 'referral-mapping',
    title: 'Referral Mapping',
    label: 'Account Profile',
    headers: ['Site Name', 'HCO Classification', '# HCP Targets', 'Referral Priority', 'Indication'],
    rows: referralRows,
    colWidths: [2.8, 2.0, 1.15, 1.45, 1.1],
  }, maxRowsPerSlide);

  const dynamicsRows = [
    ['DLBCL Regional Dynamics', toText(accountProfile.regionalDynamics?.DLBCL, 'Not entered')],
    ['MM Regional Dynamics', toText(accountProfile.regionalDynamics?.MM, 'Not entered')],
    ...(accountProfile.healthcareNetworks || []).map((row) => [
      `Healthcare Network: ${toText(row.accountName, 'Not entered')}`,
      `Kite Accountable: ${toText(row.kiteAccountable, 'Not entered')}`,
    ]),
  ];
  addTableSlides(slides, {
    key: 'regional-dynamics',
    title: 'Regional Dynamics & Networks',
    label: 'Account Profile',
    headers: ['Item', 'Details'],
    rows: dynamicsRows,
    colWidths: [3.1, 6.4],
  }, maxRowsPerSlide);

  const insightRows = (accountProfile.accountInsights || []).map((row) => [
    toText(row.insightText || row.name, 'Insight'),
    formatDate(row.insightDate || row.createdDate),
    toText(row.createdBy, 'Not entered'),
  ]);
  addTableSlides(slides, {
    key: 'account-insights',
    title: 'Account Insights',
    label: 'Insights',
    headers: ['Insight', 'Created Date', 'Created By'],
    rows: insightRows,
    colWidths: [6.2, 1.4, 1.9],
  }, maxRowsPerSlide);

  const stakeholderRows = (data?.stakeholders?.stakeholders || []).map((row) => [
    toText(row.name, 'Untitled'),
    toText(row.role),
    influenceTriplet(row),
    mmInfluenceTriplet(row),
    targetPriority(row),
    toText(row.primaryParent),
  ]);
  addTableSlides(slides, {
    key: 'stakeholders',
    title: 'Stakeholders',
    label: 'Stakeholder Map',
    headers: ['Name', 'Role', 'DLBCL Influence', 'MM Influence', 'Target Priority', 'Primary Parent'],
    rows: stakeholderRows,
    colWidths: [2.0, 1.6, 1.55, 1.55, 1.15, 1.65],
  }, maxRowsPerSlide);

  const teamMemberRows = (data?.teamMembers?.teamMembers || []).map((row) => [
    toText(row.name, 'Unnamed team member'),
    toText(row.role || row.functionName),
    teamMemberStatus(row),
    toText(row.participation || (activeStatusFlag(row.isPrimary) === true ? 'Core' : 'Extended')),
  ]);
  addTableSlides(slides, {
    key: 'team-members',
    title: 'Team Members',
    label: 'Account POD',
    headers: ['Name', 'Role', 'Status', 'Participation'],
    rows: teamMemberRows,
    colWidths: [2.7, 3.0, 1.1, 1.5],
  }, maxRowsPerSlide);

  return slides;
};

export const buildAccountPlanExportTitle = (data) => {
  const home = data?.home || {};
  const accountProfile = data?.accountProfile || {};
  const accountName =
    home.account?.name ||
    accountProfile.account?.name ||
    home.plan?.accountName ||
    accountProfile.plan?.accountName ||
    'Account Plan';
  return `${accountName} Account Plan`;
};
