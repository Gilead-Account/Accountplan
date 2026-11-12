import { useEffect, useState } from 'react';
import Field, { FieldHelpButton } from '@/components/EditModalField';

const REGIONAL_DYNAMICS_HELP = {
  subheader:
    'DLBCL Regional Dynamics to be aware of: Capture observations on broader market dynamics that may impact the ATC ecosystem (e.g., competitive shifts, payer changes, system expansions). Update as new information becomes available.',
};

export default function RegionalDynamicsEditModal({ indication, value, isSaving, error, onClose, onSave }) {
  const [draft, setDraft] = useState(value || '');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setDraft(value || '');
    setValidationError('');
  }, [indication, value]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSaving, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) onSave(indication, draft);
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
            <h3>{indication} Regional Dynamics</h3>
            <div className="stakeholder-edit-subtitle-row">
              <p>{indication} Regional Dynamics to be aware of</p>
              <FieldHelpButton
                className="stakeholder-edit-subtitle-help"
                label={`${indication} Regional Dynamics guidance`}
                text={REGIONAL_DYNAMICS_HELP.subheader}
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
              <Field label="Content" className="is-textarea">
                <textarea
                  rows={8}
                  value={draft}
                  maxLength={3000}
                  onChange={(e) => {
                    setValidationError('');
                    setDraft(e.target.value);
                  }}
                />
              </Field>
            </div>
            <div className="account-profile-character-count">
              {(draft || '').length} / 3000 characters
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
