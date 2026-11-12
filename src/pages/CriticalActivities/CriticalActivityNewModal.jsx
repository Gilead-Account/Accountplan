import { useEffect, useMemo, useState } from 'react';
import Field, { FieldHelpButton } from '@/components/EditModalField';
import { CRITICAL_ACTIVITY_HELP } from '@/pages/CriticalActivities/criticalActivityHelp';
import {
  isOpenBarrierDriverOption,
  optionForId,
} from '@/pages/CriticalActivities/linkedBarrierDriverOptions';

const CRITICAL_ACTIVITY_TITLE_MAX_LENGTH = 55;

const buildInitialForm = (statusOptions = [], parentRecord = null, relatedOptions = []) => {
  const parentOption = parentRecord?.id ? optionForId(relatedOptions, parentRecord.id) : null;
  return {
    title: '',
    details: '',
    // Indication is inherited from the linked barrier/driver — never chosen
    // directly — so an activity always matches its parent's indication.
    indication: parentOption?.indication || '',
    status: statusOptions[0] || 'Planned',
    accountable: '',
    dueDate: '',
    parentId: parentOption?.id || '',
    parentType: parentOption?.type || '',
    parentRecordTypeId: parentOption?.recordTypeId || '',
  };
};

const mergeOptions = (current, options) => {
  const seen = new Set();
  const out = [];
  for (const value of [current, ...(options || [])]) {
    if (!value || value === 'All' || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

export default function CriticalActivityNewModal({
  barrierDriverOptions,
  parentRecord,
  indicationOptions,
  accountableOptions,
  statusOptions,
  isSaving,
  error,
  onClose,
  onSave,
}) {
  const relatedOptions = useMemo(
    () => (barrierDriverOptions || []).filter((option) => option && option.id && isOpenBarrierDriverOption(option)),
    [barrierDriverOptions]
  );
  const hasRelatedOptions = relatedOptions.length > 0;
  // When opened from a specific barrier/driver ("Add activity" on its card), the
  // linked record is fixed — show it locked rather than a changeable dropdown.
  const lockedParentOption = useMemo(
    () => (parentRecord?.id ? relatedOptions.find((option) => option.id === parentRecord.id) || null : null),
    [parentRecord?.id, relatedOptions]
  );
  const [form, setForm] = useState(() => buildInitialForm(statusOptions, parentRecord, relatedOptions));
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setForm(buildInitialForm(statusOptions, parentRecord, relatedOptions));
  }, [statusOptions, parentRecord?.id, relatedOptions]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSaving, onClose]);

  const modalAccountableOptions = useMemo(
    () => mergeOptions(form.accountable, accountableOptions),
    [form.accountable, accountableOptions]
  );
  const modalStatusOptions = useMemo(
    () => mergeOptions(form.status, statusOptions),
    [form.status, statusOptions]
  );
  const updateField = (key, value) => {
    setValidationError('');
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'parentId') {
        const found = optionForId(relatedOptions, value);
        next.parentType = found ? found.type : '';
        next.parentRecordTypeId = found ? (found.recordTypeId || '') : '';
        // Inherit the linked barrier/driver's indication.
        next.indication = found ? (found.indication || '') : '';
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasRelatedOptions) {
      setValidationError('Create or reopen a barrier or driver before adding a critical activity.');
      return;
    }
    if (!form.title.trim() || !form.details.trim() || !form.parentId || !form.indication || !form.dueDate) {
      setValidationError('Critical Activity Title, Details, Linked Barrier/Driver, Indication, and Due Date are required.');
      return;
    }
    const selectedParent = optionForId(relatedOptions, form.parentId);
    if (!selectedParent) {
      setValidationError('Select an open linked Barrier/Driver.');
      return;
    }
    if (form.title.trim().length > CRITICAL_ACTIVITY_TITLE_MAX_LENGTH) {
      setValidationError(`Critical Activity Title must be ${CRITICAL_ACTIVITY_TITLE_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (form.accountable && modalAccountableOptions.length && !modalAccountableOptions.includes(form.accountable)) {
      setValidationError('Select a valid accountable POD member.');
      return;
    }
    if (onSave) {
      onSave({
        ...form,
        parentId: selectedParent.id,
        parentType: selectedParent.type,
        parentRecordTypeId: selectedParent.recordTypeId || '',
      });
    }
  };

  return (
    <div className="stakeholder-edit-overlay" onClick={isSaving ? undefined : onClose} role="presentation">
      <form
        className="stakeholder-edit-modal critical-activity-edit-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <h3>New Critical Activity</h3>
            <div className="stakeholder-edit-subtitle-row">
              <p>Create a critical activity for this account plan</p>
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
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </Field>

              <Field label="Status" help={CRITICAL_ACTIVITY_HELP.status}>
                <select
                  value={form.status}
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
                {lockedParentOption ? (
                  <input
                    type="text"
                    readOnly
                    aria-readonly="true"
                    value={`${lockedParentOption.type}: ${lockedParentOption.name || 'Untitled'}`}
                  />
                ) : (
                  <select
                    value={form.parentId}
                    required
                    disabled={!hasRelatedOptions}
                    onChange={(e) => updateField('parentId', e.target.value)}
                  >
                    <option value="">Select linked barrier or driver</option>
                    {relatedOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.type}: {option.name || 'Untitled'}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <Field label="Due Date" className="critical-activity-due-date-field">
                <input
                  className="critical-activity-due-date-input"
                  data-field-help={CRITICAL_ACTIVITY_HELP.dueDate}
                  name="criticalActivityDueDate"
                  type="date"
                  required
                  value={form.dueDate}
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
                  required
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
          <button
            type="button"
            className="stakeholder-edit-button-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="stakeholder-edit-button-primary" disabled={isSaving}>
            {isSaving ? 'Saving' : 'Save'}
          </button>
        </footer>
      </form>
    </div>
  );
}
