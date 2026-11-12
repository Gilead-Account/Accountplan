import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldHelpButton } from '@/components/EditModalField';
import AccountLookupField from '@/pages/AccountProfile/AccountLookupField';

// Field maps mirror the spec the user laid out:
//   IDENTITY = top section (general stakeholder fields)
//   DLBCL    = grouped DLBCL section underneath
// Each entry: { label, key, readOnly, type? }
//   key  = field on the flattened stakeholder shape produced by toStakeholder()
//   type = 'text' (default), 'select', 'textarea', 'checkbox', or 'multiSelect'

const STAKEHOLDER_FIELD_HELP = {
  name: 'Select the HCP who has influence on account decisions or patient flow.',
  role: "Identify the stakeholder's role within the account (e.g., treater, referrer, administrator).",
  otherRole: 'Specify additional role details if not captured in the standard dropdown.',
  primaryParent: 'Indicates the primary site or organization where the stakeholder practices.',
  dlbclClinicalInfluence:
    "Rate the stakeholder's impact on treatment decisions, clinical adoption, and therapy selection.",
  dlbclFinancialInfluence:
    "Rate the stakeholder's impact on financial decisions, including reimbursement, budget, and access considerations.",
  dlbclOperationalInfluence:
    "Rate the stakeholder's impact on operational processes such as workflows, referrals, logistics, and patient access.",
  nonMmDrivers:
    'Capture key factors that support adoption, referrals, or positive account outcomes (e.g., clinical preferences, operational efficiencies, leadership support).',
  nonMmBarriers:
    'Capture key challenges limiting adoption, referrals, or account performance (e.g., access restrictions, competing trials, operational constraints).',
  mmClinicalInfluence:
    "Rate the stakeholder's impact on treatment decisions, clinical adoption, and therapy selection.",
  mmFinancialInfluence:
    "Rate the stakeholder's impact on financial decisions, including reimbursement, budget, and access considerations.",
  mmOperationalInfluence:
    "Rate the stakeholder's impact on operational processes such as workflows, referrals, logistics, and patient access.",
  mmDrivers:
    'Capture key factors that support adoption, referrals, or positive account outcomes (e.g., clinical preferences, operational efficiencies, leadership support).',
  mmBarriers:
    'Capture key challenges limiting adoption, referrals, or account performance (e.g., access restrictions, competing trials, operational constraints).',
};

const IDENTITY_FIELDS = [
  { label: 'Stakeholder Name', key: 'name', readOnly: false, type: 'stakeholderLookup', help: STAKEHOLDER_FIELD_HELP.name },
  { label: 'Role', key: 'role', readOnly: false, type: 'select', help: STAKEHOLDER_FIELD_HELP.role },
  { label: 'Other Role', key: 'otherRole', readOnly: false, help: STAKEHOLDER_FIELD_HELP.otherRole },
  { label: 'Stakeholder EID', key: 'stakeholderId', readOnly: true, alwaysReadOnly: true },
  { label: 'Name Of Site', key: 'primaryParent', readOnly: true, alwaysReadOnly: true, help: STAKEHOLDER_FIELD_HELP.primaryParent },
];

const DLBCL_FIELDS = [
  { label: 'Current Target', key: 'dlbclCurrentTarget', readOnly: true },
  { label: 'HCP Classification', key: 'dlbclHcpClassification', readOnly: true },
  { label: 'Priority', key: 'dlbclPriority', readOnly: true },
  { label: 'Clinical Influence', key: 'dlbclClinicalInfluence', readOnly: false, type: 'select', help: STAKEHOLDER_FIELD_HELP.dlbclClinicalInfluence },
  { label: 'Financial Influence', key: 'dlbclFinancialInfluence', readOnly: false, type: 'select', help: STAKEHOLDER_FIELD_HELP.dlbclFinancialInfluence },
  { label: 'Operational Influence', key: 'dlbclOperationalInfluence', readOnly: false, type: 'select', help: STAKEHOLDER_FIELD_HELP.dlbclOperationalInfluence },
  { label: 'Drivers', key: 'nonMmDrivers', readOnly: false, type: 'textarea', help: STAKEHOLDER_FIELD_HELP.nonMmDrivers },
  { label: 'Barriers', key: 'nonMmBarriers', readOnly: false, type: 'textarea', help: STAKEHOLDER_FIELD_HELP.nonMmBarriers },
];

