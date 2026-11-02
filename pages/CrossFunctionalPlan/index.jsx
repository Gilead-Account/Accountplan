import { useEffect, useMemo, useRef, useState } from 'react';
import { FieldHelpButton } from '@/components/EditModalField';
import { formatDateLabel } from '@/lib/helper/utils';
import { savePoaBlock } from '@/lib/dataservice/accountPlan/crossFunctionalPlan';

// Port of views/pages/linked-opportunities.html. Active DLBCL long-text fields
// live on Account_Plan_vod__c and are grouped by function.

const POA_HELP_TEXT = {
  subheader:
    'This section provides a high-level, compliant summary of the current plan of action across functions to support alignment and shared perspective. It reflects what the team is focused on now and is not intended for detailed tactics or activity tracking. Aligned team members have access to their respective sections.',
  'dlbcl-customer-engagement':
    'Summarize the current, high-level Commercial approach for engaging the account.',
  'dlbcl-market-access':
    'Summarize the current, high-level Market Access approach and priorities impacting the account.',
  'dlbcl-medical-affairs':
    'Summarize the current, high-level Medical approach and focus areas for the account.',
};

const MAX_POA_LENGTH = 500;
const MEDICAL_POA_FUNCTION = 'Medical Affairs';

const POA_FUNCTION_BY_USER_TYPE = {
  commercial: 'Customer Engagement',
  'market-access': 'Market Access',
  medical: MEDICAL_POA_FUNCTION,
};

const POA_VISIBLE_FUNCTIONS_BY_USER_TYPE = {
  commercial: ['Customer Engagement', 'Market Access', MEDICAL_POA_FUNCTION],
  'market-access': ['Customer Engagement', 'Market Access', MEDICAL_POA_FUNCTION],
  medical: [MEDICAL_POA_FUNCTION],
};

const normalize = (value) => String(value || '').trim().toLowerCase();

export const resolvePoaUserType = (activeUser) => {
  const source = normalize([
    activeUser && activeUser.userType,
    activeUser && activeUser.role,
    activeUser && activeUser.functionName,
    activeUser && activeUser.title,
    activeUser && activeUser.profile,
    activeUser && activeUser.profileName,
    activeUser && activeUser.profileNameVod,
    activeUser && activeUser.Profile_Name_vod_c,
    activeUser && activeUser.Profile_Name_vod__c,
  ].filter(Boolean).join(' '));

  if (!source) return null;
  if (
    source.includes('kph-key account director') ||
    source.includes('market access') ||
    /\baccess\b/.test(source) ||
    source.includes('payer') ||
    source.includes('market') ||
    source.includes('kam') ||
    source.includes('kad') ||
    source.includes('reimbursement')
  ) {
    return 'market-access';
  }
  if (
    source.includes('medical') ||
    source.includes('msl') ||
    source.includes('science') ||
    source.includes('scientist') ||
    source.includes('scientific') ||
    source.includes('heor')
  ) {
    return 'medical';
  }
  if (
    source.includes('commercial') ||
    source.includes('sales') ||
    source.includes('account manager') ||
    source.includes('account director') ||
    source.includes('key account') ||
    source.includes('therapy account') ||
    source.includes('ctam') ||
    source.includes('customer engagement')
  ) {
    return 'commercial';
  }
  return null;
};

export const canEditPoaBlock = (activeUser, block) => {
  if (!block || block.functionName === MEDICAL_POA_FUNCTION) return false;
  const userType = resolvePoaUserType(activeUser);
  return !!block && POA_FUNCTION_BY_USER_TYPE[userType] === block.functionName;
};

export const canViewPoaBlock = (activeUser, block) => {
  if (!block) return false;
  if (block.functionName === MEDICAL_POA_FUNCTION) return true;
  const userType = resolvePoaUserType(activeUser);
  const visibleFunctions = POA_VISIBLE_FUNCTIONS_BY_USER_TYPE[userType] || [];
  return visibleFunctions.includes(block.functionName);
};

