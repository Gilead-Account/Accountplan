import { useCallback, useEffect, useMemo, useState } from 'react';
import AccountLookupField from '@/pages/AccountProfile/AccountLookupField';

const OTHER_ROLE_VALUE = 'other';

const isOtherRole = (value) =>
  String(value || '').trim().toLowerCase() === OTHER_ROLE_VALUE;

const normalizeAccountId = (value) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, 15).toLowerCase() : '';
};

// Same keys as StakeholderEditModal's form, so createStakeholder() in the
// parent receives the exact shape it already expects.
const INFLUENCE_GROUPS = [
  {
    title: 'DLBCL',
    fields: [
      { label: 'Clinical Influence', key: 'dlbclClinicalInfluence', type: 'select' },
      { label: 'Financial Influence', key: 'dlbclFinancialInfluence', type: 'select' },
      { label: 'Operational Influence', key: 'dlbclOperationalInfluence', type: 'select' },
      { label: 'Drivers', key: 'nonMmDrivers', type: 'textarea' },
      { label: 'Barriers', key: 'nonMmBarriers', type: 'textarea' },
    ],
  },
  {
    title: 'MM',
    fields: [
      { label: 'Clinical Influence', key: 'mmClinicalInfluence', type: 'select' },
      { label: 'Financial Influence', key: 'mmFinancialInfluence', type: 'select' },
      { label: 'Operational Influence', key: 'mmOperationalInfluence', type: 'select' },
      { label: 'Drivers', key: 'mmDrivers', type: 'textarea' },
      { label: 'Barriers', key: 'mmBarriers', type: 'textarea' },
    ],
  },
];

const buildEmptyForm = () => {
  const form = {
    name: '',
    role: '',
    otherRole: '',
    stakeholderId: '',
    primaryParent: '',
    primaryParentId: '',
    profileRecordId: '',
    estimatedAnnualRrmmTreatmentVolume: '',
    physicianIdentifiedHighestUnmetNeedsRrmm: [],
  };
  INFLUENCE_GROUPS.forEach((group) =>
    group.fields.forEach((field) => {
      form[field.key] = '';
    })
  );
  return form;
};

function SimpleField({ field, value, onChange, options = [] }) {
  const id = `stk-create-${field.key}`;
  return (
    <div className={`stakeholder-edit-field is-${field.type || 'text'}`}>
      <div className="stakeholder-edit-field-label-row">
        <label className="stakeholder-edit-field-label" htmlFor={id}>
          {field.label}
        </label>
      </div>
      {field.type === 'select' && (
        <select id={id} value={value || ''} onChange={(e) => onChange(field.key, e.target.value)}>
          <option value="">-</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}
      {field.type === 'textarea' && (
        <textarea id={id} rows={2} value={value || ''} onChange={(e) => onChange(field.key, e.target.value)} />
      )}
      {(!field.type || field.type === 'text') && (
        <input
          id={id}
          type="text"
          value={value || ''}
          readOnly={field.readOnly}
          placeholder={field.readOnly ? '-' : undefined}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}
    </div>
  );
}

export default function StakeholderCreateModal({
  influenceOptions = [],
  roleOptions = [],
  searchStakeholders,
  excludedStakeholderAccountIds = [],
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(buildEmptyForm);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const excludedIdSet = useMemo(
    () => new Set((excludedStakeholderAccountIds || []).map(normalizeAccountId).filter(Boolean)),
    [excludedStakeholderAccountIds]
  );

  const filteredStakeholderSearch = useCallback(
    (query, limit) =>
      Promise.resolve(searchStakeholders ? searchStakeholders(query, limit) : []).then((rows) =>
        (rows || []).filter((a) => a && !excludedIdSet.has(normalizeAccountId(a.id)))
      ),
    [excludedIdSet, searchStakeholders]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isSaving]);

  const updateField = (key, value) => {
    setSaveError('');
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'role' && !isOtherRole(value)) next.otherRole = '';
      return next;
    });
  };

  const updateStakeholderQuery = (value) => {
    setSaveError('');
    setForm((f) => ({ ...f, name: value, profileRecordId: '', stakeholderId: '' }));
  };

  const selectStakeholderAccount = (account) => {
    setSaveError('');
    setForm((f) => ({
      ...f,
      name: account?.name || '',
      profileRecordId: account?.id || '',
      stakeholderId: account?.eid || account?.accountIdentifier || '',
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    if (!form.profileRecordId) {
      setSaveError('Select a Stakeholder Name from the account search results.');
      return;
    }
    setIsSaving(true);
    try {
      // id = undefined -> parent's saveStakeholder() takes the createStakeholder() path.
      if (onSave) await onSave(undefined, form);
      onClose();
    } catch (error) {
      setSaveError(error?.message || 'Unable to create stakeholder.');
    } finally {
      setIsSaving(false);
    }
  };

  const roleChoices = [...new Set(roleOptions)].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
  );

  return (
    <div className="stakeholder-edit-overlay" onClick={isSaving ? undefined : onClose} role="presentation">
      <form className="stakeholder-edit-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <span className="stakeholder-edit-eyebrow">Stakeholder</span>
            <h3>Create Stakeholder</h3>
            <p>Create a new stakeholder row</p>
          </div>
          <button
            type="button"
            className="stakeholder-edit-close"
            onClick={isSaving ? undefined : onClose}
            aria-label="Close"
            disabled={isSaving}
          />
        </header>

        <div className="stakeholder-edit-body">
          <section className="stakeholder-edit-section">
            <div className="stakeholder-edit-section-head">
              <h4>Details</h4>
            </div>
            <div className="stakeholder-edit-grid">
              <AccountLookupField
                label="Stakeholder Name"
                query={form.name}
                placeholder="Search stakeholder name"
                searchAccounts={filteredStakeholderSearch}
                loadingText="Searching stakeholders..."
                emptyText="No stakeholders found."
                className="stakeholder-account-lookup-field"
                resultLimit={60}
                onQueryChange={updateStakeholderQuery}
                onSelect={selectStakeholderAccount}
              />
              <SimpleField
                field={{ label: 'Role', key: 'role', type: 'select' }}
                value={form.role}
                onChange={updateField}
                options={roleChoices}
              />
              {isOtherRole(form.role) && (
                <SimpleField
                  field={{ label: 'Other Role', key: 'otherRole' }}
                  value={form.otherRole}
                  onChange={updateField}
                />
              )}
              <SimpleField
                field={{ label: 'Stakeholder EID', key: 'stakeholderId', readOnly: true }}
                value={form.stakeholderId}
                onChange={() => {}}
              />
            </div>
          </section>

          {INFLUENCE_GROUPS.map((group) => (
            <section key={group.title} className="stakeholder-edit-section is-grouped">
              <div className="stakeholder-edit-section-head">
                <h4>{group.title}</h4>
              </div>
              <div className="stakeholder-edit-grid">
                {group.fields.map((field) => (
                  <SimpleField
                    key={field.key}
                    field={field}
                    value={form[field.key]}
                    onChange={updateField}
                    options={influenceOptions}
                  />
                ))}
              </div>
            </section>
          ))}

          {saveError && <div className="critical-activity-edit-error">{saveError}</div>}
        </div>

        <footer className="stakeholder-edit-foot">
          <button type="button" className="stakeholder-edit-button-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" className="stakeholder-edit-button-primary" disabled={isSaving}>
            {isSaving ? 'Creating...' : 'Create Stakeholder'}
          </button>
        </footer>
      </form>
    </div>
  );
}
