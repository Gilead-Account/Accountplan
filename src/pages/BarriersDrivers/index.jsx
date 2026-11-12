import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  activityStatusLabel,
  formatDateLabel,
  impactTone,
  recordIdMatches,
  statusTone,
  truncateDisplay,
} from '@/lib/helper/utils';
import {
  addBarrierDriver,
  addCriticalActivity,
  deleteBarrierDriverWithDependencies,
  deleteCriticalActivity,
  normalizeBarrierDriverStatusForDisplay,
  saveBarrierDriver,
  saveBarrierDriverStatus,
  saveCriticalActivity,
} from '@/lib/dataservice/accountPlan/barriersDrivers';
import { optionsForControllerValue } from '@/lib/dataservice/accountPlan/dependentPicklists';
import { formatCriticalActivitySaveError } from '@/lib/dataservice/accountPlan/errorMessages';
import {
  BARRIER_DRIVER_STATUS_ORDER,
  barrierDriverStatusRank,
  barrierDriverUsesStrategy,
  buildOpenActivityCountByBarrier,
  categoryPrefix,
  filterBarrierDriverIndicationsForType,
  isClosedBarrierDriverStatus,
  isOpenBarrierDriverStatus,
} from '@/lib/dataservice/accountPlan/shared';
import * as sharedApi from '@/lib/dataservice/accountPlan/shared';
import { deliverPreparedAccountPlanPdf } from '@/lib/export/accountPlanPdf';
import { PDF_MIME } from '@/lib/export/accountPlanPdfRenderer';
import BarrierDriverEditModal from '@/pages/BarriersDrivers/BarrierDriverEditModal';
import CriticalActivityEditModal from '@/pages/CriticalActivities/CriticalActivityEditModal';
import CriticalActivityNewModal from '@/pages/CriticalActivities/CriticalActivityNewModal';
import { usePageFilterState } from '@/lib/ui/pageFilterState';
import { criticalActivityClosedParentEditReason } from '@/pages/CriticalActivities/linkedBarrierDriverOptions';
import {
  sortActivitiesByCriticality,
  sortRecordsByCriticalActivityPriority,
} from '@/pages/BarriersDrivers/criticalActivityPrioritySort';
import {
  buildLinkedBarrierDriverStatusPrompt,
  linkedBarrierDriverCloseBlockedMessage,
  LinkedBarrierDriverStatusConfirmModal,
  LinkedBarrierDriverStatusPromptModal,
  mergeBarrierDriverStatusOptions,
} from '@/pages/CriticalActivities/LinkedBarrierDriverStatusPrompt';
import apBarriersTacticalActionPdf from '@/assets/ap-barriers-and-tactical-action.pdf?url';
import apDriverTacticalActionPdf from '@/assets/ap-drivers-and-tactical-action.pdf?url';
import '@/styles/edit-modal.css';
import '@/pages/BarriersDrivers/BarriersDrivers.css';
import { PotentialAtcContext } from '../../lib/dataservice/accountPlan/PotentialAtcContext';

const TABS = [
  { key: 'barriers', label: 'Barriers' },
  { key: 'drivers', label: 'Drivers' },
];

const DEFAULT_FILTERS = {
  type: 'All',
  indication: 'All',
  category: 'All',
  strategy: 'All',
  status: 'Active',
  accountable: 'All',
  driverTitle: 'All',
  barrierTitle: 'All',
};

const OPEN_STATUSES = new Set(['Open', 'Planned', 'In Progress']);
const COMPLETED_STATUSES = new Set(['Complete', 'Completed', 'Closed']);
const ACTIVITY_COMMENTS_FIELD = 'KPH_Comments__c';
const ACTIVITY_DEACTIVATE_FIELD = 'KPH_Inactive__c';
const TITLE_DISPLAY_LIMIT = 55;
const BARRIER_REFERENCE_PDF_TITLE= 'AP Barriers and Tactical Actions';
const BARRIER_PDF_FILE_NAME = 'AP-Barriers-and-Tactical-Actions.pdf';
const DRIVER_REFERENCE_PDF_TITLE = 'AP Drivers and Tactical Actions';
const DRIVER_REFERENCE_PDF_FILE_NAME = 'AP-Drivers-and-Tactical-Actions.pdf';

const recordValue = (value) =>
  value && typeof value === 'object' && 'value' in value ? value.value : value;

const createdRecordId = (result) =>
  recordValue(result && result.data && (result.data.id || result.data.Id)) ||
  recordValue(result && (result.id || result.Id || result.recordId)) ||
  `new-${Date.now()}`;

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const storedStatusFromForm = (status) => (status === 'Completed' ? 'Complete' : status || 'Planned');
const isDeactivateChecked = (value) =>
  value === true || ['true', 'yes', '1'].includes(String(value || '').trim().toLowerCase());

const normalizedBarrierDriverType = (type) => (type === 'Driver' ? 'Driver' : 'Barrier');

const barrierDriverTypeLabel = (type) => (normalizedBarrierDriverType(type) === 'Driver' ? 'driver' : 'barrier');

const closeBlockedByActivitiesMessage = (type, openActivityCount) => {
  const label = barrierDriverTypeLabel(type);
  const activityLabel = openActivityCount === 1 ? 'activity' : 'activities';
  const activityAction = openActivityCount === 1 ? 'it' : 'them';
  return `This ${label} has ${openActivityCount} open critical ${activityLabel}. Close ${activityAction} before closing the ${label}.`;
};

const loadReferencePdfBlob = async (src) => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Unable to load PDF (${response.status}).`);
  }
  const sourceBlob = await response.blob();
  if (!sourceBlob.size) {
    throw new Error('The PDF file is empty.');
  }
  if (sourceBlob.type === PDF_MIME) return sourceBlob;
  return new Blob([await sourceBlob.arrayBuffer()], { type: PDF_MIME });
};

function BarrierReferencePdfModal({ src, onClose }) {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const handleSavePdf = async () => {
    if (isSavingPdf) return;
    setIsSavingPdf(true);
    setSaveError('');
    try {
      const blob = await loadReferencePdfBlob(src);
      await deliverPreparedAccountPlanPdf({
        blob,
        fileName: BARRIER_PDF_FILE_NAME,
        pageCount: null,
        slideCount: null,
        title: BARRIER_REFERENCE_PDF_TITLE,
      }, {
        directShare: true,
      });
    } catch (error) {
      setSaveError(error?.message || 'Unable to save PDF.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <div className="bd-reference-pdf-overlay" onClick={onClose} role="presentation">
      <section
        className="bd-reference-pdf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bdReferencePdfTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bd-reference-pdf-head">
          <h3 id="bdReferencePdfTitle">{BARRIER_REFERENCE_PDF_TITLE}</h3>
          <div className="bd-reference-pdf-actions">
            <button
              type="button"
              className="button secondary bd-reference-pdf-save"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
            >
              {isSavingPdf ? 'Saving PDF...' : 'Save PDF'}
            </button>
            <button
              type="button"
              className="bd-reference-pdf-close"
              onClick={onClose}
              aria-label={`Close ${BARRIER_REFERENCE_PDF_TITLE} PDF`}
            />
          </div>
        </header>
        {saveError && (
          <div className="bd-reference-pdf-error" role="alert">
            {saveError}
          </div>
        )}
        <div className="bd-reference-pdf-body">
          <iframe
            className="bd-reference-pdf-frame"
            src={`${src}#view=FitH`}
            title={`${BARRIER_REFERENCE_PDF_TITLE} PDF`}
          />
        </div>
      </section>
    </div>
  );
}

