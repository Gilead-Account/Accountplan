import { useEffect, useMemo, useState } from 'react';
import Field from '@/components/EditModalField';
import AccountLookupField from '@/pages/AccountProfile/AccountLookupField';

const EMPTY_INDICATION_OPTION = { value: '', label: '-' };
const REFERRAL_MAPPING_HELP = {
  referralPriority: 'Identifies whether the site is a prioritizes Kite',
  indication:
    'Specifies the disease area or indication relevant to the site (e.g., DLBCL only or broader portfolio).',
  comments:
    'Capture key context on referral behavior, including trends, notable changes, and any relevant observations that may impact referral flow or account strategy.',
};

const toBoolean = (value) => {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'checked'].includes(normalized);
};

const buildInitialForm = (record) => ({
  id: record?.id || null,
  name: record?.name || '',
  siteId: record?.siteId || '',
  hcoClassification: record?.hcoClassification || '',
  hcpTargetCount: record?.hcpTargetCount ?? 0,
  referralPriority: toBoolean(record?.referralPriority),
  indication: record?.indication || '',
  comments: record?.comments || '',
});

const mergeIndicationOptions = (current, options) => {
  const seen = new Set();
  const out = [];
  const addOption = (option) => {
    const rawValue =
      option && typeof option === 'object' && 'value' in option ? option.value : option;
    if (rawValue === null || rawValue === undefined) return;
    const value = String(rawValue);
    if (seen.has(value)) return;
    seen.add(value);
    const rawLabel =
      option && typeof option === 'object' && option.label ? option.label : value;
    out.push({ value, label: String(rawLabel || value || EMPTY_INDICATION_OPTION.label) });
  };

  addOption(EMPTY_INDICATION_OPTION);
  (options || []).forEach(addOption);
  if (current) addOption({ value: current, label: current });
  return out;
};

export default function ReferralAccountEditModal({
  record,
  isSaving,
  error,
  onClose,
  onSave,
  onDelete,
  searchAccounts,
  indicationOptions,
}) {
  const isEdit = !!record?.id;
  const [form, setForm] = useState(() => buildInitialForm(record));
  const [validationError, setValidationError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  const modalIndicationOptions = useMemo(
    () => mergeIndicationOptions(form.indication, indicationOptions),
    [form.indication, indicationOptions]
  );

  const updateField = (key, value) => {
    setValidationError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateSiteQuery = (value) => {
    setValidationError('');
    setForm((current) => ({ ...current, name: value, siteId: '' }));
  };

  const selectSite = (account) => {
    setValidationError('');
    setForm((current) => ({
      ...current,
      name: account?.name || '',
      siteId: account?.id || '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!String(form.name || '').trim()) {
      setValidationError('Site Name is required.');
      return;
    }
    if (onSave) onSave(form);
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
            <h3>{isEdit ? 'Referral Mapping Details' : 'New Referral Mapping'}</h3>
            <p>{isEdit ? form.name || 'Untitled site' : 'Add a new referral site'}</p>
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
              Confirm delete for this referral mapping record. This cannot be undone.
            </div>
          )}
          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-grid">
              <AccountLookupField
                label="Site Name"
                query={form.name}
                placeholder="Search site name"
                searchAccounts={searchAccounts}
                loadingText="Searching sites..."
                emptyText="No sites found."
                className="referral-site-lookup-field"
                onQueryChange={updateSiteQuery}
                onSelect={selectSite}
              />
              <Field label="HCO Classification">
                <input
                  type="text"
                  value={form.hcoClassification}
                  maxLength={120}
                  readOnly
                  onChange={(e) => updateField('hcoClassification', e.target.value)}
                />
              </Field>
              <Field label="# of HCP Targets within site">
                <input
                  type="number"
                  value={form.hcpTargetCount}
                  min={0}
                  readOnly
                  onChange={(e) => updateField('hcpTargetCount', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </Field>
              <Field label="Referral Priority" help={REFERRAL_MAPPING_HELP.referralPriority}>
                <select
                  value={form.referralPriority ? 'true' : 'false'}
                  onChange={(e) => updateField('referralPriority', e.target.value === 'true')}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </Field>
              <Field label="Indication" help={REFERRAL_MAPPING_HELP.indication}>
                <select
                  value={form.indication}
                  onChange={(e) => updateField('indication', e.target.value)}
                >
                  {modalIndicationOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Comments" help={REFERRAL_MAPPING_HELP.comments} className="is-textarea">
                <textarea
                  rows={3}
                  value={form.comments}
                  maxLength={500}
                  onChange={(e) => updateField('comments', e.target.value)}
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
                {isSaving ? 'Deleting…' : 'Confirm Delete'}
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
