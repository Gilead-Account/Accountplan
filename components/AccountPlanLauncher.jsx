import { useEffect, useMemo, useRef, useState } from 'react';
import KiteAccountPlanLoader from '@/components/KiteAccountPlanLoader';
import { fetchCurrentUserAccountPlans} from '@/lib/dataservice/accountPlan/accountPlanLauncher';
import { getCurrentUserEmail } from '@/lib/dataservice/accountPlan/shared';
import { isAccountPlanPendingManagerApproval } from '@/lib/accountPlanApprovalAssignments';
import { nextTableSort, stableSortRows, toDateSortValue } from '@/lib/helper/tableSort';
import { formatDate, mergeWithDataValues  } from '@/lib/helper/utils';
import { fetchDynamicPicklists, fetchPotentialAtc } from '../lib/dataservice/accountPlan/potentialAtc';

const EMPTY_ROWS = [];
const LOADER_MIN_DURATION_MS = 2500;                                                                                                                                             
const ACCOUNT_PLAN_LIST_TAB = 'account-plan-list';
const PENDING_APPROVAL_TAB = 'pending-approval';
const PRE_AUTHORIZATION_TAB = 'pre-authorization';
const ACCOUNT_PLAN_LAUNCHER_COLUMNS = [
  { key: 'name', label: 'Account Plan Name' },
  { key: 'ownerName', label: 'Owner Name' },
  { key: 'marketAccessPrioritizedAccount', label: 'Market Access Prioritized Account' },
  { key: 'mmAtcPriorityAccount', label: 'MM ATC Priority Account' },
  { key: 'atcCohortDlbcl', label: 'ATC Cohort DLBCL' },
  { key: 'planStatus', label: 'Plan Status' },
  { key: 'territory', label: 'Territory' },
  { key: 'territoryDescription', label: 'Territory Description' },
  { key: 'atcCertifiedDate', label: 'ATC Certified Date', type: 'date' },
  { key: 'lastMpdReviewDate', label: 'Last MPD Review Date', type: 'date' },
  { key: 'submittedDate', label: 'Submitted Date', type: 'date' },
];

const PENDING_APPROVAL_COLUMNS = [
  { key: 'name', label: 'Account Plan Name' },
  { key: 'approvalStatus', label: 'Approval Status' },
  { key: 'comments', label: 'Comments' },
  { key: 'submittedDate', label: 'Submitted Date', type: 'date' },
  { key: 'approvalDueDate', label: 'Approval Due Date', type: 'date' },
  { key: 'lastMpdReviewDate', label: 'Last MPD Review Date', type: 'date' },
  { key: 'lastAccountInsightUpdate', label: 'Last Account Insight Update', type: 'date' },
  {
    key: 'lastAdditionalCriticalActivityUpdate',
    label: 'Last Additional Critical Activity Update',
    type: 'date',
  },
  {
    key: 'lastBarrierTacticalActionUpdate',
    label: 'Last Barrier & Tactical Action Update',
    type: 'date',
  },
];

const PRE_AUTHORIZATION_COLUMNS = [
  { key: 'name', label: 'Account Plan Name' },
  { key: 'potentialAtc', label: 'Potential ATC'},
  { key: 'comments', label: 'Comments' },
  { key: 'planStatus', label: 'Plan Status' },
  //{ key: 'centerClassification ', label: 'Center Classification'},
  { key: 'accountPhase', label: 'Account Phase'},
  { key: 'lastAccountInsightUpdate', label: 'Last Account Insight Update', type: 'date' },
  {
    key: 'lastAdditionalCriticalActivityUpdate',
    label: 'Last Additional Critical Activity Update',
    type: 'date',
  },
  {
    key: 'lastBarrierTacticalActionUpdate',
    label: 'Last Barrier & Tactical Action Update',
    type: 'date',
  }
];

const LAUNCHER_COLUMN_BY_KEY = new Map(
  [...ACCOUNT_PLAN_LAUNCHER_COLUMNS, ...PENDING_APPROVAL_COLUMNS, ...PRE_AUTHORIZATION_COLUMNS]
    .map((column) => [column.key, column])
);

