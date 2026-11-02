import { useCallback, useEffect, useMemo, useState } from 'react';
import { MM_PROFILE_FIELD_API_NAMES } from '@/lib/dataservice/accountPlan/shared';

const MM_PROFILE_TEXT_MAX_LENGTH = 250;
const MM_PROFILE_SHORT_TEXT_MAX_LENGTH = 255;
const MM_PROFILE_LONG_TEXT_MAX_LENGTH = 500;
const PT_COMMITTEE_TEXT_MAX_LENGTH = 500;

const accountInformationFields = (mmProfilePicklists = {}) => [
  {
    key: 'factAccredited',
    label: 'FACT Accredited',
    crmField: MM_PROFILE_FIELD_API_NAMES.factAccredited,
    editable: true,
    inputType: 'select',
    options: mmProfilePicklists[MM_PROFILE_FIELD_API_NAMES.factAccredited] || [],
  },
  {
    key: '340bAccount',
    label: '340B Account',
    crmField: MM_PROFILE_FIELD_API_NAMES['340bAccount'],
  },
  {
    key: 'anitoCelTrialSite',
    label: 'Anito-Cel Trial Site',
    crmField: MM_PROFILE_FIELD_API_NAMES.anitoCelTrialSite,
    editable: true,
    inputType: 'select',
    options: mmProfilePicklists[MM_PROFILE_FIELD_API_NAMES.anitoCelTrialSite] || [],
  },
];