// Temporarily disabled: keep the Stakeholder Champion field definitions here
// so the DLBCL controls can be restored without recreating their CRM/UI mapping.
const DLBCL_CHAMPION_FIELDS = [
  { label: 'DLBCL Administrative Champion', key: 'dlbclAdministrativeChampion', readOnly: false, type: 'checkbox', championType: 'administrative' },
  { label: 'DLBCL Clinical Champion', key: 'dlbclClinicalChampion', readOnly: false, type: 'checkbox', championType: 'clinical' },
];

// MM section mirrors DLBCL exactly, mapped to the MM CRM columns.
const MM_FIELDS = [
  { label: 'Current Target', key: 'mmCurrentTarget', readOnly: true },
  { label: 'HCP Classification', key: 'mmHcpClassification', readOnly: true },
  { label: 'Priority', key: 'mmPriority', readOnly: true },
  { label: 'Estimated Annual R/R MM Treatment Volume', key: 'estimatedAnnualRrmmTreatmentVolume', readOnly: false, type: 'select' },
  { label: 'Physician-Identified Unmet Needs in R/R MM', key: 'physicianIdentifiedHighestUnmetNeedsRrmm', readOnly: false, type: 'multiSelect' },
  { label: 'Clinical Influence', key: 'mmClinicalInfluence', readOnly: false, type: 'select', help: STAKEHOLDER_FIELD_HELP.mmClinicalInfluence },
  { label: 'Financial Influence', key: 'mmFinancialInfluence', readOnly: false, type: 'select', help: STAKEHOLDER_FIELD_HELP.mmFinancialInfluence },
  { label: 'Operational Influence', key: 'mmOperationalInfluence', readOnly: false, type: 'select', help: STAKEHOLDER_FIELD_HELP.mmOperationalInfluence },
  { label: 'Drivers', key: 'mmDrivers', readOnly: false, type: 'textarea', help: STAKEHOLDER_FIELD_HELP.mmDrivers },
  { label: 'Barriers', key: 'mmBarriers', readOnly: false, type: 'textarea', help: STAKEHOLDER_FIELD_HELP.mmBarriers },
];

// Temporarily disabled: keep the Stakeholder Champion field definitions here
// so the MM controls can be restored without recreating their CRM/UI mapping.
const MM_CHAMPION_FIELDS = [
  { label: 'MM Administrative Champion', key: 'mmAdministrativeChampion', readOnly: false, type: 'checkbox', championType: 'administrative' },
  { label: 'MM Clinical Champion', key: 'mmClinicalChampion', readOnly: false, type: 'checkbox', championType: 'clinical' },
];

const OTHER_ROLE_VALUE = 'Other';

const isOtherRole = (value) =>
  String(value || '').trim().toLowerCase() === OTHER_ROLE_VALUE.toLowerCase();

// Build initial form state from the stakeholder, picking only the keys we
// expose. Anything missing on the source object becomes an empty string so
// React inputs stay controlled.
const buildInitialForm = (stakeholder) => {
  const all = [
    ...IDENTITY_FIELDS,
    // Temporarily disabled with the DLBCL Champion controls.
    ...DLBCL_CHAMPION_FIELDS,
    ...DLBCL_FIELDS,
    // Temporarily disabled with the MM Champion controls.
    ...MM_CHAMPION_FIELDS,
    ...MM_FIELDS,
  ];
  const out = {};
  for (const f of all) {
    out[f.key] = stakeholder?.[f.key] ?? (f.type === 'multiSelect' ? [] : '');
  }
  out.profileRecordId = stakeholder?.profileRecordId ?? '';
  out.primaryParentId = stakeholder?.primaryParentId ?? '';
  return out;
};

