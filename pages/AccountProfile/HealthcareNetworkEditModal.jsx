import { useEffect, useState } from 'react';
import Field, { FieldHelpButton } from '@/components/EditModalField';
import AccountLookupField from '@/pages/AccountProfile/AccountLookupField';

const HEALTHCARE_NETWORK_HELP = {
  subheader:
    'Other Healthcare Networks in Region/Influence out of Region Networks: Identify key healthcare systems within the geography or those influencing the ATC ecosystem',
  kiteAccountable: 'Indicate the corresponding CTAM/KAD aligned to each system.',
};

const buildInitialForm = (record, defaultAccount) => ({
  id: record?.id || null,
  accountId: record?.accountId || '',
  accountName: record?.accountName || '',
  kiteAccountable: record?.kiteAccountable || '',
});

const SF_ID_PATTERN = /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/;

export default function HealthcareNetworkEditModal({ record, defaultAccount, isSaving, error, onClose, onSave, onDelete, searchAccounts }) {
  const isEdit = !!record?.id;
  const [form, setForm] = useState(() => buildInitialForm(record, defaultAccount));
  const [validationError, setValidationError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    setForm(buildInitialForm(record, defaultAccount));
    setValidationError('');
    setDeleteConfirm(false);
  }, [record?.id, defaultAccount?.id, defaultAccount?.name]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || isSaving) return;
      if (deleteConfirm) {
        setDeleteConfirm(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteConfirm, isSaving, onClose]);

  const updateField = (key, value) => {
    setValidationError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateAccountQuery = (value) => {
    setValidationError('');
    setForm((current) => ({ ...current, accountName: value, accountId: '' }));
  };

  const selectAccount = (account) => {
    setValidationError('');
    setForm((current) => ({
      ...current,
      accountId: account?.id || '',
      accountName: account?.name || '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!SF_ID_PATTERN.test(String(form.accountId || ''))) {
      setValidationError('Select an Account Name from the account search results.');
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
            <h3>{isEdit ? 'Healthcare Network Details' : 'New Healthcare Network'}</h3>
            <div className="stakeholder-edit-subtitle-row">
              <p>{isEdit ? form.accountName || 'Untitled' : 'Other Healthcare Networks in Region/Influence out of Region Networks'}</p>
              <FieldHelpButton
                className="stakeholder-edit-subtitle-help"
                label="Healthcare Network sub-header guidance"
                text={HEALTHCARE_NETWORK_HELP.subheader}
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
              Confirm delete for this healthcare network record. This cannot be undone.
            </div>
          )}
          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-grid">
              <AccountLookupField
                label="Account Name"
                query={form.accountName}
                placeholder="Search account name"
                searchAccounts={searchAccounts}
                loadingText="Searching accounts..."
                emptyText="No accounts found."
                className="healthcare-network-account-lookup-field"
                onQueryChange={updateAccountQuery}
                onSelect={selectAccount}
              />
              <Field label="Kite Accountable" help={HEALTHCARE_NETWORK_HELP.kiteAccountable}>
                <input
                  type="text"
                  value={form.kiteAccountable}
                  maxLength={120}
                  onChange={(e) => updateField('kiteAccountable', e.target.value)}
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
