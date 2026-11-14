import { useCallback, useEffect, useRef, useState } from 'react';
import AccountPlanLauncher from '@/components/AccountPlanLauncher';
import Sidebar from '@/components/Sidebar';
import ExecutiveSummaryModal from '@/components/ExecutiveSummaryModal';
import LoadingScreen from '@/components/LoadingScreen';
import SubmitMpdApprovalModal from '@/components/SubmitMpdApprovalModal';
import RecallApprovalModal from '@/components/RecallApprovalModal';
import {
  ApprovalHistoryModal,
  ManagerApprovalReviewModal,
} from '@/components/ManagerApprovalModals';
import Overview from '@/pages/Overview';
import Stakeholders from '@/pages/Stakeholders';
import TeamMembers from '@/pages/TeamMembers';
import CriticalActivities from '@/pages/CriticalActivities';
import CrossFunctionalPlan from '@/pages/CrossFunctionalPlan';
import BarriersDrivers from '@/pages/BarriersDrivers';
import AccountProfile from '@/pages/AccountProfile';
import { isMockRuntime } from '@/lib/dataservice/client';
import { loadHome } from '@/lib/dataservice/accountPlan/home';
import { loadBarriersDrivers } from '@/lib/dataservice/accountPlan/barriersDrivers';
import { loadCriticalActivities } from '@/lib/dataservice/accountPlan/criticalActivities';
import { loadCrossFunctionalPlan } from '@/lib/dataservice/accountPlan/crossFunctionalPlan';
import { loadAccountProfile } from '@/lib/dataservice/accountPlan/accountProfile';
import { loadStakeholders } from '@/lib/dataservice/accountPlan/stakeholders';
import { loadTeamMembers, sortTeamMembersByParticipation } from '@/lib/dataservice/accountPlan/teamMembers';
import {
  fetchPlanApprovalStatus,
  getCurrentUserProfileName,
  getCurrentUserUsername,
  setCurrentAccountPlanIdOverride,
} from '@/lib/dataservice/accountPlan/shared';
import { detectRuntimeViewMode } from '@/lib/runtime/viewMode';
import {
  deliverPreparedAccountPlanPpt,
  loadAccountPlanPptData,
  prepareAccountPlanPpt,
} from '@/lib/export/accountPlanPpt';
import {
  deliverPreparedAccountPlanPdf,
  prepareAccountPlanPdf,
} from '@/lib/export/accountPlanPdf';
import { buildAccountPlanExecutiveSummary } from '@/lib/export/accountPlanExecutiveSummary';
import {
  fetchAccountPlanApprovalReview,
  fetchAccountPlanApprovalHistory,
  fetchCtamManagerUsers,
  recallAccountPlanApproval,
  submitMpdApproval,
  updateManagerApprovalStep,
  ACCOUNT_PLAN_RECALLED_STATUS,
} from '@/lib/dataservice/accountPlan/approval';
import {
  isSubmittedOrReassignedApprovalStatus,
  isSubmittedForApprovalStatus,
  SUBMITTED_FOR_APPROVAL_STATUS,
} from '@/lib/accountPlanReadOnly';
import {
  isAccountPlanReadOnlyForProfile,
  isCtamManagerProfile,
  isMpdApprovalRestrictedProfile,
} from '@/lib/approvalProfileAccess';
import {
  PageFilterStateProvider,
  useResetPageFilterState,
} from '@/lib/ui/pageFilterState';
import { AccountPhaseContext, DryRunDateContext, PotentialAtcContext } from './lib/dataservice/accountPlan/PotentialAtcContext';

// Each page declares its own loader. App.jsx caches the last loaded payload so
// switching back to a page is instant, then refreshes that page in the
// background to keep shared records aligned across Home/detail views.
// `implemented: true` means there's a rendering component for it; pages without
// one still fetch (so the sidebar/header can show plan + account) but the body
// shows "Coming soon" until the view component is built.
const PAGES = [
  { key: 'overview', label: 'Home', shortLabel: 'HM', implemented: true, loader: loadHome },
  { key: 'barriers-drivers', label: 'Barriers & Drivers', shortLabel: 'BD', implemented: true, loader: loadBarriersDrivers },
  { key: 'critical-activities', label: 'Critical Activities', shortLabel: 'CA', implemented: true, loader: loadCriticalActivities },
  { key: 'linked-opportunities', label: 'Cross functional Plan of Action', shortLabel: 'PO', implemented: true, loader: loadCrossFunctionalPlan },
  { key: 'kpi', label: 'Account Profile', shortLabel: 'AP', implemented: true, loader: loadAccountProfile },
  { key: 'account-insights', label: 'Account Insights', shortLabel: 'IN', implemented: true, loader: loadAccountProfile, dataKey: 'kpi' },
  { key: 'stakeholders', label: 'Stakeholders', shortLabel: 'SH', implemented: true, loader: loadStakeholders },
  { key: 'team-members', label: 'Team Members', shortLabel: 'TM', implemented: true, loader: loadTeamMembers },
];

const PAGE_BY_KEY = Object.fromEntries(PAGES.map((p) => [p.key, p]));
const pageDataKey = (key) => PAGE_BY_KEY[key]?.dataKey || key;

// Local-preview users mirror the live CRM list returned for the exact
// KPH-CTAM Manager profile.
const MOCK_APPROVAL_REASSIGN_USERS = Object.freeze([
  { id: '0058C00000MockMgr1', name: 'Morgan Lee' },
  { id: '0058C00000MockMgr2', name: 'Jordan Patel' },
]);

const CRITICAL_ACTIVITY_CACHE_FIELDS = {
  overview: 'criticalActivities',
  'barriers-drivers': 'activities',
  'critical-activities': 'activities',
};

const TEAM_MEMBER_CACHE_FIELDS = {
  overview: 'teamMembers',
  'team-members': 'teamMembers',
};

const STARTUP_PRELOAD_DELAY_MS = 0;
const NAVIGATION_PRELOAD_DELAY_MS = 120;
const APPROVAL_STATUS_REFRESH_MS = 3000;
const APPROVAL_STATUS_RESUME_THROTTLE_MS = 1200;
const EXPORT_PREPARE_IDLE_DELAY_MS = 650;
const EXPORT_PREPARE_IDLE_TIMEOUT_MS = 1600;
const STARTUP_PRELOAD_PAGE_KEYS = [
  'stakeholders',
  'team-members',
];

const mergeRecord = (rows, record) => {
  const list = rows || [];
  return list.some((row) => row && row.id === record.id)
    ? list.map((row) => (row && row.id === record.id ? record : row))
    : [record, ...list];
};

const getRuntimeViewSnapshot = () => {
  try {
    return detectRuntimeViewMode();
  } catch {
    return { viewMode: 'ipad', layoutMode: 'unknown' };
  }
};

const hasShellContext = (data) => Boolean(
  data && (
    data.plan ||
    data.account ||
    data.planId
  )
);

const resolveShellSource = (cachedPageData, activeData) =>
  cachedPageData.overview || activeData || Object.values(cachedPageData || {}).find(hasShellContext) || null;

