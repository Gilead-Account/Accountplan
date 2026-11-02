import { useEffect } from 'react';
import {
  isClosedBarrierDriverStatus,
  normalizeBarrierDriverStatusForDisplay,
} from '@/lib/dataservice/accountPlan/shared';

const COMPLETED_STATUS_KEYS = new Set(['complete', 'completed', 'closed']);

const activityStatusKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const isCompletedActivityStatusValue = (status) =>
  COMPLETED_STATUS_KEYS.has(activityStatusKey(status));

const parentTypeTitle = (type) => (String(type || '').trim().toLowerCase() === 'driver' ? 'Driver' : 'Barrier');
const parentTypeLabel = (type) => parentTypeTitle(type).toLowerCase();

export const linkedBarrierDriverCloseBlockedMessage = (prompt) =>
  `All Critical Activities must be Complete before the ${prompt?.parentTypeLabel || 'linked record'} can be Closed.`;

export const mergeBarrierDriverStatusOptions = (base = [], currentStatus = '') => {
  const seen = new Set();
  const out = [];
  for (const rawValue of [...(base || []), currentStatus]) {
    const value = normalizeBarrierDriverStatusForDisplay(rawValue);
    const key = String(value || '').trim().toLowerCase();
    if (!value || value === 'All' || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
};

const remainingOpenActivitiesForParent = (rows, parentId, completedActivityId) =>
  (rows || []).filter((row) =>
    row &&
    row.isDeactivated !== true &&
    row.id !== completedActivityId &&
    (row.barrierDriverId || '') === (parentId || '') &&
    !isCompletedActivityStatusValue(row.status)
  );

export const shouldPromptForBarrierDriverStatus = (activity, updated) =>
  Boolean(updated?.barrierDriverId) &&
  !isCompletedActivityStatusValue(activity?.status) &&
  isCompletedActivityStatusValue(updated?.status);

const initialPromptStatus = (statusOptions, currentStatus, remainingOpenActivityCount) => {
  const normalizedCurrent = normalizeBarrierDriverStatusForDisplay(currentStatus);
  const hasOpenActivities = remainingOpenActivityCount > 0;
  if (
    normalizedCurrent &&
    statusOptions.includes(normalizedCurrent) &&
    !(hasOpenActivities && isClosedBarrierDriverStatus(normalizedCurrent))
  ) {
    return normalizedCurrent;
  }
  return statusOptions.find((option) => !(hasOpenActivities && isClosedBarrierDriverStatus(option))) || '';
};

export const buildLinkedBarrierDriverStatusPrompt = ({
  activity,
  updated,
  rows,
  parent,
  statusOptions,
}) => {
  if (!parent || !shouldPromptForBarrierDriverStatus(activity, updated)) return null;
  const remainingOpenActivities = remainingOpenActivitiesForParent(rows, parent.id, updated.id);
  const remainingOpenActivityCount = remainingOpenActivities.length;
  const promptStatusOptions = mergeBarrierDriverStatusOptions(statusOptions, parent.status);
  const typeTitle = parentTypeTitle(parent.type);
  return {
    activityId: updated.id,
    activityName: updated.name || 'Untitled critical activity',
    parentId: parent.id,
    parentName: parent.name || 'Untitled',
    parentType: typeTitle,
    parentTypeLabel: parentTypeLabel(typeTitle),
    currentStatus: normalizeBarrierDriverStatusForDisplay(parent.status),
    remainingOpenActivityCount,
    statusOptions: promptStatusOptions,
    initialStatus: initialPromptStatus(promptStatusOptions, parent.status, remainingOpenActivityCount),
  };
};

export function LinkedBarrierDriverStatusConfirmModal({
  prompt,
  onDismiss,
  onConfirm,
}) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  if (!prompt) return null;

  return (
    <div
      className="stakeholder-edit-overlay critical-activity-status-confirm-overlay"
      onClick={onDismiss}
      role="presentation"
    >
      <section
        className="stakeholder-edit-modal critical-activity-status-confirm-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <h3>Linked {prompt.parentType} Status</h3>
            <p>{prompt.parentType}: {prompt.parentName}</p>
          </div>
          <button
            type="button"
            className="stakeholder-edit-close"
            onClick={onDismiss}
            aria-label="Close"
          />
        </header>

        <div className="stakeholder-edit-body critical-activity-status-confirm-body">
          <div className="critical-activity-status-prompt-summary">
            <span className="critical-activity-status-prompt-label">Completed activity</span>
            <strong>{prompt.activityName}</strong>
          </div>
          <p className="critical-activity-status-confirm-question">
            Do you want to change the status of the linked {prompt.parentTypeLabel}?
          </p>
        </div>

        <footer className="stakeholder-edit-foot">
          <button
            type="button"
            className="stakeholder-edit-button-secondary"
            onClick={onDismiss}
          >
            Skip
          </button>
          <button
            type="button"
            className="stakeholder-edit-button-primary"
            onClick={onConfirm}
          >
            Change Status
          </button>
        </footer>
      </section>
    </div>
  );
}

export function LinkedBarrierDriverStatusPromptModal({
  prompt,
  value,
  error,
  isSaving,
  onChange,
  onDismiss,
  onSave,
}) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !isSaving) onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSaving, onDismiss]);

  if (!prompt) return null;
  const hasOpenActivities = prompt.remainingOpenActivityCount > 0;
  const visibleBarrierDriverStatusOptions = hasOpenActivities
    ? prompt.statusOptions.filter((option) => !isClosedBarrierDriverStatus(option))
    : prompt.statusOptions;

  return (
    <div
      className="stakeholder-edit-overlay critical-activity-status-prompt-overlay"
      onClick={isSaving ? undefined : onDismiss}
      role="presentation"
    >
      <form
        className="stakeholder-edit-modal critical-activity-status-prompt-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <h3>Review Linked {prompt.parentType} Status</h3>
            <p>{prompt.parentType}: {prompt.parentName}</p>
          </div>
          <button
            type="button"
            className="stakeholder-edit-close"
            onClick={onDismiss}
            aria-label="Close"
            disabled={isSaving}
          />
        </header>

        <div className="stakeholder-edit-body critical-activity-status-prompt-body">
          <div className="critical-activity-status-prompt-summary">
            <span className="critical-activity-status-prompt-label">Completed activity</span>
            <strong>{prompt.activityName}</strong>
          </div>

          <label className="stakeholder-edit-field critical-activity-status-prompt-field">
            <span className="stakeholder-edit-field-label">{prompt.parentType} Status</span>
            <select
              value={value}
              disabled={isSaving}
              required
              onChange={(event) => onChange(event.target.value)}
            >
              {visibleBarrierDriverStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          {hasOpenActivities && (
            <p className="critical-activity-status-prompt-note">
              All Critical Activities must be Complete before the {prompt.parentTypeLabel} can be Closed.
            </p>
          )}

          {error && <div className="critical-activity-edit-error">{error}</div>}
        </div>

        <footer className="stakeholder-edit-foot">
          <button
            type="button"
            className="stakeholder-edit-button-secondary"
            onClick={onDismiss}
            disabled={isSaving}
          >
            Skip
          </button>
          <button
            type="submit"
            className="stakeholder-edit-button-primary"
            disabled={isSaving || !value}
          >
            {isSaving ? 'Updating' : 'Update Status'}
          </button>
        </footer>
      </form>
    </div>
  );
}