function DriverReferencePdfModal({ src, onClose }) {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const handleSavePdf = async () => {
    if (isSavingPdf) return;
    setIsSavingPdf(true);
    setSaveError('');
    try {
      const blob = await loadReferencePdfBlob(src);
      await deliverPreparedAccountPlanPdf({
        blob,
        fileName: DRIVER_REFERENCE_PDF_FILE_NAME,
        pageCount: null,
        slideCount: null,
        title: DRIVER_REFERENCE_PDF_TITLE,
      }, {
        directShare: true,
      });
    } catch (error) {
      setSaveError(error?.message || 'Unable to save PDF.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <div className="bd-reference-pdf-overlay" onClick={onClose} role="presentation">
      <section
        className="bd-reference-pdf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bdReferencePdfTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bd-reference-pdf-head">
          <h3 id="bdReferencePdfTitle">{DRIVER_REFERENCE_PDF_TITLE}</h3>
          <div className="bd-reference-pdf-actions">
            <button
              type="button"
              className="button secondary bd-reference-pdf-save"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
            >
              {isSavingPdf ? 'Saving PDF...' : 'Save PDF'}
            </button>
            <button
              type="button"
              className="bd-reference-pdf-close"
              onClick={onClose}
              aria-label={`Close ${DRIVER_REFERENCE_PDF_TITLE} PDF`}
            />
          </div>
        </header>
        {saveError && (
          <div className="bd-reference-pdf-error" role="alert">
            {saveError}
          </div>
        )}
        <div className="bd-reference-pdf-body">
          <iframe
            className="bd-reference-pdf-frame"
            src={`${src}#view=FitH`}
            title={`${DRIVER_REFERENCE_PDF_TITLE} PDF`}
          />
        </div>
      </section>
    </div>
  );
}

const isOpenBarrierDriverRecord = (record) =>
  isOpenBarrierDriverStatus(record?.status);

const barrierDriverStatusTone = (status) =>
  isClosedBarrierDriverStatus(status) ? 'neutral' : 'positive';

const recordMatchesStatus = (record, statusFilter) => {
  if (statusFilter === 'All') return true;
  const status = normalizeBarrierDriverStatusForDisplay(record.status);
  if (statusFilter === 'Active') return isOpenBarrierDriverStatus(status);
  return status === normalizeBarrierDriverStatusForDisplay(statusFilter);
};

const sortRecordsByLifecycleStatus = (records, statusFilter) => {
  if (statusFilter !== 'All') return records;
  return (records || [])
    .map((record, index) => ({ record, index }))
    .sort((left, right) => (
      barrierDriverStatusRank(left.record.status) - barrierDriverStatusRank(right.record.status) ||
      left.index - right.index
    ))
    .map(({ record }) => record);
};

const recordMatchesIndication = (record, indication) =>
  indication === 'All' || (record.indication || '') === indication;

const recordMatchesStrategy = (record, strategy) =>
  strategy === 'All' || (record.strategy || '') === strategy;

const recordMatchesCategory = (record, category, picklists) =>
  category === 'All' ||
  categoryLabelForValue(picklists, record.categoryValue || record.category) === category;

const recordMatchesType = (record, typeFilter) => {
  if (typeFilter === 'All') return true;
  if (typeFilter === 'Barriers') return record.type === 'Barrier';
  if (typeFilter === 'Drivers') return record.type === 'Driver';
  return true;
};

const recordActivitySummary = (record, openCountMap) => {
  const count = (openCountMap && openCountMap[record.id]) || 0;
  if (!count) return 'No open critical activities';
  return `${count} open critical ${count === 1 ? 'activity' : 'activities'}`;
};

const recordClosedActivitySummary = (record, closedCountMap) => {
  const count = (closedCountMap && closedCountMap[record.id]) || 0;
  if (!count) return 'No closed critical activities';
  return `${count} closed critical ${count === 1 ? 'activity' : 'activities'}`;
};

const COLUMNS = [
  { key: 'name', label: 'Critical Activity Title' },
  { key: 'related', label: 'Linked Barrier/Driver' },
  { key: 'indication', label: 'Indication' },
  { key: 'status', label: 'Status' },
  { key: 'createdBy', label: 'Created By' },
  { key: 'accountable', label: 'Accountable' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'lastModified', label: 'Last Modified Date' },
];

const parseSortDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

const sortValue = (a, key) => {
  switch (key) {
    case 'name':
      return a.name || 'Untitled';
    case 'related':
      return a.parentName || 'Plan-level';
    case 'indication':
      return a.indication || '-';
    case 'status':
      return activityStatusLabel(a);
    case 'createdBy':
      return a.createdBy || 'Not entered';
    case 'accountable':
      return a.ownerLabel || 'Unassigned';
    case 'dueDate':
      return parseSortDate(a.dueDate);
    case 'lastModified':
      return a.lastModifiedDate || '';
    default:
      return '';
  }
};

const appendUniqueOptions = (out, values) => {
  const seen = new Set(out);
  for (const value of values || []) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

const fallbackStrategiesForIndication = (picklists, indication) => {
  const key = String(indication || '').trim().toUpperCase();
  if (key === 'MM') return picklists?.mmStrategies || [];
  if (key === 'PORTFOLIO') return picklists?.portfolioStrategies || [];
  return picklists?.dlbclStrategies || [];
};

const strategyOptionsForFilter = (picklists, tab, indicationFilter) => {
  const type = tab === 'drivers' ? 'Driver' : 'Barrier';
  const allowedIndications = filterBarrierDriverIndicationsForType(picklists?.barrierDriverIndications, type);
  const indicationSource = indicationFilter === 'All'
    ? allowedIndications
    : allowedIndications.filter((value) => value === indicationFilter);
  const out = ['All'];
  for (const indication of indicationSource) {
    if (!barrierDriverUsesStrategy(indication)) continue;
    appendUniqueOptions(
      out,
      optionsForControllerValue(picklists?.strategyOptionsByIndication, indication) ||
        fallbackStrategiesForIndication(picklists, indication)
    );
  }
  if (out.length === 1 && tab === 'drivers' && indicationFilter === 'All') {
    appendUniqueOptions(out, picklists?.barrierStrategies || []);
  }
  return out;
};

const categoryOptionsForFilter = (picklists, tab, indicationFilter, records) => {
  const type = tab === 'drivers' ? 'Driver' : 'Barrier';
  const optionsByIndication = type === 'Driver'
    ? picklists?.driverCategoryOptionsByIndication
    : picklists?.barrierCategoryOptionsByIndication;
  const allowedIndications = filterBarrierDriverIndicationsForType(
    picklists?.barrierDriverIndications,
    type
  );
  const indicationSource = indicationFilter === 'All'
    ? allowedIndications
    : allowedIndications.filter((value) => value === indicationFilter);
  const optionValues = [];

  for (const indication of indicationSource) {
    appendUniqueOptions(
      optionValues,
      optionsForControllerValue(optionsByIndication, indication) ||
        (type === 'Driver' ? picklists?.dlbclDriverCategories : picklists?.dlbclBarrierCategories)
    );
  }

  appendUniqueOptions(
    optionValues,
    (records || [])
      .filter((record) =>
        record.type === type &&
        recordMatchesIndication(record, indicationFilter)
      )
      .map((record) => record.categoryValue || record.category)
  );

  const labels = [];
  const seenLabels = new Set();
  for (const value of optionValues) {
    const label = categoryLabelForValue(picklists, value);
    const key = String(label || '').trim().toUpperCase();
    if (!label || seenLabels.has(key)) continue;
    seenLabels.add(key);
    labels.push(label);
  }
  return ['All', ...labels];
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

const sortedActivities = (rows, sort) => {
  if (!sort || !sort.key) return rows || [];
  return (rows || [])
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const result = compareSortValues(sortValue(a.row, sort.key), sortValue(b.row, sort.key), sort.direction);
      return result || a.index - b.index;
    })
    .map(({ row }) => row);
};

const applyActivityForm = (activity, form, barrierLookup, saveResult) => {
  const status = storedStatusFromForm(form.status);
  const isComplete = COMPLETED_STATUSES.has(status);
  const parent = form.parentId ? barrierLookup.get(form.parentId) : null;
  const omittedFields = new Set((saveResult && saveResult.omittedOptionalFields) || []);
  const hasDeactivateField = Object.prototype.hasOwnProperty.call(form, 'deactivate');
  const hasCommentsField = Object.prototype.hasOwnProperty.call(form, 'comments');
  const savedComments =
    activity.canEditComments !== false && !omittedFields.has(ACTIVITY_COMMENTS_FIELD);
  const savedDeactivate =
    activity.canDeactivate !== false && !omittedFields.has(ACTIVITY_DEACTIVATE_FIELD);
  return {
    ...activity,
    name: String(form.title || '').trim(),
    details: String(form.details || '').trim(),
    indication: form.indication || '',
    status,
    ownerLabel: form.accountable || '',
    comments: savedComments && hasCommentsField
      ? (form.comments || '')
      : (activity.comments || ''),
    dueDate: form.dueDate || null,
    completedDate: isComplete ? (form.completedDate || activity.completedDate || todayIsoDate()) : null,
    isDeactivated: savedDeactivate && hasDeactivateField
      ? isDeactivateChecked(form.deactivate)
      : activity.isDeactivated === true,
    canEditComments: savedComments,
    canDeactivate: savedDeactivate,
    barrierDriverId: form.parentId || null,
    parentName: parent ? parent.name : (form.parentId ? 'Linked record unavailable' : 'Plan-level'),
    parentType: parent ? parent.type : (form.parentType || null),
    parentRecordTypeId: parent ? (parent.recordTypeId || null) : (form.parentRecordTypeId || null),
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

const strategyLabelForValue = (picklists, value, fallback = null) => {
  const labels = picklists?.strategyLabels;
  if (!value || !labels || typeof labels !== 'object') return fallback || value || null;
  return Object.prototype.hasOwnProperty.call(labels, value) ? (labels[value] || value) : (fallback || value);
};

const categoryLabelForValue = (picklists, value, fallback = null) => {
  const labels = picklists?.categoryLabels;
  if (!value || !labels || typeof labels !== 'object') return fallback || categoryPrefix(value) || value || null;
  return Object.prototype.hasOwnProperty.call(labels, value)
    ? (labels[value] || value)
    : (fallback || categoryPrefix(value) || value);
};

const applyBarrierDriverForm = (record, form, picklists = {}) => {
  const strategy = barrierDriverUsesStrategy(form.indication) ? (form.strategy || null) : null;
  const previousLabel = record.strategy === strategy ? record.strategyLabel : null;
  const previousCategoryLabel = record.categoryValue === form.category ? record.category : null;
  return {
    ...record,
    type: form.type,
    name: String(form.name || '').trim(),
    status: normalizeBarrierDriverStatusForDisplay(form.status),
    indication: form.indication,
    strategy,
    strategyLabel: strategy ? strategyLabelForValue(picklists, strategy, previousLabel) : null,
    strategyRank: barrierDriverUsesStrategy(form.indication) ? (form.strategyRank || null) : null,
    category: categoryLabelForValue(picklists, form.category, previousCategoryLabel),
    categoryValue: form.category || null,
    businessImpact: form.businessImpact || null,
    comments: form.comments || '',
    lastModifiedDate: new Date().toISOString(),
  };
};

function ExpandIcon({ expanded }) {
  return (
    <svg className="bd-expand-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      {!expanded && <path d="M12 5v14" />}
    </svg>
  );
}

function EditPencilIcon() {
  return (
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
  );
}

function EditIconButton({ ariaLabel, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className="stakeholder-edit-button"
      onClick={onClick}
      aria-label={ariaLabel}
      title="Edit"
      disabled={disabled}
    >
      <EditPencilIcon />
    </button>
  );
}

function DeleteTrashIcon() {
  return (
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function DeleteIconButton({ ariaLabel, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className="barrier-driver-delete-button"
      onClick={onClick}
      aria-label={ariaLabel}
      title="Delete"
      disabled={disabled}
    >
      <DeleteTrashIcon />
    </button>
  );
}

function BarrierDriverDeleteModal({
  record,
  associatedActivities,
  error,
  isDeleting,
  onCancel,
  onConfirm,
}) {
  const activityCount = associatedActivities.length;
  const typeLabel = record.type === 'Driver' ? 'Driver' : 'Barrier';

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isDeleting) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDeleting, onCancel]);

  return (
    <div
      className="critical-activity-confirm-scrim barrier-driver-delete-scrim"
      role="presentation"
    >
      <section
        className="critical-activity-confirm-dialog barrier-driver-delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="barrierDriverDeleteTitle"
      >
        <h4 id="barrierDriverDeleteTitle">Delete {typeLabel}</h4>
        <p>
          Are you sure you want to delete <strong>{record.name || `this ${typeLabel.toLowerCase()}`}</strong>?
        </p>

        {activityCount > 0 && (
          <div className="barrier-driver-delete-dependencies">
            <p>
              This {typeLabel.toLowerCase()} has {activityCount} associated critical {activityCount === 1 ? 'activity' : 'activities'}.
              {' '}Before completing the deletion, either delete the associated critical activities or
              reassign them to another Barrier or Driver.
            </p>
            <div className="barrier-driver-delete-display-option">
              <span aria-hidden="true">1</span>
              <strong>Delete associated critical activities</strong>
            </div>
            <div className="barrier-driver-delete-option-separator" aria-hidden="true">
              <span>OR</span>
            </div>
            <div className="barrier-driver-delete-display-option">
              <span aria-hidden="true">2</span>
              <strong>Reassign associated critical activities to another Barrier or Driver</strong>
            </div>
          </div>
        )}

        {error && <div className="critical-activity-edit-error">{error}</div>}
        <div className="critical-activity-confirm-actions">
          <button
            type="button"
            className="stakeholder-edit-button-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          {activityCount === 0 && (
            <button
              type="button"
              className="critical-activity-delete-button confirm"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting' : `Delete ${typeLabel}`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function HierarchyRow({ record, openCountMap, closedCountMap, isExpanded, activities, picklists, onToggle, onEdit, onDelete, onAddActivity, onEditActivity, isReadOnly = false }) {
  const recordClosed = isClosedBarrierDriverStatus(record.status);
  return (
    <article className={`bd-tree-row ${record.type === 'Driver' ? 'is-driver' : ''} ${isExpanded ? 'is-expanded' : ''}`}>
      <div className="bd-tree-main">
        <button
          type="button"
          className="bd-expand-button"
          onClick={onToggle}
          aria-expanded={isExpanded}
        >
          <ExpandIcon expanded={isExpanded} />
        </button>
        <div className="bd-tree-copy">
          <div className="bd-tree-title-line">
            <span className={`bd-type-pill ${record.type === 'Driver' ? 'driver' : 'barrier'}`}>
              {record.category || 'Category'}
            </span>
            <h4 title={record.name || ''}>{truncateDisplay(record.name || 'Untitled', TITLE_DISPLAY_LIMIT)}</h4>
          </div>
          <p className="bd-record-description">{record.comments || 'No comment'}</p>
          <div className="bd-chip-row">
            <span className="chip chip-blue">{record.indication || '-'}</span>
            <span className={`chip ${barrierDriverStatusTone(record.status)}`}>{record.status || BARRIER_DRIVER_STATUS_ORDER[0]}</span>
            <span className={`chip ${impactTone(record.businessImpact)}`}>
              {record.businessImpact ? `${record.businessImpact} impact` : 'Impact not set'}
            </span>
            <span className="chip chip-blue bd-activity-summary-pill">
              {recordActivitySummary(record, openCountMap)}
            </span>
            <span className="chip chip-blue bd-activity-summary-pill is-closed">
              {recordClosedActivitySummary(record, closedCountMap)}
            </span>
          </div>
        </div>
        <div className="barrier-driver-row-actions">
          <EditIconButton
            ariaLabel={`Edit ${record.name || 'barrier or driver'}`}
            onClick={() => onEdit(record)}
            disabled={isReadOnly}
          />
          <DeleteIconButton
            ariaLabel={`Delete ${record.name || 'barrier or driver'}`}
            onClick={() => onDelete(record)}
            disabled={isReadOnly || record.isKiteDataAdminPreLaunch}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="bd-activity-branch">
          <div className="bd-activity-branch-head">
            <strong>Critical Activities</strong>
            <span>{activities.length} total</span>
          </div>
          {activities.map((activity) => (
            <article key={activity.id} className="bd-activity-card">
              <div>
                <h4 title={activity.name || ''}>{truncateDisplay(activity.name || 'Untitled', TITLE_DISPLAY_LIMIT)}</h4>
                {activity.details && (
                  <p className="bd-activity-description bd-critical-activity-details">
                    <span>Details</span> {activity.details}
                  </p>
                )}
                <div className="bd-chip-row">
                  <span className="chip">
                    {truncateDisplay(activity.parentName || record.name || 'Plan-level', TITLE_DISPLAY_LIMIT)}
                  </span>
                  <span className={`chip ${statusTone(activity.status)}`}>
                    {activityStatusLabel(activity)}
                  </span>
                  <span className="chip">Created By {activity.createdBy || 'Not entered'}</span>
                  <span className="chip">Accountable {activity.ownerLabel || 'Unassigned'}</span>
                  <span className="chip">
                    Due Date {activity.dueDate ? formatDateLabel(activity.dueDate, 'Not entered') : 'Not entered'}
                  </span>
                  <span className="chip">
                    Last Modified Date {formatDateLabel(activity.lastModifiedDate, 'Not entered')}
                  </span>
                </div>
              </div>
              <EditIconButton
                ariaLabel={`Edit ${activity.name || 'critical activity'}`}
                onClick={() => onEditActivity(activity)}
                disabled={isReadOnly}
              />
            </article>
          ))}
          <button
            type="button"
            className="button primary-red"
            onClick={() => onAddActivity(record)}
            disabled={isReadOnly || recordClosed}
          >
            Add Critical Activity
          </button>
          {activities.length === 0 && (
            <div className="empty-state small">No critical activities linked.</div>
          )}
        </div>
      )}
    </article>
  );
}

function RecordCard({ record, isExpanded, activities, openCountMap, closedCountMap, onToggle, onEdit, onDelete, onAddActivity, onEditActivity, isReadOnly = false }) {
  const recordClosed = isClosedBarrierDriverStatus(record.status);
  return (
    <article className={`bd-tree-row ${record.type === 'Driver' ? 'is-driver' : ''} ${isExpanded ? 'is-expanded' : ''}`}>
      <div
        className="bd-tree-main"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <button
          type="button"
          className="bd-expand-button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} critical activities for ${record.name || 'record'}`}
        >
          <ExpandIcon expanded={isExpanded} />
        </button>
        <div className="bd-tree-copy">
          <div className="bd-tree-title-line">
            <span className={`bd-type-pill ${record.type === 'Driver' ? 'driver' : 'barrier'}`}>
              {record.category || 'Category'}
            </span>
            <h4 title={record.name || ''}>{truncateDisplay(record.name || 'Untitled', TITLE_DISPLAY_LIMIT)}</h4>
          </div>
          <p className="bd-record-description">{record.comments || 'No comment'}</p>
          <div className="bd-chip-row bd-record-chip-row">
            <span className="chip chip-blue">{record.indication || 'Not entered'}</span>
            <span className={`chip ${barrierDriverStatusTone(record.status)}`}>{record.status || BARRIER_DRIVER_STATUS_ORDER[0]}</span>
            <span className={`chip ${impactTone(record.businessImpact)}`}>
              {record.businessImpact ? `${record.businessImpact} impact` : 'Impact not set'}
            </span>
            <span className="chip chip-blue bd-activity-summary-pill">
              {recordActivitySummary(record, openCountMap)}
            </span>
            <span className="chip chip-blue bd-activity-summary-pill is-closed">
              {recordClosedActivitySummary(record, closedCountMap)}
            </span>
          </div>
        </div>
        <div className="barrier-driver-row-actions" onClick={(event) => event.stopPropagation()}>
          <EditIconButton
            ariaLabel={`Edit ${record.name || 'barrier or driver'}`}
            onClick={() => onEdit(record)}
            disabled={isReadOnly}
          />
          <DeleteIconButton
            ariaLabel={`Delete ${record.name || 'barrier or driver'}`}
            onClick={() => onDelete(record)}
            disabled={isReadOnly || record.isKiteDataAdminPreLaunch}
          />
        </div>
      </div>

      {isExpanded && (
        <div className={`bd-activity-branch bd-card-activity-branch ${activities.length ? '' : 'is-empty'}`}>
          <div className="bd-activity-branch-head">
            <strong>Critical Activities</strong>
            <span className="bd-activity-total-pill">{activities.length} total</span>
          </div>
          {activities.map((activity) => (
            <article key={activity.id} className="bd-activity-card bd-critical-activity-card is-pill-layout">
              <div className="bd-critical-activity-copy">
                <div className="bd-critical-activity-head">
                  <h4 title={activity.name || ''}>{truncateDisplay(activity.name || 'Untitled', TITLE_DISPLAY_LIMIT)}</h4>
                  <span className={`bd-activity-status-badge ${statusTone(activity.status)}`}>
                    {activityStatusLabel(activity)}
                  </span>
                </div>
                {activity.details && (
                  <p className="bd-activity-description bd-critical-activity-details">
                    <span>Details</span> {activity.details}
                  </p>
                )}
                <div className="bd-critical-activity-pill-row">
                  <span className="bd-critical-pill">
                    <strong>Created By</strong> <em>{activity.createdBy || 'Not entered'}</em>
                  </span>
                  <span className="bd-critical-pill">
                    <strong>Accountable</strong> <em>{activity.ownerLabel || 'Unassigned'}</em>
                  </span>
                  <span className="bd-critical-pill">
                    <strong>Due Date</strong>{' '}
                    <em>{activity.dueDate ? formatDateLabel(activity.dueDate, 'Not entered') : 'Not entered'}</em>
                  </span>
                  <span className="bd-critical-pill">
                    <strong>Last Modified Date</strong>{' '}
                    <em>{formatDateLabel(activity.lastModifiedDate, 'Not entered')}</em>
                  </span>
                </div>
              </div>
              <EditIconButton
                ariaLabel={`Edit ${activity.name || 'critical activity'}`}
                onClick={() => onEditActivity(activity)}
                disabled={isReadOnly}
              />
            </article>
          ))}
          {activities.length > 0 && (
            <button
              type="button"
              className="button primary-red bd-card-activity-add-button"
              onClick={() => onAddActivity(record)}
              disabled={isReadOnly || recordClosed}
            >
              Add Activity
            </button>
          )}
          {activities.length === 0 && (
            <div className="bd-empty-activity-panel">
              <strong>No linked follow-ups yet.</strong>
              <button
                type="button"
                className="button primary-red bd-card-activity-add-button"
                onClick={() => onAddActivity(record)}
                disabled={isReadOnly || recordClosed}
            >
                Add Activity
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ActivitiesSection({ section, sort, onSort, onEdit, isReadOnly = false }) {
  const visible = useMemo(() => sortedActivities(section.rows || [], sort), [section.rows, sort]);
  return (
    <section className="critical-activity-table-section">
      <div className="critical-activity-table-title">
        <h4>{section.title}</h4>
      </div>
      <div className="bd-record-table activities-table">
        <div className="bd-record-head">
          {COLUMNS.map((col) => (
            <span key={col.key}>
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
          <span className="activity-action-head" aria-hidden="true" />
        </div>
        {visible.map((a) => (
          <div key={a.id} className="bd-record-row-flat">
            <strong title={a.name || ''}>{truncateDisplay(a.name || 'Untitled', TITLE_DISPLAY_LIMIT)}</strong>
            <span title={a.parentName || ''}>{truncateDisplay(a.parentName || 'Plan-level', TITLE_DISPLAY_LIMIT)}</span>
            <span>{a.indication || '-'}</span>
            <span>
              <em className={`pill ${statusTone(a.status)}`}>{activityStatusLabel(a)}</em>
            </span>
            <span>{a.createdBy || 'Not entered'}</span>
            <span>{a.ownerLabel || 'Unassigned'}</span>
            <span>{formatDateLabel(a.dueDate, 'Not entered')}</span>
            <span>{formatDateLabel(a.lastModifiedDate, 'Not entered')}</span>
            <span className="stakeholder-row-actions activity-row-actions">
              <EditIconButton
                ariaLabel={`Edit ${a.name || 'critical activity'}`}
                onClick={() => onEdit(a)}
                disabled={isReadOnly}
              />
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

export default function BarriersDrivers({ data, initialTab = 'barriers', onActivityChange, onNotify, isReadOnly = false}) {
  const planId = data.planId;
  const picklists = data.picklists || {};
  const [tab, setTab] = useState('barriers');
  const [barriers, setBarriers] = useState(() => data.barriers || []);
  const [drivers, setDrivers] = useState(() => data.drivers || []);
  const [activities, setActivities] = useState(() => data.activities || []);
  const [filters, setFilters] = usePageFilterState('barriers-drivers', DEFAULT_FILTERS);
  const [expandedRows, setExpandedRows] = useState({});
  const [planLevelExpanded, setPlanLevelExpanded] = useState(false);
  const [sorts, setSorts] = useState({});
  const [bdEditState, setBdEditState] = useState(null); // { record?, defaultType }
  const [activityEditState, setActivityEditState] = useState(null); // { activity, parentRecord? }
  const [activityCreateState, setActivityCreateState] = useState(null); // { parentRecord? }
  const [isSavingBd, setIsSavingBd] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [bdError, setBdError] = useState('');
  const [deleteState, setDeleteState] = useState(null);
  const [isDeletingBarrierDriver, setIsDeletingBarrierDriver] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [pendingBarrierDriverStatusConfirm, setPendingBarrierDriverStatusConfirm] = useState(null);
  const [pendingBarrierDriverStatusPrompt, setPendingBarrierDriverStatusPrompt] = useState(null);
  const [barrierDriverStatusPromptValue, setBarrierDriverStatusPromptValue] = useState('');
  const [barrierDriverStatusPromptError, setBarrierDriverStatusPromptError] = useState('');
  const [isSavingBarrierDriverStatus, setIsSavingBarrierDriverStatus] = useState(false);
  const [isBarrierReferencePdfOpen, setIsBarrierReferencePdfOpen] = useState(false);
  const [isDriverReferencePdfOpen, setDriverIsReferencePdfOpen] = useState(false);
  const isPotentialAtc = useContext(PotentialAtcContext);

  useEffect(() => {
    setBarriers(data.barriers || []);
    setDrivers(data.drivers || []);
    setActivities(data.activities || []);
  }, [data]);

  useEffect(() => {
    if (!isReadOnly) return;
    setBdEditState(null);
    setDeleteState(null);
    setActivityEditState(null);
    setActivityCreateState(null);
    setPendingBarrierDriverStatusConfirm(null);
    setPendingBarrierDriverStatusPrompt(null);
  }, [isReadOnly]);

  useEffect(() => {
    setPendingBarrierDriverStatusConfirm(null);
    setPendingBarrierDriverStatusPrompt(null);
    setBarrierDriverStatusPromptValue('');
    setBarrierDriverStatusPromptError('');
  }, [planId]);

  useEffect(() => {
    if (TABS.some((item) => item.key === initialTab)) {
      setTab(initialTab);
    }
  }, [initialTab]);

  const allRecords = useMemo(() => [...barriers, ...drivers], [barriers, drivers]);
  const recordById = useMemo(() => new Map(allRecords.map((r) => [r.id, r])), [allRecords]);
  const openRecordById = useMemo(
    () => new Map(allRecords.filter(isOpenBarrierDriverRecord).map((r) => [r.id, r])),
    [allRecords]
  );
  const closedParentEditReason = useCallback(
    (activity, parentRecord = null) =>
      criticalActivityClosedParentEditReason(
        activity,
        parentRecord || (activity?.barrierDriverId ? recordById.get(activity.barrierDriverId) : null)
      ),
    [recordById]
  );

  const openCountByBarrier = useMemo(() => {
    return buildOpenActivityCountByBarrier(activities);
  }, [activities]);
  const closedCountByBarrier = useMemo(() => {
    return typeof sharedApi.buildClosedActivityCountByBarrier === 'function'
      ? sharedApi.buildClosedActivityCountByBarrier(activities)
      : {};
  }, [activities]);

  const filteredRecords = useMemo(() => {
    const rows = allRecords.filter((r) =>
      recordMatchesType(r, filters.type) &&
      recordMatchesIndication(r, filters.indication) &&
      recordMatchesCategory(r, filters.category, picklists) &&
      recordMatchesStrategy(r, filters.strategy) &&
      recordMatchesStatus(r, filters.status)
    );
    return sortRecordsByLifecycleStatus(rows, filters.status);
  }, [allRecords, filters]);

  const filteredBarriers = useMemo(() => {
    const rows = sortRecordsByLifecycleStatus(
      barriers.filter((r) =>
        recordMatchesIndication(r, filters.indication) &&
        recordMatchesCategory(r, filters.category, picklists) &&
        recordMatchesStrategy(r, filters.strategy) &&
        recordMatchesStatus(r, filters.status)
      ),
      filters.status
    );
    return sortRecordsByCriticalActivityPriority(rows, activities);
  }, [activities, barriers, filters, picklists]);
  const filteredDrivers = useMemo(() => {
    const rows = sortRecordsByLifecycleStatus(
      drivers.filter((r) =>
        recordMatchesIndication(r, filters.indication) &&
        recordMatchesCategory(r, filters.category, picklists) &&
        recordMatchesStrategy(r, filters.strategy) &&
        recordMatchesStatus(r, filters.status)
      ),
      filters.status
    );
    return sortRecordsByCriticalActivityPriority(rows, activities);
  }, [activities, drivers, filters, picklists]);

  const filteredEntryActivities = (record) =>
    sortActivitiesByCriticality(
      activities.filter((a) => recordIdMatches(a.barrierDriverId, record.id) && a.isDeactivated !== true)
    )
      .map((activity) => ({
        ...activity,
        editDisabledReason: closedParentEditReason(activity, record),
      }));

  const filteredPlanLevelActivities = useMemo(
    () => activities.filter((a) => !a.barrierDriverId && a.isDeactivated !== true),
    [activities]
  );

  const accountableOptionsForFilters = useMemo(() => {
    // Accountable comes strictly from the CRM picklist — not unioned with
    // values found on existing activity records.
    const seen = new Set();
    const out = ['All'];
    for (const v of picklists.accountableMembers || []) {
      if (!v || v === 'All' || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }, [picklists.accountableMembers]);

  const driverTitleOptions = useMemo(() => {
    const seen = new Set();
    const out = ['All'];
    for (const d of drivers) {
      if (!d.name || seen.has(d.name)) continue;
      seen.add(d.name);
      out.push(d.name);
    }
    return out;
  }, [drivers]);

  const barrierTitleOptions = useMemo(() => {
    const seen = new Set();
    const out = ['All'];
    for (const b of barriers) {
      if (!b.name || seen.has(b.name)) continue;
      seen.add(b.name);
      out.push(b.name);
    }
    return out;
  }, [barriers]);

  const indicationOptions = useMemo(() => {
    const list = picklists.barrierDriverIndications || [];
    const type = tab === 'drivers' ? 'Driver' : 'Barrier';
    return ['All', ...filterBarrierDriverIndicationsForType(list, type)];
  }, [picklists, tab]);
  useEffect(() => {
    if (indicationOptions.includes(filters.indication)) return;
    setFilters((current) => ({ ...current, indication: 'All' }));
  }, [filters.indication, indicationOptions]);
  const categoryFilterOptions = useMemo(
    () => categoryOptionsForFilter(picklists, tab, filters.indication, allRecords),
    [allRecords, filters.indication, picklists, tab]
  );
  useEffect(() => {
    if (categoryFilterOptions.includes(filters.category)) return;
    setFilters((current) => ({ ...current, category: 'All' }));
  }, [categoryFilterOptions, filters.category]);
  const strategyFilterOptions = useMemo(
    () => strategyOptionsForFilter(picklists, tab, filters.indication),
    [picklists, tab, filters.indication]
  );
  useEffect(() => {
    if (strategyFilterOptions.includes(filters.strategy)) return;
    setFilters((current) => ({ ...current, strategy: 'All' }));
  }, [filters.strategy, strategyFilterOptions]);
  const statusFilterOptions = useMemo(() => {
    const seen = new Set(BARRIER_DRIVER_STATUS_ORDER);
    const extras = (picklists.barrierStatuses || [])
      .map(normalizeBarrierDriverStatusForDisplay)
      .filter((status) => {
        if (!status || seen.has(status)) return false;
        seen.add(status);
        return true;
      });
    return [...BARRIER_DRIVER_STATUS_ORDER, ...extras];
  }, [picklists]);
  const activityIndicationOptions = useMemo(
    () => picklists.activityIndications || picklists.barrierDriverIndications || [],
    [picklists]
  );
  const barrierDriverStatusOptions = useMemo(
    () => mergeBarrierDriverStatusOptions(picklists.barrierStatuses),
    [picklists.barrierStatuses]
  );

  const visibleTabs = useMemo(() => {
    return TABS;
  }, []);

  const activeRecordTypeLabel = tab === 'drivers' ? 'Drivers' : 'Barriers';
  const activeRecordSingularLabel = tab === 'drivers' ? 'Driver' : 'Barrier';
  // Open-record limit removed — barriers/drivers can be added without a cap.
  const barrierLimitReached = false;
  const driverLimitReached = false;
  const barrierAddLimitMessage = undefined;
  const driverAddLimitMessage = undefined;
  const activeAddType = tab === 'drivers' ? 'Driver' : 'Barrier';
  const activeAddLimitReached = false;
  const activeAddLimitMessage = undefined;
  const activeRecordsForSummary = useMemo(() => {
    const rows = tab === 'drivers' ? drivers : barriers;
    return rows.filter((r) =>
      recordMatchesIndication(r, filters.indication) &&
      recordMatchesCategory(r, filters.category, picklists) &&
      recordMatchesStrategy(r, filters.strategy)
    );
  }, [barriers, drivers, filters.category, filters.indication, filters.strategy, picklists, tab]);

  const statusKpis = useMemo(() => {
    const open = activeRecordsForSummary.filter((r) => isOpenBarrierDriverStatus(r.status)).length;
    const closed = activeRecordsForSummary.filter((r) => isClosedBarrierDriverStatus(r.status)).length;
    return { open, closed };
  }, [activeRecordsForSummary]);

  const matchesActivityFilters = (activity) => {
    if (filters.accountable !== 'All' && (activity.ownerLabel || 'Unassigned') !== filters.accountable) return false;
    if (filters.indication !== 'All' && (activity.indication || '') !== filters.indication) return false;
    if (filters.driverTitle !== 'All') {
      const parent = activity.barrierDriverId ? recordById.get(activity.barrierDriverId) : null;
      if (!parent || parent.type !== 'Driver' || parent.name !== filters.driverTitle) return false;
    }
    if (filters.barrierTitle !== 'All') {
      const parent = activity.barrierDriverId ? recordById.get(activity.barrierDriverId) : null;
      if (!parent || parent.type !== 'Barrier' || parent.name !== filters.barrierTitle) return false;
    }
    return true;
  };

  const activitySections = useMemo(() => {
    const base = activities
      .filter((a) => a.isDeactivated !== true)
      .filter(matchesActivityFilters)
      .map((activity) => ({
        ...activity,
        editDisabledReason: closedParentEditReason(activity),
      }));
    return [
      {
        key: 'open',
        title: 'Open and Planned Critical Activities',
        emptyMessage: 'No open or planned critical activities match the current filters.',
        rows: base.filter((a) => OPEN_STATUSES.has(a.status)),
      },
      {
        key: 'completed',
        title: 'Completed Critical Activities in the Last 90 Days',
        emptyMessage: 'No completed critical activities in the last 90 days match the current filters.',
        rows: base.filter((a) => {
          if (!COMPLETED_STATUSES.has(a.status)) return false;
          const ref = a.completedDate || a.lastModifiedDate;
          if (!ref) return false;
          const when = parseSortDate(ref);
          if (!when) return false;
          const cutoff = new Date();
          cutoff.setHours(0, 0, 0, 0);
          cutoff.setDate(cutoff.getDate() - 90);
          return when >= cutoff.getTime();
        }),
      },
    ];
  }, [activities, filters, closedParentEditReason]);

  const toggleRow = (id) => setExpandedRows((s) => ({ ...s, [id]: !s[id] }));

  const handleSort = (sectionKey, columnKey) => {
    setSorts((current) => {
      const existing = current[sectionKey];
      const direction =
        existing && existing.key === columnKey && existing.direction === 'asc' ? 'desc' : 'asc';
      return { ...current, [sectionKey]: { key: columnKey, direction } };
    });
  };

  const openNewBarrierDriver = (defaultType) => {
    if (isReadOnly) return;
    const type = normalizedBarrierDriverType(defaultType);
    setBdError('');
    setBdEditState({ open : true, record :null, defaultType, isPotentialAtc: isPotentialAtc === true,});
  };

  const openEditBarrierDriver = (record) => {
    if (isReadOnly) return;
    setBdError('');
    setBdEditState({ record, defaultType: record.type, isPotentialAtc: isPotentialAtc === true });
  };

  const openDeleteBarrierDriver = (record) => {
    if (isReadOnly || record?.isKiteDataAdminPreLaunch || !record?.id || isDeletingBarrierDriver) return;
    const associatedActivities = activities.filter((activity) =>
      recordIdMatches(activity.barrierDriverId, record.id)
    );
    setDeleteState({
      record,
      associatedActivities,
      error: '',
    });
  };

  const closeDeleteBarrierDriver = () => {
    if (isDeletingBarrierDriver) return;
    setDeleteState(null);
  };

  const handleConfirmDeleteBarrierDriver = async () => {
    if (isReadOnly || !deleteState?.record?.id || isDeletingBarrierDriver) return;
    const record = deleteState.record;

    setIsDeletingBarrierDriver(true);
    setDeleteState((current) => current ? { ...current, error: '' } : current);
    try {
      await deleteBarrierDriverWithDependencies(record.id);

      if (record.type === 'Driver') {
        setDrivers((rows) => rows.filter((candidate) => !recordIdMatches(candidate.id, record.id)));
      } else {
        setBarriers((rows) => rows.filter((candidate) => !recordIdMatches(candidate.id, record.id)));
      }
      setExpandedRows((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      onNotify?.({
        title: `${record.type === 'Driver' ? 'Driver' : 'Barrier'} deleted.`,
        detail: 'The record was deleted.',
        refreshPages: true,
      });
      setDeleteState(null);
    } catch (error) {
      setDeleteState((current) => current ? {
        ...current,
        associatedActivities: Array.isArray(error?.activities) ? error.activities : current.associatedActivities,
        error: error?.message || 'Unable to delete Barrier/Driver.',
      } : current);
    } finally {
      setIsDeletingBarrierDriver(false);
    }
  };

  const closeBdModal = () => {
    if (isSavingBd) return;
    setBdEditState(null);
    setBdError('');
  };

  const openNewActivity = (parentRecord) => {
    if (isReadOnly) return;
    setActivityError('');
    setActivityEditState(null);
    setActivityCreateState({ parentRecord: parentRecord || null });
  };

  const openEditActivity = (activity) => {
    if (isReadOnly) return;
    setActivityError('');
    setActivityCreateState(null);
    const parent = activity.barrierDriverId ? recordById.get(activity.barrierDriverId) : null;
    setActivityEditState({ activity, parentRecord: parent });
  };

  const closeActivityModal = () => {
    if (isSavingActivity) return;
    setActivityEditState(null);
    setActivityCreateState(null);
    setActivityError('');
  };

  const handleSaveBarrierDriver = async (form) => {
   
    if (isReadOnly) return;
    const isCreate = !bdEditState.record?.id;
    const statusOnlyUpdate = !isCreate && (
      isClosedBarrierDriverStatus(bdEditState.record?.status) ||
      bdEditState.record?.isKiteDataAdminPreLaunch === true
    );
    const type = normalizedBarrierDriverType(form.type);
    const openActivityCount = bdEditState.record?.id ? (openCountByBarrier[bdEditState.record.id] || 0) : 0;
    if (!isCreate && isClosedBarrierDriverStatus(form.status) && openActivityCount > 0) {
      setBdError(closeBlockedByActivitiesMessage(type, openActivityCount));
      return;
    }

    setIsSavingBd(true);
    setBdError('');
    try {
      const formWithPlan = { ...form, accountPlanId: planId};
      if (statusOnlyUpdate) { 
        await saveBarrierDriverStatus(bdEditState.record.id, form.status);
        const updated = {
          ...bdEditState.record,
          status: normalizeBarrierDriverStatusForDisplay(form.status),
          lastModifiedDate: new Date().toISOString(),
        };
        if (updated.type === 'Driver') {
          setDrivers((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
        } else {
          setBarriers((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
        }
      } else if (!isCreate) {
        await saveBarrierDriver(bdEditState.record.id, {
          ...formWithPlan,
          previousIndication: bdEditState.record.indication || '',
        });
        const updated = applyBarrierDriverForm(bdEditState.record, formWithPlan, picklists);
        
        if (updated.type === 'Driver') {
          setDrivers((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
        } else {
          setBarriers((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
        }
        // The indication cascade (in updateBarrierDriver) re-stamps linked
        // critical activities; mirror that locally so the inline list doesn't
        // show a stale indication before the page reload.
        if ((formWithPlan.indication || '') !== (bdEditState.record.indication || '')) {
          setActivities((rows) =>
            rows.map((a) =>
              recordIdMatches(a.barrierDriverId, updated.id)
                ? { ...a, indication: formWithPlan.indication || '' }
                : a
            )
          );
        }
      } else {
        const formWithPlan = {...form,accountPlanId: planId, isPotentialAtc: bdEditState?.isPotentialAtc === true,};
        const result = await addBarrierDriver(planId, formWithPlan);
        const newRecord = applyBarrierDriverForm(
          { id: createdRecordId(result), type: formWithPlan.type },
          formWithPlan,
          picklists
        );
       
        if (newRecord.type === 'Driver') setDrivers((rows) => [newRecord, ...rows]);
        else setBarriers((rows) => [newRecord, ...rows]);
      }
      onNotify?.({
        title: statusOnlyUpdate
          ? `${activeRecordSingularLabel} status updated.`
          : `${activeRecordSingularLabel} saved.`,
        detail: statusOnlyUpdate
          ? `Status updated to ${normalizeBarrierDriverStatusForDisplay(form.status)}.`
          : 'Your changes have been saved.',
        refreshPages: true,
      });
      setBdEditState(null);
    } catch (error) {
      console.error('Barrier/Driver save failed', error, error && error.stack, form);
      setBdError(error && error.message ? error.message : 'Unable to save barrier/driver.');
    } finally {
      setIsSavingBd(false);
    }
  };

  const handleSaveActivity = async (form) => {
    if (isReadOnly) return;
    setIsSavingActivity(true);
    setActivityError('');
    try {
      const payload = {
        title: form.title,
        details: form.details,
        indication: form.indication,
        status: form.status,
        accountable: form.accountable,
        dueDate: form.dueDate,
        completedDate: form.completedDate,
      };
      if (form.kiteDataAdminLimitedUpdate) {
        payload.kiteDataAdminLimitedUpdate = true;
      }
      if (Object.prototype.hasOwnProperty.call(form, 'comments')) payload.comments = form.comments;
      if (Object.prototype.hasOwnProperty.call(form, 'deactivate')) payload.deactivate = form.deactivate;
      if (activityEditState.activity?.id) {
        const parentChanged =
          (form.parentId || '') !== (activityEditState.activity.barrierDriverId || '');
        if (parentChanged) {
          payload.parentId = form.parentId;
          payload.parentType = form.parentType;
          payload.parentRecordTypeId = form.parentRecordTypeId;
        }
        const result = await saveCriticalActivity(activityEditState.activity.id, payload);
        const updated = applyActivityForm(activityEditState.activity, form, recordById, result);
        const nextActivities = activities.map((r) => (r.id === updated.id ? updated : r));
        setActivities(nextActivities);
        if (onActivityChange) onActivityChange(updated);
        const parent = updated.barrierDriverId ? recordById.get(updated.barrierDriverId) : null;
        const prompt = buildLinkedBarrierDriverStatusPrompt({
          activity: activityEditState.activity,
          updated,
          rows: nextActivities,
          parent,
          statusOptions: barrierDriverStatusOptions,
        });
        if (prompt) {
          setPendingBarrierDriverStatusConfirm(prompt);
          setPendingBarrierDriverStatusPrompt(null);
          setBarrierDriverStatusPromptValue('');
          setBarrierDriverStatusPromptError('');
        }
      }
      onNotify?.({
        title: 'Critical activity saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setActivityEditState(null);
    } catch (error) {
      setActivityError(formatCriticalActivitySaveError(error));
    } finally {
      setIsSavingActivity(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (isReadOnly) return;
    if (activityEditState.activity?.isKiteDataAdminCreated) return;
    if (!activityEditState.activity?.id) return;
    setIsSavingActivity(true);
    setActivityError('');
    try {
      await deleteCriticalActivity(activityEditState.activity.id, activityEditState.activity);
      setActivities((rows) => rows.filter((r) => r.id !== activityEditState.activity.id));
      if (onActivityChange) {
        onActivityChange({ ...activityEditState.activity, isDeleted: true, isDeactivated: true });
      }
      onNotify?.({
        title: 'Critical activity deleted.',
        detail: 'The activity has been marked deleted.',
        refreshPages: true,
      });
      setActivityEditState(null);
    } catch (error) {
      setActivityError(error && error.message ? error.message : 'Unable to delete critical activity.');
    } finally {
      setIsSavingActivity(false);
    }
  };

  const handleCreateActivity = async (form) => {
    if (isReadOnly) return;
    if (!form.parentId) {
      setActivityError('Linked Barrier/Driver is required.');
      return;
    }
    if (!form.indication) {
      setActivityError('Indication is required.');
      return;
    }
    if (!openRecordById.has(form.parentId)) {
      setActivityError('Select an open linked Barrier/Driver.');
      return;
    }
    setIsSavingActivity(true);
    setActivityError('');
    try {
      const payload = {
        title: form.title,
        details: form.details,
        indication: form.indication,
        status: form.status,
        accountable: form.accountable,
        dueDate: form.dueDate,
        parentId: form.parentId,
        parentType: form.parentType,
        parentRecordTypeId: form.parentRecordTypeId,
      };
      const result = await addCriticalActivity(planId, payload);
      const created = applyActivityForm(
        {
          id: createdRecordId(result),
          planId,
          canEditComments: true,
          canDeactivate: true,
          isDeactivated: false,
        },
        form,
        recordById,
        result
      );
      setActivities((rows) => [created, ...rows]);
      if (onActivityChange) onActivityChange(created);
      onNotify?.({
        title: 'Critical activity saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setActivityCreateState(null);
    } catch (error) {
      setActivityError(formatCriticalActivitySaveError(error));
    } finally {
      setIsSavingActivity(false);
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
      const applyStatus = (record) =>
        record.id === prompt.parentId
          ? { ...record, status, lastModifiedDate: new Date().toISOString() }
          : record;
      setBarriers((rows) => rows.map(applyStatus));
      setDrivers((rows) => rows.map(applyStatus));
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
        error && error.message ? error.message : `Unable to update ${prompt.parentType} status.`
      );
    } finally {
      setIsSavingBarrierDriverStatus(false);
    }
  };

  const barrierDriverOptionsForActivity = useMemo(
    () =>
      allRecords.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        indication: r.indication,
        status: r.status,
        recordTypeId: r.recordTypeId,
      })),
    [allRecords]
  );
  const openBarrierDriverOptionsForActivity = useMemo(
    () => barrierDriverOptionsForActivity.filter(isOpenBarrierDriverRecord),
    [barrierDriverOptionsForActivity]
  );

  const isActivities = tab === 'activities';

  return (
    <section className={`page page-barriers-drivers mock-bd-page ${isActivities ? 'is-critical-activities-page' : ''} is-${activeRecordSingularLabel.toLowerCase()}-workspace`.trim()}>
      <article className="mock-control-panel bd-tabs-panel">
        <div className="bd-tabs-toolbar">
          <div className="bd-tab-row account-profile-tabs bd-workspace-tabs" role="tablist">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`bd-tab ${tab === t.key ? 'is-active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </article>

      <article className="mock-control-panel bd-command-panel">
        <div className="bd-command-body">
          <div className="mock-kpi-row bd-status-card-row" aria-label={`${activeRecordTypeLabel} status summary`}>
            <button
              type="button"
              className={`mock-kpi-card bd-status-card ${filters.status === 'Active' ? 'is-active' : ''}`}
              onClick={() => setFilters({ ...filters, status: 'Active' })}
              aria-pressed={filters.status === 'Active'}
            >
              <span>Active {activeRecordTypeLabel}</span>
              <strong>{statusKpis.open}</strong>
            </button>
            <button
              type="button"
              className={`mock-kpi-card bd-status-card ${filters.status === 'Closed' ? 'is-active' : ''}`}
              onClick={() => setFilters({ ...filters, status: 'Closed' })}
              aria-pressed={filters.status === 'Closed'}
            >
              <span>Closed {activeRecordTypeLabel}</span>
              <strong>{statusKpis.closed}</strong>
            </button>
          </div>

          {/* "Filter" label dropped — the picklists are self-explanatory.
              The status + indication picklists themselves stay. */}
          <div className="mock-filter-row bd-filter-strip">
          {!isActivities && (
            <div className="bd-filter-select-box">
              <label className="select-shell">
                <select
                  name="barrierDriverStatusFilter"
                  aria-label={`${activeRecordSingularLabel} status filter`}
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="All">Status (All)</option>
                  <option value="Active">Active {activeRecordTypeLabel}</option>
                  {statusFilterOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              {tab === 'hierarchy' && (
                <label className="select-shell">
                  <select
                    name="barrierDriverTypeFilter"
                    aria-label="Barrier or driver type filter"
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  >
                    {(picklists.barrierTypeFilters || ['All', 'Barriers', 'Drivers']).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === 'All' ? 'Type (All)' : opt}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="select-shell">
                <select
                  name="barrierDriverIndicationFilter"
                  aria-label="Indication filter"
                  value={filters.indication}
                  onChange={(e) => setFilters({ ...filters, indication: e.target.value })}
                >
                  {indicationOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Indication' : opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-shell">
                <select
                  name="barrierDriverCategoryFilter"
                  aria-label={`${activeRecordSingularLabel} category filter`}
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                >
                  {categoryFilterOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Category (All)' : opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-shell">
                <select
                  name="barrierDriverStrategyFilter"
                  aria-label="Strategy filter"
                  value={filters.strategy}
                  onChange={(e) => setFilters({ ...filters, strategy: e.target.value })}
                >
                  {strategyFilterOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Strategy (All)' : strategyLabelForValue(picklists, opt)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {!isActivities && (
            <button
              type="button"
              className="button bd-add-record-button bd-filter-add-button"
              aria-disabled={isReadOnly || activeAddLimitReached}
              disabled={isReadOnly || activeAddLimitReached}
              title={activeAddLimitMessage}
              onClick={() => openNewBarrierDriver(activeAddType)}
            >
              Add {activeAddType}
            </button>
          )}
          {tab === 'activities' && (
            <>
              <label className="select-shell">
                <select
                  name="criticalActivityAccountableFilter"
                  aria-label="Critical activity accountable filter"
                  value={filters.accountable}
                  onChange={(e) => setFilters({ ...filters, accountable: e.target.value })}
                >
                  {accountableOptionsForFilters.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Accountable (All)' : opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-shell">
                <select
                  name="criticalActivityDriverTitleFilter"
                  aria-label="Critical activity driver title filter"
                  value={filters.driverTitle}
                  onChange={(e) => setFilters({ ...filters, driverTitle: e.target.value })}
                >
                  {driverTitleOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Driver Title (All)' : opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-shell">
                <select
                  name="criticalActivityBarrierTitleFilter"
                  aria-label="Critical activity barrier title filter"
                  value={filters.barrierTitle}
                  onChange={(e) => setFilters({ ...filters, barrierTitle: e.target.value })}
                >
                  {barrierTitleOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'Barrier Title (All)' : opt}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button primary-red filter-row-action"
                disabled={isReadOnly}
                onClick={() => openNewActivity(null)}
              >
                New Activity
              </button>
            </>
          )}
          </div>
          {bdError && !bdEditState && (
            <div className="critical-activity-edit-error bd-inline-error" role="alert">
              {bdError}
            </div>
          )}
        </div>
      </article>

      {tab === 'hierarchy' && (
        <article className="mock-card bd-hierarchy-card">
          <div className="mock-section-head">
            <div>
              <h3>Barriers/Drivers Hierarchy</h3>
              <p>Critical activities are hidden until the barrier or driver is expanded.</p>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="button bd-add-record-button"
                aria-disabled={isReadOnly || barrierLimitReached}
                disabled={isReadOnly || barrierLimitReached}
                title={barrierAddLimitMessage}
                onClick={() => openNewBarrierDriver('Barrier')}
              >
                Add Barrier
              </button>
              <button
                type="button"
                className="button bd-add-record-button"
                aria-disabled={isReadOnly || driverLimitReached}
                disabled={isReadOnly || driverLimitReached}
                title={driverAddLimitMessage}
                onClick={() => openNewBarrierDriver('Driver')}
              >
                Add Driver
              </button>
            </div>
          </div>

          <div className="bd-hierarchy-list">
            {filteredRecords.length === 0 && (
              <div className="empty-state small">No barriers or drivers match the current filters.</div>
            )}
            {filteredRecords.map((record) => (
              <HierarchyRow
                key={record.id}
                record={record}
                openCountMap={openCountByBarrier}
                closedCountMap={closedCountByBarrier}
                isExpanded={!!expandedRows[record.id]}
                activities={filteredEntryActivities(record)}
                picklists={picklists}
                onToggle={() => toggleRow(record.id)}
                onEdit={openEditBarrierDriver}
                onDelete={openDeleteBarrierDriver}
                onAddActivity={openNewActivity}
                onEditActivity={openEditActivity}
                isReadOnly={isReadOnly}
              />
            ))}

            {filteredPlanLevelActivities.length > 0 && (
              <article className="bd-tree-row is-plan-level">
                <div className="bd-tree-main">
                  <button
                    type="button"
                    className="bd-expand-button"
                    onClick={() => setPlanLevelExpanded((v) => !v)}
                    aria-expanded={planLevelExpanded}
                  >
                    <ExpandIcon expanded={planLevelExpanded} />
                  </button>
                  <div className="bd-tree-copy">
                    <div className="bd-tree-title-line">
                      <span className="bd-type-pill">Plan</span>
                      <h4>Plan-Level Critical Activities</h4>
                    </div>
                    <p>Critical activities not attached to a visible barrier or driver.</p>
                    <div className="bd-chip-row">
                      <span className="chip chip-green">
                        {filteredPlanLevelActivities.length} activities
                      </span>
                    </div>
                  </div>
                </div>
                {planLevelExpanded && (
                  <div className="bd-activity-branch">
                    <div className="bd-activity-branch-head">
                      <strong>Critical Activities</strong>
                      <span>{filteredPlanLevelActivities.length} total</span>
                    </div>
                    {filteredPlanLevelActivities.map((activity) => (
                      <article key={activity.id} className="bd-activity-card">
                        <div>
                          <h4 title={activity.name || ''}>{truncateDisplay(activity.name || 'Untitled', TITLE_DISPLAY_LIMIT)}</h4>
                          {activity.details && (
                            <p className="bd-activity-description bd-critical-activity-details">
                              <span>Details</span> {activity.details}
                            </p>
                          )}
                          <div className="bd-chip-row">
                            <span className="chip">
                              Linked Barrier/Driver {truncateDisplay(activity.parentName || 'Plan-level', TITLE_DISPLAY_LIMIT)}
                            </span>
                            <span className={`chip ${statusTone(activity.status)}`}>
                              Activity Status {activityStatusLabel(activity)}
                            </span>
                            <span className="chip">Created By {activity.createdBy || 'Not entered'}</span>
                            <span className="chip">Accountable {activity.ownerLabel || 'Unassigned'}</span>
                            <span className="chip">
                              Due Date {activity.dueDate ? formatDateLabel(activity.dueDate, 'Not entered') : 'Not entered'}
                            </span>
                            <span className="chip">
                              Last Modified Date {formatDateLabel(activity.lastModifiedDate, 'Not entered')}
                            </span>
                          </div>
                        </div>
                        <EditIconButton
                          ariaLabel={`Edit ${activity.name || 'critical activity'}`}
                          onClick={() => openEditActivity(activity)}
                          disabled={isReadOnly}
                        />
                      </article>
                    ))}
                  </div>
                )}
              </article>
            )}
          </div>
        </article>
      )}

      {tab === 'barriers' && (
        <article className="mock-card bd-record-card">
          <div className="bd-hierarchy-list bd-card-list">
            {filteredBarriers.length === 0 && (
              <div className="empty-state small">No barriers match the current filters.</div>
            )}
            {filteredBarriers.map((barrier) => (
              <RecordCard
                key={barrier.id}
                record={barrier}
                isExpanded={!!expandedRows[barrier.id]}
                activities={filteredEntryActivities(barrier)}
                openCountMap={openCountByBarrier}
                closedCountMap={closedCountByBarrier}
                onToggle={() => toggleRow(barrier.id)}
                onEdit={openEditBarrierDriver}
                onDelete={openDeleteBarrierDriver}
                onAddActivity={openNewActivity}
                onEditActivity={openEditActivity}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        </article>
      )}

      {tab === 'drivers' && (
        <article className="mock-card bd-record-card">
          <div className="bd-hierarchy-list bd-card-list">
            {filteredDrivers.length === 0 && (
              <div className="empty-state small">No drivers match the current filters.</div>
            )}
            {filteredDrivers.map((driver) => (
              <RecordCard
                key={driver.id}
                record={driver}
                isExpanded={!!expandedRows[driver.id]}
                activities={filteredEntryActivities(driver)}
                openCountMap={openCountByBarrier}
                closedCountMap={closedCountByBarrier}
                onToggle={() => toggleRow(driver.id)}
                onEdit={openEditBarrierDriver}
                onDelete={openDeleteBarrierDriver}
                onAddActivity={openNewActivity}
                onEditActivity={openEditActivity}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        </article>
      )}

      {tab === 'activities' && (
        <article className="critical-activity-records">
          <div className="critical-activity-table-stack">
            {activitySections.map((section) => (
              <ActivitiesSection
                key={section.key}
                section={section}
                sort={sorts[section.key]}
                onSort={handleSort}
                onEdit={openEditActivity}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        </article>
      )}

      {!isReadOnly && bdEditState && (
        <BarrierDriverEditModal
          record={bdEditState.record}
          defaultType={bdEditState.defaultType}
          isPotentialAtc={bdEditState.isPotentialAtc}
          picklists={picklists}
          isSaving={isSavingBd}
          error={bdError}
          onClose={closeBdModal}
          onBarrierOpenReferencePdf={() => setIsBarrierReferencePdfOpen(true)}
          onDriverOpenReferencePdf={() => setDriverIsReferencePdfOpen(true)}
          onSave={handleSaveBarrierDriver}
        />
      )}

      {deleteState && (
        <BarrierDriverDeleteModal
          record={deleteState.record}
          associatedActivities={deleteState.associatedActivities}
          error={deleteState.error}
          isDeleting={isDeletingBarrierDriver}
          onCancel={closeDeleteBarrierDriver}
          onConfirm={handleConfirmDeleteBarrierDriver}
        />
      )}

      {!isReadOnly && activityEditState && (
        <CriticalActivityEditModal
          activity={activityEditState.activity}
          parentRecord={activityEditState.parentRecord}
          barrierDriverOptions={barrierDriverOptionsForActivity}
          indicationOptions={activityIndicationOptions}
          accountableOptions={picklists.accountableMembers || []}
          statusOptions={picklists.activityStatuses || []}
          editDisabledReason={activityEditState.activity?.editDisabledReason || ''}
          isSaving={isSavingActivity}
          error={activityError}
          onClose={closeActivityModal}
          onSave={handleSaveActivity}
          onDelete={handleDeleteActivity}
        />
      )}

      {!isReadOnly && activityCreateState && (
        <CriticalActivityNewModal
          barrierDriverOptions={openBarrierDriverOptionsForActivity}
          parentRecord={activityCreateState.parentRecord}
          indicationOptions={activityIndicationOptions}
          accountableOptions={picklists.accountableMembers || []}
          statusOptions={picklists.activityStatuses || []}
          isSaving={isSavingActivity}
          error={activityError}
          onClose={closeActivityModal}
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

      {isBarrierReferencePdfOpen && (
       
        <BarrierReferencePdfModal
          src={apBarriersTacticalActionPdf}
          onClose={() => setIsBarrierReferencePdfOpen(false)}
        />
      )}
      {isDriverReferencePdfOpen && (
         <DriverReferencePdfModal
          src={apDriverTacticalActionPdf}
          onClose={() => setDriverIsReferencePdfOpen(false)}
        />
        
      )}
      
    </section>
  );
}