const valuesForBlocks = (blocks) =>
  (blocks || []).reduce((acc, block) => {
    acc[block.key] = block.content || '';
    return acc;
  }, {});

function EditPencilIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function PoaHelpToggle({ label, text }) {
  if (!text) return null;
  return (
    <FieldHelpButton
      className="poa-help-toggle"
      label={label}
      text={text}
    />
  );
}

function PoaBlock({
  block,
  lastModifiedDate,
  value,
  savedValue,
  helpText,
  canEdit,
  isEditing,
  isSaving,
  hasActiveEdit,
  error,
  onStartEdit,
  onChange,
  onCancel,
  onSave,
}) {
  const textareaRef = useRef(null);
  const stateClass = isEditing ? 'is-editing' : canEdit ? 'is-editable' : 'is-readonly';
  const accessLabel = canEdit ? 'Your section' : 'View only';
  const accessTitle = canEdit
    ? 'You can edit this plan of action.'
    : `${block.functionName} owns edits for this plan of action.`;
  const characterCount = String(value || '').length;
  const hasChanges = value !== (savedValue || '');
  const editDisabled = hasActiveEdit && !isEditing;

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  return (
    <article className={`mock-card poa-function-block poa-tone-${block.tone} ${stateClass}`}>
      <div className="poa-function-head">
        <div className="poa-function-title-row">
          <h3>{block.heading}</h3>
          <PoaHelpToggle
            label={`${block.heading} guidance`}
            text={helpText}
          />
        </div>
        <div className="poa-head-actions">
          {!isEditing && (
            <>
              <span
                className={`poa-access-pill ${canEdit ? 'can-edit' : 'is-view-only'}`}
                title={accessTitle}
              >
                {accessLabel}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="poa-edit-pencil"
                  onClick={() => onStartEdit(block.key)}
                  disabled={editDisabled}
                  aria-label={`Edit ${block.heading}`}
                  title={editDisabled ? 'Finish the current edit first' : 'Edit plan'}
                >
                  <EditPencilIcon />
                </button>
              )}
            </>
          )}
          {isEditing && (
            <div className="poa-head-action-row">
              <button
                type="button"
                className="poa-button-discard"
                onClick={() => onCancel(block.key)}
                disabled={isSaving}
              >
                Discard
              </button>
              <button
                type="button"
                className="poa-button-save"
                onClick={() => onSave(block)}
                disabled={isSaving || !hasChanges}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="poa-editable-box">
        <textarea
          ref={textareaRef}
          maxLength={MAX_POA_LENGTH}
          aria-label={block.heading}
          value={value}
          onChange={isEditing ? (e) => onChange(block.key, e.target.value) : undefined}
          readOnly={!isEditing}
          placeholder={isEditing ? 'Add the shared plan of action...' : 'No plan entered yet.'}
        />
      </div>

      <div className="poa-footnote-row">
        <div className="poa-updated">
          Last updated: {formatDateLabel(lastModifiedDate, 'Never')}
        </div>
        <div
          className={`poa-character-count ${characterCount > MAX_POA_LENGTH - 50 ? 'is-near-limit' : ''}`}
        >
          {characterCount}/{MAX_POA_LENGTH}
        </div>
      </div>
      {error && <div className="poa-save-error">{error}</div>}
    </article>
  );
}

