import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activityStatusLabel,
  formatDateLabel,
  statusTone,
  truncateDisplay,
} from '@/lib/helper/utils';
import {
  addCriticalActivity,
  deleteCriticalActivity,
  saveBarrierDriverStatus,
  saveCriticalActivity,
} from '@/lib/dataservice/accountPlan/criticalActivities';
import { formatCriticalActivitySaveError } from '@/lib/dataservice/accountPlan/errorMessages';
import {
  isClosedBarrierDriverStatus,
  normalizeBarrierDriverStatusForDisplay,
} from '@/lib/dataservice/accountPlan/shared';
import CriticalActivityEditModal from '@/pages/CriticalActivities/CriticalActivityEditModal';
import CriticalActivityNewModal from '@/pages/CriticalActivities/CriticalActivityNewModal';
import { usePageFilterState } from '@/lib/ui/pageFilterState';
import {
  criticalActivityClosedParentEditReason,
  isOpenBarrierDriverOption,
  mergeBarrierDriverOptionsWithActivityParents,
} from '@/pages/CriticalActivities/linkedBarrierDriverOptions';
import {
  buildLinkedBarrierDriverStatusPrompt,
  isCompletedActivityStatusValue,
  linkedBarrierDriverCloseBlockedMessage,
  LinkedBarrierDriverStatusConfirmModal,
  LinkedBarrierDriverStatusPromptModal,
  mergeBarrierDriverStatusOptions,
} from '@/pages/CriticalActivities/LinkedBarrierDriverStatusPrompt';
import '@/styles/edit-modal.css';

