import { useEffect, useMemo, useState } from 'react';
import { FieldHelpButton } from '@/components/EditModalField';
import { displayValue, teamMemberPhone } from '@/lib/helper/utils';
import AccountLookupField from '@/pages/AccountProfile/AccountLookupField';

const TEAM_MEMBER_FIELD_HELP = {
  name: 'Select the internal user who may access and contribute to the account plan.',
  role: "Identifies the team member's title.",
  participation:
    'Defines how the team member contributes to the account plan (e.g., lead, core contributor, support) and helps determine their level of engagement and visibility within the plan.',
};

const TEAM_MEMBER_FIELDS = [
  { label: 'Role', key: 'role', readOnly: true, help: TEAM_MEMBER_FIELD_HELP.role },
  { label: 'Status', key: 'status', readOnly: true, type: 'select' },
  { label: 'Participation', key: 'participation', readOnly: false, type: 'select', help: TEAM_MEMBER_FIELD_HELP.participation },
];

const buildInitialForm = (member) => ({
  userId: member?.userId || '',
  name: member?.name || '',
  role: displayValue(member?.role || member?.functionName, ''),
  status: member?.isPrimary ? 'Active' : 'Inactive',
  participation: member?.participation || '',
});

function Field({ field, value, onChange, options = [], isNew }) {
  const id = `team-member-field-${field.key}`;
  const readOnly = field.readOnly;
  const type = field.type || 'text';
  const className = [
    'stakeholder-edit-field',
    `is-${type}`,
    readOnly ? 'is-readonly' : '',
  ]
    .filter(Boolean)
    .join(' ');

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

const mergeOptions = (current, options) => {
  const seen = new Set();
  const out = [];
  for (const value of [current, ...(options || [])]) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

export default function TeamMemberEditModal({
  member,
  participationOptions: participationOptionValues = [],
  statusOptions = [],
  searchUsers,
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState(() => buildInitialForm(member));
  const [validationError, setValidationError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isEdit = !!member?.id;
  const isNew = !isEdit;

  useEffect(() => {
    setForm(buildInitialForm(member));
    setValidationError('');
    setIsSaving(false);
    setDeleteConfirm(false);
  }, [member?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const participationOptions = useMemo(() => {
    return mergeOptions(form.participation, participationOptionValues);
  }, [form.participation, participationOptionValues]);
  const statusSelectOptions = useMemo(() => {
    return mergeOptions(form.status, statusOptions);
  }, [form.status, statusOptions]);

  if (!member) return null;

  const updateField = (key, value) => {
    setValidationError('');
    setForm((f) => ({ ...f, [key]: value }));
  };

  const updateUserQuery = (value) => {
    setValidationError('');
    setForm((current) => ({ ...current, name: value, userId: '' }));
  };

  const selectUser = (user) => {
    setValidationError('');
    setForm((current) => ({
      ...current,
      name: user?.name || '',
      userId: user?.id || '',
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (searchUsers && !form.userId) {
      setValidationError('Select a team member from the user search results.');
      return;
    }
    setValidationError('');
    setIsSaving(true);
    try {
      if (onSave) await onSave(member.id, form);
      onClose();
    } catch (error) {
      setValidationError(error && error.message ? error.message : 'Unable to save team member.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isNew) return;
    setValidationError('');
    setIsSaving(true);
    try {
      await onDelete(member);
      onClose();
    } catch (error) {
      setValidationError(error && error.message ? error.message : 'Unable to delete team member.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="stakeholder-edit-overlay" onClick={isSaving ? undefined : onClose} role="presentation">
      <form
        className="stakeholder-edit-modal team-member-edit-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
      >
        <header className="stakeholder-edit-head">
          <div className="stakeholder-edit-title">
            <span className="stakeholder-edit-eyebrow">Team member</span>
            <h3>{isNew ? 'Add Team Member' : 'Edit Team Member'}</h3>
            <p>{isNew ? 'Create a new team member row' : member.name || 'Unnamed team member'}</p>
            <div className="stakeholder-edit-head-meta" aria-label="Team member summary">
              <span>{displayValue(member.role || member.functionName, 'No role')}</span>
              <span>{teamMemberPhone(member)}</span>
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
              Confirm delete for this team member record. This cannot be undone.
            </div>
          )}
          <section className="stakeholder-edit-section">
            <h4>Team List Fields</h4>
            <div className="stakeholder-edit-grid">
              <AccountLookupField
                label="Name"
                query={form.name}
                placeholder="Search team member name"
                searchAccounts={searchUsers}
                loadingText="Searching users..."
                emptyText="No users found."
                className="team-member-user-lookup-field"
                resultLimit={60}
                help={TEAM_MEMBER_FIELD_HELP.name}
                onQueryChange={updateUserQuery}
                onSelect={selectUser}
              />
              {TEAM_MEMBER_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  field={f}
                  value={form[f.key]}
                  onChange={updateField}
                  options={f.key === 'participation' ? participationOptions : statusSelectOptions}
                  isNew={isNew}
                />
              ))}
            </div>
          </section>
          {validationError && <div className="critical-activity-edit-error">{validationError}</div>}
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
              <button type="button" className="stakeholder-edit-button-secondary" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className="stakeholder-edit-button-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : isNew ? 'Add Team Member' : 'Save'}
              </button>
            </>
          )}
        </footer>
      </form>
    </div>
  );
}