export default function CrossFunctionalPlan({ data, onNotify, isReadOnly = false }) {
  const blocks = data.blocks || [];
  const currentUser = data.currentUser || null;
  const lastModifiedDate = data.poaLastModifiedDate;
  const [savedValues, setSavedValues] = useState(() => valuesForBlocks(blocks));
  const [blockValues, setBlockValues] = useState(() => valuesForBlocks(blocks));
  const [editingKey, setEditingKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [saveErrors, setSaveErrors] = useState({});
  const [savedAtByKey, setSavedAtByKey] = useState({});

  useEffect(() => {
    const nextValues = valuesForBlocks(blocks);
    setSavedValues(nextValues);
    setBlockValues(nextValues);
    setEditingKey(null);
    setSaveErrors({});
    setSavedAtByKey({});
  }, [blocks]);

  useEffect(() => {
    if (isReadOnly) setEditingKey(null);
  }, [isReadOnly]);

  const visibleBlocks = useMemo(
    () => blocks.filter((block) => canViewPoaBlock(currentUser, block)),
    [blocks, currentUser]
  );

  const rows = useMemo(() => {
    // Group blocks by function so the grid renders
    // function-by-function, matching the legacy `visiblePoaBlockRows` layout.
    const nextRows = [];
    const seen = new Set();
    for (const block of visibleBlocks) {
      if (seen.has(block.functionName)) continue;
      seen.add(block.functionName);
      const dlbcl = visibleBlocks.find((b) => b.functionName === block.functionName && b.indication === 'DLBCL');
      const rowBlocks = [dlbcl].filter(Boolean);
      if (rowBlocks.length) {
        nextRows.push({ key: block.functionName, blocks: rowBlocks });
      }
    }
    return nextRows;
  }, [visibleBlocks]);

  const updateBlockValue = (key, value) => {
    if (isReadOnly) return;
    setBlockValues((current) => ({ ...current, [key]: value }));
  };

  const startEdit = (key) => {
    if (isReadOnly) return;
    const block = visibleBlocks.find((item) => item.key === key);
    if (!canEditPoaBlock(currentUser, block)) return;
    setEditingKey(key);
    setSaveErrors((current) => ({ ...current, [key]: null }));
  };

  const cancelEdit = (key) => {
    setBlockValues((current) => ({ ...current, [key]: savedValues[key] || '' }));
    setSaveErrors((current) => ({ ...current, [key]: null }));
    setEditingKey(null);
  };

  const saveBlock = async (block) => {
    if (isReadOnly) return;
    if (!canEditPoaBlock(currentUser, block)) {
      setSaveErrors((current) => ({
        ...current,
        [block.key]: 'You can only edit your own Plan of Action section.',
      }));
      return;
    }
    const value = blockValues[block.key] || '';
    setSavingKey(block.key);
    setSaveErrors((current) => ({ ...current, [block.key]: null }));
    try {
      await savePoaBlock(data.planId, block, value);
      setSavedValues((current) => ({ ...current, [block.key]: value }));
      setSavedAtByKey((current) => ({ ...current, [block.key]: new Date().toISOString() }));
      onNotify?.({
        title: 'Plan of Action saved.',
        detail: 'Your changes have been saved.',
        refreshPages: true,
      });
      setEditingKey(null);
    } catch (error) {
      setSaveErrors((current) => ({
        ...current,
        [block.key]: error && error.message ? error.message : 'Unable to save changes.',
      }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="page page-poa mock-poa-page">
      <header className="mock-card poa-page-header">
        <div className="poa-page-title-row">
          <h2>Cross Functional Account Plan</h2>
        </div>
        <p className="poa-page-subheader">{POA_HELP_TEXT.subheader}</p>
      </header>

      {rows.length === 0 && (
        <div className="poa-access-note">
          No Plan of Action sections are available.
        </div>
      )}

      {rows.length > 0 && (
        <div className="poa-block-list">
          {rows.map((row) => (
            <div key={row.key} className={`poa-block-row ${row.blocks.length > 1 ? 'has-mm' : ''}`.trim()}>
              {row.blocks.map((block) => (
                <PoaBlock
                  key={block.key}
                  block={block}
                  value={blockValues[block.key] || ''}
                  savedValue={savedValues[block.key] || ''}
                  helpText={POA_HELP_TEXT[block.key]}
                  canEdit={!isReadOnly && canEditPoaBlock(currentUser, block)}
                  isEditing={editingKey === block.key}
                  isSaving={savingKey === block.key}
                  hasActiveEdit={!!editingKey}
                  error={saveErrors[block.key]}
                  onStartEdit={startEdit}
                  onChange={updateBlockValue}
                  onCancel={cancelEdit}
                  onSave={saveBlock}
                  lastModifiedDate={savedAtByKey[block.key] || lastModifiedDate}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