const accountIntelligenceSections = (mmProfilePicklists = {}) => [
  {
    number: '01',
    title: 'MM Treatment Landscape & Demand',
    className: 'is-mm-treatment',
    placement: 'main',
    fields: [
      { key: 'projectedAnitoCelDemand', label: 'Projected Anito-Cel Demand', unit: 'pts', crmField: MM_PROFILE_FIELD_API_NAMES.projectedAnitoCelDemand, source: 'KAD Input', editable: true, inputType: 'number', layout: 'mm-metric', inlineValue: true, valuePlacement: 'below' },
      { key: 'secondLinePatientEstimate', label: '2L+ Patient Estimate', unit: 'pts', crmField: MM_PROFILE_FIELD_API_NAMES.secondLinePatientEstimate, source: 'Claims', layout: 'mm-metric', inlineValue: true, valuePlacement: 'below' },
      { key: 'currentCartUtilizationVolume', label: 'Current CART Utilization Volume', unit: 'pts', crmField: MM_PROFILE_FIELD_API_NAMES.currentCartUtilizationVolume, source: 'Claims / Dedham', layout: 'mm-metric', inlineValue: true, valuePlacement: 'below' },
      { key: 'currentBispecificUtilization', label: 'Current Bispecific Utilization', unit: 'pts', crmField: MM_PROFILE_FIELD_API_NAMES.currentBispecificUtilization, source: 'Claims', layout: 'mm-metric', inlineValue: true, valuePlacement: 'below', tabletLayout: 'tablet-half' },
      { key: 'fourthLinePatientEstimate', label: '4L+ Patient Estimate', unit: 'pts', crmField: MM_PROFILE_FIELD_API_NAMES.fourthLinePatientEstimate, source: 'Claims', layout: 'mm-summary', inlineValue: true, valuePlacement: 'below', tabletLayout: 'tablet-half' },
      { key: 'bispecificUse', label: 'Bispecific Use (Tec / Elrex / Talvey)', crmField: MM_PROFILE_FIELD_API_NAMES.bispecificUse, source: 'Claims', layout: 'mm-summary' },
      { key: 'commercialTrialCartMix', label: 'Commercial vs. Trial CART Mix', crmField: MM_PROFILE_FIELD_API_NAMES.commercialTrialCartMix, source: 'Dedham', layout: 'mm-summary' },
      { key: 'secondLineTreatmentPreference', label: '2L Treatment Preference', crmField: MM_PROFILE_FIELD_API_NAMES.secondLineTreatmentPreference, source: 'TLL/KAD Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH, layout: 'mm-full' },
      { key: 'fourthLineTreatmentPreference', label: '4L+ Treatment Preference', crmField: MM_PROFILE_FIELD_API_NAMES.fourthLineTreatmentPreference, source: 'TLL/KAD Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH, layout: 'mm-full' },
      { key: 'perceptionOfAnitoCel', label: 'Perception of Anito-Cel', crmField: MM_PROFILE_FIELD_API_NAMES.perceptionOfAnitoCel, source: 'MSL / TLL Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH, layout: 'mm-full' },
    ],
  },
  {
    number: '02',
    title: 'CART Infrastructure & Ops Readiness',
    placement: 'side',
    fields: [
      { key: 'cartProgramStructure', label: 'CART Program Structure', crmField: MM_PROFILE_FIELD_API_NAMES.cartProgramStructure, source: 'Dedham / KAD Input', editable: true, inputType: 'select', options: mmProfilePicklists[MM_PROFILE_FIELD_API_NAMES.cartProgramStructure] || [] },
      { key: 'outpatientCartCapability', label: 'Outpatient CART Capability', crmField: MM_PROFILE_FIELD_API_NAMES.outpatientCartCapability, source: 'Dedham / KAD / TLL', editable: true, inputType: 'text', maxLength: MM_PROFILE_SHORT_TEXT_MAX_LENGTH },
      { key: 'receptivityToAnitoCelOp', label: 'Receptivity to Anito-Cel OP', crmField: MM_PROFILE_FIELD_API_NAMES.receptivityToAnitoCelOp, source: 'MSL / Dedham', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH },
      { key: 'operationalCapacityAssessment', label: 'Operational Capacity Assessment', crmField: MM_PROFILE_FIELD_API_NAMES.operationalCapacityAssessment, source: 'KAD Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_TEXT_MAX_LENGTH },
    ],
  },
  {
    number: '03',
    title: 'Access & Reimbursement',
    className: 'is-access-economics',
    placement: 'main',
    fields: [
      { key: 'payerMix', label: 'Payer Mix - Commercial % / Medicare % / Medicaid %', crmField: MM_PROFILE_FIELD_API_NAMES.payerMix, source: 'Claims / Dedham', layout: 'access-payer', inlineValue: true, valuePlacement: 'below' },
      { key: 'ptStatus', label: 'P&T Status', crmField: MM_PROFILE_FIELD_API_NAMES.ptStatus, source: 'KAD Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_TEXT_MAX_LENGTH, layout: 'access-status' },
      { key: 'ptTimingNextReview', label: 'P&T Timing / Next Review', crmField: MM_PROFILE_FIELD_API_NAMES.ptTimingNextReview, source: 'KAD/TLL Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_TEXT_MAX_LENGTH, layout: 'access-status' },
      { key: 'formularyStatus', label: 'Formulary Status', crmField: MM_PROFILE_FIELD_API_NAMES.formularyStatus, source: 'KAD Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_TEXT_MAX_LENGTH, layout: 'access-status' },
      { key: 'preFormularyExceptionPathway', label: 'Pre-Formulary Exception Pathway', crmField: MM_PROFILE_FIELD_API_NAMES.preFormularyExceptionPathway, source: 'KAD Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH, layout: 'access-full' },
      { key: 'ptCommittee', label: 'P&T Committee', crmField: MM_PROFILE_FIELD_API_NAMES.ptCommittee, source: 'TLL / KAD Input', editable: true, inputType: 'text', maxLength: PT_COMMITTEE_TEXT_MAX_LENGTH, layout: 'access-full' },
      { key: 'ptLead', label: 'P&T Lead', crmField: MM_PROFILE_FIELD_API_NAMES.ptLead, source: 'TLL / KAD Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH, layout: 'access-full' },
      { key: 'accessBarriers', label: 'Access Barriers', crmField: MM_PROFILE_FIELD_API_NAMES.accessBarriers, source: 'KAD / RAD / CVL Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH, layout: 'access-full' },
    ],
  },
  {
    number: '04',
    title: 'Referral Ecosystem & Patient Flow',
    placement: 'side',
    fields: [
      { key: 'catchmentArea', label: 'Catchment Area (sites / miles)', crmField: MM_PROFILE_FIELD_API_NAMES.catchmentArea, source: 'Analytics', inlineValue: true, valuePlacement: 'below' },
      { key: 'internalExternalMix', label: 'Internal / External Mix %', crmField: MM_PROFILE_FIELD_API_NAMES.internalExternalMix, source: 'Claims', inlineValue: true, valuePlacement: 'below' },
      { key: 'topReferringSites', label: 'Top Referring Sites', crmField: MM_PROFILE_FIELD_API_NAMES.topReferringSites, source: 'Claims / CTAM Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH, layout: 'mm-full' },
    ],
  },
  {
    number: '05',
    title: 'HCP Stakeholder & Engagement Profile',
    placement: 'side',
    fields: [
      { key: 'cartTreatersAtAtc', label: '# CART Treaters at ATC', crmField: MM_PROFILE_FIELD_API_NAMES.cartTreatersAtAtc, source: 'Claims / CRM', inlineValue: true, valuePlacement: 'below' },
      { key: 'mmAnitoCelClinicalChampion', label: 'MM Anito-Cel Clinical Champion', crmField: MM_PROFILE_FIELD_API_NAMES.mmAnitoCelClinicalChampion, source: 'MSL / TLL Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH },
      { key: 'adminChampionRole', label: 'Admin Champion & Role', crmField: MM_PROFILE_FIELD_API_NAMES.adminChampionRole, source: 'KAD / CTAM Input', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH },
      { key: 'mmOpinionLeaders', label: 'MM Opinion Leaders', crmField: MM_PROFILE_FIELD_API_NAMES.mmOpinionLeaders, source: 'TLL Input (SteepRock)', editable: true, inputType: 'text', maxLength: MM_PROFILE_LONG_TEXT_MAX_LENGTH },
    ],
  },
];

const ACCOUNT_INTELLIGENCE_SECTIONS = accountIntelligenceSections();

const editValue = (value) => (value === null || value === undefined ? '' : String(value));
const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};
const labelWithUnit = (item) => (item.unit ? `${item.label} (${item.unit})` : item.label);

// Values come straight from the CRM record (KPH_Ecosystem_Plan__c) like every
// other Account Profile field — no component-level dummy fallback. Empty fields
// render as "-"; local/offline dummy data lives in mock fixtures.
const valueFromProfile = (profileValues, item) =>
  profileValues && Object.prototype.hasOwnProperty.call(profileValues, item.key)
    ? profileValues[item.key]
    : '';

const editableItemsForSections = (
  sections = ACCOUNT_INTELLIGENCE_SECTIONS,
  accountFields = accountInformationFields()
) => {
  const editableAccountFields = accountFields.filter((field) => field.editable);
  const editableFields = sections.flatMap((section) =>
    section.fields.filter((field) => field.editable)
  );

  return [...editableAccountFields, ...editableFields];
};

const buildInitialEditableValues = (
  profileValues = {},
  sections = ACCOUNT_INTELLIGENCE_SECTIONS,
  accountFields = accountInformationFields()
) => {
  return Object.fromEntries(
    editableItemsForSections(sections, accountFields).map((item) => [
      item.key,
      editValue(valueFromProfile(profileValues, item)),
    ])
  );
};

function AccountIntelligenceControl({ item, value, onChange, disabled = false }) {
  if (item.inputType === 'select') {
    const options = [
      { value: '', label: '-' },
      ...(item.options || []).map((option) => {
        if (option && typeof option === 'object') {
          return {
            value: editValue(option.value),
            label: String(option.label || option.value || '-'),
          };
        }
        return {
          value: editValue(option),
          label: String(option || '-'),
        };
      }),
    ];
    return (
      <select
        aria-label={item.label}
        className="account-intelligence-control"
        value={editValue(value)}
        disabled={disabled}
        onChange={(event) => onChange(item.key, event.target.value)}
      >
        {options.map((option) => (
          <option value={option.value} key={option.value || 'empty'}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (item.inputType === 'number') {
    return (
      <input
        aria-label={item.label}
        className="account-intelligence-control"
        inputMode="numeric"
        pattern="[0-9]*"
        min="0"
        type="text"
        value={editValue(value)}
        placeholder="-"
        disabled={disabled}
        onChange={(event) => onChange(item.key, event.target.value.replace(/[^\d]/g, ''))}
      />
    );
  }

  return (
    <textarea
      aria-label={item.label}
      className="account-intelligence-control is-textarea"
      maxLength={item.maxLength || MM_PROFILE_TEXT_MAX_LENGTH}
      rows={2}
      value={editValue(value)}
      disabled={disabled}
      onChange={(event) => onChange(item.key, event.target.value)}
    />
  );
}

function AccountIntelligenceField({ item, value, onChange, isReadOnly = false }) {
  const isEditable = item.editable && !isReadOnly;
  const displayUnit = item.displayUnit;
  const renderedLabel = labelWithUnit(item);
  const className = [
    'account-intelligence-field',
    isEditable ? 'is-editable' : '',
    item.editable && isReadOnly ? 'is-readonly' : '',
    item.inlineValue ? 'has-inline-value' : '',
    item.valuePlacement === 'below' ? 'has-stacked-value' : '',
    item.tabletLayout ? `is-${item.tabletLayout}` : '',
    item.layout ? `is-${item.layout}` : '',
  ].filter(Boolean).join(' ');

  const valueControl = (
    <AccountIntelligenceControl
      item={item}
      value={value}
      onChange={onChange}
      disabled={!isEditable}
    />
  );
  const renderedValue = item.editable ? (
    displayUnit ? (
      <span className="account-intelligence-value-with-unit">
        {valueControl}
        <span className="account-intelligence-value-unit">{displayUnit}</span>
      </span>
    ) : (
      valueControl
    )
  ) : (
    <strong className={displayUnit ? 'has-display-unit' : undefined}>
      {displayValue(value)}
      {displayUnit ? <span className="account-intelligence-value-unit">{displayUnit}</span> : null}
    </strong>
  );

  return (
    <div className={className}>
      <div className="account-intelligence-field-copy">
        {item.inlineValue ? (
          <div className="account-intelligence-field-label-row">
            <span>{renderedLabel}</span>
            {renderedValue}
          </div>
        ) : (
          <>
            <span>{renderedLabel}</span>
            {renderedValue}
          </>
        )}
      </div>
    </div>
  );
}

function AccountInformationSection({ fields, profileValues, editableValues, onChange, isReadOnly }) {
  return (
    <section className="account-intelligence-section account-information-section">
      <div className="account-intelligence-section-head">
        <div>
          <h3>Account Information</h3>
        </div>
      </div>
      <div className="account-information-field-grid">
        {fields.map((item) => {
          const crmValue = valueFromProfile(profileValues, item);
          return (
            <AccountIntelligenceField
              item={item}
              key={item.key}
              value={item.editable && !isReadOnly ? editableValues[item.key] ?? editValue(crmValue) : crmValue}
              onChange={onChange}
              isReadOnly={isReadOnly}
            />
          );
        })}
      </div>
    </section>
  );
}

function AccountIntelligenceSection({ section, profileValues, editableValues, onChange, isReadOnly }) {
  return (
    <section className={`account-intelligence-section is-${section.placement} ${section.className || ''}`.trim()}>
      <div className="account-intelligence-section-head">
        <span>{section.number}</span>
        <div>
          <h3>{section.title}</h3>
        </div>
      </div>
      <div className="account-intelligence-field-grid">
        {section.fields.map((item) => {
          const crmValue = valueFromProfile(profileValues, item);
          return (
            <AccountIntelligenceField
              item={item}
              key={item.key}
              value={item.editable && !isReadOnly ? editableValues[item.key] ?? editValue(crmValue) : crmValue}
              onChange={onChange}
              isReadOnly={isReadOnly}
            />
          );
        })}
      </div>
    </section>
  );
}

export default function AccountIntelligenceTab({
  values = {},
  mmProfilePicklists = {},
  isReadOnly = false,
  onSave,
  onSaveActionChange,
}) {
  const sections = useMemo(() => accountIntelligenceSections(mmProfilePicklists), [mmProfilePicklists]);
  const accountFields = useMemo(() => accountInformationFields(mmProfilePicklists), [mmProfilePicklists]);
  const editableItems = useMemo(
    () => editableItemsForSections(sections, accountFields),
    [accountFields, sections]
  );
  const [savedEditableValues, setSavedEditableValues] = useState(() =>
    buildInitialEditableValues(values, sections, accountFields)
  );
  const [editableValues, setEditableValues] = useState(() =>
    buildInitialEditableValues(values, sections, accountFields)
  );
  const [isSaving, setIsSaving] = useState(false);
  const mainSections = sections.filter((section) => section.placement === 'main');
  const sideSections = sections.filter((section) => section.placement === 'side');

  useEffect(() => {
    const initialEditableValues = buildInitialEditableValues(values, sections, accountFields);
    setSavedEditableValues(initialEditableValues);
    setEditableValues(initialEditableValues);
  }, [accountFields, values, sections]);

  const handleEditableValueChange = (key, value) => {
    if (isReadOnly) return;
    setEditableValues((current) => ({ ...current, [key]: value }));
  };

  const isFieldDirty = (item) =>
    item.editable && item.crmField && editValue(editableValues[item.key] ?? '') !== editValue(savedEditableValues[item.key] ?? '');

  const dirtyItems = useMemo(
    () => editableItems.filter((item) => item.editable && item.crmField && isFieldDirty(item)),
    [editableItems, editableValues, savedEditableValues]
  );
  const hasUnsaved = dirtyItems.length > 0;
  const dirtyCount = dirtyItems.length;

  // Save all dirty MM fields at once. The parent persists each CRM API field to
  // KPH_Ecosystem_Plan__c, matching the single-save draft flow used by DLBCL.
  const handleSave = useCallback(async () => {
    if (isReadOnly || typeof onSave !== 'function' || !hasUnsaved || isSaving) return;
    const updates = {};
    const savedUpdates = {};
    for (const item of dirtyItems) {
      const nextValue = editableValues[item.key] ?? '';
      updates[item.crmField] = nextValue;
      savedUpdates[item.key] = nextValue;
    }
    if (!Object.keys(updates).length) return;
    setIsSaving(true);
    try {
      await onSave(updates);
      setSavedEditableValues((current) => ({ ...current, ...savedUpdates }));
    } finally {
      setIsSaving(false);
    }
  }, [dirtyItems, editableValues, hasUnsaved, isReadOnly, isSaving, onSave]);
  const saveLabel = isSaving ? 'Saving...' : hasUnsaved ? `Save (${dirtyCount})` : 'Save';

  useEffect(() => {
    if (isReadOnly || typeof onSave !== 'function' || typeof onSaveActionChange !== 'function') {
      onSaveActionChange?.(null);
      return undefined;
    }
    onSaveActionChange({
      label: saveLabel,
      hasUnsaved,
      dirtyCount,
      isSaving,
      onSave: handleSave,
    });
    return () => onSaveActionChange(null);
  }, [dirtyCount, handleSave, hasUnsaved, isReadOnly, isSaving, onSave, onSaveActionChange, saveLabel]);

  return (
    <div className="account-profile-workbook account-intelligence-workbook">
      <AccountInformationSection
        fields={accountFields}
        profileValues={values}
        editableValues={editableValues}
        onChange={handleEditableValueChange}
        isReadOnly={isReadOnly}
      />

      <div className="account-intelligence-detail-layout">
        <div className="account-intelligence-main-stack">
          {mainSections.map((section) => (
            <AccountIntelligenceSection
              section={section}
              profileValues={values}
              editableValues={editableValues}
              onChange={handleEditableValueChange}
              isReadOnly={isReadOnly}
              key={section.title}
            />
          ))}
        </div>
        <aside className="account-intelligence-side-stack">
          {sideSections.map((section) => (
            <AccountIntelligenceSection
              section={section}
              profileValues={values}
              editableValues={editableValues}
              onChange={handleEditableValueChange}
              isReadOnly={isReadOnly}
              key={section.title}
            />
          ))}
        </aside>
      </div>
    </div>
  );
}
