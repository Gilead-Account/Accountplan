import { useEffect, useMemo, useRef, useState } from 'react';
import AccountProfileFieldHelp from '@/components/AccountProfileFieldHelp';

const EMPTY_OPTION = { value: '', label: '-' };
const editValue = (value) => (value === null || value === undefined ? '' : String(value));
const MULTI_PICKLIST_SEPARATOR = ';';

const parseMultiPicklistValue = (value) =>
  editValue(value)
    .split(MULTI_PICKLIST_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);

const serializeMultiPicklistValue = (values) =>
  (Array.isArray(values) ? values : [])
    .map((value) => editValue(value).trim())
    .filter(Boolean)
    .join(MULTI_PICKLIST_SEPARATOR);

const profileDisplay = (item) => {
  if (!item) return '-';
  const valueKey = editValue(item.value);
  const option = Array.isArray(item.options)
    ? item.options.find((opt) => String(opt.value ?? '') === valueKey)
    : null;
  if (option && option.label) return option.label;
  if (item.value === true || item.value === 'true' || item.value === 'Yes') return 'Yes';
  if (item.value === false || item.value === 'false' || item.value === 'No') return 'No';
  return item.value === null || item.value === undefined || item.value === '' ? '-' : item.value;
};

const parseTopPayers = (item) => {
  const value = profileDisplay(item);
  if (!value || value === '-') return [];
  return String(value)
    .split(/[\/\n]+/)
    .map((payer) => payer.trim())
    .filter(Boolean)
    .slice(0, 3);
};

const topPayerCountClass = (count) => {
  const normalized = Math.max(0, Math.min(Number(count) || 0, 3));
  const exactClass = [
    'has-no-top-payers',
    'has-one-top-payer',
    'has-two-top-payers',
    'has-three-top-payers',
  ][normalized];
  const densityClass = normalized > 1 ? 'has-expanded-top-payers' : 'has-compact-top-payers';
  return `${densityClass} ${exactClass} payer-count-${normalized}`;
};

function EmptyPayerState() {
  return <div className="top-payers-empty">No payers entered</div>;
}

const attributeKeyClass = (key) =>
  key ? `is-${String(key).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}` : '';

function AttributeLabel({ item }) {
  return (
    <div className="profile-attribute-label">
      <span>{item.label}</span>
      <AccountProfileFieldHelp
        helpKey={item.helpKey || item.key}
        label={item.label}
        className="profile-attribute-help"
      />
    </div>
  );
}

function TopPayersRankedCard({ item }) {
  const payers = parseTopPayers(item);
  const densityClass = payers.length > 1 ? 'has-multiple-payers' : 'has-compact-payers';

  return (
    <div className={`profile-attribute-card is-top-payers-ranked is-top-payers ${densityClass} payer-count-${payers.length}`}>
      <AttributeLabel item={item} />
      <div className="top-payers-ranked-list" aria-label={item.label}>
        {payers.length ? payers.map((payer, idx) => (
          <div className="top-payers-ranked-row" key={`ranked-${payer}-${idx}`}>
            <span className="top-payers-rank">{idx + 1}</span>
            <strong title={payer}>{payer}</strong>
          </div>
        )) : <EmptyPayerState />}
      </div>
    </div>
  );
}

