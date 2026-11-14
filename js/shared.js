// Shared primitives for every Account Plan page composer.
//
// What lives here:
//   • Field-list constants for each Veeva object the app touches
//   • Raw fetchers (`fetchPlan`, `fetchAccount`, `fetchHeaderFields`,
//     `fetchBarriersAndDrivers`, `fetchCriticalActivities`, `fetchPodUsers`,
//     `fetchTeamMembersByPlan`, `fetchStakeholders`)
//   • Mappers that flatten VOD-shaped responses into plain UI objects
//   • `resolveShellContext()` — the plan + parent Account every page needs
//     for the sidebar/header (avoids each page re-implementing the chain)
//
// What does NOT live here:
//   • Page-level orchestration / Promise.all wiring → that lives in each
//     page's own file (home.js, stakeholders.js, ...). Each page imports
//     only the primitives it needs.
//
// Adding a new page? Add its raw fetcher + mapper here, then create
// `accountPlan/<page>.js` and compose them in a `load<Page>()` function.

import {
  runQuery,
  getDataForCurrentObject,
  unwrap,
  buildIdMatchWhere,
  toCanonicalSalesforceId,
  salesforceIdVariants,
  createRecord,
  updateRecord,
} from '@/lib/dataservice/query';
import { isOnline } from '@/lib/dataservice/client';
import { normalizeCrmBoolean } from '@/lib/helper/utils';

// =============================================================================
// Plan + Account (used by every page for the sidebar/header)
// =============================================================================

// IMPORTANT: no cross-object (dotted) fields here. iPad's offline VQL
// engine rejects the entire query if it can't resolve a relationship like
// `Owner.Name` or `Account_vod__r.Name`. We fetch the Account separately
// via fetchAccount(plan.accountId) and skip Owner.Name (not displayed).
//
// `LastActivityDate` is a Salesforce-computed roll-up from child activities
// — it's not always replicated to the iPad offline DB, and asking for it
// there can reject the whole query. Gate it behind isOnline().
export const CUSTOMER_GOALS_FIELD = 'KPH_ATC_Strategic_Opportunities__c';
export const APPROVAL_STATUS_FIELD = 'KPH_Approval_Status__c';
export const APPROVAL_SUBMITTED_FIELD = 'KPH_Is_Submitted__c';

const toBooleanFlag = (value) => {
  const raw = fieldValue(value);
  return (
    raw === true ||
    raw === 1 ||
    ['true', 'yes', '1', 'active'].includes(String(raw || '').trim().toLowerCase())
  );
};

const PLAN_FIELDS_BASE = [
  'Id',
  'Name',
  'OwnerId',
  'CreatedDate',
  'LastModifiedDate',
  'Account_vod__c',
  CUSTOMER_GOALS_FIELD,
  'KPH_Last_POD_Meeting__c',
  'KPH_Last_MPD_Review_Date__c',
  'KPH_Territory_Description__c',
  'KPH_Territory__c',
  'KPH_Plan_status__c',
  'KPH_Approval_Status__c',
  'KPH_Is_Submitted__c',
  'KPH_Dry_Run_Date__c',
  'KPH_Potential_ATC__c',
  'KPH_Account_Phase__c',
];

export const PLAN_FIELDS = isOnline()
  ? [...PLAN_FIELDS_BASE, 'LastActivityDate']
  : PLAN_FIELDS_BASE;

export const ACCOUNT_FIELDS = [
  'Id',
  'Name',
  'EID_GILD__c',
  'Territory_vod__c',
  // NOTE: KPH_MM_ATC_Priority__c is queried separately. Some MyInsights users
  // may not have field-level read access, and including an inaccessible field
  // here makes Veeva fail the whole Account query (getFieldLabel error, code 21).
];
const ACCOUNT_MM_ATC_PRIORITY_FIELD = 'KPH_MM_ATC_Priority__c';
const ACCOUNT_MARKET_ACCESS_PRIORITIZED_FIELD = 'KPH_Market_Access_Prioritized_Account__c';

// ── plan-ID fallback chain ──────────────────────────────────────────────────
// Mirrors `resolveAccountPlanIdFallback` in the legacy data-repositories.js.
// Order matters: more-trusted sources first, scrapy URL/referrer sources last.

const SF_ID_PATTERN = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;
const isLikelySalesforceId = (value) =>
  typeof value === 'string' && SF_ID_PATTERN.test(value.trim());

const tryWindowGlobal = (path) => {
  if (typeof window === 'undefined') return null;
  let node = window;
  for (const segment of path) {
    try {
      if (!node || typeof node !== 'object') return null;
      node = node[segment];
    } catch {
      // cross-origin window access can throw; treat as not-present
      return null;
    }
  }
  return node;
};

const readHtmlConfigRecordId = () => {
  // Veeva injects window.HTMLConfig.currentObjectID when launching MyInsights
  // from a record page. On iPad it's the most reliable signal even when
  // getDataForCurrentObject returns nothing.
  const candidates = [
    tryWindowGlobal(['HTMLConfig', 'currentObjectID']),
    tryWindowGlobal(['parent', 'HTMLConfig', 'currentObjectID']),
    tryWindowGlobal(['top', 'HTMLConfig', 'currentObjectID']),
  ];
  for (const c of candidates) {
    if (isLikelySalesforceId(c)) return String(c).trim();
  }
  return null;
};

const extractIdFromUrl = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const KEYS = ['id', 'recordId', 'recordid', 'cpId', 'accountPlanId', 'accountplanid'];
  try {
    const url = new URL(raw, typeof window !== 'undefined' && window.location ? window.location.origin : undefined);
    for (const key of KEYS) {
      const v = url.searchParams.get(key);
      if (isLikelySalesforceId(v)) return v.trim();
    }
  } catch {
    // string isn't a valid URL — fall through to regex scrape
  }
  const m = raw.match(/[?&#](?:id|recordId|recordid|cpId|accountPlanId|accountplanid)=([a-zA-Z0-9]{15,18})/);
  if (m && isLikelySalesforceId(m[1])) return m[1];
  return null;
};

const readUrlAndReferrerRecordId = () => {
  if (typeof window === 'undefined') return null;
  const sources = [
    window.location && window.location.href,
    window.location && window.location.search,
    window.location && window.location.hash,
    window.document && window.document.referrer,
  ];
  for (const src of sources) {
    const found = extractIdFromUrl(src);
    if (found) return found;
  }
  return null;
};

let currentAccountPlanIdOverride = null;
let currentAccountPlanIdInFlight = null;
const shellContextInFlight = new Map();

const readCurrentAccountPlanIdOverride = () => {
  if (isLikelySalesforceId(currentAccountPlanIdOverride)) {
    return String(currentAccountPlanIdOverride).trim();
  }
  const override =
    typeof window !== 'undefined' ? window.__KAM_ACCOUNT_PLAN_ID__ : null;
  return isLikelySalesforceId(override) ? String(override).trim() : null;
};

export const setCurrentAccountPlanIdOverride = (planId) => {
  const nextPlanId = isLikelySalesforceId(planId) ? String(planId).trim() : null;
  currentAccountPlanIdOverride = nextPlanId;
  currentAccountPlanIdInFlight = null;
  shellContextInFlight.clear();
  if (typeof window !== 'undefined') {
    if (nextPlanId) {
      window.__KAM_ACCOUNT_PLAN_ID__ = nextPlanId;
    } else {
      delete window.__KAM_ACCOUNT_PLAN_ID__;
    }
  }
  return nextPlanId;
};

/**
 * Resolves which Account_Plan_vod__c to load. Tries every source the legacy
 * AngularJS app does, so the React app works in the same runtimes:
 *
 *   1. `window.__KAM_ACCOUNT_PLAN_ID__` override (dev fixtures / hosting page)
 *   2. Veeva DataService — `getDataForCurrentObject('Account_Plan_vod__c', 'Id')`
 *   3. `window.HTMLConfig.currentObjectID` (incl. parent + top windows)
 *      — Veeva populates this on iPad when the DS context is missing
 *   4. URL / referrer scrape (`?id=`, `?recordId=`, etc.)
 *   5. Account in context → fall back to that HCO's most recent plan
 *
 * If a candidate is a 15-char ID, callers should still expand to both 15
 * and 18-char forms when building WHERE clauses (use `buildIdMatchWhere`).
 */
const resolveCurrentAccountPlanId = async () => {
  const dsPlanId = await getDataForCurrentObject('Account_Plan_vod__c', 'Id');
  if (isLikelySalesforceId(dsPlanId)) return dsPlanId;

  const htmlConfigId = readHtmlConfigRecordId();
  if (htmlConfigId) return htmlConfigId;

  const urlId = readUrlAndReferrerRecordId();
  if (urlId) return urlId;

  const accountId = await getDataForCurrentObject('Account', 'Id');
  if (!isLikelySalesforceId(accountId)) return null;

  const accountWhere = buildIdMatchWhere('Account_vod__c', accountId);
  if (!accountWhere) return null;

  const rows = await runQuery({
    object: 'Account_Plan_vod__c',
    fields: ['Id'],
    where: accountWhere,
    sort: ['LastModifiedDate DESC'],
    limit: 1,
  });
  const row = unwrap(rows[0]);
  return row ? row.Id : null;
};

export const getCurrentAccountPlanId = async () => {
  const override = readCurrentAccountPlanIdOverride();
  if (isLikelySalesforceId(override)) return override;
  if (currentAccountPlanIdInFlight) return currentAccountPlanIdInFlight;

  currentAccountPlanIdInFlight = resolveCurrentAccountPlanId().then(
    (planId) => {
      currentAccountPlanIdInFlight = null;
      return planId;
    },
    (error) => {
      currentAccountPlanIdInFlight = null;
      throw error;
    }
  );
  return currentAccountPlanIdInFlight;
};

export const getCurrentUserId = () => getDataForCurrentObject('User', 'Id');

export const getCurrentUserEmail = () => getDataForCurrentObject('User', 'Email');

export const getCurrentUserUsername = () => getDataForCurrentObject('User', 'Username');

const USER_PROFILE_NAME_FIELDS = [
  'Profile_Name_vod_c',
  'Profile_Name_vod__c',
];

export const getCurrentUserProfileName = async () => {
  for (const field of USER_PROFILE_NAME_FIELDS) {
    const value = await getDataForCurrentObject('User', field);
    if (value) return value;
  }
  return null;
};

// `Id = '...'` — but matched against BOTH the 15-char and 18-char forms so
// the planId from `getDataForCurrentObject` (which on iPad is often 15-char)
// reliably hits an 18-char stored value.
export const fetchPlan = (planId, fields = PLAN_FIELDS) => {
  const where = buildIdMatchWhere('Id', planId);
  if (!where) return Promise.resolve(null);
  return runQuery({
    object: 'Account_Plan_vod__c',
    fields,
    where,
    limit: 1,
  }).then((rows) => unwrap(rows[0]));
};

export const fetchPlanApprovalStatus = async (planId) => {
  const resolvedPlanId = planId || await getCurrentAccountPlanId();
  const where = buildIdMatchWhere('Id', resolvedPlanId);
  if (!where) return null;

  const rows = await runQuery({
    object: 'Account_Plan_vod__c',
    fields: ['Id', APPROVAL_STATUS_FIELD, APPROVAL_SUBMITTED_FIELD, 'LastModifiedDate'],
    where,
    limit: 1,
  });
  const r = unwrap(rows[0]);
  if (!r) return null;

  return {
    planId: r.Id,
    approvalStatus: r[APPROVAL_STATUS_FIELD],
    isSubmitted: toBooleanFlag(r[APPROVAL_SUBMITTED_FIELD]),
    lastModifiedDate: r.LastModifiedDate || null,
  };
};

export const toPlanShape = (r) => {
  if (!r) return null;
  return {
    id: r.Id,
    name: r.Name,
    ownerId: r.OwnerId,
    ownerName: null,
    accountId: r.Account_vod__c,
    dryRunDate: r.KPH_Dry_Run_Date__c || null,
    potentialAtc: toBooleanFlag(r.KPH_Potential_ATC__c),
    accountPhase: r.KPH_Account_Phase__c || null,
    // Filled in by fetchAccount() after the Account row loads.
    accountName: null,
    lastPodMeetingDate: r.KPH_Last_POD_Meeting__c || r.LastActivityDate || null,
    lastMpdApprovalDate: r.KPH_Last_MPD_Review_Date__c,
    territoryDescription: r.KPH_Territory_Description__c || r.KPH_Territory__c,
    planStatus: r.KPH_Plan_status__c,
    approvalStatus: r.KPH_Approval_Status__c,
    isSubmitted: toBooleanFlag(r.KPH_Is_Submitted__c),
    lastModifiedDate: r.LastModifiedDate,
  };
};

const fetchAccountHeaderFields = (accountId) => {
  const where = buildIdMatchWhere('Id', accountId);
  if (!where) {
    return Promise.resolve({
      mmAtcPriority: null,
      marketAccessPrioritizedAccount: null,
    });
  }
  return runQuery({
    object: 'Account',
    fields: [
      'Id',
      ACCOUNT_MM_ATC_PRIORITY_FIELD,
      ACCOUNT_MARKET_ACCESS_PRIORITIZED_FIELD,
    ],
    where,
    limit: 1,
  })
    .then((rows) => {
      const r = unwrap(rows[0]);
      return {
        mmAtcPriority: r?.[ACCOUNT_MM_ATC_PRIORITY_FIELD] || null,
        marketAccessPrioritizedAccount: r?.[ACCOUNT_MARKET_ACCESS_PRIORITIZED_FIELD] || null,
      };
    })
    .catch(() => ({
      mmAtcPriority: null,
      marketAccessPrioritizedAccount: null,
    }));
};

export const fetchAccount = async (accountId) => {
  const where = buildIdMatchWhere('Id', accountId);
  if (!where) return null;
  const [rows, accountHeaderFields] = await Promise.all([
    runQuery({
      object: 'Account',
      fields: ACCOUNT_FIELDS,
      where,
      limit: 1,
    }),
    fetchAccountHeaderFields(accountId),
  ]);
  const r = unwrap(rows[0]);
  if (!r) return null;
  return {
    id: r.Id,
    name: r.Name,
    eid: r.EID_GILD__c,
    territory: r.Territory_vod__c,
    mmAtcPriority: accountHeaderFields.mmAtcPriority,
    marketAccessPrioritizedAccount: accountHeaderFields.marketAccessPrioritizedAccount,
  };
};

const ACCOUNT_LOOKUP_SITE_RECORD_TYPE_IDS = ['01241000000cF0GAAU', '01241000000mw9YAAQ'];

const quoteSoqlValue = (value) => `'${String(value || '').replace(/'/g, "\\'")}'`;

const accountLookupSearchTerm = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const titleCaseSearchTerm = (value) =>
  accountLookupSearchTerm(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

const accountLookupSearchVariants = (value) => {
  const term = accountLookupSearchTerm(value);
  if (!term) return [];
  return Array.from(new Set([term, term.toLowerCase(), term.toUpperCase(), titleCaseSearchTerm(term)]));
};

const accountLookupSiteWhere = () =>
  `(${ACCOUNT_LOOKUP_SITE_RECORD_TYPE_IDS.map((id) => `RecordTypeId = ${quoteSoqlValue(id)}`).join(' OR ')}) AND IsPersonAccount = false`;

const accountLookupWhere = (searchTerm) => {
  const variants = accountLookupSearchVariants(searchTerm);
  if (!variants.length) return accountLookupSiteWhere();
  const nameClauses = variants.map((term) => `Name LIKE ${quoteSoqlValue(`%${term}%`)}`);
  return `${accountLookupSiteWhere()} AND (${nameClauses.join(' OR ')})`;
};

const ACCOUNT_LOOKUP_FIELDS = [
  'Id',
  'Name',
  'EID_GILD__c',
  'Account_Identifier_vod__c',
  'NET_External_Id__c',
  'AccountNumber',
  'Territory_vod__c',
];

const accountMatchesLookupTerm = (row, searchTerm) => {
  const term = accountLookupSearchTerm(searchTerm).toLowerCase();
  if (!term) return true;
  return String(row?.name || '').toLowerCase().includes(term);
};

const toAccountLookupOption = (row) => {
  const r = unwrap(row);
  if (!r || !r.Id || !r.Name) return null;
  const accountIdentifier =
    r.Account_Identifier_vod__c || r.EID_GILD__c || r.NET_External_Id__c || r.AccountNumber || null;
  return {
    id: r.Id,
    name: r.Name,
    accountIdentifier,
    eid: r.EID_GILD__c || accountIdentifier,
    territory: r.Territory_vod__c || null,
  };
};

export const searchSiteAccounts = (searchTerm, limit = 25) => {
  const rowLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 25, 50));
  return runQuery({
    object: 'Account',
    fields: ACCOUNT_LOOKUP_FIELDS,
    where: accountLookupWhere(searchTerm),
    sort: ['Name ASC'],
    limit: rowLimit,
  })
    .then((rows) =>
      rows
        .map(toAccountLookupOption)
        .filter(Boolean)
        .filter((row) => accountMatchesLookupTerm(row, searchTerm))
        .slice(0, rowLimit)
    )
    .catch((error) => {
      console.warn('[accountLookup] search failed', error);
      return [];
    });
};