const plain =(v)=> v && typeof v === 'object' && 'value' in v? plain(v.value):v;
const normalizaRow = (row) => Object.fromEntries(Object.entries(row || {}).map(([k,v])=> [k,plain(v)]));
const launcherSortValue = (row, key) => {
  const column = LAUNCHER_COLUMN_BY_KEY.get(key);
  if (column?.type === 'date') return toDateSortValue(row[key]);
  return row[key];
};

const renderLauncherCellValue = (plan, column) => {
  const raw = plan[column.key];
  const value = raw && typeof raw ==='object' && 'value' in raw ? raw.value:raw;
  if (column.type === 'date') {
    return formatDate(value, '-');
  }
  if(value===null || value === undefined || value=== '')
  return '-';
 return String(value);
};

function LauncherSortButton({ column, sort, onSort }) {
  const isActive = sort && sort.key === column.key;
  const direction = isActive ? sort.direction : '';

  return (
    <button
      type="button"
      className="account-plan-launcher-sort-button"
      onClick={() => onSort(column.key)}
      aria-label={`Sort by ${column.label}`}
      aria-pressed={!!isActive}
      data-sort-key={column.key}
      data-sort-direction={direction || 'none'}
      title={column.label}
    >
      <span className="account-plan-launcher-sort-label">{column.label}</span>
      <span className="account-plan-launcher-sort-slot" aria-hidden="true">
        <i className={`activity-sort-arrow ${direction}`} />
      </span>
    </button>
  );
}
const buildFilterOptions =(picklistvalues, rows, rowKey)=>{
  if(picklistvalues && picklistvalues.length){
    return ['All', ...picklistvalues];
  }
  const fromRows =[...new Set((rows || []).map((r)=>r[rowKey]).filter((v)=> v && v !=='_')),];
  return ['All', ...fromRows];
}
export default function AccountPlanLauncher({ onSelectPlan, isCtamManager = false }) {
  const [rows, setRows] = useState(EMPTY_ROWS);
  const [preAuthorizationRows,setPreAuthorizationRows]= useState(EMPTY_ROWS);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [fieldMetadata, setFieldMetadata] = useState([]);
  const [picklistData, setPicklistData] = useState({});
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(null);
  const [activeTab, setActiveTab] = useState(ACCOUNT_PLAN_LIST_TAB);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [approvalEmailStatus, setApprovalEmailStatus] = useState('idle');
  const loadSeqRef = useRef(0);
  const loadTimerRef = useRef(null);
  
  const loadRows = () => {
    const loadSeq = loadSeqRef.current + 1;
    loadSeqRef.current = loadSeq;
    const startedAt = Date.now();
    if (loadTimerRef.current) {
      window.clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    setStatus('loading');
    setError(null);
    fetchCurrentUserAccountPlans()
      .then((plans) => ({ nextStatus: 'ready', plans: plans || EMPTY_ROWS, error: null }))
      .catch((err) => {
        console.error('[account-plan-launcher] load failed', err);
        return { nextStatus: 'error', plans: EMPTY_ROWS, error: err };
      })
      .then((result) => {
        const elapsed = Date.now() - startedAt;
        const remainingMs = Math.max(0, LOADER_MIN_DURATION_MS - elapsed);
        loadTimerRef.current = window.setTimeout(() => {
          if (loadSeqRef.current !== loadSeq) return;
          loadTimerRef.current = null;
          setRows(result.plans);
          setError(result.error);
          setStatus(result.nextStatus);
        }, remainingMs);
      });
  };

  useEffect(() => {
    loadRows();
    return () => {
      loadSeqRef.current += 1;
      if (loadTimerRef.current) {
        window.clearTimeout(loadTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isCtamManager) {
      setActiveTab(ACCOUNT_PLAN_LIST_TAB);
      setCurrentUserEmail(null);
      setApprovalEmailStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setApprovalEmailStatus('loading');
    getCurrentUserEmail()
      .then((email) => {
        if (cancelled) return;
        setCurrentUserEmail(email || null);
        setApprovalEmailStatus(email ? 'ready' : 'error');
      })
      .catch((err) => {
        console.info('[account-plan-launcher] unable to resolve current user email', err);
        if (!cancelled) {
          setCurrentUserEmail(null);
          setApprovalEmailStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCtamManager]);

 
  useEffect(() => {
  let alive = true;
  fetchPotentialAtc()
    .then((data) => {
      if (alive) {
        setPreAuthorizationRows(data || []);
        const potentialdata = data.potentialAtc;
        console.log('potentialAtc:',potentialdata )
      }
    })
    .catch((err) => {
      console.error(
        '[AccountPlanLauncher] fetchPotentialAtc failed',
        err
      );
      if (alive) {
        setPreAuthorizationRows([]);
      }
    });
  return () => {
    alive = false;
  };
}, []);

useEffect(() => {
  const metadata = [
    // {
    //   fieldLabel: 'Center Classification',
    //   fieldApiName: 'KPH_Center_Classification__c',
    //   dataType: 'Picklist'
    // },
    {
      fieldLabel: 'Account Phase',
      fieldApiName: 'KPH_Account_Phase__c',
      dataType: 'Picklist'
    },
    {
      fieldLabel: 'Plan Status',
      fieldApiName: 'KPH_Plan_status__c',
      dataType: 'Picklist'
    }
  ];
  setFieldMetadata(metadata);
}, []);

useEffect(() => {
  if (!fieldMetadata.length) return;
  const picklistFields =
    fieldMetadata.filter(
      f => f.dataType === 'Picklist'
    );
  fetchDynamicPicklists(picklistFields)
    .then(setPicklistData)
    .catch(console.error);
}, [fieldMetadata]);

  const approvalRows = useMemo(
    () => rows.filter((row) => isAccountPlanPendingManagerApproval(row, currentUserEmail)),
    [currentUserEmail, rows]
  );


const userPickedTab =useRef(false);
  useEffect(() => {
    // if (!isCtamManager || status !== 'ready' || !['ready', 'error'].includes(approvalEmailStatus)) {
    //   return;
    // }
    // if(!isCtamManager) return;
    // if(userPickedTab.current) return;
    // if(status==='loading') return;
    if(['idle', 'loading'].includes(approvalEmailStatus)) return;
    setActiveTab(approvalRows.length > 0 ? PENDING_APPROVAL_TAB : ACCOUNT_PLAN_LIST_TAB);
    
  }, [approvalEmailStatus, approvalRows, isCtamManager, status]);

  const isLauncherLoading = status === 'loading'
    || (isCtamManager && ['idle', 'loading'].includes(approvalEmailStatus));
  const avilableTabs = isCtamManager?[ACCOUNT_PLAN_LIST_TAB , PENDING_APPROVAL_TAB, PRE_AUTHORIZATION_TAB]:[ACCOUNT_PLAN_LIST_TAB, PRE_AUTHORIZATION_TAB]
  const currentTab =avilableTabs.includes(activeTab)?activeTab:ACCOUNT_PLAN_LIST_TAB;
  const isApprovalTab = currentTab === PENDING_APPROVAL_TAB;
  const isPreAuthorizationTab =  currentTab === PRE_AUTHORIZATION_TAB;
  const isAccountPlanlisTab = currentTab=== ACCOUNT_PLAN_LIST_TAB;
  const tabRows = useMemo(()=>( isApprovalTab ? approvalRows : isPreAuthorizationTab ? preAuthorizationRows : rows).map(normalizaRow),
  [isAccountPlanlisTab, isPreAuthorizationTab,approvalRows,preAuthorizationRows,rows]);
  const visibleColumns = isApprovalTab ? PENDING_APPROVAL_COLUMNS: isPreAuthorizationTab ? PRE_AUTHORIZATION_COLUMNS : ACCOUNT_PLAN_LAUNCHER_COLUMNS;
  
const handleFilterChange = (fieldApiName,value) => {
  setFilters(prev => ({
    ...prev,
    [fieldApiName]: value
  }));
};

const filteredRows = useMemo(() => {
  const term = String(query || '').trim().toLowerCase();
  let filtered =[...tabRows];
      if (isPreAuthorizationTab) {
      Object.entries(filters).forEach(
      ([fieldApiName, value]) => {
        if (!value || value === 'All') return;
        const rowMap = {
          KPH_Center_Classification__c:
            'centerClassification',
          KPH_Account_Phase__c:
            'accountPhase',
          KPH_Plan_status__c:
            'planStatus'
        };
        filtered = filtered.filter(
          row =>
            row[rowMap[fieldApiName]]
            === value
        );
      }
    );
      }

    if (!term) return filtered;
    return filtered.filter((row) =>
      [
        row.name,
        row.eid,
        row.ownerName,
        row.ownerFirstName,
        row.ownerLastName,
        row.marketAccessPrioritizedAccount,
        row.mmAtcPriorityAccount,
        row.atcCohortDlbcl,
        row.planStatus,
        row.territory,
        row.territoryDescription,
        row.approvalStatus,
        row.comments,
        row.submittedDate,
        row.approvalDueDate,
        row.lastMpdReviewDate,
        row.lastAccountInsightUpdate,
        row.lastAdditionalCriticalActivityUpdate,
        row.lastBarrierTacticalActionUpdate,
        row.potentialAtc,
        row.centerClassification,
        row.accountPhase,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [query, tabRows, filters, isPreAuthorizationTab]);


  const visibleRows = useMemo(
    () => stableSortRows(filteredRows, sort, launcherSortValue),
    [filteredRows, sort]
  );

  const handleSort = (key) => setSort((current) => nextTableSort(current, key));
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setQuery('');
    setSort(null);
  };

  return (
    <main className="account-plan-launcher" aria-label="Account Plan selection">
      {isLauncherLoading ? (
        <KiteAccountPlanLoader />
      ) : (
        <>
          {/* {isCtamManager && ( */}
            <div className="account-plan-launcher-tabs" role="tablist" aria-label="Account Plan views">
              <button
                type="button"
                id="account-plan-list-tab"
                role="tab"
                aria-controls="account-plan-launcher-table-panel"
                aria-selected={isAccountPlanlisTab}
                className={isAccountPlanlisTab ? 'is-active' : undefined}
                onClick={() => handleTabChange(ACCOUNT_PLAN_LIST_TAB)}
              >
                <span>Account Plan List</span>
                <span className="account-plan-launcher-tab-count">{rows.length}</span>
              </button>
              {isCtamManager && ( <button
                type="button"
                id="pending-approval-tab"
                role="tab"
                aria-controls="account-plan-launcher-table-panel"
                aria-selected={isApprovalTab}
                className={isApprovalTab ? 'is-active' : undefined}
                onClick={() => handleTabChange(PENDING_APPROVAL_TAB)}
              >
                <span>Pending My Approval</span>
                <span className="account-plan-launcher-tab-count">{approvalRows.length}</span>
              </button>
              )}
              <button
                type="button"
                id="pre-auth-list-tab"
                role="tab"
                aria-controls="account-plan-launcher-table-panel"
                aria-selected={isPreAuthorizationTab}
                className={isPreAuthorizationTab ? 'is-active' : undefined}
                onClick={() => handleTabChange(PRE_AUTHORIZATION_TAB)}
              >
                <span>Pre Authorization</span>
                <span className="account-plan-launcher-tab-count">{preAuthorizationRows.length}</span>
              </button>
            </div>
          {/* //)} */}
          <section
            className="account-plan-launcher-panel"
            id={isCtamManager ? 'account-plan-launcher-table-panel' : undefined}
            role={isCtamManager ? 'tabpanel' : undefined}
            aria-labelledby={isCtamManager
              ? (isApprovalTab ? 'pending-approval-tab' :isPreAuthorizationTab? 'pre-auth-list-tab':'account-plan-list-tab')
              : undefined}
          >
        <div className="account-plan-launcher-panel-head">
          <div className="account-plan-launcher-panel-title">
            <span className="account-plan-launcher-count">{filteredRows.length}</span>
            <div>
              <h1>{isApprovalTab ? 'Pending My Approval' :isPreAuthorizationTab? 'Pre Authorization': 'Account Plans'}</h1>
              <span>{filteredRows.length === 1 ? '1 result' : `${filteredRows.length} results`}</span>
              
            </div>
          </div>
          <div className="account-plan-launcher-actions">
             {isPreAuthorizationTab && fieldMetadata
                  .filter(f => f.dataType === 'Picklist')
                  .map(field => (
                <label key={field.fieldApiName} className="select-shell1 account-plan-launcher-search">
                    <span>{field.fieldLabel}</span>
                    <select
                      value={filters[field.fieldApiName] ||'All'}
                      onChange={(e) =>handleFilterChange(field.fieldApiName,e.target.value )
                      }
                    >
                      <option value="All">All</option>
                      {(picklistData[ field.fieldApiName ] || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                  ))}
            <label className="account-plan-launcher-search">
              <span>Search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={isApprovalTab ? 'Status, comments, dates' : 'Plan, owner, territory'}
              />
            </label>
            <button type="button" className="account-plan-launcher-refresh" onClick={loadRows}>
              Refresh
            </button>
          </div>
        </div>

        {status === 'error' && (
          <div className="account-plan-launcher-state is-error">
            <strong>Unable to load Account Plans.</strong>
            <span>{error?.message || 'Try refreshing the list.'}</span>
          </div>
        )}

        {status === 'ready' && isApprovalTab && approvalEmailStatus === 'loading' && (
          <div className="account-plan-launcher-state">
            <strong>Loading approval assignments.</strong>
            <span>Matching submitted Account Plans to your CRM email.</span>
          </div>
        )}

        {status === 'ready' && isApprovalTab && approvalEmailStatus === 'error' && (
          <div className="account-plan-launcher-state is-error">
            <strong>Unable to load approval assignments.</strong>
            <span>Your Email field could not be resolved from the current CRM User.</span>
          </div>
        )}

        {status === 'ready' && filteredRows.length === 0 && (!isApprovalTab || approvalEmailStatus === 'ready') && (
          <div className="account-plan-launcher-state">
            <strong>{isApprovalTab ? 'No Account Plans are pending your approval.' : 'No Account Plans found.'}</strong>
            <span>
              {isApprovalTab
                ? 'Only submitted or reassigned plans assigned to your manager email appear here.'
                : 'Try a different search or refresh the list.'}
            </span>
          </div>
        )}

        {status === 'ready' && visibleRows.length > 0 && (!isApprovalTab || approvalEmailStatus === 'ready') && (
          <div
            className={`account-plan-launcher-table${isApprovalTab ? ' is-approval' : ''}`}
            role="table"
            aria-label={isApprovalTab ? 'Account Plans pending my approval' : 'Account Plans'}
          >
            <div className="account-plan-launcher-row is-head" role="row">
              {visibleColumns.map((column) => (
                <span role="columnheader" key={column.key}>
                  <LauncherSortButton column={column} sort={sort} onSort={handleSort} />
                </span>
              ))}
              <span role="columnheader">Action</span>
            </div>
            {visibleRows.map((plan) => (
              <div className="account-plan-launcher-row" role="row" key={plan.id}>
                {visibleColumns.map((column) => (
                  <span
                    role="cell"
                    data-label={column.label}
                    className={column.key === 'name' ? 'account-plan-launcher-plan-name' : undefined}
                    key={column.key}
                  >
                    {column.key === 'name' ? (
                      <>
                        <strong title={plan.name}>{plan.name}</strong>
                        <small>{plan.eid || '-'}</small>
                      </>
                    ) : (
                      renderLauncherCellValue(plan, column)
                    )}
                  </span>
                ))}
                <span role="cell" data-label="Action">
                  <button
                    type="button"
                    className="account-plan-launcher-open"
                    aria-label={`Open ${plan.name}`}
                    onClick={() => onSelectPlan?.({
                          ...plan,
                          isPotentialAtc: plan.potentialAtc === true,
                        })
                        }
                  >
                    Open
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
          </section>
        </>
      )}
    </main>
  );
}
