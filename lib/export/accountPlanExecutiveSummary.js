import {
  isSubmittedForApprovalStatus,
  isReviseAndResubmitStatus,
  SUBMITTED_FOR_APPROVAL_STATUS,
  REVISE_AND_RESUBMIT_STATUS,
} from '../accountPlanReadOnly.js';

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const textValue = (value, fallback = 'Not entered') => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (!hasValue(value)) return fallback;
  return String(value).replace(/\s+/g, ' ').trim() || fallback;
};

const booleanValue = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return textValue(value);
};

const formatDate = (value, fallback = 'Not entered') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return textValue(value, fallback);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
};

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const isOpenRecord = (record) => {
  const status = normalizeStatus(record?.status);
  return status !== 'closed' && status !== 'complete' && status !== 'completed';
};

const isActiveActivityStatus = (status) => {
  const normalized = normalizeStatus(status);
  return normalized === 'planned' || normalized === 'in progress';
};

const isClosedActivityStatus = (status) => {
  const normalized = normalizeStatus(status);
  return normalized === 'closed' || normalized === 'complete' || normalized === 'completed';
};

const isClosedWithinDays = (activity, today, days = 30) => {
  if (!isClosedActivityStatus(activity?.status)) return false;
  const closedValue = activity.completedDate || activity.closedDate || activity.lastModifiedDate;
  if (!closedValue) return false;
  const closedDate = new Date(closedValue);
  if (Number.isNaN(closedDate.getTime())) return false;
  const current = today instanceof Date ? today : new Date(today || Date.now());
  const diffMs = current.getTime() - closedDate.getTime();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
};

const compactInfluence = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'high' || normalized === 'h') return 'H';
  if (normalized === 'medium' || normalized === 'm') return 'M';
  if (normalized === 'low' || normalized === 'l') return 'L';
  return '-';
};

const isHighInfluence = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'high' || normalized === 'h';
};

const triplet = (row, prefix) => [
  row?.[`${prefix}ClinicalInfluence`],
  row?.[`${prefix}OperationalInfluence`],
  row?.[`${prefix}FinancialInfluence`],
];

const influenceTriplet = (row, prefix) =>
  triplet(row, prefix).map(compactInfluence).join('/');

const hasHighDlbclInfluence = (row) => triplet(row, 'dlbcl').some(isHighInfluence);
const hasHighMmInfluence = (row) => triplet(row, 'mm').some(isHighInfluence);

const stakeholderDriversBarriers = (row) => {
  const parts = [];
  if (row.nonMmDrivers) parts.push(`DLBCL Drivers: ${textValue(row.nonMmDrivers, '')}`);
  if (row.nonMmBarriers) parts.push(`DLBCL Barriers: ${textValue(row.nonMmBarriers, '')}`);
  if (row.mmDrivers) parts.push(`MM Drivers: ${textValue(row.mmDrivers, '')}`);
  if (row.mmBarriers) parts.push(`MM Barriers: ${textValue(row.mmBarriers, '')}`);
  return parts.join('; ') || 'Not entered';
};

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
  const displayStatus = textValue(row?.status, '');
  return displayStatus || 'Inactive';
};

// Mirrors the sidebar tile: Submitted for Approval / Revise and Resubmit show
// the status text; every other status shows the KPH_Last_MPD_Review_Date__c date.
const lastMpdReviewValue = (plan) =>
  isSubmittedForApprovalStatus(plan?.approvalStatus)
    ? SUBMITTED_FOR_APPROVAL_STATUS
    : isReviseAndResubmitStatus(plan?.approvalStatus)
      ? REVISE_AND_RESUBMIT_STATUS
      : formatDate(plan?.lastMpdApprovalDate, 'Not entered');

const openActivityCount = (record, openActivityCountByBarrier) =>
  Number(openActivityCountByBarrier?.[record?.id] ?? record?.openCount ?? 0) || 0;

const barrierDriverCountRow = (record, openActivityCountByBarrier) => ({
  indication: textValue(record?.indication),
  category: textValue(record?.category),
  title: textValue(record?.name || record?.title, 'Untitled'),
  openActivities: openActivityCount(record, openActivityCountByBarrier),
});

const barrierDriverCommentRow = (record) => ({
  type: textValue(record?.type, 'Barrier'),
  title: textValue(record?.name || record?.title, 'Untitled'),
  indication: textValue(record?.indication),
  strategy: textValue(record?.strategyLabel || record?.strategy),
  category: textValue(record?.category),
  businessImpact: textValue(record?.businessImpact),
  comments: textValue(record?.comments, 'No comment'),
});

const functionMatches = (block, functionKey) => {
  const value = `${block?.functionName || ''} ${block?.heading || ''}`.toLowerCase();
  if (functionKey === 'ce') return value.includes('customer engagement') || /\bce\b/.test(value);
  return value.includes('market access') || value.includes('max') || value.includes('max team');
};

const indicationMatches = (block, indicationKey) => {
  const value = String(block?.indication || block?.heading || '').toLowerCase();
  if (indicationKey === 'mm') return value.includes('mm');
  return value.includes('dlbcl') || value.includes('lbcl') || !value.includes('mm');
};

