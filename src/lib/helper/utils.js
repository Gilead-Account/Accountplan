// Small, generic helpers ported from the legacy AngularJS controller.
// Anything Veeva-specific goes in dataservice/.

export const safeLower = (v) =>
  v === null || v === undefined ? '' : String(v).toLowerCase();

export const hasValue = (v) => v !== null && v !== undefined && v !== '';

export const normalizeCrmBoolean = (value) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (['true', 'yes', '1'].includes(normalized)) return true;
  if (['false', 'no', '0'].includes(normalized)) return false;
  return value;
};

export const booleanDisplay = (value) => {
  const normalized = normalizeCrmBoolean(value);
  if (normalized === true) return 'Yes';
  if (normalized === false) return 'No';
  return hasValue(normalized) ? normalized : 'Not entered';
};

const SALESFORCE_ID_PATTERN = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

const recordIdMatchKeys = (value) => {
  const text = String(value || '').trim();
  if (!text) return [];
  if (SALESFORCE_ID_PATTERN.test(text)) {
    return Array.from(new Set([text, text.slice(0, 15)]));
  }
  return [text];
};

const addRecordIdMatchKeys = (set, value) => {
  recordIdMatchKeys(value).forEach((key) => set.add(key));
};

const recordIdSetHas = (set, value) =>
  recordIdMatchKeys(value).some((key) => set.has(key));

export const recordIdMatches = (left, right) => {
  if (!left || !right) return false;
  const rightKeys = new Set(recordIdMatchKeys(right));
  return recordIdMatchKeys(left).some((key) => rightKeys.has(key));
};

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const twoDigitDatePart = (value) => String(value).padStart(2, '0');

export const formatDateLabel = (value, fallback = '--') => {
  const d = parseDate(value);
  if (!d) return value ? String(value) : fallback;
  return `${twoDigitDatePart(d.getMonth() + 1)}/${twoDigitDatePart(d.getDate())}/${d.getFullYear()}`;
};

export const formatDate = formatDateLabel;

export const daysFromNow = (value) => {
  const d = parseDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
};

export const truncateDisplay = (value, limit = 55) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Untitled';
  if (text.length <= limit) return text;
  return text.slice(0, Math.max(0, limit - 3)) + '...';
};

export const truncate = truncateDisplay;

export const firstInitial = (value) => String(value || 'A').trim().charAt(0) || 'A';

export const impactTone = (impact) => {
  const key = safeLower(impact);
  if (key === 'high' || key === 'p1') return 'negative';
  if (key === 'medium' || key === 'p2') return 'caution';
  return 'positive';
};

// workspace-service.statusTone — pill modifier for activity / plan status.
export const statusTone = (status) => {
  const key = safeLower(status);
  if (
    key === 'moved forward' ||
    key === 'complete' ||
    key === 'open' ||
    key === 'active' ||
    key === 'identified - not started' ||
    key === 'near outcome'
  ) return 'positive';
  if (key === 'closed' || key === 'archived') return 'neutral';
  if (key === 'in progress') return 'caution';
  if (key === 'setback') return 'negative';
  return 'caution';
};

export const activityStatusLabel = (activity) => {
  const status = activity && activity.status ? activity.status : 'Planned';
  return status === 'Complete' ? 'Completed' : status;
};

const activityStatusKey = (a) => safeLower(a && a.status ? a.status : 'Planned');

export const activityIsOpen = (a) => {
  const status = activityStatusKey(a);
  return a && a.isArchived !== true && a.isDeactivated !== true && status !== 'complete' && status !== 'archived';
};

export const activityDueTone = (activity) => {
  const days = daysFromNow(activity && activity.dueDate);
  return days !== null && days < 0 ? 'is-overdue' : 'is-standard';
};

export const activityDueLabel = (activity) =>
  formatDateLabel(activity && activity.dueDate, 'No date').replace(',', '');

