import { useEffect, useMemo, useState } from 'react';
import Field, { FieldHelpButton } from '@/components/EditModalField';
import { CRITICAL_ACTIVITY_HELP } from '@/pages/CriticalActivities/criticalActivityHelp';
import {
  isOpenBarrierDriverOption,
  linkedBarrierDriverSelectOptions,
  optionForId,
} from '@/pages/CriticalActivities/linkedBarrierDriverOptions';

const CRITICAL_ACTIVITY_TITLE_MAX_LENGTH = 55;

const toDateInputValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const displayStatus = (status) => {
  return status || 'Planned';
};

const buildInitialForm = (activity, parentRecord, allowedParentOptions) => {
  const preferredParentId = activity?.barrierDriverId || parentRecord?.id || '';
  const allowedParent = optionForId(allowedParentOptions, preferredParentId);
  return {
    title: activity?.name || '',
    details: activity?.details || '',
    indication: allowedParent?.indication || activity?.indication || '',
    status: displayStatus(activity?.status),
    accountable: activity?.ownerLabel || '',
    dueDate: toDateInputValue(activity?.dueDate),
    completedDate: toDateInputValue(activity?.completedDate),
    parentId: allowedParent?.id || '',
    parentType: allowedParent?.type || '',
    parentRecordTypeId: allowedParent?.recordTypeId || '',
  };
};