const planOfActionValue = (blocks, indicationKey, functionKey) => {
  const matches = (blocks || [])
    .filter((block) => indicationMatches(block, indicationKey) && functionMatches(block, functionKey))
    .map((block) => textValue(block.content, ''))
    .filter(Boolean);
  return matches.join('\n\n') || 'Not entered';
};

const exportTitle = (data) => {
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

export const buildAccountPlanExecutiveSummary = (data, { today = new Date() } = {}) => {
  const home = data?.home || {};
  const accountProfile = data?.accountProfile || {};
  const account = home.account || accountProfile.account || {};
  const plan = home.plan || accountProfile.plan || {};
  const header = home.header || accountProfile.header || {};
  const accountName = textValue(account.name || plan.accountName, 'Account Plan');
  const eid = textValue(account.eid || account.externalId || plan.eid, '');
  const barriersDrivers = data?.barriersDrivers || {};
  // No indication filtering — both DLBCL and MM barriers/drivers flow through.
  const allBarriers = barriersDrivers.barriers || [];
  const allDrivers = barriersDrivers.drivers || [];
  const openActivityCountByBarrier = barriersDrivers.openActivityCountByBarrier || {};
  const poaBlocks = data?.poa?.blocks || [];
  const strategies = home.strategies || {};

  const highStakeholders = (data?.stakeholders?.stakeholders || [])
    .map((row) => {
      if (!hasHighDlbclInfluence(row) && !hasHighMmInfluence(row)) return null;
      return {
        name: textValue(row.name, 'Untitled'),
        driversBarriers: stakeholderDriversBarriers(row),
        dlbclInfluence: influenceTriplet(row, 'dlbcl'),
        mmInfluence: influenceTriplet(row, 'mm'),
      };
    })
    .filter(Boolean);

  const activityRows = (data?.criticalActivities?.activities || barriersDrivers.activities || [])
    .filter((activity) =>
      isActiveActivityStatus(activity.status) || isClosedWithinDays(activity, today)
    )
    .map((activity) => ({
      title: textValue(activity.name, 'Untitled'),
      relatedBarrier: textValue(activity.parentName, 'Plan-level'),
      indication: textValue(activity.indication),
      status: textValue(activity.status, 'Planned'),
      accountable: textValue(activity.ownerLabel || activity.accountable, 'Unassigned'),
      dueDate: formatDate(activity.dueDate),
      lastModifiedDate: formatDate(activity.lastModifiedDate),
    }));

  return {
    title: exportTitle(data),
    accountName,
    eid,
    accountLine: eid ? `${accountName} (EID: ${eid})` : accountName,
    generatedDate: formatDate(today),
    keyInfo: [
      { label: 'ATC Cohort DLBCL', value: textValue(header.atcCohort) },
      { label: 'ATC Segment DLBCL', value: textValue(header.atcSegment) },
      { label: 'LT Focus/ Sprint Account', value: booleanValue(header.kltSprintAccount) },
      { label: 'MM ATC Priority', value: textValue(header.mmAtcPriority || account.mmAtcPriority) },
      { label: 'Market Access Prioritized Account', value: textValue(header.marketAccessPrioritizedAccount || account.marketAccessPrioritizedAccount) },
      { label: 'Territory', value: textValue(plan.territoryDescription || account.territory) },
      { label: 'Last MPD Review Date', value: lastMpdReviewValue(plan) },
    ],
    goalsAndStrategy: [
      {
        title: 'Customer Goals for CAR T Service Line',
        body: textValue(home.customerGoals, 'No CAR T service line customer goals captured.'),
      },
      {
        title: 'Kite Strategy - DLBCL',
        body: (strategies.dlbcl || []).length ? strategies.dlbcl.join('; ') : 'Not entered',
      },
      {
        title: 'Kite Strategy - MM',
        body: (strategies.mm || []).length ? strategies.mm.join('; ') : 'Not entered',
      },
    ],
    planOfAction: [
      { title: 'DLBCL plan of action for CE team', body: planOfActionValue(poaBlocks, 'dlbcl', 'ce') },
      { title: 'DLBCL plan of action for MAx team', body: planOfActionValue(poaBlocks, 'dlbcl', 'max') },
    ],
    barrierDriverCounts: {
      barriers: allBarriers.map((record) => barrierDriverCountRow(record, openActivityCountByBarrier)),
      drivers: allDrivers.map((record) => barrierDriverCountRow(record, openActivityCountByBarrier)),
    },
    topStakeholders: highStakeholders,
    criticalActivities: activityRows,
    openBarrierDrivers: [...allBarriers, ...allDrivers]
      .filter(isOpenRecord)
      .map(barrierDriverCommentRow),
    teamMembers: (data?.teamMembers?.teamMembers || []).map((row) => ({
      name: textValue(row.name, 'Unnamed team member'),
      role: textValue(row.role || row.functionName),
      status: teamMemberStatus(row),
      participation: textValue(row.participation || (row.isPrimary ? 'Core' : 'Extended')),
    })),
  };
};