const accountNameWhere = (searchTerm) => {
  const personAccountWhere = 'IsPersonAccount = true';
  const variants = accountLookupSearchVariants(searchTerm);
  if (!variants.length) return personAccountWhere;
  return `${personAccountWhere} AND (${variants.map((term) => `Name LIKE ${quoteSoqlValue(`%${term}%`)}`).join(' OR ')})`;
};

export const searchStakeholderAccounts = (searchTerm = '', limit = 60) => {
  const rowLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 60, 60));
  return runQuery({
    object: 'Account',
    fields: ACCOUNT_LOOKUP_FIELDS,
    where: accountNameWhere(searchTerm),
    sort: ['Name ASC'],
    limit: rowLimit,
  })
    .then((rows) =>
      rows
        .map(toAccountLookupOption)
        .filter(Boolean)
        .filter((row) => accountMatchesLookupTerm(row, searchTerm))
        .slice(0, rowLimit)
    )
    .catch((error) => {
      console.warn('[stakeholderAccountLookup] search failed', error);
      return [];
    });
};

const USER_LOOKUP_FIELDS = ['Id', 'Name'];

const normalizeUserLookupId = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const canonical = toCanonicalSalesforceId(text);
  return canonical ? canonical.slice(0, 15).toLowerCase() : text.toLowerCase();
};

const userLookupExcludedIdSet = (excludedUserIds = []) =>
  new Set(
    (excludedUserIds || [])
      .map(normalizeUserLookupId)
      .filter(Boolean)
  );

const userLookupExclusionWhere = (excludedUserIds = []) => {
  const seen = new Set();
  const clauses = [];
  for (const id of excludedUserIds || []) {
    const variants = salesforceIdVariants(id);
    for (const value of variants.length ? variants : [id]) {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      clauses.push(`Id != ${quoteSoqlValue(text)}`);
    }
  }
  return clauses.join(' AND ') || undefined;
};

const userLookupWhere = (searchTerm, excludedUserIds = []) => {
  const clauses = [];
  const variants = accountLookupSearchVariants(searchTerm);
  if (variants.length) {
    clauses.push(`(${variants.map((term) => `Name LIKE ${quoteSoqlValue(`%${term}%`)}`).join(' OR ')})`);
  }
  const exclusionWhere = userLookupExclusionWhere(excludedUserIds);
  if (exclusionWhere) clauses.push(exclusionWhere);
  return clauses.join(' AND ') || undefined;
};

const userMatchesLookupTerm = (row, searchTerm) => {
  const term = accountLookupSearchTerm(searchTerm).toLowerCase();
  if (!term) return true;
  return String(row?.name || '').toLowerCase().includes(term);
};

const toUserLookupOption = (row) => {
  const r = unwrap(row);
  if (!r || !r.Id || !r.Name) return null;
  return {
    id: r.Id,
    name: r.Name,
  };
};

export const searchUsers = (searchTerm = '', limit = 60, excludeUserIds = []) => {
  const rowLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 60, 60));
  const excludedIds = userLookupExcludedIdSet(excludeUserIds);
  return runQuery({
    object: 'User',
    fields: USER_LOOKUP_FIELDS,
    where: userLookupWhere(searchTerm, excludeUserIds),
    sort: ['Name ASC'],
    limit: rowLimit,
  })
    .then((rows) =>
      rows
        .map(toUserLookupOption)
        .filter(Boolean)
        .filter((row) => userMatchesLookupTerm(row, searchTerm))
        .filter((row) => !excludedIds.has(normalizeUserLookupId(row.id)))
        .slice(0, rowLimit)
    )
    .catch((error) => {
      console.warn('[userLookup] search failed', error);
      return [];
    });
};

const missingAccountPlanContextError = () =>
  new Error('No Account Plan in context. Did MyInsights launch from an Account_Plan_vod__c record?');

export const requireCurrentAccountPlanId = async () => {
  const planId = await getCurrentAccountPlanId();
  if (!planId) throw missingAccountPlanContextError();
  return planId;
};

const shellContextKey = (planId, planFields = PLAN_FIELDS) => {
  const normalizedPlanId = toCanonicalSalesforceId(planId) || String(planId || '').trim();
  return `${normalizedPlanId}|${(planFields || PLAN_FIELDS).join(',')}`;
};

/**
 * Plan + parent Account resolution shared across page loaders. Every page
 * needs the sidebar/header values, so this avoids duplicating the
 * planId → plan → account chain in each loader.
 */
const buildShellContextForPlanId = async (planId, planFields = PLAN_FIELDS) => {
  if (!planId) throw missingAccountPlanContextError();
  const planRow = await fetchPlan(planId, planFields);
  if (!planRow) throw new Error(`Account Plan ${planId} not found.`);
  const plan = toPlanShape(planRow);
  const account = await fetchAccount(plan.accountId);
  // Canonical-form plan ID — every plan-scoped child query downstream should
  // use this, then wrap it in `buildIdMatchWhere` to still hit 15-char fields.
  const canonicalPlanId = toCanonicalSalesforceId(planRow.Id) || planRow.Id || planId;
  return { planId: canonicalPlanId, planRow, plan, account };
};

export const resolveShellContextForPlanId = async (planId, { planFields = PLAN_FIELDS } = {}) => {
  if (!planId) throw missingAccountPlanContextError();

  const key = shellContextKey(planId, planFields);
  if (shellContextInFlight.has(key)) return shellContextInFlight.get(key);

  const request = buildShellContextForPlanId(planId, planFields).then(
    (context) => {
      shellContextInFlight.delete(key);
      return context;
    },
    (error) => {
      shellContextInFlight.delete(key);
      throw error;
    }
  );
    console.log('[PotentialAtc updateCustomerGoals] Open clicked Payoad:', JSON.stringify(planId));

  shellContextInFlight.set(key, request);
  return request;
};

export const resolveShellContext = async () =>
  resolveShellContextForPlanId(await requireCurrentAccountPlanId());

// =============================================================================
// Customer Goals  ─ Account_Plan_vod__c
// =============================================================================
// Single field; just a getter so the name of truth is discoverable.

export const toCustomerGoals = (planRow) =>
  planRow?.[CUSTOMER_GOALS_FIELD] || null;

export const updateCustomerGoals = (planId, value) => {
  if (!planId) return Promise.reject(new Error('Missing account plan id.'));
    console.log('[PotentialAtc updateCustomerGoals] Open clicked Payoad:', JSON.stringify(planId));
  return updateRecord('Account_Plan_vod__c', planId, {
    [CUSTOMER_GOALS_FIELD]: value || '',
  });
};

// =============================================================================
// Header strip fields  ─ KPH_Ecosystem_Plan__c
// =============================================================================
// MM Account Priority has no field in CRM yet → dummy value.

export const ECOSYSTEM_PLAN_FIELDS = [
  'Id',
  'KPH_Account_Plan__c',
  'KPH_ATC_Cohort__c',
  'KPH_ATC_Share_of_Business_R6M_1Q_Lag__c',
  'KPH_KLT_Sprint_Account__c',
  'KPH_KAD_Target_List__c',
];

export const MM_ACCOUNT_PRIORITY_DUMMY = 'On hold';

export const fetchHeaderFields = (planId) => {
  const where = buildIdMatchWhere('KPH_Account_Plan__c', planId);
  if (!where) return Promise.resolve({ ecosystemPlanId: null, header: null });
  return runQuery({
    object: 'KPH_Ecosystem_Plan__c',
    fields: ECOSYSTEM_PLAN_FIELDS,
    where,
    sort: ['LastModifiedDate DESC'],
    limit: 1,
  }).then((rows) => {
    const r = unwrap(rows[0]);
    if (!r) return { ecosystemPlanId: null, header: null };
    return {
      ecosystemPlanId: r.Id,
      header: {
        atcCohort: r.KPH_ATC_Cohort__c,
        atcSegment: r.KPH_ATC_Share_of_Business_R6M_1Q_Lag__c,
        kltSprintAccount: normalizeCrmBoolean(r.KPH_KLT_Sprint_Account__c),
        kadTargetList: r.KPH_KAD_Target_List__c,
        referralVolume: null,
        secondLinePlusVolume: null,
        mmAccountPriority: MM_ACCOUNT_PRIORITY_DUMMY,
      },
    };
  });
};

// =============================================================================
// Barriers & Drivers  ─ KPH_Barriers_and_Tactical_Actions__c
// =============================================================================

export const BARRIER_DRIVER_OBJECT = 'KPH_Barriers_and_Tactical_Actions__c';
export const BARRIER_DRIVER_SOFT_DELETE_FIELD = 'KPH_Is_Deleted__c';
export const BARRIER_DRIVER_COMMENTS_FIELD = 'KPH_Comments__c';
export const PLAN_STRATEGY_OBJECT = 'KPH_Strategy__c';
export const PLAN_STRATEGY_ACCOUNT_PLAN_FIELD = 'KPH_Account_Plan__c';
export const PLAN_STRATEGY_VALUE_FIELD = 'KPH_Strategy__c';
export const PLAN_STRATEGY_RANK_FIELD = 'KPH_Strategy_Rank__c';
export const PLAN_STRATEGY_LOOKUP_FIELD = 'KPH_Plan_Strategy__c';
export const BARRIER_DRIVER_RECORD_TYPE_IDS = {
  Barrier: '012VI000006GnvlYAC',
  Driver: '012VI00000FP9p3YAD',
};
export const BARRIER_DRIVER_CATEGORY_FIELDS = {
  barrier: 'KPH_Barrier_Type__c',
  driver: 'KPH_Driver_Type__c',
};
export const BARRIER_DRIVER_INDICATION_FIELD = 'KPH_Indication__c';
export const BARRIER_DRIVER_STRATEGY_FIELD = 'KPH_Strategy__c';
export const KITE_DATA_ADMIN_USER_ID = '0056T000009zj0UQAQ';
export const MM_INDICATION_VALUE = 'MM';

export const BARRIER_DRIVER_STATUS_ORDER = [
  'Identified - Not Started',
  'In Progress',
  'Near Outcome',
  'Closed',
];