function AttributeGrid({ rows, gridClassName = '' }) {
  const topPayerCount = parseTopPayers((rows || []).find((item) => item.key === 'topPayers')).length;
  const payerCountClass = gridClassName.includes('reimbursement-card-grid')
    ? topPayerCountClass(topPayerCount)
    : '';
  const className = ['profile-attribute-grid', gridClassName, payerCountClass].filter(Boolean).join(' ');

  return (
    <div className={className}>
      {rows.map((item) => {
        if (item.key === 'topPayers') {
          return <TopPayersRankedCard item={item} key={item.key} />;
        }

        return (
          <div className={`profile-attribute-card ${attributeKeyClass(item.key)}`.trim()} key={item.key}>
            <AttributeLabel item={item} />
            {/* Both text and boolean values render as plain strong text so all
              eight attribute cards line up visually — no chip-like bubble on
              boolean answers. */}
            <strong>{profileDisplay(item)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function ProfileQuestionRow({ item, draftValue, isDirty, onDraftChange, isReadOnly = false }) {
  const isMultiSelect = item.isMultiSelect || item.inputType === 'multipicklist';
  const multiSelectRef = useRef(null);
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  const itemOptions = Array.isArray(item.options) ? item.options : [];
  const selectOptions = itemOptions.map((opt) => ({
    value: editValue(opt.value),
    label: String(opt.label || opt.value || '-'),
  }));
  const selectedValues = isMultiSelect ? parseMultiPicklistValue(draftValue) : [draftValue];
  const selectedLabels = selectedValues
    .filter(Boolean)
    .map((value) => selectOptions.find((opt) => opt.value === value)?.label || value);
  const selectedLabel = selectedLabels.length
    ? selectedLabels.join(', ')
    : (draftValue && !isMultiSelect ? String(draftValue) : EMPTY_OPTION.label);
  const hiddenSelectedOptions = selectedValues
    .filter((value) => value && !selectOptions.some((opt) => opt.value === value))
    .map((value) => ({ value, label: value }));
  const selectValue = isMultiSelect ? selectedValues : draftValue;
  const toggleMultiSelectValue = (value) => {
    if (isReadOnly) return;
    const current = new Set(selectedValues);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    const orderedValues = selectOptions
      .map((opt) => opt.value)
      .filter((optionValue) => current.has(optionValue));
    onDraftChange(item, serializeMultiPicklistValue(orderedValues));
  };

  useEffect(() => {
    if (!isMultiSelectOpen) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (multiSelectRef.current && !multiSelectRef.current.contains(event.target)) {
        setIsMultiSelectOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [isMultiSelectOpen]);

  return (
    <div className={`profile-question-row${isDirty ? ' is-dirty' : ''}${isReadOnly ? ' is-readonly' : ''}${isMultiSelect ? ' is-multi-select' : ''}`}>
      <span>{item.label}</span>
      <div className="profile-question-answer">
        {isMultiSelect ? (
          <div className="profile-question-multi-select" ref={multiSelectRef}>
            <button
              type="button"
              className="profile-question-select-shell profile-question-multi-button"
              onClick={() => {
                if (!isReadOnly) setIsMultiSelectOpen((open) => !open);
              }}
              disabled={isReadOnly}
              aria-expanded={isMultiSelectOpen}
              aria-label={item.label}
            >
              <span className="profile-question-select-value">{selectedLabel}</span>
            </button>
            {isMultiSelectOpen && (
              <div className="profile-question-multi-menu">
                {selectOptions.map((opt) => {
                  const checked = selectedValues.includes(opt.value);
                  return (
                    <label className="profile-question-multi-option" key={`${opt.value}-${opt.label}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMultiSelectValue(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="profile-question-select-shell">
            <span className="profile-question-select-value" aria-hidden="true">{selectedLabel}</span>
            <select
              className="profile-question-edit-input profile-question-select-input"
              value={selectValue}
              onChange={(e) => {
                if (!isReadOnly) onDraftChange(item, e.target.value);
              }}
              disabled={isReadOnly}
              aria-label={item.label}
            >
              {hiddenSelectedOptions.map((opt) => (
                <option key={`hidden-${opt.value}`} value={opt.value} hidden>
                  {opt.label}
                </option>
              ))}
              {selectOptions.map((opt) => (
                <option key={`${opt.value}-${opt.label}`} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

const buildDrafts = (columns) => {
  const out = {};
  for (const column of columns || []) {
    for (const item of column || []) {
      out[item.key] = editValue(item.value);
    }
  }
  return out;
};

export default function ProfileTab({
  account,
  attributeRows,
  reimbursementRows,
  profileQuestionColumns,
  yesNoOptions,
  onSaveProfileAnswer,
  onNotify,
  isReadOnly = false,
}) {
  // Flat list of all DLBCL profile items — used for diffing drafts vs saved.
  const allItems = useMemo(
    () => (profileQuestionColumns || []).flatMap((column) => column || []),
    [profileQuestionColumns]
  );

  // Drafts mirror saved values until the user changes something. Changes
  // accumulate locally and are only sent to CRM when Save is clicked.
  const [drafts, setDrafts] = useState(() => buildDrafts(profileQuestionColumns));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setDrafts(buildDrafts(profileQuestionColumns));
    setSaveError('');
  }, [profileQuestionColumns]);

  const dirtyItems = useMemo(
    () => allItems.filter((item) => editValue(item.value) !== editValue(drafts[item.key])),
    [allItems, drafts]
  );
  const dirtyKeys = useMemo(() => new Set(dirtyItems.map((item) => item.key)), [dirtyItems]);
  const hasUnsaved = dirtyItems.length > 0;

  const handleDraftChange = (item, nextValue) => {
    if (isReadOnly) return;
    setDrafts((current) => ({ ...current, [item.key]: nextValue }));
    setSaveError('');
  };

  const handleSave = async () => {
    if (isReadOnly || !hasUnsaved || isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      for (const item of dirtyItems) {
        await onSaveProfileAnswer(item, drafts[item.key]);
      }
      onNotify?.({
        title: 'Account profile saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
    } catch (error) {
      setSaveError(error?.message || 'Unable to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveLabel = isSaving ? 'Saving…' : hasUnsaved ? `Save (${dirtyItems.length})` : 'Save';

  return (
    <div className="account-profile-workbook">
      <article className="mock-card profile-overview-card">
        <h3>Account Attributes</h3>
        <AttributeGrid rows={attributeRows} />
      </article>

      <article className="mock-card profile-overview-card">
        <h3>DLBCL Reimbursement</h3>
        <AttributeGrid rows={reimbursementRows} gridClassName="reimbursement-card-grid" />
      </article>

      <article className="mock-card profile-question-card">
        <div className="dlbcl-profile-head">
          <h3 className="account-profile-title-with-help">
            <span>DLBCL Profile</span>
            <AccountProfileFieldHelp helpKey="dlbclProfile" label="DLBCL Profile" />
          </h3>
          <button
            type="button"
            className="dlbcl-profile-save-button"
            disabled={isReadOnly || !hasUnsaved || isSaving}
            onClick={handleSave}
          >
            {saveLabel}
          </button>
        </div>
        <div className="profile-question-columns">
          {profileQuestionColumns.map((column, idx) => (
            <div key={`col-${idx}`} className="profile-question-table">
              <div className="profile-question-head">
                <span>Question</span>
                <span>Answer</span>
              </div>
              {column
                .filter((item) => {
                  // Conditional follow-up: only show if the parent answer
                  // starts with "Yes" (CRM stores answers like "Yes",
                  // "Yes - …", etc., so we match the prefix).
                  if (!item.dependsOn) return true;
                  const parent = drafts[item.dependsOn] ?? '';
                  const normalizedParent = String(parent).trim().toLowerCase();
                  if (item.showWhenParentHasValue) {
                    return Boolean(normalizedParent) &&
                      normalizedParent !== 'no' &&
                      normalizedParent !== 'no preference';
                  }
                  return normalizedParent.startsWith('yes');
                })
                .map((item) => (
                  <ProfileQuestionRow
                    key={item.key}
                    item={item}
                    draftValue={drafts[item.key] ?? ''}
                    isDirty={dirtyKeys.has(item.key)}
                    onDraftChange={handleDraftChange}
                    isReadOnly={isReadOnly}
                  />
                ))}
            </div>
          ))}
        </div>
        {saveError && <div className="dlbcl-profile-save-error">{saveError}</div>}
      </article>
    </div>
  );
}