const isMissingAccountPlanContextError = (error) =>
  /no account plan in context/i.test(String(error?.message || error || ''));

function AppContent() {
  const initialRuntimeModeRef = useRef(null);
  if (!initialRuntimeModeRef.current) {
    const snapshot = getRuntimeViewSnapshot();
    initialRuntimeModeRef.current = {
      snapshot,
      shouldLoadPages: snapshot.viewMode !== 'desktop',
    };
  }
  const [activeKey, setActiveKey] = useState('overview');
  const [pageData, setPageData] = useState({});
  const [pageStatus, setPageStatus] = useState(
    initialRuntimeModeRef.current.shouldLoadPages ? { overview: 'loading' } : {}
  );
  const [pageError, setPageError] = useState({});
  const [runtimeViewSnapshot, setRuntimeViewSnapshot] = useState(initialRuntimeModeRef.current.snapshot);
  const [isDesktopPlanSelected, setIsDesktopPlanSelected] = useState(initialRuntimeModeRef.current.shouldLoadPages);
  const [hasModalOpen, setHasModalOpen] = useState(false);
  const [criticalActivityToEditId, setCriticalActivityToEditId] = useState(null);
  const [criticalActivityToEditTarget, setCriticalActivityToEditTarget] = useState(null);
  const [criticalActivityEditRequest, setCriticalActivityEditRequest] = useState(0);
  const [pendingCriticalActivityNavigation, setPendingCriticalActivityNavigation] = useState(false);
  const [barriersDriversTargetTab, setBarriersDriversTargetTab] = useState('barriers');
  const [isExportingPpt, setIsExportingPpt] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pptPrepareStatus, setPptPrepareStatus] = useState('idle');
  const [pdfPrepareStatus, setPdfPrepareStatus] = useState('idle');
  const [exportNotice, setExportNotice] = useState(null);
  const [appNotice, setAppNotice] = useState(null);
  const [isExecutiveSummaryOpen, setIsExecutiveSummaryOpen] = useState(false);
  const [executiveSummary, setExecutiveSummary] = useState(null);
  const [executiveSummaryStatus, setExecutiveSummaryStatus] = useState('idle');
  const [executiveSummaryError, setExecutiveSummaryError] = useState(null);
  const [isMpdApprovalOpen, setIsMpdApprovalOpen] = useState(false);
  const [mpdApprovalStatus, setMpdApprovalStatus] = useState('idle');
  const [mpdApprovalError, setMpdApprovalError] = useState('');
  const [isRecallApprovalOpen, setIsRecallApprovalOpen] = useState(false);
  const [recallApprovalStatus, setRecallApprovalStatus] = useState('idle');
  const [recallApprovalError, setRecallApprovalError] = useState('');
  const [selectedLauncherPlan, setSelectedLauncherPlan] = useState(null);
  const [isApprovalHistoryOpen, setIsApprovalHistoryOpen] = useState(false);
  const [isManagerApprovalReviewOpen, setIsManagerApprovalReviewOpen] = useState(false);
  const [managerApprovalHistory, setManagerApprovalHistory] = useState([]);
  const [managerApprovalHistoryStatus, setManagerApprovalHistoryStatus] = useState('idle');
  const [managerApprovalHistoryError, setManagerApprovalHistoryError] = useState('');
  const [managerApprovalReviewStatus, setManagerApprovalReviewStatus] = useState('idle');
  const [managerApprovalReview, setManagerApprovalReview] = useState(null);
  const [managerDecisionStatus, setManagerDecisionStatus] = useState('idle');
  const [managerDecisionError, setManagerDecisionError] = useState('');
  const [managerReassignUsers, setManagerReassignUsers] = useState(
    () => (isMockRuntime ? MOCK_APPROVAL_REASSIGN_USERS : [])
  );
  const [managerReassignUsersStatus, setManagerReassignUsersStatus] = useState(
    isMockRuntime ? 'ready' : 'idle'
  );
  const [approvalStatusSnapshot, setApprovalStatusSnapshot] = useState(null);
  const [currentUserProfileName, setCurrentUserProfileName] = useState(null);
  const [currentUserUsername, setCurrentUserUsername] = useState(null);
  const resetPageFilterState = useResetPageFilterState();
  const loadedRef = useRef(new Set());
  const pageLoadPromisesRef = useRef(new Map());
  const approvalStatusRefreshRef = useRef({ inFlight: null, lastCheckedAt: 0 });
  const exportManualUrlRef = useRef(null);
  const preparedPptRef = useRef(null);
  const preparedPdfRef = useRef(null);
  const pptPrepareRequestRef = useRef(0);
  const pdfPrepareRequestRef = useRef(0);
  const executiveSummaryRequestRef = useRef(0);
  const managerApprovalHistoryRequestRef = useRef(0);
  const managerApprovalReviewRequestRef = useRef(0);
  const managerApprovalReviewTimerRef = useRef(null);
  const appNoticeTimerRef = useRef(null);

  const activePage = PAGE_BY_KEY[activeKey];
  const activeDataKey = pageDataKey(activeKey);
  const activeStatus = pageStatus[activeDataKey] || (activePage?.loader ? 'loading' : 'idle');
  const activeData = pageData[activeDataKey];
  const activeError = pageError[activeDataKey];

  // Sidebar always shows the plan/account header. Any loaded page can contain
  // it, so keep using cached shell data while the active page is still loading.
  const shellSource = resolveShellSource(pageData, activeData);
  const shellPlan = shellSource && shellSource.plan;
  const rawShellPlanId =
    (shellSource && shellSource.plan && shellSource.plan.id) ||
    (shellSource && shellSource.planId) ||
    (activeData && activeData.plan && activeData.plan.id) ||
    (activeData && activeData.planId) ||
    (selectedLauncherPlan && selectedLauncherPlan.id) ||
    null;
  const hasLiveApprovalStatus = Boolean(
    approvalStatusSnapshot &&
    (!rawShellPlanId || approvalStatusSnapshot.planId === rawShellPlanId)
  );
  const selectedLauncherPlanForShell = selectedLauncherPlan
    && (!rawShellPlanId || selectedLauncherPlan.id === rawShellPlanId)
    ? selectedLauncherPlan
    : null;
  const baseShellPlan = shellPlan
    ? { ...selectedLauncherPlanForShell, ...shellPlan }
    : selectedLauncherPlanForShell;
  const effectiveShellPlan = baseShellPlan
    ? {
        ...baseShellPlan,
        approvalStatus: hasLiveApprovalStatus
          ? approvalStatusSnapshot.approvalStatus
          : baseShellPlan.approvalStatus,
        isSubmitted: hasLiveApprovalStatus
          ? approvalStatusSnapshot.isSubmitted
          : baseShellPlan.isSubmitted,
      }
    : (hasLiveApprovalStatus
        ? {
            id: approvalStatusSnapshot.planId,
            approvalStatus: approvalStatusSnapshot.approvalStatus,
            isSubmitted: approvalStatusSnapshot.isSubmitted,
          }
        : null);
  const isPotentialAtc =
    selectedLauncherPlan?.isPotentialAtc ??
    effectiveShellPlan?.potentialAtc === true;
  const managerApprovalReviewPlan = effectiveShellPlan && managerApprovalReview
    ? { ...effectiveShellPlan, ...managerApprovalReview }
    : effectiveShellPlan;
  const effectiveShellSource = shellSource && effectiveShellPlan
    ? { ...shellSource, plan: effectiveShellPlan }
    : shellSource;
  const isMpdApprovalDisabled = isMpdApprovalRestrictedProfile(currentUserProfileName);
  const isCtamManager = isCtamManagerProfile(currentUserProfileName);
  //const isCtamManager = false;
  const canRecallApproval = !isMpdApprovalDisabled
    && !isCtamManager
    && isSubmittedOrReassignedApprovalStatus(effectiveShellPlan?.approvalStatus);
  const isReadOnly = isAccountPlanReadOnlyForProfile(effectiveShellPlan, currentUserProfileName);
  const shellPlanId =
    rawShellPlanId ||
    (approvalStatusSnapshot && approvalStatusSnapshot.planId) ||
    null;
  const activeLoadingLabel = activePage?.key === 'overview'
    ? 'Account Plan'
    : activePage?.label || 'Account Plan';
  const isDesktopView = runtimeViewSnapshot?.viewMode === 'desktop';
  const shouldShowAccountPlanLauncher = isDesktopView && !isDesktopPlanSelected;
  const shouldLoadAccountPlanPages = !shouldShowAccountPlanLauncher;

  const updateCachedPageData = (key, updater) => {
    setPageData((current) => {
      const existing = current[key] || {};
      const nextValue = typeof updater === 'function' ? updater(existing) : updater;
      return {
        ...current,
        [key]: { ...existing, ...nextValue },
      };
    });
  };

  const syncCriticalActivityAcrossCaches = (activity) => {
    if (!activity?.id) return;
    setPageData((current) => {
      let changed = false;
      const next = { ...current };
      for (const [key, field] of Object.entries(CRITICAL_ACTIVITY_CACHE_FIELDS)) {
        if (!current[key]) continue;
        if (activity.isDeleted === true) {
          const rows = current[key][field] || [];
          const filtered = rows.filter((row) => !row || row.id !== activity.id);
          if (filtered.length === rows.length) continue;
          next[key] = {
            ...current[key],
            [field]: filtered,
          };
          changed = true;
          continue;
        }
        next[key] = {
          ...current[key],
          [field]: mergeRecord(current[key][field], activity),
        };
        changed = true;
      }
      return changed ? next : current;
    });
  };

  const syncTeamMemberAcrossCaches = (member) => {
    if (!member?.id) return;
    setPageData((current) => {
      let changed = false;
      const next = { ...current };
      for (const [key, field] of Object.entries(TEAM_MEMBER_CACHE_FIELDS)) {
        if (!current[key]) continue;
        const rows = current[key][field] || [];
        const hasMember = rows.some((row) => row && row.id === member.id);
        const teamMembers = hasMember
          ? rows.map((row) => (row && row.id === member.id ? { ...row, ...member } : row))
          : [member, ...rows];
        next[key] = {
          ...current[key],
          [field]: sortTeamMembersByParticipation(teamMembers),
        };
        changed = true;
      }
      return changed ? next : current;
    });
  };

  const removeTeamMemberAcrossCaches = (memberId) => {
    if (!memberId) return;
    setPageData((current) => {
      let changed = false;
      const next = { ...current };
      for (const [key, field] of Object.entries(TEAM_MEMBER_CACHE_FIELDS)) {
        if (!current[key]) continue;
        const rows = current[key][field] || [];
        const teamMembers = rows.filter((row) => !row || row.id !== memberId);
        if (teamMembers.length === rows.length) continue;
        next[key] = {
          ...current[key],
          [field]: sortTeamMembersByParticipation(teamMembers),
        };
        changed = true;
      }
      return changed ? next : current;
    });
  };

  const clearCriticalActivityEditTarget = () => {
    setCriticalActivityToEditId(null);
    setCriticalActivityToEditTarget(null);
    setPendingCriticalActivityNavigation(false);
  };

  const resetAccountPlanWorkspace = () => {
    resetPageFilterState();
    loadedRef.current.clear();
    pageLoadPromisesRef.current.clear();
    preparedPptRef.current = null;
    preparedPdfRef.current = null;
    exportManualUrlRef.current = null;
    clearCriticalActivityEditTarget();
    setActiveKey('overview');
    setBarriersDriversTargetTab('barriers');
    setPageData({});
    setPageError({});
    setApprovalStatusSnapshot(null);
    setPptPrepareStatus('idle');
    setPdfPrepareStatus('idle');
    setExportNotice(null);
    setAppNotice(null);
    setIsApprovalHistoryOpen(false);
    setIsManagerApprovalReviewOpen(false);
    setIsRecallApprovalOpen(false);
    setRecallApprovalStatus('idle');
    setRecallApprovalError('');
    managerApprovalHistoryRequestRef.current += 1;
    managerApprovalReviewRequestRef.current += 1;
    if (managerApprovalReviewTimerRef.current) {
      window.clearTimeout(managerApprovalReviewTimerRef.current);
      managerApprovalReviewTimerRef.current = null;
    }
    setManagerApprovalHistory([]);
    setManagerApprovalHistoryStatus('idle');
    setManagerApprovalHistoryError('');
    setManagerApprovalReviewStatus('idle');
    setManagerApprovalReview(null);
    setManagerDecisionStatus('idle');
    setManagerDecisionError('');
  };

  const loadManagerApprovalReview = (planId) => {
    if (!planId) return Promise.resolve(null);
    const requestId = managerApprovalReviewRequestRef.current + 1;
    managerApprovalReviewRequestRef.current = requestId;
    setManagerApprovalReviewStatus('loading');
    return fetchAccountPlanApprovalReview(planId)
      .then((review) => {
        if (managerApprovalReviewRequestRef.current !== requestId) return null;
        setManagerApprovalReview(review);
        setSelectedLauncherPlan((current) => (
          current?.id === planId ? { ...current, ...review } : current
        ));
        setManagerApprovalReviewStatus('ready');
        return review;
      })
      .catch((error) => {
        if (managerApprovalReviewRequestRef.current !== requestId) return null;
        console.info('[manager-approval-review] load failed', error);
        setManagerApprovalReviewStatus('error');
        return null;
      });
  };

  const loadManagerApprovalReviewInBackground = (plan) => {
    if (!plan?.id) return;
    setManagerApprovalReviewStatus('loading');
    managerApprovalReviewTimerRef.current = window.setTimeout(() => {
      managerApprovalReviewTimerRef.current = null;
      loadManagerApprovalReview(plan.id);
    }, 0);
  };

  const handleSelectLauncherPlan = (plan) => {
    if (!plan?.id) return;
    setCurrentAccountPlanIdOverride(plan.id);
    resetAccountPlanWorkspace();
    //setSelectedLauncherPlan(plan);
    loadManagerApprovalReviewInBackground(plan);
    setPageStatus({ overview: 'loading' });
    setIsDesktopPlanSelected(true);
    setSelectedLauncherPlan({...plan,isPotentialAtc: plan?.potentialAtc === true,dryRunDate:plan?.dryRunDate??null});
   
  };

  const navigateToPage = (key) => {
    clearCriticalActivityEditTarget();
    setActiveKey(key);
  };

  const navigateToBarriersDrivers = (target) => {
    clearCriticalActivityEditTarget();
    const targetTab = target && target.type === 'Driver' ? 'drivers' : target;
    setBarriersDriversTargetTab(targetTab === 'drivers' ? 'drivers' : 'barriers');
    setActiveKey('barriers-drivers');
  };

  const navigateToCriticalActivity = (activity) => {
    const target = activity && typeof activity === 'object'
      ? {
          ...activity,
          id: activity.id || null,
          name: activity.name || null,
          dueDate: activity.dueDate || null,
        }
      : { id: activity || null, name: null, dueDate: null };
    setCriticalActivityToEditId(target.id);
    setCriticalActivityToEditTarget(target);
    setCriticalActivityEditRequest((request) => request + 1);
    setPendingCriticalActivityNavigation(true);
  };

  const clearAppNotice = () => {
    if (appNoticeTimerRef.current) {
      window.clearTimeout(appNoticeTimerRef.current);
      appNoticeTimerRef.current = null;
    }
    setAppNotice(null);
  };

  const loadPage = useCallback((key, { background = false, force = false } = {}) => {
    const page = PAGE_BY_KEY[key];
    if (!page || !page.loader) return Promise.resolve(null);
    const dataKey = pageDataKey(key);

    const existingRequest = pageLoadPromisesRef.current.get(dataKey);
    if (existingRequest && !force) return existingRequest;
    if (loadedRef.current.has(dataKey) && !force) return Promise.resolve(null);

    loadedRef.current.add(dataKey);
    setPageStatus((current) => {
      if (background && current[dataKey]) return current;
      return { ...current, [dataKey]: 'loading' };
    });

    const request = Promise
      .resolve()
      .then(() => page.loader())
      .then((data) => {
        if (pageLoadPromisesRef.current.get(dataKey) !== request) return data;
        setPageData((current) => ({ ...current, [dataKey]: data }));
        setPageStatus((current) => ({ ...current, [dataKey]: 'ready' }));
        setPageError((current) => {
          if (!Object.prototype.hasOwnProperty.call(current, dataKey)) return current;
          const next = { ...current };
          delete next[dataKey];
          return next;
        });
        return data;
      })
      .catch((error) => {
        if (pageLoadPromisesRef.current.get(dataKey) === request) {
          loadedRef.current.delete(dataKey);
          setPageError((current) => ({ ...current, [dataKey]: error }));
          setPageStatus((current) => ({ ...current, [dataKey]: 'error' }));
        }
        throw error;
      })
      .finally(() => {
        if (pageLoadPromisesRef.current.get(dataKey) === request) {
          pageLoadPromisesRef.current.delete(dataKey);
        }
      });

    pageLoadPromisesRef.current.set(dataKey, request);
    return request;
  }, []);

  const refreshApprovalStatus = useCallback(({ force = false } = {}) => {
    if (!shouldLoadAccountPlanPages) return Promise.resolve(null);

    const tracker = approvalStatusRefreshRef.current;
    const now = Date.now();

    if (tracker.inFlight) return tracker.inFlight;
    if (!force && now - tracker.lastCheckedAt < APPROVAL_STATUS_RESUME_THROTTLE_MS) {
      return Promise.resolve(null);
    }

    tracker.lastCheckedAt = now;
    const request = fetchPlanApprovalStatus(shellPlanId)
      .then((snapshot) => {
        if (!snapshot) return null;
        setApprovalStatusSnapshot((current) => {
          if (
            current &&
            current.planId === snapshot.planId &&
            current.approvalStatus === snapshot.approvalStatus &&
            current.isSubmitted === snapshot.isSubmitted &&
            current.lastModifiedDate === snapshot.lastModifiedDate
          ) {
            return current;
          }
          return snapshot;
        });
        return snapshot;
      })
      .catch((error) => {
        console.info('[approval-status] refresh failed', error);
        return null;
      })
      .finally(() => {
        if (tracker.inFlight === request) {
          tracker.inFlight = null;
        }
      });

    tracker.inFlight = request;
    return request;
  }, [shellPlanId, shouldLoadAccountPlanPages]);

  const refreshLoadedPages = (keys = Array.from(loadedRef.current)) => {
    resetPageFilterState();
    const pageKeys = Array.from(new Set(keys)).filter((key) => {
      const page = PAGE_BY_KEY[key];
      return loadedRef.current.has(key) && page && page.loader;
    });

    pageKeys.forEach((key) => {
      loadPage(key, { background: true, force: true })
        .catch((error) => {
          console.warn(`[page-refresh] ${key} refresh failed`, error);
        });
    });
  };

  const showAppNotice = ({ tone = 'success', title, detail, duration = 3600, refreshPages = false } = {}) => {
    if (!title) return;
    if (appNoticeTimerRef.current) {
      window.clearTimeout(appNoticeTimerRef.current);
      appNoticeTimerRef.current = null;
    }
    setAppNotice({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tone,
      title,
      detail,
    });
    if (duration > 0) {
      appNoticeTimerRef.current = window.setTimeout(() => {
        setAppNotice(null);
        appNoticeTimerRef.current = null;
      }, duration);
    }
    if (refreshPages) {
      refreshLoadedPages();
    }
  };

  const handleSubmitMpdApproval = () => {
    if (isReadOnly || isMpdApprovalDisabled) return;
    setMpdApprovalError('');
    setMpdApprovalStatus('idle');
    setIsMpdApprovalOpen(true);
  };

  const loadManagerApprovalHistory = () => {
    if (!shellPlanId) {
      setManagerApprovalHistory([]);
      setManagerApprovalHistoryStatus('error');
      setManagerApprovalHistoryError('Missing Account Plan id. Reopen the Account Plan and try again.');
      return Promise.resolve([]);
    }

    setManagerApprovalHistory([]);
    setManagerApprovalHistoryStatus('loading');
    setManagerApprovalHistoryError('');
    const requestId = managerApprovalHistoryRequestRef.current + 1;
    managerApprovalHistoryRequestRef.current = requestId;
    return fetchAccountPlanApprovalHistory(shellPlanId)
      .then((entries) => {
        if (managerApprovalHistoryRequestRef.current !== requestId) return entries;
        setManagerApprovalHistory(entries);
        setManagerApprovalHistoryStatus('ready');
        return entries;
      })
      .catch((error) => {
        if (managerApprovalHistoryRequestRef.current !== requestId) return [];
        setManagerApprovalHistory([]);
        setManagerApprovalHistoryStatus('error');
        setManagerApprovalHistoryError(error?.message || 'Unable to load approval history.');
        return [];
      });
  };

  const handleOpenApprovalHistory = () => {
    if (!isCtamManager) return;
    setAppNotice(null);
    setIsApprovalHistoryOpen(true);
    loadManagerApprovalHistory();
  };