const barrierDriverStatusKey = (value) =>
  String(value || '')
    .trim()
    .replace(/[\u2013\u2014]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const barrierDriverStatusRank = (value) => {
  const status = normalizeBarrierDriverStatusForDisplay(value);
  const index = BARRIER_DRIVER_STATUS_ORDER.indexOf(status);
  return index === -1 ? BARRIER_DRIVER_STATUS_ORDER.length : index;
};

export const isClosedBarrierDriverStatus = (value) =>
  normalizeBarrierDriverStatusForDisplay(value) === 'Closed';

export const isOpenBarrierDriverStatus = (value) =>
  !isClosedBarrierDriverStatus(value);

export const barrierDriverCategoryFieldFor = (type, indication) => {
  const isDriver = type === 'Driver';
  return isDriver ? BARRIER_DRIVER_CATEGORY_FIELDS.driver : BARRIER_DRIVER_CATEGORY_FIELDS.barrier;
};

export const barrierDriverUsesStrategy = (indication) => {
  const key = String(indication || '').trim().toUpperCase();
  // MM uses the same strategy field (KPH_Strategy__c) as DLBCL/Portfolio.
  return key === 'DLBCL' || key === 'PORTFOLIO' || key === MM_INDICATION_VALUE;
};

export const isMmIndication = (indication) =>
  String(indication || '').trim().toUpperCase() === MM_INDICATION_VALUE;

export const isBarrierDriverIndicationAllowedForType = (type, indication) => {
  if ((indication)) return true;
  return type === 'Driver';
};

export const filterBarrierDriverIndicationsForType = (values = [], type, currentValue = '') => {
  const out = [];
  const seen = new Set();
  for (const value of [currentValue, ...(values || [])]) {
    if (!value || seen.has(value)) continue;
    if (!isBarrierDriverIndicationAllowedForType(type, value) && value !== currentValue) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

// Existing CRM rows flow through from CRM. Create/edit controls apply the
// current type-specific indication rule without hiding already-saved data.
export const isVisibleBarrierDriverIndication = () => true;

const normalizeRecordTypeId = (value) => {
  if (!value) return '';
  return toCanonicalSalesforceId(value) || String(value).trim();
};

const sameSalesforceId = (left, right) =>
  normalizeRecordTypeId(left) === normalizeRecordTypeId(right);

const barrierDriverRecordTypeId = (type) =>
  BARRIER_DRIVER_RECORD_TYPE_IDS[type === 'Driver' ? 'Driver' : 'Barrier'];

const typeFromBarrierDriverRecordTypeId = (recordTypeId) => {
  const normalized = normalizeRecordTypeId(recordTypeId);
  if (!normalized) return '';
  if (normalized === normalizeRecordTypeId(BARRIER_DRIVER_RECORD_TYPE_IDS.Driver)) return 'Driver';
  if (normalized === normalizeRecordTypeId(BARRIER_DRIVER_RECORD_TYPE_IDS.Barrier)) return 'Barrier';
  return '';
};

// Title and Category live on different fields for the two Salesforce record types:
// barriers use the Barrier fields and drivers use the Driver fields.
export const BARRIER_DRIVER_BASE_FIELDS = [
  'Id',
  'Name',
  'CreatedById',
  'RecordTypeId',
  'LastModifiedDate',
  'KPH_Account_Plan__c',
  'KPH_Barrier_Title__c',
  'KPH_Driver_Title__c',
  BARRIER_DRIVER_CATEGORY_FIELDS.barrier,
  BARRIER_DRIVER_CATEGORY_FIELDS.driver,
  BARRIER_DRIVER_INDICATION_FIELD,
  'KPH_Status__c',
  'KPH_Rank_1__c',
  BARRIER_DRIVER_STRATEGY_FIELD,
  PLAN_STRATEGY_LOOKUP_FIELD,
  BARRIER_DRIVER_SOFT_DELETE_FIELD,
];

export const BARRIER_DRIVER_OPTIONAL_FIELDS = [BARRIER_DRIVER_COMMENTS_FIELD];

export const BARRIER_DRIVER_FIELDS = [
  ...BARRIER_DRIVER_BASE_FIELDS,
  ...BARRIER_DRIVER_OPTIONAL_FIELDS,
];

export const PLAN_STRATEGY_FIELDS = [
  'Id',
  'Name',
  PLAN_STRATEGY_ACCOUNT_PLAN_FIELD,
  PLAN_STRATEGY_VALUE_FIELD,
  PLAN_STRATEGY_RANK_FIELD,
];

// "Clinical-Grow Class | Expand Referral Networks" -> "Clinical"
export const categoryPrefix = (value) => {
  if (!value) return null;
  const idx = String(value).indexOf('-');
  return idx === -1 ? value : value.slice(0, idx).trim();
};

const barrierDriverFieldAccess = (fields) => ({
  canEditComments: fields.includes(BARRIER_DRIVER_COMMENTS_FIELD),
});

export const normalizeBarrierDriverStatusForDisplay = (value) => {
  const key = barrierDriverStatusKey(value);
  if (key === 'close' || key === 'closed' || key === 'complete' || key === 'completed') return 'Closed';
  if (key === 'open' || key === 'identified - not started' || !key) return 'Identified - Not Started';
  if (key === 'in progress') return 'In Progress';
  if (key === 'near outcome') return 'Near Outcome';
  return value;
};

export const normalizeBarrierDriverStatusForSave = (value) => {
  return normalizeBarrierDriverStatusForDisplay(value);
};

export const toPlanStrategy = (row) => {
  const r = unwrap(row);
  if (!r) return null;
  return {
    id: r.Id,
    accountPlanId: r[PLAN_STRATEGY_ACCOUNT_PLAN_FIELD] || null,
    strategy: r[PLAN_STRATEGY_VALUE_FIELD] || null,
    strategyRank: r[PLAN_STRATEGY_RANK_FIELD] || null,
  };
};

export const fetchPlanStrategies = (planId) => {
  const where = buildIdMatchWhere(PLAN_STRATEGY_ACCOUNT_PLAN_FIELD, planId);
  if (!where) return Promise.resolve([]);
  return runQuery({
    object: PLAN_STRATEGY_OBJECT,
    fields: PLAN_STRATEGY_FIELDS,
    where,
    sort: ['Name ASC'],
  }).then(
    (rows) => rows.map(toPlanStrategy).filter(Boolean),
    (error) => {
      console.warn('[planStrategy] fetch failed; treating as empty', error);
      return [];
    }
  );
};

const fetchPlanStrategyByValue = (planId, strategyValue) => {
  const strategy = String(strategyValue || '').trim();
  const planWhere = buildIdMatchWhere(PLAN_STRATEGY_ACCOUNT_PLAN_FIELD, planId);
  if (!planWhere || !strategy) return Promise.resolve(null);
  return runQuery({
    object: PLAN_STRATEGY_OBJECT,
    fields: PLAN_STRATEGY_FIELDS,
    where: `(${planWhere}) AND ${PLAN_STRATEGY_VALUE_FIELD} = ${quoteSoqlValue(strategy)}`,
    sort: ['LastModifiedDate DESC', 'Name ASC'],
    limit: 1,
  }).then(
    (rows) => toPlanStrategy(rows[0]),
    (error) => {
      console.warn('[planStrategy] lookup failed; attempting create', error);
      return null;
    }
  );
};

export const planStrategyMapById = (planStrategies = []) => {
  const map = new Map();
  for (const strategy of planStrategies || []) {
    if (strategy?.id) map.set(strategy.id, strategy);
  }
  return map;
};

const planStrategyByLookupId = (planStrategyById, id) => {
  if (!id || !planStrategyById || typeof planStrategyById.get !== 'function') return null;
  return planStrategyById.get(id) || null;
};

const picklistLabelForValue = (labels, value) => {
  if (!value || !labels || typeof labels !== 'object') return value || null;
  return Object.prototype.hasOwnProperty.call(labels, value) ? (labels[value] || value) : value;
};

const picklistIndicationKey = (value) => String(value || '').trim().toUpperCase();

const parseBarrierDriverPicklistApiName = (value, indications = []) => {
  const text = String(value || '').trim();
  if (!text) return { label: '', indications: [] };
  const parts = text.split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { label: text, indications: [] };

  const validIndications = new Set((indications || []).map(picklistIndicationKey).filter(Boolean));
  const suffixIndications = parts[parts.length - 1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (
    !validIndications.size ||
    !suffixIndications.length ||
    !suffixIndications.every((part) => validIndications.has(picklistIndicationKey(part)))
  ) {
    return { label: text, indications: [] };
  }

  return {
    label: parts.slice(0, -1).join(' | '),
    indications: suffixIndications,
  };
};

export const buildBarrierDriverStrategyPicklistInfo = (values = [], labels = {}, indications = []) => {
  const validIndicationByKey = new Map(
    (indications || []).map((value) => [picklistIndicationKey(value), value])
  );
  const optionsByIndication = Object.fromEntries((indications || []).map((value) => [value, []]));
  const strategyLabels = {};
  let hasIndicationFilters = false;

  for (const value of values || []) {
    if (!value) continue;
    const parsed = parseBarrierDriverPicklistApiName(value, indications);
    strategyLabels[value] = parsed.indications.length
      ? parsed.label
      : picklistLabelForValue(labels, value);
    if (!parsed.indications.length) continue;
    hasIndicationFilters = true;
    for (const indication of parsed.indications) {
      const key = validIndicationByKey.get(picklistIndicationKey(indication)) || indication;
      if (!optionsByIndication[key]) optionsByIndication[key] = [];
      if (!optionsByIndication[key].includes(value)) optionsByIndication[key].push(value);
    }
  }

  return {
    strategyLabels,
    strategyOptionsByIndication: hasIndicationFilters ? optionsByIndication : {},
    hasIndicationFilters,
  };
};

export const buildBarrierDriverCategoryPicklistInfo = (values = [], labels = {}, indications = []) => {
  const validIndicationByKey = new Map(
    (indications || []).map((value) => [picklistIndicationKey(value), value])
  );
  const optionsByIndication = Object.fromEntries((indications || []).map((value) => [value, []]));
  const categoryLabels = {};
  let hasIndicationFilters = false;

  for (const value of values || []) {
    if (!value) continue;
    const parsed = parseBarrierDriverPicklistApiName(value, indications);
    categoryLabels[value] = parsed.indications.length
      ? parsed.label
      : picklistLabelForValue(labels, value);
    if (!parsed.indications.length) continue;
    hasIndicationFilters = true;
    for (const indication of parsed.indications) {
      const key = validIndicationByKey.get(picklistIndicationKey(indication)) || indication;
      if (!optionsByIndication[key]) optionsByIndication[key] = [];
      if (!optionsByIndication[key].includes(value)) optionsByIndication[key].push(value);
    }
  }

  return {
    categoryLabels,
    categoryOptionsByIndication: hasIndicationFilters ? optionsByIndication : {},
    hasIndicationFilters,
  };
};

export const toBarrierDriver = (
  row,
  access = barrierDriverFieldAccess(BARRIER_DRIVER_FIELDS),
  planStrategyById = new Map(),
  options = {}
) => {
  const r = unwrap(row);
  if (!r) return null;
  const planStrategyId = r[PLAN_STRATEGY_LOOKUP_FIELD] || null;
  const planStrategy = planStrategyByLookupId(planStrategyById, planStrategyId);
  const recordTypeType = typeFromBarrierDriverRecordTypeId(r.RecordTypeId);
  const isDriver = recordTypeType
    ? recordTypeType === 'Driver'
    : !!(
      r.KPH_Driver_Title__c ||
      r[BARRIER_DRIVER_CATEGORY_FIELDS.driver]
    );
  const titleFallback = isDriver
    ? r.KPH_Driver_Title__c
    : r.KPH_Barrier_Title__c;
  const categoryRaw = isDriver
    ? r[BARRIER_DRIVER_CATEGORY_FIELDS.driver]
    : r[BARRIER_DRIVER_CATEGORY_FIELDS.barrier];
  const usesStrategy = barrierDriverUsesStrategy(r[BARRIER_DRIVER_INDICATION_FIELD]);
  const strategy = usesStrategy ? (fieldValue(r[BARRIER_DRIVER_STRATEGY_FIELD]) || null) : null;
  const createdById = lookupIdValue(r.CreatedById) || '';
  const preLaunchKey = String(strategy || '')
    .trim()
    .replace(/[\u2013\u2014]/g, '-')
    .toLowerCase();
  const isPreLaunchDriver = isDriver && /pre[\s-]*launch/.test(preLaunchKey);
  return {
    id: r.Id,
    accountPlanId: r.KPH_Account_Plan__c || null,
    type: recordTypeType || (isDriver ? 'Driver' : 'Barrier'),
    recordTypeId: r.RecordTypeId || null,
    name: titleFallback,
    category: picklistLabelForValue(options.categoryLabels, categoryRaw) || categoryPrefix(categoryRaw) || null,
    categoryValue: categoryRaw || null,
    indication: r[BARRIER_DRIVER_INDICATION_FIELD],
    status: normalizeBarrierDriverStatusForDisplay(r.KPH_Status__c),
    businessImpact: r.KPH_Rank_1__c,
    strategy,
    strategyLabel: strategy ? picklistLabelForValue(options.strategyLabels, strategy) : null,
    strategyRank: usesStrategy ? (planStrategy?.strategyRank || null) : null,
    planStrategyId: usesStrategy ? planStrategyId : null,
    comments: access.canEditComments ? (r[BARRIER_DRIVER_COMMENTS_FIELD] || '') : '',
    canEditComments: access.canEditComments,
    createdById,
    isKiteDataAdminPreLaunch:
      isPreLaunchDriver && sameSalesforceId(createdById, KITE_DATA_ADMIN_USER_ID),
    lastModifiedDate: r.LastModifiedDate,
  };
};

const fetchBarrierDriverRows = (where, fields = BARRIER_DRIVER_FIELDS) =>
  runQuery({
    object: BARRIER_DRIVER_OBJECT,
    fields,
    where,
    sort: ['Name ASC'],
  }).then(
    (rows) => ({ rows, fields }),
    (error) => {
      const field = inaccessibleFieldFromError(error);
      if (field && fields.includes(field) && BARRIER_DRIVER_OPTIONAL_FIELDS.includes(field)) {
        return fetchBarrierDriverRows(where, fields.filter((f) => f !== field));
      }
      throw error;
    }
  );

export const fetchBarriersAndDrivers = (planId) => {
  const planWhere = buildIdMatchWhere('KPH_Account_Plan__c', planId);
  if (!planWhere) return Promise.resolve({ rows: [], access: barrierDriverFieldAccess(BARRIER_DRIVER_FIELDS) });
  const where = `${planWhere} AND (${BARRIER_DRIVER_SOFT_DELETE_FIELD} = false OR ${BARRIER_DRIVER_SOFT_DELETE_FIELD} = null)`;
  return fetchBarrierDriverRows(where).then(({ rows, fields }) => ({
    rows,
    access: barrierDriverFieldAccess(fields),
  }));
};

const buildBarrierDriverWriteFields = (form) => {
  const type = form.type === 'Driver' ? 'Driver' : 'Barrier';
  const isDriver = type === 'Driver';
  const usesStrategy = barrierDriverUsesStrategy(form.indication);
  const title = String(form.name || '').trim() || null;
  const category = form.category || null;
  const categoryField = barrierDriverCategoryFieldFor(type, form.indication);
  const categoryFields = Object.fromEntries(
    Object.values(BARRIER_DRIVER_CATEGORY_FIELDS).map((field) => [
      field,
      field === categoryField ? category : null,
    ])
  );
  // Category routes by record type only: barriers use KPH_Barrier_Type__c,
  // drivers use KPH_Driver_Type__c.
  return {
    RecordTypeId: barrierDriverRecordTypeId(type),
    KPH_Barrier_Title__c: isDriver ? null : title,
    KPH_Driver_Title__c: isDriver ? title : null,
    ...categoryFields,
    KPH_Indication__c: form.indication || null,
    KPH_Status__c: normalizeBarrierDriverStatusForSave(form.status),
    KPH_Rank_1__c: form.businessImpact || null,
    [BARRIER_DRIVER_STRATEGY_FIELD]: usesStrategy ? (form.strategy || null) : null,
    [BARRIER_DRIVER_COMMENTS_FIELD]: form.comments || null,
  };
};

const responseValue = (value) =>
  value && typeof value === 'object' && 'value' in value ? value.value : value;

const createdRecordId = (result) => {
  const candidates = [
    result?.data?.id,
    result?.data?.Id,
    result?.id,
    result?.Id,
    result?.recordId,
  ];
  for (const candidate of candidates) {
    const value = responseValue(candidate);
    if (value) return value;
  }
  return null;
};

const resolvePlanStrategy = (planId, strategy) => {
  const strategyValue = String(strategy || '').trim();
  if (!strategyValue) return Promise.resolve(null);
  return fetchPlanStrategyByValue(planId, strategyValue).then((existing) => {
    if (existing?.id) return existing.id;
    return null;
  });
};

const buildBarrierDriverWriteFieldsWithPlanStrategy = (planId, form) => {
  const fields = buildBarrierDriverWriteFields(form);
  // const strategyValue = barrierDriverUsesStrategy(form.indication)
  //   ? String(form.strategy || '').trim()
  //   : '';
  const strategyValue = String(fields[BARRIER_DRIVER_STRATEGY_FIELD] || '').trim();
  if(form?.isPotentialAtc || !strategyValue) return Promise.resolve(fields);

  // if (!strategyValue) {
  //   return Promise.resolve({
  //     ...fields,
  //     [PLAN_STRATEGY_LOOKUP_FIELD]: null,
  //   });
  // }
  // if (!planId) {
  //   return Promise.resolve(
  //     form.planStrategyId
  //       ? { ...fields, [PLAN_STRATEGY_LOOKUP_FIELD]: form.planStrategyId }
  //       : fields
  //   );
  // }

  // return resolvePlanStrategy(planId, strategyValue).then((planStrategyId) => ({
  //   ...fields,
  //   [PLAN_STRATEGY_LOOKUP_FIELD]: planStrategyId,
  // }));
   return resolvePlanStrategy(planId,strategyValue).then((planStrategyById)=>{
    planStrategyById ? {...fields,[PLAN_STRATEGY_LOOKUP_FIELD]:planStrategyById}:fields
   })
};

const retryBarrierDriverWriteWithoutOptional = (writer, fields, omittedOptionalFields = []) =>
  writer(fields).then((result) => ({
    ...(result && typeof result === 'object' ? result : { result }),
    savedFields: fields,
    omittedOptionalFields,
  })).catch((error) => {
    const field = inaccessibleFieldFromError(error);
    if (
      field &&
      Object.prototype.hasOwnProperty.call(fields, field) &&
      BARRIER_DRIVER_OPTIONAL_FIELDS.includes(field)
    ) {
      const next = { ...fields };
      delete next[field];
      return retryBarrierDriverWriteWithoutOptional(writer, next, [...omittedOptionalFields, field]);
    }
    throw error;
  });

// A critical activity's indication must match its linked barrier/driver
// (the CRM enforces this). When a barrier/driver's indication changes, move
// every linked activity to the same indication. Only the activities that
// don't already match are written, so an unchanged indication is a no-op.
const cascadeIndicationToLinkedActivities = (barrierId, type, indication) => {
  const newIndication = String(indication || '').trim();
  if (!barrierId || !newIndication) return Promise.resolve(null);
  const lookupField = criticalActivityParentLookupFieldFor(type === 'Driver' ? 'Driver' : 'Barrier');
  const parentWhere = buildIdMatchWhere(lookupField, barrierId);
  if (!parentWhere) return Promise.resolve(null);
  const where = `${parentWhere} AND (${ACTIVITY_SOFT_DELETE_FIELD} = false OR ${ACTIVITY_SOFT_DELETE_FIELD} = null)`;
  return runQuery({
    object: CRITICAL_ACTIVITY_OBJECT,
    fields: ['Id', 'KPH_Indication__c'],
    where,
  })
    .then((rows) => {
      const mismatched = (rows || [])
        .map(unwrap)
        .filter(Boolean)
        .filter((r) => String(fieldValue(r.KPH_Indication__c) || '').trim() !== newIndication);
      if (!mismatched.length) return null;
      return Promise.all(
        mismatched.map((r) =>
          updateRecord(CRITICAL_ACTIVITY_OBJECT, r.Id, { KPH_Indication__c: newIndication })
        )
      );
    })
    .catch((error) => {
      // A cascade failure shouldn't fail the barrier/driver save itself; the
      // page reload + future activity edits keep things consistent.
      console.warn('[barriersDrivers] indication cascade to linked activities failed', error);
      return null;
    });
};

export const updateBarrierDriver = (id, form) => {
  if (!id) return Promise.reject(new Error('Missing barrier/driver id.'));
  return buildBarrierDriverWriteFieldsWithPlanStrategy(form.accountPlanId, form).then((fields) =>
    retryBarrierDriverWriteWithoutOptional(
      (writeFields) => updateRecord(BARRIER_DRIVER_OBJECT, id, writeFields),
      fields
    ).then((result) => {
      // Only cascade when the caller signals the indication actually
      // changed (form.previousIndication). Callers that don't opt in keep
      // the prior behaviour and skip the linked-activity query entirely.
      const prev = form.previousIndication;
      const changed =
        prev !== undefined &&
        String(prev || '').trim() !== String(form.indication || '').trim();
      if (!changed) return result;
      return cascadeIndicationToLinkedActivities(id, form.type, form.indication).then(() => result);
    })
  );
};

export const updateBarrierDriverStatus = (id, status) => {
  if (!id) return Promise.reject(new Error('Missing barrier/driver id.'));
  const fields = {
    KPH_Status__c: normalizeBarrierDriverStatusForSave(status),
  };
  return updateRecord(BARRIER_DRIVER_OBJECT, id, fields).then((result) => ({
    ...(result && typeof result === 'object' ? result : { result }),
    savedFields: fields,
  }));
};

export const createBarrierDriver = (planId, form) => {
  if (!planId) return Promise.reject(new Error('Missing account plan id.'));
  return buildBarrierDriverWriteFieldsWithPlanStrategy(planId, form).then((writeFields) => {
    const fields = { KPH_Account_Plan__c: planId, ...writeFields };
    return retryBarrierDriverWriteWithoutOptional(
      (nextFields) => createRecord(BARRIER_DRIVER_OBJECT, nextFields),
      fields
    );
  });
};

// Strategy uses KPH_Strategy__c for DLBCL, Portfolio, and MM indications.
export const aggregateStrategies = (barrierRows, strategyLabels = {}) => {
  const dlbcl = new Set();
  const mm = new Set();
  const portfolio = new Set();
  for (const raw of barrierRows) {
    const r = unwrap(raw);
    if (!r) continue;
    if (!barrierDriverUsesStrategy(r[BARRIER_DRIVER_INDICATION_FIELD])) continue;
    const indication = String(r[BARRIER_DRIVER_INDICATION_FIELD] || '').trim().toUpperCase();
    const strategyValue = fieldValue(r[BARRIER_DRIVER_STRATEGY_FIELD]);
    if (!strategyValue) continue;
    const strategy = picklistLabelForValue(strategyLabels, strategyValue);
    // Only surface strategies from barriers/drivers that are still open.
    if (isClosedBarrierDriverStatus(r.KPH_Status__c)) continue;
    if (indication === 'DLBCL') {
      dlbcl.add(strategy);
    } else if (indication === 'MM') {
      mm.add(strategy);
    } else if (indication === 'PORTFOLIO') {
      portfolio.add(strategy);
    }
  }
  return { dlbcl: Array.from(dlbcl), mm: Array.from(mm), portfolio: Array.from(portfolio) };
};

// =============================================================================
// Critical Activities  ─ KPH_Additional_Critical_Activities__c
// =============================================================================
// Link to plan:           KPH_Account_Plans__c = <planId>
// Link to barrier/driver: Barrier_and_Tactical_Action__c is the shared
// "Barrier Or Driver" lookup for both record types. Parent type is resolved
// from the linked KPH_Barriers_and_Tactical_Actions__c record.
// "Open" status set:      { 'In Progress', 'Planned' }

export const OPEN_ACTIVITY_STATUSES = new Set(['Open', 'In Progress', 'Planned']);
export const CLOSED_ACTIVITY_STATUSES = new Set(['Complete', 'Completed', 'Closed']);
export const CRITICAL_ACTIVITY_OBJECT = 'KPH_Additional_Critical_Activities__c';
export const CRITICAL_ACTIVITY_PARENT_LOOKUP_FIELD = 'Barrier_and_Tactical_Action__c';
export const ACTIVITY_COMMENTS_FIELD = 'KPH_Comments__c';
export const ACTIVITY_DEACTIVATE_FIELD = 'KPH_Inactive__c';
export const ACTIVITY_SOFT_DELETE_FIELD = 'KPH_Is_Deleted__c';
export const CRITICAL_ACTIVITY_TITLE_MAX_LENGTH = 55;

export const ACTIVITY_BASE_FIELDS = [
  'Id',
  'Name',
  'CreatedDate',
  'CreatedById',
  'LastModifiedDate',
  'KPH_Account_Plans__c',
  CRITICAL_ACTIVITY_PARENT_LOOKUP_FIELD,
  'KPH_Activity_Name__c',
  'KPH_Detail__c',
  'KPH_Status__c',
  'KPH_To_Be_Completed_By__c',
  'KPH_Completion_Date__c',
  'KPH_Accountable_POD_Members__c',
  'KPH_Indication__c',
];

export const ACTIVITY_OPTIONAL_FIELDS = [
  ACTIVITY_COMMENTS_FIELD,
  ACTIVITY_DEACTIVATE_FIELD,
  ACTIVITY_SOFT_DELETE_FIELD,
];

export const ACTIVITY_FIELDS = [...ACTIVITY_BASE_FIELDS, ...ACTIVITY_OPTIONAL_FIELDS];

const escapeSoqlString = (value) => String(value).replace(/'/g, "\\'");

const truncateCriticalActivityTitle = (value) =>
  String(value || '').slice(0, CRITICAL_ACTIVITY_TITLE_MAX_LENGTH);

const buildAnyIdMatchWhere = (fieldApi, ids) => {
  const seen = new Set();
  const variants = [];
  for (const id of ids || []) {
    const values = salesforceIdVariants(id);
    for (const value of values.length ? values : [id]) {
      if (!value) continue;
      const trimmed = String(value).trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      variants.push(trimmed);
    }
  }
  if (!variants.length) return null;
  return variants.map((value) => `${fieldApi} = '${escapeSoqlString(value)}'`).join(' OR ');
};

const salesforceIdLookupKeys = (id) => {
  if (!id) return [];
  const rawId = String(id).trim();
  if (!rawId) return [];
  const variants = salesforceIdVariants(rawId);
  return variants.length ? variants : [rawId];
};

export const createSalesforceIdLookup = (records = [], idKey = 'id') => {
  const lookup = new Map();
  for (const record of records || []) {
    const id = record && record[idKey];
    for (const key of salesforceIdLookupKeys(id)) {
      lookup.set(key, record);
    }
  }
  return lookup;
};

export const getSalesforceIdLookupEntry = (lookup, id) => {
  if (!lookup || !id) return null;
  for (const key of salesforceIdLookupKeys(id)) {
    const entry = lookup.get(key);
    if (entry) return entry;
  }
  return null;
};

const lookupUserNamesById = (ids, context = 'userLookup') => {
  const where = buildAnyIdMatchWhere('Id', ids);
  if (!where) return Promise.resolve(new Map());
  return runQuery({
    object: 'User',
    fields: ['Id', 'Name'],
    where,
    sort: ['Name ASC'],
  }).then(
    (rows) => {
      const map = new Map();
      for (const row of rows || []) {
        const r = unwrap(row);
        if (!r || !r.Id || !r.Name) continue;
        map.set(r.Id, r.Name);
        for (const variant of salesforceIdVariants(r.Id)) {
          map.set(variant, r.Name);
        }
      }
      return map;
    },
    (error) => {
      console.warn(`[${context}] unable to resolve user names through User`, error);
      return new Map();
    }
  );
};

const isTruthy = (value) => {
  if (value === true) return true;
  const key = String(value || '').trim().toLowerCase();
  return key === 'true' || key === 'yes' || key === '1';
};

const unwrapLookupCell = (value, depth = 0) => {
  if (value === null || value === undefined || depth > 8) return value;
  if (typeof value !== 'object') return value;
  if ('value' in value) return unwrapLookupCell(value.value, depth + 1);
  if ('display' in value) return unwrapLookupCell(value.display, depth + 1);
  return value;
};

const lookupIdValue = (value) => {
  const cell = unwrapLookupCell(value);
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell !== 'object') {
    const text = String(cell).trim();
    return text || null;
  }
  for (const key of ['Id', 'id', 'ID']) {
    const nested = lookupIdValue(cell[key]);
    if (nested) return nested;
  }
  return null;
};

const stringifyError = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.errorMessage) return error.errorMessage;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const inaccessibleFieldFromError = (error) => {
  const text = stringifyError(error);
  const patterns = [
    /field that cannot be accessed:\s*([A-Za-z0-9_]+)/i,
    /field type that is not supported:\s*(?:[A-Za-z0-9_]+\.)?([A-Za-z0-9_]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const canRetryWithoutField = (fields, field) =>
  field && fields.includes(field) && ACTIVITY_OPTIONAL_FIELDS.includes(field);

const activityFieldAccess = (fields) => ({
  canEditComments: fields.includes(ACTIVITY_COMMENTS_FIELD),
  canDeactivate: fields.includes(ACTIVITY_DEACTIVATE_FIELD),
  canDelete: fields.includes(ACTIVITY_SOFT_DELETE_FIELD),
});

export const toActivity = (row, access = activityFieldAccess(ACTIVITY_FIELDS), userNameById = new Map()) => {
  const r = unwrap(row);
  if (!r) return null;
  const createdById = lookupIdValue(r.CreatedById) || '';
  const parentId = lookupIdValue(r[CRITICAL_ACTIVITY_PARENT_LOOKUP_FIELD]);
  const titleFallback = r.KPH_Activity_Name__c || r.KPH_Detail__c;
  return {
    id: r.Id,
    name: truncateCriticalActivityTitle(titleFallback),
    createdDate: r.CreatedDate || null,
    details: r.KPH_Detail__c || '',
    status: r.KPH_Status__c,
    dueDate: r.KPH_To_Be_Completed_By__c,
    completedDate: r.KPH_Completion_Date__c,
    ownerLabel: r.KPH_Accountable_POD_Members__c,
    indication: r.KPH_Indication__c,
    comments: access.canEditComments ? (r[ACTIVITY_COMMENTS_FIELD] || '') : '',
    isDeactivated: access.canDeactivate ? isTruthy(r[ACTIVITY_DEACTIVATE_FIELD]) : false,
    canEditComments: access.canEditComments,
    canDeactivate: access.canDelete,
    canDelete: access.canDelete,
    createdById,
    isKiteDataAdminCreated: sameSalesforceId(createdById, KITE_DATA_ADMIN_USER_ID),
    createdBy: userNameById.get(createdById) || relationshipName(r, 'CreatedBy') || createdById || '',
    barrierDriverId: parentId,
    parentType: null,
    lastModifiedDate: r.LastModifiedDate,
  };
};

const fetchCriticalActivityRows = (where, fields = ACTIVITY_FIELDS) =>
  runQuery({
    object: CRITICAL_ACTIVITY_OBJECT,
    fields,
    where: `${where} AND ${SOFT_DELETE_ACTIVE_WHERE}`,
    sort: ['LastModifiedDate DESC'],
  }).then(
    (rows) => ({ rows, fields }),
    (error) => {
      const field = inaccessibleFieldFromError(error);
      if (canRetryWithoutField(fields, field)) {
        return fetchCriticalActivityRows(where, fields.filter((f) => f !== field));
      }
      throw error;
    }
  );

export const fetchCriticalActivities = (planId) => {
  const where = buildIdMatchWhere('KPH_Account_Plans__c', planId);
  if (!where) return Promise.resolve([]);
  return fetchCriticalActivityRows(where).then(({ rows, fields }) => {
    const access = activityFieldAccess(fields);
    const createdByIds = rows
      .map((row) => {
        const r = unwrap(row);
        return r && r.CreatedById;
      })
      .filter(Boolean);
    return lookupUserNamesById(createdByIds, 'criticalActivities').then((userNameById) =>
      rows.map((row) => toActivity(row, access, userNameById)).filter(Boolean)
    );
  });
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export const normalizedActivityStatus = (status) =>
  status === 'Completed' ? 'Complete' : status || 'Planned';

const normalizedInactiveCheckboxValue = (value) =>
  value === true || ['true', 'yes', '1'].includes(String(value || '').trim().toLowerCase());

const normalizedCriticalActivityTitle = (form) => String(form?.title || '').trim();

const validateCriticalActivityTitle = (form) => {
  const title = normalizedCriticalActivityTitle(form);
  if (title.length > CRITICAL_ACTIVITY_TITLE_MAX_LENGTH) {
    return Promise.reject(
      new Error(`Critical Activity title must be ${CRITICAL_ACTIVITY_TITLE_MAX_LENGTH} characters or fewer.`)
    );
  }
  return Promise.resolve(title);
};

const validateCriticalActivityDueDate = (form) => {
  const dueDate = String(form?.dueDate || '').trim();
  if (!dueDate) return Promise.reject(new Error('Due Date is required.'));
  return Promise.resolve(dueDate);
};

const recordIdForSoftDelete = (id) => {
  const text = String(id || '').trim();
  if (!text || !isOnline()) return text;
  return toCanonicalSalesforceId(text) || text;
};

const collectNotFoundSignals = (
  value,
  signals = { has404: false, hasNotFoundCode: false, text: [] },
  seen = new Set(),
  depth = 0
) => {
  if (value == null || depth > 16) return signals;
  if (typeof value === 'string') {
    signals.text.push(value.toLowerCase());
    return signals;
  }
  if (typeof value === 'number') {
    if (value === 404) signals.has404 = true;
    return signals;
  }
  if (typeof value !== 'object') return signals;
  if (seen.has(value)) return signals;
  seen.add(value);

  if (String(value.statusCode || '').trim() === '404') signals.has404 = true;
  if (String(value.errorCode || '').trim().toUpperCase() === 'NOT_FOUND') {
    signals.hasNotFoundCode = true;
  }

  Object.values(value).forEach((child) => {
    collectNotFoundSignals(child, signals, seen, depth + 1);
  });
  return signals;
};

const isDesktopSoftDeleteNotFoundError = (error) => {
  if (!isOnline()) return false;
  const signals = collectNotFoundSignals(error);
  const text = signals.text.join(' ');
  const hasResourceNotFoundMessage =
    text.includes('requested resource does not exist') ||
    text.includes('resource not found');
  return (signals.has404 || signals.hasNotFoundCode) && hasResourceNotFoundMessage;
};

const softDeleteRecord = (object, id, fields = {}) => {
  const recordId = recordIdForSoftDelete(id);
  const deleteFields = { KPH_Is_Deleted__c: true, ...fields };
  return Promise.resolve(updateRecord(object, recordId, deleteFields)).catch((error) => {
    if (!isDesktopSoftDeleteNotFoundError(error)) throw error;
    return {
      success: true,
      data: { id: recordId },
      object,
      fields: deleteFields,
      desktopNotFoundAfterDelete: true,
    };
  });
};

const retryWriteWithoutInaccessibleOptionalField = (writer, fields, omittedOptionalFields = []) =>
  writer(fields).then((result) => ({
    ...(result && typeof result === 'object' ? result : { result }),
    savedFields: fields,
    omittedOptionalFields,
  })).catch((error) => {
    const field = inaccessibleFieldFromError(error);
    if (field && Object.prototype.hasOwnProperty.call(fields, field) && ACTIVITY_OPTIONAL_FIELDS.includes(field)) {
      const nextFields = { ...fields };
      delete nextFields[field];
      return retryWriteWithoutInaccessibleOptionalField(writer, nextFields, [...omittedOptionalFields, field]);
    }
    throw error;
  });

const hasExplicitCriticalActivityParent = (form) =>
  !!form && (
    Object.prototype.hasOwnProperty.call(form, 'parentId') ||
    Object.prototype.hasOwnProperty.call(form, 'barrierDriverId') ||
    Object.prototype.hasOwnProperty.call(form, 'primaryBarrierId')
  );

const criticalActivityParentId = (form) =>
  form?.parentId ?? form?.barrierDriverId ?? form?.primaryBarrierId ?? null;

const criticalActivityParentType = (form) =>
  form?.parentType === 'Driver' ? 'Driver' : 'Barrier';

export const criticalActivityParentLookupFieldFor = (parentType) =>
  CRITICAL_ACTIVITY_PARENT_LOOKUP_FIELD;

const criticalActivityParentFields = (form) => {
  if (!hasExplicitCriticalActivityParent(form)) return {};
  const parentId = criticalActivityParentId(form) || null;
  return {
    [CRITICAL_ACTIVITY_PARENT_LOOKUP_FIELD]: parentId,
  };
};

const ensureCriticalActivityParentRecordType = (form) => {
  if (!hasExplicitCriticalActivityParent(form)) return Promise.resolve(null);
  const parentId = criticalActivityParentId(form);
  if (!parentId) return Promise.resolve(null);
  const expectedRecordTypeId = barrierDriverRecordTypeId(criticalActivityParentType(form));
  if (!expectedRecordTypeId || sameSalesforceId(form?.parentRecordTypeId, expectedRecordTypeId)) {
    return Promise.resolve(null);
  }
  return updateRecord(BARRIER_DRIVER_OBJECT, parentId, { RecordTypeId: expectedRecordTypeId });
};

export const updateCriticalActivity = (activityId, form) => {
  if (!activityId) return Promise.reject(new Error('Missing critical activity id.'));
  if (form?.kiteDataAdminLimitedUpdate) {
    const status = normalizedActivityStatus(form.status);
    return updateRecord(CRITICAL_ACTIVITY_OBJECT, activityId, {
      KPH_Detail__c: String(form.details || '').trim(),
      KPH_Status__c: status,
    });
  }
  if (hasExplicitCriticalActivityParent(form) && !criticalActivityParentId(form)) {
    return Promise.reject(new Error('Linked Barrier/Driver is required.'));
  }
  return Promise.all([validateCriticalActivityTitle(form), validateCriticalActivityDueDate(form)]).then(([title, dueDate]) => {
    const status = normalizedActivityStatus(form.status);
    const isComplete = status === 'Complete' || status === 'Closed';
    const fields = {
      KPH_Activity_Name__c: title,
      KPH_Detail__c: String(form.details || '').trim(),
      KPH_Indication__c: form.indication || null,
      KPH_Status__c: status,
      KPH_Accountable_POD_Members__c: form.accountable || null,
      KPH_To_Be_Completed_By__c: dueDate,
      KPH_Completion_Date__c: isComplete ? (form.completedDate || todayIsoDate()) : null,
      ...criticalActivityParentFields(form),
    };
    if (Object.prototype.hasOwnProperty.call(form, 'comments')) {
      fields[ACTIVITY_COMMENTS_FIELD] = form.comments || null;
    }
    if (Object.prototype.hasOwnProperty.call(form, 'deactivate')) {
      fields[ACTIVITY_DEACTIVATE_FIELD] = normalizedInactiveCheckboxValue(form.deactivate);
    }
    return ensureCriticalActivityParentRecordType(form).then(() =>
      retryWriteWithoutInaccessibleOptionalField(
        (writeFields) => updateRecord(CRITICAL_ACTIVITY_OBJECT, activityId, writeFields),
        fields
      )
    );
  });
};

const criticalActivityDeleteFields = (activity = null) => {
  const fields = { [ACTIVITY_SOFT_DELETE_FIELD]: true };
  const parentId = criticalActivityParentId(activity);
  if (!parentId) return fields;

  fields[CRITICAL_ACTIVITY_PARENT_LOOKUP_FIELD] = parentId;
  return fields;
};

export const deleteCriticalActivity = (activityId, activity = null) => {
  if (!activityId) return Promise.reject(new Error('Missing critical activity id.'));
  return softDeleteRecord(CRITICAL_ACTIVITY_OBJECT, activityId, criticalActivityDeleteFields(activity));
};

export const deactivateCriticalActivity = deleteCriticalActivity;

export const fetchCriticalActivitiesForBarrierDriver = (barrierDriverId) => {
  const where = buildIdMatchWhere(CRITICAL_ACTIVITY_PARENT_LOOKUP_FIELD, barrierDriverId);
  if (!where) return Promise.resolve([]);
  return fetchCriticalActivityRows(where).then(({ rows, fields }) => {
    const access = activityFieldAccess(fields);
    return rows.map((row) => toActivity(row, access)).filter(Boolean);
  });
};

export const deleteBarrierDriver = (barrierDriverId) => {
  if (!barrierDriverId) return Promise.reject(new Error('Missing barrier/driver id.'));
  return softDeleteRecord(BARRIER_DRIVER_OBJECT, barrierDriverId, {
    [BARRIER_DRIVER_SOFT_DELETE_FIELD]: true,
  });
};

export const deleteBarrierDriverWithDependencies = async (
  barrierDriverId
) => {
  if (!barrierDriverId) throw new Error('Missing barrier/driver id.');
  const activities = await fetchCriticalActivitiesForBarrierDriver(barrierDriverId);

  if (activities.length) {
    const error = new Error(
      'Resolve the associated critical activities before deleting this Barrier/Driver.'
    );
    error.activities = activities;
    throw error;
  }

  await deleteBarrierDriver(barrierDriverId);
  return {
    deletedBarrierDriverId: barrierDriverId,
    dependencyAction: 'none',
    activityIds: [],
  };
};

export const createCriticalActivity = (planId, form) => {
  if (!planId) return Promise.reject(new Error('Missing account plan id.'));
  if (!criticalActivityParentId(form)) {
    return Promise.reject(new Error('Linked Barrier/Driver is required.'));
  }
  if (!String(form?.indication || '').trim()) {
    return Promise.reject(new Error('Indication is required.'));
  }
  return Promise.all([validateCriticalActivityTitle(form), validateCriticalActivityDueDate(form)]).then(([title, dueDate]) => {
    const status = normalizedActivityStatus(form.status);
    const isComplete = status === 'Complete' || status === 'Closed';
    const fields = {
      KPH_Account_Plans__c: planId,
      KPH_Activity_Name__c: title,
      KPH_Detail__c: String(form.details || '').trim(),
      KPH_Indication__c: form.indication,
      KPH_Status__c: status,
      KPH_Accountable_POD_Members__c: form.accountable || null,
      KPH_To_Be_Completed_By__c: dueDate,
      KPH_Completion_Date__c: isComplete ? todayIsoDate() : null,
      [ACTIVITY_DEACTIVATE_FIELD]: false,
      [ACTIVITY_SOFT_DELETE_FIELD]: false,
      ...criticalActivityParentFields(form),
    };
    if (Object.prototype.hasOwnProperty.call(form, 'comments')) {
      fields[ACTIVITY_COMMENTS_FIELD] = form.comments || null;
    }
    return ensureCriticalActivityParentRecordType(form).then(() =>
      retryWriteWithoutInaccessibleOptionalField(
        (writeFields) => createRecord(CRITICAL_ACTIVITY_OBJECT, writeFields),
        fields
      )
    );
  });
};

// Activities counted per barrier/driver = those whose status is open
// (`In Progress` or `Planned`) and that link back through either parent lookup.
export const buildOpenActivityCountByBarrier = (activities) => {
  const counts = {};
  for (const a of activities) {
    if (!a.barrierDriverId) continue;
    if (a.isDeactivated === true) continue;
    if (!OPEN_ACTIVITY_STATUSES.has(a.status)) continue;
    for (const key of salesforceIdLookupKeys(a.barrierDriverId)) {
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
};

// All-time completed activities counted per barrier/driver. This intentionally
// has no 90-day cutoff: the card pill answers whether a record has ever had a
// closed critical activity. Soft-deleted rows are already excluded by the
// activity query, and inactive rows follow the existing open-count convention.
export const buildClosedActivityCountByBarrier = (activities) => {
  const counts = {};
  for (const activity of activities) {
    if (!activity.barrierDriverId) continue;
    if (activity.isDeactivated === true || activity.isDeleted === true) continue;
    if (!CLOSED_ACTIVITY_STATUSES.has(activity.status)) continue;
    for (const key of salesforceIdLookupKeys(activity.barrierDriverId)) {
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
};

// =============================================================================
// POD Users (Home panel)  ─ Account_Team_Member_vod__c
// =============================================================================
// Link:          KPH_Ecosystem_Plan__c = <ecosystemPlanId>
// Sort:          Core, Lead, Extended, then everything else alphabetically.
// Primary label: KPH_Role__c (fallback to KPH_Participation__c).

export const POD_USER_FIELDS = [
  'Id',
  'Team_Member_vod__c',
  'Team_Member_Name_vod__c',
  'KPH_Ecosystem_Plan__c',
  'KPH_Role__c',
  'KPH_Participation__c',
  'KPH_Is_Deleted__c',
];

const SOFT_DELETE_ACTIVE_WHERE = '(KPH_Is_Deleted__c = false OR KPH_Is_Deleted__c = null)';

const PARTICIPATION_SORT_ORDER = ['core', 'lead', 'extended'];

export const participationSortRank = (participation) => {
  const key = String(participation || '').trim().toLowerCase();
  const index = PARTICIPATION_SORT_ORDER.indexOf(key);
  return index === -1 ? PARTICIPATION_SORT_ORDER.length : index;
};

export const sortTeamMembersByParticipation = (members = []) =>
  (members || [])
    .map((member, index) => ({ member, index }))
    .sort((left, right) => {
      const rankDelta =
        participationSortRank(left.member?.participation) -
        participationSortRank(right.member?.participation);
      if (rankDelta) return rankDelta;
      const nameDelta = (left.member?.name || '').localeCompare(right.member?.name || '', undefined, {
        sensitivity: 'base',
      });
      return nameDelta || left.index - right.index;
    })
    .map(({ member }) => member);

export const toPodUser = (row) => {
  const r = unwrap(row);
  if (!r) return null;
  const role = r.KPH_Role__c || null;
  const participation = r.KPH_Participation__c || null;
  return {
    id: r.Id,
    userId: r.Team_Member_vod__c || null,
    name: r.Team_Member_Name_vod__c || null,
    role,
    participation,
    label: role || participation || null,
  };
};

export const fetchPodUsers = (ecosystemPlanId) => {
  const planWhere = buildIdMatchWhere('KPH_Ecosystem_Plan__c', ecosystemPlanId);
  if (!planWhere) return Promise.resolve([]);
  return runQuery({
    object: 'Account_Team_Member_vod__c',
    fields: POD_USER_FIELDS,
    where: `${planWhere} AND ${SOFT_DELETE_ACTIVE_WHERE}`,
  }).then((rows) => {
    const users = rows.map(toPodUser).filter((u) => u && u.name);
    return sortTeamMembersByParticipation(users);
  });
};

// =============================================================================
// Team Members (full page)  ─ Account_Team_Member_vod__c, linked by Account_Plan
// =============================================================================
// Same object as POD Users, but linked via Account_Plan_vod__c (NOT the
// ecosystem plan). Used by the Team Members detail page.

export const TEAM_MEMBER_OBJECT = 'Account_Team_Member_vod__c';

export const TEAM_MEMBER_BY_PLAN_FIELDS = [
  'Id',
  'Name',
  'Account_Plan_vod__c',
  'Account_Team_Member_Active__c',
  'KPH_Participation__c',
  'KPH_Role__c',
  'Role_vod__c',
  'Team_Member_Name_vod__c',
  'Team_Member_vod__c',
  'KPH_Is_Deleted__c',
];

export const toTeamMember = (row) => {
  const r = unwrap(row);
  if (!r) return null;
  return {
    id: r.Id,
    userId: r.Team_Member_vod__c || null,
    name: r.Team_Member_Name_vod__c || r.Name,
    role: r.KPH_Role__c || r.Role_vod__c || null,
    functionName: r.KPH_Role__c || r.Role_vod__c || null,
    participation: r.KPH_Participation__c || null,
    isPrimary: toBooleanFlag(r.Account_Team_Member_Active__c),
  };
};

export const fetchTeamMembersByPlan = (planId) => {
  const planWhere = buildIdMatchWhere('Account_Plan_vod__c', planId);
  if (!planWhere) return Promise.resolve([]);
  return runQuery({
    object: TEAM_MEMBER_OBJECT,
    fields: TEAM_MEMBER_BY_PLAN_FIELDS,
    where: `${planWhere} AND ${SOFT_DELETE_ACTIVE_WHERE}`,
    sort: ['Name ASC'],
  }).then((rows) => sortTeamMembersByParticipation(rows.map(toTeamMember).filter(Boolean)));
};

// =============================================================================
// Stakeholders  ─ KPH_Stakeholder_Map__c
// =============================================================================

const cleanedTextOrNull = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const normalizedActiveStatus = (value, fallback = true) => {
  if (value === true || value === false) return value;
  const key = String(value || '').trim().toLowerCase();
  if (key === 'active' || key === 'true' || key === 'yes') return true;
  if (key === 'inactive' || key === 'false' || key === 'no') return false;
  return fallback;
};

const teamMemberDisplayFields = (form) => ({
  KPH_Role__c: cleanedTextOrNull(form.role),
  Account_Team_Member_Active__c: normalizedActiveStatus(form.status, true),
});

const buildTeamMemberWriteFields = (form) => ({
  Team_Member_vod__c: cleanedTextOrNull(form.userId),
  Team_Member_Name_vod__c: cleanedTextOrNull(form.name),
  KPH_Participation__c: cleanedTextOrNull(form.participation),
});

export const updateTeamMember = (id, form) => {
  if (!id) return Promise.reject(new Error('Missing team member id.'));
  const fields = buildTeamMemberWriteFields(form || {});
  if (!fields.Team_Member_vod__c) {
    return Promise.reject(new Error('Team member user is required.'));
  }
  return updateRecord(TEAM_MEMBER_OBJECT, id, fields).then(() =>
    toTeamMember({ Id: id, ...teamMemberDisplayFields(form || {}), ...fields })
  );
};

export const deleteTeamMember = (id) => {
  if (!id) return Promise.reject(new Error('Missing team member id.'));
  return softDeleteRecord(TEAM_MEMBER_OBJECT, id);
};

export const createTeamMember = (planId, form) => {
  if (!planId) return Promise.reject(new Error('Missing account plan id.'));
  const fields = {
    Account_Plan_vod__c: planId,
    ...buildTeamMemberWriteFields(form || {}),
  };
  if (!fields.Team_Member_vod__c) {
    return Promise.reject(new Error('Team member user is required.'));
  }
  return createRecord(TEAM_MEMBER_OBJECT, fields).then((result) => {
    const id = createdRecordId(result);
    if (!id) throw new Error('Unable to create team member record.');
    return toTeamMember({ Id: id, ...teamMemberDisplayFields(form || {}), ...fields });
  });
};

export const STAKEHOLDER_OBJECT = 'KPH_Stakeholder_Map__c';

export const STAKEHOLDER_FIELDS = [
  'Id',
  'Name',
  'KPH_Account__c',
  'KPH_First_Name__c',
  'KPH_Last_Name__c',
  'KPH_Title__c',
  'KPH_Other_Title__c',
  'Stakeholder_Account_Class__c',
  'KPH_Name_Of_Site2__c',
  'Stakeholder_EID__c',
  'Stakeholder_NPI__c',
  'KPH_Priority__c',
  'MM_Priority__c',
  'KPH_Current_Target__c',
  'KPH_HCP_Classification__c',
  'KPH_MM_Target__c',
  'KPH_MM_HCP_Classification__c',
  'KPH_DLBCL_Clinical_Influence__c',
  'KPH_DLBCL_Financial_Influence__c',
  'KPH_DLBCL_Operational_Influence__c',
  // Temporarily disabled: Stakeholder Champion fields are not queried while
  // their DLBCL/MM edit-modal controls are hidden.
  'KPH_DLBCL_Administrative_Champion__c',
  'KPH_DLBCL_Clinical_Champion__c',
  'KPH_MM_Clinical_Influence__c',
  'KPH_MM_Financial_Influence__c',
  'KPH_MM_Operational_Influence__c',
  'KPH_MM_Administrative_Champion__c',
  'KPH_MM_Clinical_Champion__c',
  'KPH_Estimated_Annual_RRMM_Treatment_Vol__c',
  'Physician_Identified_Highest_Unmet_Needs__c',
  'KPH_DLBCL_Barriers__c',
  'KPH_DLBCL_Drivers__c',
  'KPH_MM_Barriers__c',
  'KPH_MM_Drivers__c',
];

const STAKEHOLDER_ACTIVE_WHERE = '(KPH_Is_Deleted__c = false OR KPH_Is_Deleted__c = null)';
const STAKEHOLDER_PERSON_ACCOUNT_WHERE = 'IsPersonAccount = true';

export const toStakeholder = (row, accountNameById = null) => {
  const r = unwrap(row);
  if (!r) return null;
  const accountId = r.KPH_Account__c || null;
  const fullName = [r.KPH_First_Name__c, r.KPH_Last_Name__c]
    .filter(Boolean)
    .join(' ')
    .trim();
  const lookupName = accountNameFromLookup(accountNameById, accountId);
  return {
    id: r.Id,
    name: lookupName || fullName || r.Name || accountId,
    stakeholderId: r.Stakeholder_EID__c || r.Stakeholder_NPI__c || null,
    profileRecordId: accountId,
    role: r.KPH_Title__c || r.KPH_Other_Title__c || r.Stakeholder_Account_Class__c || null,
    otherRole: r.KPH_Other_Title__c || null,
    primaryParent: r.KPH_Name_Of_Site2__c || null,
    primaryParentId: null,
    dlbclPriority: r.KPH_Priority__c || null,
    mmPriority: r.MM_Priority__c || null,
    dlbclCurrentTarget: r.KPH_Current_Target__c || null,
    dlbclHcpClassification: r.KPH_HCP_Classification__c || null,
    mmCurrentTarget: r.KPH_MM_Target__c || null,
    mmHcpClassification: r.KPH_MM_HCP_Classification__c || null,
    dlbclClinicalInfluence: r.KPH_DLBCL_Clinical_Influence__c || null,
    dlbclFinancialInfluence: r.KPH_DLBCL_Financial_Influence__c || null,
    dlbclOperationalInfluence: r.KPH_DLBCL_Operational_Influence__c || null,
    // Temporarily disabled with the Stakeholder Champion CRM query fields.
    dlbclAdministrativeChampion: normalizeCrmBoolean(r.KPH_DLBCL_Administrative_Champion__c),
    dlbclClinicalChampion: normalizeCrmBoolean(r.KPH_DLBCL_Clinical_Champion__c),
    mmClinicalInfluence: r.KPH_MM_Clinical_Influence__c || null,
    mmFinancialInfluence: r.KPH_MM_Financial_Influence__c || null,
    mmOperationalInfluence: r.KPH_MM_Operational_Influence__c || null,
    mmAdministrativeChampion: normalizeCrmBoolean(r.KPH_MM_Administrative_Champion__c),
    mmClinicalChampion: normalizeCrmBoolean(r.KPH_MM_Clinical_Champion__c),
    estimatedAnnualRrmmTreatmentVolume:
      r.KPH_Estimated_Annual_RRMM_Treatment_Vol__c || null,
    physicianIdentifiedHighestUnmetNeedsRrmm: String(
      r.Physician_Identified_Highest_Unmet_Needs__c || ''
    )
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean),
    nonMmDrivers: r.KPH_DLBCL_Drivers__c || null,
    nonMmBarriers: r.KPH_DLBCL_Barriers__c || null,
    mmDrivers: r.KPH_MM_Drivers__c || null,
    mmBarriers: r.KPH_MM_Barriers__c || null,
  };
};

export const fetchStakeholders = (planId) => {
  const planWhere = buildIdMatchWhere('KPH_Account_Plan__c', planId);
  if (!planWhere) return Promise.resolve([]);
  const where = `${planWhere} AND ${STAKEHOLDER_ACTIVE_WHERE}`;
  return runQuery({
    object: STAKEHOLDER_OBJECT,
    fields: STAKEHOLDER_FIELDS,
    where,
    sort: ['Name ASC'],
  }).then((rows) => {
    const unwrappedRows = (rows || []).map(unwrap).filter(Boolean);
    const accountIds = unwrappedRows.map((row) => row.KPH_Account__c).filter(Boolean);
    return fetchPersonAccountNameLookup(accountIds, 'stakeholderAccounts').then((accountNameById) =>
      unwrappedRows
        .filter((row) => accountNameFromLookup(accountNameById, row.KPH_Account__c))
        .map((row) => toStakeholder(row, accountNameById))
        .filter(Boolean)
    );
  });
};

// =============================================================================
// Cross-Functional Plan of Action  ─ Account_Plan_vod__c
// =============================================================================
// The POA page currently displays DLBCL-only long-text fields living directly
// on Account_Plan_vod__c. MM POA blocks are hidden in the UI, so their fields
// stay out of the active query to avoid field-access failures for hidden data.

const splitStakeholderName = (name) => {
  const text = String(name || '').trim().replace(/\s+/g, ' ');
  if (!text) return { firstName: null, lastName: null };
  const parts = text.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
};

const stakeholderDisplayFields = (form) => {
  const { firstName, lastName } = splitStakeholderName(form.name);
  return {
    Name: cleanedTextOrNull(form.name),
    KPH_First_Name__c: firstName,
    KPH_Last_Name__c: lastName,
    Stakeholder_EID__c: cleanedTextOrNull(form.stakeholderId),
    KPH_Name_Of_Site2__c: cleanedTextOrNull(form.primaryParent),
    KPH_Priority__c: cleanedTextOrNull(form.dlbclPriority),
    KPH_Current_Target__c: cleanedTextOrNull(form.dlbclCurrentTarget),
    KPH_HCP_Classification__c: cleanedTextOrNull(form.dlbclHcpClassification),
    MM_Priority__c: cleanedTextOrNull(form.mmPriority),
    KPH_MM_Target__c: cleanedTextOrNull(form.mmCurrentTarget),
    KPH_MM_HCP_Classification__c: cleanedTextOrNull(form.mmHcpClassification),
  };
};

const buildStakeholderWriteFields = (form) => {
  const fields = {
    KPH_Title__c: cleanedTextOrNull(form.role),
    KPH_Other_Title__c: cleanedTextOrNull(form.otherRole),
    KPH_DLBCL_Clinical_Influence__c: cleanedTextOrNull(form.dlbclClinicalInfluence),
    KPH_DLBCL_Financial_Influence__c: cleanedTextOrNull(form.dlbclFinancialInfluence),
    KPH_DLBCL_Operational_Influence__c: cleanedTextOrNull(form.dlbclOperationalInfluence),
    // Temporarily disabled: do not write hidden Stakeholder Champion fields.
    KPH_DLBCL_Administrative_Champion__c: normalizeCrmBoolean(form.dlbclAdministrativeChampion) === true,
    KPH_DLBCL_Clinical_Champion__c: normalizeCrmBoolean(form.dlbclClinicalChampion) === true,
    KPH_DLBCL_Drivers__c: cleanedTextOrNull(form.nonMmDrivers),
    KPH_DLBCL_Barriers__c: cleanedTextOrNull(form.nonMmBarriers),
    KPH_MM_Clinical_Influence__c: cleanedTextOrNull(form.mmClinicalInfluence),
    KPH_MM_Financial_Influence__c: cleanedTextOrNull(form.mmFinancialInfluence),
    KPH_MM_Operational_Influence__c: cleanedTextOrNull(form.mmOperationalInfluence),
    KPH_MM_Administrative_Champion__c: normalizeCrmBoolean(form.mmAdministrativeChampion) === true,
    KPH_MM_Clinical_Champion__c: normalizeCrmBoolean(form.mmClinicalChampion) === true,
    KPH_Estimated_Annual_RRMM_Treatment_Vol__c:
      cleanedTextOrNull(form.estimatedAnnualRrmmTreatmentVolume),
    Physician_Identified_Highest_Unmet_Needs__c: cleanedTextOrNull(
      Array.isArray(form.physicianIdentifiedHighestUnmetNeedsRrmm)
        ? form.physicianIdentifiedHighestUnmetNeedsRrmm
            .map((value) => String(value || '').trim())
            .filter(Boolean)
            .join(';')
        : form.physicianIdentifiedHighestUnmetNeedsRrmm
    ),
    KPH_MM_Drivers__c: cleanedTextOrNull(form.mmDrivers),
    KPH_MM_Barriers__c: cleanedTextOrNull(form.mmBarriers),
  };
  if (form.profileRecordId) fields.KPH_Account__c = form.profileRecordId;

  return fields;
};

export const updateStakeholder = (id, form) => {
  if (!id) return Promise.reject(new Error('Missing stakeholder id.'));
  const fields = buildStakeholderWriteFields(form || {});
  if (!cleanedTextOrNull(form?.name) && !fields.KPH_Account__c) {
    return Promise.reject(new Error('Stakeholder name is required.'));
  }
  return updateRecord(STAKEHOLDER_OBJECT, id, fields).then(() =>
    toStakeholder({ Id: id, ...stakeholderDisplayFields(form || {}), ...fields })
  );
};

export const deleteStakeholder = (id) => {
  if (!id) return Promise.reject(new Error('Missing stakeholder id.'));
  return softDeleteRecord(STAKEHOLDER_OBJECT, id);
};

export const createStakeholder = (planId, form) => {
  if (!planId) return Promise.reject(new Error('Missing account plan id.'));
  const fields = {
    KPH_Account_Plan__c: planId,
    ...buildStakeholderWriteFields(form || {}),
  };
  if (!fields.KPH_Account__c) {
    return Promise.reject(new Error('Stakeholder name is required.'));
  }
  return createRecord(STAKEHOLDER_OBJECT, fields).then((result) => {
    const id = createdRecordId(result);
    if (!id) throw new Error('Unable to create stakeholder record.');
    return toStakeholder({ Id: id, ...stakeholderDisplayFields(form || {}), ...fields });
  });
};

export const POA_FIELDS = [
  'Id',
  'LastModifiedDate',
  'KPH_Customer_Engagement_DLBCL_POA__c',
  'KPH_Market_Access_DLBCL_POA__c',
  'KPH_Medical_Affairs_DLBCL_POA__c',
];

export const POA_CONTEXT_FIELDS = Array.from(new Set([...PLAN_FIELDS, ...POA_FIELDS]));

// Active blocks in display order. `key` matches the legacy controller's
// poaBlocks definition so any future cross-checking against AngularJS code
// stays simple.
export const POA_BLOCK_DEFS = [
  { key: 'dlbcl-customer-engagement', indication: 'DLBCL', functionName: 'Customer Engagement', heading: 'DLBCL Customer Engagement Plan of Action', tone: 'commercial',    field: 'KPH_Customer_Engagement_DLBCL_POA__c' },
  { key: 'dlbcl-market-access',       indication: 'DLBCL', functionName: 'Market Access',       heading: 'DLBCL Market Access Plan of Action',       tone: 'market-access', field: 'KPH_Market_Access_DLBCL_POA__c' },
  // Retain the CRM mapping for future use, but keep this block out of the Cross Functional UI.
  { key: 'dlbcl-medical-affairs',     indication: 'DLBCL', functionName: 'Medical Affairs',     heading: 'DLBCL Medical Plan of Action',             tone: 'medical',       field: 'KPH_Medical_Affairs_DLBCL_POA__c', hidden: true },
];

export const toPoaBlocks = (row) => {
  const r = unwrap(row);
  if (!r) return { lastModifiedDate: null, blocks: [] };
  const blocks = POA_BLOCK_DEFS
    .filter((def) => !def.hidden)
    .map((def) => ({
      key: def.key,
      indication: def.indication,
      functionName: def.functionName,
      heading: def.heading,
      tone: def.tone,
      field: def.field,
      content: r[def.field] || null,
    }));
  return { lastModifiedDate: r.LastModifiedDate || null, blocks };
};

export const fetchPoaBlocks = (planId) => {
  const where = buildIdMatchWhere('Id', planId);
  if (!where) return Promise.resolve({ lastModifiedDate: null, blocks: [] });
  return runQuery({
    object: 'Account_Plan_vod__c',
    fields: POA_FIELDS,
    where,
    limit: 1,
  }).then((rows) => {
    return toPoaBlocks(rows[0]);
  });
};

export const updatePoaField = (planId, field, value) => {
  if (!planId || !field) return Promise.reject(new Error('Missing POA field update target.'));
  return updateRecord('Account_Plan_vod__c', planId, { [field]: value || '' });
};

// =============================================================================
// Account Profile (full)  ─ KPH_Ecosystem_Plan__c
// =============================================================================
// `fetchHeaderFields` (above) reads the short Home strip field set. This
// section adds the full profile: ATC cohort/segment/volume trend, payer mix,
// target-list flags, the DLBCL questions, and DLBCL/MM regional dynamics —
// the data the Account Profile page (Profile + Referral & Dynamics tabs) needs.

export const ACCOUNT_PROFILE_OBJECT = 'KPH_Ecosystem_Plan__c';
export const REGIONAL_DYNAMICS_DLBCL_FIELD = 'KPH_Region_Dynamics_to_be_Aware_of_DLBCL__c';
export const REGIONAL_DYNAMICS_MM_FIELD = 'KPH_Region_Dynamics_to_be_Aware_of_MM__c';
export const MM_PROFILE_FIELD_API_NAMES = {
  factAccredited: 'KPH_FACT_Accredited__c',
  '340bAccount': 'KPH_340B_Account__c',
  anitoCelTrialSite: 'KPH_Anito_Cel_Trial_Site__c',
  projectedAnitoCelDemand: 'KPH_Projected_Anito_cel_Demand__c',
  secondLinePatientEstimate: 'KPH_2L_Patient_Estimate__c',
  currentCartUtilizationVolume: 'KPH_Current_CAR_T_Utilization_Volume__c',
  currentBispecificUtilization: 'KPH_Current_Bispecific_Utilization__c',
  fourthLinePatientEstimate: 'KPH_4L_Patient_Estimate__c',
  bispecificUse: 'KPH_Bispecific_Use__c',
  commercialTrialCartMix: 'KPH_Commercial_vs_Trial_CAR_T_Mix__c',
  secondLineTreatmentPreference: 'KPH_2L_Treatment_Preference__c',
  fourthLineTreatmentPreference: 'KPH_4L_Treatment_Preference__c',
  perceptionOfAnitoCel: 'KPH_Perception_of_Anito_cel__c',
  cartProgramStructure: 'KPH_CAR_T_Program_Structure__c',
  outpatientCartCapability: 'KPH_Outpatient_CAR_T_Capability__c',
  receptivityToAnitoCelOp: 'KPH_Receptivity_to_Anito_cel_OP__c',
  operationalCapacityAssessment: 'KPH_Operational_Capacity_Assessment__c',
  payerMix: 'KPH_Payer_Mix__c',
  preFormularyExceptionPathway: 'KPH_Pre_Formulary_Exception_Pathway__c',
  ptCommittee: 'KPH_P_T_Committee__c',
  ptLead: 'KPH_P_T_Lead__c',
  ptTimingNextReview: 'KPH_P_T_Timing_Next_Review__c',
  ptStatus: 'KPH_P_T_Status__c',
  formularyStatus: 'KPH_Formulary_Status__c',
  accessBarriers: 'KPH_Access_Barriers__c',
  catchmentArea: 'KPH_Catchment_Area_sites_miles__c',
  topReferringSites: 'KPH_Top_Referring_Sites__c',
  internalExternalMix: 'KPH_Internal_External_Mix__c',
  cartTreatersAtAtc: 'KPH_CAR_T_Treaters_at_ATC__c',
  mmAnitoCelClinicalChampion: 'KPH_MM_Anito_cel_Clinical_Champion__c',
  adminChampionRole: 'KPH_Admin_Champion_Role__c',
  mmOpinionLeaders: 'KPH_MM_Opinion_Leaders__c',
};

// Keep this list limited to values rendered or edited by Account Profile.
// Filter and sort fields remain in the query clauses without being selected.
export const ACCOUNT_PROFILE_FIELDS = [
  'Id',
  'KPH_ATC_Cohort__c',
  'KPH_ATC_Share_of_Business_R6M_1Q_Lag__c',
  'KPH_Volume_Trend__c',
  'KPH_KLT_Sprint_Account__c',
  'KPH_aALL_Target__c',
  'KPH_Payer_Type__c',
  'KPH_Top_3_Payers_Name__c',
  'KPH_Is_capacity_having_an_impact_on_CART__c',
  'KPH_What_of_CART_business_is_done_OP__c',
  'KPH_Financial_and_or_reimbursement__c',
  'KPH_Does_ATC_prefer_CART_administration__c',
  'KPH_If_Yes_to_above_reasons__c',
  'KPH_Bispecifics_for_DLBCL_being_used__c',
  'KPH_Bispecific_use_in_DLBCL_impact_CART__c',
  'KPH_If_ATC_is_using_OP_do_they__c',
  'KPH_Is_there_direct_competition_from__c',
  'KPH_If_yes_in_what_indication__c',
  ...Object.values(MM_PROFILE_FIELD_API_NAMES),
  REGIONAL_DYNAMICS_DLBCL_FIELD,
  REGIONAL_DYNAMICS_MM_FIELD,
];

const firstFilledWithField = (record, fields) => {
  for (const field of fields) {
    const value = record[field];
    if (value !== null && value !== undefined && value !== '') {
      return { value, field };
    }
  }
  return { value: null, field: null };
};

// Pull the display name out of a relationship object the runtime might give
// us as either `Account_vod__r.Name` (a dotted string key) or `Account_vod__r`
// (a nested object with a `Name` property). Offline mode strips relationship
// fields entirely → the caller falls back to the ID.
const fieldValue = (value) =>
  value && typeof value === 'object' && 'value' in value ? value.value : value;

const relationshipName = (record, relationshipApi) => {
  const dotted = fieldValue(record[`${relationshipApi}.Name`]);
  if (dotted) return dotted;
  const nested = record[relationshipApi];
  const nestedName = nested && typeof nested === 'object' ? fieldValue(nested.Name) : null;
  if (nestedName) return nestedName;
  return null;
};

export const toAccountProfile = (row) => {
  const r = unwrap(row);
  if (!r) return null;
  const mmProfile = Object.fromEntries(
    Object.entries(MM_PROFILE_FIELD_API_NAMES).map(([key, field]) => [key, r[field]])
  );
  const dlbclDynamics = firstFilledWithField(r, [
    REGIONAL_DYNAMICS_DLBCL_FIELD,
  ]);
  const mmDynamics = firstFilledWithField(r, [
    REGIONAL_DYNAMICS_MM_FIELD,
  ]);
  return {
    id: r.Id,
    atcCohort: r.KPH_ATC_Cohort__c,
    atcSegment: r.KPH_ATC_Share_of_Business_R6M_1Q_Lag__c || null,
    cartVolumeTrend: r.KPH_Volume_Trend__c,
    kltSprintAccount: normalizeCrmBoolean(r.KPH_KLT_Sprint_Account__c),
    referralVolume: null,
    secondLinePlusVolume: null,
    aallTarget: r.KPH_aALL_Target__c,
    payerMix: r.KPH_Payer_Mix__c,
    payerType: r.KPH_Payer_Type__c,
    topPayersName: r.KPH_Top_3_Payers_Name__c,
    dlbclCapacityImpact: r.KPH_Is_capacity_having_an_impact_on_CART__c,
    dlbclOpBusinessPct: r.KPH_What_of_CART_business_is_done_OP__c,
    dlbclFinancialConstraint: r.KPH_Financial_and_or_reimbursement__c,
    dlbclPreferOpSetting: r.KPH_Does_ATC_prefer_CART_administration__c,
    dlbclOpSettingReasons: r.KPH_If_Yes_to_above_reasons__c,
    dlbclBispecificTiming: r.KPH_Bispecifics_for_DLBCL_being_used__c,
    dlbclOpUseDetails: r.KPH_If_ATC_is_using_OP_do_they__c,
    dlbclBispecificImpact: r.KPH_Bispecific_use_in_DLBCL_impact_CART__c,
    dlbclBreyanziCompetition: r.KPH_Is_there_direct_competition_from__c,
    dlbclBreyanziIndication: r.KPH_If_yes_in_what_indication__c,
    regionDynamicsDlbcl: dlbclDynamics.value,
    regionDynamicsDlbclField: dlbclDynamics.field || REGIONAL_DYNAMICS_DLBCL_FIELD,
    regionDynamicsMm: mmDynamics.value,
    regionDynamicsMmField: mmDynamics.field || REGIONAL_DYNAMICS_MM_FIELD,
    mmProfile,
  };
};

export const fetchAccountProfile = (planId) => {
  const where = buildIdMatchWhere('KPH_Account_Plan__c', planId);
  if (!where) return Promise.resolve(null);
  return runQuery({
    object: ACCOUNT_PROFILE_OBJECT,
    fields: ACCOUNT_PROFILE_FIELDS,
    where,
    sort: ['LastModifiedDate DESC'],
    limit: 1,
  }).then((rows) => toAccountProfile(rows[0]));
};

// Per-field updates so the inline DLBCL question editor and the regional
// dynamics modal can each save just the field they edited.
export const updateAccountProfileField = (profileId, field, value) => {
  if (!profileId || !field) {
    return Promise.reject(new Error('Missing account profile update target.'));
  }
  const writeValue =
    field === MM_PROFILE_FIELD_API_NAMES.projectedAnitoCelDemand && value !== '' && value !== null && value !== undefined
      ? Number(value)
      : value;
  return updateRecord(ACCOUNT_PROFILE_OBJECT, profileId, { [field]: writeValue === '' ? null : writeValue });
};

// =============================================================================
// Referral Accounts  ─ KPH_Ecosystem_Map_Dynamics__c
// =============================================================================
// Plan-scoped child of Account_Plan_vod__c. Each row represents one referral
// site mapped to this account plan — name, classification, # HCP targets,
// referral-priority flag, indication, and comments. Site names use the
// free-text field exposed in this org; the unavailable Account lookup field is
// deliberately omitted so one inaccessible column cannot fail the whole page.

export const REFERRAL_ACCOUNT_OBJECT = 'KPH_Ecosystem_Map_Dynamics__c';
export const REFERRAL_ACCOUNT_PROFILE_FIELD = 'KPH_Account_Profile__c';

export const REFERRAL_ACCOUNT_FIELDS = [
  'Id',
  'Name',
  'Indication__c',
  'KPH_HCO_Classification__c',
  'KPH_of_HCP_Targets_within_a_Site__c',
  'KPH_Referral_Count__c',
  'KPH_Referral_Priority__c',
  'KPH_X2L_DLBCL_Treated_Patients__c',
  'KPH_Comments__c',
  'Name_of_Site__c',
];

const addAccountNameLookup = (lookup, id, name) => {
  if (!lookup || !id || !name) return;
  const rawId = String(id);
  lookup.set(rawId, name);
  const canonicalId = toCanonicalSalesforceId(rawId);
  if (canonicalId) {
    lookup.set(canonicalId, name);
    lookup.set(canonicalId.slice(0, 15), name);
  }
};

const accountNameFromLookup = (lookup, id) => {
  if (!lookup || !id) return null;
  const rawId = String(id);
  const canonicalId = toCanonicalSalesforceId(rawId);
  return (
    lookup.get(rawId) ||
    (canonicalId && (lookup.get(canonicalId) || lookup.get(canonicalId.slice(0, 15)))) ||
    null
  );
};

const unwrapRows = (rows) => (rows || []).map(unwrap).filter(Boolean);

const fetchAccountNameLookup = (accountIds, context = 'accountNameLookup') => {
  const ids = Array.from(new Set((accountIds || []).filter(Boolean)));
  const where = buildAnyIdMatchWhere('Id', ids);
  if (!where) return Promise.resolve(new Map());

  return runQuery({
    object: 'Account',
    fields: ['Id', 'Name'],
    where,
    sort: ['Name ASC'],
  })
    .then((rows) => {
      const lookup = new Map();
      for (const row of rows || []) {
        const r = unwrap(row);
        if (!r) continue;
        addAccountNameLookup(lookup, r.Id, r.Name);
      }
      return lookup;
    })
    .catch((error) => {
      console.warn(`[${context}] account lookup failed`, error);
      return new Map();
    });
};

const fetchPersonAccountNameLookup = (accountIds, context = 'personAccountNameLookup') => {
  const ids = Array.from(new Set((accountIds || []).filter(Boolean)));
  const idWhere = buildAnyIdMatchWhere('Id', ids);
  if (!idWhere) return Promise.resolve(new Map());

  return runQuery({
    object: 'Account',
    fields: ['Id', 'Name', 'IsPersonAccount'],
    where: `(${idWhere}) AND ${STAKEHOLDER_PERSON_ACCOUNT_WHERE}`,
    sort: ['Name ASC'],
  })
    .then((rows) => {
      const lookup = new Map();
      for (const row of rows || []) {
        const r = unwrap(row);
        if (!r) continue;
        addAccountNameLookup(lookup, r.Id, r.Name);
      }
      return lookup;
    })
    .catch((error) => {
      console.warn(`[${context}] person account lookup failed`, error);
      return new Map();
    });
};

const toCheckboxBoolean = (value) => {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'checked'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'unchecked', ''].includes(normalized)) return false;
  return false;
};

export const toReferralAccount = (row) => {
  const r = unwrap(row);
  if (!r) return null;
  return {
    id: r.Id,
    name: r.Name_of_Site__c || r.Name || null,
    hcoClassification: r.KPH_HCO_Classification__c || null,
    hcpTargetCount: r.KPH_of_HCP_Targets_within_a_Site__c || 0,
    referralCount: r.KPH_Referral_Count__c || 0,
    referralPriority: toCheckboxBoolean(r.KPH_Referral_Priority__c),
    treatedPatients: r.KPH_X2L_DLBCL_Treated_Patients__c || 0,
    indication: r.Indication__c || null,
    comments: r.KPH_Comments__c || '',
  };
};

export const fetchReferralAccounts = (planId, accountProfileId) => {
  const planWhere = buildIdMatchWhere('Account_Plan_vod__c', planId);
  const profileWhere = buildIdMatchWhere(REFERRAL_ACCOUNT_PROFILE_FIELD, accountProfileId);
  if (!planWhere || !profileWhere) return Promise.resolve([]);
  return fetchReferralAccountRows(planWhere, profileWhere).then((unwrappedRows) =>
    unwrappedRows.map(toReferralAccount).filter(Boolean)
  );
};

const fetchReferralAccountRows = (planWhere, profileWhere) =>
  runQuery({
    object: REFERRAL_ACCOUNT_OBJECT,
    fields: REFERRAL_ACCOUNT_FIELDS,
    where: `${planWhere} AND ${profileWhere} AND ${SOFT_DELETE_ACTIVE_WHERE}`,
    sort: ['Name ASC'],
  }).then(unwrapRows);

const fetchHealthcareNetworkRows = (profileWhere) =>
  runQuery({
    object: HEALTHCARE_NETWORK_OBJECT,
    fields: HEALTHCARE_NETWORK_FIELDS,
    where: `${profileWhere} AND ${SOFT_DELETE_ACTIVE_WHERE}`,
    sort: ['Name ASC'],
  }).then(
    unwrapRows,
    (error) => {
      // The object is marked `optional: true` in the legacy entity spec —
      // if the org doesn't expose it, swallow the failure and return [].
      console.warn('[healthcareNetwork] fetch failed; treating as empty', error);
      return [];
    }
  );

export const fetchAccountProfileChildRecords = (planId, accountProfileId) => {
  const planWhere = buildIdMatchWhere('Account_Plan_vod__c', planId);
  const profileWhere = buildIdMatchWhere(REFERRAL_ACCOUNT_PROFILE_FIELD, accountProfileId);
  if (!planWhere || !profileWhere) {
    return Promise.resolve({
      referralAccounts: [],
      accountInsights: [],
      healthcareNetworks: [],
    });
  }

  return Promise.all([
    fetchReferralAccountRows(planWhere, profileWhere),
    fetchAccountInsights(planId, accountProfileId),
    fetchHealthcareNetworkRows(profileWhere),
  ]).then(([referralRows, accountInsights, healthcareRows]) => {
    const accountIds = healthcareRows.map((row) => row.KPH_Account_Name__c).filter(Boolean);
    return fetchAccountNameLookup(accountIds, 'accountProfileChildren').then((accountNameById) => ({
      referralAccounts: referralRows.map(toReferralAccount).filter(Boolean),
      accountInsights,
      healthcareNetworks: healthcareRows.map((row) => toHealthcareNetwork(row, accountNameById)).filter(Boolean),
    }));
  });
};

const buildReferralAccountWriteFields = (form) => ({
  KPH_of_HCP_Targets_within_a_Site__c:
    form.hcpTargetCount === '' || form.hcpTargetCount === null || form.hcpTargetCount === undefined
      ? null
      : Number(form.hcpTargetCount),
  KPH_Referral_Priority__c: toCheckboxBoolean(form.referralPriority),
  Indication__c: form.indication || null,
  KPH_Comments__c: form.comments || null,
  Name_of_Site__c: String(form.name || '').trim() || null,
});

export const updateReferralAccount = (id, form) => {
  if (!id) return Promise.reject(new Error('Missing referral account id.'));
  return updateRecord(REFERRAL_ACCOUNT_OBJECT, id, buildReferralAccountWriteFields(form));
};

export const deleteReferralAccount = (id) => {
  if (!id) return Promise.reject(new Error('Missing referral account id.'));
  return softDeleteRecord(REFERRAL_ACCOUNT_OBJECT, id);
};

export const createReferralAccount = (planId, accountProfileId, form) => {
  if (!planId) return Promise.reject(new Error('Missing account plan id.'));
  if (!accountProfileId) return Promise.reject(new Error('Missing account profile id.'));
  return createRecord(REFERRAL_ACCOUNT_OBJECT, {
    Account_Plan_vod__c: planId,
    [REFERRAL_ACCOUNT_PROFILE_FIELD]: accountProfileId,
    ...buildReferralAccountWriteFields(form),
  });
};

// =============================================================================
// Healthcare Networks  ─ KPH_Other_Healthcare_Networks__c
// =============================================================================
// Optional child object. Links a healthcare network Account to a
// Kite-accountable owner and is scoped to the current Ecosystem Plan via
// KPH_Account_Profile__c.

export const HEALTHCARE_NETWORK_OBJECT = 'KPH_Other_Healthcare_Networks__c';
export const HEALTHCARE_NETWORK_ACCOUNT_PROFILE_FIELD = 'KPH_Account_Profile__c';

export const HEALTHCARE_NETWORK_FIELDS = [
  'Id',
  'Name',
  'KPH_Account_Name__c',
  'KPH_Kite_Accountable__c',
];

export const toHealthcareNetwork = (row, accountNameById = null) => {
  const r = unwrap(row);
  if (!r) return null;
  const accountId = r.KPH_Account_Name__c || null;
  return {
    id: r.Id,
    accountId,
    accountName: accountNameFromLookup(accountNameById, accountId) || r.Name || accountId,
    kiteAccountable: r.KPH_Kite_Accountable__c || null,
  };
};

export const fetchHealthcareNetworks = (accountProfileId) => {
  const profileWhere = buildIdMatchWhere(HEALTHCARE_NETWORK_ACCOUNT_PROFILE_FIELD, accountProfileId);
  if (!profileWhere) return Promise.resolve([]);
  return fetchHealthcareNetworkRows(profileWhere).then((unwrappedRows) => {
    const accountIds = unwrappedRows.map((row) => row.KPH_Account_Name__c).filter(Boolean);
    return fetchAccountNameLookup(accountIds, 'healthcareNetwork').then((accountNameById) =>
      unwrappedRows.map((row) => toHealthcareNetwork(row, accountNameById)).filter(Boolean)
    );
  });
};

const buildHealthcareNetworkWriteFields = (form) => ({
  KPH_Kite_Accountable__c: form.kiteAccountable || null,
  ...(form.accountId ? { KPH_Account_Name__c: form.accountId } : {}),
});

export const updateHealthcareNetwork = (id, form) => {
  if (!id) return Promise.reject(new Error('Missing healthcare network id.'));
  return updateRecord(HEALTHCARE_NETWORK_OBJECT, id, buildHealthcareNetworkWriteFields(form));
};

export const createHealthcareNetwork = (accountProfileId, form) => {
  if (!accountProfileId) return Promise.reject(new Error('Missing account profile id.'));
  return createRecord(HEALTHCARE_NETWORK_OBJECT, {
    [HEALTHCARE_NETWORK_ACCOUNT_PROFILE_FIELD]: accountProfileId,
    ...buildHealthcareNetworkWriteFields(form),
  });
};

export const deleteHealthcareNetwork = (id) => {
  if (!id) return Promise.reject(new Error('Missing healthcare network id.'));
  return softDeleteRecord(HEALTHCARE_NETWORK_OBJECT, id);
};

const numericMetricValue = (value) => {
  const raw = fieldValue(value);
  if (raw === null || raw === undefined || raw === '') return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
};

const sumReferralMetric = (rows, field) => {
  let total = 0;
  let hasValue = false;
  for (const row of rows || []) {
    const value = numericMetricValue(row?.[field]);
    if (value === null) continue;
    total += value;
    hasValue = true;
  }
  return hasValue ? String(total) : null;
};

export const summarizeReferralActivityMetrics = (referralAccounts = []) => ({
  referralVolume: sumReferralMetric(referralAccounts, 'referralCount'),
  secondLinePlusVolume: sumReferralMetric(referralAccounts, 'treatedPatients'),
});

// =============================================================================
// Account Insights  ─ KPH_Monthly_Executive_Summary__c
// =============================================================================
// Account Profile-scoped insight rows that show up in the Account Profile > Account
// Insights tab. Stores the free-text insight, its creation date, and who
// created it. iPad/offline VQL strips relationship fields, so the created-by
// display name is resolved by querying User with CreatedById.

export const ACCOUNT_INSIGHT_OBJECT = 'KPH_Monthly_Executive_Summary__c';
export const ACCOUNT_INSIGHT_TEXT_FIELD = 'KPH_Best_Practices_Key_Learnings_Insight__c';
export const ACCOUNT_INSIGHT_ACCOUNT_PROFILE_FIELD = 'KPH_Account_Profile__c';
export const ACCOUNT_INSIGHT_INDICATION_FIELD = 'Indication__c';
const ACCOUNT_INSIGHT_CREATED_DATE_FIELD = 'KPH_Created_Date__c';
export const ACCOUNT_CATEGORY_INDICATION_FIELD = 'KPH_Insight_Category__c';

export const ACCOUNT_INSIGHT_FIELDS = [
  'Id',
  'Name',
  'CreatedDate',
  'CreatedById',
  ACCOUNT_INSIGHT_INDICATION_FIELD,
  ACCOUNT_INSIGHT_TEXT_FIELD,
  ACCOUNT_INSIGHT_CREATED_DATE_FIELD,
  ACCOUNT_CATEGORY_INDICATION_FIELD,
];

export const toAccountInsight = (row, userNameById = new Map()) => {
  const r = unwrap(row);
  if (!r) return null;
  // Veeva can return field values wrapped as { value: ... } objects (notably
  // Date/DateTime fields). Normalize through fieldValue so the date doesn't
  // render as "[object Object]" — this hits newly created insights, whose
  // KPH_Created_Date__c is empty so they fall back to the wrapped CreatedDate.
  const createdById = fieldValue(r.CreatedById) || '';
  return {
    id: r.Id,
    name: fieldValue(r.Name),
    indication: fieldValue(r[ACCOUNT_INSIGHT_INDICATION_FIELD]) || '',
    insightCategory:fieldValue(r[ACCOUNT_CATEGORY_INDICATION_FIELD])|| '',
    insightText: fieldValue(r[ACCOUNT_INSIGHT_TEXT_FIELD]) || '',
    insightDate: fieldValue(r[ACCOUNT_INSIGHT_CREATED_DATE_FIELD]) || fieldValue(r.CreatedDate),
    createdById,
    createdBy: userNameById.get(createdById) || relationshipName(r, 'CreatedBy') || '',
  };
};
export const fetchAccountInsights = (_planId, accountProfileId) => {
  const profileWhere = buildIdMatchWhere(ACCOUNT_INSIGHT_ACCOUNT_PROFILE_FIELD, accountProfileId);
  if (!profileWhere) return Promise.resolve([]);
  return runQuery({
    object: ACCOUNT_INSIGHT_OBJECT,
    fields: ACCOUNT_INSIGHT_FIELDS,
    where: `${profileWhere} AND ${SOFT_DELETE_ACTIVE_WHERE}`,
    sort: ['LastModifiedDate DESC', 'Name ASC'],
  }).then((rows) => {
    const createdByIds = rows
      .map((row) => {
        const r = unwrap(row);
        return r && r.CreatedById;
      })
      .filter(Boolean);
    return lookupUserNamesById(createdByIds, 'accountInsights').then((userNameById) =>
      rows.map((row) => toAccountInsight(row, userNameById)).filter(Boolean)
    );
  });
};

const buildAccountInsightWriteFields = (form) => {
  const fields = {
    [ACCOUNT_INSIGHT_TEXT_FIELD]:
      String(form.insightText || '').trim() || null,

    [ACCOUNT_INSIGHT_INDICATION_FIELD]:
      form.indication || null,
  };

  if (form.insightCategory) {
    fields[ACCOUNT_CATEGORY_INDICATION_FIELD] =
      form.insightCategory;
  }

  return fields;
};

export const updateAccountInsight = (id, form) => {
  if (!id) return Promise.reject(new Error('Missing account insight id.'));
  return updateRecord(ACCOUNT_INSIGHT_OBJECT, id, buildAccountInsightWriteFields(form));
};

export const deleteAccountInsight = (id) => {
  if (!id) return Promise.reject(new Error('Missing account insight id.'));
  return softDeleteRecord(ACCOUNT_INSIGHT_OBJECT, id);
};

export const createAccountInsight = (planId, accountProfileId, form) => {
  if (!planId) return Promise.reject(new Error('Missing account plan id.'));
  if (!accountProfileId) return Promise.reject(new Error('Missing account profile id.'));
  return createRecord(ACCOUNT_INSIGHT_OBJECT, {
    KPH_Account_Plan__c: planId,
    [ACCOUNT_INSIGHT_ACCOUNT_PROFILE_FIELD]: accountProfileId,
    ...buildAccountInsightWriteFields(form),
  });
};

// =============================================================================
// Create HCP Account (Create Stakeholder modal)
// =============================================================================
const ACCOUNT_OBJECT = 'Account';
const ADDRESS_OBJECT = 'Address_vod__c';
const HCP_RECORD_TYPE_DEVELOPER_NAME = 'Professional_vod'; // verify in your org
const ADDRESS_FIELDS = [
  'Id', 'Name', 'Address_line_2_vod__c', 'City_vod__c', 'State_vod__c',
  'Zip_vod__c', 'Country_vod__c', 'Primary_vod__c', 'Business_vod__c', 'Home_vod__c',
]; // verify field API names in your org

const addressDisplay = (r) =>
  [r.Name, r.Address_line_2_vod__c, [r.City_vod__c, r.State_vod__c, r.Zip_vod__c].filter(Boolean).join(', '), r.Country_vod__c]
    .filter(Boolean)
    .join(' ');

// Scenario 2: addresses of the selected Primary Parent.
export const fetchParentAddresses = (parentId) => {
  if (!parentId) return Promise.resolve([]);
  return runQuery({
    object: ADDRESS_OBJECT,
    fields: ADDRESS_FIELDS,
    where: `Account_vod__c = ${quoteSoqlValue(parentId)}`,
    sort: ['Primary_vod__c DESC'],
    limit: 25,
  })
    .then((rows) =>
      rows
        .map((row) => unwrap(row))
        .filter((r) => r && r.Id)
        .map((r) => ({
          id: r.Id,
          display: addressDisplay(r),
          type: isTruthy(r.Business_vod__c) ? 'Business' : isTruthy(r.Home_vod__c) ? 'Home' : '',
         primary: isTruthy(r.Primary_vod__c),
         raw: r,
        }))
    )
    .catch((error) => {
     console.warn('[parentAddresses] load failed', error);
      return [];
    });
};

// Account record types for the Create Stakeholder modal dropdown.
export const fetchAccountRecordTypes = () =>
  runQuery({
    object: 'RecordType',
    fields: ['Id', 'Name', 'DeveloperName'],
    where: `SobjectType = 'Account' AND IsActive = true`,
    sort: ['Name ASC'],
    limit: 50,
  })
    .then((rows) =>
      rows
        .map((row) => unwrap(row))
        .filter((r) => r && r.Id)
        .map((r) => ({ id: r.Id, name: r.Name, developerName: r.DeveloperName }))
    )
    .catch((error) => {
      console.warn('[accountRecordTypes] load failed', error);
      return [];
    });

const resolveHcpRecordTypeId = () =>
  runQuery({
    object: 'RecordType',
    fields: ['Id'],
    where: `SobjectType = 'Account' AND DeveloperName = ${quoteSoqlValue(HCP_RECORD_TYPE_DEVELOPER_NAME)}`,
    limit: 1,
 })
    .then((rows) => unwrap(rows?.[0])?.Id || null)
    .catch(() => null);

// Scenario 3: create the Account (+ copy the chosen parent address) in Veeva.
export const createStakeholderAccount = async (form = {}) => {
  const lastName = cleanedTextOrNull(form.lastName);
  const credential = cleanedTextOrNull(form.credential);
  const country = cleanedTextOrNull(form.country);
  const selectedRecordTypeId= cleanedTextOrNull(form.recordTypeId);
  if (!lastName) throw new Error('Last Name is required.');
  if (!credential) throw new Error('Credential is required.');
  if (!country) throw new Error('Country is required.');
  if (!selectedRecordTypeId) throw new Error('Account Record is required.');


  const fields = {
    FirstName: cleanedTextOrNull(form.firstName),
    LastName: lastName,
    Salutation: cleanedTextOrNull(form.salutation),
    Credentials_vod__c: credential,
    KPH_Country__c: country,
    NPI_vod__c: cleanedTextOrNull(form.npi),
  };
  // const recordTypeId = await resolveHcpRecordTypeId();
  // if (recordTypeId) fields.RecordTypeId = recordTypeId;
  fields.RecordTypeId = selectedRecordTypeId;
  if (form.primaryParentId) fields.Primary_Parent_vod__c = form.primaryParentId;

  const result = await createRecord(ACCOUNT_OBJECT, fields);
  const id = createdRecordId(result);
  if (!id) throw new Error('Unable to create account record.');

  const src = form.address?.raw;
  if (src) {
    try {
      await createRecord(ADDRESS_OBJECT, {
        Account_vod__c: id,
        Name: src.Name,
       Address_line_2_vod__c: src.Address_line_2_vod__c || null,
        City_vod__c: src.City_vod__c || null,
        State_vod__c: src.State_vod__c || null,
       Zip_vod__c: src.Zip_vod__c || null,
        Country_vod__c: src.Country_vod__c || null,
       Primary_vod__c: isTruthy(src.Primary_vod__c),
        Business_vod__c: isTruthy(src.Business_vod__c),
       Home_vod__c: isTruthy(src.Home_vod__c),
     });
    } catch (error) {
      throw new Error(`Account was created, but its address could not be saved: ${error?.message || 'unknown error'}`);
    }
  }

  // Re-read to pick up EID / identifier generated by the backend.
  const fallback = {
    id,
    name: [fields.FirstName, lastName].filter(Boolean).join(' '),
    eid: '',
   accountIdentifier: null,
  };
  return runQuery({
    object: ACCOUNT_OBJECT,
    fields: ACCOUNT_LOOKUP_FIELDS,
    where: `Id = ${quoteSoqlValue(id)}`,
    limit: 1,
  })
  .then((rows) => toAccountLookupOption(rows?.[0]) || fallback)
    .catch(() => fallback);
};