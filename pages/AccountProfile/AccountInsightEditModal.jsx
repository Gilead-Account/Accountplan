import { useContext, useEffect, useState } from 'react';
import Field, { FieldHelpButton } from '@/components/EditModalField';
import { formatDateLabel } from '@/lib/helper/utils';
import { PotentialAtcContext } from '../../lib/dataservice/accountPlan/PotentialAtcContext';

const ACCOUNT_INSIGHT_HELP = {
  subheader:
    'Capture Account Insights. This section can be updated at any time as new insights or learnings emerge; there is no required update frequency.',
  indication:
    'Select the indication this account insight applies to.',
  insightCategory:
    'Select the insightCategory this account insight applies to.',
  insight:
    'Capture best practices, key learnings, and insights that help inform account strategy, decision-making, and future engagement.',
};

const buildInitialForm = (record) => ({
  id: record?.id || null,
  indication: record?.indication || '',
  insightCategory: record?.insightCategory || '',
  insightText: record?.insightText || '',
  insightDate: record?.insightDate || new Date().toISOString().slice(0, 10),
  createdBy: record?.createdBy || '',
});

const mergeIndicationOptions = (options, currentValue) => {
  const seen = new Set();
  const out = [];
  const addOption = (option) => {
    if (!option) return;
    const value = String(option.value ?? option ?? '');
    if (seen.has(value)) return;
    seen.add(value);
    out.push({
      value,
      label: String(option.label || value || '-'),
    });
  };
  (options && options.length ? options : [{ value: '', label: '-' }]).forEach(addOption);
  if (currentValue) addOption({ value: currentValue, label: currentValue });
  return out;
};

const mergeCategoryOptions = (options, currentValue) => {
  const seen = new Set();
  const out = [];
  const addOption = (option) => {
    if (!option) return;
    const value = String(option.value ?? option ?? '');
    if (seen.has(value)) return;
    seen.add(value);
    out.push({
      value,
      label: String(option.label || value || '-'),
    });
  };
  (options && options.length ? options : [{ value: '', label: '-' }]).forEach(addOption);
  if (currentValue) addOption({ value: currentValue, label: currentValue });
  return out;
};

export default function AccountInsightEditModal({
  record,
  indicationOptions = [],
  insightCategoryOptions=[],
  isSaving,
  error,
  onClose,
  onSave,
  onDelete,
  
}) {
  const isEdit = !!record?.id;
  const [form, setForm] = useState(() => buildInitialForm(record));
  const [validationError, setValidationError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const mergedIndicationOptions = mergeIndicationOptions(indicationOptions, form.indication);
  const mergedCategoryOptions = mergeCategoryOptions(insightCategoryOptions, form.insightCategory);
  const isPotentialAtc = useContext(PotentialAtcContext);

  useEffect(() => {
    setForm(buildInitialForm(record));
    setValidationError('');
    setDeleteConfirm(false);
  }, [record?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSaving, onClose]);

  const updateField = (key, value) => {
    setValidationError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.insightText.trim()) {
      setValidationError('Insight text is required.');
      return;
    }
  onSave?.(form);
  };

  return (
    <div className="stakeholder-edit-overlay" onClick={isSaving ? undefined : onClose} role="presentation">
      <form
        className="stakeholder-edit-modal account-profile-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <h3>{isEdit ? 'Edit Account Insight' : 'New Account Insight'}</h3>
            <div className="stakeholder-edit-subtitle-row">
              <p>{isEdit ? record.name || 'Account insight' : 'Capture a new account insight'}</p>
              <FieldHelpButton
                className="stakeholder-edit-subtitle-help"
                label="Account insight header guidance"
                text={ACCOUNT_INSIGHT_HELP.subheader}
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
          {deleteConfirm && (
            <div className="account-profile-warning-banner">
              Confirm delete for this account insight record. This cannot be undone.
            </div>
          )}
          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-grid">
              <Field label="Created Date">
                <input
                  type="text"
                  readOnly
                  value={formatDateLabel(form.insightDate, '-')}
                />
              </Field>
              <Field label="Created By">
                <input
                  type="text"
                  readOnly
                  value={form.createdBy || '-'}
                />
              </Field>
              <Field label="Indication" help={ACCOUNT_INSIGHT_HELP.indication}>
                <select
                  name="accountInsightIndication"
                  value={form.indication}
                  onChange={(e) => updateField('indication', e.target.value)}
                >
                  {mergedIndicationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              {isPotentialAtc && (
               <Field label="Insights Category" help={ACCOUNT_INSIGHT_HELP.insightCategory}>
                <select
                  name="accountInsightIndication"
                  value={form.insightCategory}
                  onChange={(e) => updateField('insightCategory', e.target.value)}
                >
                  {mergedCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              )}
              <Field label="Insights" help={ACCOUNT_INSIGHT_HELP.insight} className="is-textarea">
                <textarea
                  rows={6}
                  value={form.insightText}
                  maxLength={500}
                  required
                  onChange={(e) => updateField('insightText', e.target.value)}
                />
              </Field>
            </div>
          </section>
          {(validationError || error) && (
            <div className="critical-activity-edit-error">{validationError || error}</div>
          )}
        </div>

        <footer className="stakeholder-edit-foot">
          {isEdit && !deleteConfirm && (
            <button
              type="button"
              className="account-profile-button-danger"
              onClick={() => setDeleteConfirm(true)}
              disabled={isSaving}
            >
              Delete
            </button>
          )}
          {isEdit && deleteConfirm && (
            <>
              <button
                type="button"
                className="account-profile-button-danger"
                onClick={() => onDelete && onDelete(record)}
                disabled={isSaving}
              >
                {isSaving ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                type="button"
                className="stakeholder-edit-button-secondary"
                onClick={() => setDeleteConfirm(false)}
                disabled={isSaving}
              >
                Keep Record
              </button>
            </>
          )}
          {!deleteConfirm && (
            <>
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
            </>
          )}
        </footer>
      </form>
    </div>
  );
}