const handleOpenApprovalHistoryForCtam = () => {
    if (isCtamManager) return;
    setAppNotice(null);
    setIsApprovalHistoryOpen(true);
    loadManagerApprovalHistory();
  };
  const handleOpenManagerApprovalReview = () => {
    if (!isCtamManager || !isSubmittedOrReassignedApprovalStatus(effectiveShellPlan?.approvalStatus)) return;
    setAppNotice(null);
    setManagerDecisionStatus('idle');
    setManagerDecisionError('');
    setIsManagerApprovalReviewOpen(true);
    loadManagerApprovalReview(shellPlanId);
    if (!isMockRuntime) {
      setManagerReassignUsersStatus('loading');
      fetchCtamManagerUsers()
        .then((users) => {
          setManagerReassignUsers(users);
          setManagerReassignUsersStatus('ready');
        })
        .catch((error) => {
          console.warn('[manager-reassign] unable to load eligible managers', error);
          setManagerReassignUsers([]);
          setManagerReassignUsersStatus('error');
        });
    }
  };

  const handleOpenRecallApproval = () => {
    if (!canRecallApproval) return;
    setRecallApprovalError('');
    setRecallApprovalStatus('idle');
    setIsRecallApprovalOpen(true);
  };

  const handleCloseRecallApproval = () => {
    if (recallApprovalStatus === 'recalling') return;
    setIsRecallApprovalOpen(false);
    setRecallApprovalError('');
  };

  const handleRecallApproval = async (comments) => {
    if (!shellPlanId) {
      setRecallApprovalError('Missing Account Plan id. Reopen the Account Plan and try again.');
      return;
    }

    setRecallApprovalStatus('recalling');
    setRecallApprovalError('');
    try {
      await recallAccountPlanApproval({ planId: shellPlanId, comments });
      setApprovalStatusSnapshot({
        planId: shellPlanId,
        approvalStatus: ACCOUNT_PLAN_RECALLED_STATUS,
        isSubmitted: false,
        lastModifiedDate: new Date().toISOString(),
      });
      setIsRecallApprovalOpen(false);
      showAppNotice({
        title: 'Account Plan recalled.',
        detail: 'The plan is editable again and the recall comment was saved.',
        refreshPages: true,
      });
      refreshApprovalStatus({ force: true });
    } catch (error) {
      setRecallApprovalError(error?.message || 'Unable to recall the Account Plan.');
    } finally {
      setRecallApprovalStatus('idle');
    }
  };

  const handleManagerApprovalDecision = async ({ action, comments, assigneeId }) => {
    if (!shellPlanId) {
      setManagerDecisionError('Missing Account Plan id. Reopen the Account Plan and try again.');
      return;
    }

    setManagerDecisionStatus('saving');
    setManagerDecisionError('');
    try {
      const result = await updateManagerApprovalStep({
        planId: shellPlanId,
        action,
        comments,
        assigneeId,
      });
      setManagerApprovalHistory([]);
      setManagerApprovalHistoryStatus('idle');
      setManagerApprovalHistoryError('');
      setSelectedLauncherPlan((current) => (
        current?.id === shellPlanId ? { ...current, approvalStep: result.approvalStep } : current
      ));
      setIsManagerApprovalReviewOpen(false);
      showAppNotice({
        title: `${action} decision saved.`,
        detail: `The latest Pending KPH_Account_Plan_Approval_History__c record was updated to "${result.approvalStatus}" with the manager comment.`,
        duration: 5200,
      });
    } catch (error) {
      setManagerDecisionError(error?.message || 'Unable to save the manager approval decision.');
    } finally {
      setManagerDecisionStatus('idle');
    }
  };

  const handleCloseMpdApproval = () => {
    if (mpdApprovalStatus === 'submitting') return;
    setIsMpdApprovalOpen(false);
    setMpdApprovalError('');
  };

  const handleSubmitMpdApprovalComment = async (comments) => {
    if (!shellPlanId) {
      const message = 'Missing account plan id. Reopen this MyInsights from an Account Plan record.';
      setMpdApprovalError(message);
      showAppNotice({
        tone: 'danger',
        title: 'Submit for MPD approval failed.',
        detail: message,
        duration: 5200,
      });
      return;
    }

    setMpdApprovalStatus('submitting');
    setMpdApprovalError('');

    try {
      await submitMpdApproval({ planId: shellPlanId, comments });
      setApprovalStatusSnapshot({
        planId: shellPlanId,
        approvalStatus: SUBMITTED_FOR_APPROVAL_STATUS,
        isSubmitted: true,
        lastModifiedDate: new Date().toISOString(),
      });
      setIsMpdApprovalOpen(false);
      showAppNotice({
        title: 'MPD approval submitted.',
        detail: 'The account plan was marked submitted and the approval comment was captured.',
        refreshPages: true,
      });
      refreshApprovalStatus({ force: true });
    } catch (error) {
      const message = error?.message || 'Unable to submit MPD approval.';
      setMpdApprovalError(message);
      if (error?.planSubmitted) {
        showAppNotice({
          tone: 'warning',
          title: 'Account plan marked submitted.',
          detail: 'The approval comment could not be saved. Review the popup error.',
          duration: 5200,
          refreshPages: true,
        });
      } else {
        showAppNotice({
          tone: 'danger',
          title: 'Submit for MPD approval failed.',
          detail: message,
          duration: 5200,
        });
      }
    } finally {
      setMpdApprovalStatus('idle');
    }
  };

  const handleOpenExecutiveSummary = () => {
    const requestId = ++executiveSummaryRequestRef.current;
    setIsExecutiveSummaryOpen(true);
    setExecutiveSummaryStatus('loading');
    setExecutiveSummaryError(null);

    loadAccountPlanPptData(pageData)
      .then((data) => {
        if (requestId !== executiveSummaryRequestRef.current) return;
        setExecutiveSummary(buildAccountPlanExecutiveSummary(data));
        setExecutiveSummaryStatus('ready');
      })
      .catch((error) => {
        if (requestId !== executiveSummaryRequestRef.current) return;
        console.error('[executive-summary] load failed', error);
        setExecutiveSummary(null);
        setExecutiveSummaryError(error);
        setExecutiveSummaryStatus('error');
      });
  };

  const handleCloseExecutiveSummary = () => {
    executiveSummaryRequestRef.current += 1;
    setIsExecutiveSummaryOpen(false);
  };

  const handleSaveExecutiveSummaryPdf = () => {
    handleExportPdf();
  };

  const showExportResult = (result, kind = 'PPT') => {
    if (result.manualUrl) {
      exportManualUrlRef.current = result.manualUrl;
    } else {
      exportManualUrlRef.current = null;
    }
    setExportNotice(null);
    return result;
  };

  const preparePptExport = async () => {
    const requestId = ++pptPrepareRequestRef.current;
    setPptPrepareStatus('preparing');

    try {
      const prepared = await prepareAccountPlanPpt({
        cachedPageData: pageData,
      });

      if (requestId === pptPrepareRequestRef.current) {
        preparedPptRef.current = prepared;
        setPptPrepareStatus('ready');
      }
      return prepared;
    } catch (error) {
      if (requestId === pptPrepareRequestRef.current) {
        preparedPptRef.current = null;
        setPptPrepareStatus('error');
      }
      throw error;
    }
  };

  const preparePdfExport = async () => {
    const requestId = ++pdfPrepareRequestRef.current;
    setPdfPrepareStatus('preparing');

    try {
      const prepared = await prepareAccountPlanPdf({
        cachedPageData: pageData,
      });

      if (requestId === pdfPrepareRequestRef.current) {
        preparedPdfRef.current = prepared;
        setPdfPrepareStatus('ready');
      }
      return prepared;
    } catch (error) {
      if (requestId === pdfPrepareRequestRef.current) {
        preparedPdfRef.current = null;
        setPdfPrepareStatus('error');
      }
      throw error;
    }
  };

  const deliverPreparedPptFromTap = (prepared) => {
    if (exportManualUrlRef.current) {
      URL.revokeObjectURL(exportManualUrlRef.current);
      exportManualUrlRef.current = null;
    }
    setIsExportingPpt(true);
    return deliverPreparedAccountPlanPpt(prepared, {
        directShare: true,
      })
      .then((result) => showExportResult(result, 'PPT'))
      .catch((error) => {
        console.error('[export] PPT delivery failed', error);
        setExportNotice({
          tone: 'danger',
          title: 'PPT open failed. Copy this error and send it.',
          detail: error?.stack || error?.message || String(error),
        });
      })
      .finally(() => {
        setIsExportingPpt(false);
      });
  };

  const deliverPreparedPdfFromTap = (prepared) => {
    if (exportManualUrlRef.current) {
      URL.revokeObjectURL(exportManualUrlRef.current);
      exportManualUrlRef.current = null;
    }
    setIsExportingPdf(true);
    return deliverPreparedAccountPlanPdf(prepared, {
        directShare: true,
      })
      .then((result) => showExportResult(result, 'PDF'))
      .catch((error) => {
        console.error('[export] PDF delivery failed', error);
        setExportNotice({
          tone: 'danger',
          title: 'PDF open failed. Copy this error and send it.',
          detail: error?.stack || error?.message || String(error),
        });
      })
      .finally(() => {
        setIsExportingPdf(false);
      });
  };

  const handleExportPpt = async () => {
    if (isExportingPpt) return;

    if (preparedPptRef.current) {
      deliverPreparedPptFromTap(preparedPptRef.current);
      return;
    }

    if (pptPrepareStatus === 'preparing') return;

    if (exportManualUrlRef.current) {
      URL.revokeObjectURL(exportManualUrlRef.current);
      exportManualUrlRef.current = null;
    }
    setIsExportingPpt(true);

    try {
      const prepared = await preparePptExport();
      preparedPptRef.current = prepared;
      await deliverPreparedPptFromTap(prepared);
    } catch (error) {
      console.error('[export] PPT generation failed', error);
      setExportNotice({
        tone: 'danger',
        title: 'PPT export failed. Copy this error and send it.',
        detail: error?.stack || error?.message || String(error),
      });
    } finally {
      setIsExportingPpt(false);
    }
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;

    if (preparedPdfRef.current) {
      deliverPreparedPdfFromTap(preparedPdfRef.current);
      return;
    }

    if (pdfPrepareStatus === 'preparing') return;

    if (exportManualUrlRef.current) {
      URL.revokeObjectURL(exportManualUrlRef.current);
      exportManualUrlRef.current = null;
    }
    setIsExportingPdf(true);

    try {
      const prepared = await preparePdfExport();
      preparedPdfRef.current = prepared;
      await deliverPreparedPdfFromTap(prepared);
    } catch (error) {
      console.error('[export] PDF generation failed', error);
      setExportNotice({
        tone: 'danger',
        title: 'PDF export failed. Copy this error and send it.',
        detail: error?.stack || error?.message || String(error),
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrepareExportMenuOpen = () => {
    if (pptPrepareStatus !== 'ready' && pptPrepareStatus !== 'preparing') {
      preparePptExport().catch((error) => {
        console.info('[export] PPT preparation on menu open failed.', error);
      });
    }
    if (pdfPrepareStatus !== 'ready' && pdfPrepareStatus !== 'preparing') {
      preparePdfExport().catch((error) => {
        console.info('[export] PDF preparation on menu open failed.', error);
      });
    }
  };

  const clearExportNotice = () => {
    if (exportManualUrlRef.current) {
      URL.revokeObjectURL(exportManualUrlRef.current);
      exportManualUrlRef.current = null;
    }
    setExportNotice(null);
  };

  useEffect(() => {
    if (!pendingCriticalActivityNavigation) return;
    setActiveKey('critical-activities');
    setPendingCriticalActivityNavigation(false);
  }, [pendingCriticalActivityNavigation, criticalActivityToEditTarget, criticalActivityEditRequest]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCurrentUserProfileName(), getCurrentUserUsername()])
      .then(([profileName, username]) => {
        if (cancelled) return;
        setCurrentUserProfileName(profileName || null);
        setCurrentUserUsername(username || null);
      })
      .catch((error) => {
        console.info('[current-user] unable to resolve profile or username', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isMpdApprovalDisabled) return;
    setIsMpdApprovalOpen(false);
    setMpdApprovalError('');
  }, [isMpdApprovalDisabled]);

  useEffect(() => {
    refreshApprovalStatus({ force: true });
  }, [activeKey, refreshApprovalStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    refreshApprovalStatus({ force: true });
    const intervalId = window.setInterval(() => {
      refreshApprovalStatus();
    }, APPROVAL_STATUS_REFRESH_MS);

    const handleResume = () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState &&
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      refreshApprovalStatus({ force: true });
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleResume);
    }
    window.addEventListener('focus', handleResume);
    window.addEventListener('pageshow', handleResume);

    return () => {
      window.clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleResume);
      }
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('pageshow', handleResume);
    };
  }, [refreshApprovalStatus]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return undefined;

    const updateModalState = () => {
      setHasModalOpen(Boolean(document.querySelector(
        '.stakeholder-edit-overlay, .modal-scrim, .critical-activity-confirm-scrim'
      )));
    };

    updateModalState();
    const observer = new MutationObserver(updateModalState);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateRuntimeView = () => {
      const nextSnapshot = getRuntimeViewSnapshot();
      setRuntimeViewSnapshot(nextSnapshot);
      if (nextSnapshot.viewMode !== 'desktop') {
        setIsDesktopPlanSelected(true);
        setPageStatus((current) => (
          Object.keys(current).length ? current : { overview: 'loading' }
        ));
      }
    };

    window.addEventListener('resize', updateRuntimeView);
    window.addEventListener('orientationchange', updateRuntimeView);
    return () => {
      window.removeEventListener('resize', updateRuntimeView);
      window.removeEventListener('orientationchange', updateRuntimeView);
    };
  }, []);

  useEffect(() => () => {
    if (exportManualUrlRef.current) {
      URL.revokeObjectURL(exportManualUrlRef.current);
      exportManualUrlRef.current = null;
    }
    if (appNoticeTimerRef.current) {
      window.clearTimeout(appNoticeTimerRef.current);
      appNoticeTimerRef.current = null;
    }
    if (managerApprovalReviewTimerRef.current) {
      window.clearTimeout(managerApprovalReviewTimerRef.current);
      managerApprovalReviewTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!Object.keys(pageData).length) return undefined;

    let isCurrent = true;
    let idleId = null;
    preparedPptRef.current = null;
    preparedPdfRef.current = null;
    setPptPrepareStatus('idle');
    setPdfPrepareStatus('idle');

    const timeoutId = window.setTimeout(() => {
      const prepareExports = () => {
        if (!isCurrent) return;
        const requestId = ++pptPrepareRequestRef.current;
        const pdfRequestId = ++pdfPrepareRequestRef.current;

        setPptPrepareStatus('preparing');
        setPdfPrepareStatus('preparing');

        prepareAccountPlanPpt({ cachedPageData: pageData })
          .then((prepared) => {
            if (!isCurrent || requestId !== pptPrepareRequestRef.current) return;
            preparedPptRef.current = prepared;
            setPptPrepareStatus('ready');
          })
          .catch((error) => {
            if (!isCurrent || requestId !== pptPrepareRequestRef.current) return;
            preparedPptRef.current = null;
            setPptPrepareStatus('error');
            console.info('[export] Background PPT preparation failed.', error);
          });

        prepareAccountPlanPdf({ cachedPageData: pageData })
          .then((prepared) => {
            if (!isCurrent || pdfRequestId !== pdfPrepareRequestRef.current) return;
            preparedPdfRef.current = prepared;
            setPdfPrepareStatus('ready');
          })
          .catch((error) => {
            if (!isCurrent || pdfRequestId !== pdfPrepareRequestRef.current) return;
            preparedPdfRef.current = null;
            setPdfPrepareStatus('error');
            console.info('[export] Background PDF preparation failed.', error);
          });
      };

      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(prepareExports, {
          timeout: EXPORT_PREPARE_IDLE_TIMEOUT_MS,
        });
        return;
      }

      prepareExports();
    }, EXPORT_PREPARE_IDLE_DELAY_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [pageData]);

  useEffect(() => {
    if (!shouldLoadAccountPlanPages) return;
    if (!activePage || !activePage.loader) return;
    const hasInFlightActivePage = pageLoadPromisesRef.current.has(activeDataKey);
    const hasCachedActivePage = loadedRef.current.has(activeDataKey) && !hasInFlightActivePage;
    loadPage(activeKey, {
      background: hasCachedActivePage || hasInFlightActivePage,
      force: hasCachedActivePage,
    }).catch(() => {});
  }, [activeKey, activeDataKey, activePage, loadPage, shouldLoadAccountPlanPages]);

  useEffect(() => {
    if (!shouldLoadAccountPlanPages) return undefined;
    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      const seenDataKeys = new Set();
      STARTUP_PRELOAD_PAGE_KEYS.forEach((key) => {
        const page = PAGE_BY_KEY[key];
        const dataKey = pageDataKey(key);
        if (
          !page?.implemented ||
          !page.loader ||
          loadedRef.current.has(dataKey) ||
          seenDataKeys.has(dataKey)
        ) {
          return;
        }
        seenDataKeys.add(dataKey);
        loadPage(page.key, { background: true })
          .catch((error) => {
            if (!cancelled) {
              console.info(`[startup-page-preload] ${page.key} preload failed`, error);
            }
          });
      });
    }, STARTUP_PRELOAD_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [loadPage, shouldLoadAccountPlanPages]);

  useEffect(() => {
    if (!shouldLoadAccountPlanPages) return undefined;
    if (pageStatus.overview !== 'ready') return undefined;
    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      const preloadPages = async () => {
        const seenDataKeys = new Set([pageDataKey(activeKey)]);
        const preloadTargets = PAGES.filter((page) => {
          const dataKey = pageDataKey(page.key);
          if (
            !page.implemented ||
            !page.loader ||
            loadedRef.current.has(dataKey) ||
            seenDataKeys.has(dataKey)
          ) {
            return false;
          }
          seenDataKeys.add(dataKey);
          return true;
        });
        await Promise.all(preloadTargets.map((page) =>
          loadPage(page.key, { background: true })
            .catch((error) => {
              if (!cancelled) {
                console.info(`[page-preload] ${page.key} preload failed`, error);
              }
            })
        ));
      };

      preloadPages();
    }, NAVIGATION_PRELOAD_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeKey, pageStatus.overview, loadPage, shouldLoadAccountPlanPages]);

  if (shouldShowAccountPlanLauncher) {
    return (
      <div className="account-plan-launcher-frame">
        <AccountPlanLauncher
          onSelectPlan={handleSelectLauncherPlan}
          isCtamManager={isCtamManager}
        />
      </div>
    );
  }

  return (
    <PotentialAtcContext.Provider value={isPotentialAtc === true}>
      <AccountPhaseContext.Provider value={selectedLauncherPlan?.currentPhase ?? effectiveShellPlan?.accountPhase ?? null}>
          <DryRunDateContext.Provider value={selectedLauncherPlan?.dryRunDate ?? effectiveShellPlan?.dryRunDate ?? null}>
        <div className={`shell shell-frame${hasModalOpen ? ' modal-open' : ''}`}>
          <Sidebar
            pages={PAGES}
            activeKey={activeKey}
            onNavigate={navigateToPage}
            onPreloadPage={(key) => loadPage(key, { background: true })}
            onExportPpt={handleExportPpt}
            onExportPdf={handleExportPdf}
            onExecutiveSummary={handleOpenExecutiveSummary}
            legacyAccountPlanId={isDesktopView ? shellPlanId : null}
            currentUserUsername={currentUserUsername}
            onPrepareExports={handlePrepareExportMenuOpen}
            onSubmitMpdApproval={handleSubmitMpdApproval}
            onRecallApproval={handleOpenRecallApproval}
            onApprovalHistory={handleOpenApprovalHistory}
            onReviewApproval={handleOpenManagerApprovalReview}
            onApprovalHistoryForCtam= {handleOpenApprovalHistoryForCtam}
            isMpdApprovalDisabled={isMpdApprovalDisabled}
            isCtamManager={isCtamManager}
            canRecallApproval={canRecallApproval}
            isReadOnly={isReadOnly}
            isExportingPpt={isExportingPpt}
            isExportingPdf={isExportingPdf}
            isPreparingPpt={pptPrepareStatus === 'preparing'}
            isPreparingPdf={pdfPrepareStatus === 'preparing'}
            plan={effectiveShellSource && effectiveShellSource.plan}
            account={effectiveShellSource && effectiveShellSource.account}
          />

          {appNotice && (
            <div
              className={`app-notice-toast ${appNotice.tone}`}
              role={appNotice.tone === 'danger' ? 'alert' : 'status'}
              aria-live={appNotice.tone === 'danger' ? 'assertive' : 'polite'}
            >
              <div className="app-notice-copy">
                <strong>{appNotice.title}</strong>
                {appNotice.detail && <span>{appNotice.detail}</span>}
              </div>
              <button type="button" onClick={clearAppNotice} aria-label="Dismiss notification">
                x
              </button>
            </div>
          )}

          <section className={`shell-main shell-main-${activeKey}`}>
            {isMockRuntime && (
              <div className="status-banner info">
                Running with mock data (no Veeva runtime detected).
              </div>
            )}

            {exportNotice?.tone === 'danger' && (
              <div className="status-banner export-debug-banner danger">
                <div className="export-debug-head">
                  <strong>{exportNotice.title}</strong>
                  <button type="button" onClick={clearExportNotice}>Dismiss</button>
                </div>
                {exportNotice.detail && <pre>{exportNotice.detail}</pre>}
              </div>
            )}

            {activeStatus === 'error' && isMissingAccountPlanContextError(activeError) && (
              <div className="account-plan-context-empty" role="status">
                <strong>We couldn't find the selected Account Plan.</strong>
                <span>Go back to Account Plans and open the plan again. If the page still does not load, refresh this tab.</span>
              </div>
            )}

            {activeStatus === 'error' && !isMissingAccountPlanContextError(activeError) && (
              <div className="status-banner danger">
                <strong>Failed to load page.</strong>{' '}
                {activeError && activeError.message}
              </div>
            )}

            <main className="shell-body">
              {activeStatus === 'loading' && (
                <LoadingScreen label={activeLoadingLabel} />
              )}

              {activeStatus === 'ready' && activeKey === 'overview' && (
                <Overview
                  data={activeData}
                  
                  onDataChange={(updater) => updateCachedPageData('overview', updater)}
                  onActivityChange={syncCriticalActivityAcrossCaches}
                  onMemberChange={syncTeamMemberAcrossCaches}
                  onMemberDelete={removeTeamMemberAcrossCaches}
                  onOpenBarriersDrivers={navigateToBarriersDrivers}
                  onOpenCriticalActivity={navigateToCriticalActivity}
                  onNotify={showAppNotice}
                  isReadOnly={isReadOnly}
                />
              )}

              {activeStatus === 'ready' && activeKey === 'barriers-drivers' && (
                <BarriersDrivers
                  data={activeData}
                  initialTab={barriersDriversTargetTab}
                  onActivityChange={syncCriticalActivityAcrossCaches}
                  onNotify={showAppNotice}
                  isReadOnly={isReadOnly}
                />
              )}

              {activeStatus === 'ready' && activeKey === 'kpi' && (
                <AccountProfile data={activeData} initialTab="account-intelligence" onNotify={showAppNotice} isReadOnly={isReadOnly} />
              )}

              {activeStatus === 'ready' && activeKey === 'account-insights' && (
                <AccountProfile data={activeData} initialTab="account-insights" onNotify={showAppNotice} isReadOnly={isReadOnly}/>
              )}

              {activeStatus === 'ready' && activeKey === 'stakeholders' && (
                <Stakeholders data={activeData} onNotify={showAppNotice} isReadOnly={isReadOnly} />
              )}

              {activeStatus === 'ready' && activeKey === 'team-members' && (
                <TeamMembers
                  data={activeData}
                  onMemberChange={syncTeamMemberAcrossCaches}
                  onMemberDelete={removeTeamMemberAcrossCaches}
                  onNotify={showAppNotice}
                  isReadOnly={isReadOnly}
                  currentUserUsername={currentUserUsername}
                />
              )}

              {activeStatus === 'ready' && activeKey === 'critical-activities' && (
                <CriticalActivities
                  data={activeData}
                  initialEditActivityId={criticalActivityToEditId}
                  initialEditActivity={criticalActivityToEditTarget}
                  initialEditRequest={criticalActivityEditRequest}
                  onActivityChange={syncCriticalActivityAcrossCaches}
                  onNotify={showAppNotice}
                  isReadOnly={isReadOnly}
                />
              )}

              {activeStatus === 'ready' && activeKey === 'linked-opportunities' && (
                <CrossFunctionalPlan data={activeData} onNotify={showAppNotice} isReadOnly={isReadOnly} />
              )}

              {activeStatus === 'ready' && activePage?.loader && !activePage?.implemented && (
                <div className="empty-state">
                  <strong>Coming soon.</strong>
                  <div>This page hasn't been ported yet.</div>
                </div>
              )}
            </main>
          </section>

          {isExecutiveSummaryOpen && (
            <ExecutiveSummaryModal
              summary={executiveSummary}
              status={executiveSummaryStatus}
              error={executiveSummaryError}
              onClose={handleCloseExecutiveSummary}
              onSavePdf={handleSaveExecutiveSummaryPdf}
              isSavingPdf={isExportingPdf || pdfPrepareStatus === 'preparing'}
            />
          )}

          {isMpdApprovalOpen && (
            <SubmitMpdApprovalModal
              isSubmitting={mpdApprovalStatus === 'submitting'}
              error={mpdApprovalError}
              onClose={handleCloseMpdApproval}
              onSubmit={handleSubmitMpdApprovalComment}
            />
          )}

          {isRecallApprovalOpen && (
            <RecallApprovalModal
              planName={effectiveShellPlan?.name || 'Account Plan'}
              isRecalling={recallApprovalStatus === 'recalling'}
              error={recallApprovalError}
              onClose={handleCloseRecallApproval}
              onRecall={handleRecallApproval}
            />
          )}

          {isApprovalHistoryOpen && (
            <ApprovalHistoryModal
              plan={effectiveShellPlan}
              entries={managerApprovalHistory}
              status={managerApprovalHistoryStatus}
              error={managerApprovalHistoryError}
              onRetry={loadManagerApprovalHistory}
              onClose={() => setIsApprovalHistoryOpen(false)}
            />
          )}

          {isManagerApprovalReviewOpen && (
            <ManagerApprovalReviewModal
              plan={managerApprovalReviewPlan}
              refreshStatus={managerApprovalReviewStatus}
              reassignUsers={managerReassignUsers}
              reassignUsersStatus={managerReassignUsersStatus}
              isSaving={managerDecisionStatus === 'saving'}
              error={managerDecisionError}
              onClearError={() => setManagerDecisionError('')}
              onClose={() => {
                if (managerDecisionStatus === 'saving') return;
                setIsManagerApprovalReviewOpen(false);
                setManagerDecisionError('');
              }}
              onDecision={handleManagerApprovalDecision}
              onReassign={({ assignee, comments }) => handleManagerApprovalDecision({
                action: 'Reassigned',
                comments,
                assigneeId: assignee.id,
              })}
            />
          )}

        </div>
        </DryRunDateContext.Provider>
      </AccountPhaseContext.Provider>
    </PotentialAtcContext.Provider>
  );
}

export default function App() {
  return (
      <PageFilterStateProvider>
        <AppContent />
      </PageFilterStateProvider>
  );
  
}