const mergeOptions = (current, options) => {
  const seen = new Set();
  const out = [];
  for (const value of [current, ...(options || [])]) {
    if (!value || value === 'All' || value === 'Unassigned' || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

const restrictedOptions = (current, options) => {
  const source = (options || []).filter(Boolean);
  return source.length ? source : mergeOptions(current, source);
};

export default function CriticalActivityEditModal({
  activity,
  parentRecord,
  barrierDriverOptions,
  indicationOptions,
  accountableOptions,
  statusOptions,
  editDisabledReason = '',
  isSaving,
  error,
  onClose,
  onSave,
  onDelete,
}) {
  const isEdit = !!activity?.id;
  const allowedParentOptions = useMemo(
    () => barrierDriverOptions || [],
    [barrierDriverOptions]
  );
  const [form, setForm] = useState(
    () => buildInitialForm(activity, parentRecord, allowedParentOptions)
  );
  const [validationError, setValidationError] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    setForm(buildInitialForm(activity, parentRecord, allowedParentOptions));
    setValidationError('');
    setConfirmDeleteOpen(false);
  }, [
    activity?.id,
    activity?.barrierDriverId,
    allowedParentOptions,
    parentRecord?.id,
    parentRecord?.indication,
    parentRecord?.type,
  ]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || isSaving) return;
      if (confirmDeleteOpen) {
        setConfirmDeleteOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDeleteOpen, isSaving, onClose]);

  const modalAccountableOptions = useMemo(
    () => restrictedOptions(form.accountable, accountableOptions),
    [form.accountable, accountableOptions]
  );
  const modalStatusOptions = useMemo(
    () => mergeOptions(form.status, statusOptions),
    [form.status, statusOptions]
  );
  const canDeactivate = activity?.canDeactivate !== false;
  const relatedOptions = useMemo(
    () => linkedBarrierDriverSelectOptions(allowedParentOptions, form.parentId),
    [allowedParentOptions, form.parentId]
  );
  const hasRelatedOptions = relatedOptions.length > 0;
  const selectedParentOption = useMemo(
    () => optionForId(relatedOptions, form.parentId),
    [relatedOptions, form.parentId]
  );
  const allFieldsDisabled = Boolean(editDisabledReason) || Boolean(
    isEdit &&
    selectedParentOption &&
    !isOpenBarrierDriverOption(selectedParentOption)
  );
  const kiteDataAdminLimitedMode = isEdit && activity?.isKiteDataAdminCreated === true;
  const remainingFieldsDisabled = allFieldsDisabled || kiteDataAdminLimitedMode;

  const updateField = (key, value) => {
    setValidationError('');
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'parentId') {
        const found = optionForId(relatedOptions, value);
        next.parentType = found ? found.type : '';
        next.parentRecordTypeId = found ? (found.recordTypeId || '') : '';
        next.indication = found ? (found.indication || '') : '';
      }
      return next;
    });
  };

  const requestDelete = () => {
    setValidationError('');
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (onDelete && activity) onDelete(activity);
  };

  const cancelDelete = () => {
    setConfirmDeleteOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setValidationError('Critical Activity Title is required.');
      return;
    }
    if (form.title.trim().length > CRITICAL_ACTIVITY_TITLE_MAX_LENGTH) {
      setValidationError(`Critical Activity Title must be ${CRITICAL_ACTIVITY_TITLE_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (!form.parentId) {
      setValidationError('Linked Barrier/Driver is required.');
      return;
    }
    if (!form.indication) {
      setValidationError('Indication is required.');
      return;
    }
    if (!form.dueDate) {
      setValidationError('Due Date is required.');
      return;
    }
    if (!isEdit && !hasRelatedOptions) {
      setValidationError('Create or reopen a barrier or driver before adding a critical activity.');
      return;
    }
    if (!isEdit && !optionForId(relatedOptions, form.parentId)) {
      setValidationError('Select an open linked Barrier/Driver.');
      return;
    }
    if (allFieldsDisabled) {
      setValidationError(
        editDisabledReason || 'Select an open linked Barrier/Driver before saving this critical activity.'
      );
      return;
    }
    if (form.accountable && modalAccountableOptions.length && !modalAccountableOptions.includes(form.accountable)) {
      setValidationError('Select a valid accountable POD member.');
      return;
    }
    if (onSave) onSave({
      ...form,
      kiteDataAdminLimitedUpdate: kiteDataAdminLimitedMode,
    });
  };

  if (!activity && isEdit) return null;

  const title = isEdit ? 'Edit Critical Activity' : 'New Critical Activity';
  const subtitle = isEdit
    ? activity.name || 'Untitled'
    : parentRecord
      ? `Linked to ${parentRecord.type}: ${parentRecord.name || 'Untitled'}`
      : 'Select a linked barrier or driver';

  return (
    <div
      className="stakeholder-edit-overlay"
      onClick={isSaving || confirmDeleteOpen ? undefined : onClose}
      role="presentation"
    >
      <form
        className={`stakeholder-edit-modal critical-activity-edit-modal bd-critical-activity-modal ${remainingFieldsDisabled ? 'is-fields-locked' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <h3>{title}</h3>
            <div className="stakeholder-edit-subtitle-row">
              <p>{subtitle}</p>
              <FieldHelpButton
                className="stakeholder-edit-subtitle-help"
                label="Critical sub-header guidance"
                text={CRITICAL_ACTIVITY_HELP.subheader}
              />
            </div>
          </div>
          <button
            type="button"
            className="stakeholder-edit-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isSaving}
          />
        </header>

        <div className="stakeholder-edit-body">
          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-grid">
              <Field label="Critical Activity Title" help={CRITICAL_ACTIVITY_HELP.title}>
                <input
                  type="text"
                  value={form.title}
                  maxLength={CRITICAL_ACTIVITY_TITLE_MAX_LENGTH}
                  required
                  readOnly={remainingFieldsDisabled}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </Field>

              <Field label="Activity Status" help={CRITICAL_ACTIVITY_HELP.status}>
                <select
                  value={form.status}
                  disabled={isSaving || allFieldsDisabled}
                  onChange={(e) => updateField('status', e.target.value)}
                >
                  {modalStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Linked Barrier/Driver" help={CRITICAL_ACTIVITY_HELP.linkedBarrierDriver}>
                <select
                  value={form.parentId}
                  required
                  disabled={remainingFieldsDisabled || (!isEdit && !hasRelatedOptions)}
                  onChange={(e) => updateField('parentId', e.target.value)}
                >
                  <option value="">Select linked barrier or driver</option>
                  {relatedOptions.map((opt) => (
                    <option key={opt.id} value={opt.id} hidden={!!opt.isCurrentClosedSelection}>
                      {opt.type}: {opt.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Due Date" className="critical-activity-due-date-field">
                <input
                  className="critical-activity-due-date-input"
                  data-field-help={CRITICAL_ACTIVITY_HELP.dueDate}
                  name="criticalActivityDueDate"
                  type="date"
                  value={form.dueDate}
                  required
                  disabled={remainingFieldsDisabled}
                  onChange={(e) => updateField('dueDate', e.target.value)}
                />
              </Field>

              <Field label="Indication" help={CRITICAL_ACTIVITY_HELP.indication}>
                <input
                  type="text"
                  readOnly
                  value={form.indication}
                  placeholder="Set by the linked barrier/driver"
                />
              </Field>

              <Field label="Accountable" help={CRITICAL_ACTIVITY_HELP.accountable}>
                <select
                  value={form.accountable}
                  disabled={remainingFieldsDisabled}
                  onChange={(e) => updateField('accountable', e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {modalAccountableOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Details" help={CRITICAL_ACTIVITY_HELP.details} className="is-textarea">
                <textarea
                  rows={3}
                  value={form.details}
                  maxLength={255}
                  readOnly={allFieldsDisabled}
                  onChange={(e) => updateField('details', e.target.value)}
                />
              </Field>
            </div>
          </section>
          {(validationError || error) && (
            <div className="critical-activity-edit-error">{validationError || error}</div>
          )}
        </div>

        <footer className="stakeholder-edit-foot">
          {isEdit && canDeactivate && onDelete && (
            <button
              type="button"
              className="critical-activity-delete-button"
              onClick={requestDelete}
              disabled={isSaving || kiteDataAdminLimitedMode}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            className="stakeholder-edit-button-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="stakeholder-edit-button-primary" disabled={isSaving || allFieldsDisabled}>
            {isSaving ? 'Saving' : 'Save'}
          </button>
        </footer>
      </form>

      {confirmDeleteOpen && (
        <div
          className="critical-activity-confirm-scrim"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
        >
          <section
            className="critical-activity-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="criticalActivityDeactivateConfirmTitle"
          >
            <h4 id="criticalActivityDeactivateConfirmTitle">
              Are you sure you want to delete this critical activity?
            </h4>
            <div className="critical-activity-confirm-actions">
              <button
                type="button"
                className="stakeholder-edit-button-secondary"
                onClick={cancelDelete}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="critical-activity-delete-button confirm"
                onClick={confirmDelete}
                disabled={isSaving}
              >
                Confirm Delete
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