// Filter dropdown options: "All" + every distinct non-empty value of `key`
// on the activities array, in insertion order.
const optionsFor = (activities, key, base = []) => {
  const seen = new Set();
  const out = ['All'];
  for (const v of base || []) {
    if (!v || v === 'All' || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  for (const a of activities || []) {
    const v = a && a[key];
    if (!v || v === 'All' || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

const valueOptionsFor = (activities, key, base = []) =>
  optionsFor(activities, key, base).filter((option) => option !== 'All');

const matchesFilters = (activity, filters) => {
  if (filters.accountable !== 'All' && (activity.ownerLabel || 'Unassigned') !== filters.accountable) return false;
  if (filters.parent !== 'All' && (activity.parentName || 'Plan-level') !== filters.parent) return false;
  if (filters.indication !== 'All' && (activity.indication || '-') !== filters.indication) return false;
  return true;
};

const activityStatusKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const statusKey = (activity) => activityStatusKey(activity && activity.status);

const DEFAULT_FILTERS = { accountable: 'All', parent: 'All', indication: 'All' };
const OPEN_STATUS_KEYS = new Set(['open', 'planned', 'in progress']);
const COMPLETED_STATUS_KEYS = new Set(['complete', 'completed', 'closed']);
const ACTIVITY_COMMENTS_FIELD = 'KPH_Comments__c';
const ACTIVITY_DEACTIVATE_FIELD = 'KPH_Inactive__c';
const TITLE_DISPLAY_LIMIT = 55;

const DEFAULT_SECTIONS = [
  {
    key: 'open',
    title: 'Open and Planned Critical Activities',
    emptyMessage: 'No open or planned critical activities match the current filters.',
  },
  {
    key: 'completed',
    title: 'Completed Critical Activities in the Last 90 Days',
    emptyMessage: 'No completed critical activities in the last 90 days match the current filters.',
  },
];

const COLUMNS = [
  { key: 'name', label: 'Critical Activity Title' },
  { key: 'related', label: 'Linked Barrier/Driver' },
  { key: 'indication', label: 'Indication' },
  { key: 'status', label: 'Status' },
  { key: 'accountable', label: 'Accountable' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'lastModifiedDate', label: 'Last Mod' },
];

const parseSortDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const isOpenActivity = (activity) =>
  activity && activity.isDeactivated !== true && OPEN_STATUS_KEYS.has(statusKey(activity));

const isCompletedRecently = (activity) => {
  if (!activity || activity.isDeactivated === true || !COMPLETED_STATUS_KEYS.has(statusKey(activity))) return false;
  const ref = activity.completedDate || activity.lastModifiedDate;
  const when = parseSortDate(ref);
  if (!when) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 90);
  return when >= cutoff.getTime();
};

const matchesKpiFilter = (activity, kpiFilter) => {
  if (!kpiFilter || kpiFilter === 'all') return true;
  const key = statusKey(activity);
  if (kpiFilter === 'planned') return key === 'planned';
  if (kpiFilter === 'inProgress') return key === 'in progress';
  if (kpiFilter === 'completed') return COMPLETED_STATUS_KEYS.has(key);
  return true;
};

const storedStatusFromForm = (status) => (status === 'Completed' ? 'Complete' : status || 'Planned');
const isDeactivateChecked = (value) =>
  value === true || ['true', 'yes', '1'].includes(String(value || '').trim().toLowerCase());

const applyActivityForm = (activity, form, saveResult, barrierLookup) => {
  const status = storedStatusFromForm(form.status);
  const isComplete = isCompletedActivityStatusValue(status);
  const omittedFields = new Set((saveResult && saveResult.omittedOptionalFields) || []);
  const hasDeactivateField = Object.prototype.hasOwnProperty.call(form, 'deactivate');
  const hasParentField = Object.prototype.hasOwnProperty.call(form, 'parentId');
  const parent = hasParentField && form.parentId ? barrierLookup?.get(form.parentId) : null;
  const savedComments =
    activity.canEditComments !== false && !omittedFields.has(ACTIVITY_COMMENTS_FIELD);
  const hasCommentsField = Object.prototype.hasOwnProperty.call(form, 'comments');
  const savedDeactivate =
    activity.canDeactivate !== false && !omittedFields.has(ACTIVITY_DEACTIVATE_FIELD);
  return {
    ...activity,
    name: String(form.title || '').trim(),
    details: String(form.details || '').trim(),
    indication: form.indication || '',
    status,
    ownerLabel: form.accountable || '',
    comments: savedComments && hasCommentsField ? (form.comments || '') : (activity.comments || ''),
    dueDate: form.dueDate || null,
    completedDate: isComplete ? (form.completedDate || activity.completedDate || todayIsoDate()) : null,
    isDeactivated: savedDeactivate && hasDeactivateField
      ? isDeactivateChecked(form.deactivate)
      : activity.isDeactivated === true,
    canEditComments: savedComments,
    canDeactivate: savedDeactivate,
    ...(hasParentField
      ? {
          barrierDriverId: form.parentId || null,
          parentName: parent ? parent.name : (form.parentId ? 'Linked record unavailable' : 'Plan-level'),
          parentType: parent ? parent.type : (form.parentType || null),
          parentRecordTypeId: parent ? (parent.recordTypeId || null) : (form.parentRecordTypeId || null),
        }
      : {}),
    lastModifiedDate: new Date().toISOString(),
  };
};

const applyActivityDeactivate = (activity, saveResult) => {
  const omittedFields = new Set((saveResult && saveResult.omittedOptionalFields) || []);
  const savedDeactivate =
    activity.canDeactivate !== false && !omittedFields.has(ACTIVITY_DEACTIVATE_FIELD);
  return {
    ...activity,
    isDeactivated: savedDeactivate ? true : activity.isDeactivated === true,
    canDeactivate: savedDeactivate,
    lastModifiedDate: new Date().toISOString(),
  };
};

const recordValue = (value) =>
  value && typeof value === 'object' && 'value' in value ? value.value : value;

const createdActivityId = (result) =>
  recordValue(result && result.data && (result.data.id || result.data.Id)) ||
  recordValue(result && (result.id || result.Id || result.recordId)) ||
  `new-${Date.now()}`;

const buildCreatedActivityRow = (planId, form, result, barrierLookup) => {
  const parent = form.parentId ? barrierLookup.get(form.parentId) : null;
  return applyActivityForm(
    {
      id: createdActivityId(result),
      planId,
      parentName: parent ? parent.name : (form.parentId ? 'Linked record unavailable' : 'Plan-level'),
      parentType: parent ? parent.type : (form.parentType || null),
      parentRecordTypeId: parent ? (parent.recordTypeId || null) : (form.parentRecordTypeId || null),
      barrierDriverId: form.parentId || null,
      completedDate: null,
      isDeactivated: false,
      canEditComments: true,
      canDeactivate: true,
    },
    form,
    result,
    barrierLookup
  );
};

const sortValue = (activity, key) => {
  switch (key) {
    case 'name':
      return activity.name || 'Untitled';
    case 'related':
      return activity.parentName || 'Plan-level';
    case 'indication':
      return activity.indication || '-';
    case 'status':
      return activityStatusLabel(activity);
    case 'accountable':
      return activity.ownerLabel || 'Unassigned';
    case 'dueDate':
      return parseSortDate(activity.dueDate);
    case 'lastModifiedDate':
      return parseSortDate(activity.lastModifiedDate);
    default:
      return '';
  }
};

const compareSortValues = (left, right, direction) => {
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  const result =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'desc' ? result * -1 : result;
};

const sortedRows = (rows, sort) => {
  if (!sort || !sort.key) return rows || [];
  return (rows || [])
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const result = compareSortValues(sortValue(a.row, sort.key), sortValue(b.row, sort.key), sort.direction);
      return result || a.index - b.index;
    })
    .map(({ row }) => row);
};

function Section({ section, sort, onSort, onEditActivity, sectionRef, isReadOnly = false }) {
  const visible = useMemo(() => sortedRows(section.rows || [], sort), [section.rows, sort]);
  return (
    <section className="critical-activity-table-section" ref={sectionRef}>
      <div className="critical-activity-table-title">
        <h4>{section.title}</h4>
      </div>
      <div className="bd-record-table activities-table">
        <div className="bd-record-head">
          {COLUMNS.map((col) => (
            <span key={col.key} className={`activity-head-cell activity-head-${col.key}`}>
              <button
                type="button"
                className="activity-sort-button"
                onClick={() => onSort(section.key, col.key)}
                aria-label={`Sort ${section.title} by ${col.label}`}
              >
                <strong className="activity-sort-label">{col.label}</strong>
                <i
                  className={`activity-sort-arrow ${sort && sort.key === col.key ? sort.direction : ''}`}
                  aria-hidden="true"
                />
              </button>
            </span>
          ))}
          <span className="activity-head-cell activity-action-head" aria-hidden="true" />
        </div>
        {visible.map((a) => (
          <div key={a.id} className="bd-record-row-flat critical-activity-row">
            {/* Hard 55-char cap on the title. Anything past it gets
                truncated to "…" so the row never exceeds the layout
                budget. */}
            <strong className="activity-cell activity-title-cell" data-label="Critical Activity Title" title={a.name || ''}>
              <span className="activity-cell-clamp">
                {truncateDisplay(a.name || 'Untitled', TITLE_DISPLAY_LIMIT)}
              </span>
            </strong>
            <span className="activity-cell activity-related-cell" data-label="Linked Barrier/Driver" title={a.parentName || ''}>
              <span className="activity-cell-clamp">
                {truncateDisplay(a.parentName || 'Plan-level', TITLE_DISPLAY_LIMIT)}
              </span>
            </span>
            <span className="activity-cell activity-indication-cell" data-label="Indication">{a.indication || '-'}</span>
            <span className="activity-cell activity-status-cell" data-label="Status">
              <em className={`pill ${statusTone(a.status)}`}>{activityStatusLabel(a)}</em>
            </span>
            <span className="activity-cell activity-accountable-cell" data-label="Accountable">{a.ownerLabel || 'Unassigned'}</span>
            <span className="activity-cell activity-due-cell" data-label="Due Date">{formatDateLabel(a.dueDate, 'Not entered')}</span>
            <span className="activity-cell activity-modified-cell" data-label="Last Modified">{formatDateLabel(a.lastModifiedDate, 'Not entered')}</span>
            <span className="activity-cell stakeholder-row-actions activity-row-actions activity-action-cell">
              <button
                type="button"
                className="stakeholder-edit-button"
                onClick={() => onEditActivity(a)}
                disabled={isReadOnly || !a.id}
                aria-label={`Edit ${a.name || 'critical activity'}`}
                title={a.editDisabledReason ? 'Open critical activity' : 'Edit'}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            </span>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="empty-state small">{section.emptyMessage}</div>
        )}
      </div>
    </section>
  );
}

export default function CriticalActivities({
  data,
  initialEditActivityId,
  initialEditActivity,
  initialEditRequest = 0,
  onActivityChange,
  onNotify,
  isReadOnly = false,
}) {
  const planId = data.planId;
  const activities = data.activities || [];
  const sections = data.sections || [];
  const loadedBarrierDriverOptions = data.barrierDriverOptions || [];
  const picklists = data.picklists || {};
  const [activityRows, setActivityRows] = useState(() => activities);
  const [barrierDriverStatusOverrides, setBarrierDriverStatusOverrides] = useState({});
  const [filters, setFilters] = usePageFilterState('critical-activities', DEFAULT_FILTERS);
  const [activeKpiFilter, setActiveKpiFilter] = usePageFilterState('critical-activities-kpi', 'all');
  const [sorts, setSorts] = useState({});
  const [editingActivity, setEditingActivity] = useState(null);
  const [isNewActivityOpen, setIsNewActivityOpen] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);
  const [pendingBarrierDriverStatusConfirm, setPendingBarrierDriverStatusConfirm] = useState(null);
  const [pendingBarrierDriverStatusPrompt, setPendingBarrierDriverStatusPrompt] = useState(null);
  const [barrierDriverStatusPromptValue, setBarrierDriverStatusPromptValue] = useState('');
  const [barrierDriverStatusPromptError, setBarrierDriverStatusPromptError] = useState('');
  const [isSavingBarrierDriverStatus, setIsSavingBarrierDriverStatus] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [createError, setCreateError] = useState('');
  const openedInitialEditRef = useRef(null);
  const completedSectionRef = useRef(null);

  const barrierDriverOptions = useMemo(
    () => {
      const optionsWithOverrides = (loadedBarrierDriverOptions || []).map((option) => {
        const statusOverride = option?.id ? barrierDriverStatusOverrides[option.id] : null;
        return statusOverride ? { ...option, status: statusOverride } : option;
      });
      return mergeBarrierDriverOptionsWithActivityParents(optionsWithOverrides, activityRows);
    },
    [activityRows, barrierDriverStatusOverrides, loadedBarrierDriverOptions]
  );

  const initialEditTarget = initialEditActivity || { id: initialEditActivityId };
  const initialEditTargetId = initialEditTarget.id || initialEditActivityId;
  const initialEditTargetName = initialEditTarget.name || '';
  const initialEditTargetDueDate = initialEditTarget.dueDate || '';
  const hasInitialEditTarget = Boolean(initialEditTargetId || initialEditTargetName);

  const activeActivities = useMemo(
    () => activityRows.filter((activity) => activity && activity.isDeactivated !== true),
    [activityRows]
  );
  const openBarrierDriverOptions = useMemo(
    () => (barrierDriverOptions || []).filter(isOpenBarrierDriverOption),
    [barrierDriverOptions]
  );
  const barrierDriverLookup = useMemo(
    () => new Map((barrierDriverOptions || []).map((option) => [option.id, option])),
    [barrierDriverOptions]
  );
  const openBarrierDriverLookup = useMemo(
    () => new Map(openBarrierDriverOptions.map((option) => [option.id, option])),
    [openBarrierDriverOptions]
  );
  const closedParentEditReason = useCallback(
    (activity) =>
      criticalActivityClosedParentEditReason(
        activity,
        activity?.barrierDriverId ? barrierDriverLookup.get(activity.barrierDriverId) : null
      ),
    [barrierDriverLookup]
  );

  useEffect(() => {
    setBarrierDriverStatusOverrides({});
    setPendingBarrierDriverStatusConfirm(null);
    setPendingBarrierDriverStatusPrompt(null);
    setBarrierDriverStatusPromptValue('');
    setBarrierDriverStatusPromptError('');
  }, [planId]);

  useEffect(() => {
    setActivityRows(activities);
    if (!hasInitialEditTarget) {
      setEditingActivity(null);
      setIsNewActivityOpen(false);
      setSaveError('');
    }
    setCreateError('');
  }, [activities, hasInitialEditTarget]);

  useEffect(() => {
    if (!isReadOnly) return;
    setEditingActivity(null);
    setIsNewActivityOpen(false);
    setPendingBarrierDriverStatusConfirm(null);
    setPendingBarrierDriverStatusPrompt(null);
  }, [isReadOnly]);

  useEffect(() => {
    if (isReadOnly) return;
    const requestKey = `${initialEditTargetId || initialEditTargetName || ''}:${initialEditTargetDueDate}:${initialEditRequest}`;
    if (!hasInitialEditTarget || openedInitialEditRef.current === requestKey) return;
    const activity =
      activityRows.find((row) => row && initialEditTargetId && row.id === initialEditTargetId) ||
      activityRows.find((row) =>
        row &&
        initialEditTargetName &&
        row.name === initialEditTargetName &&
        (!initialEditTargetDueDate || row.dueDate === initialEditTargetDueDate)
      ) ||
      (initialEditActivity && hasInitialEditTarget ? initialEditActivity : null);
    if (!activity) return;
    openedInitialEditRef.current = requestKey;
    setFilters(DEFAULT_FILTERS);
    setEditingActivity(activity);
    setIsNewActivityOpen(false);
    setSaveError('');
  }, [
    activityRows,
    hasInitialEditTarget,
    initialEditActivity,
    initialEditRequest,
    initialEditTargetDueDate,
    initialEditTargetId,
    initialEditTargetName,
    isReadOnly,
    closedParentEditReason,
  ]);

  const sectionDefinitions = useMemo(
    () =>
      (sections.length ? sections : DEFAULT_SECTIONS).map((section) => ({
        key: section.key,
        title: section.title,
        emptyMessage: section.emptyMessage,
      })),
    [sections]
  );
  // Accountable options come strictly from the CRM picklist — not unioned with
  // values found on existing (incl. completed) activities.
  const accountableOptions = useMemo(
    () => ['All', ...(picklists.accountableMembers || []).filter((v) => v && v !== 'All')],
    [picklists.accountableMembers]
  );
  // Parent (Linked Barrier/Driver) is a lookup to this plan's records, not a
  // picklist, so its filter options legitimately come from the records.
  const parentOptions = useMemo(() => optionsFor(activeActivities, 'parentName'), [activeActivities]);
  // Indication and Status are restricted CRM picklists — pull strictly from CRM
  // (no union with values on existing records, which can include deleted values).
  const indicationOptions = useMemo(
    () => ['All', ...(picklists.activityIndications || []).filter((v) => v && v !== 'All')],
    [picklists.activityIndications]
  );
  const modalAccountableOptions = useMemo(
    () => (picklists.accountableMembers || []).filter((v) => v && v !== 'All'),
    [picklists.accountableMembers]
  );
  const modalIndicationOptions = useMemo(
    () => (picklists.activityIndications || []).filter((v) => v && v !== 'All'),
    [picklists.activityIndications]
  );
  const statusOptions = useMemo(
    () => (picklists.activityStatuses || []).filter((v) => v && v !== 'All'),
    [picklists.activityStatuses]
  );
  const barrierDriverStatusOptions = useMemo(
    () => mergeBarrierDriverStatusOptions(picklists.barrierStatuses),
    [picklists.barrierStatuses]
  );
  const baseVisibleSections = useMemo(
    () =>
      sectionDefinitions.map((section) => ({
        ...section,
        rows: activeActivities
          .filter((activity) =>
            section.key === 'completed' ? isCompletedRecently(activity) : isOpenActivity(activity)
          )
          .filter((row) => matchesFilters(row, filters))
          .map((activity) => ({
            ...activity,
            editDisabledReason: closedParentEditReason(activity),
          })),
      })),
    [activeActivities, sectionDefinitions, filters, closedParentEditReason]
  );
  const visibleSections = useMemo(
    () =>
      baseVisibleSections.map((section) => {
        const shouldApplyOpenKpiFilter =
          section.key !== 'completed' &&
          (activeKpiFilter === 'planned' || activeKpiFilter === 'inProgress');

        return {
          ...section,
          rows: shouldApplyOpenKpiFilter
            ? (section.rows || []).filter((activity) => matchesKpiFilter(activity, activeKpiFilter))
            : (section.rows || []),
        };
      }),
    [baseVisibleSections, activeKpiFilter]
  );
  const activityKpis = useMemo(() => {
    const tableRows = baseVisibleSections.flatMap((section) => section.rows || []);
    const completedSection = baseVisibleSections.find((section) => section.key === 'completed');

    return {
      inProgress: tableRows.filter((activity) => statusKey(activity) === 'in progress').length,
      planned: tableRows.filter((activity) => statusKey(activity) === 'planned').length,
      completedLast90Days: (completedSection && completedSection.rows ? completedSection.rows : []).length,
    };
  }, [baseVisibleSections]);

  const handleKpiClick = (filterKey) => {
    if (filterKey === 'completed') {
      setActiveKpiFilter('all');
      window.setTimeout(() => {
        completedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      }, 0);
      return;
    }

    setActiveKpiFilter((current) => (current === filterKey ? 'all' : filterKey));
  };

  const handleSort = (sectionKey, columnKey) => {
    setSorts((current) => {
      const existing = current[sectionKey];
      const direction =
        existing && existing.key === columnKey && existing.direction === 'asc' ? 'desc' : 'asc';
      return { ...current, [sectionKey]: { key: columnKey, direction } };
    });
  };

  const handleEditActivity = (activity) => {
    if (isReadOnly) return;
    setEditingActivity(activity);
    setSaveError('');
  };

  const closeEditModal = () => {
    if (isSavingActivity) return;
    setEditingActivity(null);
    setSaveError('');
  };

  const openNewModal = () => {
    if (isReadOnly) return;
    setIsNewActivityOpen(true);
    setCreateError('');
  };

  const closeNewModal = () => {
    if (isCreatingActivity) return;
    setIsNewActivityOpen(false);
    setCreateError('');
  };

  const handleSaveActivity = async (activity, form) => {
    if (isReadOnly) return;
    setIsSavingActivity(true);
    setSaveError('');
    try {
      const parentChanged =
        Object.prototype.hasOwnProperty.call(form, 'parentId') &&
        (form.parentId || '') !== (activity.barrierDriverId || '');
      const payload = parentChanged
        ? form
        : {
            title: form.title,
            details: form.details,
            indication: form.indication,
            status: form.status,
            accountable: form.accountable,
            dueDate: form.dueDate,
            completedDate: form.completedDate,
          };
      if (form.kiteDataAdminLimitedUpdate) payload.kiteDataAdminLimitedUpdate = true;
      if (!parentChanged && Object.prototype.hasOwnProperty.call(form, 'comments')) payload.comments = form.comments;
      if (!parentChanged && Object.prototype.hasOwnProperty.call(form, 'deactivate')) payload.deactivate = form.deactivate;
      const result = await saveCriticalActivity(activity.id, payload);
      const updated = applyActivityForm(activity, parentChanged ? form : payload, result, barrierDriverLookup);
      const nextRows = activityRows.map((row) => (row.id === activity.id ? updated : row));
      setActivityRows(nextRows);
      if (onActivityChange) onActivityChange(updated);
      onNotify?.({
        title: 'Critical activity saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setEditingActivity(null);
      const parent = updated.barrierDriverId ? barrierDriverLookup.get(updated.barrierDriverId) : null;
      const prompt = buildLinkedBarrierDriverStatusPrompt({
        activity,
        updated,
        rows: nextRows,
        parent,
        statusOptions: barrierDriverStatusOptions,
      });
      if (prompt) {
        setPendingBarrierDriverStatusConfirm(prompt);
        setPendingBarrierDriverStatusPrompt(null);
        setBarrierDriverStatusPromptValue('');
        setBarrierDriverStatusPromptError('');
      }
    } catch (error) {
      setSaveError(formatCriticalActivitySaveError(error));
    } finally {
      setIsSavingActivity(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (isReadOnly) return;
    if (editingActivity?.isKiteDataAdminCreated) return;
    if (!editingActivity?.id) return;
    setIsSavingActivity(true);
    setSaveError('');
    try {
      await deleteCriticalActivity(editingActivity.id, editingActivity);
      setActivityRows((rows) => rows.filter((row) => row.id !== editingActivity.id));
      if (onActivityChange) onActivityChange({ ...editingActivity, isDeleted: true, isDeactivated: true });
      onNotify?.({
        title: 'Critical activity deleted.',
        detail: 'The activity has been marked deleted.',
        refreshPages: true,
      });
      setEditingActivity(null);
    } catch (error) {
      setSaveError(error && error.message ? error.message : 'Unable to delete critical activity.');
    } finally {
      setIsSavingActivity(false);
    }
  };

  const handleCreateActivity = async (form) => {
    if (isReadOnly) return;
    if (!form.parentId) {
      setCreateError('Linked Barrier/Driver is required.');
      return;
    }
    if (!form.indication) {
      setCreateError('Indication is required.');
      return;
    }
    if (!openBarrierDriverLookup.has(form.parentId)) {
      setCreateError('Select an open linked Barrier/Driver.');
      return;
    }
    setIsCreatingActivity(true);
    setCreateError('');
    try {
      const result = await addCriticalActivity(planId, form);
      const created = buildCreatedActivityRow(planId, form, result, barrierDriverLookup);
      setActivityRows((rows) => [created, ...rows]);
      if (onActivityChange) onActivityChange(created);
      onNotify?.({
        title: 'Critical activity saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setIsNewActivityOpen(false);
    } catch (error) {
      setCreateError(formatCriticalActivitySaveError(error));
    } finally {
      setIsCreatingActivity(false);
    }
  };

  const handleDismissBarrierDriverStatusPrompt = () => {
    if (isSavingBarrierDriverStatus) return;
    setPendingBarrierDriverStatusPrompt(null);
    setBarrierDriverStatusPromptValue('');
    setBarrierDriverStatusPromptError('');
  };

  const handleDismissBarrierDriverStatusConfirm = () => {
    setPendingBarrierDriverStatusConfirm(null);
    setBarrierDriverStatusPromptValue('');
    setBarrierDriverStatusPromptError('');
  };

  const handleOpenBarrierDriverStatusPrompt = () => {
    if (isReadOnly) return;
    const prompt = pendingBarrierDriverStatusConfirm;
    if (!prompt) return;
    setPendingBarrierDriverStatusConfirm(null);
    setPendingBarrierDriverStatusPrompt(prompt);
    setBarrierDriverStatusPromptValue(prompt.initialStatus);
    setBarrierDriverStatusPromptError('');
  };

  const handleBarrierDriverStatusPromptChange = (value) => {
    setBarrierDriverStatusPromptValue(value);
    setBarrierDriverStatusPromptError('');
  };

  const handleSaveBarrierDriverStatusPrompt = async () => {
    if (isReadOnly) return;
    const prompt = pendingBarrierDriverStatusPrompt;
    const status = normalizeBarrierDriverStatusForDisplay(barrierDriverStatusPromptValue);
    if (!prompt?.parentId || !status) return;
    if (prompt.remainingOpenActivityCount > 0 && isClosedBarrierDriverStatus(status)) {
      setBarrierDriverStatusPromptError(linkedBarrierDriverCloseBlockedMessage(prompt));
      return;
    }

    setIsSavingBarrierDriverStatus(true);
    setBarrierDriverStatusPromptError('');
    try {
      await saveBarrierDriverStatus(prompt.parentId, status);
      setBarrierDriverStatusOverrides((current) => ({
        ...current,
        [prompt.parentId]: status,
      }));
      onNotify?.({
        title: `${prompt.parentType} status updated.`,
        detail: `${prompt.parentType} status updated to ${status}.`,
        refreshPages: true,
      });
      setPendingBarrierDriverStatusConfirm(null);
      setPendingBarrierDriverStatusPrompt(null);
      setBarrierDriverStatusPromptValue('');
    } catch (error) {
      setBarrierDriverStatusPromptError(
        error && error.message ? error.message : 'Unable to update Barrier/Driver status.'
      );
    } finally {
      setIsSavingBarrierDriverStatus(false);
    }
  };

  const editingParentRecord = editingActivity?.barrierDriverId
    ? barrierDriverLookup.get(editingActivity.barrierDriverId)
    : null;

  return (
    <section className="page page-barriers-drivers mock-bd-page is-critical-activities-page critical-activities-page">
      <div className="critical-activity-command-card">
        <div
          className="mock-kpi-row stakeholder-kpi-row critical-activity-kpi-row"
          style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
        >
          <button
            type="button"
            className={`mock-kpi-card critical-activity-kpi-card ${activeKpiFilter === 'planned' ? 'is-active' : ''}`}
            aria-pressed={activeKpiFilter === 'planned'}
            onClick={() => handleKpiClick('planned')}
          >
            <span>Planned activities</span>
            <strong>{activityKpis.planned}</strong>
          </button>
          <button
            type="button"
            className={`mock-kpi-card critical-activity-kpi-card ${activeKpiFilter === 'inProgress' ? 'is-active' : ''}`}
            aria-pressed={activeKpiFilter === 'inProgress'}
            onClick={() => handleKpiClick('inProgress')}
          >
            <span>In Progress activities</span>
            <strong>{activityKpis.inProgress}</strong>
          </button>
          <button
            type="button"
            className={`mock-kpi-card critical-activity-kpi-card ${activeKpiFilter === 'completed' ? 'is-active' : ''}`}
            aria-pressed={activeKpiFilter === 'completed'}
            onClick={() => handleKpiClick('completed')}
          >
            <span>Completed last 90 days</span>
            <strong>{activityKpis.completedLast90Days}</strong>
          </button>
        </div>

        <article className="mock-card critical-activity-toolbar-card">
          <div className="critical-activity-toolbar">
            <div className="mock-filter-row bd-filter-row">
              <label className="select-shell">
                <select
                  name="criticalActivitiesIndicationFilter"
                  aria-label="Critical activities indication filter"
                  value={filters.indication}
                  onChange={(e) => setFilters({ ...filters, indication: e.target.value })}
                >
                  {indicationOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Indication (All)' : opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-shell">
                <select
                  name="criticalActivitiesAccountableFilter"
                  aria-label="Critical activities accountable filter"
                  value={filters.accountable}
                  onChange={(e) => setFilters({ ...filters, accountable: e.target.value })}
                >
                  {accountableOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Accountable (All)' : opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-shell">
                <select
                  name="criticalActivitiesParentFilter"
                  aria-label="Critical activities barrier or driver filter"
                  value={filters.parent}
                  onChange={(e) => setFilters({ ...filters, parent: e.target.value })}
                >
                  {parentOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Linked Barrier/Driver (All)' : opt}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" className="button critical-activity-new-button" onClick={openNewModal} disabled={isReadOnly}>
              New Activity
            </button>
          </div>
        </article>
      </div>

      <article className="critical-activity-records">
        <div className="critical-activity-table-stack">
          {visibleSections.map((section) => (
            <Section
              key={section.key}
              section={section}
              sort={sorts[section.key]}
              onSort={handleSort}
              onEditActivity={handleEditActivity}
              sectionRef={section.key === 'completed' ? completedSectionRef : undefined}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      </article>

      {!isReadOnly && editingActivity && (
        <CriticalActivityEditModal
          activity={editingActivity}
          parentRecord={editingParentRecord}
          barrierDriverOptions={barrierDriverOptions}
          indicationOptions={modalIndicationOptions}
          accountableOptions={modalAccountableOptions}
          statusOptions={statusOptions}
          editDisabledReason={closedParentEditReason(editingActivity)}
          isSaving={isSavingActivity}
          error={saveError}
          onClose={closeEditModal}
          onSave={(form) => handleSaveActivity(editingActivity, form)}
          onDelete={handleDeleteActivity}
        />
      )}

      {!isReadOnly && isNewActivityOpen && (
        <CriticalActivityNewModal
          barrierDriverOptions={openBarrierDriverOptions}
          indicationOptions={modalIndicationOptions}
          accountableOptions={modalAccountableOptions}
          statusOptions={statusOptions}
          isSaving={isCreatingActivity}
          error={createError}
          onClose={closeNewModal}
          onSave={handleCreateActivity}
        />
      )}

      {!isReadOnly && pendingBarrierDriverStatusConfirm && (
        <LinkedBarrierDriverStatusConfirmModal
          prompt={pendingBarrierDriverStatusConfirm}
          onDismiss={handleDismissBarrierDriverStatusConfirm}
          onConfirm={handleOpenBarrierDriverStatusPrompt}
        />
      )}

      {!isReadOnly && pendingBarrierDriverStatusPrompt && (
        <LinkedBarrierDriverStatusPromptModal
          prompt={pendingBarrierDriverStatusPrompt}
          value={barrierDriverStatusPromptValue}
          error={barrierDriverStatusPromptError}
          isSaving={isSavingBarrierDriverStatus}
          onChange={handleBarrierDriverStatusPromptChange}
          onDismiss={handleDismissBarrierDriverStatusPrompt}
          onSave={handleSaveBarrierDriverStatusPrompt}
        />
      )}
    </section>
  );
}