const sortAlphabetically = (values) =>
  [...values].sort((left, right) =>
    String(left).localeCompare(String(right), undefined, { sensitivity: 'base' })
  );

const mergeOptions = (current, options) => {
  const seen = new Set();
  const out = [];
  const currentValues = Array.isArray(current) ? current : [current];
  for (const value of [...currentValues, ...(options || [])]) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

const mergeSortedOptions = (current, options) => sortAlphabetically(mergeOptions(current, options));

const normalizeAccountId = (value) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, 15).toLowerCase() : '';
};

const defaultOpenSections = () => ({
  details: true,
  dlbcl: false,
  mm: false,
});

function MultiSelectDropdown({ id, field, value, onChange, options }) {
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedValues = Array.isArray(value) ? value : [];
  const selectedSummary = selectedValues.length === 0
    ? 'Select options'
    : selectedValues.length === 1
      ? selectedValues[0]
      : `${selectedValues.length} selected`;

  useEffect(() => {
    if (!isMultiSelectOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsMultiSelectOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMultiSelectOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMultiSelectOpen]);

  return (
    <div ref={containerRef} className="stakeholder-edit-field is-multiSelect stakeholder-multiselect">
      <label className="stakeholder-edit-field-label" id={`${id}-label`}>
        {field.label}
      </label>
      <button
        type="button"
        className="stakeholder-multiselect-trigger"
        aria-labelledby={`${id}-label ${id}-summary`}
        aria-expanded={isMultiSelectOpen}
        aria-controls={`${id}-menu`}
        disabled={options.length === 0}
        onClick={() => setIsMultiSelectOpen((current) => !current)}
      >
        <span id={`${id}-summary`} className={selectedValues.length ? '' : 'is-placeholder'}>
          {options.length === 0 ? 'No CRM options available' : selectedSummary}
        </span>
        <span className="stakeholder-multiselect-caret" aria-hidden="true" />
      </button>
      {isMultiSelectOpen && (
        <div
          id={`${id}-menu`}
          className="stakeholder-multiselect-menu"
          role="group"
          aria-labelledby={`${id}-label`}
        >
          <div className="stakeholder-multiselect-options">
            {options.map((option) => {
              const optionId = `${id}-${String(option).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
              const isSelected = selectedValues.includes(option);
              return (
                <label
                  key={option}
                  className={`stakeholder-multiselect-option${isSelected ? ' is-selected' : ''}`}
                  htmlFor={optionId}
                >
                  <input
                    id={optionId}
                    type="checkbox"
                    checked={isSelected}
                    onChange={(event) => {
                      const nextValues = event.target.checked
                        ? [...selectedValues, option]
                        : selectedValues.filter((selected) => selected !== option);
                      onChange(field.key, nextValues);
                    }}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            className="stakeholder-multiselect-done"
            onClick={() => setIsMultiSelectOpen(false)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ field, value, onChange, isNew, options = [] }) {
  const id = `stk-field-${field.key}`;
  const readOnly = field.alwaysReadOnly || field.readOnly;
  const type = field.type || 'text';
  const className = [
    'stakeholder-edit-field',
    `is-${type}`,
    readOnly ? 'is-readonly' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (type === 'checkbox' && !readOnly) {
    const isSelected = Boolean(value);
    const isClinicalChampion = field.championType === 'clinical';
    return (
      <div className={className}>
        <label
          className={`stakeholder-champion-checkbox${isSelected ? ' is-selected' : ''}`}
          htmlFor={id}
        >
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(field.key, e.target.checked)}
          />
          <span className="stakeholder-champion-icon" aria-hidden="true">
            {isClinicalChampion ? (
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M5 20V7l7-3 7 3v13M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 20v-3h4v3" />
              </svg>
            )}
          </span>
          <span className="stakeholder-champion-copy">
            <small>{isClinicalChampion ? 'Clinical' : 'Administrative'}</small>
            <span>{field.label}</span>
          </span>
          <span className="stakeholder-champion-check" aria-hidden="true">✓</span>
        </label>
      </div>
    );
  }

  if (type === 'multiSelect' && !readOnly) {
    return (
      <MultiSelectDropdown
        id={id}
        field={field}
        value={value}
        onChange={onChange}
        options={options}
      />
    );
  }

  return (
    <div className={className}>
      <div className="stakeholder-edit-field-label-row">
        <label className="stakeholder-edit-field-label" htmlFor={id}>
          {field.label}
        </label>
        {field.help && (
          <FieldHelpButton
            className="stakeholder-edit-field-help"
            label={`${field.label} guidance`}
            text={field.help}
          />
        )}
      </div>
      {readOnly && (
        <input
          id={id}
          type="text"
          value={value || ''}
          placeholder="-"
          readOnly
          aria-readonly="true"
        />
      )}
      {type === 'select' && !readOnly && (
        <select
          id={id}
          value={value || ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          <option value="">-</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}
      {type === 'textarea' && !readOnly && (
        <textarea
          id={id}
          rows={2}
          value={value || ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}
      {type === 'text' && !readOnly && (
        <input
          id={id}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}
    </div>
  );
}

function ChampionCheckboxGroup({ label, fields, form, onChange }) {
  return (
    <div className="stakeholder-champion-group" aria-label={label}>
      <p className="stakeholder-champion-group-label">Champion designations</p>
      <div className="stakeholder-champion-checkbox-grid">
        {fields.map((field) => (
          <Field
            key={field.key}
            field={field}
            value={form[field.key]}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

function AccordionSection({ id, title, className = '', isOpen, onToggle, children }) {
  const headingId = `stakeholder-section-${id}-heading`;
  const panelId = `stakeholder-section-${id}-panel`;
  const sectionClassName = [
    'stakeholder-edit-section',
    'is-accordion',
    className,
    isOpen ? 'is-open' : 'is-collapsed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={sectionClassName} aria-labelledby={headingId}>
      <div className="stakeholder-edit-section-head">
        <h4 id={headingId}>{title}</h4>
        <button
          type="button"
          className="stakeholder-edit-section-toggle"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
        >
          <span className="stakeholder-edit-section-toggle-icon" aria-hidden="true">
            {isOpen ? '-' : '+'}
          </span>
        </button>
      </div>
      <div id={panelId} className="stakeholder-edit-section-panel" hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}

export default function StakeholderEditModal({
  stakeholder,
  influenceOptions = [],
  roleOptions = [],
  estimatedAnnualRrmmTreatmentVolumeOptions = [],
  physicianIdentifiedHighestUnmetNeedsOptions = [],
  searchSites,
  searchStakeholders,
  excludedStakeholderAccountIds = [],
  onClose,
  onSave,
  onDelete,
  onCreateStakeholder,
}) {
  const [form, setForm] = useState(() => buildInitialForm(stakeholder));
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [openSections, setOpenSections] = useState(defaultOpenSections);
  const isEdit = !!stakeholder?.id;
  const isNew = !isEdit;
  const excludedStakeholderAccountIdSet = useMemo(
    () =>
      new Set(
        (excludedStakeholderAccountIds || [])
          .map(normalizeAccountId)
          .filter(Boolean)
      ),
    [excludedStakeholderAccountIds]
  );

  const filteredStakeholderSearch = useCallback(
    (query, limit) =>
      Promise.resolve(searchStakeholders ? searchStakeholders(query, limit) : []).then((rows) =>
        (rows || []).filter((account) => account && !excludedStakeholderAccountIdSet.has(normalizeAccountId(account.id)))
      ),
    [excludedStakeholderAccountIdSet, searchStakeholders]
  );

  // If the user opens edit on a different row without unmounting, refresh state.
  useEffect(() => {
    setForm(buildInitialForm(stakeholder));
    setSaveError('');
    setIsSaving(false);
    setDeleteConfirm(false);
    setOpenSections(defaultOpenSections());
  }, [stakeholder?.id]);

  // ESC closes the modal.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!stakeholder) return null;

  const updateField = (key, value) => {
    setSaveError('');
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'role' && !isOtherRole(value)) {
        next.otherRole = '';
      }
      return next;
    });
  };

  const updateStakeholderQuery = (value) => {
    setSaveError('');
    setForm((current) => ({
      ...current,
      name: value,
      profileRecordId: '',
      stakeholderId: '',
    }));
  };

  const selectStakeholderAccount = (account) => {
    setSaveError('');
    setForm((current) => ({
      ...current,
      name: account?.name || '',
      profileRecordId: account?.id || '',
      stakeholderId: account?.eid || account?.accountIdentifier || '',
    }));
  };

  const updateSiteQuery = (value) => {
    setSaveError('');
    setForm((current) => ({
      ...current,
      primaryParent: value,
      primaryParentId: '',
    }));
  };

  const selectSiteAccount = (account) => {
    setSaveError('');
    setForm((current) => ({
      ...current,
      primaryParent: account?.name || '',
      primaryParentId: account?.id || '',
    }));
  };

  const optionsForField = (field) => {
    if (field.key === 'role') return mergeSortedOptions(form[field.key], roleOptions);
    if (field.key === 'estimatedAnnualRrmmTreatmentVolume') {
      return mergeOptions(form[field.key], estimatedAnnualRrmmTreatmentVolumeOptions);
    }
    if (field.key === 'physicianIdentifiedHighestUnmetNeedsRrmm') {
      return mergeOptions(form[field.key], physicianIdentifiedHighestUnmetNeedsOptions);
    }
    return field.type === 'select' ? mergeOptions(form[field.key], influenceOptions) : [];
  };

  const toggleSection = (section) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const isOtherRoleEditable = isOtherRole(form.role);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    const stakeholderNameChanged = String(form.name || '') !== String(stakeholder.name || '');
    const siteNameChanged = String(form.primaryParent || '') !== String(stakeholder.primaryParent || '');
    if (searchStakeholders && (isNew || stakeholderNameChanged) && !form.profileRecordId) {
      setSaveError('Select a Stakeholder Name from the account search results.');
      return;
    }
    if (searchSites && form.primaryParent && (isNew || siteNameChanged) && !form.primaryParentId) {
      setSaveError('Select a Name Of Site from the site search results.');
      return;
    }
    setIsSaving(true);
    try {
      if (onSave) await onSave(stakeholder.id, form);
      onClose();
    } catch (error) {
      setSaveError(error && error.message ? error.message : 'Unable to save stakeholder.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isNew) return;
    setSaveError('');
    setIsSaving(true);
    try {
      await onDelete(stakeholder);
      onClose();
    } catch (error) {
      setSaveError(error && error.message ? error.message : 'Unable to delete stakeholder.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="stakeholder-edit-overlay" onClick={isSaving ? undefined : onClose} role="presentation">
      <form
        className="stakeholder-edit-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <span className="stakeholder-edit-eyebrow">Stakeholder</span>
            <h3>{isNew ? 'Add Stakeholder' : 'Edit Stakeholder'}</h3>
            <p>{isNew ? 'Create a new stakeholder row' : stakeholder.name || 'Unnamed stakeholder'}</p>
            <div className="stakeholder-edit-head-meta" aria-label="Stakeholder summary">
              <span>{stakeholder.role || 'No role'}</span>
              <span>{stakeholder.stakeholderId || 'No stakeholder ID'}</span>
            </div>
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
          {deleteConfirm && (
            <div className="stakeholder-delete-warning-banner">
              Confirm delete for this stakeholder record. This cannot be undone.
            </div>
          )}
          <AccordionSection
            id="details"
            title="Details"
            isOpen={openSections.details}
            onToggle={() => toggleSection('details')}
          >
            <div className="stakeholder-edit-grid">
              {IDENTITY_FIELDS.map((f) => {
                const field = f.key === 'otherRole' && !isOtherRoleEditable
                  ? { ...f, readOnly: true }
                  : f;
                if (field.readOnly || field.alwaysReadOnly) {
                  return (
                    <Field
                      key={field.key}
                      field={field}
                      value={form[field.key]}
                      onChange={updateField}
                      isNew={isNew}
                      options={optionsForField(field)}
                    />
                  );
                }
                if (field.type === 'stakeholderLookup') {
                  return (
                    <AccountLookupField
                      key={field.key}
                      label="Stakeholder Name"
                      query={form.name}
                      placeholder="Search stakeholder name"
                      searchAccounts={filteredStakeholderSearch}
                      loadingText="Searching stakeholders..."
                      emptyText="No stakeholders found."
                      className="stakeholder-account-lookup-field"
                      resultLimit={60}
                      help={field.help}
                      onQueryChange={updateStakeholderQuery}
                      onSelect={selectStakeholderAccount}
                    />
                  );
                }
                if (field.type === 'siteLookup') {
                  return (
                    <AccountLookupField
                      key={field.key}
                      label="Name Of Site"
                      query={form.primaryParent}
                      placeholder="Search site name"
                      searchAccounts={searchSites}
                      loadingText="Searching sites..."
                      emptyText="No sites found."
                      className="stakeholder-site-lookup-field"
                      required={false}
                      help={field.help}
                      onQueryChange={updateSiteQuery}
                      onSelect={selectSiteAccount}
                    />
                  );
                }
                return (
                  <Field
                    key={field.key}
                    field={field}
                    value={form[field.key]}
                    onChange={updateField}
                    isNew={isNew}
                    options={optionsForField(field)}
                  />
                );
              })}
            </div>
          </AccordionSection>

          <AccordionSection
            id="dlbcl"
            title="DLBCL"
            className="is-grouped"
            isOpen={openSections.dlbcl}
            onToggle={() => toggleSection('dlbcl')}
          >
            {/*  Temporarily disabled: DLBCL Stakeholder Champion controls. */}
            <ChampionCheckboxGroup
              label="DLBCL champion designations"
              fields={DLBCL_CHAMPION_FIELDS}
              form={form}
              onChange={updateField}
            /> 
            <div className="stakeholder-edit-grid">
              {DLBCL_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  field={f}
                  value={form[f.key]}
                  onChange={updateField}
                  isNew={isNew}
                  options={optionsForField(f)}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            id="mm"
            title="MM"
            className="is-grouped is-mm"
            isOpen={openSections.mm}
            onToggle={() => toggleSection('mm')}
          >
           {/* Temporarily disabled: MM Stakeholder Champion controls. */}
            <ChampionCheckboxGroup
              label="MM champion designations"
              fields={MM_CHAMPION_FIELDS}
              form={form}
              onChange={updateField}
            /> 
            <div className="stakeholder-edit-grid">
              {MM_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  field={f}
                  value={form[f.key]}
                  onChange={updateField}
                  isNew={isNew}
                  options={optionsForField(f)}
                />
              ))}
            </div>
          </AccordionSection>
          {saveError && <div className="critical-activity-edit-error">{saveError}</div>}
        </div>

        <footer className="stakeholder-edit-foot">
          {isEdit && !deleteConfirm && onDelete && (
            <button
              type="button"
              className="critical-activity-delete-button"
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
                className="critical-activity-delete-button confirm"
                onClick={handleDelete}
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
            {!isEdit && onCreateStakeholder && (
              <button type="button" className="stakeholder-edit-button-success" 
                onClick={onCreateStakeholder} disabled={isSaving}>
                Create Stakeholder
              </button>
            )}

              <button type="button" className="stakeholder-edit-button-secondary" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className="stakeholder-edit-button-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : isNew ? 'Add Stakeholder' : 'Save'}
              </button>
            </>
          )}
        </footer>
      </form>
    </div>
  );
}