export const activityDueDetail = (activity) => {
  const days = daysFromNow(activity && activity.dueDate);
  if (days === null) return 'No due date';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days} days`;
};

export const activityParentName = (activity) => {
  if (!activity) return 'Plan-level';
  if (activity.parentName) return activity.parentName;
  if (activity.indication) return activity.indication;
  return 'Plan-level';
};

export const isHomeActivityWindow = (activity) => {
  if (!activityIsOpen(activity) || !activity.dueDate) return false;
  const due = parseDate(activity.dueDate);
  if (!due) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() + 30);
  due.setHours(0, 0, 0, 0);
  return due.getTime() <= cutoff.getTime();
};

export const homeUrgentActivities = (activities) =>
  (activities || [])
    .filter(isHomeActivityWindow)
    .map((activity, index) => ({ activity, index }))
    .sort((left, right) => {
      const leftDays = daysFromNow(left.activity.dueDate);
      const rightDays = daysFromNow(right.activity.dueDate);
      const result =
        (leftDays === null ? Number.POSITIVE_INFINITY : leftDays) -
        (rightDays === null ? Number.POSITIVE_INFINITY : rightDays);
      return result || left.index - right.index;
    })
    .map(({ activity }) => activity);

const recordIsOpen = (r) => r && safeLower(r.status || 'Open') !== 'closed' && r.isArchived !== true;

const recordClosedWithinDays = (r, daysBack) => {
  if (!r || recordIsOpen(r)) return false;
  const closedAt = parseDate(r.lastModifiedDate);
  if (!closedAt) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - daysBack);
  return closedAt.getTime() >= cutoff.getTime();
};

// controller.js displayValue — true/false → Yes/No, blanks → fallback.
export const displayValue = (value, fallback = 'Not entered') => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return value === null || value === undefined || value === '' ? fallback : value;
};

// ---- stakeholder influence aggregation (workspace-service.js) -------------

// Map a single influence value to a one-letter abbreviation.
// "High" → "H", "Medium" → "M", "Low" → "L", anything else → fallback ("-").
export const influenceLetter = (value, fallback = '-') => {
  const key = safeLower(value);
  if (key === 'high') return 'H';
  if (key === 'medium') return 'M';
  if (key === 'low') return 'L';
  return fallback;
};

// Render DLBCL Clinical / Operational / Financial influence as a single
// abbreviated string, e.g. "M/L/H". Empty components become "-".
export const dlbclInfluenceTriplet = (stakeholder) => {
  if (!stakeholder) return '-/-/-';
  return [
    influenceLetter(stakeholder.dlbclClinicalInfluence),
    influenceLetter(stakeholder.dlbclOperationalInfluence),
    influenceLetter(stakeholder.dlbclFinancialInfluence),
  ].join('/');
};

// MM Clinical / Operational / Financial influence triplet. Empty CRM values
// stay blank as "-", matching DLBCL behavior.
export const mmInfluenceTriplet = (stakeholder) => {
  if (!stakeholder) return '-/-/-';
  return [
    influenceLetter(stakeholder.mmClinicalInfluence),
    influenceLetter(stakeholder.mmOperationalInfluence),
    influenceLetter(stakeholder.mmFinancialInfluence),
  ].join('/');
};

const influenceScore = (value) => {
  const key = safeLower(value);
  if (key === 'high') return 3;
  if (key === 'medium') return 2;
  if (key === 'low') return 1;
  return 0;
};

const aggregateInfluence = (values) => {
  const scored = (values || []).map(influenceScore).filter((s) => s > 0);
  if (!scored.length) return '';
  const avg = scored.reduce((sum, s) => sum + s, 0) / scored.length;
  if (avg >= 2.5) return 'High';
  if (avg >= 1.5) return 'Medium';
  return 'Low';
};

export const stakeholderOverallDlbclInfluence = (s) => {
  if (!s) return 'Not set';
  return aggregateInfluence([
    s.dlbclClinicalInfluence,
    s.dlbclFinancialInfluence,
    s.dlbclOperationalInfluence,
  ]) || 'Not set';
};

export const stakeholderOverallMmInfluence = (s) => {
  if (!s) return 'Not set';
  return aggregateInfluence([
    s.mmClinicalInfluence,
    s.mmFinancialInfluence,
    s.mmOperationalInfluence,
  ]) || 'Not set';
};

const influenceLevelMatches = (value, level) => {
  const target = safeLower(level);
  return !!target && target !== 'all' && safeLower(value) === target;
};

export const stakeholderHasDlbclInfluenceLevel = (stakeholder, level) => {
  if (!stakeholder) return false;
  const target = safeLower(level);
  if (!target || target === 'all') return true;
  return [
    stakeholder.dlbclClinicalInfluence,
    stakeholder.dlbclOperationalInfluence,
    stakeholder.dlbclFinancialInfluence,
  ].some((value) => influenceLevelMatches(value, target));
};

export const stakeholderHasMmInfluenceLevel = (stakeholder, level) => {
  if (!stakeholder) return false;
  const target = safeLower(level);
  if (!target || target === 'all') return true;
  return [
    stakeholder.mmClinicalInfluence,
    stakeholder.mmOperationalInfluence,
    stakeholder.mmFinancialInfluence,
  ].some((value) => influenceLevelMatches(value, target));
};

// Total number of "High" ratings across both DLBCL and MM influence
// categories. Used to rank the High Influence Stakeholder view so the most
// influential stakeholders (most H's in both indications) surface first.
export const stakeholderHighInfluenceCount = (stakeholder) => {
  if (!stakeholder) return 0;
  return [
    stakeholder.dlbclClinicalInfluence,
    stakeholder.dlbclOperationalInfluence,
    stakeholder.dlbclFinancialInfluence,
    stakeholder.mmClinicalInfluence,
    stakeholder.mmOperationalInfluence,
    stakeholder.mmFinancialInfluence,
  ].filter((value) => influenceLevelMatches(value, 'High')).length;
};

// controller.js stakeholderRoleOptions — distinct non-empty roles, 'All' first.
export const stakeholderRoleOptions = (stakeholders) => {
  const seen = new Set();
  const out = ['All'];
  for (const s of stakeholders || []) {
    if (!s || !s.role || seen.has(s.role)) continue;
    seen.add(s.role);
    out.push(s.role);
  }
  return out;
};

export const stakeholderMatchesFilters = (stakeholder, filters) => {
  const f = filters || {};
  const isBlankPriority = (value) => String(value ?? '').trim() === '';
  const isNonTargetPriority = isBlankPriority(stakeholder.dlbclPriority);
  const roleMatch = !f.role || f.role === 'All' || stakeholder.role === f.role;
  const priorityMatch = (() => {
    if (!f.priority || f.priority === 'All') return true;
    if (f.priority === 'Non-Target') return isNonTargetPriority;
    return stakeholder.dlbclPriority === f.priority;
  })();
  const dlbcl = stakeholderOverallDlbclInfluence(stakeholder);
  const mm = stakeholderOverallMmInfluence(stakeholder);
  const influenceMatch =
    !f.influence ||
    f.influence === 'All' ||
    stakeholderHasDlbclInfluenceLevel(stakeholder, f.influence) ||
    stakeholderHasMmInfluenceLevel(stakeholder, f.influence) ||
    dlbcl === f.influence ||
    mm === f.influence;
  const dlbclInfluenceMatch =
    !f.dlbclInfluence ||
    f.dlbclInfluence === 'All' ||
    stakeholderHasDlbclInfluenceLevel(stakeholder, f.dlbclInfluence) ||
    dlbcl === f.dlbclInfluence;
  return roleMatch && priorityMatch && influenceMatch && dlbclInfluenceMatch;
};

// controller.js teamMemberPhone — column heading is "Participation" but the
// value can be the raw participation string, an Active/Inactive flag, or blank.
export const teamMemberPhone = (member) => {
  if (!member) return 'Not entered';
  if (member.participation) return member.participation;
  return member.isPrimary ? 'Active' : 'Inactive';
};

// Open vs closed critical-activity counts shown in the Barriers/Drivers
// summary pill on Home. "Open" = current open statuses; "Closed" is scoped
// to completed/closed activity records in the last 90 days.
const ACTIVITY_OPEN_STATUSES = new Set(['open', 'planned', 'in progress']);
const ACTIVITY_CLOSED_STATUSES = new Set(['complete', 'completed', 'closed']);

const activityClosedWithinDays = (activity, daysBack) => {
  if (!activity || !ACTIVITY_CLOSED_STATUSES.has(safeLower(activity.status))) return false;
  const closedAt = parseDate(activity.completedDate || activity.lastModifiedDate);
  if (!closedAt) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - daysBack);
  return closedAt.getTime() >= cutoff.getTime();
};

export const criticalActivityCounts = (activities) => {
  let open = 0;
  let closed = 0;
  for (const a of activities || []) {
    if (!a || a.isDeactivated === true) continue;
    const key = safeLower(a.status);
    if (ACTIVITY_OPEN_STATUSES.has(key)) open += 1;
    else if (activityClosedWithinDays(a, 90)) closed += 1;
  }
  return { open, closed };
};

export const homeSummaryTables = (barriers, drivers, activities) => {
  const buildTable = (type, label, tone) => {
    const allRows = (type === 'Driver' ? drivers : barriers) || [];
    const openRows = allRows.filter(recordIsOpen);
    const closedLast90 = allRows.filter((row) => recordClosedWithinDays(row, 90)).length;
    const rowIds = new Set();
    allRows.forEach((row) => addRecordIdMatchKeys(rowIds, row && row.id));
    const counts = criticalActivityCounts(
      (activities || []).filter((activity) => activity && recordIdSetHas(rowIds, activity.barrierDriverId))
    );
    return {
      type,
      label,
      title: type === 'Driver' ? 'Drivers' : 'Barriers',
      tone,
      tab: type === 'Driver' ? 'drivers' : 'barriers',
      openCount: openRows.length,
      closedLast90,
      // Pill text reflects critical-activity totals for this record type only.
      countSummary: `Critical Activities: ${counts.open} open | ${counts.closed} closed in last 90 days`,
      activityWindow: '',
      // Show every open record; the Home summary list scrolls (see
      // .home-summary-rows) once it grows past ~5 rows.
      rows: openRows,
    };
  };
  return [
    buildTable('Barrier', 'Barriers', 'barrier'),
    buildTable('Driver', 'Drivers', 'driver'),
  ];
};

export const mergeWithDataValues = (base, valuesFromData) => {
  const seen = new Set();
  const out = [];
  for (const v of [...base, ...valuesFromData]) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

export const valuesFromPicklistLabels= (labels)=>{
  if(!labels) return [];
  if(Array.isArray(labels)){
    return mergeWithDataValues(
      [],
      labels.map((entry)=>{
        if(!entry) return null;
        if(typeof entry ==='string') return entry;
        if(typeof entry !=='object') return null;
        return entry.value || entry.apiValue || entry.apiName  || entry.label;
      })
    )
  }
  if(typeof labels === 'object') return mergeWithDataValues([],Object.keys(labels));
  return [];
}
