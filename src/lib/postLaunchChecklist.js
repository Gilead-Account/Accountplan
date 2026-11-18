export const CHECKLIST_FUNCTIONS = Object.freeze(['Commercial/Market Access', 'Medical']);
export const CHECKLIST_STATUSES = Object.freeze(['Not Started', 'Completed']);
export const CHECKLIST_COMMENT_LIMIT = 255;

// PRD baseline assumptions; business approval is still required before release.
export const REACH_LAUNCH_START = '2027-01-04';
export const REACH_WINDOW_DAYS = 60;
export const TRIFECTA_TASKS = Object.freeze([
  'Confirm Exception Availability (add exception process in MM profile section)',
  'Validate Formulary Inclusion',
  'Deliver Value Proposition (Verbal Presentation)',
]);

export const normalizeChecklistStatus = (value) => value === 'Completed' ? 'Completed' : 'Not Started';

// Compare civil dates as day numbers, so DST and UTC offsets cannot change age.
export const calendarDay = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(String(value || ''));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (String(value).length > 10 && Number.isNaN(Date.parse(value))) return null;
  return date.getTime() / 86400000;
};

export const formatChecklistDate = (value) => {
  const day = calendarDay(value);
  if (day === null) return 'Not provided';
  return new Date(day * 86400000).toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  });
};

export const sortChecklistItems = (items, key = 'dueDate', direction = 'asc') => {
  const sign = direction === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    let comparison;
    if (key === 'dueDate') {
      const left = calendarDay(a.dueDate);
      const right = calendarDay(b.dueDate);
      // Missing dates stay last in either direction.
      if (left === null && right !== null) return 1;
      if (right === null && left !== null) return -1;
      comparison = (left ?? 0) - (right ?? 0);
    } else {
      comparison = String(a[key] || '').localeCompare(String(b[key] || ''), 'en', { sensitivity: 'base' });
    }
    return comparison * sign || a.description.localeCompare(b.description, 'en') || String(a.id).localeCompare(String(b.id));
  });
};

export const calculateTrifecta = (items) => ({
  // Preserve the documented baseline: matching records count, including duplicates.
  completed: items.filter((item) => item.functionName === CHECKLIST_FUNCTIONS[0]
    && TRIFECTA_TASKS.includes(item.description) && item.status === 'Completed').length,
  total: TRIFECTA_TASKS.length,
});

const enabled = (value) => value === true || value === 1 || /^(true|yes|1)$/i.test(String(value || '').trim());
export const checklistRecordKey = (value) => {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(id) ? id.slice(0, 15) : id;
};
const isTreater = (value) => String(value || '').split(';')
  .some((entry) => entry.toLowerCase().replace(/[^a-z0-9]/g, '') === 'carttreater');

export const eligibleReachHcpIds = (stakeholders) => [...new Map(stakeholders
  .filter((row) => !enabled(row.KPH_Is_Deleted__c)
    && enabled(row.KPH_MM_Target__c) && isTreater(row.KPH_MM_HCP_Classification__c)
    && String(row.KPH_Account__c || '').trim())
  .map((row) => [checklistRecordKey(row.KPH_Account__c), row.KPH_Account__c])).values()];

export const calculateReach = (stakeholders, calls, now = new Date()) => {
  const eligible = new Set(eligibleReachHcpIds(stakeholders).map(checklistRecordKey));
  const today = calendarDay(now);
  const launch = calendarDay(REACH_LAUNCH_START);
  const reached = new Set();
  for (const call of calls) {
    const date = calendarDay(call.Call_Date_vod__c);
    const hcpId = checklistRecordKey(call.Account_vod__c);
    if (eligible.has(hcpId) && date !== null && today !== null && date >= launch
      && date <= today && today - date < REACH_WINDOW_DAYS) reached.add(hcpId);
  }
  return { reached: reached.size, total: eligible.size };
};
